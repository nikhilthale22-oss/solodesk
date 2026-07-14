# Context / glossary

Domain language for this codebase. Definitions live here; decisions live in the README + code comments.

- **Task** — the universal object. Subtasks (self-referential `parent_id`), board cards, and calendar blocks are all rows in the one `task` table. Almost every feature is a projection over tasks.
- **Resolver** (`src/lib/resolver.ts`) — the load-bearing function. Every view is the same task set passed through **filter → sort → group**. Adding a view is a rendering concern, never a data one.
- **View** — a render config over the resolver: List, Board, Today, Calendar. Not separate record types.
- **Status group** — the four ClickUp buckets a custom status belongs to: `not_started` / `active` / `done` / `closed`. Drives completion and filtering.
- **`due_date` vs `scheduled_start`** — `due_date` is the **deadline**. `scheduled_start` (+ `duration_min`) is the **work block** — when you'll actually do it, placed on the Calendar. Separate on purpose (Motion/Sunsama model); re-blocking never touches the deadline.
- **op_log** — append-only journal of every task/list action (before/after JSON). Undo/redo flip an `undone` flag rather than deleting rows, so the log stays a complete, ordered history — the seam for future last-write-wins sync. Undo is durable; the redo *ordering* is in-memory (not persisted across restarts).
- **Unscheduled tray** — the Calendar's left panel: incomplete, unscheduled, top-level tasks waiting to be dragged onto the grid.
- **Inbox** — the single quick-capture target list (`is_inbox = 1`).
