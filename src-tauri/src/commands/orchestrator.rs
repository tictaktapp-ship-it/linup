use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::AppHandle;
use tauri::Emitter;

const DB_PATH: &str = "E:\\linup-io\\linup.db";

fn open_db() -> Result<Connection, String> {
    Connection::open(DB_PATH).map_err(|e| format!("DB error: {e}"))
}

// ── Data types ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentResult {
    pub agent_id: String,
    pub role: String,
    pub tier: u8,
    pub provider: String,
    pub model: String,
    pub verdict: String,   // PASS | SOFT_BLOCK | ADVISORY | RUNNING | PENDING | FAILED
    pub output: String,
    pub findings: Vec<Finding>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Finding {
    pub severity: String,  // CRITICAL | HIGH | MEDIUM | LOW | ADVISORY
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
    pub anthropic: String,
    pub openai: Option<String>,
    pub google: Option<String>,
}

// ── Agent event payloads ─────────────────────────────────────────────────────

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

// ── HTTP client helpers ──────────────────────────────────────────────────────

async fn call_anthropic(
    api_key: &str,
    model: &str,
    system: &str,
    user_message: &str,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "model": model,
        "max_tokens": 4096,
        "system": system,
        "messages": [{ "role": "user", "content": user_message }]
    });

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Anthropic request error: {e}"))?;

    let data: serde_json::Value = response.json().await
        .map_err(|e| format!("Anthropic parse error: {e}"))?;

    if let Some(err) = data.get("error") {
        return Err(format!("Anthropic API error: {}", err));
    }

    data["content"][0]["text"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or("No content in Anthropic response".to_string())
}

async fn call_openai(
    api_key: &str,
    model: &str,
    system: &str,
    user_message: &str,
) -> Result<String, String> {
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
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("OpenAI request error: {e}"))?;

    let data: serde_json::Value = response.json().await
        .map_err(|e| format!("OpenAI parse error: {e}"))?;

    if let Some(err) = data.get("error") {
        return Err(format!("OpenAI API error: {}", err));
    }

    data["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or("No content in OpenAI response".to_string())
}

// ── Core agent runner ────────────────────────────────────────────────────────

async fn run_agent(
    agent_id: &str,
    role: &str,
    tier: u8,
    provider: &str,
    model: &str,
    system_prompt: &str,
    user_content: &str,
    api_keys: &ApiKeys,
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

    let result = match provider {
        "anthropic" => call_anthropic(&api_keys.anthropic, model, system_prompt, user_content).await,
        "openai" => {
            if let Some(ref key) = api_keys.openai {
                call_openai(key, model, system_prompt, user_content).await
            } else {
                Err("No OpenAI API key configured".to_string())
            }
        }
        _ => Err(format!("Unknown provider: {provider}"))
    };

    let (verdict, output) = match result {
        Ok(text) => {
            // Simple verdict detection from output text
            let verdict = if text.to_uppercase().contains("BLOCKED") || text.to_uppercase().contains("CRITICAL") {
                "SOFT_BLOCK".to_string()
            } else if text.to_uppercase().contains("ADVISORY") || tier == 3 {
                "ADVISORY".to_string()
            } else {
                "PASS".to_string()
            };
            (verdict, text)
        }
        Err(e) => ("FAILED".to_string(), format!("Agent failed: {e}"))
    };

    let agent_result = AgentResult {
        agent_id: agent_id.to_string(),
        role: role.to_string(),
        tier,
        provider: provider.to_string(),
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

    agent_result
}

// ── Main orchestration command ───────────────────────────────────────────────

#[tauri::command]
pub async fn run_council(
    app: AppHandle,
    project_id: String,
    stage_index: i64,
    user_brief: String,
    api_keys: ApiKeys,
) -> Result<StageCouncilResult, String> {
    let db = open_db()?;

    // Get project details
    let (name, description): (String, String) = db.query_row(
        "SELECT name, COALESCE(description, '') FROM projects WHERE id = ?1",
        params![project_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).map_err(|e| format!("Project not found: {e}"))?;

    let brief = format!(
        "App Name: {}\nDescription: {}\n\nAdditional context from conversation:\n{}",
        name, description, user_brief
    );

    let mut results: Vec<AgentResult> = vec![];

    // ── STEP 1: Clarifier ───────────────────────────────────────────────────
    let clarifier = run_agent(
        "clarifier", "Clarifier", 1, "anthropic", "claude-haiku-4-5-20251001",
        "You are the Clarifier for LINUP, an AI product manager. Given an app brief, identify what is already clear and what questions remain. Format: first a JSON block of confirmed requirements, then a numbered list of 3-5 clarifying questions about what is still ambiguous.",
        &brief, &api_keys, &app, &project_id, stage_index,
    ).await;
    results.push(clarifier.clone());

    // ── STEP 2: Spec Writer ─────────────────────────────────────────────────
    let spec_input = format!("Original brief:\n{}\n\nClarifier output:\n{}", brief, clarifier.output);
    let spec_writer = run_agent(
        "spec_writer", "Spec Writer", 1, "anthropic", "claude-sonnet-4-20250514",
        "You are the Spec Writer for LINUP. Write a comprehensive product specification in markdown. Include: # Executive Summary, ## Target Users, ## User Stories (minimum 5, As a/I want/So that format), ## Acceptance Criteria, ## Technical Constraints, ## Feature List (MoSCoW), ## Out of Scope. Be specific and precise.",
        &spec_input, &api_keys, &app, &project_id, stage_index,
    ).await;
    results.push(spec_writer.clone());

    let spec = spec_writer.output.clone();

    // ── STEP 3: Run parallel reviewers ─────────────────────────────────────
    // Devils Advocate (OpenAI)
    let da_input = format!("Review this product specification:\n\n{}", spec);
    let devils_advocate = run_agent(
        "devils_advocate", "Devil's Advocate", 1, "openai", "gpt-4o",
        "You are the Devil's Advocate for LINUP. Find everything wrong, missing, ambiguous, or contradictory in this product specification. Rate each finding as CRITICAL (blocks approval), WARNING (should fix), or MINOR (advisory). Be thorough and adversarial.",
        &da_input, &api_keys, &app, &project_id, stage_index,
    ).await;
    results.push(devils_advocate.clone());

    // Realist (OpenAI)
    let realist = run_agent(
        "realist", "Realist", 1, "openai", "gpt-4o",
        "You are the Realist for LINUP, a senior project manager. Review this spec for scope realism. Identify: features too complex for MVP, honest effort estimate, recommended MVP scope (4-6 weeks), features to defer. Label each feature KEEP, DEFER, or REMOVE.",
        &da_input, &api_keys, &app, &project_id, stage_index,
    ).await;
    results.push(realist.clone());

    // Security (OpenAI)
    let security = run_agent(
        "security", "Security Pen Tester", 2, "openai", "gpt-4o",
        "You are the Security Pen Tester for LINUP. Review this spec for security vulnerabilities and missing security requirements. Rate: CRITICAL (blocks), HIGH (must fix), MEDIUM (should fix), LOW (advisory). Add specific security requirements.",
        &da_input, &api_keys, &app, &project_id, stage_index,
    ).await;
    results.push(security.clone());

    // Accessibility (Anthropic Haiku)
    let accessibility = run_agent(
        "accessibility", "Accessibility Auditor", 2, "anthropic", "claude-haiku-4-5-20251001",
        "You are the Accessibility Auditor for LINUP. Review this spec against WCAG 2.1 AA. List specific accessibility requirements missing from the spec. Format as a checklist.",
        &da_input, &api_keys, &app, &project_id, stage_index,
    ).await;
    results.push(accessibility.clone());

    // Innovator (Claude Opus)
    let innovator = run_agent(
        "innovator", "Innovator", 3, "anthropic", "claude-opus-4-20250514",
        "You are the Innovator for LINUP. Review this spec from first principles. Is this the best way to solve the problem? Suggest 2-3 alternative or enhanced approaches with tradeoffs. This is advisory — not a blocker. Be genuinely creative.",
        &da_input, &api_keys, &app, &project_id, stage_index,
    ).await;
    results.push(innovator.clone());

    // Business Analyst (Claude Sonnet)
    let business_analyst = run_agent(
        "business_analyst", "Business Analyst", 3, "anthropic", "claude-sonnet-4-20250514",
        "You are the Business Analyst for LINUP. Validate that this spec solves the stated business problem. Assess problem-solution fit, adoption risks, ROI, and key success metrics. Verdict: SOUND (proceed), WEAK (flag concerns), or UNSOUND (recommend redesign).",
        &da_input, &api_keys, &app, &project_id, stage_index,
    ).await;
    results.push(business_analyst.clone());

    // ── STEP 4: Quality Gate ────────────────────────────────────────────────
    let gate_input = format!(
        "# Product Specification\n{}\n\n# Devil's Advocate Review\n{}\n\n# Realist Review\n{}\n\n# Security Review\n{}\n\n# Business Analyst Review\n{}",
        spec, devils_advocate.output, realist.output, security.output, business_analyst.output
    );

    let quality_gate = run_agent(
        "quality_gate", "Quality Gate", 1, "anthropic", "claude-opus-4-20250514",
        "You are the Quality Gate for LINUP. Review the spec and all agent reports. Produce a scorecard table with PASS/FAIL for each criterion: (1) Problem defined, (2) Users identified, (3) 5+ user stories, (4) Testable acceptance criteria, (5) Technical constraints documented, (6) Security requirements present, (7) No unresolved CRITICAL findings, (8) Business case sound, (9) Scope realistic. Final verdict: APPROVED, CONDITIONAL, or BLOCKED. Format as a markdown table then a one-paragraph verdict.",
        &gate_input, &api_keys, &app, &project_id, stage_index,
    ).await;
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

    // Save full council result to DB
    let council_json = serde_json::to_string(&results).unwrap_or_default();
    let artifact_id = uuid::Uuid::new_v4().to_string();
    let created_at = chrono::Utc::now().to_rfc3339();
    db.execute(
        "INSERT INTO artifacts (id, project_id, stage_index, artifact_type, content, created_at) VALUES (?1, ?2, ?3, 'council_result', ?4, ?5)",
        params![artifact_id, project_id, stage_index, council_json.as_bytes().to_vec(), created_at],
    ).map_err(|e| e.to_string())?;

    // Save spec as the primary artifact
    let spec_id = uuid::Uuid::new_v4().to_string();
    db.execute(
        "INSERT INTO artifacts (id, project_id, stage_index, artifact_type, content, created_at) VALUES (?1, ?2, ?3, 'product_spec', ?4, ?5)",
        params![spec_id, project_id, stage_index, spec.as_bytes().to_vec(), created_at],
    ).map_err(|e| e.to_string())?;

    // Update stage run
    let run_id = uuid::Uuid::new_v4().to_string();
    let status = if approved { "awaiting_approval" } else { "gate_failed" };
    db.execute(
        "INSERT INTO stage_runs (id, project_id, stage_index, status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
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
        "SELECT content FROM artifacts WHERE project_id = ?1 AND stage_index = ?2 AND artifact_type = 'council_result' ORDER BY created_at DESC LIMIT 1",
        params![project_id, stage_index],
        |row| {
            let blob: Vec<u8> = row.get(0)?;
            Ok(String::from_utf8(blob).unwrap_or_default())
        },
    ).ok();

    if let Some(json) = result {
        let agents: Vec<AgentResult> = serde_json::from_str(&json).unwrap_or_default();
        let gate = agents.iter().find(|a| a.agent_id == "quality_gate");
        let approved = gate.map(|g| g.verdict == "PASS").unwrap_or(false);
        let scorecard = gate.map(|g| g.output.clone()).unwrap_or_default();
        Ok(Some(StageCouncilResult {
            project_id,
            stage_index,
            agents,
            gate_verdict: if approved { "APPROVED".to_string() } else { "CONDITIONAL".to_string() },
            gate_scorecard: scorecard,
            approved,
        }))
    } else {
        Ok(None)
    }
}