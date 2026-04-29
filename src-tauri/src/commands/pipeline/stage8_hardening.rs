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

const ALLOWED_COMMANDS: &[(&str, &[&str])] = &[
    ("npx", &["tsc", "--noEmit"]),
    ("npx", &["eslint", "src", "--max-warnings=0"]),
    ("npm", &["audit", "--json"]),
    ("pnpm", &["audit", "--json"]),
];

fn run_gate(cmd: &str, args: &[&str], cwd: &str) -> (bool, String) {
    let allowed = ALLOWED_COMMANDS.iter().any(|(c, a)| {
        *c == cmd && args.iter().zip(a.iter()).all(|(x, y)| x == y)
    });
    if !allowed {
        return (false, format!("Command not in allowlist: {} {:?}", cmd, args));
    }
    match std::process::Command::new(cmd).args(args).current_dir(cwd).output() {
        Ok(o) => {
            let out = format!("{}{}", String::from_utf8_lossy(&o.stdout), String::from_utf8_lossy(&o.stderr));
            (o.status.success(), out)
        }
        Err(e) => (false, format!("Command failed: {e}")),
    }
}

fn write_gate_artifact(
    conn: &Connection,
    project_id: &str,
    run_id: &str,
    gate_name: &str,
    content: &str,
    now: &str,
) -> Option<String> {
    let artifact_id = format!("{}", Uuid::new_v4());
    let filename = format!("gate_{}.txt", gate_name);
    let path = format!("E:\\linup-io\\.linup\\artifacts\\{}\\{}", run_id, filename);
    if let Some(parent) = std::path::Path::new(&path).parent() {
        std::fs::create_dir_all(parent).ok();
    }
    std::fs::write(&path, content).ok();
    let hash = format!("{:x}", sha2::Sha256::digest(content.as_bytes()));
    conn.execute(
        "INSERT INTO artifacts (id,project_id,stage_index,run_id,artifact_type,filename,content_hash,created_at,sync_status)
         VALUES (?1,?2,7,?3,'gate_report',?4,?5,?6,'local')",
        params![&artifact_id, project_id, run_id, &filename, &hash, now],
    ).ok();
    Some(artifact_id)
}

#[tauri::command]
pub async fn run_stage_hardening(
    app: tauri::AppHandle,
    project_id: String,
) -> Result<StageResult, String> {
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

    app.emit("stage:progress", serde_json::json!({
        "project_id": &project_id, "stage_index": 7, "status": "running"
    })).ok();

    let run_id = format!("{}", Uuid::new_v4());
    let now = chrono::Local::now().to_rfc3339();
    let mut artifact_ids: Vec<String> = Vec::new();
    let mut gates_passed = 0i64;
    let mut gates_failed = 0i64;
    let mut hard_fail = false;

    // Gate 1: TypeScript
    let (ts_ok, ts_out) = run_gate("npx", &["tsc", "--noEmit"], &folder_path);
    if let Some(id) = write_gate_artifact(&conn, &project_id, &run_id, "typescript", &ts_out, &now) {
        artifact_ids.push(id);
    }
    if ts_ok { gates_passed += 1; } else { gates_failed += 1; hard_fail = true; }

    // Gate 2: ESLint
    let (lint_ok, lint_out) = run_gate("npx", &["eslint", "src", "--max-warnings=0"], &folder_path);
    if let Some(id) = write_gate_artifact(&conn, &project_id, &run_id, "eslint", &lint_out, &now) {
        artifact_ids.push(id);
    }
    if lint_ok { gates_passed += 1; } else { gates_failed += 1; hard_fail = true; }

    // Gate 3: npm audit
    let (audit_ok, audit_out) = run_gate("npm", &["audit", "--json"], &folder_path);
    let has_critical = audit_out.contains("\"critical\"") && !audit_out.contains("\"critical\":0");
    if let Some(id) = write_gate_artifact(&conn, &project_id, &run_id, "npm_audit", &audit_out, &now) {
        artifact_ids.push(id);
    }
    if audit_ok && !has_critical { gates_passed += 1; } else { gates_failed += 1; hard_fail = true; }

    // Gate 4: MEC SDK presence
    let package_json_path = format!("{}/package.json", folder_path);
    let package_json = std::fs::read_to_string(&package_json_path).unwrap_or_default();
    let mec_present = package_json.contains("@linup/mec-sdk");
    let migration_path = format!("{}/supabase/migrations/001_core.sql", folder_path);
    let migration = std::fs::read_to_string(&migration_path).unwrap_or_default();
    let revenue_events_ok = migration.contains("revenue_events");
    let entitlement_ok = migration.contains("entitlement_checks");
    let mec_gate_content = format!(
        "MEC SDK in package.json: {}\nrevenue_events table: {}\nentitlement_checks table: {}",
        mec_present, revenue_events_ok, entitlement_ok
    );
    if let Some(id) = write_gate_artifact(&conn, &project_id, &run_id, "mec_check", &mec_gate_content, &now) {
        artifact_ids.push(id);
    }
    if mec_present && revenue_events_ok && entitlement_ok { gates_passed += 1; } else { gates_failed += 1; hard_fail = true; }

    // Anthropic security summary
    let gate_summary = format!(
        "TypeScript: {}, ESLint: {}, npm audit: {}, MEC: {}",
        if ts_ok { "pass" } else { "FAIL" },
        if lint_ok { "pass" } else { "FAIL" },
        if audit_ok && !has_critical { "pass" } else { "FAIL" },
        if mec_present && revenue_events_ok && entitlement_ok { "pass" } else { "FAIL" }
    );

    let client = Client::new();
    let security_response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &anthropic_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&serde_json::json!({
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 1024,
            "messages": [{
                "role": "user",
                "content": format!("You are a security reviewer. Given these hardening gate results: {}\n\nWrite a brief security summary (3-5 sentences) for the app owner explaining what was checked, what passed or failed, and what it means for their app's security posture. Plain English, no jargon.", gate_summary)
            }]
        }))
        .send()
        .await
        .map_err(|e| format!("Anthropic call failed: {e}"))?;

    let security_body: AnthropicResponse = security_response.json().await
        .map_err(|e| format!("Parse failed: {e}"))?;
    let security_text = security_body.content.first()
        .map(|c| c.text.clone())
        .unwrap_or_else(|| gate_summary.clone());

    if let Some(id) = write_gate_artifact(&conn, &project_id, &run_id, "security_summary", &security_text, &now) {
        artifact_ids.push(id);
    }

    let new_status = if hard_fail { "gate_failed" } else { "awaiting_approval" };
    conn.execute(
        "UPDATE stage_runs SET status=?1 WHERE project_id=?2 AND stage_index=7",
        params![new_status, &project_id],
    ).ok();

    app.emit("stage:complete", serde_json::json!({
        "project_id": &project_id,
        "stage_index": 7,
        "status": new_status,
        "artifact_ids": &artifact_ids,
        "gates_passed": gates_passed,
        "gates_failed": gates_failed
    })).ok();

    Ok(StageResult {
        stage_index: 7,
        status: new_status.to_string(),
        artifact_ids,
        gates_passed,
        gates_failed,
    })
}