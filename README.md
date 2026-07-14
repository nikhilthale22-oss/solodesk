# solodesk

A **local-first, single-user** task app inspired by ClickUp, built from a careful study of its data model. One SQLite file you own. No cloud, no seats, no plan walls.

> **Status (2026-07-13): runs on macOS.** Phase 0 (Lists · Tasks · List/Board/Today · ⌘K · quick-capture · undo/redo) **plus a Calendar with Day/Week time-blocking** are built and verified. The real spine — universal task table + a one-resolver views engine + op-log undo/redo — not a toy. It's yours: **rename it, restyle it, extend it.** See `CHANGELOG.md` for what shipped, `PENDING.md` for what's next.

---

## Run it

**Prerequisites** (one-time):
- **Node** 18+ (`node -v`)
- **Rust** via [rustup](https://rustup.rs) (`rustc --version`)
- **macOS**: Xcode Command Line Tools (`xcode-select --install`) — Tauri uses the system WebView, nothing to install there.

```bash
cd solodesk
npm install
npm run tauri dev      # first Rust build takes a few minutes; instant after that
```

The app window opens, seeds a demo workspace on first launch, and you're productive.

> **Plain `npm run dev` (browser) won't work** — the app talks to SQLite through the Tauri (Rust) side, which only exists inside the desktop window. Always use `npm run tauri dev`. If you see the "Couldn't open the database" screen, that's why.

### Where your data lives
A single SQLite file named `clickup-local.db` in the OS app-data dir:
- macOS: `~/Library/Application Support/dev.clicklocal.app/`

Back it up, copy it, inspect it with any SQLite tool — it's just a file.

### Building a real `.app`
`npm run tauri build` needs app icons. Generate them once from any square PNG:
```bash
npx tauri icon path/to/icon.png     # writes src-tauri/icons/*
npm run tauri build
```

---

## Keyboard

| Key | Action |
|---|---|
| `⌘K` / `Ctrl-K` | Command palette (navigate, switch view, group-by, new list, undo, theme) |
| `⌘⇧K` | Quick-capture a task → Inbox |
| `⌘Z` | Undo last change (powered by the op-log) |
| double-click a task | Rename inline |
| drag a card (Board) | Move it between statuses |

**Quick-capture shorthand:** type `Ship the deck tomorrow !1` →
- `today` · `tmr`/`tomorrow` · a weekday (`fri`) → sets the due date
- `!1`–`!4` → sets priority (1 Urgent … 4 Low)

---

## What's in Phase 0 (built)

- **Hierarchy:** Lists → Tasks → Subtasks (self-referential, nests) + an Inbox.
- **Custom statuses** per list, in the 4 ClickUp status groups (Not Started / Active / Done / Closed), with a status-change history in `op_log`.
- **Views over one resolver:** List (grouped, per-group inline add) + Board (drag between columns). Group by Status / Priority / None. Same `resolve()` feeds both — [`src/lib/resolver.ts`](src/lib/resolver.ts) is the load-bearing file.
- **Today** view — overdue + due-today across every list.
- **Calendar with time-blocking (Day / Week)** — an hour grid you drag tasks onto to reserve work blocks. Drag from the **Unscheduled** tray onto a slot to schedule, drag a block to move it, drag its bottom edge to resize, click an empty slot to create, `×` to send it back. A live **now-line**, overlapping blocks pack side-by-side. Key idea: a task's **due date is its deadline**; the **block is when you'll actually do it** (Motion/Sunsama model — `scheduled_start` + `duration_min`, separate from `due_date`).
- **Quick-capture** with natural-language dates/priority.
- **Command palette** (`⌘K`), keyboard-first.
- **Undo** via an append-only op-log.
- **Search**, priorities, due dates, light/dark.

## Architecture

```
React + TypeScript (Vite)            ← UI
  src/state/store.ts   zustand       ← one store, all actions
  src/lib/resolver.ts                ← filter → sort → group  (every view is this)
  src/db/client.ts                   ← SQL + op_log on every mutation
        │  @tauri-apps/plugin-sql
Tauri 2 (Rust)  src-tauri/           ← window + SQLite + migrations
        │
clickup-local.db  (SQLite)           ← the file you own
```

The three load-bearing decisions: **one universal `task` table** (subtasks/cards/calendar items are all rows), **views are config over that table** (not new record types), and **every task & list edit is journaled** to an append-only op-log (undo now, sync later).

---

## Roadmap

- **Phase 1 — richness:** ~~Calendar (Day/Week time-blocking)~~ ✓ **done** · next: Table view, custom fields (text/number/select/date/checkbox), tags, a filter tree + saved views, rich-text task descriptions & Docs (BlockNote), recurring tasks, notifications. (Natural next calendar steps: drag-to-select a range to size a block on creation, all-day row, snap-to-estimate, month view.)
- **Phase 2 — leverage:** an automations runner (no monthly quota — it's yours), optional time tracking, 2–3 compute-on-read dashboard cards, a first-class **Weekly Review** ritual, an optional local-LLM "Brain" hook.
- **Stretch:** formula/rollup fields, Gantt with dependencies, Tasks-in-Multiple-Lists, whiteboard embed, mobile, and **sync to your own server** (last-write-wins → Yjs) using the op-log seam.

solodesk implements a focused, working subset of a much larger target model.

---

## Enable the OS-global quick-capture hotkey (optional)

The in-app `⌘⇧K` works out of the box. To make it fire even when the app **isn't focused**:
1. Add to `src-tauri/Cargo.toml` deps: `tauri-plugin-global-shortcut = "2"`
2. Uncomment the marked block in [`src-tauri/src/lib.rs`](src-tauri/src/lib.rs).
3. Add `"global-shortcut:allow-register"` to `src-tauri/capabilities/default.json`.
The frontend already listens for the `quick-capture` event ([`src/components/App.tsx`](src/components/App.tsx)).

## Develop

```bash
npm install
npm test           # vitest — 27 unit tests
npm run typecheck  # tsc, no emit
npm run lint       # eslint (flat config)
npm run build      # tsc && vite build
```

The persistence layer talks to a small `SqlDriver` seam ([`src/db/client.ts`](src/db/client.ts)), so the op-log **undo/redo logic is tested against a real in-memory SQLite** (`better-sqlite3`) with the actual migrations applied — including a regression test proving that undoing an edit never cascade-deletes subtasks. Pure view logic (the resolver, calendar packing, the quick-capture parser, date math) is unit-tested directly. CI runs typecheck + lint + tests + build + `cargo check` on every push ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)). See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Notes / gotchas

- The parent folder path contains a space (`Claude Code`). If the Rust build ever complains, move the project to a space-free path.
- First `npm run tauri dev` compiles Rust — slow once, fast after.
- Renaming the app: change `productName`/`identifier` in `src-tauri/tauri.conf.json`, `name` in `package.json`, and the folder. (Changing `identifier` starts a fresh empty DB in a new app-data dir.)
