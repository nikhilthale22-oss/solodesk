-- Phase 0.2 — make op_log genuinely append-only.
-- Undo/redo now flip this `undone` flag instead of DELETEing rows, so the log
-- stays a complete, ordered journal of every action (the clean seam for a
-- future last-write-wins sync). Existing rows default to 0 (not undone).

ALTER TABLE op_log ADD COLUMN undone INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_oplog_undone ON op_log(undone);
