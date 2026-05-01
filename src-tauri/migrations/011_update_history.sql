CREATE TABLE update_history (
    id TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    channel TEXT NOT NULL,
    applied_at TEXT NOT NULL,
    status TEXT NOT NULL
);
