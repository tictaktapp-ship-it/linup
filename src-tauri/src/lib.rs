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
                    },
                    tauri_plugin_sql::Migration {
                        version: 3,
                        description: "create_artifacts",
                        sql: include_str!("../migrations/003_artifacts.sql"),
                        kind: tauri_plugin_sql::MigrationKind::Up,
                    },
                    tauri_plugin_sql::Migration {
                        version: 2,
                        description: "budget_columns",
                        sql: include_str!("../migrations/002_budget_columns.sql"),
                        kind: tauri_plugin_sql::MigrationKind::Up,
                    },
                    tauri_plugin_sql::Migration {
                        version: 4,
                        description: "create_stop_events",
                        sql: include_str!("../migrations/004_stop_events.sql"),
                        kind: tauri_plugin_sql::MigrationKind::Up,
                    },
                ])
                .build()
        )
        .invoke_handler(tauri::generate_handler![
            commands::system::get_connectivity_status,
            commands::stop_condition::rollback_to_snapshot,
            commands::stop_condition::export_patch,
            commands::stop_condition::resolve_stop_event,
            commands::stop_condition::record_stop_event,
            commands::stop_condition::check_stop_conditions,
            commands::budget::raise_cap,
            commands::budget::check_budget,
            commands::artifacts::assemble_evidence_pack,
            commands::artifacts::verify_artifact,
            commands::artifacts::read_artifact,
            commands::artifacts::get_artifacts,
            commands::artifacts::write_artifact,
            commands::stage::set_stage_status,
            commands::stage::set_stage_approved,
            commands::stage::get_stage_model,
            commands::secrets::set_secret,
            commands::secrets::get_secret_masked,
            commands::secrets::delete_secret,
            commands::secrets::test_secret,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
