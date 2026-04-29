use keyring::Entry;
use reqwest::Client;
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
pub struct StageResult {
    pub stage_index: i64,
    pub status: String,
    pub artifact_ids: Vec<String>,
    pub gates_passed: i64,
    pub gates_failed: i64,
}

#[derive(Debug, Deserialize)]
struct AnthropicResponse {
    content: Vec<AnthropicContent>,
}

#[derive(Debug, Deserialize)]
struct AnthropicContent {
    text: String,
}

#[tauri::command]
pub async fn run_stage_product_spec(
    app: tauri::AppHandle,
    project_id: String,
) -> Result<StageResult, String> {
    // Get Anthropic key from keyring
    let anthropic_key = Entry::new("linup-io", "anthropic")
        .map_err(|e| format!("Keyring error: {e}"))?
        .get_password()
        .map_err(|e| format!("Failed to get Anthropic key: {e}"))?;

    app.emit("stage:progress", serde_json::json!({
        "project_id": &project_id, "stage_index": 3, "status": "running"
    })).ok();

    // Load idea_intake from DB
    let conn = open_db()?;
    let idea_intake: Option<String> = conn.query_row(
        "SELECT title || ' — ' || problem_statement || ' — Target: ' || target_user
         FROM idea_intake WHERE project_id=?1 ORDER BY version DESC LIMIT 1",
        params![&project_id],
        |row| row.get(0),
    ).ok();

    // Load clarify answers from DB
    let clarify: Option<String> = conn.query_row(
        "SELECT questions || ' ANSWERS: ' || COALESCE(answers, '')
         FROM clarify_sessions WHERE project_id=?1 AND gate_status='approved' LIMIT 1",
        params![&project_id],
        |row| row.get(0),
    ).ok();

    let context = format!(
        "Idea: {}\n\nClarification: {}",
        idea_intake.unwrap_or_else(|| "No idea intake found".to_string()),
        clarify.unwrap_or_else(|| "No clarification session found".to_string()),
    );

    // Call Anthropic
    let client = Client::new();
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &anthropic_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&serde_json::json!({
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 4096,
            "system": "You are a Principal Engineer creating a production-grade product specification. Output a structured document with: 1) User Stories (at least 5, in Given/When/Then format), 2) Acceptance Criteria (measurable, testable), 3) Technical Constraints (stack, integrations, performance requirements), 4) Out of Scope (explicit exclusions for v1). Be specific and concrete.",
            "messages": [{"role": "user", "content": context}]
        }))
        .send()
        .await
        .map_err(|e| format!("Anthropic API call failed: {e}"))?;

    let body: AnthropicResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Anthropic response: {e}"))?;

    let spec_text = body.content.first()
        .map(|c| c.text.clone())
        .unwrap_or_else(|| "Empty response".to_string());

    // Gate checks
    let has_user_stories = spec_text.to_lowercase().contains("user stor") || spec_text.contains("given") || spec_text.contains("when");
    let has_acceptance = spec_text.to_lowercase().contains("acceptance criteria");
    let has_constraints = spec_text.to_lowercase().contains("constraint") || spec_text.to_lowercase().contains("technical");

    let gates_passed = [has_user_stories, has_acceptance, has_constraints]
        .iter().filter(|&&g| g).count() as i64;
    let gates_failed = 3 - gates_passed;

    // Write artifact
    let artifact_id = format!("{}", Uuid::new_v4());
    let run_id = format!("{}", Uuid::new_v4());
    let now = chrono::Local::now().to_rfc3339();
    let content_hash = format!("{:x}", sha2::Sha256::digest(spec_text.as_bytes()));

    conn.execute(
        "INSERT INTO artifacts (id,project_id,stage_index,run_id,artifact_type,filename,content_hash,created_at,sync_status)
         VALUES (?1,?2,3,?3,'product_spec','product_spec.md',?4,?5,'local')",
        params![&artifact_id, &project_id, &run_id, &content_hash, &now],
    ).map_err(|e| format!("Artifact insert failed: {e}"))?;

    // Write spec to disk
    let spec_path = format!("E:\\linup-io\\.linup\\artifacts\\{}\\product_spec.md", run_id);
    if let Some(parent) = std::path::Path::new(&spec_path).parent() {
        std::fs::create_dir_all(parent).ok();
    }
    std::fs::write(&spec_path, &spec_text).ok();

    // Update stage status
    let new_status = if gates_failed == 0 { "awaiting_approval" } else { "gate_failed" };
    conn.execute(
        "UPDATE stage_runs SET status=?1 WHERE project_id=?2 AND stage_index=3",
        params![new_status, &project_id],
    ).map_err(|e| format!("Stage update failed: {e}"))?;

    app.emit("stage:complete", serde_json::json!({
        "project_id": &project_id,
        "stage_index": 3,
        "status": new_status,
        "artifact_ids": [&artifact_id],
        "gates_passed": gates_passed,
        "gates_failed": gates_failed
    })).ok();

    Ok(StageResult {
        stage_index: 3,
        status: new_status.to_string(),
        artifact_ids: vec![artifact_id],
        gates_passed,
        gates_failed,
    })
}