use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

const DB_PATH: &str = "E:\\linup-io\\linup.db";

fn open_db() -> Result<Connection, String> {
    Connection::open(DB_PATH).map_err(|e| format!("DB error: {e}"))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateHistory {
    pub id: String,
    pub version: String,
    pub channel: String,
    pub applied_at: String,
    pub status: String,
}

#[tauri::command]
pub fn check_for_update() -> Result<String, String> {
    Ok("no_update".into())
}

#[tauri::command]
pub fn get_current_version() -> Result<String, String> {
    Ok(env!("CARGO_PKG_VERSION").into())
}

#[tauri::command]
pub fn get_update_channel() -> Result<String, String> {
    let db = open_db()?;
    let channel: String = db.query_row(
        "SELECT value FROM update_history WHERE id = 'channel' LIMIT 1",
        [],
        |row| row.get(0),
    ).unwrap_or_else(|_| "stable".into());
    Ok(channel)
}

#[tauri::command]
pub fn set_update_channel(channel: String) -> Result<(), String> {
    let db = open_db()?;
    let applied_at = chrono::Utc::now().to_rfc3339();
    db.execute(
        "INSERT INTO update_history (id, version, channel, applied_at, status) VALUES ('channel', 'system', ?1, ?2, 'active') ON CONFLICT(id) DO UPDATE SET channel=?1, applied_at=?2",
        params![channel, applied_at],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_update_history() -> Result<Vec<UpdateHistory>, String> {
    let db = open_db()?;
    let mut stmt = db.prepare(
        "SELECT id, version, channel, applied_at, status FROM update_history ORDER BY applied_at DESC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(UpdateHistory {
            id: row.get(0)?,
            version: row.get(1)?,
            channel: row.get(2)?,
            applied_at: row.get(3)?,
            status: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?;
    rows.map(|r| r.map_err(|e| e.to_string())).collect()
}
