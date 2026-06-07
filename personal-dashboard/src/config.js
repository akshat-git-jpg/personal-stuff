import db from './db.js';

// Read the single app config row.
export function getConfig() {
  return db.prepare('SELECT * FROM app WHERE id = 1').get();
}

// Update one or more config columns. Only whitelisted keys are allowed.
const ALLOWED = new Set([
  'password_hash',
  'google_tokens',
  'openrouter_key',
  'openrouter_model',
  'capture_rules_md',
  'timezone',
  'dark_mode',
  'calendar_last_synced',
  'carryover_last_run',
]);

export function updateConfig(patch) {
  const keys = Object.keys(patch).filter((k) => ALLOWED.has(k));
  if (keys.length === 0) return getConfig();
  const setSql = keys.map((k) => `${k} = @${k}`).join(', ');
  const values = {};
  for (const k of keys) values[k] = patch[k];
  db.prepare(`UPDATE app SET ${setSql} WHERE id = 1`).run(values);
  return getConfig();
}

export function getTimezone() {
  return getConfig().timezone || process.env.TZ || 'Asia/Kolkata';
}
