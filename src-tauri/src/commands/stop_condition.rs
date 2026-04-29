use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::Emitter;
use uuid::Uuid;

const DB_PATH: &str = "E:\\linup-io\\linup.db";

fn open_db() -> Result<Connection, String> {
    Connection::open(DB_PATH).map_err(|e| format!("DB error: {e}"))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StopReason {
    pub reason: String,
    pub triggered_at: String,
}

#[tauri::command]
pub fn check_stop_conditions(
    project_id: String,
    stage_index: i64,
) -> Result<Option<StopReason>, String> {
    let conn = open_db()?;

    // Check: >3 consecutive gate failures
    let consecutive: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM stop_events WHERE project_id=?1 AND stage_index=?2 AND resolved_at IS NULL",
            params![&project_id, stage_index],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if consecutive > 3 {
        return Ok(Some(StopReason {
            reason: "More than 3 consecutive gate failures".to_string(),
            triggered_at: chrono::Local::now().to_rfc3339(),
        }));
    }

    Ok(None)
}

#[tauri::command]
pub fn record_stop_event(
    app: tauri::AppHandle,
    project_id: String,
    stage_index: i64,
    reason: String,
) -> Result<String, String> {
    let conn = open_db()?;
    let id = format!("{}", Uuid::new_v4());
    let triggered_at = chrono::Local::now().to_rfc3339();

    conn.execute(
        "INSERT INTO stop_events (id, project_id, stage_index, reason, triggered_at) VALUES (?1,?2,?3,?4,?5)",
        params![&id, &project_id, stage_index, &reason, &triggered_at],
    )
    .map_err(|e| format!("Insert failed: {e}"))?;

    app.emit("stage:stopped", &project_id).ok();
    Ok(id)
}

#[tauri::command]
pub fn resolve_stop_event(
    project_id: String,
    stop_event_id: String,
    resolution: String,
) -> Result<(), String> {
    let conn = open_db()?;
    let resolved_at = chrono::Local::now().to_rfc3339();

    conn.execute(
        "UPDATE stop_events SET resolved_at=?1, resolution=?2 WHERE id=?3 AND project_id=?4",
        params![&resolved_at, &resolution, &stop_event_id, &project_id],
    )
    .map_err(|e| format!("Update failed: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn export_patch(project_id: String, stage_index: i64) -> Result<String, String> {
    // Stub: returns path to patch artifact
    Ok(format!("E:\\linup-io\\.linup\\patches\\{}\\stage_{}.patch", project_id, stage_index))
}

#[tauri::command]
pub fn rollback_to_snapshot(project_id: String, stage_index: i64) -> Result<(), String> {
    // Stub: rollback implementation via git reset or snapshot restore
    let _ = (project_id, stage_index);
    Ok(())
}