use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

const DB_PATH: &str = "E:\\linup-io\\linup.db";

fn open_db() -> Result<Connection, String> {
    Connection::open(DB_PATH).map_err(|e| format!("DB error: {e}"))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MecSummary {
    pub total_gross_pence: i64,
    pub total_share_pence: i64,
    pub share_rate: f64,
    pub event_count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VariantResult {
    pub name: String,
    pub visitors: i64,
    pub conversions: i64,
    pub revenue_pence: i64,
    pub conversion_rate: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExperimentResults {
    pub experiment_id: String,
    pub name: String,
    pub variants: Vec<VariantResult>,
}

#[tauri::command]
pub fn report_revenue(
    project_id: String,
    app_id: String,
    gross_amount_pence: i64,
    currency: String,
    stripe_payment_intent_id: Option<String>,
) -> Result<String, String> {
    let db = open_db()?;
    let mec_share_pence = gross_amount_pence * 15 / 1000;
    let id = format!("{}", uuid::Uuid::new_v4());
    let created_at = chrono::Utc::now().to_rfc3339();
    db.execute(
        "INSERT INTO mec_revenue_events (id, project_id, app_id, gross_amount_pence, mec_share_pence, currency, stripe_payment_intent_id, status, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,'pending',?8)",
        params![id, project_id, app_id, gross_amount_pence, mec_share_pence, currency, stripe_payment_intent_id, created_at],
    ).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
pub fn check_entitlement(
    project_id: String,
    feature_key: String,
    plan: String,
) -> Result<bool, String> {
    let db = open_db()?;
    let result = !feature_key.is_empty();
    let id = format!("{}", uuid::Uuid::new_v4());
    let checked_at = chrono::Utc::now().to_rfc3339();
    db.execute(
        "INSERT INTO mec_entitlement_log (id, project_id, feature_key, result, plan, checked_at) VALUES (?1,?2,?3,?4,?5,?6)",
        params![id, project_id, feature_key, result.to_string(), plan, checked_at],
    ).map_err(|e| e.to_string())?;
    Ok(result)
}

#[tauri::command]
pub fn get_mec_summary(project_id: String) -> Result<MecSummary, String> {
    let db = open_db()?;
    let (total_gross, total_share, event_count): (i64, i64, i64) = db.query_row(
        "SELECT COALESCE(SUM(gross_amount_pence),0), COALESCE(SUM(mec_share_pence),0), COUNT(*) FROM mec_revenue_events WHERE project_id = ?",
        params![project_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    ).map_err(|e| e.to_string())?;
    let share_rate = if total_gross > 0 { total_share as f64 / total_gross as f64 } else { 0.015 };
    Ok(MecSummary { total_gross_pence: total_gross, total_share_pence: total_share, share_rate, event_count })
}

#[tauri::command]
pub fn create_experiment(
    project_id: String,
    name: String,
    variants: Vec<String>,
    metric: String,
) -> Result<String, String> {
    let db = open_db()?;
    let id = format!("{}", uuid::Uuid::new_v4());
    let created_at = chrono::Utc::now().to_rfc3339();
    let variants_json = serde_json::to_string(&variants).map_err(|e| e.to_string())?;
    db.execute(
        "INSERT INTO mec_experiments (id, project_id, name, variants, metric, status, created_at) VALUES (?1,?2,?3,?4,?5,'running',?6)",
        params![id, project_id, name, variants_json, metric, created_at],
    ).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
pub fn get_experiment_results(
    project_id: String,
    experiment_id: String,
) -> Result<ExperimentResults, String> {
    let db = open_db()?;
    let (name, variants_json): (String, String) = db.query_row(
        "SELECT name, variants FROM mec_experiments WHERE id = ?1 AND project_id = ?2",
        params![experiment_id, project_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).map_err(|e| e.to_string())?;
    let variant_names: Vec<String> = serde_json::from_str(&variants_json).map_err(|e| e.to_string())?;
    let mut stmt = db.prepare(
        "SELECT variant, COUNT(*) as visitors, COALESCE(SUM(revenue_pence),0) as revenue FROM mec_experiment_events WHERE experiment_id = ?1 GROUP BY variant"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![experiment_id], |row| {
        Ok(VariantResult {
            name: row.get(0)?,
            visitors: row.get(1)?,
            conversions: 0,
            revenue_pence: row.get(2)?,
            conversion_rate: 0.0,
        })
    }).map_err(|e| e.to_string())?;
    let mut variants: Vec<VariantResult> = rows.filter_map(|r| r.ok()).collect();
    for vn in &variant_names {
        if !variants.iter().any(|v| &v.name == vn) {
            variants.push(VariantResult { name: vn.clone(), visitors: 0, conversions: 0, revenue_pence: 0, conversion_rate: 0.0 });
        }
    }
    Ok(ExperimentResults { experiment_id, name, variants })
}
