CREATE TABLE IF NOT EXISTS builds (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    platform TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    status TEXT NOT NULL,
    artifact_id TEXT
);