CREATE TABLE mec_revenue_events(
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    app_id TEXT NOT NULL,
    gross_amount_pence INTEGER NOT NULL,
    mec_share_pence INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'gbp',
    stripe_payment_intent_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL
);
CREATE TABLE mec_entitlement_log(
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    feature_key TEXT NOT NULL,
    result TEXT NOT NULL,
    plan TEXT NOT NULL,
    checked_at TEXT NOT NULL
);
CREATE TABLE mec_experiments(
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    variants TEXT NOT NULL,
    metric TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    created_at TEXT NOT NULL,
    concluded_at TEXT
);
CREATE TABLE mec_experiment_events(
    id TEXT PRIMARY KEY,
    experiment_id TEXT NOT NULL,
    variant TEXT NOT NULL,
    event_type TEXT NOT NULL,
    revenue_pence INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
);
