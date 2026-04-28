mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations("sqlite:linup.db", vec![
                    tauri_plugin_sql::Migration {
                        version: 1,
                        description: "create_core_tables",
                        sql: include_str!("../migrations/001_core_tables.sql"),
                        kind: tauri_plugin_sql::MigrationKind::Up,
                    }
                ])
                .build()
        )
        .invoke_handler(tauri::generate_handler![
            commands::secrets::set_secret,
            commands::secrets::get_secret_masked,
            commands::secrets::delete_secret,
            commands::secrets::test_secret,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
