use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

const DB_PATH: &str = "E:\\linup-io\\linup.db";

fn open_db() -> Result<Connection, String> {
    Connection::open(DB_PATH).map_err(|e| format!("DB error: {e}"))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IdeaIntake {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub problem_statement: String,
    pub target_user: String,
    pub constraints: Option<String>,
    pub links: Option<String>,
    pub version: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[tauri::command]
pub fn save_idea_intake(
    project_id: String,
    title: String,
    problem_statement: String,
    target_user: String,
    constraints: Option<String>,
    links: Option<String>,
) -> Result<String, String> {
    let conn = open_db()?;
    let id = format!("{}", Uuid::new_v4());
    let now = chrono::Local::now().to_rfc3339();

    conn.execute(
        "INSERT INTO idea_intake (id,project_id,title,problem_statement,target_user,constraints,links,version,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,1,?8,?9)
         ON CONFLICT(id) DO UPDATE SET title=?3,problem_statement=?4,target_user=?5,constraints=?6,links=?7,updated_at=?9",
        params![&id, &project_id, &title, &problem_statement, &target_user, &constraints, &links, &now, &now],
    ).map_err(|e| format!("Save failed: {e}"))?;

    Ok(id)
}

#[tauri::command]
pub fn get_idea_intake(project_id: String) -> Result<Option<IdeaIntake>, String> {
    let conn = open_db()?;

    let result = conn.query_row(
        "SELECT id,project_id,title,problem_statement,target_user,constraints,links,version,created_at,updated_at
         FROM idea_intake WHERE project_id=?1 ORDER BY version DESC LIMIT 1",
        params![&project_id],
        |row| Ok(IdeaIntake {
            id: row.get(0)?,
            project_id: row.get(1)?,
            title: row.get(2)?,
            problem_statement: row.get(3)?,
            target_user: row.get(4)?,
            constraints: row.get(5)?,
            links: row.get(6)?,
            version: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        }),
    );

    match result {
        Ok(intake) => Ok(Some(intake)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Query failed: {e}")),
    }
}

#[tauri::command]
pub fn submit_idea_intake(project_id: String) -> Result<(), String> {
    let conn = open_db()?;
    let now = chrono::Local::now().to_rfc3339();

    let rows = conn.execute(
        "UPDATE idea_intake SET version=version+1, updated_at=?1 WHERE project_id=?2",
        params![&now, &project_id],
    ).map_err(|e| format!("Submit failed: {e}"))?;

    if rows == 0 {
        return Err("No idea intake found for this project".to_string());
    }

    Ok(())
}