CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    stack_preset TEXT NOT NULL DEFAULT 'supabase-web',
    folder_path TEXT,
    budget_cap REAL NOT NULL DEFAULT 10.0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stage_runs (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id),
    stage_index INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'locked',
    started_at TEXT,
    locked_at TEXT,
    cost_usd REAL NOT NULL DEFAULT 0.0,
    UNIQUE(project_id, stage_index)
);

-- status values: locked | ready | running | awaiting_approval |
--                gate_failed | budget_exceeded | stopped | complete
