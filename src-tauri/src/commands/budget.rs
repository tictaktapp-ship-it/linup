use rusqlite::{params, Connection};
use tauri::Emitter;
use serde::{Deserialize, Serialize};

const DB_PATH: &str = "E:\\linup-io\\linup.db";

fn open_db() -> Result<Connection, String> {
    Connection::open(DB_PATH).map_err(|e| format!("DB error: {e}"))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BudgetStatus {
    pub spent: f64,
    pub cap: f64,
    pub state: String,
}

#[tauri::command]
pub fn check_budget(app: tauri::AppHandle, project_id: String) -> Result<BudgetStatus, String> {
    let conn = open_db()?;

    let cap: f64 = conn
        .query_row(
            "SELECT budget_cap FROM projects WHERE id = ?1",
            params![&project_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Project not found: {e}"))?;

    let spent: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(cost_usd), 0.0) FROM stage_runs WHERE project_id = ?1",
            params![&project_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Query failed: {e}"))?;

    let pct = if cap > 0.0 { spent / cap } else { 1.0 };
    let state = if pct >= 1.0 {
        app.emit("budget:exceeded", &project_id).ok();
        "Exceeded".to_string()
    } else if pct >= 0.95 {
        "Critical".to_string()
    } else if pct >= 0.80 {
        "Warning".to_string()
    } else {
        "Safe".to_string()
    };

    Ok(BudgetStatus { spent, cap, state })
}

#[tauri::command]
pub fn raise_cap(project_id: String, new_cap: f64) -> Result<(), String> {
    let conn = open_db()?;

    let spent: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(cost_usd), 0.0) FROM stage_runs WHERE project_id = ?1",
            params![&project_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Query failed: {e}"))?;

    if new_cap <= spent {
        return Err(format!(
            "New cap ({new_cap}) must be greater than current spend ({spent})"
        ));
    }

    conn.execute(
        "UPDATE projects SET budget_cap = ?1 WHERE id = ?2",
        params![new_cap, &project_id],
    )
    .map_err(|e| format!("Update failed: {e}"))?;

    Ok(())
}