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
pub struct DeployResult {
    pub deploy_id: String,
    pub url: String,
    pub artifact_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeploySummary {
    pub id: String,
    pub project_id: String,
    pub target: String,
    pub env: Option<String>,
    pub status: String,
    pub started_at: Option<String>,
    pub finished_at: Option<String>,
    pub url: Option<String>,
    pub artifact_id: Option<String>,
}

#[tauri::command]
pub fn deploy(
    app: tauri::AppHandle,
    project_id: String,
    target: String,
    confirmed: bool,
) -> Result<DeployResult, String> {
    if target == "production" && !confirmed {
        return Err("Production deployment requires explicit confirmation".to_string());
    }

    let conn = open_db()?;

    let folder_path: String = conn.query_row(
        "SELECT folder_path FROM projects WHERE id=?1",
        params![&project_id],
        |row| row.get(0),
    ).map_err(|_| "Project not found".to_string())?;

    // Verify .vercel/project.json exists
    let vercel_json_path = format!("{}/.vercel/project.json", folder_path);
    if !std::path::Path::new(&vercel_json_path).exists() {
        return Err("Project not linked to Vercel. Run vercel link in the project folder first.".to_string());
    }

    let deploy_id = format!("{}", Uuid::new_v4());
    let started_at = chrono::Local::now().to_rfc3339();

    conn.execute(
        "INSERT INTO deployments (id,project_id,target,env,status,started_at)
         VALUES (?1,?2,?3,?4,'running',?5)",
        params![&deploy_id, &project_id, &target, &target, &started_at],
    ).map_err(|e| format!("DB insert failed: {e}"))?;

    app.emit("stage:progress", serde_json::json!({
        "project_id": &project_id, "stage_index": 10,
        "status": "running",
        "message": format!("Deploying to {}...", target)
    })).ok();

    // Build vercel CLI args safely
    let prod_flag = target == "production";
    let mut args: Vec<&str> = vec!["--yes"];
    if prod_flag { args.push("--prod"); }

    let output = std::process::Command::new("vercel")
        .args(&args)
        .current_dir(&folder_path)
        .output()
        .map_err(|e| format!("Vercel CLI failed: {e}"))?;

    let finished_at = chrono::Local::now().to_rfc3339();
    let exit_code = output.status.code().unwrap_or(-1);
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let deploy_log = format!("{}\n{}", stdout, stderr);

    // Extract https:// URL from output
    let url = stdout.lines()
        .find(|l| l.trim().starts_with("https://"))
        .map(|l| l.trim().to_string())
        .unwrap_or_else(|| "https://vercel.app".to_string());

    let deploy_status = if exit_code == 0 { "success" } else { "failed" };

    // Write deploy log artifact
    let artifact_id = format!("{}", Uuid::new_v4());
    let run_id = format!("{}", Uuid::new_v4());
    let now = chrono::Local::now().to_rfc3339();
    let content_hash = format!("{:x}", sha2::Sha256::digest(deploy_log.as_bytes()));
    let artifact_path = format!(
        "E:\\linup-io\\.linup\\artifacts\\{}\\deploy.log",
        run_id
    );
    if let Some(parent) = std::path::Path::new(&artifact_path).parent() {
        std::fs::create_dir_all(parent).ok();
    }
    std::fs::write(&artifact_path, &deploy_log).ok();

    conn.execute(
        "INSERT INTO artifacts (id,project_id,stage_index,run_id,artifact_type,filename,content_hash,created_at,sync_status)
         VALUES (?1,?2,10,?3,'deploy_log','deploy.log',?4,?5,'local')",
        params![&artifact_id, &project_id, &run_id, &content_hash, &now],
    ).ok();

    conn.execute(
        "UPDATE deployments SET finished_at=?1, status=?2, url=?3, artifact_id=?4 WHERE id=?5",
        params![&finished_at, deploy_status, &url, &artifact_id, &deploy_id],
    ).map_err(|e| format!("Deployment update failed: {e}"))?;

    let stage_status = if exit_code == 0 { "awaiting_approval" } else { "gate_failed" };
    conn.execute(
        "UPDATE stage_runs SET status=?1 WHERE project_id=?2 AND stage_index=10",
        params![stage_status, &project_id],
    ).ok();

    app.emit("stage:complete", serde_json::json!({
        "project_id": &project_id,
        "stage_index": 10,
        "status": stage_status,
        "url": &url,
        "artifact_ids": [&artifact_id]
    })).ok();

    Ok(DeployResult { deploy_id, url, artifact_id })
}

#[tauri::command]
pub fn get_deploys(project_id: String) -> Result<Vec<DeploySummary>, String> {
    let conn = open_db()?;
    let mut stmt = conn.prepare(
        "SELECT id,project_id,target,env,status,started_at,finished_at,url,artifact_id
         FROM deployments WHERE project_id=?1 ORDER BY started_at DESC",
    ).map_err(|e| format!("Prepare failed: {e}"))?;

    let rows = stmt.query_map(params![&project_id], |row| {
        Ok(DeploySummary {
            id: row.get(0)?,
            project_id: row.get(1)?,
            target: row.get(2)?,
            env: row.get(3)?,
            status: row.get(4)?,
            started_at: row.get(5)?,
            finished_at: row.get(6)?,
            url: row.get(7)?,
            artifact_id: row.get(8)?,
        })
    }).map_err(|e| format!("Query failed: {e}"))?;

    let mut deploys = Vec::new();
    for row in rows {
        deploys.push(row.map_err(|e| format!("Row error: {e}"))?);
    }
    Ok(deploys)
}

#[tauri::command]
pub fn rollback_deploy(
    project_id: String,
    target: String,
    to_version: String,
) -> Result<(), String> {
    // Stub — vercel rollback requires the deployment URL or ID
    // Full implementation would call: vercel rollback [deployment-url]
    let _ = (project_id, target, to_version);
    Ok(())
}