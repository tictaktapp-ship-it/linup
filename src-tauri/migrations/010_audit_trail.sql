CREATE TABLE IF NOT EXISTS audit_trail (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    stage_index INTEGER NOT NULL,
    approved_by TEXT NOT NULL,
    approved_at TEXT NOT NULL,
    artifact_ids TEXT,
    gate_summary TEXT,
    snapshot_name TEXT
);