use rusqlite::Connection;
use serde::{Deserialize, Serialize};

const DB_PATH: &str = "E:\\linup-io\\linup.db";

fn open_db() -> Result<Connection, String> {
    Connection::open(DB_PATH).map_err(|e| format!("DB error: {e}"))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectivityStatus {
    pub online: bool,
    pub last_checked_at: String,
}

#[tauri::command]
pub async fn get_connectivity_status() -> Result<ConnectivityStatus, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .map_err(|e| format!("Client build error: {e}"))?;

    let online = client
        .head("https://api.anthropic.com")
        .send()
        .await
        .map(|r| r.status().as_u16() < 500)
        .unwrap_or(false);

    let last_checked_at = chrono::Local::now().to_rfc3339();

    Ok(ConnectivityStatus { online, last_checked_at })
}