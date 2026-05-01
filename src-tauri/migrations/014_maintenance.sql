CREATE TABLE maintenance_runs(
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    run_type TEXT NOT NULL DEFAULT 'dependency_update',
    status TEXT NOT NULL DEFAULT 'pending',
    packages_checked INTEGER,
    vulnerabilities_found INTEGER,
    packages_updated INTEGER,
    artifact_id TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT
);
