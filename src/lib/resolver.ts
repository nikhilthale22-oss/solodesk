// ── The load-bearing idea from the dossier ─────────────────────────────
// Every view (List, Board, and later Calendar/Table/…) is the SAME set of
// tasks passed through ONE resolver: filter → sort → group. Get this right
// once and adding a new view is a rendering concern, never a data concern.

import { Task, Status, Filter, ViewConfig, Group, Priority, PRIORITIES, STATUS_GROUPS, StatusGroup } from "./types";

function statusOf(task: Task, statuses: Status[]): Status | undefined {
  return statuses.find((s) => s.id === task.status_id);
}

function passesFilter(task: Task, f: Filter, statuses: Status[]): boolean {
  switch (f.field) {
    case "search": {
      const q = String(f.value ?? "")
        .toLowerCase()
        .trim();
      if (!q) return true;
      return task.name.toLowerCase().includes(q) || (task.description ?? "").toLowerCase().includes(q);
    }
    case "priority":
      return Array.isArray(f.value) ? (f.value as number[]).includes(task.priority) : task.priority === f.value;
    case "statusGroup": {
      const grp = statusOf(task, statuses)?.grp;
      return Array.isArray(f.value) ? (f.value as string[]).includes(grp ?? "") : grp === f.value;
    }
    case "due": {
      if (task.due_date == null) return false;
      const v = Number(f.value);
      if (f.op === "before") return task.due_date < v;
      return task.due_date <= v; // onOrBefore
    }
    default:
      return true;
  }
}

function isDone(task: Task, statuses: Status[]): boolean {
  const g = statusOf(task, statuses)?.grp;
  return g === "done" || g === "closed" || task.completed_at != null;
}

export interface ResolveInput {
  tasks: Task[]; // already scoped to the list(s) in view; may include subtasks
  statuses: Status[];
  config: ViewConfig;
}

export function resolve({ tasks, statuses, config }: ResolveInput): Group[] {
  // 1) top-level only (subtasks render nested under their parent)
  let rows = tasks.filter((t) => t.parent_id == null && t.deleted_at == null && t.archived_at == null);

  // 2) filter
  if (!config.showCompleted) rows = rows.filter((t) => !isDone(t, statuses));
  for (const f of config.filters) rows = rows.filter((t) => passesFilter(t, f, statuses));

  // 3) sort
  const dir = config.sort.dir === "asc" ? 1 : -1;
  const key = config.sort.field;
  rows = [...rows].sort((a, b) => {
    let av: number, bv: number;
    if (key === "priority") {
      // urgent(1) is "highest"; none(0) sinks to the bottom
      const rank = (p: Priority) => (p === 0 ? 99 : p);
      av = rank(a.priority);
      bv = rank(b.priority);
    } else {
      av = Number((a as any)[key] ?? Number.MAX_SAFE_INTEGER);
      bv = Number((b as any)[key] ?? Number.MAX_SAFE_INTEGER);
    }
    return (av - bv) * dir;
  });

  // 4) group
  return groupRows(rows, statuses, config);
}

function groupRows(rows: Task[], statuses: Status[], config: ViewConfig): Group[] {
  if (config.groupBy === "none") {
    return [{ key: "all", label: "All tasks", color: "var(--muted)", tasks: rows }];
  }

  if (config.groupBy === "priority") {
    const order: Priority[] = [1, 2, 3, 4, 0];
    return order
      .map((p) => ({
        key: `p${p}`,
        label: PRIORITIES[p].label,
        color: PRIORITIES[p].color,
        tasks: rows.filter((t) => t.priority === p),
      }))
      .filter((g) => g.tasks.length > 0 || g.key !== "p0");
  }

  // groupBy === "status": one column per status, ordered by group then orderindex
  const ordered = [...statuses].sort((a, b) => {
    const ga = STATUS_GROUPS[a.grp].order;
    const gb = STATUS_GROUPS[b.grp].order;
    return ga !== gb ? ga - gb : a.orderindex - b.orderindex;
  });
  const groups: Group[] = ordered.map((s) => ({
    key: s.id,
    label: s.name,
    color: s.color,
    statusId: s.id,
    tasks: rows.filter((t) => t.status_id === s.id),
  }));

  // catch tasks with no/unknown status
  const known = new Set(statuses.map((s) => s.id));
  const orphans = rows.filter((t) => !t.status_id || !known.has(t.status_id));
  if (orphans.length) {
    groups.unshift({ key: "none", label: "No status", color: "var(--muted)", tasks: orphans });
  }
  return groups;
}

// Convenience: children of a task, ordered — for nested subtask rendering.
export function childrenOf(parentId: string, all: Task[]): Task[] {
  return all
    .filter((t) => t.parent_id === parentId && t.deleted_at == null && t.archived_at == null)
    .sort((a, b) => a.orderindex - b.orderindex);
}

// Which status group counts as "done" — used by the checkbox / progress.
export function doneGroup(grp: StatusGroup | undefined): boolean {
  return grp === "done" || grp === "closed";
}
