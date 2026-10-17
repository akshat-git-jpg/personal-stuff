-- Base tables, so a fresh local D1 can apply 0002+ (prod already has them; IF NOT EXISTS makes this a no-op there).
CREATE TABLE IF NOT EXISTS pipelines (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
  definition_json TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY, pipeline_id TEXT NOT NULL,
  title TEXT, notes TEXT, description TEXT, category TEXT, subcategory TEXT,
  extra_json TEXT, created_at TEXT, updated_at TEXT, status_since TEXT
);
CREATE TABLE IF NOT EXISTS card_stages (
  card_id TEXT NOT NULL, stage_id TEXT NOT NULL, status TEXT,
  assignee TEXT, reviewer TEXT, work_link TEXT, instruction TEXT, eta TEXT, feedback TEXT,
  extra_json TEXT, status_since TEXT,
  PRIMARY KEY (card_id, stage_id)
);
CREATE TABLE IF NOT EXISTS employees (
  email TEXT NOT NULL, system_id TEXT NOT NULL, name TEXT, role TEXT,
  PRIMARY KEY (email, system_id)
);
CREATE TABLE IF NOT EXISTS assignment_defaults (
  pipeline_id TEXT NOT NULL DEFAULT 'standard', category TEXT NOT NULL,
  subcategory TEXT NOT NULL DEFAULT '', col TEXT NOT NULL, email TEXT NOT NULL,
  PRIMARY KEY (pipeline_id, category, subcategory, col)
);
