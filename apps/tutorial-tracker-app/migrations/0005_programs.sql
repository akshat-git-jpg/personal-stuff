-- The affiliate/external catalogue, replacing the "Affiliate Programs" Google
-- Sheet. One row per tool. Lives in tracker-db (NOT clicks-db: the redirector
-- owns that schema, per apps/redirector/CLAUDE.md, and programs are not its
-- concern).
--
-- Every column the sheet had is represented. The sheet's blank column J is the
-- only one deliberately dropped.

CREATE TABLE IF NOT EXISTS programs (
  slug                  TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,

  -- 'affiliate' = pays commission, must carry an affiliate code.
  -- 'external'  = no programme exists; a plain homepage is CORRECT for these
  --               and must never be reported as a missing-code fault.
  kind                  TEXT NOT NULL DEFAULT 'affiliate',

  target_url            TEXT NOT NULL DEFAULT '',
  network               TEXT NOT NULL DEFAULT 'other',
  approval_status       TEXT NOT NULL DEFAULT 'unknown',

  coupon_status         TEXT NOT NULL DEFAULT 'unknown',
  coupon_code           TEXT NOT NULL DEFAULT '',
  coupon_url            TEXT NOT NULL DEFAULT '',
  coupon_terms          TEXT NOT NULL DEFAULT '',

  dashboard_url         TEXT NOT NULL DEFAULT '',
  -- Plain text, deliberately not masked (owner decision 2026-08-28).
  dashboard_credentials TEXT NOT NULL DEFAULT '',

  notes                 TEXT NOT NULL DEFAULT '',

  -- Guard fields, written by plan 258's cron. Nullable = never checked yet.
  probe_enabled         INTEGER NOT NULL DEFAULT 1,
  last_checked_at       INTEGER,
  last_status           TEXT,
  last_final_url        TEXT,
  previous_final_url    TEXT,

  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL,
  updated_by            TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_programs_kind     ON programs(kind);
CREATE INDEX IF NOT EXISTS idx_programs_approval ON programs(approval_status);
CREATE INDEX IF NOT EXISTS idx_programs_checked  ON programs(last_checked_at);
