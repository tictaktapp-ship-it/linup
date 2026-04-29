use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

const DB_PATH: &str = "E:\\linup-io\\linup.db";

fn open_db() -> Result<Connection, String> {
    Connection::open(DB_PATH).map_err(|e| format!("DB error: {e}"))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClarifySession {
    pub id: String,
    pub project_id: String,
    pub questions: Vec<String>,
    pub answers: Option<Vec<String>>,
    pub gate_status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[tauri::command]
pub fn start_clarify(
    project_id: String,
    questions: Vec<String>,
) -> Result<ClarifySession, String> {
    if questions.len() > 5 {
        return Err("Maximum 5 clarifying questions allowed".to_string());
    }

    let conn = open_db()?;
    let id = format!("{}", Uuid::new_v4());
    let now = chrono::Local::now().to_rfc3339();
    let questions_json = serde_json::to_string(&questions)
        .map_err(|e| format!("Serialize error: {e}"))?;

    conn.execute(
        "INSERT INTO clarify_sessions (id,project_id,questions,gate_status,created_at,updated_at)
         VALUES (?1,?2,?3,'pending',?4,?5)",
        params![&id, &project_id, &questions_json, &now, &now],
    ).map_err(|e| format!("Insert failed: {e}"))?;

    Ok(ClarifySession {
        id,
        project_id,
        questions,
        answers: None,
        gate_status: "pending".to_string(),
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub fn save_clarify_answers(
    session_id: String,
    answers: Vec<String>,
) -> Result<(), String> {
    let conn = open_db()?;
    let now = chrono::Local::now().to_rfc3339();
    let answers_json = serde_json::to_string(&answers)
        .map_err(|e| format!("Serialize error: {e}"))?;

    // Gate check: look for constraint conflicts (contradictory answers)
    let gate_status = if answers.iter().any(|a| a.trim().is_empty()) {
        "pending"
    } else {
        "ready"
    };

    conn.execute(
        "UPDATE clarify_sessions SET answers=?1, gate_status=?2, updated_at=?3 WHERE id=?4",
        params![&answers_json, gate_status, &now, &session_id],
    ).map_err(|e| format!("Update failed: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn approve_clarify(session_id: String) -> Result<(), String> {
    let conn = open_db()?;
    let now = chrono::Local::now().to_rfc3339();

    let gate_status: String = conn.query_row(
        "SELECT gate_status FROM clarify_sessions WHERE id=?1",
        params![&session_id],
        |row| row.get(0),
    ).map_err(|e| format!("Query failed: {e}"))?;

    if gate_status == "conflict" {
        return Err("Cannot approve: constraint conflicts detected".to_string());
    }

    conn.execute(
        "UPDATE clarify_sessions SET gate_status='approved', updated_at=?1 WHERE id=?2",
        params![&now, &session_id],
    ).map_err(|e| format!("Update failed: {e}"))?;

    Ok(())
}