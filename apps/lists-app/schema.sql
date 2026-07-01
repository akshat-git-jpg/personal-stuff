-- lists-app schema. Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS categories (
  id         TEXT    PRIMARY KEY,
  name       TEXT    NOT NULL,
  position   INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  id          TEXT    PRIMARY KEY,
  category_id TEXT    NOT NULL,
  text        TEXT    NOT NULL,
  position    INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_items_category ON items(category_id, position);
