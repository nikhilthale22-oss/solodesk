# Pending

What's still open. Completed work moves to CHANGELOG.

## Next up
- [ ] **Table view** (spreadsheet) over the same resolver
- [ ] **Custom fields** (text / number / select / date / checkbox)
- [ ] Tags + a filter tree + saved views

## Calendar polish
- [ ] Drag-to-select a range to size a block on creation (vs. fixed 60-min default)
- [ ] Month view
- [ ] All-day row; snap-to-time-estimate

## Later
- [ ] Rich-text task descriptions & Docs (BlockNote)
- [ ] Recurring tasks; notifications
- [ ] Automations runner (no quota); time tracking; dashboard cards; a first-class **Weekly-Review** ritual
- [ ] **Backup / sync** the `.db` — local-only today; auto-backup offered, not yet opted in
- [ ] OS-global quick-capture hotkey (drop-in path already stubbed in `src-tauri/src/lib.rs`)

## Hardening (known limitations)
- [ ] **Atomic write + journal.** A mutation and its `op_log` row are two statements, not one transaction — a crash between them could desync. True atomicity needs a Rust `#[command]` (the JS SQL plugin can't guarantee same-connection transactions). Low risk for a local single-user app; documented, not yet done.
- [ ] **Restrictive CSP.** `tauri.conf.json` runs with `csp: null`. Fine while the app only renders its own local data; tighten before it ever loads remote content.
