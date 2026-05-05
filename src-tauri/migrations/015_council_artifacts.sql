CREATE TABLE IF NOT EXISTS council_artifacts (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    stage_index INTEGER NOT NULL,
    artifact_type TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_run_log (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    stage_index INTEGER NOT NULL,
    agent_id TEXT NOT NULL,
    prompt_version INTEGER NOT NULL DEFAULT 1,
    verdict TEXT NOT NULL,
    output TEXT NOT NULL,
    user_feedback TEXT,
    feedback_comment TEXT,
    created_at TEXT NOT NULL
);