import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';
import { getTimezone } from '../config.js';
import { todayISO } from '../lib/dates.js';
import { nextInstance } from '../lib/recurrence.js';
import { normalizeTags } from '../lib/tags.js';

const router = Router();
router.use(requireAuth);

// GET /api/todos
// Query: status=open|done|all (default open), area, q (search)
router.get('/', (req, res) => {
  const { status = 'open', area, q } = req.query;

  let sql = `SELECT * FROM todos WHERE 1=1`;
  const params = {};

  if (status === 'open') {
    sql += ` AND done = 0`;
  } else if (status === 'done') {
    sql += ` AND done = 1`;
  }

  if (area) {
    sql += ` AND area = @area`;
    params.area = area;
  }

  if (q) {
    sql += ` AND (title LIKE @q OR notes LIKE @q)`;
    params.q = `%${q}%`;
  }

  // Manual order wins (drag-to-reorder); newest first until reordered.
  sql += ` ORDER BY sort_order ASC, id DESC`;

  const rows = db.prepare(sql).all(params);
  res.json(rows);
});

// POST /api/todos/reorder  body: {ids: [...]}  → sets sort_order to list position.
router.post('/reorder', (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
  if (!ids) return res.status(400).json({ error: 'ids array required' });
  const stmt = db.prepare('UPDATE todos SET sort_order = ? WHERE id = ?');
  const run = db.transaction((list) => {
    list.forEach((id, i) => stmt.run(i + 1, id));
  });
  run(ids);
  res.json({ ok: true });
});

// POST /api/todos
router.post('/', (req, res) => {
  const { title, notes, deadline, time_start, time_end, area, priority, recur_rule, is_top3, tags } = req.body || {};

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO todos (title, notes, deadline, time_start, time_end, area, priority, is_top3, done, recur_rule, tags, created_at)
       VALUES (@title, @notes, @deadline, @time_start, @time_end, @area, @priority, @is_top3, 0, @recur_rule, @tags, @created_at)`,
    )
    .run({
      title: title.trim(),
      notes: notes || null,
      deadline: deadline || null,
      time_start: time_start || null,
      time_end: time_end || null,
      area: area || null,
      priority: priority || null,
      is_top3: is_top3 ? 1 : 0,
      recur_rule: recur_rule || null,
      tags: normalizeTags(tags || ''),
      created_at: now,
    });

  const row = db.prepare('SELECT * FROM todos WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(row);
});

// PATCH /api/todos/:id
router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'not found' });

  const allowed = ['title', 'notes', 'deadline', 'time_start', 'time_end', 'area', 'priority', 'is_top3', 'done', 'recur_rule', 'tags'];
  const patch = {};
  for (const k of allowed) {
    if (k in req.body) patch[k] = req.body[k];
  }
  // Normalize tags if present.
  if ('tags' in patch) patch.tags = normalizeTags(patch.tags || '');

  // Toggling done ON: set completed_at.
  const wasJustCompleted = !existing.done && patch.done;
  if (wasJustCompleted) {
    patch.completed_at = new Date().toISOString();
  } else if ('done' in patch && !patch.done) {
    patch.completed_at = null;
  }

  // Coerce booleans to ints for SQLite.
  if ('done' in patch) patch.done = patch.done ? 1 : 0;
  if ('is_top3' in patch) patch.is_top3 = patch.is_top3 ? 1 : 0;

  if (Object.keys(patch).length === 0) {
    return res.json(existing);
  }

  const keys = Object.keys(patch);
  const setSql = keys.map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE todos SET ${setSql} WHERE id = @id`).run({ ...patch, id });

  // If completing a recurring todo, also create the next instance.
  if (wasJustCompleted && existing.recur_rule) {
    const tz = getTimezone();
    const next = nextInstance({ ...existing, ...patch }, tz);
    if (next) {
      db.prepare(
        `INSERT INTO todos (title, notes, deadline, time_start, time_end, area, priority, is_top3, done, completed_at, recur_rule, carried_from, created_at)
         VALUES (@title, @notes, @deadline, @time_start, @time_end, @area, @priority, @is_top3, @done, @completed_at, @recur_rule, @carried_from, @created_at)`,
      ).run(next);
    }
  }

  const updated = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
  res.json(updated);
});

// DELETE /api/todos/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM todos WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

// POST /api/todos/:id/top3
// Toggle is_top3. Enforce max 3 at a time.
router.post('/:id/top3', (req, res) => {
  const { id } = req.params;
  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
  if (!todo) return res.status(404).json({ error: 'not found' });

  if (todo.is_top3) {
    // Unstar.
    db.prepare('UPDATE todos SET is_top3 = 0 WHERE id = ?').run(id);
  } else {
    // Check how many are already starred.
    const count = db.prepare('SELECT COUNT(*) as c FROM todos WHERE is_top3 = 1 AND id != ?').get(id).c;
    if (count >= 3) {
      return res.status(400).json({ error: 'already have 3 top-3 items' });
    }
    db.prepare('UPDATE todos SET is_top3 = 1 WHERE id = ?').run(id);
  }

  const updated = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
  res.json(updated);
});

export default router;
