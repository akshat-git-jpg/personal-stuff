import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';
import { normalizeTags } from '../lib/tags.js';

const router = Router();
router.use(requireAuth);

// GET /api/notes — newest first.
router.get('/', (req, res) => {
  const { q } = req.query;
  let sql = 'SELECT * FROM notes';
  const params = {};
  if (q) {
    sql += ' WHERE text LIKE @q';
    params.q = `%${q}%`;
  }
  sql += ' ORDER BY sort_order ASC, id DESC';
  res.json(db.prepare(sql).all(params));
});

// POST /api/notes/reorder  body: {ids: [...]}
router.post('/reorder', (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
  if (!ids) return res.status(400).json({ error: 'ids array required' });
  const stmt = db.prepare('UPDATE notes SET sort_order = ? WHERE id = ?');
  const run = db.transaction((list) => list.forEach((id, i) => stmt.run(i + 1, id)));
  run(ids);
  res.json({ ok: true });
});

// POST /api/notes  body: {text, tags?}
router.post('/', (req, res) => {
  const { text, tags } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });
  const now = new Date().toISOString();
  const result = db
    .prepare('INSERT INTO notes (text, tags, created_at) VALUES (?, ?, ?)')
    .run(text.trim(), normalizeTags(tags || ''), now);
  res.status(201).json(db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid));
});

// PATCH /api/notes/:id  body: {text?, tags?}
router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const body = req.body || {};
  const patch = {};
  if ('text' in body) patch.text = String(body.text || '').trim();
  if ('tags' in body) patch.tags = normalizeTags(body.tags || '');
  if (Object.keys(patch).length === 0) return res.json(existing);
  const keys = Object.keys(patch);
  const setSql = keys.map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE notes SET ${setSql} WHERE id = @id`).run({ ...patch, id });
  res.json(db.prepare('SELECT * FROM notes WHERE id = ?').get(id));
});

// DELETE /api/notes/:id
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

export default router;
