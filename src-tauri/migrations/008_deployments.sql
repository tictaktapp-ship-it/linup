CREATE TABLE IF NOT EXISTS deployments (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    target TEXT NOT NULL,
    env TEXT,
    status TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    url TEXT,
    artifact_id TEXT
);