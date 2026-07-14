-- ClickUp-local — Phase 0 walking skeleton.
-- A focused subset of a much larger ClickUp-inspired target model.
-- Design carried over from that study:
--   • one universal `task` table (subtasks are tasks with parent_id)
--   • custom statuses per list, grouped into the 4 ClickUp status groups
--   • soft-delete (deleted_at) + archive (archived_at), never hard-delete in-app
--   • append-only op_log for undo (and future sync)
-- IDs are TEXT (we use crypto.randomUUID() from the frontend; swap for ULID later).

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS list (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#6b57f2',
  is_inbox    INTEGER NOT NULL DEFAULT 0,   -- the single quick-capture target
  orderindex  REAL NOT NULL DEFAULT 0,      -- fractional index for manual ordering
  created_at  INTEGER NOT NULL,
  archived_at INTEGER,
  deleted_at  INTEGER
);

CREATE TABLE IF NOT EXISTS status (
  id          TEXT PRIMARY KEY,
  list_id     TEXT NOT NULL REFERENCES list(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL,
  grp         TEXT NOT NULL CHECK (grp IN ('not_started','active','done','closed')),
  orderindex  REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_status_list ON status(list_id);

CREATE TABLE IF NOT EXISTS task (
  id           TEXT PRIMARY KEY,
  list_id      TEXT NOT NULL REFERENCES list(id) ON DELETE CASCADE,
  parent_id    TEXT REFERENCES task(id) ON DELETE CASCADE,   -- NULL = top-level task
  name         TEXT NOT NULL,
  description  TEXT,
  status_id    TEXT REFERENCES status(id),
  priority     INTEGER NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 4), -- 0 none,1 urgent,2 high,3 normal,4 low
  due_date     INTEGER,
  start_date   INTEGER,
  orderindex   REAL NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  completed_at INTEGER,
  archived_at  INTEGER,
  deleted_at   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_task_list   ON task(list_id);
CREATE INDEX IF NOT EXISTS idx_task_parent ON task(parent_id);
CREATE INDEX IF NOT EXISTS idx_task_status ON task(status_id);
CREATE INDEX IF NOT EXISTS idx_task_due    ON task(due_date);

-- Append-only journal of every mutation. Powers undo now; a clean seam for
-- last-write-wins sync to your own server later.
CREATE TABLE IF NOT EXISTS op_log (
  id        TEXT PRIMARY KEY,
  entity    TEXT NOT NULL,                 -- 'task' | 'list' | 'status'
  entity_id TEXT NOT NULL,
  op        TEXT NOT NULL CHECK (op IN ('create','update','delete')),
  before    TEXT,                          -- JSON snapshot (NULL on create)
  after     TEXT,                          -- JSON snapshot (NULL on delete)
  at        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_oplog_at ON op_log(at);
