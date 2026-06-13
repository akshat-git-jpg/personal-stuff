import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(join(DATA_DIR, 'app.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      notes TEXT,
      deadline TEXT,            -- ISO date (YYYY-MM-DD) or full ISO datetime; null = someday
      time_start TEXT,          -- "HH:MM" optional time block
      time_end TEXT,            -- "HH:MM" optional
      area TEXT,                -- tag/area e.g. zluri, home, health
      priority TEXT,            -- low | normal | high
      is_top3 INTEGER NOT NULL DEFAULT 0,
      done INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      recur_rule TEXT,          -- e.g. daily | weekly | monthly | every:3
      carried_from TEXT,        -- date this was rolled forward from
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      weekdays TEXT NOT NULL,   -- csv of 0-6 (0=Sun..6=Sat), e.g. "1,3,5"
      time_of_day TEXT,         -- "HH:MM" optional
      mode TEXT NOT NULL DEFAULT 'forever', -- forever | fixed
      start_date TEXT,          -- YYYY-MM-DD (fixed)
      end_date TEXT,            -- YYYY-MM-DD (fixed)
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS habit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      habit_id INTEGER NOT NULL,
      date TEXT NOT NULL,       -- YYYY-MM-DD
      done INTEGER NOT NULL DEFAULT 1,
      UNIQUE(habit_id, date),
      FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS remembers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      password_hash TEXT,
      google_tokens TEXT,
      openrouter_key TEXT,
      openrouter_model TEXT,
      capture_rules_md TEXT,
      timezone TEXT,
      dark_mode INTEGER NOT NULL DEFAULT 1,
      calendar_last_synced TEXT,
      carryover_last_run TEXT
    );
  `);

  // Add sort_order to reorderable lists (manual drag-to-reorder).
  // Default 0 → rows tie and fall back to newest-first; once dragged they get
  // explicit 1..N. New items keep 0, so they appear on top until reordered.
  for (const table of ['todos', 'habits', 'remembers', 'notes']) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!cols.some((c) => c.name === 'sort_order')) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`);
    }
  }

  // Add tags column to all four lists. Stored as comma-separated lowercase
  // slugs, e.g. "work,bank". Empty string = no tags.
  for (const table of ['todos', 'habits', 'remembers', 'notes']) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!cols.some((c) => c.name === 'tags')) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN tags TEXT NOT NULL DEFAULT ''`);
    }
  }

  // Seed the single config row on first boot.
  const existing = db.prepare('SELECT id FROM app WHERE id = 1').get();
  if (!existing) {
    const initialPassword = process.env.APP_PASSWORD || 'changeme';
    const hash = bcrypt.hashSync(initialPassword, 10);
    db.prepare(`
      INSERT INTO app (id, password_hash, openrouter_key, openrouter_model, capture_rules_md, timezone, dark_mode)
      VALUES (1, ?, ?, ?, ?, ?, 1)
    `).run(
      hash,
      process.env.OPENROUTER_API_KEY || '',
      process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash-lite',
      defaultCaptureRules(),
      process.env.TZ || 'Asia/Kolkata',
    );
  }
}

function defaultCaptureRules() {
  return [
    '# Capture rules',
    '',
    'These notes guide how my typed/spoken capture is turned into a to-do.',
    'Edit freely — they are sent to the parser as context.',
    '',
    '- Default area for personal errands: `home`.',
    '- Anything about work/Zluri: area `zluri`, priority `high`.',
    '- Mentions of gym, water, sleep, walk, run: area `health`.',
    '- If no time is given, leave the time block empty.',
  ].join('\n');
}

migrate();

export default db;
