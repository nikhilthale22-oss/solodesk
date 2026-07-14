# Contributing to solodesk

Thanks for looking. solodesk is a local-first, single-user task app — small, hackable, and meant to be forked. Small, focused PRs are welcome.

## Setup

- Node 18+ and Rust (via [rustup](https://rustup.rs)). See the README's "Run it" section for the one-time prerequisites.
- `npm install`
- `npm run tauri dev` to launch the app.

## Before you open a PR

Run the same gate CI runs:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

If you touched the Rust side: `cd src-tauri && cargo check`.

## Conventions

- **The data layer lives behind the `SqlDriver` seam** in [`src/db/client.ts`](src/db/client.ts). New persistence logic should be unit-tested against the in-memory SQLite harness ([`src/db/testing.ts`](src/db/testing.ts)) — that harness runs the real migrations with `foreign_keys` ON, so it catches real SQLite behavior.
- **Every task/list mutation must journal an `op_log` entry** so undo keeps working, and the log stays **append-only** (undo/redo flip the `undone` flag; never `DELETE` from `op_log`).
- **Views are config over the one resolver** ([`src/lib/resolver.ts`](src/lib/resolver.ts)) — adding a view is a render concern, not a new record type.
- Prefer pure functions in `src/lib/` (they're the easiest to test).

## Scope

Phase 0 is a foundation, not a finished product. See [`PENDING.md`](PENDING.md) for the roadmap and known limitations.
