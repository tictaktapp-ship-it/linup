use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

const DB_PATH: &str = "E:\\linup-io\\linup.db";

const ALLOWED_STATUSES: &[&str] = &[
    "locked", "ready", "running", "awaiting_approval",
    "gate_failed", "budget_exceeded", "stopped", "complete",
];

#[derive(Debug, Serialize, Deserialize)]
pub struct StageRun {
    pub stage_index: i64,
    pub status: String,
    pub started_at: Option<String>,
    pub locked_at: Option<String>,
    pub cost_usd: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StageModel {
    pub project_id: String,
    pub stages: Vec<StageRun>,
}

fn open_db() -> Result<Connection, String> {
    Connection::open(DB_PATH).map_err(|e| format!("DB error: {e}"))
}

#[tauri::command]
pub fn get_stage_model(project_id: String) -> Result<StageModel, String> {
    let conn = open_db()?;

    let mut stmt = conn.prepare(
        "SELECT stage_index, status, started_at, locked_at, cost_usd \
         FROM stage_runs WHERE project_id = ?1 ORDER BY stage_index"
    ).map_err(|e| format!("Prepare failed: {e}"))?;

    let stages: Vec<StageRun> = stmt.query_map(params![&project_id], |row| {
        Ok(StageRun {
            stage_index: row.get(0)?,
            status: row.get(1)?,
            started_at: row.get(2)?,
            locked_at: row.get(3)?,
            cost_usd: row.get(4)?,
        })
    })
    .map_err(|e| format!("Query failed: {e}"))?
    .filter_map(|r| r.ok())
    .collect();

    // Create 11 default rows if none exist
    if stages.is_empty() {
        for i in 0i64..11 {
            conn.execute(
                "INSERT OR IGNORE INTO stage_runs \
                 (id, project_id, stage_index, status, cost_usd) \
                 VALUES (lower(hex(randomblob(16))), ?1, ?2, 'locked', 0.0)",
                params![&project_id, i],
            ).map_err(|e| format!("Insert failed: {e}"))?;
        }

        let stages_created: Vec<StageRun> = (0..11).map(|i| StageRun {
            stage_index: i,
            status: "locked".to_string(),
            started_at: None,
            locked_at: None,
            cost_usd: 0.0,
        }).collect();

        return Ok(StageModel { project_id, stages: stages_created });
    }

    Ok(StageModel { project_id, stages })
}

#[tauri::command]
pub fn set_stage_approved(project_id: String, stage_index: i64) -> Result<(), String> {
    let conn = open_db()?;

    let current: Option<String> = conn.query_row(
        "SELECT status FROM stage_runs WHERE project_id = ?1 AND stage_index = ?2",
        params![&project_id, stage_index],
        |row| row.get(0),
    ).ok();

    match current.as_deref() {
        Some("awaiting_approval") => {}
        Some(s) => return Err(format!("Stage not awaiting approval (current: {s})")),
        None => return Err("Stage not found".to_string()),
    }

    conn.execute(
        "UPDATE stage_runs SET status = 'complete' WHERE project_id = ?1 AND stage_index = ?2",
        params![&project_id, stage_index],
    ).map_err(|e| format!("Update failed: {e}"))?;

    conn.execute(
        "UPDATE stage_runs SET status = 'ready' WHERE project_id = ?1 AND stage_index = ?2",
        params![&project_id, stage_index + 1],
    ).map_err(|e| format!("Update next stage failed: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn set_stage_status(
    project_id: String,
    stage_index: i64,
    status: String,
) -> Result<(), String> {
    if !ALLOWED_STATUSES.contains(&status.as_str()) {
        return Err(format!("Invalid status: {status}"));
    }

    let conn = open_db()?;

    conn.execute(
        "UPDATE stage_runs SET status = ?1 WHERE project_id = ?2 AND stage_index = ?3",
        params![&status, &project_id, stage_index],
    ).map_err(|e| format!("Update failed: {e}"))?;

    Ok(())
}