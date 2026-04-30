use keyring::Entry;
use reqwest::Client;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

const DB_PATH: &str = "E:\\linup-io\\linup.db";

fn open_db() -> Result<Connection, String> {
    Connection::open(DB_PATH).map_err(|e| format!("DB error: {e}"))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SecretEntry {
    pub key: String,
    pub label: String,
    pub description: String,
    pub provider: String,
    pub setup_url: Option<String>,
    pub required: bool,
    pub group: Option<String>,
    pub validated: bool,
    pub saved: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WizardProgress {
    pub total: i64,
    pub validated: i64,
    pub required_complete: bool,
    pub all_complete: bool,
}

#[tauri::command]
pub fn load_secrets_manifest(project_id: String, _app_handle: AppHandle) -> Result<Vec<SecretEntry>, String> {
    let db = open_db()?;
    let content = db.query_row(
        "SELECT content FROM artifacts WHERE project_id = ? AND artifact_type = 'secrets_manifest' ORDER BY created_at DESC LIMIT 1",
        params![project_id],
        |row| row.get::<_, Vec<u8>>(0),
    ).map_err(|e| format!("No secrets manifest found: {e}"))?;

    let text = String::from_utf8(content).map_err(|e| e.to_string())?;
    let raw: Vec<serde_json::Value> = serde_json::from_str(&text).map_err(|e| e.to_string())?;

    let mut entries = Vec::new();
    for item in raw {
        let key = item["key"].as_str().unwrap_or("").to_string();
        let (validated, saved) = db.query_row(
            "SELECT validated, saved_to_keychain FROM secrets_wizard_progress WHERE project_id = ? AND secret_key = ?",
            params![project_id, key],
            |row| Ok((row.get::<_, i64>(0)? == 1, row.get::<_, i64>(1)? == 1)),
        ).unwrap_or((false, false));

        entries.push(SecretEntry {
            key,
            label: item["label"].as_str().unwrap_or("").to_string(),
            description: item["description"].as_str().unwrap_or("").to_string(),
            provider: item["provider"].as_str().unwrap_or("").to_string(),
            setup_url: item["setup_url"].as_str().map(|s| s.to_string()),
            required: item["required"].as_bool().unwrap_or(false),
            group: item["group"].as_str().map(|s| s.to_string()),
            validated,
            saved,
        });
    }
    Ok(entries)
}

#[tauri::command]
pub async fn validate_secret(key: String, value: String) -> Result<ValidationResult, String> {
    if key.starts_with("ANTHROPIC") {
        let client = Client::new();
        let resp = client.get("https://api.anthropic.com/v1/models")
            .header("x-api-key", &value)
            .send().await.map_err(|e| e.to_string())?;
        return Ok(ValidationResult { valid: resp.status().is_success(), message: if resp.status().is_success() { "Valid Anthropic key".into() } else { "Invalid key".into() } });
    }
    if key.starts_with("OPENAI") {
        let client = Client::new();
        let resp = client.get("https://api.openai.com/v1/models")
            .bearer_auth(&value)
            .send().await.map_err(|e| e.to_string())?;
        return Ok(ValidationResult { valid: resp.status().is_success(), message: if resp.status().is_success() { "Valid OpenAI key".into() } else { "Invalid key".into() } });
    }
    if key.starts_with("SUPABASE_URL") {
        let valid = value.starts_with("https://") && value.ends_with(".supabase.co");
        return Ok(ValidationResult { valid, message: if valid { "Valid Supabase URL".into() } else { "Must start with https:// and end with .supabase.co".into() } });
    }
    if key.starts_with("STRIPE_SECRET") {
        let valid = value.starts_with("sk_live_") || value.starts_with("sk_test_");
        return Ok(ValidationResult { valid, message: if valid { "Valid Stripe secret".into() } else { "Must start with sk_live_ or sk_test_".into() } });
    }
    if key.starts_with("VERCEL") {
        let valid = value.len() > 20;
        return Ok(ValidationResult { valid, message: if valid { "Valid Vercel token".into() } else { "Too short".into() } });
    }
    let valid = !value.is_empty();
    Ok(ValidationResult { valid, message: if valid { "Value provided".into() } else { "Value is required".into() } })
}

#[tauri::command]
pub fn save_wizard_secret(project_id: String, key: String, value: String) -> Result<(), String> {
    let service = format!("linup-{}", project_id);
    let entry = Entry::new(&service, &key).map_err(|e| e.to_string())?;
    entry.set_password(&value).map_err(|e| e.to_string())?;

    let db = open_db()?;
    let updated_at = chrono::Utc::now().to_rfc3339();
    db.execute(
        "INSERT INTO secrets_wizard_progress (project_id, secret_key, validated, saved_to_keychain, updated_at)
         VALUES (?1, ?2, 1, 1, ?3)
         ON CONFLICT(project_id, secret_key) DO UPDATE SET validated=1, saved_to_keychain=1, updated_at=?3",
        params![project_id, key, updated_at],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_wizard_progress(project_id: String) -> Result<WizardProgress, String> {
    let db = open_db()?;
    let total: i64 = db.query_row(
        "SELECT COUNT(*) FROM secrets_wizard_progress WHERE project_id = ?",
        params![project_id], |r| r.get(0)
    ).unwrap_or(0);
    let validated: i64 = db.query_row(
        "SELECT COUNT(*) FROM secrets_wizard_progress WHERE project_id = ? AND validated = 1",
        params![project_id], |r| r.get(0)
    ).unwrap_or(0);
    let required_total: i64 = db.query_row(
        "SELECT COUNT(*) FROM secrets_wizard_progress WHERE project_id = ? AND skipped = 0",
        params![project_id], |r| r.get(0)
    ).unwrap_or(0);
    let required_validated: i64 = db.query_row(
        "SELECT COUNT(*) FROM secrets_wizard_progress WHERE project_id = ? AND skipped = 0 AND validated = 1",
        params![project_id], |r| r.get(0)
    ).unwrap_or(0);
    Ok(WizardProgress {
        total,
        validated,
        required_complete: required_total > 0 && required_total == required_validated,
        all_complete: total > 0 && total == validated,
    })
}