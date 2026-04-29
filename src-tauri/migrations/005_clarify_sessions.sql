CREATE TABLE IF NOT EXISTS clarify_sessions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    questions TEXT NOT NULL,
    answers TEXT,
    gate_status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);