CREATE TABLE IF NOT EXISTS secrets_wizard_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    secret_key TEXT NOT NULL,
    validated INTEGER NOT NULL DEFAULT 0,
    saved_to_keychain INTEGER NOT NULL DEFAULT 0,
    skipped INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    UNIQUE(project_id, secret_key)
);