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
pub struct TestSummary {
    pub exit_code: i32,
    pub passed: i64,
    pub failed: i64,
    pub artifact_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TestRunSummary {
    pub id: String,
    pub project_id: String,
    pub started_at: Option<String>,
    pub finished_at: Option<String>,
    pub exit_code: Option<i32>,
    pub passed: Option<i64>,
    pub failed: Option<i64>,
    pub artifact_id: Option<String>,
}

#[tauri::command]
pub async fn run_tests(
    app: tauri::AppHandle,
    project_id: String,
) -> Result<TestSummary, String> {
    let conn = open_db()?;

    let folder_path: String = conn.query_row(
        "SELECT folder_path FROM projects WHERE id=?1",
        params![&project_id],
        |row| row.get(0),
    ).map_err(|_| "Project not found".to_string())?;

    // Read test script from package.json at runtime
    let pkg_path = format!("{}/package.json", folder_path);
    let pkg_content = std::fs::read_to_string(&pkg_path)
        .map_err(|e| format!("Cannot read package.json: {e}"))?;
    let pkg: serde_json::Value = serde_json::from_str(&pkg_content)
        .map_err(|e| format!("Cannot parse package.json: {e}"))?;

    let test_script = pkg["scripts"]["test"]
        .as_str()
        .ok_or_else(|| "No test script in package.json".to_string())?
        .to_string();

    app.emit("stage:progress", serde_json::json!({
        "project_id": &project_id, "stage_index": 8,
        "status": "running", "message": format!("Running: {}", test_script)
    })).ok();

    let started_at = chrono::Local::now().to_rfc3339();

    // Run test command safely
    let output = std::process::Command::new("pnpm")
        .args(["run", "test", "--", "--passWithNoTests"])
        .current_dir(&folder_path)
        .output()
        .map_err(|e| format!("Failed to run tests: {e}"))?;

    let finished_at = chrono::Local::now().to_rfc3339();
    let exit_code = output.status.code().unwrap_or(-1);
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let full_log = format!("{}\n{}", stdout, stderr);

    // Parse passed/failed counts from common test runner formats
    // Jest: "Tests: X passed, Y failed"
    // Vitest: "X passed, Y failed"
    let mut passed: i64 = 0;
    let mut failed: i64 = 0;
    for line in full_log.lines() {
        let line_lower = line.to_lowercase();
        if line_lower.contains("passed") || line_lower.contains("failed") {
            // Extract numbers before "passed" and "failed"
            let words: Vec<&str> = line.split_whitespace().collect();
            for (i, word) in words.iter().enumerate() {
                if word.to_lowercase().contains("passed") {
                    if let Some(num) = i.checked_sub(1).and_then(|j| words.get(j)) {
                        passed = num.trim_matches(',').parse().unwrap_or(0);
                    }
                }
                if word.to_lowercase().contains("failed") {
                    if let Some(num) = i.checked_sub(1).and_then(|j| words.get(j)) {
                        failed = num.trim_matches(',').parse().unwrap_or(0);
                    }
                }
            }
        }
    }

    // Write artifact
    let artifact_id = format!("{}", Uuid::new_v4());
    let run_id = format!("{}", Uuid::new_v4());
    let now = chrono::Local::now().to_rfc3339();
    let content_hash = format!("{:x}", sha2::Sha256::digest(full_log.as_bytes()));
    let artifact_path = format!(
        "E:\\linup-io\\.linup\\artifacts\\{}\\test_run.log",
        run_id
    );
    if let Some(parent) = std::path::Path::new(&artifact_path).parent() {
        std::fs::create_dir_all(parent).ok();
    }
    std::fs::write(&artifact_path, &full_log).ok();

    conn.execute(
        "INSERT INTO artifacts (id,project_id,stage_index,run_id,artifact_type,filename,content_hash,created_at,sync_status)
         VALUES (?1,?2,8,?3,'test_log','test_run.log',?4,?5,'local')",
        params![&artifact_id, &project_id, &run_id, &content_hash, &now],
    ).map_err(|e| format!("Artifact insert failed: {e}"))?;

    conn.execute(
        "INSERT INTO test_runs (id,project_id,started_at,finished_at,exit_code,passed,failed,artifact_id)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
        params![&artifact_id, &project_id, &started_at, &finished_at, exit_code, passed, failed, &artifact_id],
    ).map_err(|e| format!("Test run insert failed: {e}"))?;

    let stage_status = if exit_code == 0 { "awaiting_approval" } else { "gate_failed" };
    conn.execute(
        "UPDATE stage_runs SET status=?1 WHERE project_id=?2 AND stage_index=8",
        params![stage_status, &project_id],
    ).ok();

    app.emit("stage:complete", serde_json::json!({
        "project_id": &project_id,
        "stage_index": 8,
        "status": stage_status,
        "artifact_ids": [&artifact_id],
        "passed": passed,
        "failed": failed,
        "exit_code": exit_code
    })).ok();

    Ok(TestSummary { exit_code, passed, failed, artifact_id })
}

#[tauri::command]
pub fn get_test_runs(project_id: String) -> Result<Vec<TestRunSummary>, String> {
    let conn = open_db()?;
    let mut stmt = conn.prepare(
        "SELECT id,project_id,started_at,finished_at,exit_code,passed,failed,artifact_id
         FROM test_runs WHERE project_id=?1 ORDER BY started_at DESC",
    ).map_err(|e| format!("Prepare failed: {e}"))?;

    let rows = stmt.query_map(params![&project_id], |row| {
        Ok(TestRunSummary {
            id: row.get(0)?,
            project_id: row.get(1)?,
            started_at: row.get(2)?,
            finished_at: row.get(3)?,
            exit_code: row.get(4)?,
            passed: row.get(5)?,
            failed: row.get(6)?,
            artifact_id: row.get(7)?,
        })
    }).map_err(|e| format!("Query failed: {e}"))?;

    let mut runs = Vec::new();
    for row in rows {
        runs.push(row.map_err(|e| format!("Row error: {e}"))?);
    }
    Ok(runs)
}

#[tauri::command]
pub fn read_test_log(artifact_id: String) -> Result<String, String> {
    let conn = open_db()?;
    let run_id: String = conn.query_row(
        "SELECT run_id FROM artifacts WHERE id=?1",
        params![&artifact_id],
        |row| row.get(0),
    ).map_err(|_| "Artifact not found".to_string())?;

    let path = format!("E:\\linup-io\\.linup\\artifacts\\{}\\test_run.log", run_id);
    std::fs::read_to_string(&path).map_err(|e| format!("Read failed: {e}"))
}