-- One row per guard run. Comparison state lives on programs; this is its audit trail.
CREATE TABLE IF NOT EXISTS link_checks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ran_at       INTEGER NOT NULL,
  kind         TEXT NOT NULL,
  checked      INTEGER NOT NULL DEFAULT 0,
  ok_count     INTEGER NOT NULL DEFAULT 0,
  issue_count  INTEGER NOT NULL DEFAULT 0,
  unverifiable INTEGER NOT NULL DEFAULT 0,
  issues_json  TEXT NOT NULL DEFAULT '[]',
  notified     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_link_checks_ran ON link_checks(ran_at DESC);
