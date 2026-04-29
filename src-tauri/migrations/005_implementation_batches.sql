CREATE TABLE IF NOT EXISTS implementation_batches (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    batch_index INTEGER NOT NULL,
    files_touched TEXT,
    status TEXT NOT NULL,
    artifact_id TEXT,
    gate_results TEXT,
    created_at TEXT NOT NULL
);