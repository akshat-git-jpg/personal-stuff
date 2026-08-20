-- gym-app D1 schema. Replaces the "Exercises - AppSheet" Google Sheet.
--
-- IDEMPOTENT BY CONTRACT: every statement here is CREATE ... IF NOT EXISTS, so
-- `npm run db:local` / `db:remote` can be re-run safely on an existing
-- database. Never put a bare ALTER TABLE in this file -- it fails on the second
-- run and turns a routine re-apply into an error (this happened with the `gym`
-- column, which is now declared inline below). One-off data changes belong in
-- migrations/, which is applied by hand once.
--
-- `tab` exists so a group keeps its display order and can be EMPTY (deriving
-- groups from the exercise table would make an emptied group vanish).
-- `exercise.tab` is kept as the group key so the /api surface is unchanged.

CREATE TABLE IF NOT EXISTS tab (
  name     TEXT PRIMARY KEY,
  position INTEGER NOT NULL DEFAULT 0,
  is_mixed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS exercise (
  id           TEXT PRIMARY KEY,
  tab          TEXT NOT NULL REFERENCES tab(name),
  name         TEXT NOT NULL DEFAULT '',
  setting      TEXT NOT NULL DEFAULT '',
  sets_reps    TEXT NOT NULL DEFAULT '',
  notes        TEXT NOT NULL DEFAULT '',
  muscle_group TEXT,
  position     INTEGER NOT NULL DEFAULT 0,
  -- Which gym an exercise belongs to. Previously inferred from the tab NAME and
  -- the ID prefix in two different client helpers; now stated by the data.
  gym          TEXT NOT NULL DEFAULT 'main'
);
CREATE INDEX IF NOT EXISTS idx_exercise_tab_pos ON exercise(tab, position);

-- One row per logged set. `id` is the real key: editing one set no longer
-- rewrites the whole history, which is what the sheet had to do.
CREATE TABLE IF NOT EXISTS log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ts           TEXT NOT NULL,
  exercise_id  TEXT NOT NULL,
  exercise     TEXT NOT NULL DEFAULT '',
  muscle_group TEXT NOT NULL DEFAULT '',
  set_no       INTEGER NOT NULL DEFAULT 0,
  weight       REAL NOT NULL DEFAULT 0,
  reps         INTEGER NOT NULL DEFAULT 0,
  notes        TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_log_ts ON log(ts DESC);
CREATE INDEX IF NOT EXISTS idx_log_exercise ON log(exercise_id, ts DESC);

-- The week plan. One row per (day, exercise). `day` is Sunday-based to match
-- JS Date.getDay(); the UI displays Monday first.
-- No sets/reps column on purpose: the value is shared with the catalogue
-- (exercise.sets_reps), which is the behaviour the owner approved.
CREATE TABLE IF NOT EXISTS plan (
  day         INTEGER NOT NULL CHECK (day BETWEEN 0 AND 6),
  exercise_id TEXT NOT NULL REFERENCES exercise(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, exercise_id)
);
CREATE INDEX IF NOT EXISTS idx_plan_day_pos ON plan(day, position);
