CREATE TABLE IF NOT EXISTS exports (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    export_path TEXT NOT NULL,
    created_at TEXT NOT NULL,
    validation_status TEXT,
    validation_time_ms INTEGER
);