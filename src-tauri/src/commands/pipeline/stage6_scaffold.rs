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
pub struct ScaffoldResult {
    pub files_created: Vec<String>,
    pub artifact_id: String,
}

fn write_file(path: &str, content: &str) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Dir create failed: {e}"))?;
    }
    std::fs::write(path, content).map_err(|e| format!("Write failed for {path}: {e}"))
}

#[tauri::command]
pub fn scaffold_project(
    app: tauri::AppHandle,
    project_id: String,
) -> Result<ScaffoldResult, String> {
    let conn = open_db()?;

    let folder_path: String = conn.query_row(
        "SELECT folder_path FROM projects WHERE id=?1",
        params![&project_id],
        |row| row.get(0),
    ).map_err(|_| "Project not found or folder_path not set".to_string())?;

    let mut files_created: Vec<String> = Vec::new();

    let package_json = format!(r#"{{
  "name": "linup-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {{
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "jest"
  }},
  "dependencies": {{
    "@linup/mec-sdk": "latest",
    "@supabase/supabase-js": "^2",
    "next": "^14",
    "react": "^18",
    "react-dom": "^18"
  }},
  "devDependencies": {{
    "@types/node": "^20",
    "@types/react": "^18",
    "typescript": "^5"
  }}
}}"#);
    let p = format!("{}/package.json", folder_path);
    write_file(&p, &package_json)?;
    files_created.push(p);

    let page_tsx = r#"import { MecProvider } from '@linup/mec-sdk';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <MecProvider appId={process.env.LINUP_APP_ID!} shareRate={0.015}>
          {children}
        </MecProvider>
      </body>
    </html>
  );
}
"#;
    let p = format!("{}/src/app/layout.tsx", folder_path);
    write_file(&p, page_tsx)?;
    files_created.push(p);

    let page = r#"export default function Page() {
  return <main><h1>Welcome</h1></main>;
}
"#;
    let p = format!("{}/src/app/page.tsx", folder_path);
    write_file(&p, page)?;
    files_created.push(p);

    let supabase_ts = r#"import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);
"#;
    let p = format!("{}/src/lib/supabase.ts", folder_path);
    write_file(&p, supabase_ts)?;
    files_created.push(p);

    let mec_ts = r#"export { MecProvider, useMec } from '@linup/mec-sdk';
"#;
    let p = format!("{}/src/lib/mec.ts", folder_path);
    write_file(&p, mec_ts)?;
    files_created.push(p);

    let env_example = "NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key\nSUPABASE_SERVICE_ROLE_KEY=your-service-role-key\nLINUP_APP_ID=your-linup-app-id\n";
    let p = format!("{}/.env.example", folder_path);
    write_file(&p, env_example)?;
    files_created.push(p);

    let migration = r#"-- Core MEC tables (required by LINUP platform)
CREATE TABLE IF NOT EXISTS revenue_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    gross_amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'gbp',
    stripe_payment_intent_id TEXT,
    mec_share_amount INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS entitlement_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id TEXT NOT NULL,
    feature_key TEXT NOT NULL,
    result TEXT NOT NULL,
    resolved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    plan_snapshot TEXT
);
"#;
    let p = format!("{}/supabase/migrations/001_core.sql", folder_path);
    write_file(&p, migration)?;
    files_created.push(p);

    let gitignore = ".env\n.env.local\nnode_modules/\n.next/\n.vercel/\n";
    let p = format!("{}/.gitignore", folder_path);
    write_file(&p, gitignore)?;
    files_created.push(p);

    let gitkeep = "";
    let p = format!("{}/supabase/migrations/.gitkeep", folder_path);
    write_file(&p, gitkeep)?;
    files_created.push(p);

    // Write scaffold summary artifact
    let artifact_id = format!("{}", Uuid::new_v4());
    let run_id = format!("{}", Uuid::new_v4());
    let now = chrono::Local::now().to_rfc3339();
    let summary = format!("Scaffold complete. Files created: {}", files_created.join(", "));
    let content_hash = format!("{:x}", sha2::Sha256::digest(summary.as_bytes()));
    let artifact_path = format!("E:\\linup-io\\.linup\\artifacts\\{}\\scaffold_summary.txt", run_id);
    write_file(&artifact_path, &summary)?;

    conn.execute(
        "INSERT INTO artifacts (id,project_id,stage_index,run_id,artifact_type,filename,content_hash,created_at,sync_status)
         VALUES (?1,?2,5,?3,'scaffold_summary','scaffold_summary.txt',?4,?5,'local')",
        params![&artifact_id, &project_id, &run_id, &content_hash, &now],
    ).map_err(|e| format!("Artifact insert failed: {e}"))?;

    conn.execute(
        "UPDATE stage_runs SET status='awaiting_approval' WHERE project_id=?1 AND stage_index=5",
        params![&project_id],
    ).map_err(|e| format!("Stage update failed: {e}"))?;

    app.emit("stage:complete", serde_json::json!({
        "project_id": &project_id, "stage_index": 5,
        "status": "awaiting_approval", "artifact_ids": [&artifact_id]
    })).ok();

    Ok(ScaffoldResult { files_created, artifact_id })
}

#[tauri::command]
pub fn get_scaffold_status(project_id: String) -> Result<String, String> {
    let conn = open_db()?;
    conn.query_row(
        "SELECT status FROM stage_runs WHERE project_id=?1 AND stage_index=5",
        params![&project_id],
        |row| row.get(0),
    ).map_err(|_| "Stage not found".to_string())
}

#[tauri::command]
pub fn open_project_folder(project_id: String) -> Result<(), String> {
    let conn = open_db()?;
    let folder_path: String = conn.query_row(
        "SELECT folder_path FROM projects WHERE id=?1",
        params![&project_id],
        |row| row.get(0),
    ).map_err(|_| "Project not found".to_string())?;

    std::process::Command::new("explorer")
        .arg(&folder_path)
        .spawn()
        .map_err(|e| format!("Failed to open folder: {e}"))?;
    Ok(())
}