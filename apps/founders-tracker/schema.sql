CREATE TABLE IF NOT EXISTS tasks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT NOT NULL,
  owner        TEXT NOT NULL,
  eta          TEXT,
  notes        TEXT,
  status       TEXT NOT NULL DEFAULT 'open',
  sort_order   INTEGER NOT NULL DEFAULT 0,
  template_id  INTEGER,
  period_key   TEXT,
  created_at   TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS recurring_templates (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  owner      TEXT NOT NULL,
  notes      TEXT,
  cadence    TEXT NOT NULL,
  due_day    INTEGER NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_tasks_template_period
  ON tasks(template_id, period_key) WHERE template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_tasks_owner_status ON tasks(owner, status);

-- One row per kept habit period. `anchor_ymd` is the FIRST day of the period
-- (daily: the day; weekly: that ISO week's Monday), which makes streak maths
-- plain day arithmetic. Absence of a row means the period was not kept.
CREATE TABLE IF NOT EXISTS habit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL,
  anchor_ymd  TEXT NOT NULL,
  done_at     TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_habit_logs_template_anchor
  ON habit_logs(template_id, anchor_ymd);
CREATE INDEX IF NOT EXISTS ix_habit_logs_template ON habit_logs(template_id);
