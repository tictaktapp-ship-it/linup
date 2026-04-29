use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use sha2::Digest;
use tauri::Emitter;
use uuid::Uuid;

const DB_PATH: &str = "E:\\linup-io\\linup.db";

fn open_db() -> Result<Connection, String> {
    Connection::open(DB_PATH).map_err(|e| format!("DB error: {e}"))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BuildResult {
    pub build_id: String,
    pub platform: String,
    pub mode: String,
    pub artifact_id: String,
    pub output_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BuildSummary {
    pub id: String,
    pub project_id: String,
    pub mode: String,
    pub platform: String,
    pub started_at: Option<String>,
    pub finished_at: Option<String>,
    pub status: String,
    pub artifact_id: Option<String>,
}

#[tauri::command]
pub fn build_desktop(
    app: tauri::AppHandle,
    project_id: String,
    mode: String,
) -> Result<BuildResult, String> {
    let conn = open_db()?;

    let folder_path: String = conn.query_row(
        "SELECT folder_path FROM projects WHERE id=?1",
        params![&project_id],
        |row| row.get(0),
    ).map_err(|_| "Project not found".to_string())?;

    let build_id = format!("{}", Uuid::new_v4());
    let platform = std::env::consts::OS.to_string();
    let started_at = chrono::Local::now().to_rfc3339();

    conn.execute(
        "INSERT INTO builds (id,project_id,mode,platform,started_at,status)
         VALUES (?1,?2,?3,?4,?5,'running')",
        params![&build_id, &project_id, &mode, &platform, &started_at],
    ).map_err(|e| format!("DB insert failed: {e}"))?;

    app.emit("stage:progress", serde_json::json!({
        "project_id": &project_id, "stage_index": 9,
        "status": "running", "message": format!("Building {} ({})", mode, platform)
    })).ok();

    // Run pnpm build (Next.js production build)
    let build_args = vec!["run", "build"];
    let output = std::process::Command::new("pnpm")
        .args(&build_args)
        .current_dir(&folder_path)
        .output()
        .map_err(|e| format!("Build command failed: {e}"))?;

    let finished_at = chrono::Local::now().to_rfc3339();
    let exit_code = output.status.code().unwrap_or(-1);
    let build_log = format!(
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );

    // Output path — Next.js builds to .next folder
    let output_path = format!("{}/.next", folder_path);
    let build_status = if exit_code == 0 { "success" } else { "failed" };

    // Write build log artifact
    let artifact_id = format!("{}", Uuid::new_v4());
    let run_id = format!("{}", Uuid::new_v4());
    let now = chrono::Local::now().to_rfc3339();
    let content_hash = format!("{:x}", sha2::Sha256::digest(build_log.as_bytes()));
    let artifact_path = format!("E:\\linup-io\\.linup\\artifacts\\{}\\build.log", run_id);
    if let Some(parent) = std::path::Path::new(&artifact_path).parent() {
        std::fs::create_dir_all(parent).ok();
    }
    std::fs::write(&artifact_path, &build_log).ok();

    conn.execute(
        "INSERT INTO artifacts (id,project_id,stage_index,run_id,artifact_type,filename,content_hash,created_at,sync_status)
         VALUES (?1,?2,9,?3,'build_log','build.log',?4,?5,'local')",
        params![&artifact_id, &project_id, &run_id, &content_hash, &now],
    ).ok();

    conn.execute(
        "UPDATE builds SET finished_at=?1, status=?2, artifact_id=?3 WHERE id=?4",
        params![&finished_at, build_status, &artifact_id, &build_id],
    ).map_err(|e| format!("Build update failed: {e}"))?;

    let stage_status = if exit_code == 0 { "awaiting_approval" } else { "gate_failed" };
    conn.execute(
        "UPDATE stage_runs SET status=?1 WHERE project_id=?2 AND stage_index=9",
        params![stage_status, &project_id],
    ).ok();

    app.emit("stage:complete", serde_json::json!({
        "project_id": &project_id,
        "stage_index": 9,
        "status": stage_status,
        "build_id": &build_id,
        "artifact_ids": [&artifact_id],
        "exit_code": exit_code
    })).ok();

    Ok(BuildResult {
        build_id,
        platform,
        mode,
        artifact_id,
        output_path,
    })
}

#[tauri::command]
pub fn get_builds(project_id: String) -> Result<Vec<BuildSummary>, String> {
    let conn = open_db()?;
    let mut stmt = conn.prepare(
        "SELECT id,project_id,mode,platform,started_at,finished_at,status,artifact_id
         FROM builds WHERE project_id=?1 ORDER BY started_at DESC",
    ).map_err(|e| format!("Prepare failed: {e}"))?;

    let rows = stmt.query_map(params![&project_id], |row| {
        Ok(BuildSummary {
            id: row.get(0)?,
            project_id: row.get(1)?,
            mode: row.get(2)?,
            platform: row.get(3)?,
            started_at: row.get(4)?,
            finished_at: row.get(5)?,
            status: row.get(6)?,
            artifact_id: row.get(7)?,
        })
    }).map_err(|e| format!("Query failed: {e}"))?;

    let mut builds = Vec::new();
    for row in rows {
        builds.push(row.map_err(|e| format!("Row error: {e}"))?);
    }
    Ok(builds)
}

#[tauri::command]
pub fn open_build_output(project_id: String, build_id: String) -> Result<(), String> {
    let conn = open_db()?;

    let folder_path: String = conn.query_row(
        "SELECT folder_path FROM projects WHERE id=?1",
        params![&project_id],
        |row| row.get(0),
    ).map_err(|_| "Project not found".to_string())?;

    let output_path = format!("{}/.next", folder_path);

    std::process::Command::new("explorer")
        .arg(&output_path)
        .spawn()
        .map_err(|e| format!("Failed to open folder: {e}"))?;

    let _ = build_id;
    Ok(())
}