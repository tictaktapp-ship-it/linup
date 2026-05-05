use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri::Emitter;

const DB_PATH: &str = "E:\\linup-io\\linup.db";
const GROQ_BASE_URL: &str = "https://openrouter.ai/api/v1/chat/completions";
const MODEL_FAST: &str = "meta-llama/llama-3.1-8b-instruct";
const MODEL_CAPABLE: &str = "meta-llama/llama-3.3-70b-instruct";

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

fn token_budget(agent_id: &str) -> usize {
    match agent_id {
        "clarifier" => 3000,
        "spec_writer" => 16000,
        "quality_gate" => 6000,
        _ => 8000,
    }
}

fn detect_verdict(text: &str, tier: u8, agent_id: &str) -> String {
    let upper = text.to_uppercase();
    if agent_id == "quality_gate" {
        if upper.contains("APPROVED") || upper.contains("CONDITIONAL") {
            return "PASS".to_string();
        }
        if upper.contains("BLOCKED") {
            return "SOFT_BLOCK".to_string();
        }
    }
    if upper.contains("CRITICAL") || upper.contains("BLOCKED") {
        return "SOFT_BLOCK".to_string();
    }
    if tier == 3 {
        return "ADVISORY".to_string();
    }
    if upper.contains("ADVISORY") {
        return "ADVISORY".to_string();
    }
    "PASS".to_string()
}

fn da_has_enough_findings(text: &str) -> bool {
    let numbered = (1..=10).filter(|i| text.contains(&format!("{}.", i))).count();
    let bullets = text.matches("- ").count() + text.matches("* ").count();
    numbered >= 3 || bullets >= 3
}

fn check_gate_integrity(results: &[AgentResult], gate_output: &str) -> (String, bool) {
    let has_critical = results.iter().any(|r| {
        r.output.to_uppercase().contains("CRITICAL") && r.agent_id != "quality_gate"
    });
    let gate_upper = gate_output.to_uppercase();
    let gate_approved = (gate_upper.contains("APPROVED") || gate_upper.contains("CONDITIONAL"))
        && !gate_upper.contains("BLOCKED");
    if has_critical && gate_approved {
        let overridden = format!(
            "{}\n\n---\nCONSTITUTION OVERRIDE: CRITICAL findings exist. Verdict changed to BLOCKED.",
            gate_output
        );
        return (overridden, false);
    }
    (gate_output.to_string(), gate_approved)
}

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
        .header("HTTP-Referer", "https://linup.io")
        .header("X-Title", "LINUP")
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
    let budget = token_budget(agent_id);
    let max_attempts = 2_u32;
    let mut final_output = String::new();
    let mut final_verdict = "FAILED".to_string();
    for attempt in 1..=max_attempts {
        let effective_system = if attempt > 1 {
            format!(
                "{}\n\nCONSTITUTION (retry {}): Include PASS, BLOCKED, CRITICAL, or ADVISORY. Provide at least 3 numbered findings.",
                system_prompt, attempt
            )
        } else {
            system_prompt.to_string()
        };
        match call_groq(groq_key, model, &effective_system, user_content).await {
            Ok(mut text) => {
                let char_budget = budget * 4;
                if text.len() > char_budget {
                    text.truncate(char_budget);
                    text.push_str("\n\n[Truncated]");
                }
                if agent_id == "devils_advocate" && !da_has_enough_findings(&text) && attempt < max_attempts {
                    continue;
                }
                final_verdict = detect_verdict(&text, tier, agent_id);
                final_output = text;
                break;
            }
            Err(e) => {
                if attempt >= max_attempts {
                    final_output = format!("Agent failed: {}", e);
                    final_verdict = "FAILED".to_string();
                }
            }
        }
    }
    let agent_result = AgentResult {
        agent_id: agent_id.to_string(),
        role: role.to_string(),
        tier,
        provider: "groq".to_string(),
        model: model.to_string(),
        verdict: final_verdict.clone(),
        output: final_output.clone(),
        findings: vec![],
    };
    let _ = app.emit("agent-completed", AgentCompletedPayload {
        project_id: project_id.to_string(),
        stage_index,
        agent_id: agent_id.to_string(),
        role: role.to_string(),
        verdict: final_verdict,
        output: final_output,
    });
    agent_result
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
    // Load brand profile and inject into agent brief
    let brand_ctx = db.query_row(
        "SELECT COALESCE(brand_primary_colour,'none'), COALESCE(brand_tone,'none'), COALESCE(brand_font_preference,'none'), COALESCE(brand_has_logo,0) FROM projects WHERE id=?1",
        params![project_id],
        |row| Ok(format!(
            "colour={}, tone={}, font={}, has_logo={}",
            row.get::<_,String>(0)?, row.get::<_,String>(1)?,
            row.get::<_,String>(2)?,
            if row.get::<_,i64>(3)? == 1 { "yes" } else { "no" }
        )),
    ).unwrap_or_else(|_| "not set".to_string());

    let brief = format!(
        "App: {}\nDescription: {}\nBrand profile: {}\n\nConversation:\n{}",
        name, description, brand_ctx, user_brief
    );
    // ── F-101: Extract brand profile from conversation ────────────────────────
    let brand_extract_prompt = format!(
        "Extract brand information from this conversation. Return ONLY a valid JSON object with exactly these keys (use empty string if not mentioned, false for boolean if not mentioned):\n{{\"primary_colour\":\"\",\"secondary_colour\":\"\",\"tone\":\"\",\"font_preference\":\"\",\"has_logo\":false,\"notes\":\"\"}}\n\nConversation:\n{}",
        user_brief
    );
    if let Ok(brand_raw) = call_groq(key, MODEL_FAST,
        "You are a JSON data extractor. Extract brand info and return ONLY valid JSON with no explanation, no markdown, no backticks.",
        &brand_extract_prompt).await
    {
        // Strip any markdown fences if present
        let brand_json = brand_raw.trim()
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim();
        if let Ok(brand) = serde_json::from_str::<serde_json::Value>(brand_json) {
            let _ = db.execute(
                "UPDATE projects SET brand_primary_colour=?1, brand_secondary_colour=?2, brand_tone=?3, brand_font_preference=?4, brand_has_logo=?5, brand_notes=?6 WHERE id=?7",
                params![
                    brand["primary_colour"].as_str().unwrap_or(""),
                    brand["secondary_colour"].as_str().unwrap_or(""),
                    brand["tone"].as_str().unwrap_or(""),
                    brand["font_preference"].as_str().unwrap_or(""),
                    if brand["has_logo"].as_bool().unwrap_or(false) { 1i64 } else { 0i64 },
                    brand["notes"].as_str().unwrap_or(""),
                    project_id
                ],
            );
        }
    }

    let mut results: Vec<AgentResult> = vec![];

    let clarifier = run_agent("clarifier", "Clarifier", 1, MODEL_FAST,
        "You are a product requirements analyst. List confirmed requirements as JSON then ask 3-5 clarifying questions.",
        &brief, key, &app, &project_id, stage_index).await;
    results.push(clarifier.clone());

    let spec_input = format!("Brief:\n{}\n\nClarifier:\n{}", brief, clarifier.output);
    let spec_writer = run_agent("spec_writer", "Spec Writer", 1, MODEL_CAPABLE,
        "Write a comprehensive product specification in markdown: # Executive Summary, ## Target Users, ## User Stories (5+), ## Acceptance Criteria, ## Technical Constraints, ## Feature List (MoSCoW), ## Out of Scope.",
        &spec_input, key, &app, &project_id, stage_index).await;
    results.push(spec_writer.clone());

    let spec = spec_writer.output.clone();
    let review_input = format!("Review this product specification:\n\n{}", spec);

    let devils_advocate = run_agent("devils_advocate", "Devil's Advocate", 1, MODEL_CAPABLE,
        "Find everything wrong, missing, or contradictory. Number each finding and rate CRITICAL, WARNING, or MINOR. Find at least 3 issues.",
        &review_input, key, &app, &project_id, stage_index).await;
    results.push(devils_advocate.clone());

    let realist = run_agent("realist", "Realist", 1, MODEL_CAPABLE,
        "Review scope realism. Estimate effort. Label each feature KEEP, DEFER, or REMOVE.",
        &review_input, key, &app, &project_id, stage_index).await;
    results.push(realist.clone());

    let security = run_agent("security", "Security Reviewer", 2, MODEL_CAPABLE,
        "Review for security gaps. Number findings and rate CRITICAL, HIGH, MEDIUM, or LOW.",
        &review_input, key, &app, &project_id, stage_index).await;
    results.push(security.clone());

    let accessibility = run_agent("accessibility", "Accessibility Auditor", 2, MODEL_FAST,
        "Review against WCAG 2.1 AA. List missing requirements as a numbered checklist.",
        &review_input, key, &app, &project_id, stage_index).await;
    results.push(accessibility.clone());

    let innovator = run_agent("innovator", "Innovator", 3, MODEL_CAPABLE,
        "Is this the best approach? Suggest 2-3 alternatives with tradeoffs. This is ADVISORY only.",
        &review_input, key, &app, &project_id, stage_index).await;
    results.push(innovator.clone());

    let business_analyst = run_agent("business_analyst", "Business Analyst", 3, MODEL_CAPABLE,
        "Validate problem-solution fit, adoption risks, ROI. Verdict: SOUND, WEAK, or UNSOUND.",
        &review_input, key, &app, &project_id, stage_index).await;
    results.push(business_analyst.clone());

    let gate_input = format!(
        "Spec:\n{}\n\nDevil's Advocate:\n{}\n\nRealist:\n{}\n\nSecurity:\n{}\n\nBusiness Analyst:\n{}",
        spec, devils_advocate.output, realist.output, security.output, business_analyst.output
    );
    let quality_gate = run_agent("quality_gate", "Quality Gate", 1, MODEL_CAPABLE,
        "Score 9 criteria PASS/FAIL with evidence: (1) Problem defined, (2) Users identified, (3) 5+ user stories, (4) Testable criteria, (5) Technical constraints, (6) Security requirements, (7) No unresolved CRITICAL, (8) Business case sound, (9) Scope realistic. Final verdict: APPROVED, CONDITIONAL, or BLOCKED. Format as markdown table.",
        &gate_input, key, &app, &project_id, stage_index).await;
    results.push(quality_gate.clone());

    let (enforced_output, approved) = check_gate_integrity(&results, &quality_gate.output);

    if let Some(gate) = results.iter_mut().find(|r| r.agent_id == "quality_gate") {
        gate.output = enforced_output.clone();
        gate.verdict = if approved { "PASS".to_string() } else { "SOFT_BLOCK".to_string() };
    }

    let _ = app.emit("stage-gate", StageGatePayload {
        project_id: project_id.clone(),
        stage_index,
        scorecard: enforced_output.clone(),
        verdict: if approved { "APPROVED".to_string() } else { "BLOCKED".to_string() },
        approved,
    });

    let council_json = serde_json::to_string(&results).unwrap_or_default();
    let artifact_id = uuid::Uuid::new_v4().to_string();
    let created_at = chrono::Utc::now().to_rfc3339();
    db.execute(
        "INSERT INTO council_artifacts (id, project_id, stage_index, artifact_type, content, created_at) VALUES (?1,?2,?3,'council_result',?4,?5)",
        params![artifact_id, project_id, stage_index, council_json, created_at],
    ).map_err(|e| e.to_string())?;

    let spec_id = uuid::Uuid::new_v4().to_string();
    db.execute(
        "INSERT INTO council_artifacts (id, project_id, stage_index, artifact_type, content, created_at) VALUES (?1,?2,?3,'product_spec',?4,?5)",
        params![spec_id, project_id, stage_index, spec, created_at],
    ).map_err(|e| e.to_string())?;

    let run_id = uuid::Uuid::new_v4().to_string();
    let status = if approved { "awaiting_approval" } else { "gate_failed" };
    db.execute(
        "INSERT INTO stage_runs (id, project_id, stage_index, status, started_at) VALUES (?1,?2,?3,?4,?5)",
        params![run_id, project_id, stage_index, status, created_at],
    ).map_err(|e| e.to_string())?;

    Ok(StageCouncilResult {
        project_id,
        stage_index,
        agents: results,
        gate_verdict: if approved { "APPROVED".to_string() } else { "BLOCKED".to_string() },
        gate_scorecard: enforced_output,
        approved,
    })
}

#[tauri::command]
pub fn get_council_result(project_id: String, stage_index: i64) -> Result<Option<StageCouncilResult>, String> {
    let db = open_db()?;
    let result = db.query_row(
        "SELECT content FROM council_artifacts WHERE project_id=?1 AND stage_index=?2 AND artifact_type='council_result' ORDER BY created_at DESC LIMIT 1",
        params![project_id, stage_index],
        |row| { let s: String = row.get(0)?; Ok(s) },
    ).ok();
    if let Some(json) = result {
        let agents: Vec<AgentResult> = serde_json::from_str(&json).unwrap_or_default();
        let gate = agents.iter().find(|a| a.agent_id == "quality_gate");
        let scorecard = gate.map(|g| g.output.clone()).unwrap_or_default();
        let approved = scorecard.to_uppercase().contains("APPROVED") || scorecard.to_uppercase().contains("CONDITIONAL");
        Ok(Some(StageCouncilResult {
            project_id,
            stage_index,
            agents,
            gate_verdict: if approved { "APPROVED".to_string() } else { "BLOCKED".to_string() },
            gate_scorecard: scorecard,
            approved,
        }))
    } else {
        Ok(None)
    }
}