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
pub struct ReleaseNotesResult {
    pub artifact_id: String,
    pub seo_artifact_id: Option<String>,
    pub sitemap_artifact_id: Option<String>,
    pub robots_artifact_id: Option<String>,
    pub content_preview: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuditEntry {
    pub id: String,
    pub project_id: String,
    pub stage_index: i64,
    pub approved_by: String,
    pub approved_at: String,
    pub artifact_ids: Vec<String>,
    pub gate_summary: String,
    pub snapshot_name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AnthropicResponse {
    content: Vec<AnthropicContent>,
}

#[derive(Debug, Deserialize)]
struct AnthropicContent {
    text: String,
}

fn write_artifact(
    conn: &Connection,
    project_id: &str,
    stage_index: i64,
    run_id: &str,
    artifact_type: &str,
    filename: &str,
    content: &str,
    now: &str,
) -> Option<String> {
    let artifact_id = format!("{}", Uuid::new_v4());
    let path = format!("E:\\linup-io\\.linup\\artifacts\\{}\\{}", run_id, filename);
    if let Some(parent) = std::path::Path::new(&path).parent() {
        std::fs::create_dir_all(parent).ok();
    }
    std::fs::write(&path, content).ok();
    let hash = format!("{:x}", sha2::Sha256::digest(content.as_bytes()));
    conn.execute(
        "INSERT INTO artifacts (id,project_id,stage_index,run_id,artifact_type,filename,content_hash,created_at,sync_status)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,'local')",
        params![&artifact_id, project_id, stage_index, run_id, artifact_type, filename, &hash, now],
    ).ok();
    Some(artifact_id)
}

#[tauri::command]
pub async fn generate_release_notes(
    app: tauri::AppHandle,
    project_id: String,
) -> Result<ReleaseNotesResult, String> {
    let anthropic_key = Entry::new("linup-io", "anthropic")
        .map_err(|e| format!("Keyring error: {e}"))?
        .get_password()
        .map_err(|e| format!("Failed to get Anthropic key: {e}"))?;

    let conn = open_db()?;

    app.emit("stage:progress", serde_json::json!({
        "project_id": &project_id, "stage_index": 12, "status": "running"
    })).ok();

    // Load audit trail for context
    let audit_summary: Vec<String> = {
        let mut stmt = conn.prepare(
            "SELECT stage_index, gate_summary FROM audit_trail WHERE project_id=?1 ORDER BY stage_index"
        ).unwrap();
        stmt.query_map(params![&project_id], |row| {
            Ok(format!("Stage {}: {}", row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        }).unwrap().filter_map(|r| r.ok()).collect()
    };

    // Load product spec for app description
    let spec_text: Option<String> = conn.query_row(
        "SELECT run_id FROM artifacts WHERE project_id=?1 AND artifact_type='product_spec' ORDER BY created_at DESC LIMIT 1",
        params![&project_id],
        |row| row.get(0),
    ).ok().and_then(|run_id: String| {
        std::fs::read_to_string(
            format!("E:\\linup-io\\.linup\\artifacts\\{}\\product_spec.md", run_id)
        ).ok()
    });

    let context = format!(
        "Product specification:\n{}\n\nBuild audit trail:\n{}",
        spec_text.unwrap_or_else(|| "No spec available".to_string()),
        audit_summary.join("\n")
    );

    let client = Client::new();

    // Generate release notes
    let rn_response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &anthropic_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&serde_json::json!({
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 2048,
            "system": "You are writing release notes for a non-technical founder's first app launch. Write in plain English, no jargon. Include: What the app does (2 sentences), Key features shipped (bullet list), What was validated (gates passed), Known limitations for v1, Next steps recommended. Be warm and celebratory — this is a big moment for the founder.",
            "messages": [{"role": "user", "content": context}]
        }))
        .send()
        .await
        .map_err(|e| format!("Anthropic call failed: {e}"))?;

    let rn_body: AnthropicResponse = rn_response.json().await
        .map_err(|e| format!("Parse failed: {e}"))?;
    let release_notes = rn_body.content.first()
        .map(|c| c.text.clone())
        .unwrap_or_else(|| "Release notes generation failed".to_string());

    // Generate SEO metadata
    let seo_response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &anthropic_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&serde_json::json!({
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 1024,
            "system": "Output ONLY valid JSON, no prose, no markdown fences.",
            "messages": [{"role": "user", "content": format!(
                "Generate SEO metadata JSON for this app:\n{}\n\nOutput a JSON object with fields: title (60 chars max), description (160 chars max), keywords (array of 10 strings), ogTitle, ogDescription, twitterCard (summary_large_image), schemaOrg (object with @context=https://schema.org, @type=WebApplication, name, description, applicationCategory). Use real values based on the app spec.",
                context
            )}]
        }))
        .send()
        .await
        .map_err(|e| format!("SEO Anthropic call failed: {e}"))?;

    let seo_body: AnthropicResponse = seo_response.json().await
        .map_err(|e| format!("SEO parse failed: {e}"))?;
    let seo_json = seo_body.content.first()
        .map(|c| c.text.clone())
        .unwrap_or_else(|| "{}".to_string());

    let run_id = format!("{}", Uuid::new_v4());
    let now = chrono::Local::now().to_rfc3339();
    let approved_by = whoami::username();

    // Write all artifacts
    let rn_id = write_artifact(&conn, &project_id, 12, &run_id, "release_notes", "RELEASE_NOTES.md", &release_notes, &now);
    let seo_id = write_artifact(&conn, &project_id, 12, &run_id, "seo_metadata", "seo_metadata.json", &seo_json, &now);

    // Generate sitemap.xml
    let sitemap = r#"<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>/about</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>/pricing</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>
</urlset>"#;
    let sitemap_id = write_artifact(&conn, &project_id, 12, &run_id, "sitemap", "sitemap.xml", sitemap, &now);

    // Generate robots.txt
    let robots = "User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: /sitemap.xml\n";
    let robots_id = write_artifact(&conn, &project_id, 12, &run_id, "robots", "robots.txt", robots, &now);

    // MEC disclosure artifact
    let mec_disclosure = format!(
        "# LINUP Platform Revenue Share Disclosure\n\nThis app was built using LINUP.IO. LINUP takes a 1.5% share of gross revenue processed by this application via the MEC SDK.\n\nShare rate: 1.5%\nCollection method: Stripe Connect\nDisclosure date: {}\nApproved by: {}\n\nIf your app earns nothing, LINUP earns nothing.",
        now, approved_by
    );
    let mec_id = write_artifact(&conn, &project_id, 12, &run_id, "mec_disclosure", "MEC_DISCLOSURE.md", &mec_disclosure, &now);

    // Record final approval
    let all_ids: Vec<String> = [&rn_id, &seo_id, &sitemap_id, &robots_id, &mec_id]
        .iter().filter_map(|id| id.as_ref().cloned()).collect();

    let entry_id = format!("{}", Uuid::new_v4());
    conn.execute(
        "INSERT INTO audit_trail (id,project_id,stage_index,approved_by,approved_at,artifact_ids,gate_summary,snapshot_name)
         VALUES (?1,?2,12,?3,?4,?5,'All pipeline stages complete','final_release')",
        params![&entry_id, &project_id, &approved_by, &now, &all_ids.join(",")],
    ).ok();

    conn.execute(
        "UPDATE stage_runs SET status='complete' WHERE project_id=?1 AND stage_index=12",
        params![&project_id],
    ).ok();

    app.emit("stage:complete", serde_json::json!({
        "project_id": &project_id,
        "stage_index": 12,
        "status": "complete",
        "artifact_ids": &all_ids
    })).ok();

    Ok(ReleaseNotesResult {
        artifact_id: rn_id.unwrap_or_default(),
        seo_artifact_id: seo_id,
        sitemap_artifact_id: sitemap_id,
        robots_artifact_id: robots_id,
        content_preview: release_notes.chars().take(300).collect(),
    })
}

#[tauri::command]
pub fn get_audit_trail(project_id: String) -> Result<Vec<AuditEntry>, String> {
    let conn = open_db()?;
    let mut stmt = conn.prepare(
        "SELECT id,project_id,stage_index,approved_by,approved_at,artifact_ids,gate_summary,snapshot_name
         FROM audit_trail WHERE project_id=?1 ORDER BY stage_index ASC",
    ).map_err(|e| format!("Prepare failed: {e}"))?;

    let rows = stmt.query_map(params![&project_id], |row| {
        let ids_str: Option<String> = row.get(5)?;
        Ok(AuditEntry {
            id: row.get(0)?,
            project_id: row.get(1)?,
            stage_index: row.get(2)?,
            approved_by: row.get(3)?,
            approved_at: row.get(4)?,
            artifact_ids: ids_str.unwrap_or_default()
                .split(',').filter(|s| !s.is_empty())
                .map(String::from).collect(),
            gate_summary: row.get(6)?,
            snapshot_name: row.get(7)?,
        })
    }).map_err(|e| format!("Query failed: {e}"))?;

    let mut entries = Vec::new();
    for row in rows {
        entries.push(row.map_err(|e| format!("Row error: {e}"))?);
    }
    Ok(entries)
}

#[tauri::command]
pub fn export_audit_trail(project_id: String) -> Result<String, String> {
    let entries = get_audit_trail(project_id)?;
    serde_json::to_string_pretty(&entries)
        .map_err(|e| format!("Serialization error: {e}"))
}

#[tauri::command]
pub fn record_stage_approval(
    project_id: String,
    stage_index: i64,
    artifact_ids: Vec<String>,
    gate_summary: String,
) -> Result<(), String> {
    let conn = open_db()?;
    let id = format!("{}", Uuid::new_v4());
    let approved_by = whoami::username();
    let approved_at = chrono::Local::now().to_rfc3339();

    conn.execute(
        "INSERT INTO audit_trail (id,project_id,stage_index,approved_by,approved_at,artifact_ids,gate_summary)
         VALUES (?1,?2,?3,?4,?5,?6,?7)",
        params![&id, &project_id, stage_index, &approved_by, &approved_at,
                &artifact_ids.join(","), &gate_summary],
    ).map_err(|e| format!("Insert failed: {e}"))?;

    Ok(())
}