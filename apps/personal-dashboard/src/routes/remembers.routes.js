import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';
import { normalizeTags } from '../lib/tags.js';

const router = Router();
router.use(requireAuth);

// GET /api/remembers/random  — before the param route to avoid :id clash
router.get('/random', (req, res) => {
  const row = db.prepare('SELECT * FROM remembers WHERE active = 1 ORDER BY RANDOM() LIMIT 1').get();
  if (!row) return res.json({ text: null });
  res.json(row);
});

// GET /api/remembers
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM remembers ORDER BY sort_order ASC, id DESC').all();
  res.json(rows);
});

// POST /api/remembers/reorder  body: {ids: [...]}
router.post('/reorder', (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
  if (!ids) return res.status(400).json({ error: 'ids array required' });
  const stmt = db.prepare('UPDATE remembers SET sort_order = ? WHERE id = ?');
  const run = db.transaction((list) => list.forEach((id, i) => stmt.run(i + 1, id)));
  run(ids);
  res.json({ ok: true });
});

// POST /api/remembers
router.post('/', (req, res) => {
  const { text, active, tags } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });

  const now = new Date().toISOString();
  const result = db
    .prepare('INSERT INTO remembers (text, active, tags, created_at) VALUES (@text, @active, @tags, @created_at)')
    .run({ text: text.trim(), active: active === false ? 0 : 1, tags: normalizeTags(tags || ''), created_at: now });

  const row = db.prepare('SELECT * FROM remembers WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(row);
});

// PATCH /api/remembers/:id
router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM remembers WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'not found' });

  const patch = {};
  if ('text' in req.body) patch.text = req.body.text;
  if ('active' in req.body) patch.active = req.body.active ? 1 : 0;
  if ('tags' in req.body) patch.tags = normalizeTags(req.body.tags || '');

  if (Object.keys(patch).length === 0) return res.json(existing);

  const keys = Object.keys(patch);
  const setSql = keys.map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE remembers SET ${setSql} WHERE id = @id`).run({ ...patch, id });

  const updated = db.prepare('SELECT * FROM remembers WHERE id = ?').get(id);
  res.json(updated);
});

// DELETE /api/remembers/:id
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM remembers WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

export default router;
