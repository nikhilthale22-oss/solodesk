use tauri_plugin_sql::{Migration, MigrationKind};

// IMPORTANT: this db url MUST match the one the frontend loads
// (see src/db/client.ts -> DB_URL). The plugin runs registered
// migrations when that database is first loaded.
pub const DB_URL: &str = "sqlite:clickup-local.db";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "phase0_init",
            sql: include_str!("../migrations/001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "scheduling",
            sql: include_str!("../migrations/002_scheduling.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "oplog_append_only",
            sql: include_str!("../migrations/003_oplog_append_only.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, migrations)
                .build(),
        )
        // ── OS-GLOBAL quick-capture hotkey (optional Phase-0.1 upgrade) ──
        // The in-app ⌘⇧K capture works without this. To make the hotkey fire
        // even when the app is NOT focused, add these deps to Cargo.toml:
        //   tauri-plugin-global-shortcut = "2"
        // then uncomment the block below and add "global-shortcut:allow-register"
        // to capabilities/default.json. Kept out of the default build so the
        // scaffold compiles cleanly across plugin versions.
        //
        // .plugin(
        //     tauri_plugin_global_shortcut::Builder::new()
        //         .with_handler(|app, _shortcut, event| {
        //             use tauri::Emitter;
        //             use tauri_plugin_global_shortcut::ShortcutState;
        //             if event.state() == ShortcutState::Pressed {
        //                 let _ = app.emit("quick-capture", ());
        //             }
        //         })
        //         .build(),
        // )
        // .setup(|app| {
        //     use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
        //     let qc = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyK);
        //     let _ = app.global_shortcut().register(qc);
        //     Ok(())
        // })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
