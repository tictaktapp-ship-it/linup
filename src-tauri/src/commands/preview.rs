use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::AppHandle;

const DB_PATH: &str = "E:\\linup-io\\linup.db";

fn open_db() -> Result<Connection, String> {
    Connection::open(DB_PATH).map_err(|e| format!("DB error: {e}"))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PreviewStatus {
    pub project_id: String,
    pub url: String,
    pub port: u16,
    pub status: String,
}

static PREVIEW_PIDS: Mutex<Option<HashMap<String, u32>>> = Mutex::new(None);

fn get_pids() -> std::sync::MutexGuard<'static, Option<HashMap<String, u32>>> {
    let mut guard = PREVIEW_PIDS.lock().unwrap();
    if guard.is_none() { *guard = Some(HashMap::new()); }
    guard
}

fn is_port_open(port: u16) -> bool {
    std::net::TcpStream::connect(format!("127.0.0.1:{port}")).is_ok()
}

#[tauri::command]
pub fn start_preview_server(app: AppHandle, project_id: String) -> Result<PreviewStatus, String> {
    let db = open_db()?;
    let folder_path: String = db.query_row(
        "SELECT folder_path FROM projects WHERE id = ?",
        params![project_id],
        |row| row.get(0),
    ).map_err(|e| format!("Project not found: {e}"))?;
    let child = std::process::Command::new("pnpm")
        .args(["dev"])
        .current_dir(&folder_path)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to spawn pnpm dev: {e}"))?;
    let pid = child.id();
    { let mut g = get_pids(); g.as_mut().unwrap().insert(project_id.clone(), pid); }
    let mut ready = false;
    for _ in 0..30 {
        std::thread::sleep(std::time::Duration::from_secs(1));
        if is_port_open(3000) { ready = true; break; }
    }
    if !ready { return Err("Preview server did not start within 30s".into()); }
    let _ = app;
    Ok(PreviewStatus { project_id, url: "http://localhost:3000".into(), port: 3000, status: "running".into() })
}

#[tauri::command]
pub fn stop_preview_server(project_id: String) -> Result<(), String> {
    let pid = { let mut g = get_pids(); g.as_mut().unwrap().remove(&project_id) };
    match pid {
        Some(p) => {
            std::process::Command::new("taskkill")
                .args(["/PID", &p.to_string(), "/F", "/T"])
                .spawn().map_err(|e| format!("Kill failed: {e}"))?;
            Ok(())
        }
        None => Err("No preview server running for this project".into()),
    }
}

#[tauri::command]
pub fn open_preview_window(app: AppHandle, url: String) -> Result<(), String> {
    tauri::WebviewWindowBuilder::new(&app, "preview", tauri::WebviewUrl::External(url.parse::<tauri::Url>().map_err(|e| e.to_string())?))
        .title("App Preview")
        .inner_size(1280.0, 800.0)
        .build()
        .map_err(|e| format!("Failed to open preview window: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn get_preview_status(project_id: String) -> Result<PreviewStatus, String> {
    let pid = { let g = get_pids(); g.as_ref().unwrap().get(&project_id).cloned() };
    match pid {
        Some(_) if is_port_open(3000) => Ok(PreviewStatus {
            project_id, url: "http://localhost:3000".into(), port: 3000, status: "running".into(),
        }),
        Some(_) => Err("Process registered but port not open".into()),
        None => Err("No preview server running".into()),
    }
}
