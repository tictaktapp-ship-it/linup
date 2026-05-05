use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri::Emitter;

const DB_PATH: &str = "E:\\linup-io\\linup.db";
const GROQ_BASE_URL: &str = "https://api.groq.com/openai/v1/chat/completions";

// Fast cheap model for simple tasks
const MODEL_FAST: &str = "llama-3.1-8b-instant";
// Capable model for reasoning, writing, review
const MODEL_CAPABLE: &str = "llama-3.3-70b-versatile";

fn open_db() -> Result<Connection, String> {
    Connection::open(DB_PATH).map_err(|e| format!("DB error: {e}"))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentResult {
    pub agent_id: String,
    pub role: String,
    pub tier: u8,
    pub provider: String,
    pub model: String,
    pub verdict: String,
    pub output: String,
    pub findings: Vec<Finding>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Finding {
    pub severity: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StageCouncilResult {
    pub project_id: String,
    pub stage_index: i64,
    pub agents: Vec<AgentResult>,
    pub gate_verdict: String,
    pub gate_scorecard: String,
    pub approved: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiKeys {
    pub groq: String,
}

#[derive(Clone, Serialize)]
struct AgentStartedPayload {
    project_id: String,
    stage_index: i64,
    agent_id: String,
    role: String,
}

#[derive(Clone, Serialize)]
struct AgentCompletedPayload {
    project_id: String,
    stage_index: i64,
    agent_id: String,
    role: String,
    verdict: String,
    output: String,
}

#[derive(Clone, Serialize)]
struct StageGatePayload {
    project_id: String,
    stage_index: i64,
    scorecard: String,
    verdict: String,
    approved: bool,
}

// Groq uses OpenAI-compatible API format
async fn call_groq(api_key: &str, model: &str, system: &str, user_message: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "model": model,
        "max_tokens": 4096,
        "messages": [
            { "role": "system", "content": system },
            { "role": "user", "content": user_message }
        ]
    });

    let response = client
        .post(GROQ_BASE_URL)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Groq request error: {e}"))?;

    let data: serde_json::Value = response.json().await
        .map_err(|e| format!("Groq parse error: {e}"))?;

    if let Some(err) = data.get("error") {
        return Err(format!("Groq API error: {}", err["message"].as_str().unwrap_or("unknown")));
    }

    data["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or("No content in Groq response".to_string())
}

async fn run_agent(
    agent_id: &str,
    role: &str,
    tier: u8,
    model: &str,
    system_prompt: &str,
    user_content: &str,
    groq_key: &str,
    app: &AppHandle,
    project_id: &str,
    stage_index: i64,
) -> AgentResult {
    let _ = app.emit("agent-started", AgentStartedPayload {
        project_id: project_id.to_string(),
        stage_index,
        agent_id: agent_id.to_string(),
        role: role.to_string(),
    });

    let result = call_groq(groq_key, model, system_prompt, user_content).await;

    let (verdict, output) = match result {
        Ok(text) => {
            let upper = text.to_uppercase();
            let verdict = if upper.contains("BLOCKED") || upper.contains("CRITICAL") {
                "SOFT_BLOCK".to_string()
            } else if tier == 3 || upper.contains("ADVISORY") {
                "ADVISORY".to_string()
            } else {
                "PASS".to_string()
            };
            (verdict, text)
        }
        Err(e) => ("FAILED".to_string(), format!("Agent failed: {e}"))
    };

    let result = AgentResult {
        agent_id: agent_id.to_string(),
        role: role.to_string(),
        tier,
        provider: "groq".to_string(),
        model: model.to_string(),
        verdict: verdict.clone(),
        output: output.clone(),
        findings: vec![],
    };

    let _ = app.emit("agent-completed", AgentCompletedPayload {
        project_id: project_id.to_string(),
        stage_index,
        agent_id: agent_id.to_string(),
        role: role.to_string(),
        verdict,
        output,
    });

    result
}

#[tauri::command]
pub async fn run_council(
    app: AppHandle,
    project_id: String,
    stage_index: i64,
    user_brief: String,
    api_keys: ApiKeys,
) -> Result<StageCouncilResult, String> {
    let db = open_db()?;
    let key = &api_keys.groq;

    let (name, description): (String, String) = db.query_row(
        "SELECT name, COALESCE(description, '') FROM projects WHERE id = ?1",
        params![project_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).map_err(|e| format!("Project not found: {e}"))?;

    let brief = format!("App: {}\nDescription: {}\n\nConversation:\n{}", name, description, user_brief);
    let mut results: Vec<AgentResult> = vec![];

    // Step 1: Clarifier (cheap 8B — just intake)
    let clarifier = run_agent("clarifier", "Clarifier", 1, MODEL_FAST,
        "You are a product requirements analyst. Given an app brief, list what is clear and identify 3-5 remaining questions. Format: JSON block of confirmed requirements, then numbered questions.",
        &brief, key, &app, &project_id, stage_index).await;
    results.push(clarifier.clone());

    // Step 2: Spec Writer (capable 70B — long form writing)
    let spec_input = format!("Brief:\n{}\n\nClarifier:\n{}", brief, clarifier.output);
    let spec_writer = run_agent("spec_writer", "Spec Writer", 1, MODEL_CAPABLE,
        "You are a senior product manager. Write a comprehensive product specification in markdown with: # Executive Summary, ## Target Users, ## User Stories (5+, As a/I want/So that), ## Acceptance Criteria (testable), ## Technical Constraints, ## Feature List (MoSCoW), ## Out of Scope.",
        &spec_input, key, &app, &project_id, stage_index).await;
    results.push(spec_writer.clone());

    let spec = spec_writer.output.clone();
    let review_input = format!("Review this product specification:\n\n{}", spec);

    // Step 3: Parallel reviewers (all capable 70B)
    let devils_advocate = run_agent("devils_advocate", "Devil's Advocate", 1, MODEL_CAPABLE,
        "You are an adversarial product reviewer. Find everything wrong, missing, ambiguous, or contradictory. Rate each finding CRITICAL (blocks), WARNING (should fix), or MINOR. Be thorough.",
        &review_input, key, &app, &project_id, stage_index).await;
    results.push(devils_advocate.clone());

    let realist = run_agent("realist", "Realist", 1, MODEL_CAPABLE,
        "You are a senior project manager. Review this spec for scope realism. Give an effort estimate. Label each feature KEEP (MVP), DEFER (v2), or REMOVE. Be direct.",
        &review_input, key, &app, &project_id, stage_index).await;
    results.push(realist.clone());

    let security = run_agent("security", "Security Reviewer", 2, MODEL_CAPABLE,
        "You are a security engineer. Review this spec for security gaps. Rate: CRITICAL (blocks), HIGH (must fix), MEDIUM (should fix), LOW (advisory). Add specific security requirements missing from the spec.",
        &review_input, key, &app, &project_id, stage_index).await;
    results.push(security.clone());

    // Accessibility uses cheap 8B — checklist task
    let accessibility = run_agent("accessibility", "Accessibility Auditor", 2, MODEL_FAST,
        "You are an accessibility specialist. Review this spec against WCAG 2.1 AA. List specific requirements missing. Format as a checklist.",
        &review_input, key, &app, &project_id, stage_index).await;
    results.push(accessibility.clone());

    let innovator = run_agent("innovator", "Innovator", 3, MODEL_CAPABLE,
        "You are a first-principles product thinker. Is this the best way to solve the problem? Suggest 2-3 alternative or enhanced approaches with tradeoffs. Be genuinely creative. This is advisory only.",
        &review_input, key, &app, &project_id, stage_index).await;
    results.push(innovator.clone());

    let business_analyst = run_agent("business_analyst", "Business Analyst", 3, MODEL_CAPABLE,
        "You are a business analyst. Validate this spec solves the stated problem. Assess adoption risks, ROI, and success metrics. Verdict: SOUND (proceed), WEAK (flag concerns), or UNSOUND (redesign).",
        &review_input, key, &app, &project_id, stage_index).await;
    results.push(business_analyst.clone());

    // Step 4: Quality Gate (capable 70B — final decision)
    let gate_input = format!(
        "Spec:\n{}\n\nDevil's Advocate:\n{}\n\nRealist:\n{}\n\nSecurity:\n{}\n\nBusiness Analyst:\n{}",
        spec, devils_advocate.output, realist.output, security.output, business_analyst.output
    );
    let quality_gate = run_agent("quality_gate", "Quality Gate", 1, MODEL_CAPABLE,
        "You are the final quality gate. Score this spec on 9 criteria with PASS/FAIL + one-sentence evidence: (1) Problem defined, (2) Users identified, (3) 5+ user stories, (4) Testable criteria, (5) Technical constraints, (6) Security requirements, (7) No unresolved CRITICAL findings, (8) Business case sound, (9) Scope realistic. Final verdict: APPROVED, CONDITIONAL, or BLOCKED. Format as markdown table.",
        &gate_input, key, &app, &project_id, stage_index).await;
    results.push(quality_gate.clone());

    let approved = quality_gate.output.to_uppercase().contains("APPROVED")
        || quality_gate.output.to_uppercase().contains("CONDITIONAL");

    let _ = app.emit("stage-gate", StageGatePayload {
        project_id: project_id.clone(),
        stage_index,
        scorecard: quality_gate.output.clone(),
        verdict: if approved { "APPROVED".to_string() } else { "BLOCKED".to_string() },
        approved,
    });

    // Persist to DB
    let council_json = serde_json::to_string(&results).unwrap_or_default();
    let artifact_id = uuid::Uuid::new_v4().to_string();
    let created_at = chrono::Utc::now().to_rfc3339();
    db.execute(
        "INSERT INTO artifacts (id, project_id, stage_index, artifact_type, content, created_at) VALUES (?1,?2,?3,'council_result',?4,?5)",
        params![artifact_id, project_id, stage_index, council_json.as_bytes().to_vec(), created_at],
    ).map_err(|e| e.to_string())?;

    let spec_id = uuid::Uuid::new_v4().to_string();
    db.execute(
        "INSERT INTO artifacts (id, project_id, stage_index, artifact_type, content, created_at) VALUES (?1,?2,?3,'product_spec',?4,?5)",
        params![spec_id, project_id, stage_index, spec.as_bytes().to_vec(), created_at],
    ).map_err(|e| e.to_string())?;

    let run_id = uuid::Uuid::new_v4().to_string();
    let status = if approved { "awaiting_approval" } else { "gate_failed" };
    db.execute(
        "INSERT INTO stage_runs (id, project_id, stage_index, status, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?5)",
        params![run_id, project_id, stage_index, status, created_at],
    ).map_err(|e| e.to_string())?;

    Ok(StageCouncilResult {
        project_id,
        stage_index,
        agents: results,
        gate_verdict: if approved { "APPROVED".to_string() } else { "BLOCKED".to_string() },
        gate_scorecard: quality_gate.output,
        approved,
    })
}

#[tauri::command]
pub fn get_council_result(project_id: String, stage_index: i64) -> Result<Option<StageCouncilResult>, String> {
    let db = open_db()?;
    let result = db.query_row(
        "SELECT content FROM artifacts WHERE project_id=?1 AND stage_index=?2 AND artifact_type='council_result' ORDER BY created_at DESC LIMIT 1",
        params![project_id, stage_index],
        |row| { let b: Vec<u8> = row.get(0)?; Ok(String::from_utf8(b).unwrap_or_default()) },
    ).ok();

    if let Some(json) = result {
        let agents: Vec<AgentResult> = serde_json::from_str(&json).unwrap_or_default();
        let gate = agents.iter().find(|a| a.agent_id == "quality_gate");
        let scorecard = gate.map(|g| g.output.clone()).unwrap_or_default();
        let approved = scorecard.to_uppercase().contains("APPROVED") || scorecard.to_uppercase().contains("CONDITIONAL");
        Ok(Some(StageCouncilResult { project_id, stage_index, agents, gate_verdict: if approved { "APPROVED".to_string() } else { "BLOCKED".to_string() }, gate_scorecard: scorecard, approved }))
    } else {
        Ok(None)
    }
}