-- Phase 1 — time-blocking / calendar scheduling.
-- A task's DUE date stays a deadline. Scheduling is separate: `scheduled_start`
-- is a datetime (epoch ms, with time-of-day) and `duration_min` its block length.
-- A task can be "due Fri" but "worked Wed 09:00–10:30" (Motion/Sunsama model).

ALTER TABLE task ADD COLUMN scheduled_start INTEGER;
ALTER TABLE task ADD COLUMN duration_min INTEGER;

CREATE INDEX IF NOT EXISTS idx_task_sched ON task(scheduled_start);
