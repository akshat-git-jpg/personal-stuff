import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';
import { getTimezone } from '../config.js';
import { todayISO } from '../lib/dates.js';
import { currentStreak, graphSeries, recentConsistency } from '../lib/streaks.js';
import { normalizeTags } from '../lib/tags.js';

const router = Router();
router.use(requireAuth);

// Auto-archive fixed habits whose end_date has passed.
function maybeArchive(habit, tz) {
  if (habit.archived) return habit;
  if (habit.mode === 'fixed' && habit.end_date) {
    const today = todayISO(tz);
    if (habit.end_date < today) {
      db.prepare('UPDATE habits SET archived = 1 WHERE id = ?').run(habit.id);
      return { ...habit, archived: 1 };
    }
  }
  return habit;
}

function logsForHabit(habitId) {
  return db.prepare('SELECT * FROM habit_logs WHERE habit_id = ?').all(habitId);
}

// GET /api/habits
router.get('/', (req, res) => {
  const tz = getTimezone();
  const rows = db.prepare('SELECT * FROM habits WHERE archived = 0 ORDER BY sort_order ASC, id DESC').all();
  const result = rows.map((h) => {
    const updated = maybeArchive(h, tz);
    if (updated.archived) return null; // freshly archived — exclude from active list
    const logs = logsForHabit(h.id);
    return {
      ...updated,
      current_streak: currentStreak(updated, logs, tz),
      inconsistent: recentConsistency(updated, logs, tz).inconsistent,
    };
  }).filter(Boolean);
  res.json(result);
});

// GET /api/habits/archived
router.get('/archived', (req, res) => {
  const tz = getTimezone();
  const rows = db.prepare('SELECT * FROM habits WHERE archived = 1 ORDER BY created_at ASC').all();
  const result = rows.map((h) => {
    const logs = logsForHabit(h.id);
    return { ...h, current_streak: currentStreak(h, logs, tz) };
  });
  res.json(result);
});

// POST /api/habits/reorder  body: {ids: [...]}
router.post('/reorder', (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
  if (!ids) return res.status(400).json({ error: 'ids array required' });
  const stmt = db.prepare('UPDATE habits SET sort_order = ? WHERE id = ?');
  const run = db.transaction((list) => list.forEach((id, i) => stmt.run(i + 1, id)));
  run(ids);
  res.json({ ok: true });
});

// GET /api/habits/:id/graph
router.get('/:id/graph', (req, res) => {
  const tz = getTimezone();
  const habit = db.prepare('SELECT * FROM habits WHERE id = ?').get(req.params.id);
  if (!habit) return res.status(404).json({ error: 'not found' });
  const days = parseInt(req.query.days, 10) || 30;
  const logs = logsForHabit(habit.id);
  res.json(graphSeries(habit, logs, tz, days));
});

// POST /api/habits
router.post('/', (req, res) => {
  const { name, description, weekdays, time_of_day, mode, start_date, end_date, tags } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  if (!weekdays) return res.status(400).json({ error: 'weekdays is required' });

  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO habits (name, description, weekdays, time_of_day, mode, start_date, end_date, archived, tags, created_at)
       VALUES (@name, @description, @weekdays, @time_of_day, @mode, @start_date, @end_date, 0, @tags, @created_at)`,
    )
    .run({
      name: name.trim(),
      description: description || null,
      weekdays: String(weekdays),
      time_of_day: time_of_day || null,
      mode: mode === 'fixed' ? 'fixed' : 'forever',
      start_date: start_date || null,
      end_date: end_date || null,
      tags: normalizeTags(tags || ''),
      created_at: now,
    });

  const row = db.prepare('SELECT * FROM habits WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(row);
});

// PATCH /api/habits/:id
router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM habits WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'not found' });

  const allowed = ['name', 'description', 'weekdays', 'time_of_day', 'mode', 'start_date', 'end_date', 'archived', 'tags'];
  const patch = {};
  for (const k of allowed) {
    if (k in req.body) patch[k] = req.body[k];
  }
  if ('tags' in patch) patch.tags = normalizeTags(patch.tags || '');

  if (Object.keys(patch).length === 0) return res.json(existing);

  const keys = Object.keys(patch);
  const setSql = keys.map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE habits SET ${setSql} WHERE id = @id`).run({ ...patch, id });

  const updated = db.prepare('SELECT * FROM habits WHERE id = ?').get(id);
  res.json(updated);
});

// DELETE /api/habits/:id
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM habits WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

// POST /api/habits/:id/log  body: {date, done}
// done=0 → delete or set 0; done=1 → upsert done=1.
router.post('/:id/log', (req, res) => {
  const { id } = req.params;
  const habit = db.prepare('SELECT * FROM habits WHERE id = ?').get(id);
  if (!habit) return res.status(404).json({ error: 'not found' });

  const tz = getTimezone();
  const date = req.body?.date || todayISO(tz);
  const done = req.body?.done !== undefined ? (req.body.done ? 1 : 0) : 1;

  if (done === 0) {
    db.prepare('DELETE FROM habit_logs WHERE habit_id = ? AND date = ?').run(id, date);
  } else {
    db.prepare(
      `INSERT INTO habit_logs (habit_id, date, done) VALUES (?, ?, 1)
       ON CONFLICT(habit_id, date) DO UPDATE SET done = 1`,
    ).run(id, date);
  }

  const logs = logsForHabit(id);
  const streak = currentStreak(habit, logs, tz);
  res.json({ ok: true, date, done, current_streak: streak });
});

export default router;
