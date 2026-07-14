// Thin, typed wrapper over @tauri-apps/plugin-sql.
// Every task/list action writes an op_log row so undo (and later, sync) is free.
//
// NOTE: the real backend only works inside the Tauri webview (`npm run tauri dev`),
// not a plain browser tab (`npm run dev` in Chrome) — the SQL plugin lives on the
// Rust side. The store surfaces a friendly error if it's missing. Tests inject an
// in-memory SQLite backend via setDriver(), so this module stays fully testable.

import { List, Status, Task, StatusGroup, Priority } from "../lib/types";

export const DB_URL = "sqlite:clickup-local.db"; // MUST match src-tauri/src/lib.rs DB_URL

// ── SQL backend seam ───────────────────────────────────────────────────
// The whole data layer talks to this interface. Production binds it to the
// Tauri SQL plugin; tests bind it to better-sqlite3 (see src/db/client.test.ts).
export interface SqlDriver {
  execute(sql: string, params: unknown[]): Promise<void>;
  select<T = unknown>(sql: string, params: unknown[]): Promise<T[]>;
}

let _driver: SqlDriver | null = null;

/** Swap the SQL backend. Passing null restores the default (Tauri) driver. */
export function setDriver(d: SqlDriver | null): void {
  _driver = d;
}

async function driver(): Promise<SqlDriver> {
  if (_driver) return _driver;
  // Loaded lazily so this module can be imported (and tested) without Tauri.
  const { default: Database } = await import("@tauri-apps/plugin-sql");
  const database = await Database.load(DB_URL);
  _driver = {
    execute: async (sql, params) => {
      await database.execute(sql, params);
    },
    select: async (sql, params) => (await database.select(sql, params)) as never,
  };
  return _driver;
}

export function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return "id_" + Math.abs(hash(String(performance.now()) + Math.random())).toString(36);
  }
}
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

const now = () => Date.now();

async function exec(sql: string, params: unknown[] = []): Promise<void> {
  await (await driver()).execute(sql, params);
}
async function sel<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await driver()).select<T>(sql, params);
}

// ── op-log & undo/redo ─────────────────────────────────────────────────
// The op_log is append-only: undo/redo flip an `undone` flag, they never
// delete history — that keeps it a clean seam for future last-write-wins sync.
// The redo *ordering* is held in memory (like most apps' redo history).
interface OpRow {
  id: string;
  entity: string;
  entity_id: string;
  op: string;
  before: string | null;
  after: string | null;
  at: number;
}
let redoStack: OpRow[] = [];
export function canRedo(): boolean {
  return redoStack.length > 0;
}

async function logOp(
  entity: "task" | "list" | "status",
  entity_id: string,
  op: "create" | "update" | "delete",
  before: unknown,
  after: unknown
): Promise<void> {
  redoStack = []; // a fresh mutation invalidates any redo future
  await exec(`INSERT INTO op_log (id, entity, entity_id, op, before, after, at) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [
    uid(),
    entity,
    entity_id,
    op,
    before != null ? JSON.stringify(before) : null,
    after != null ? JSON.stringify(after) : null,
    now(),
  ]);
}

// ── reads ──────────────────────────────────────────────────────────────
export async function getLists(): Promise<List[]> {
  return sel<List>(`SELECT * FROM list WHERE deleted_at IS NULL ORDER BY is_inbox DESC, orderindex ASC`);
}
export async function getStatuses(listId: string): Promise<Status[]> {
  return sel<Status>(`SELECT * FROM status WHERE list_id=$1 ORDER BY orderindex ASC`, [listId]);
}
export async function getTasksForList(listId: string): Promise<Task[]> {
  return sel<Task>(
    `SELECT * FROM task WHERE list_id=$1 AND deleted_at IS NULL AND archived_at IS NULL ORDER BY orderindex ASC`,
    [listId]
  );
}
/** Cross-list "what needs doing on/before <ts>" — top-level, not completed. */
export async function getTasksDueThrough(ts: number): Promise<Task[]> {
  return sel<Task>(
    `SELECT * FROM task
       WHERE due_date IS NOT NULL AND due_date <= $1
         AND parent_id IS NULL AND completed_at IS NULL
         AND deleted_at IS NULL AND archived_at IS NULL
       ORDER BY due_date ASC, priority ASC`,
    [ts]
  );
}
async function getTask(id: string): Promise<Task | undefined> {
  return (await sel<Task>(`SELECT * FROM task WHERE id=$1`, [id]))[0];
}

/** Scheduled work-blocks whose start falls in [start, end). Cross-list. */
export async function getTasksScheduledBetween(start: number, end: number): Promise<Task[]> {
  return sel<Task>(
    `SELECT * FROM task
       WHERE scheduled_start IS NOT NULL AND scheduled_start >= $1 AND scheduled_start < $2
         AND deleted_at IS NULL AND archived_at IS NULL
       ORDER BY scheduled_start ASC`,
    [start, end]
  );
}

/** Incomplete, unscheduled, top-level tasks — the calendar's "to schedule" tray. */
export async function getUnscheduledTasks(limit = 100): Promise<Task[]> {
  return sel<Task>(
    `SELECT * FROM task
       WHERE scheduled_start IS NULL AND parent_id IS NULL AND completed_at IS NULL
         AND deleted_at IS NULL AND archived_at IS NULL
       ORDER BY (due_date IS NULL) ASC, due_date ASC, orderindex ASC
       LIMIT $1`,
    [limit]
  );
}

// ── lists & statuses ────────────────────────────────────────────────────
const DEFAULT_STATUSES: Array<{ name: string; color: string; grp: StatusGroup }> = [
  { name: "To Do", color: "#8b95a7", grp: "not_started" },
  { name: "In Progress", color: "#6b57f2", grp: "active" },
  { name: "Done", color: "#2ecd6f", grp: "done" },
];

export async function createDefaultStatuses(listId: string): Promise<Status[]> {
  const made: Status[] = [];
  for (let i = 0; i < DEFAULT_STATUSES.length; i++) {
    const s = DEFAULT_STATUSES[i];
    const row: Status = { id: uid(), list_id: listId, name: s.name, color: s.color, grp: s.grp, orderindex: i };
    await exec(`INSERT INTO status (id,list_id,name,color,grp,orderindex) VALUES ($1,$2,$3,$4,$5,$6)`, [
      row.id,
      row.list_id,
      row.name,
      row.color,
      row.grp,
      row.orderindex,
    ]);
    made.push(row);
  }
  return made;
}

export async function createList(name: string, isInbox = false): Promise<List> {
  const row: List = {
    id: uid(),
    name,
    color: "#6b57f2",
    is_inbox: isInbox ? 1 : 0,
    orderindex: now(),
    created_at: now(),
    archived_at: null,
    deleted_at: null,
  };
  await exec(`INSERT INTO list (id,name,color,is_inbox,orderindex,created_at) VALUES ($1,$2,$3,$4,$5,$6)`, [
    row.id,
    row.name,
    row.color,
    row.is_inbox,
    row.orderindex,
    row.created_at,
  ]);
  await logOp("list", row.id, "create", null, row);
  await createDefaultStatuses(row.id);
  return row;
}

// ── tasks ────────────────────────────────────────────────────────────────
export interface NewTask {
  list_id: string;
  name: string;
  status_id?: string | null;
  priority?: Priority;
  due_date?: number | null;
  parent_id?: string | null;
  scheduled_start?: number | null;
  duration_min?: number | null;
}

export async function createTask(t: NewTask): Promise<Task> {
  const ts = now();
  const row: Task = {
    id: uid(),
    list_id: t.list_id,
    parent_id: t.parent_id ?? null,
    name: t.name,
    description: null,
    status_id: t.status_id ?? null,
    priority: t.priority ?? 0,
    due_date: t.due_date ?? null,
    start_date: null,
    scheduled_start: t.scheduled_start ?? null,
    duration_min: t.duration_min ?? null,
    orderindex: ts,
    created_at: ts,
    updated_at: ts,
    completed_at: null,
    archived_at: null,
    deleted_at: null,
  };
  await exec(
    `INSERT INTO task (id,list_id,parent_id,name,description,status_id,priority,due_date,start_date,scheduled_start,duration_min,orderindex,created_at,updated_at,completed_at,archived_at,deleted_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [
      row.id,
      row.list_id,
      row.parent_id,
      row.name,
      row.description,
      row.status_id,
      row.priority,
      row.due_date,
      row.start_date,
      row.scheduled_start,
      row.duration_min,
      row.orderindex,
      row.created_at,
      row.updated_at,
      row.completed_at,
      row.archived_at,
      row.deleted_at,
    ]
  );
  await logOp("task", row.id, "create", null, row);
  return row;
}

const UPDATABLE = new Set([
  "name",
  "description",
  "status_id",
  "priority",
  "due_date",
  "start_date",
  "scheduled_start",
  "duration_min",
  "orderindex",
  "completed_at",
  "archived_at",
  "deleted_at",
  "list_id",
  "parent_id",
]);

export async function updateTask(id: string, patch: Partial<Task>): Promise<void> {
  const before = await getTask(id);
  if (!before) return;
  const keys = Object.keys(patch).filter((k) => UPDATABLE.has(k));
  if (keys.length === 0) return;
  const sets = keys.map((k, i) => `${k}=$${i + 1}`);
  sets.push(`updated_at=$${keys.length + 1}`);
  const values = keys.map((k) => (patch as Record<string, unknown>)[k]);
  values.push(now());
  values.push(id);
  await exec(`UPDATE task SET ${sets.join(", ")} WHERE id=$${values.length}`, values);
  const after = await getTask(id);
  await logOp("task", id, "update", before, after);
}

/** Every id in the subtree rooted at `id` (inclusive), still-live rows only.
 *  Uses UNION (not UNION ALL) so the recursion is cycle-safe: if parent_id ever
 *  forms a loop, dedup stops it from recursing forever. */
async function liveSubtree(id: string): Promise<Task[]> {
  return sel<Task>(
    `WITH RECURSIVE sub(id) AS (
       SELECT id FROM task WHERE id=$1
       UNION
       SELECT t.id FROM task t JOIN sub ON t.parent_id = sub.id
     )
     SELECT * FROM task WHERE id IN (SELECT id FROM sub) AND deleted_at IS NULL`,
    [id]
  );
}

/** Soft-delete a task and its entire subtree (recursively), journaling the
 *  full set so undo restores every descendant, not just the parent. */
export async function deleteTask(id: string): Promise<void> {
  const subtree = await liveSubtree(id);
  if (subtree.length === 0) return;
  const ts = now();
  const ids = subtree.map((t) => t.id);
  const ph = ids.map((_, i) => `$${i + 2}`).join(",");
  await exec(`UPDATE task SET deleted_at=$1, updated_at=$1 WHERE id IN (${ph})`, [ts, ...ids]);
  await logOp("task", id, "delete", subtree, null); // before = whole subtree snapshot
}

// ── undo / redo ────────────────────────────────────────────────────────
// upsert restores a task snapshot WITHOUT deleting the existing row. Using
// INSERT OR REPLACE here would delete-then-insert and fire ON DELETE CASCADE,
// silently destroying every subtask — the ON CONFLICT form never does that.
async function upsertTaskFromSnapshot(s: Task): Promise<void> {
  await exec(
    `INSERT INTO task (id,list_id,parent_id,name,description,status_id,priority,due_date,start_date,scheduled_start,duration_min,orderindex,created_at,updated_at,completed_at,archived_at,deleted_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     ON CONFLICT(id) DO UPDATE SET
       list_id=excluded.list_id, parent_id=excluded.parent_id, name=excluded.name,
       description=excluded.description, status_id=excluded.status_id, priority=excluded.priority,
       due_date=excluded.due_date, start_date=excluded.start_date, scheduled_start=excluded.scheduled_start,
       duration_min=excluded.duration_min, orderindex=excluded.orderindex, created_at=excluded.created_at,
       updated_at=excluded.updated_at, completed_at=excluded.completed_at, archived_at=excluded.archived_at,
       deleted_at=excluded.deleted_at`,
    [
      s.id,
      s.list_id,
      s.parent_id,
      s.name,
      s.description,
      s.status_id,
      s.priority,
      s.due_date,
      s.start_date,
      s.scheduled_start ?? null,
      s.duration_min ?? null,
      s.orderindex,
      s.created_at,
      s.updated_at,
      s.completed_at,
      s.archived_at,
      s.deleted_at,
    ]
  );
}

function snapshotList(json: string | null): Task[] {
  if (!json) return [];
  const parsed = JSON.parse(json) as Task | Task[];
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function softDeleteByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const ph = ids.map((_, i) => `$${i + 2}`).join(",");
  await exec(`UPDATE task SET deleted_at=$1, updated_at=$1 WHERE id IN (${ph})`, [now(), ...ids]);
}

/** Reverse an op (undo direction). */
async function reverseOp(op: OpRow): Promise<void> {
  if (op.entity === "task") {
    if (op.op === "create" && op.after) {
      const snap = JSON.parse(op.after) as Task;
      await exec(`DELETE FROM task WHERE id=$1`, [snap.id]); // it was brand new
    } else if (op.before) {
      for (const r of snapshotList(op.before)) await upsertTaskFromSnapshot(r); // update/delete -> restore
    }
  } else if (op.entity === "list") {
    if (op.op === "create" && op.after) {
      const l = JSON.parse(op.after) as List;
      await exec(`UPDATE list SET deleted_at=$1 WHERE id=$2`, [now(), l.id]); // hide the just-created list
    }
  }
}

/** Re-apply an op (redo direction). */
async function applyOp(op: OpRow): Promise<void> {
  if (op.entity === "task") {
    if (op.op === "delete") {
      await softDeleteByIds(snapshotList(op.before).map((r) => r.id));
    } else if (op.after) {
      await upsertTaskFromSnapshot(JSON.parse(op.after) as Task); // create/update -> apply "after"
    }
  } else if (op.entity === "list") {
    if (op.op === "create" && op.after) {
      const l = JSON.parse(op.after) as List;
      await exec(`UPDATE list SET deleted_at=NULL WHERE id=$1`, [l.id]);
    }
  }
}

/** Reverse the most recent not-yet-undone op; mark it undone (append-only). */
export async function undoLast(): Promise<boolean> {
  const rows = await sel<OpRow>(
    `SELECT id, entity, entity_id, op, before, after, at FROM op_log
       WHERE undone = 0 ORDER BY at DESC, rowid DESC LIMIT 1`
  );
  const last = rows[0];
  if (!last) return false;
  await reverseOp(last);
  await exec(`UPDATE op_log SET undone = 1 WHERE id = $1`, [last.id]);
  redoStack.push(last); // remember order so redo can replay it
  return true;
}

/** Replay the most recently undone op. Returns false if the redo stack is empty. */
export async function redoLast(): Promise<boolean> {
  const op = redoStack.pop();
  if (!op) return false;
  await applyOp(op);
  await exec(`UPDATE op_log SET undone = 0 WHERE id = $1`, [op.id]);
  return true;
}

// ── seed ──────────────────────────────────────────────────────────────
export async function seedIfEmpty(): Promise<void> {
  const existing = await sel<{ n: number }>(`SELECT COUNT(*) as n FROM list`);
  if ((existing[0]?.n ?? 0) > 0) return;

  const inbox = await createList("Inbox", true);
  const gs = await createList("Getting Started", false);
  const st = await getStatuses(gs.id);
  const todo = st.find((s) => s.grp === "not_started")!;
  const doing = st.find((s) => s.grp === "active")!;
  const done = st.find((s) => s.grp === "done")!;
  const today = Date.now();

  const welcome = await createTask({
    list_id: gs.id,
    name: "Welcome — this is YOUR task app 👋",
    status_id: todo.id,
    priority: 3,
  });
  await createTask({
    list_id: gs.id,
    name: "Rename it, restyle it, own the SQLite file",
    status_id: todo.id,
    priority: 4,
    parent_id: welcome.id,
  });
  await createTask({ list_id: gs.id, name: "Press  ⌘K  for the command palette", status_id: doing.id, priority: 2 });
  await createTask({
    list_id: gs.id,
    name: "Press  ⌘⇧K  to quick-capture a task",
    status_id: todo.id,
    priority: 1,
    due_date: today,
  });
  await createTask({
    list_id: gs.id,
    name: "Open the Today view (left sidebar)",
    status_id: todo.id,
    priority: 3,
    due_date: today,
  });
  await createTask({
    list_id: gs.id,
    name: "Toggle List / Board with the header buttons",
    status_id: doing.id,
    priority: 3,
  });
  const finished = await createTask({
    list_id: gs.id,
    name: "Check something off — watch it move to Done",
    status_id: done.id,
    priority: 3,
  });
  await updateTask(finished.id, { completed_at: today });

  await createTask({
    list_id: inbox.id,
    name: "Anything you capture with ⌘⇧K lands here",
    status_id: null,
    priority: 0,
  });
}
