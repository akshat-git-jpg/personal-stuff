-- Ledger published by pipelines/personal-finance (`python3 -m ledger.run`).
-- rows/statements/meta are replaced whole on every sync; overrides and rules are
-- the owner's own edits and are never touched by a sync.

CREATE TABLE IF NOT EXISTS rows (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  payee_key TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS rows_date ON rows(date);

CREATE TABLE IF NOT EXISTS statements (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- One row the owner tagged by hand.
CREATE TABLE IF NOT EXISTS overrides (
  row_id TEXT PRIMARY KEY,
  tags TEXT NOT NULL,
  descr TEXT,
  updated_at TEXT NOT NULL
);

-- "Tag every payment to this payee this way."
CREATE TABLE IF NOT EXISTS rules (
  payee_key TEXT PRIMARY KEY,
  tags TEXT NOT NULL,
  descr TEXT,
  payee TEXT,
  created_at TEXT NOT NULL
);
