# Changelog

## 2026-07-14
- **Open-sourced as `solodesk`** under the MIT license. Renamed from the `clickup-local` placeholder across the product name, window title, package, and Rust crate; the SQLite app-identifier and filename are intentionally unchanged so existing installs keep their data.
- **Fixed a critical data-loss bug in undo/redo.** Restoring a task snapshot used `INSERT OR REPLACE`, which deletes-then-inserts and fired `ON DELETE CASCADE` — silently destroying every subtask of an edited or deleted parent. Now an `ON CONFLICT(id) DO UPDATE` upsert that never removes the row. Covered by a regression test. (`src/db/client.ts`)
- **Subtree delete/undo is now faithful and recursive.** `deleteTask` snapshots the entire descendant subtree (recursive CTE) and soft-deletes all of it; undo restores every level, redo re-deletes it. (`src/db/client.ts`)
- **`op_log` is genuinely append-only.** Undo/redo flip an `undone` flag instead of DELETEing history; ordering uses `at DESC, rowid DESC` for a deterministic tiebreak. New migration `003_oplog_append_only.sql`. (`src/db/client.ts`, `src-tauri/migrations/003_oplog_append_only.sql`)
- **Creating a list is now undoable** — previously a silent no-op that also desynced the undo stack. (`src/db/client.ts`)
- **Green production build.** Fixed two `Scope` type-narrowing errors that broke `tsc && vite build`. (`src/components/App.tsx`, `src/state/store.ts`)
- **Tests + tooling.** Added Vitest (27 tests: op-log round-trips against real SQLite via better-sqlite3, plus resolver / calendar-packing / quick-capture / date units), an injectable `SqlDriver` seam for testability, ESLint + Prettier, and a GitHub Actions CI running typecheck + lint + tests + build + `cargo check`.

## 2026-07-13
- **Calendar view — Day/Week time-blocking.** v2 migration adds `scheduled_start` + `duration_min`, kept **separate from `due_date`** (deadline vs. when-you'll-do-it, Motion/Sunsama model). Drag from the Unscheduled tray onto the hour grid, drag-move, pointer-resize (30-min snap), live now-line, side-by-side overlap packing, click-a-slot-to-create. (`src/components/CalendarView.tsx`, `src-tauri/migrations/002_scheduling.sql`)
- **Fixed calendar drag-drop.** Added `"dragDropEnabled": false` to the window config — Tauri's default OS file-drop handler was intercepting HTML5 drops inside the webview. (`src-tauri/tauri.conf.json`)
- **Real undo/redo.** Added an in-memory redo stack (`src/db/client.ts`); `⌘Z` undo, `⌘Y` + `⌘⇧Z` redo, plus toolbar buttons. A new edit clears the redo trail (standard).
- **Ran + verified end-to-end on macOS** (installed Rust 1.97): compiled, launched, and confirmed migrations + seed + CRUD + op_log by querying the SQLite file.

## 2026-07-12
- **Phase 0 walking skeleton.** Tauri 2 + React/TS + Vite + SQLite (`@tauri-apps/plugin-sql`), zustand store.
- One universal `task` table + a single `resolve(view)` config resolver (`src/lib/resolver.ts`) feeding **List / Board / Today**.
- Custom statuses in the 4 ClickUp status groups; append-only `op_log` for undo.
- `⌘K` command palette, `⌘⇧K` quick-capture (natural-language date/priority), inline edit, board drag-between-columns, search, light/dark.
- Grounded in a reverse-engineering study of ClickUp's data model.
