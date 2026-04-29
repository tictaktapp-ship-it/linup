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
pub struct BatchResult {
    pub batch_index: i64,
    pub files_changed: Vec<String>,
    pub diff_artifact_id: String,
    pub gates_passed: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchSummary {
    pub id: String,
    pub project_id: String,
    pub batch_index: i64,
    pub files_touched: Vec<String>,
    pub status: String,
    pub artifact_id: Option<String>,
    pub gate_results: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
struct AnthropicResponse {
    content: Vec<AnthropicContent>,
}

#[derive(Debug, Deserialize)]
struct AnthropicContent {
    text: String,
}

fn get_next_batch_index(conn: &Connection, project_id: &str) -> Result<i64, String> {
    let max: Option<i64> = conn.query_row(
        "SELECT MAX(batch_index) FROM implementation_batches WHERE project_id=?1",
        params![project_id],
        |row| row.get(0),
    ).unwrap_or(None);
    Ok(max.map(|i| i + 1).unwrap_or(0))
}

fn run_gate(cmd: &str, args: &[&str], cwd: &str) -> bool {
    std::process::Command::new(cmd)
        .args(args)
        .current_dir(cwd)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[tauri::command]
pub async fn run_implementation_batch(
    app: tauri::AppHandle,
    project_id: String,
    feature_description: String,
) -> Result<BatchResult, String> {
    let anthropic_key = Entry::new("linup-io", "anthropic")
        .map_err(|e| format!("Keyring error: {e}"))?
        .get_password()
        .map_err(|e| format!("Failed to get Anthropic key: {e}"))?;

    let conn = open_db()?;

    let folder_path: String = conn.query_row(
        "SELECT folder_path FROM projects WHERE id=?1",
        params![&project_id],
        |row| row.get(0),
    ).map_err(|_| "Project not found".to_string())?;

    let batch_index = get_next_batch_index(&conn, &project_id)?;

    app.emit("stage:progress", serde_json::json!({
        "project_id": &project_id, "stage_index": 6,
        "status": "running", "batch": batch_index
    })).ok();

    // Load architecture artifact for context
    let arch_context: Option<String> = conn.query_row(
        "SELECT run_id FROM artifacts WHERE project_id=?1 AND artifact_type='architecture' ORDER BY created_at DESC LIMIT 1",
        params![&project_id],
        |row| row.get(0),
    ).ok().and_then(|run_id: String| {
        std::fs::read_to_string(
            format!("E:\\linup-io\\.linup\\artifacts\\{}\\architecture.md", run_id)
        ).ok()
    });

    let prompt = format!(
        "You are an Engineer implementing features for a production Next.js + Supabase application.\n\nArchitecture context:\n{}\n\nFeature to implement: {}\n\nRules:\n- Output a unified diff format patch (max 5 files changed)\n- Each file change uses standard unified diff format: --- a/path and +++ b/path headers\n- Keep changes minimal and focused\n- Follow TypeScript strict mode\n- Use import type for type-only imports\n- Include MEC SDK hooks where relevant (mec.can() for feature gates)\n- Do not modify package.json or migration files\n\nOutput ONLY the unified diff. No prose. No explanation.",
        arch_context.unwrap_or_else(|| "No architecture context available".to_string()),
        feature_description
    );

    let client = Client::new();
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &anthropic_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&serde_json::json!({
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 4096,
            "messages": [{"role": "user", "content": prompt}]
        }))
        .send()
        .await
        .map_err(|e| format!("Anthropic call failed: {e}"))?;

    let body: AnthropicResponse = response.json().await
        .map_err(|e| format!("Parse failed: {e}"))?;

    let diff_text = body.content.first()
        .map(|c| c.text.clone())
        .unwrap_or_default();

    // Extract changed files from diff
    let files_changed: Vec<String> = diff_text.lines()
        .filter(|l| l.starts_with("+++ b/"))
        .map(|l| l.trim_start_matches("+++ b/").to_string())
        .collect();

    // Apply diff to project folder
    let patch_path = format!("{}/.linup_patch_{}.diff", folder_path, batch_index);
    std::fs::write(&patch_path, &diff_text).ok();

    let patch_applied = std::process::Command::new("git")
        .args(["apply", "--whitespace=fix", &patch_path])
        .current_dir(&folder_path)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    // Run regression gates
    let clippy_ok = run_gate("npx", &["tsc", "--noEmit"], &folder_path);
    let lint_ok = run_gate("npx", &["eslint", "src", "--max-warnings=0"], &folder_path);
    let gates_passed = patch_applied && clippy_ok && lint_ok;

    // Write diff artifact
    let artifact_id = format!("{}", Uuid::new_v4());
    let run_id = format!("{}", Uuid::new_v4());
    let now = chrono::Local::now().to_rfc3339();
    let content_hash = format!("{:x}", sha2::Sha256::digest(diff_text.as_bytes()));
    let artifact_path = format!("E:\\linup-io\\.linup\\artifacts\\{}\\batch_{}.diff", run_id, batch_index);

    if let Some(parent) = std::path::Path::new(&artifact_path).parent() {
        std::fs::create_dir_all(parent).ok();
    }
    std::fs::write(&artifact_path, &diff_text).ok();

    conn.execute(
        "INSERT INTO artifacts (id,project_id,stage_index,run_id,artifact_type,filename,content_hash,created_at,sync_status)
         VALUES (?1,?2,6,?3,'implementation_diff',?4,?5,?6,'local')",
        params![&artifact_id, &project_id, &run_id,
                format!("batch_{}.diff", batch_index), &content_hash, &now],
    ).map_err(|e| format!("Artifact insert failed: {e}"))?;

    let gate_results = serde_json::json!({
        "patch_applied": patch_applied,
        "typescript": clippy_ok,
        "lint": lint_ok
    }).to_string();

    conn.execute(
        "INSERT INTO implementation_batches (id,project_id,batch_index,files_touched,status,artifact_id,gate_results,created_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
        params![
            &artifact_id, &project_id, batch_index,
            &files_changed.join(","),
            if gates_passed { "passed" } else { "failed" },
            &artifact_id, &gate_results, &now
        ],
    ).map_err(|e| format!("Batch insert failed: {e}"))?;

    // Update stage status
    let stage_status = if gates_passed { "awaiting_approval" } else { "gate_failed" };
    conn.execute(
        "UPDATE stage_runs SET status=?1 WHERE project_id=?2 AND stage_index=6",
        params![stage_status, &project_id],
    ).ok();

    app.emit("stage:complete", serde_json::json!({
        "project_id": &project_id,
        "stage_index": 6,
        "batch_index": batch_index,
        "status": stage_status,
        "gates_passed": gates_passed
    })).ok();

    Ok(BatchResult {
        batch_index,
        files_changed,
        diff_artifact_id: artifact_id,
        gates_passed,
    })
}

#[tauri::command]
pub fn get_implementation_batches(project_id: String) -> Result<Vec<BatchSummary>, String> {
    let conn = open_db()?;
    let mut stmt = conn.prepare(
        "SELECT id,project_id,batch_index,files_touched,status,artifact_id,gate_results,created_at
         FROM implementation_batches WHERE project_id=?1 ORDER BY batch_index DESC",
    ).map_err(|e| format!("Prepare failed: {e}"))?;

    let rows = stmt.query_map(params![&project_id], |row| {
        let files_str: Option<String> = row.get(3)?;
        Ok(BatchSummary {
            id: row.get(0)?,
            project_id: row.get(1)?,
            batch_index: row.get(2)?,
            files_touched: files_str
                .unwrap_or_default()
                .split(',')
                .filter(|s| !s.is_empty())
                .map(String::from)
                .collect(),
            status: row.get(4)?,
            artifact_id: row.get(5)?,
            gate_results: row.get(6)?,
            created_at: row.get(7)?,
        })
    }).map_err(|e| format!("Query failed: {e}"))?;

    let mut batches = Vec::new();
    for row in rows {
        batches.push(row.map_err(|e| format!("Row error: {e}"))?);
    }
    Ok(batches)
}