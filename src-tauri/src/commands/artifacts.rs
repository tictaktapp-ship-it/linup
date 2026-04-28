use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Write;
use uuid::Uuid;

const DB_PATH: &str = "E:\\linup-io\\linup.db";

fn open_db() -> Result<Connection, String> {
    Connection::open(DB_PATH).map_err(|e| format!("DB error: {e}"))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ArtifactMeta {
    pub id: String,
    pub project_id: String,
    pub stage_index: i64,
    pub run_id: String,
    pub artifact_type: String,
    pub filename: String,
    pub content_hash: String,
    pub created_at: String,
    pub sync_status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EvidencePack {
    pub what_changed: String,
    pub why: String,
    pub risk: String,
    pub gates_passed: i64,
    pub gates_failed: i64,
    pub artifacts: Vec<ArtifactMeta>,
    pub snapshot_name: String,
}

#[tauri::command]
pub fn write_artifact(
    project_id: String,
    stage_index: i64,
    run_id: String,
    artifact_type: String,
    filename: String,
    content: Vec<u8>,
) -> Result<String, String> {
    let conn = open_db()?;
    let id = format!("{}", Uuid::new_v4());
    let created_at = chrono::Local::now().to_rfc3339();
    let content_hash = format!("{:x}", Sha256::digest(&content));

    let disk_path = format!(
        "E:\\linup-io\\.linup\\artifacts\\{}\\{}",
        run_id, filename
    );
    if let Some(parent) = std::path::Path::new(&disk_path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Dir create failed: {e}"))?;
    }
    let mut file = fs::File::create(&disk_path).map_err(|e| format!("File create failed: {e}"))?;
    file.write_all(&content).map_err(|e| format!("Write failed: {e}"))?;

    conn.execute(
        "INSERT INTO artifacts (id, project_id, stage_index, run_id, artifact_type, filename, content_hash, created_at, sync_status) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,'local')",
        params![&id, &project_id, stage_index, &run_id, &artifact_type, &filename, &content_hash, &created_at],
    ).map_err(|e| format!("Insert failed: {e}"))?;

    Ok(id)
}

#[tauri::command]
pub fn get_artifacts(project_id: String, stage_index: i64) -> Result<Vec<ArtifactMeta>, String> {
    let conn = open_db()?;
    let mut stmt = conn
        .prepare("SELECT id,project_id,stage_index,run_id,artifact_type,filename,content_hash,created_at,sync_status FROM artifacts WHERE project_id=?1 AND stage_index=?2")
        .map_err(|e| format!("Prepare failed: {e}"))?;

    let rows = stmt
        .query_map(params![&project_id, stage_index], |row| {
            Ok(ArtifactMeta {
                id: row.get(0)?,
                project_id: row.get(1)?,
                stage_index: row.get(2)?,
                run_id: row.get(3)?,
                artifact_type: row.get(4)?,
                filename: row.get(5)?,
                content_hash: row.get(6)?,
                created_at: row.get(7)?,
                sync_status: row.get(8)?,
            })
        })
        .map_err(|e| format!("Query failed: {e}"))?;

    let mut artifacts = Vec::new();
    for row in rows {
        artifacts.push(row.map_err(|e| format!("Row error: {e}"))?);
    }
    Ok(artifacts)
}

#[tauri::command]
pub fn read_artifact(artifact_id: String) -> Result<Vec<u8>, String> {
    let conn = open_db()?;
    let (filename, run_id): (String, String) = conn
        .query_row(
            "SELECT filename, run_id FROM artifacts WHERE id=?1",
            params![&artifact_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Query failed: {e}"))?;

    let disk_path = format!("E:\\linup-io\\.linup\\artifacts\\{}\\{}", run_id, filename);
    fs::read(&disk_path).map_err(|e| format!("Read failed: {e}"))
}

#[tauri::command]
pub fn verify_artifact(artifact_id: String) -> Result<bool, String> {
    let conn = open_db()?;
    let (filename, run_id, expected_hash): (String, String, String) = conn
        .query_row(
            "SELECT filename, run_id, content_hash FROM artifacts WHERE id=?1",
            params![&artifact_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|e| format!("Query failed: {e}"))?;

    let disk_path = format!("E:\\linup-io\\.linup\\artifacts\\{}\\{}", run_id, filename);
    let content = fs::read(&disk_path).map_err(|e| format!("Read failed: {e}"))?;
    let actual_hash = format!("{:x}", Sha256::digest(&content));
    Ok(expected_hash == actual_hash)
}

#[tauri::command]
pub fn assemble_evidence_pack(
    project_id: String,
    stage_index: i64,
    run_id: String,
) -> Result<EvidencePack, String> {
    let artifacts = get_artifacts(project_id.clone(), stage_index)?;
    Ok(EvidencePack {
        what_changed: String::new(),
        why: String::new(),
        risk: "low".to_string(),
        gates_passed: 0,
        gates_failed: 0,
        artifacts,
        snapshot_name: format!("snapshot_{}_{}", project_id, run_id),
    })
}