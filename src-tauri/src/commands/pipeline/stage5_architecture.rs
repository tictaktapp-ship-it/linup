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

#[derive(Debug, Serialize, Deserialize)]
struct SecretsManifestEntry {
    key: String,
    label: String,
    description: String,
    provider: String,
    setup_url: String,
    required: bool,
    validation: String,
    when: String,
    group: String,
}

#[tauri::command]
pub async fn run_stage_architecture(
    app: tauri::AppHandle,
    project_id: String,
) -> Result<StageResult, String> {
    let anthropic_key = Entry::new("linup-io", "anthropic")
        .map_err(|e| format!("Keyring error: {e}"))?
        .get_password()
        .map_err(|e| format!("Failed to get Anthropic key: {e}"))?;

    app.emit("stage:progress", serde_json::json!({
        "project_id": &project_id, "stage_index": 4, "status": "running"
    })).ok();

    let conn = open_db()?;

    // Load approved product spec artifact
    let spec_text: Option<String> = conn.query_row(
        "SELECT filename FROM artifacts WHERE project_id=?1 AND artifact_type='product_spec' ORDER BY created_at DESC LIMIT 1",
        params![&project_id],
        |row| row.get(0),
    ).ok().and_then(|filename: String| {
        // Try to read from disk
        let run_id_row: Option<String> = conn.query_row(
            "SELECT run_id FROM artifacts WHERE project_id=?1 AND artifact_type='product_spec' ORDER BY created_at DESC LIMIT 1",
            params![&project_id],
            |row| row.get(0),
        ).ok();
        run_id_row.and_then(|run_id| {
            let path = format!("E:\\linup-io\\.linup\\artifacts\\{}\\{}", run_id, filename);
            std::fs::read_to_string(&path).ok()
        })
    });

    let context = format!(
        "Based on this approved product specification:\n\n{}\n\nProduce a complete system architecture document.",
        spec_text.unwrap_or_else(|| "No product spec found — create a general architecture".to_string())
    );

    let client = Client::new();
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &anthropic_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&serde_json::json!({
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 4096,
            "system": "You are a Principal Architect. Produce a complete architecture document with these sections:\n1. Data Model (all tables, fields, relationships)\n2. API Surfaces (all endpoints, methods, auth requirements)\n3. Auth Boundaries (who can access what, row-level security rules)\n4. Threat Model (top 5 risks and mitigations)\n5. Deployment Plan (infrastructure, environment variables needed, scaling approach)\n6. External Services Required (list every third-party service with its purpose)\n\nAlso output a JSON block at the end labeled SECRETS_MANIFEST containing an array of secrets needed, each with fields: key, label, description, provider, setup_url (use https://linup.io/setup/[provider]/[topic]), required (bool), validation (stripe_api_check|openai_api_check|supabase_url_check|starts_with:PREFIX|non_empty), when (before_deploy), group (core|ai|payments|communications|monitoring|app_specific).",
            "messages": [{"role": "user", "content": context}]
        }))
        .send()
        .await
        .map_err(|e| format!("Anthropic API call failed: {e}"))?;

    let body: AnthropicResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Anthropic response: {e}"))?;

    let arch_text = body.content.first()
        .map(|c| c.text.clone())
        .unwrap_or_else(|| "Empty response".to_string());

    // Gate checks
    let has_data_model = arch_text.to_lowercase().contains("data model") || arch_text.to_lowercase().contains("table");
    let has_auth = arch_text.to_lowercase().contains("auth");
    let has_deployment = arch_text.to_lowercase().contains("deploy");

    let gates_passed = [has_data_model, has_auth, has_deployment]
        .iter().filter(|&&g| g).count() as i64;
    let gates_failed = 3 - gates_passed;

    let now = chrono::Local::now().to_rfc3339();
    let run_id = format!("{}", Uuid::new_v4());

    // Write architecture artifact
    let artifact_id = format!("{}", Uuid::new_v4());
    let content_hash = format!("{:x}", sha2::Sha256::digest(arch_text.as_bytes()));
    let arch_path = format!("E:\\linup-io\\.linup\\artifacts\\{}\\architecture.md", run_id);
    if let Some(parent) = std::path::Path::new(&arch_path).parent() {
        std::fs::create_dir_all(parent).ok();
    }
    std::fs::write(&arch_path, &arch_text).ok();

    conn.execute(
        "INSERT INTO artifacts (id,project_id,stage_index,run_id,artifact_type,filename,content_hash,created_at,sync_status)
         VALUES (?1,?2,4,?3,'architecture','architecture.md',?4,?5,'local')",
        params![&artifact_id, &project_id, &run_id, &content_hash, &now],
    ).map_err(|e| format!("Artifact insert failed: {e}"))?;

    // Extract and write secrets manifest if present
    let manifest_id = if let Some(start) = arch_text.find("SECRETS_MANIFEST") {
        let json_start = arch_text[start..].find('[').map(|i| start + i);
        let json_end = arch_text[start..].find("\n```").map(|i| start + i);
        if let (Some(s), Some(e)) = (json_start, json_end) {
            let manifest_json = &arch_text[s..e];
            let manifest_artifact_id = format!("{}", Uuid::new_v4());
            let manifest_hash = format!("{:x}", sha2::Sha256::digest(manifest_json.as_bytes()));
            let manifest_path = format!("E:\\linup-io\\.linup\\artifacts\\{}\\secrets.manifest.json", run_id);
            std::fs::write(&manifest_path, manifest_json).ok();
            conn.execute(
                "INSERT INTO artifacts (id,project_id,stage_index,run_id,artifact_type,filename,content_hash,created_at,sync_status)
                 VALUES (?1,?2,4,?3,'secrets_manifest','secrets.manifest.json',?4,?5,'local')",
                params![&manifest_artifact_id, &project_id, &run_id, &manifest_hash, &now],
            ).ok();
            Some(manifest_artifact_id)
        } else { None }
    } else { None };

    let new_status = if gates_failed == 0 { "awaiting_approval" } else { "gate_failed" };
    conn.execute(
        "UPDATE stage_runs SET status=?1 WHERE project_id=?2 AND stage_index=4",
        params![new_status, &project_id],
    ).map_err(|e| format!("Stage update failed: {e}"))?;

    let mut artifact_ids = vec![artifact_id];
    if let Some(mid) = manifest_id { artifact_ids.push(mid); }

    app.emit("stage:complete", serde_json::json!({
        "project_id": &project_id,
        "stage_index": 4,
        "status": new_status,
        "artifact_ids": &artifact_ids,
        "gates_passed": gates_passed,
        "gates_failed": gates_failed
    })).ok();

    Ok(StageResult {
        stage_index: 4,
        status: new_status.to_string(),
        artifact_ids,
        gates_passed,
        gates_failed,
    })
}