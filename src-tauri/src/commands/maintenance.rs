use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri::Emitter;

const DB_PATH: &str = "E:\\linup-io\\linup.db";

fn open_db() -> Result<Connection, String> {
    Connection::open(DB_PATH).map_err(|e| format!("DB error: {e}"))
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MaintenanceResult {
    pub id: String,
    pub packages_checked: i64,
    pub vulnerabilities_found: i64,
    pub packages_updated: i64,
    pub artifact_id: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MaintenanceRun {
    pub id: String,
    pub project_id: String,
    pub run_type: String,
    pub status: String,
    pub packages_checked: i64,
    pub vulnerabilities_found: i64,
    pub packages_updated: i64,
    pub artifact_id: Option<String>,
    pub created_at: String,
    pub completed_at: Option<String>,
}

#[tauri::command]
pub async fn run_maintenance_check(app: AppHandle, project_id: String) -> Result<MaintenanceResult, String> {
    let db = open_db()?;
    let folder_path: String = db.query_row(
        "SELECT folder_path FROM projects WHERE id = ?",
        params![project_id],
        |row| row.get(0),
    ).map_err(|e| format!("Project not found: {e}"))?;

    let audit_out = std::process::Command::new("npm")
        .args(["audit", "--json"])
        .current_dir(&folder_path)
        .output()
        .map_err(|e| format!("npm audit failed: {e}"))?;

    let audit_text = String::from_utf8_lossy(&audit_out.stdout);
    let vulns: i64 = serde_json::from_str::<serde_json::Value>(&audit_text)
        .ok()
        .and_then(|v| v["metadata"]["vulnerabilities"]["total"].as_i64())
        .unwrap_or(0);

    let outdated_out = std::process::Command::new("pnpm")
        .args(["outdated", "--format", "json"])
        .current_dir(&folder_path)
        .output()
        .map_err(|e| format!("pnpm outdated failed: {e}"))?;
    let outdated_text = String::from_utf8_lossy(&outdated_out.stdout);
    let packages_checked: i64 = serde_json::from_str::<serde_json::Value>(&outdated_text)
        .ok()
        .and_then(|v| v.as_object().map(|o| o.len() as i64))
        .unwrap_or(0);

    let run_id = format!("{}", uuid::Uuid::new_v4());
    let created_at = chrono::Utc::now().to_rfc3339();

    db.execute(
        "INSERT INTO maintenance_runs (id, project_id, run_type, status, packages_checked, vulnerabilities_found, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![run_id, project_id, "dependency_update", "complete", packages_checked, vulns, created_at],
    ).map_err(|e| e.to_string())?;

    let result = MaintenanceResult {
        id: run_id,
        packages_checked,
        vulnerabilities_found: vulns,
        packages_updated: 0,
        artifact_id: String::new(),
        status: "complete".into(),
    };

    app.emit("maintenance:complete", &result).ok();
    Ok(result)
}

#[tauri::command]
pub fn get_maintenance_history(project_id: String) -> Result<Vec<MaintenanceRun>, String> {
    let db = open_db()?;
    let mut stmt = db.prepare(
        "SELECT id, project_id, run_type, status, packages_checked, vulnerabilities_found, packages_updated, artifact_id, created_at, completed_at FROM maintenance_runs WHERE project_id = ? ORDER BY created_at DESC"
    ).map_err(|e| e.to_string())?;
    let runs = stmt.query_map(params![project_id], |row| {
        Ok(MaintenanceRun {
            id: row.get(0)?,
            project_id: row.get(1)?,
            run_type: row.get(2)?,
            status: row.get(3)?,
            packages_checked: row.get::<_, Option<i64>>(4)?.unwrap_or(0),
            vulnerabilities_found: row.get::<_, Option<i64>>(5)?.unwrap_or(0),
            packages_updated: row.get::<_, Option<i64>>(6)?.unwrap_or(0),
            artifact_id: row.get(7)?,
            created_at: row.get(8)?,
            completed_at: row.get(9)?,
        })
    }).map_err(|e| e.to_string())?;
    runs.map(|r| r.map_err(|e| e.to_string())).collect()
}

#[tauri::command]
pub async fn apply_maintenance_patch(project_id: String, maintenance_id: String) -> Result<(), String> {
    let db = open_db()?;
    let completed_at = chrono::Utc::now().to_rfc3339();
    db.execute(
        "UPDATE maintenance_runs SET status = 'applied', completed_at = ?1 WHERE id = ?2 AND project_id = ?3",
        params![completed_at, maintenance_id, project_id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}
