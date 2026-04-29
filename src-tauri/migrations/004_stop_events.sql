CREATE TABLE IF NOT EXISTS stop_events (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    stage_index INTEGER NOT NULL,
    reason TEXT NOT NULL,
    triggered_at TEXT NOT NULL,
    resolved_at TEXT,
    resolution TEXT
);