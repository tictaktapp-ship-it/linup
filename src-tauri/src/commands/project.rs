use rusqlite::{params, Connection};

const DB_PATH: &str = "E:\\linup-io\\linup.db";

fn open_db() -> Result<Connection, String> {
    Connection::open(DB_PATH).map_err(|e| format!("DB error: {e}"))
}

#[tauri::command]
pub fn create_project(
    name: String,
    description: String,
    folder_path: String,
    stack: String,
    budget_cap: f64,
) -> Result<String, String> {
    let db = open_db()?;
    let id = format!("{}", uuid::Uuid::new_v4());
    let created_at = chrono::Utc::now().to_rfc3339();
    db.execute(
        "INSERT INTO projects (id, name, description, folder_path, stack, budget_cap, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?7)",
        params![id, name, description, folder_path, stack, budget_cap, created_at],
    ).map_err(|e| format!("Failed to create project: {e}"))?;
    Ok(id)
}
