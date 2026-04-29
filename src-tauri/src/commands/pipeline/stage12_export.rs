use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::Emitter;
use uuid::Uuid;

const DB_PATH: &str = "E:\\linup-io\\linup.db";

fn open_db() -> Result<Connection, String> {
    Connection::open(DB_PATH).map_err(|e| format!("DB error: {e}"))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportResult {
    pub export_id: String,
    pub export_path: String,
    pub files_included: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ValidationResult {
    pub passed: bool,
    pub elapsed_ms: u64,
    pub error: Option<String>,
}

const EXCLUDE: &[&str] = &["node_modules", ".git", "target", ".env", ".env.local", ".next"];

fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> Result<Vec<String>, String> {
    std::fs::create_dir_all(dst).map_err(|e| format!("Dir create failed: {e}"))?;
    let mut files = Vec::new();

    for entry in std::fs::read_dir(src).map_err(|e| format!("Read dir failed: {e}"))? {
        let entry = entry.map_err(|e| format!("Entry error: {e}"))?;
        let name = entry.file_name().to_string_lossy().to_string();

        if EXCLUDE.iter().any(|ex| name == *ex) {
            continue;
        }

        let src_path = entry.path();
        let dst_path = dst.join(&name);

        if src_path.is_dir() {
            let mut sub = copy_dir_recursive(&src_path, &dst_path)?;
            files.append(&mut sub);
        } else {
            std::fs::copy(&src_path, &dst_path)
                .map_err(|e| format!("Copy failed {}: {e}", src_path.display()))?;
            files.push(dst_path.to_string_lossy().to_string());
        }
    }
    Ok(files)
}

#[tauri::command]
pub fn create_export(
    app: tauri::AppHandle,
    project_id: String,
) -> Result<ExportResult, String> {
    let conn = open_db()?;

    let folder_path: String = conn.query_row(
        "SELECT folder_path FROM projects WHERE id=?1",
        params![&project_id],
        |row| row.get(0),
    ).map_err(|_| "Project not found".to_string())?;

    let timestamp = chrono::Local::now().format("%Y%m%dT%H%M%S").to_string();
    let export_path = format!("{}/.linup/exports/{}", folder_path, timestamp);
    let export_id = format!("{}", Uuid::new_v4());
    let now = chrono::Local::now().to_rfc3339();

    app.emit("stage:progress", serde_json::json!({
        "project_id": &project_id, "stage_index": 11,
        "status": "running", "message": "Creating export bundle..."
    })).ok();

    let src = std::path::Path::new(&folder_path);
    let dst = std::path::Path::new(&export_path);
    let files_included = copy_dir_recursive(src, dst)?;

    // Write export README
    let readme = format!(
        "# Export — {}\n\nExported: {}\nFiles: {}\n\n## Setup\n\n```bash\npnpm install\npnpm run build\n```\n\n## Notes\n\nThis app was built with LINUP.IO. The MEC SDK (@linup/mec-sdk) is included and requires LINUP_APP_ID to be set.\n",
        project_id, now, files_included.len()
    );
    std::fs::write(format!("{}/LINUP_EXPORT_README.md", export_path), &readme).ok();

    conn.execute(
        "INSERT INTO exports (id,project_id,export_path,created_at,validation_status)
         VALUES (?1,?2,?3,?4,'pending')",
        params![&export_id, &project_id, &export_path, &now],
    ).map_err(|e| format!("DB insert failed: {e}"))?;

    conn.execute(
        "UPDATE stage_runs SET status='awaiting_approval' WHERE project_id=?1 AND stage_index=11",
        params![&project_id],
    ).ok();

    app.emit("stage:complete", serde_json::json!({
        "project_id": &project_id,
        "stage_index": 11,
        "status": "awaiting_approval",
        "export_path": &export_path,
        "files_count": files_included.len()
    })).ok();

    Ok(ExportResult { export_id, export_path, files_included })
}

#[tauri::command]
pub fn validate_export(
    project_id: String,
    export_id: String,
) -> Result<ValidationResult, String> {
    let start = std::time::Instant::now();
    let conn = open_db()?;

    let export_path: String = conn.query_row(
        "SELECT export_path FROM exports WHERE id=?1 AND project_id=?2",
        params![&export_id, &project_id],
        |row| row.get(0),
    ).map_err(|_| "Export not found".to_string())?;

    // Copy to temp dir and run pnpm install + build
    let temp_path = format!(
        "{}\\linup-portability-test\\{}",
        std::env::temp_dir().to_string_lossy(),
        project_id
    );

    if std::path::Path::new(&temp_path).exists() {
        std::fs::remove_dir_all(&temp_path).ok();
    }

    let src = std::path::Path::new(&export_path);
    let dst = std::path::Path::new(&temp_path);
    copy_dir_recursive(src, dst).map_err(|e| format!("Copy to temp failed: {e}"))?;

    let install_ok = std::process::Command::new("pnpm")
        .args(["install", "--frozen-lockfile"])
        .current_dir(&temp_path)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    let build_ok = if install_ok {
        std::process::Command::new("pnpm")
            .args(["run", "build"])
            .current_dir(&temp_path)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    } else {
        false
    };

    let elapsed_ms = start.elapsed().as_millis() as u64;
    let passed = install_ok && build_ok;
    let error = if !passed {
        Some(if !install_ok {
            "pnpm install failed in portability test".to_string()
        } else {
            "pnpm build failed in portability test".to_string()
        })
    } else {
        None
    };

    let status = if passed { "passed" } else { "failed" };
    conn.execute(
        "UPDATE exports SET validation_status=?1, validation_time_ms=?2 WHERE id=?3",
        params![status, elapsed_ms as i64, &export_id],
    ).ok();

    // Cleanup temp
    std::fs::remove_dir_all(&temp_path).ok();

    Ok(ValidationResult { passed, elapsed_ms, error })
}

#[tauri::command]
pub fn open_export_folder(
    project_id: String,
    export_id: String,
) -> Result<(), String> {
    let conn = open_db()?;

    let export_path: String = conn.query_row(
        "SELECT export_path FROM exports WHERE id=?1 AND project_id=?2",
        params![&export_id, &project_id],
        |row| row.get(0),
    ).map_err(|_| "Export not found".to_string())?;

    std::process::Command::new("explorer")
        .arg(&export_path)
        .spawn()
        .map_err(|e| format!("Failed to open folder: {e}"))?;

    Ok(())
}