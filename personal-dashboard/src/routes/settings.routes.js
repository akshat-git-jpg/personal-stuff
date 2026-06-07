import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';
import { getConfig, updateConfig } from '../config.js';
import { getAuthUrl, handleCallback, getTodayEvents, status as calStatus } from '../lib/googleCalendar.js';
import { getTimezone } from '../config.js';

const router = Router();
router.use(requireAuth);

// GET /api/settings
router.get('/', (req, res) => {
  const cfg = getConfig();
  const googleStat = calStatus();
  res.json({
    model: cfg.openrouter_model || 'google/gemini-2.5-flash-lite',
    has_key: !!(cfg.openrouter_key && cfg.openrouter_key.trim()),
    capture_rules_md: cfg.capture_rules_md || '',
    timezone: cfg.timezone || 'Asia/Kolkata',
    dark_mode: !!cfg.dark_mode,
    google: googleStat,
  });
});

// PATCH /api/settings
router.patch('/', (req, res) => {
  const allowed = ['openrouter_model', 'openrouter_key', 'capture_rules_md', 'timezone', 'dark_mode'];
  const patch = {};
  for (const k of allowed) {
    if (k in req.body) {
      patch[k] = k === 'dark_mode' ? (req.body[k] ? 1 : 0) : req.body[k];
    }
  }
  updateConfig(patch);
  const cfg = getConfig();
  const googleStat = calStatus();
  res.json({
    model: cfg.openrouter_model || 'google/gemini-2.5-flash-lite',
    has_key: !!(cfg.openrouter_key && cfg.openrouter_key.trim()),
    capture_rules_md: cfg.capture_rules_md || '',
    timezone: cfg.timezone || 'Asia/Kolkata',
    dark_mode: !!cfg.dark_mode,
    google: googleStat,
  });
});

// GET /api/settings/export — full JSON dump.
router.get('/export', (req, res) => {
  const todos = db.prepare('SELECT * FROM todos').all();
  const habits = db.prepare('SELECT * FROM habits').all();
  const habitLogs = db.prepare('SELECT * FROM habit_logs').all();
  const remembers = db.prepare('SELECT * FROM remembers').all();
  const cfg = getConfig();

  // Strip the password hash and tokens from the export.
  const { password_hash, google_tokens, openrouter_key, ...safeCfg } = cfg;

  res.setHeader('Content-Disposition', 'attachment; filename="dashboard-export.json"');
  res.json({ todos, habits, habit_logs: habitLogs, remembers, config: safeCfg, exported_at: new Date().toISOString() });
});

// GET /api/settings/google/auth — redirect to Google OAuth.
router.get('/google/auth', (req, res) => {
  const url = getAuthUrl();
  res.redirect(url);
});

// GET /api/settings/google/callback — exchange code, save tokens.
router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code');
  try {
    await handleCallback(code);
  } catch (err) {
    console.error('[settings] Google callback error:', err.message);
    return res.redirect('/#settings?google=error');
  }
  res.redirect('/#settings');
});

// POST /api/settings/google/sync — update last-synced time and return today's event count.
router.post('/google/sync', async (req, res) => {
  const tz = getTimezone();
  try {
    const events = await getTodayEvents(tz);
    updateConfig({ calendar_last_synced: new Date().toISOString() });
    res.json({ ok: true, eventCount: events.length, events });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
