use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri::Emitter;

const DB_PATH: &str = "E:\\linup-io\\linup.db";
const BASE_URL: &str = "https://openrouter.ai/api/v1/chat/completions";
const MODEL: &str = "meta-llama/llama-3.3-70b-instruct";

fn open_db() -> Result<Connection, String> {
    Connection::open(DB_PATH).map_err(|e| format!("DB error: {e}"))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpecAgentOutput {
    pub agent_id: String,
    pub role: String,
    pub sections: Vec<u8>,
    pub content: String,
    pub gaps: Vec<String>,
    pub questions: Vec<String>,
    pub verdict: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpecCouncilResult {
    pub project_id: String,
    pub assembled_spec: String,
    pub all_gaps: Vec<String>,
    pub all_questions: Vec<String>,
    pub approved: bool,
    pub version: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SpecApiKeys {
    pub openrouter: String,
}

#[derive(Clone, Serialize)]
struct SpecAgentStartedPayload {
    project_id: String,
    agent_id: String,
    role: String,
    group: u8,
}

#[derive(Clone, Serialize)]
struct SpecAgentCompletedPayload {
    project_id: String,
    agent_id: String,
    role: String,
    verdict: String,
    sections: Vec<u8>,
}

async fn call_spec_agent(
    api_key: &str,
    system: &str,
    user_msg: &str,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "model": MODEL,
        "max_tokens": 4096,
        "messages": [
            { "role": "system", "content": system },
            { "role": "user", "content": user_msg }
        ]
    });
    let resp = client.post(BASE_URL)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("content-type", "application/json")
        .header("HTTP-Referer", "https://linup.io")
        .header("X-Title", "LINUP Spec Council")
        .json(&body).send().await
        .map_err(|e| format!("Request error: {e}"))?;
    let data: serde_json::Value = resp.json().await
        .map_err(|e| format!("Parse error: {e}"))?;
    if let Some(err) = data.get("error") {
        return Err(format!("API error: {}", err["message"].as_str().unwrap_or("unknown")));
    }
    data["choices"][0]["message"]["content"]
        .as_str().map(|s| s.to_string())
        .ok_or("No content".to_string())
}

async fn run_spec_agent(
    agent_id: &str,
    role: &str,
    group: u8,
    sections: Vec<u8>,
    system_prompt: &str,
    user_content: &str,
    api_key: &str,
    app: &AppHandle,
    project_id: &str,
) -> SpecAgentOutput {
    let _ = app.emit("spec-agent-started", SpecAgentStartedPayload {
        project_id: project_id.to_string(),
        agent_id: agent_id.to_string(),
        role: role.to_string(),
        group,
    });

    let result = call_spec_agent(api_key, system_prompt, user_content).await;

    let (content, gaps, questions, verdict) = match result {
        Ok(text) => {
            let upper = text.to_uppercase();
            let verdict = if upper.contains("BLOCKED") { "BLOCKED" }
                else if upper.contains("[GAP:") { "PARTIAL" }
                else { "COMPLETE" };
            let gaps: Vec<String> = text.lines()
                .filter(|l| l.contains("[GAP:"))
                .map(|l| l.trim().to_string())
                .collect();
            let questions: Vec<String> = text.lines()
                .filter(|l| l.starts_with("QUESTION:"))
                .map(|l| l.trim_start_matches("QUESTION:").trim().to_string())
                .collect();
            (text, gaps, questions, verdict.to_string())
        }
        Err(e) => (format!("Agent failed: {e}"), vec![], vec![], "BLOCKED".to_string())
    };

    let output = SpecAgentOutput {
        agent_id: agent_id.to_string(),
        role: role.to_string(),
        sections: sections.clone(),
        content: content.clone(),
        gaps,
        questions,
        verdict: verdict.clone(),
    };

    let _ = app.emit("spec-agent-completed", SpecAgentCompletedPayload {
        project_id: project_id.to_string(),
        agent_id: agent_id.to_string(),
        role: role.to_string(),
        verdict,
        sections,
    });

    output
}

#[tauri::command]
pub async fn run_spec_council(
    app: AppHandle,
    project_id: String,
    product_direction: String,
    api_keys: SpecApiKeys,
) -> Result<SpecCouncilResult, String> {
    let key = &api_keys.openrouter;
    let db = open_db()?;
    let mut outputs: Vec<SpecAgentOutput> = vec![];
    let mut context = product_direction.clone();

    let base_input = format!(
        "You are a specialist in your domain producing a section of a formal product specification.\n\nPRODUCT DIRECTION DOCUMENT (your source material):\n{}\n\nRULES:\n- Populate your section(s) with real, specific content based on the product direction\n- For any mandatory field the brief does not cover, write: [GAP: description — requires user input]\n- For any questions that must be answered before your section can be complete, write: QUESTION: your question\n- Never write TBD without a tracked gap\n- Never assume meaning of unknown domain terms\n- Every requirement must be testable and specific",
        product_direction
    );

    // ── GROUP 0: Governance ──────────────────────────────────────────────────
    let spec_lead = run_spec_agent("spec_program_lead", "Specification Program Lead", 0,
        vec![1, 28],
        "You are the Specification Program Lead. Your job is to populate Section 1 (Document Control & Governance) and set up Section 28 (Acceptance Criteria structure). Define: document metadata, version history starting at 0.1.0, change control process, glossary of ALL domain-specific terms from the brief (ask for definitions of any unknown acronyms), assumptions, dependencies, and constraints.",
        &base_input, key, &app, &project_id).await;
    context = format!("{}\n\n## Spec Program Lead Output:\n{}", context, spec_lead.content);
    outputs.push(spec_lead);

    // ── GROUP 1: Product & Requirements ──────────────────────────────────────
    let pm = run_spec_agent("product_manager_spec", "Product Manager", 1,
        vec![2],
        "You are the Product Manager. Populate Section 2 (Project Vision & Objectives). Write: executive summary (plain English, who/what/why), problem statement with evidence, proposed solution, business objectives with KPIs and targets, success criteria (functional/performance/security/accessibility), explicit out-of-scope items and anti-goals, roadmap considerations. Every objective must have a KPI, target, and timeframe.",
        &format!("{}\n\nPrevious context:\n{}", base_input, context), key, &app, &project_id).await;
    context = format!("{}\n\n## Product Manager Output:\n{}", context, pm.content);
    outputs.push(pm);

    let ba = run_spec_agent("business_analyst_spec", "Business Analyst", 1,
        vec![8],
        "You are the Business Analyst. Populate Section 8 (User Stories & Functional Requirements). Write minimum 8 user stories in format: ID (US-001 etc), As a [role] / I want [goal] / So that [benefit]. For each: minimum 3 acceptance criteria, MoSCoW priority, edge cases, error conditions. Maintain traceability to Section 2 objectives. Every story must have specific, testable acceptance criteria.",
        &format!("{}\n\nPrevious context:\n{}", base_input, context), key, &app, &project_id).await;
    context = format!("{}\n\n## Business Analyst Output:\n{}", context, ba.content);
    outputs.push(ba);

    // ── GROUP 2: Research ────────────────────────────────────────────────────
    let ux_researcher = run_spec_agent("ux_researcher_spec", "UX Researcher", 2,
        vec![4],
        "You are the UX Researcher. Populate Section 4 (User Research & Personas). Produce minimum 2 personas (name, role, goals, pain points, key tasks, accessibility needs, frequency). Produce a user journey map for the primary persona covering first-time use and repeat use (stages, actions, emotions, friction, opportunities).",
        &format!("{}\n\nPrevious context:\n{}", base_input, context), key, &app, &project_id).await;
    context = format!("{}\n\n## UX Researcher Output:\n{}", context, ux_researcher.content);
    outputs.push(ux_researcher);

    // ── GROUP 3: Design ──────────────────────────────────────────────────────
    let designer = run_spec_agent("product_designer_spec", "Product Designer", 3,
        vec![7],
        "You are the Product Designer. Populate Section 7 (Design Specifications). For each major screen: define all states (loading, empty, populated, error, offline, permission denied), specify user interactions, form validation rules, data display rules. Reference LINUP Brand Guidelines v2 for the design system tokens. Define navigation model and information architecture.",
        &format!("{}\n\nPrevious context:\n{}", base_input, context), key, &app, &project_id).await;
    context = format!("{}\n\n## Product Designer Output:\n{}", context, designer.content);
    outputs.push(designer);

    // ── GROUP 4: Architecture ────────────────────────────────────────────────
    let architect = run_spec_agent("solution_architect_spec", "Solution Architect", 4,
        vec![5, 6],
        "You are the Solution Architect. Populate Section 5 (Platform) and Section 6 (Architecture). Produce: architecture overview with component diagram, chosen architectural pattern with rationale, environment model (dev/staging/production), ADR for every major architectural decision (context, options, decision, consequences). Ensure architecture supports all user stories.",
        &format!("{}\n\nPrevious context:\n{}", base_input, context), key, &app, &project_id).await;
    context = format!("{}\n\n## Solution Architect Output:\n{}", context, architect.content);
    outputs.push(architect);

    let backend = run_spec_agent("backend_lead_spec", "Backend Lead", 4,
        vec![9, 11, 20],
        "You are the Backend Lead. Populate Section 9 (Auth), Section 11 (API), Section 20 (Error Handling). Define: auth model (JWT/session, expiry, refresh), RBAC roles and permission matrix, API standards (versioning, pagination, error envelope), rate limiting strategy, standard error codes, audit logging requirements.",
        &format!("{}\n\nPrevious context:\n{}", base_input, context), key, &app, &project_id).await;
    context = format!("{}\n\n## Backend Lead Output:\n{}", context, backend.content);
    outputs.push(backend);

    // ── GROUP 5: Data ────────────────────────────────────────────────────────
    let data_architect = run_spec_agent("data_architect_spec", "Data Architect", 5,
        vec![10],
        "You are the Data Architect. Populate Section 10 (Data Architecture). Define: all entities/tables with fields (types, nullability, defaults), relationships and cascade rules, indexing strategy, soft-delete approach, data retention periods, backup strategy, erasure/anonymisation process. Every entity from the user stories must appear here.",
        &format!("{}\n\nPrevious context:\n{}", base_input, context), key, &app, &project_id).await;
    context = format!("{}\n\n## Data Architect Output:\n{}", context, data_architect.content);
    outputs.push(data_architect);

    // ── GROUP 6: Security & Privacy ──────────────────────────────────────────
    let security_arch = run_spec_agent("security_architect_spec", "Security Architect", 6,
        vec![16],
        "You are the Security Architect. Populate Section 16 (Security). Cover all OWASP Top 10 explicitly. Define: encryption at rest and in transit, secrets management, security headers, vulnerability management SLA, audit logging events and retention, incident response process and severity model.",
        &format!("{}\n\nPrevious context:\n{}", base_input, context), key, &app, &project_id).await;
    context = format!("{}\n\n## Security Architect Output:\n{}", context, security_arch.content);
    outputs.push(security_arch);

    let privacy = run_spec_agent("privacy_lead_spec", "Privacy Lead", 6,
        vec![23],
        "You are the Privacy Lead. Populate Section 23 (Legal, Compliance & Privacy). Identify applicable regulations by jurisdiction. Define lawful basis per data category. Define DSAR/erasure/export process and timelines. Identify required legal documents (ToS, privacy policy, consent). Flag any regulatory exposure from the product features.",
        &format!("{}\n\nPrevious context:\n{}", base_input, context), key, &app, &project_id).await;
    context = format!("{}\n\n## Privacy Lead Output:\n{}", context, privacy.content);
    outputs.push(privacy);

    // ── GROUP 7: Quality ─────────────────────────────────────────────────────
    let qa = run_spec_agent("qa_lead_spec", "QA Lead", 7,
        vec![21],
        "You are the QA Lead. Populate Section 21 (Testing Strategy). Define: test pyramid (unit/integration/E2E ratios and targets), CI/CD quality gates (what must pass before deployment), device/browser matrix, bug severity taxonomy with response SLAs, test data policy. Every acceptance criteria from Section 8 must map to a test approach.",
        &format!("{}\n\nPrevious context:\n{}", base_input, context), key, &app, &project_id).await;
    context = format!("{}\n\n## QA Lead Output:\n{}", context, qa.content);
    outputs.push(qa);

    let a11y = run_spec_agent("accessibility_spec", "Accessibility Specialist", 7,
        vec![17],
        "You are the Accessibility Specialist. Populate Section 17 (Accessibility). Minimum standard: WCAG 2.2 AA. Define: compliance checklist (all applicable criteria), screen reader test matrix, keyboard navigation requirements per screen, focus management rules, remediation SLA for issues found in audit.",
        &format!("{}\n\nPrevious context:\n{}", base_input, context), key, &app, &project_id).await;
    context = format!("{}\n\n## Accessibility Specialist Output:\n{}", context, a11y.content);
    outputs.push(a11y);

    // ── GROUP 8: Operations ──────────────────────────────────────────────────
    let devops = run_spec_agent("devops_spec", "DevOps / SRE", 8,
        vec![22],
        "You are the DevOps/SRE engineer. Populate Section 22 (Deployment & CI/CD). Define: environment matrix with access controls, CI/CD pipeline stages and required quality gates, monitoring stack (what is monitored, how, alerting thresholds), reliability targets (SLO/SLA), backup and disaster recovery (RTO/RPO).",
        &format!("{}\n\nPrevious context:\n{}", base_input, context), key, &app, &project_id).await;
    context = format!("{}\n\n## DevOps Output:\n{}", context, devops.content);
    outputs.push(devops);

    // ── GROUP 9: Legal ───────────────────────────────────────────────────────
    let legal = run_spec_agent("product_counsel_spec", "Product Counsel", 9,
        vec![23],
        "You are the Product Counsel. Review Section 23 already populated by Privacy Lead and add: applicable regulations by feature (not just jurisdiction), IP/licensing constraints in any dependencies, required disclaimers, claims that require legal review, evidence requirements for compliance. Flag any feature that creates legal risk.",
        &format!("{}\n\nPrevious context:\n{}", base_input, context), key, &app, &project_id).await;
    context = format!("{}\n\n## Product Counsel Output:\n{}", context, legal.content);
    outputs.push(legal);

    // ── GROUP 10: Final Lock ─────────────────────────────────────────────────
    let editor_final = run_spec_agent("editor_in_chief", "Editor-in-Chief (Final Pass)", 10,
        vec![1, 28],
        "You are the Editor-in-Chief doing the final pass on a product specification. Your job is to: (1) resolve any contradictions between sections, (2) flag any requirement that is not testable/verifiable, (3) ensure every GAP has an owner and due date, (4) confirm all mandatory sections are complete, (5) produce a final summary: total sections complete, total gaps, total questions requiring answers, and an overall verdict of READY_FOR_REVIEW, NEEDS_INPUT, or BLOCKED.",
        &format!("{}\n\nFULL SPEC CONTEXT:\n{}", base_input, context), key, &app, &project_id).await;
    outputs.push(editor_final.clone());

    // ── Assemble full specification ───────────────────────────────────────────
    let mut assembled = format!(
        "# Product Specification\n**Version:** 0.1.0\n**Status:** Draft — Awaiting User Review\n**Project:** {}\n\n---\n\n",
        project_id
    );
    for output in &outputs {
        assembled.push_str(&output.content);
        assembled.push_str("\n\n---\n\n");
    }

    let all_gaps: Vec<String> = outputs.iter().flat_map(|o| o.gaps.clone()).collect();
    let all_questions: Vec<String> = outputs.iter().flat_map(|o| o.questions.clone()).collect();
    let blocked = outputs.iter().any(|o| o.verdict == "BLOCKED");
    let approved = !blocked;

    // Save to DB
    let spec_id = uuid::Uuid::new_v4().to_string();
    let created_at = chrono::Utc::now().to_rfc3339();
    let _ = db.execute(
        "INSERT INTO council_artifacts (id, project_id, stage_index, artifact_type, content, created_at) VALUES (?1,?2,0,'standard_specification',?3,?4)",
        params![spec_id, project_id, assembled, created_at],
    );

    Ok(SpecCouncilResult {
        project_id,
        assembled_spec: assembled,
        all_gaps,
        all_questions,
        approved,
        version: "0.1.0".to_string(),
    })
}