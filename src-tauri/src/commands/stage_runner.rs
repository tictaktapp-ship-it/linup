use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri::Emitter;

const DB_PATH: &str = "E:\\linup-io\\linup.db";

fn open_db() -> Result<Connection, String> {
    Connection::open(DB_PATH).map_err(|e| format!("DB error: {e}"))
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StageArtifact {
    pub id: String,
    pub project_id: String,
    pub stage_index: i64,
    pub artifact_type: String,
    pub content: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StageStatus {
    pub stage_index: i64,
    pub status: String,
    pub artifact: Option<StageArtifact>,
}

#[tauri::command]
pub fn get_stage_status(project_id: String, stage_index: i64) -> Result<StageStatus, String> {
    let db = open_db()?;

    // Get stage run status
    let status: String = db.query_row(
        "SELECT status FROM stage_runs WHERE project_id = ?1 AND stage_index = ?2 ORDER BY created_at DESC LIMIT 1",
        params![project_id, stage_index],
        |row| row.get(0),
    ).unwrap_or_else(|_| "pending".to_string());

    // Get latest artifact for this stage
    let artifact = db.query_row(
        "SELECT id, project_id, stage_index, artifact_type, content, created_at FROM artifacts WHERE project_id = ?1 AND stage_index = ?2 ORDER BY created_at DESC LIMIT 1",
        params![project_id, stage_index],
        |row| {
            let content_blob: Vec<u8> = row.get(4)?;
            Ok(StageArtifact {
                id: row.get(0)?,
                project_id: row.get(1)?,
                stage_index: row.get(2)?,
                artifact_type: row.get(3)?,
                content: String::from_utf8(content_blob).unwrap_or_default(),
                created_at: row.get(5)?,
            })
        },
    ).ok();

    Ok(StageStatus { stage_index, status, artifact })
}

#[tauri::command]
pub async fn run_stage(
    app: AppHandle,
    project_id: String,
    stage_index: i64,
    anthropic_key: String,
) -> Result<String, String> {
    let db = open_db()?;

    // Get project details
    let (name, description, stack): (String, String, String) = db.query_row(
        "SELECT name, COALESCE(description, ''), COALESCE(stack_preset, 'web') FROM projects WHERE id = ?1",
        params![project_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    ).map_err(|e| format!("Project not found: {e}"))?;

    // Build the prompt for Stage 1
    let prompt = format!(
        "You are a senior product manager and software architect. Generate a comprehensive product specification for the following app:\n\nApp Name: {}\nDescription: {}\nStack: {}\n\nGenerate a detailed product specification with:\n1. Executive Summary (2-3 sentences)\n2. User Stories (at least 5, in 'As a [user], I want to [action], so that [benefit]' format)\n3. Acceptance Criteria (specific, testable criteria for each major feature)\n4. Technical Constraints and Requirements\n5. Feature List (prioritised as Must Have / Should Have / Could Have)\n6. Out of Scope (what this app will NOT do)\n\nBe specific, practical and focused on what can be built. Write in clear markdown format.",
        name, description, stack
    );

    // Create stage run record
    let run_id = format!("{}", uuid::Uuid::new_v4());
    let created_at = chrono::Utc::now().to_rfc3339();
    db.execute(
        "INSERT INTO stage_runs (id, project_id, stage_index, status, created_at, updated_at) VALUES (?1, ?2, ?3, 'running', ?4, ?4)",
        params![run_id, project_id, stage_index, created_at],
    ).map_err(|e| e.to_string())?;

    // Emit running status
    let _ = app.emit("stage-status", serde_json::json!({
        "project_id": project_id,
        "stage_index": stage_index,
        "status": "running"
    }));

    // Call Anthropic API
    let client = reqwest::Client::new();
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &anthropic_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&serde_json::json!({
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 4096,
            "messages": [{
                "role": "user",
                "content": prompt
            }]
        }))
        .send()
        .await
        .map_err(|e| format!("Anthropic API error: {e}"))?;

    let body: serde_json::Value = response.json().await
        .map_err(|e| format!("Parse error: {e}"))?;

    let content = body["content"][0]["text"]
        .as_str()
        .ok_or("No content in response")?
        .to_string();

    // Save artifact
    let artifact_id = format!("{}", uuid::Uuid::new_v4());
    let artifact_at = chrono::Utc::now().to_rfc3339();
    db.execute(
        "INSERT INTO artifacts (id, project_id, stage_index, artifact_type, content, created_at) VALUES (?1, ?2, ?3, 'product_spec', ?4, ?5)",
        params![artifact_id, project_id, stage_index, content.as_bytes().to_vec(), artifact_at],
    ).map_err(|e| e.to_string())?;

    // Update stage run to complete
    db.execute(
        "UPDATE stage_runs SET status = 'awaiting_approval', updated_at = ?1 WHERE id = ?2",
        params![artifact_at, run_id],
    ).map_err(|e| e.to_string())?;

    // Emit completion
    let _ = app.emit("stage-status", serde_json::json!({
        "project_id": project_id,
        "stage_index": stage_index,
        "status": "awaiting_approval",
        "artifact_id": artifact_id
    }));

    Ok(content)
}

#[tauri::command]
pub fn approve_stage(project_id: String, stage_index: i64) -> Result<(), String> {
    let db = open_db()?;
    let updated_at = chrono::Utc::now().to_rfc3339();
    db.execute(
        "UPDATE stage_runs SET status = 'approved', updated_at = ?1 WHERE project_id = ?2 AND stage_index = ?3",
        params![updated_at, project_id, stage_index],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn reject_stage(project_id: String, stage_index: i64) -> Result<(), String> {
    let db = open_db()?;
    let updated_at = chrono::Utc::now().to_rfc3339();
    db.execute(
        "UPDATE stage_runs SET status = 'rejected', updated_at = ?1 WHERE project_id = ?2 AND stage_index = ?3",
        params![updated_at, project_id, stage_index],
    ).map_err(|e| e.to_string())?;
    Ok(())
}