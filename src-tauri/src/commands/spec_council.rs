use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri::Emitter;

const BASE_URL: &str = "https://openrouter.ai/api/v1/chat/completions";
const MODEL: &str = "meta-llama/llama-3.3-70b-instruct";

// ── Structured output format injected into every agent ──────────────────────
const OUTPUT_FORMAT: &str = r#"

REQUIRED OUTPUT FORMAT — you must follow this exactly:

## [SECTION NUMBER] [Section Title]

### [Subsection heading]
[Content — specific, testable, no vague statements]

### Gaps
[GAP-XXX]: [Description of what is unknown] — requires user input
(Write NONE if no gaps)

### Questions
QUESTION: [Specific question requiring user answer before section can be finalised]
(Write NONE if no questions)

### Agent verdict
VERDICT: COMPLETE | NEEDS_INPUT | BLOCKED
CONFIDENCE: HIGH | MEDIUM | LOW
REASON: [One sentence explaining verdict]

Do not deviate from this format. The Editor-in-Chief will reject non-compliant output.
"#;

const DB_PATH: &str = "E:\\linup-io\\linup.db";

fn open_db() -> Result<Connection, String> {
    Connection::open(DB_PATH).map_err(|e| format!("DB error: {e}"))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpecAgentOutput {
    pub agent_id: String,
    pub role: String,
    pub group: u8,
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
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(180))
        .build()
        .unwrap_or_default();
    let body = serde_json::json!({
        "model": MODEL, "provider": {"order": ["Together", "DeepInfra", "Fireworks"], "allow_fallbacks": true},
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

    let full_system = format!("{}{}", system_prompt, OUTPUT_FORMAT);
    let result = call_spec_agent(api_key, &full_system, user_content).await;

    let (content, gaps, questions, verdict) = match result {
        Ok(text) => {
            let upper = text.to_uppercase();
            let verdict = if upper.contains("VERDICT: BLOCKED") { "BLOCKED" }
                else if upper.contains("VERDICT: NEEDS_INPUT") { "NEEDS_INPUT" }
                else if upper.contains("[GAP-") { "NEEDS_INPUT" }
                else { "COMPLETE" };
            let gaps: Vec<String> = text.lines()
                .filter(|l| l.contains("[GAP-"))
                .map(|l| l.trim().to_string())
                .collect();
            let questions: Vec<String> = text.lines()
                .filter(|l| l.trim().starts_with("QUESTION:"))
                .map(|l| l.trim_start_matches("QUESTION:").trim().to_string())
                .collect();
            (text, gaps, questions, verdict.to_string())
        }
        Err(e) => (format!("## Agent Failed\n\nError: {e}\n\n### Gaps\nNONE\n\n### Questions\nNONE\n\n### Agent verdict\nVERDICT: BLOCKED\nCONFIDENCE: LOW\nREASON: Agent call failed.", ), vec![], vec![], "BLOCKED".to_string())
    };

    let output = SpecAgentOutput {
        agent_id: agent_id.to_string(),
        role: role.to_string(),
        group,
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

// ── Domain detection helper ──────────────────────────────────────────────────
fn detect_domains(product_direction: &str) -> Vec<String> {
    let lower = product_direction.to_lowercase();
    let mut domains = vec![];
    if lower.contains("game") || lower.contains("gaming") || lower.contains("multiplayer")
        || lower.contains("leaderboard") || lower.contains("level") || lower.contains("player") {
        domains.push("gaming".to_string());
    }
    if lower.contains("ai") || lower.contains("llm") || lower.contains("machine learning")
        || lower.contains("model") || lower.contains("inference") || lower.contains("neural") {
        domains.push("ai".to_string());
    }
    if lower.contains("marketplace") || lower.contains("seller") || lower.contains("buyer")
        || lower.contains("listing") || lower.contains("ecommerce") || lower.contains("e-commerce") {
        domains.push("marketplace".to_string());
    }
    if lower.contains("iot") || lower.contains("device") || lower.contains("sensor")
        || lower.contains("firmware") || lower.contains("hardware") || lower.contains("bluetooth") {
        domains.push("iot".to_string());
    }
    if lower.contains("video") || lower.contains("streaming") || lower.contains("media")
        || lower.contains("content") || lower.contains("podcast") || lower.contains("broadcast") {
        domains.push("media".to_string());
    }
    if lower.contains("fintech") || lower.contains("finance") || lower.contains("bank")
        || lower.contains("health") || lower.contains("medical") || lower.contains("hipaa")
        || lower.contains("fca") || lower.contains("regulated") || lower.contains("clinical") {
        domains.push("regulated".to_string());
    }
    domains
}

#[tauri::command]
pub async fn run_spec_council(
    app: AppHandle,
    project_id: String,
    product_direction: String,
    api_keys: SpecApiKeys,
) -> Result<SpecCouncilResult, String> {
    let key = &api_keys.openrouter;

    // Detect DB path from env or use default
    let db = open_db()?;

    let mut outputs: Vec<SpecAgentOutput> = vec![];
    let mut context = product_direction.clone();
    let domains = detect_domains(&product_direction);
    let domain_str = if domains.is_empty() {
        "No specialist domains detected — standard spec applies.".to_string()
    } else {
        format!("Detected domains: {}. Activate relevant domain sections.", domains.join(", "))
    };

    let base_input = format!(
        "PRODUCT DIRECTION DOCUMENT (your primary source material):\n\n{}\n\nDOMAIN DETECTION: {}\n\nCORE RULES:\n- Populate your assigned sections with real, specific content derived from the product direction\n- For any mandatory field the brief does not cover, write: [GAP-XXX]: description — requires user input\n- For questions that must be answered before your section can be finalised, write: QUESTION: your question\n- Never write TBD — use a tracked gap instead\n- Never assume meaning of unknown domain terms — flag them\n- Every requirement must be specific, testable, and unambiguous\n- Reference prior agent outputs in context where relevant",
        product_direction, domain_str
    );

    // ── GROUP 0: Governance ──────────────────────────────────────────────────
    let spec_lead = run_spec_agent(
        "spec_program_lead",
        "Specification Program Lead",
        0,
        vec![0, 1, 28],
        "You are the Specification Program Lead. Your job is to:\n1. Classify the product into domain types (Section 0.1) — mark every row Yes/No, never TBD. Activate all relevant domain sections.\n2. Populate Section 1 fully: document metadata, version history starting at 0.1.0, change control process, glossary of ALL domain-specific terms from the brief (ask for definitions of any unknown acronyms), assumptions, dependencies, constraints, and RAID log with at least 3 risk entries.\n3. Set up Section 28 skeleton: milestone structure and acceptance criteria headings only — downstream agents will populate details.\n4. Produce a spec plan noting which sections are highest priority given the domain type.",
        &base_input, key, &app, &project_id,
    ).await;
    context = format!("{}\n\n## [GROUP 0] Specification Program Lead:\n{}", context, spec_lead.content);
    outputs.push(spec_lead);

    // ── GROUP 1: Product & Requirements ──────────────────────────────────────
    let pm = run_spec_agent(
        "product_manager_spec",
        "Product Manager",
        1,
        vec![2, 3],
        "You are the Product Manager. You must:\n- Populate Section 2 fully: executive summary in plain language (who/what/why), problem statement with quantified evidence where available, proposed solution at outcome level, business objectives with SMART KPIs and timeframes, success criteria (functional/performance/security/accessibility/commercial), explicit out-of-scope items and anti-goals, roadmap considerations.\n- Populate Section 3: stakeholder register with all roles (names as TBD is acceptable), RACI matrix for all key decisions.\n- Draft Section 28.1 milestone structure with all standard milestones.\nEvery objective must have a KPI, baseline, target, and timeframe.",
        &format!("{}\n\nContext so far:\n{}", base_input, context), key, &app, &project_id,
    ).await;
    context = format!("{}\n\n## [GROUP 1] Product Manager:\n{}", context, pm.content);
    outputs.push(pm);

    let ba = run_spec_agent(
        "business_analyst_spec",
        "Business Analyst",
        1,
        vec![4, 8],
        "You are the Business Analyst. You must:\n- Write minimum 8 user stories. Format: ID (US-001 etc), As a [role] / I want [goal] / So that [benefit]. For each: minimum 3 specific testable acceptance criteria, MoSCoW priority, edge cases, error conditions. Every story must reference a Section 2 objective.\n- Produce a screen inventory (Section 8.1): list every screen implied by the user stories with Screen ID, name, primary persona, and status.\n- Define the Definition of Done (Section 28.3) — every item must be binary pass/fail.\n- Define business rules and state transitions unambiguously.",
        &format!("{}\n\nContext so far:\n{}", base_input, context), key, &app, &project_id,
    ).await;
    context = format!("{}\n\n## [GROUP 1] Business Analyst:\n{}", context, ba.content);
    outputs.push(ba);

    // ── GROUP 2: Research & Insights ─────────────────────────────────────────
    let ux_researcher = run_spec_agent(
        "ux_researcher_spec",
        "UX Researcher",
        2,
        vec![4],
        "You are the UX Researcher. You must:\n- Write a research summary: methodology, sample assumptions, key findings, limitations.\n- Produce minimum 2 detailed personas: name, archetype, goals, pain points, key tasks (3-5), accessibility needs, tech proficiency, frequency of use.\n- Produce a user journey map for the primary persona covering first-time use AND repeat use: stages, actions, emotions, friction points, opportunities, channels.\n- Flag any assumptions that would require real user research to validate.",
        &format!("{}\n\nContext so far:\n{}", base_input, context), key, &app, &project_id,
    ).await;
    context = format!("{}\n\n## [GROUP 2] UX Researcher:\n{}", context, ux_researcher.content);
    outputs.push(ux_researcher);

    let insights = run_spec_agent(
        "insights_analyst_spec",
        "Product Insights Analyst",
        2,
        vec![4, 19],
        "You are the Product Insights Analyst. You must:\n- Produce a competitive analysis: minimum 3 direct competitors, 2 indirect competitors, key differentiators, feature gap analysis.\n- Define how each KPI from Section 2.4 will be measured: data source, calculation method, frequency.\n- Identify baseline metrics inferable from the product domain.\n- Define the analytics measurement plan that proves or disproves success criteria.\n- Flag any metrics that cannot be measured without additional tooling.",
        &format!("{}\n\nContext so far:\n{}", base_input, context), key, &app, &project_id,
    ).await;
    context = format!("{}\n\n## [GROUP 2] Insights Analyst:\n{}", context, insights.content);
    outputs.push(insights);

    // ── GROUP 3: Design & Experience ─────────────────────────────────────────
    let designer = run_spec_agent(
        "product_designer_spec",
        "Product Designer",
        3,
        vec![7, 8],
        "You are the Product Designer. You must:\n- Define the information architecture and navigation model (Section 7.8): app map, primary navigation pattern, back/breadcrumb behaviour, deep link scheme.\n- Populate Section 8.2 with screen specs for every screen in the inventory: for each screen define all required states (loading/empty/populated/error/offline/permission denied/session expired/first-time), user interactions, form validation rules, data display rules, analytics events fired. Write [WIREFRAME REQUIRED] for wireframe links.\n- Define interaction design standards (Section 7.6): animation durations, easing, reduced motion behaviour, loading patterns, toast patterns, confirmation dialog patterns.",
        &format!("{}\n\nContext so far:\n{}", base_input, context), key, &app, &project_id,
    ).await;
    context = format!("{}\n\n## [GROUP 3] Product Designer:\n{}", context, designer.content);
    outputs.push(designer);

    let design_system = run_spec_agent(
        "design_system_spec",
        "Design System Designer",
        3,
        vec![7],
        "You are the Design System Designer. You must:\n- Define brand assets (Section 7.1): logo variant rules, app icon specs, voice/tone, copy style guide.\n- Define all colour tokens (Section 7.2): token name, hex value, usage, WCAG contrast requirement. Every token must have a contrast check.\n- Define typography scale (Section 7.3): font, size, weight, line height for every text role.\n- Define spacing and grid (Section 7.4): base unit, spacing scale, grid columns, gutter, container max-width.\n- Define component library (Section 7.5): for every component — variants, all states (default/hover/focus/active/loading/disabled/error), ARIA role, keyboard interactions, responsive behaviour.\n- Define dark mode token mapping if applicable (Section 7.7).",
        &format!("{}\n\nContext so far:\n{}", base_input, context), key, &app, &project_id,
    ).await;
    context = format!("{}\n\n## [GROUP 3] Design System Designer:\n{}", context, design_system.content);
    outputs.push(design_system);

    let ux_writer = run_spec_agent(
        "ux_writer_spec",
        "UX Writer",
        3,
        vec![7, 20],
        "You are the UX Writer. You must:\n- Define product voice and tone (Section 7.1 additions): how the product speaks in errors, empty states, onboarding, confirmations, and destructive actions — with actual example copy, not descriptions.\n- Populate Section 20.2 error message standards with actual copy patterns for every error type: network failure, server error, validation error, auth expired, permission denied.\n- Define microcopy standards: capitalisation rules, punctuation, formatting, placeholders, units, date/time display format.\n- Draft notification copy patterns for Section 13 if notifications are in scope.\n- Ensure all copy is consistent with persona language and accessible (clear language, supports screen readers).",
        &format!("{}\n\nContext so far:\n{}", base_input, context), key, &app, &project_id,
    ).await;
    context = format!("{}\n\n## [GROUP 3] UX Writer:\n{}", context, ux_writer.content);
    outputs.push(ux_writer);

    // ── GROUP 4: Engineering & Architecture ──────────────────────────────────
    let architect = run_spec_agent(
        "solution_architect_spec",
        "Solution Architect",
        4,
        vec![5, 6],
        "You are the Solution Architect. You must:\n- Populate Section 5.1: mark every platform In Scope / Out of Scope / Future with minimum version.\n- Populate Section 6.1: chosen architectural pattern with rationale, component diagram in text form.\n- Populate Section 6.2 technology stack: every layer must have a specific technology and rationale.\n- Populate Section 6.3 environment model: all 6 environments (dev/int/stg/uat/prd/dr) with access controls and data policy.\n- Write minimum 3 ADRs (Section 6.4): context, options considered (minimum 2 per ADR), decision made, consequences.\n- Populate Section 6.5 integration map: every external system with auth method, rate limits, SLA, failure mode, retry strategy.\n- Define reliability targets (Section 15.5): uptime SLA, RTO, RPO.",
        &format!("{}\n\nContext so far:\n{}", base_input, context), key, &app, &project_id,
    ).await;
    context = format!("{}\n\n## [GROUP 4] Solution Architect:\n{}", context, architect.content);
    outputs.push(architect);

    let backend = run_spec_agent(
        "backend_lead_spec",
        "Backend Lead",
        4,
        vec![9, 11, 20],
        "You are the Backend Lead Engineer. You must:\n- Populate Section 9 fully: all auth methods with rationale, password policy (length/complexity/hashing/breach check), session management (token type/storage/expiry/rotation/logout), roles and full permissions matrix, multi-tenancy model if applicable.\n- Populate Section 11 fully: API style and versioning, pagination approach, rate limiting table per endpoint group, status code usage policy, standard error schema, endpoint register listing every endpoint implied by user stories (minimum 10).\n- Define error handling philosophy (Section 20.1) and error boundary strategy (Section 20.3).\n- Define audit logging requirements for every security-relevant event.",
        &format!("{}\n\nContext so far:\n{}", base_input, context), key, &app, &project_id,
    ).await;
    context = format!("{}\n\n## [GROUP 4] Backend Lead:\n{}", context, backend.content);
    outputs.push(backend);

    let frontend = run_spec_agent(
        "frontend_lead_spec",
        "Frontend Lead",
        4,
        vec![6, 15],
        "You are the Frontend Lead Engineer. You must:\n- Define frontend architecture: routing strategy, state management approach, data fetching and caching strategy, code splitting.\n- Define web requirements (Section 5.2): browser support matrix with minimum versions, responsive breakpoints, SEO requirements if applicable, PWA manifest if applicable.\n- Define performance budgets (Section 15.1): LCP target, INP target, CLS target, JS bundle size budget.\n- Define error boundary implementation (aligns with Section 20.3).\n- Define client-side vs server-side validation responsibilities.\n- Define analytics instrumentation approach on the client.\n- Define accessibility implementation: keyboard support, focus management, ARIA adherence approach.",
        &format!("{}\n\nContext so far:\n{}", base_input, context), key, &app, &project_id,
    ).await;
    context = format!("{}\n\n## [GROUP 4] Frontend Lead:\n{}", context, frontend.content);
    outputs.push(frontend);

    let mobile = run_spec_agent(
        "mobile_lead_spec",
        "Mobile Lead",
        4,
        vec![5, 14, 15],
        "You are the Mobile Lead Engineer. Check Section 5.1 to determine if mobile is in scope. If mobile is NOT in scope, output: VERDICT: COMPLETE — mobile not in scope per Section 5.1. If mobile IS in scope you must:\n- Populate Section 5.3: minimum OS versions (iOS/Android), app store requirements, device permissions and usage descriptions, push notification entitlements, device testing matrix (list specific devices), gesture navigation compatibility.\n- Define offline constraints and sync approach (Section 14) for mobile.\n- Define mobile performance targets (Section 15.3): cold start, screen transition, scroll performance, battery impact.\n- Define store compliance requirements: privacy prompts, categories, age rating requirements.",
        &format!("{}\n\nContext so far:\n{}", base_input, context), key, &app, &project_id,
    ).await;
    context = format!("{}\n\n## [GROUP 4] Mobile Lead:\n{}", context, mobile.content);
    outputs.push(mobile);

    let desktop = run_spec_agent(
        "desktop_lead_spec",
        "Desktop Lead",
        4,
        vec![5, 14],
        "You are the Desktop Lead Engineer. Check Section 5.1 to determine if desktop is in scope. If desktop is NOT in scope, output: VERDICT: COMPLETE — desktop not in scope per Section 5.1. If desktop IS in scope you must:\n- Populate Section 5.4: minimum OS and architecture (x64/ARM), installation and update method (MSIX/MSI/DMG/Store), code signing and notarisation requirements, local storage paths and permission model, multi-monitor and DPI scaling behaviour, offline mode constraints, system tray/dock/startup behaviour if applicable.\n- Define offline behaviour and local sync approach (Section 14) for desktop.",
        &format!("{}\n\nContext so far:\n{}", base_input, context), key, &app, &project_id,
    ).await;
    context = format!("{}\n\n## [GROUP 4] Desktop Lead:\n{}", context, desktop.content);
    outputs.push(desktop);

    // ── GROUP 5: Data & Analytics ─────────────────────────────────────────────
    let data_architect = run_spec_agent(
        "data_architect_spec",
        "Data Architect",
        5,
        vec![10],
        "You are the Data Architect. You must:\n- Define every entity/table implied by the user stories and screen specs. Every entity from Section 4.5 must appear here — missing entities are a BLOCKED gap.\n- For each entity: full field specifications (name, type, nullability, default, rules), indexes, soft-delete approach.\n- Define relationships: FK constraints, cascade rules, uniqueness constraints.\n- Define validation rules at the data layer: email, phone, currency, dates, domain-specific.\n- Define retention and lifecycle (Section 10.5): retention period per data type, backup frequency, erasure method.\n- Define migration strategy if applicable (Section 10.6).\n- Define audit log data requirements and immutability needs.",
        &format!("{}\n\nContext so far:\n{}", base_input, context), key, &app, &project_id,
    ).await;
    context = format!("{}\n\n## [GROUP 5] Data Architect:\n{}", context, data_architect.content);
    outputs.push(data_architect);

    let analytics = run_spec_agent(
        "analytics_engineer_spec",
        "Analytics Engineer",
        5,
        vec![19],
        "You are the Analytics Engineer. You must:\n- Define analytics strategy (Section 19.1): provider, identity model (anonymous → authenticated → group), data retention, privacy compliance approach.\n- Populate the event tracking register (Section 19.2) with minimum 15 events covering: app lifecycle, auth, core feature interactions, errors, and all success criteria measurement points. Every event must have: name, trigger, key properties, required flag.\n- Define monitoring tooling (Section 19.3): one specific tool per layer (infrastructure, APM, frontend RUM, logs, uptime).\n- Define alerting rules (Section 19.4): minimum 5 alerts with condition, severity, and escalation path.\n- Every KPI from Section 2.4 must have at least one event feeding it — flag missing coverage as a gap.",
        &format!("{}\n\nContext so far:\n{}", base_input, context), key, &app, &project_id,
    ).await;
    context = format!("{}\n\n## [GROUP 5] Analytics Engineer:\n{}", context, analytics.content);
    outputs.push(analytics);

    // ── GROUP 6: Security & Privacy ───────────────────────────────────────────
    let security = run_spec_agent(
        "security_architect_spec",
        "Security Architect",
        6,
        vec![16],
        "You are the Security Architect. You must:\n- Define security standards (Section 16.1): OWASP ASVS level, pen test requirement and frequency, vulnerability scanning tooling and frequency.\n- Complete the OWASP Top 10 controls table (Section 16.2): every row must have a specific, testable control — vague statements like 'use encryption' are not acceptable.\n- Define security headers (Section 16.3): CSP policy content, HSTS max-age, X-Frame-Options value, Referrer-Policy value.\n- Define encryption (Section 16.4): TLS minimum version, at-rest algorithm and key length, key management provider and rotation frequency, secrets management approach (no secrets in code).\n- Populate audit logging table (Section 16.5): every security-relevant event with fields logged, retention period, redaction rules.\n- Define incident response (Section 16.6): severity model with precise definitions, response SLA per severity, on-call approach, communication plan.",
        &format!("{}\n\nContext so far:\n{}", base_input, context), key, &app, &project_id,
    ).await;
    context = format!("{}\n\n## [GROUP 6] Security Architect:\n{}", context, security.content);
    outputs.push(security);

    let privacy = run_spec_agent(
        "privacy_lead_spec",
        "Privacy Lead",
        6,
        vec![23],
        "You are the Privacy Lead. You must:\n- Identify all applicable regulations (Section 23.1): for every regulation in the table mark Yes/No based on product geography, user base, and features — never leave a row as TBD.\n- Define privacy requirements (Section 23.2): privacy policy requirement, cookie consent mechanism, lawful basis for every data category from Section 10, DSAR process and SLA, erasure process, data export process, sub-processor register.\n- Review the analytics plan and logging requirements for privacy risk — flag any events collecting PII without lawful basis.\n- Define vendor/data processor requirements: DPAs, sub-processors, data locations.",
        &format!("{}\n\nContext so far:\n{}", base_input, context), key, &app, &project_id,
    ).await;
    context = format!("{}\n\n## [GROUP 6] Privacy Lead:\n{}", context, privacy.content);
    outputs.push(privacy);

    // ── GROUP 7: Quality Engineering ─────────────────────────────────────────
    let qa = run_spec_agent(
        "qa_lead_spec",
        "QA Lead",
        7,
        vec![21, 28],
        "You are the QA Lead. You must:\n- Define the test strategy (Section 21.1): test pyramid with specific % targets, testing frameworks per layer, test environments needed.\n- Define coverage targets (Section 21.2): specific numeric % per layer with CI gate enforcement — 'comprehensive' is not acceptable.\n- Define test data policy (Section 21.3): no production PII rule, fixture/factory approach, data reset strategy, seed data for E2E.\n- Define quality gates (Section 21.4): every gate must be binary pass/fail with no ambiguity.\n- Define bug severity taxonomy (Section 21.5): each level with precise definition, response SLA, and release blocker status.\n- Populate Section 28.2 acceptance criteria — every criterion must be independently verifiable.\n- Every acceptance criterion from Section 4.5 must map to a named test approach.",
        &format!("{}\n\nContext so far:\n{}", base_input, context), key, &app, &project_id,
    ).await;
    context = format!("{}\n\n## [GROUP 7] QA Lead:\n{}", context, qa.content);
    outputs.push(qa);

    let a11y = run_spec_agent(
        "accessibility_spec",
        "Accessibility Specialist",
        7,
        vec![17],
        "You are the Accessibility Specialist. You must:\n- Define the target standard (Section 17.1): WCAG 2.2 AA minimum, aspirational AAA for core flows.\n- Populate the WCAG compliance checklist (Section 17.2): list specific WCAG criteria that apply to this product under Perceivable / Operable / Understandable / Robust.\n- Define screen reader requirements (Section 17.3): only populate platforms that are in scope per Section 5.1. For each: which screen reader, test priority.\n- Define keyboard navigation requirements (Section 17.4): all interactive elements reachable, focus order, focus indicator, no keyboard traps.\n- Define remediation SLAs (Section 17.5) with precise severity definitions.\n- Review the screen specs from Section 8.2 and flag any accessibility issues found.",
        &format!("{}\n\nContext so far:\n{}", base_input, context), key, &app, &project_id,
    ).await;
    context = format!("{}\n\n## [GROUP 7] Accessibility Specialist:\n{}", context, a11y.content);
    outputs.push(a11y);

    // ── GROUP 8: Operations & Release ─────────────────────────────────────────
    let devops = run_spec_agent(
        "devops_spec",
        "DevOps / SRE",
        8,
        vec![15, 22],
        "You are the DevOps/SRE Engineer. You must:\n- Define load and scalability targets (Section 15.4): peak concurrent users, DAU, data volume projections, horizontal scaling approach.\n- Populate Section 22 fully: version control strategy and branching model, PR requirements, pipeline stages (each with trigger/steps/gate condition — 'run tests' is not specific enough), mobile release process if mobile is in scope (Section 22.3), rollback strategy and feature flag approach (Section 22.4).\n- Define monitoring implementation (aligns with Section 19.3): how monitoring is provisioned, health check endpoints, readiness/liveness probes.\n- Define backup/restore approach and DR requirements aligned with Section 15.5 RTO/RPO.",
        &format!("{}\n\nContext so far:\n{}", base_input, context), key, &app, &project_id,
    ).await;
    context = format!("{}\n\n## [GROUP 8] DevOps/SRE:\n{}", context, devops.content);
    outputs.push(devops);

    let release_mgr = run_spec_agent(
        "release_manager_spec",
        "Release Manager",
        8,
        vec![22, 28],
        "You are the Release Manager. You must:\n- Define the rollout strategy (Section 22.4): canary/blue-green/rolling with rationale, feature flag usage, automated rollback triggers, manual rollback runbook.\n- Populate Section 28.1 milestones fully: every standard milestone (Spec Locked / Architecture Review / MVP Complete / QA Sign-off / Security Sign-off / Production Launch) plus any product-specific milestones, each with description and owner role.\n- Define go/no-go criteria: what must be true before production deployment — each criterion binary.\n- Define staged rollout plan: % of users per stage, success criteria to proceed, rollback trigger per stage.\n- Define release notes format and versioning alignment with spec versions.",
        &format!("{}\n\nContext so far:\n{}", base_input, context), key, &app, &project_id,
    ).await;
    context = format!("{}\n\n## [GROUP 8] Release Manager:\n{}", context, release_mgr.content);
    outputs.push(release_mgr);

    // ── GROUP 9: Legal & Compliance ───────────────────────────────────────────
    let legal = run_spec_agent(
        "product_counsel_spec",
        "Product Counsel",
        9,
        vec![23, 27],
        "You are the Product Counsel. You must:\n- Review the regulations from Section 23.1 and add feature-level legal risk flags — reference specific user stories (US-XXX) that create regulatory exposure.\n- Define IP and licensing requirements (Section 23.3): open-source audit obligations, licence compatibility check (GPL/MIT/Apache/proprietary conflicts), font licensing, image/media licensing, UGC ownership model.\n- Define feature-specific legal requirements (Section 23.4): required disclaimers, claims needing legal review, ToS requirements, consent language requirements.\n- Define documentation deliverables (Section 27.3): every required document with owner role, target audience, and format.\n- Flag any feature that creates legal risk with severity (HIGH/MEDIUM/LOW) and recommended mitigation.",
        &format!("{}\n\nContext so far:\n{}", base_input, context), key, &app, &project_id,
    ).await;
    context = format!("{}\n\n## [GROUP 9] Product Counsel:\n{}", context, legal.content);
    outputs.push(legal);

    // ── GROUP 10: Domain Specialists (Conditional) ────────────────────────────
    if domains.contains(&"gaming".to_string()) {
        let game_designer = run_spec_agent(
            "game_designer_spec",
            "Game Designer",
            10,
            vec![30],
            "You are the Game Designer. The product has been classified as a gaming application. You must populate Section 30 fully:\n- Core loop: step-by-step description of what the player does each session\n- Progression system: specific mechanics (XP values, level thresholds, prestige conditions)\n- Monetisation model: all IAP types with pricing tier approach, loot box probability disclosure requirements by jurisdiction, ad format constraints\n- Multiplayer: matchmaking algorithm, tick rate target, maximum acceptable latency, anti-cheat approach\n- Leaderboards: all types, update frequency, tie-breaking rules\n- Save state: cloud save provider, sync conflict resolution, save slot count\n- Platform store requirements: fully populated table for every in-scope platform\n- Game analytics: D1/D7/D30 retention targets, ARPU/ARPPU targets, funnel event list\n- Gaming accessibility: colourblind modes, subtitle requirements, input remapping, photosensitivity warning requirements",
            &format!("{}\n\nContext so far:\n{}", base_input, context), key, &app, &project_id,
        ).await;
        context = format!("{}\n\n## [GROUP 10] Game Designer:\n{}", context, game_designer.content);
        outputs.push(game_designer);
    }

    if domains.contains(&"ai".to_string()) {
        let ai_arch = run_spec_agent(
            "ai_ml_architect_spec",
            "AI/ML Architect",
            10,
            vec![31],
            "You are the AI/ML Architect. The product has been classified as an AI-native application. You must populate Section 31 fully:\n- Model architecture: type(s), provider, versioning strategy, model registry approach\n- Inference requirements: latency target, throughput, cost ceiling per inference, batching strategy, streaming output approach\n- Prompt management: versioning system, injection prevention techniques, token budget per request\n- AI safety and quality: hallucination detection approach, output validation, harmful content filtering, human-in-the-loop requirements, fallback strategy when model unavailable\n- Data and training: data source consent model, bias assessment approach, evaluation metrics, retraining cadence\n- AI regulatory compliance: EU AI Act classification (minimal/limited/high/unacceptable risk), transparency disclosure requirements, right to human review, AI decision audit trail",
            &format!("{}\n\nContext so far:\n{}", base_input, context), key, &app, &project_id,
        ).await;
        context = format!("{}\n\n## [GROUP 10] AI/ML Architect:\n{}", context, ai_arch.content);
        outputs.push(ai_arch);
    }

    if domains.contains(&"marketplace".to_string()) {
        let marketplace = run_spec_agent(
            "marketplace_architect_spec",
            "Marketplace Architect",
            10,
            vec![32],
            "You are the Marketplace Architect. The product has been classified as a marketplace. You must populate Section 32 fully:\n- Marketplace model: type (B2C/B2B/C2C/multi-sided), listing approach, seller onboarding flow\n- Transaction and trust: escrow model, dispute resolution process, buyer protection policy, seller rating system, fraud detection approach\n- Catalogue and inventory: product data model, variant handling (size/colour/SKU), inventory management, search and discovery\n- Fulfilment: delivery methods, shipping integrations, digital delivery approach, returns/refund flow\n- Revenue model: commission rate, listing fees, premium seller tiers, payout schedule and method",
            &format!("{}\n\nContext so far:\n{}", base_input, context), key, &app, &project_id,
        ).await;
        context = format!("{}\n\n## [GROUP 10] Marketplace Architect:\n{}", context, marketplace.content);
        outputs.push(marketplace);
    }

    if domains.contains(&"iot".to_string()) {
        let iot = run_spec_agent(
            "iot_architect_spec",
            "IoT Architect",
            10,
            vec![33],
            "You are the IoT Architect. The product has been classified as an IoT/hardware application. You must populate Section 33 fully:\n- Hardware specification: devices in scope, firmware version constraints, connectivity protocols (BLE/WiFi/Zigbee/MQTT), power constraints\n- Device management: pairing/provisioning flow, OTA firmware update process, device health monitoring, offline device behaviour, multiple devices per user\n- Data pipeline: telemetry frequency, edge vs cloud processing decision, time-series storage requirements, alert/threshold rules\n- Safety and compliance: hardware safety standards required (CE/FCC/UL), data sovereignty for device data, end-of-life/decommissioning process",
            &format!("{}\n\nContext so far:\n{}", base_input, context), key, &app, &project_id,
        ).await;
        context = format!("{}\n\n## [GROUP 10] IoT Architect:\n{}", context, iot.content);
        outputs.push(iot);
    }

    if domains.contains(&"media".to_string()) {
        let media = run_spec_agent(
            "media_architect_spec",
            "Media Platform Architect",
            10,
            vec![34],
            "You are the Media Platform Architect. The product has been classified as a media/content platform. You must populate Section 34 fully:\n- Content model: content types, taxonomy and tagging, editorial vs UGC approach, content lifecycle (draft/review/published/archived)\n- Media delivery: streaming protocol (HLS/DASH/WebRTC), adaptive bitrate approach, DRM requirements (Widevine/FairPlay/PlayReady), transcoding pipeline, thumbnail/preview generation\n- Content moderation: pre-publication review approach (automated/human/hybrid), automated scanning (CSAM/copyright/hate speech), user reporting flow, takedown SLA, appeals process\n- Rights management: copyright detection approach, licensing terms for uploaded content, DMCA/takedown compliance, geo-restriction requirements",
            &format!("{}\n\nContext so far:\n{}", base_input, context), key, &app, &project_id,
        ).await;
        context = format!("{}\n\n## [GROUP 10] Media Architect:\n{}", context, media.content);
        outputs.push(media);
    }

    if domains.contains(&"regulated".to_string()) {
        let regulated = run_spec_agent(
            "regulated_industry_spec",
            "Regulated Industry Specialist",
            10,
            vec![35],
            "You are the Regulated Industry Specialist. The product has been classified as operating in a regulated industry. You must populate Section 35 for all applicable domains:\n- Financial services (if applicable): regulatory authorisation required (FCA/SEC/MAS), consumer duty obligations, financial promotions approval process, AML/KYC requirements, suitability assessment requirements\n- Healthcare (if applicable): HIPAA BAA requirement, CE marking/FDA clearance, clinical evidence requirements, PHI handling requirements, audit trail for clinical data\n- Legal/professional services (if applicable): regulated activity scope, professional indemnity requirements, document retention for legal purposes, e-signature compliance (eIDAS/ESIGN)\nOnly populate subsections for in-scope regulated domains.",
            &format!("{}\n\nContext so far:\n{}", base_input, context), key, &app, &project_id,
        ).await;
        context = format!("{}\n\n## [GROUP 10] Regulated Industry Specialist:\n{}", context, regulated.content);
        outputs.push(regulated);
    }

    // ── GROUP 11: Final Editorial Pass ────────────────────────────────────────
    let editor = run_spec_agent(
        "editor_in_chief",
        "Editor-in-Chief (Final Pass)",
        11,
        vec![1, 28],
        "You are the Editor-in-Chief doing the final pass on the complete specification. You must:\n1. Check every section for compliance with the structured output format — list any non-compliant sections.\n2. Resolve contradictions between sections — document each resolution.\n3. Ensure every requirement is testable and verifiable — flag any that are not.\n4. Ensure every GAP has an ID and description.\n5. Ensure no BLOCKED gaps remain without an explicit owner.\n6. Check terminology consistency across all sections — flag inconsistencies.\n7. Produce a final spec completeness report in this exact format:\n\n## SPECIFICATION COMPLETENESS REPORT\n\nSections reviewed: [N]\nSections COMPLETE: [N]\nSections NEEDS_INPUT: [N]\nSections BLOCKED: [N]\nTotal gaps: [N]\nTotal questions for user: [N]\nDomain sections activated: [list or NONE]\nOverall verdict: READY_FOR_REVIEW | NEEDS_INPUT | BLOCKED\n\n## CONSOLIDATED QUESTIONS FOR USER\n[List every QUESTION from all sections, numbered]\n\n## CRITICAL ISSUES\n[List any BLOCKED items or critical contradictions]\n\n## EDITORIAL NOTES\n[List any format compliance issues or terminology inconsistencies found]",
        &format!("{}\n\nCOMPLETE SPEC CONTEXT FOR REVIEW:\n{}", base_input, context), key, &app, &project_id,
    ).await;
    outputs.push(editor.clone());

    // ── Assemble full specification ────────────────────────────────────────────
    let domain_header = if domains.is_empty() {
        "Standard".to_string()
    } else {
        domains.iter().map(|d| {
            let mut c = d.chars();
            match c.next() {
                None => String::new(),
                Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
            }
        }).collect::<Vec<_>>().join(", ")
    };

    let mut assembled = format!(
        "# Product Specification\n**Version:** 0.1.0\n**Status:** Draft — Awaiting User Review\n**Project:** {}\n**Domain(s):** {}\n**Agents:** {} ({} domain specialists)\n\n---\n\n",
        project_id,
        domain_header,
        outputs.len(),
        domains.len(),
    );

    for output in &outputs {
        assembled.push_str(&format!("<!-- Agent: {} | Group: {} | Verdict: {} -->\n", output.agent_id, output.group, output.verdict));
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
