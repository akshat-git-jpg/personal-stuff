import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';
import { getConfig, getTimezone } from '../config.js';
import { parseCapture, parseHabit, parseRemember, classifyCapture, detectPrefix, deriveTags } from '../lib/capture.js';
import { normalizeTags, getAllTags } from '../lib/tags.js';

const router = Router();
router.use(requireAuth);

function createTodo(fields) {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO todos (title, notes, deadline, time_start, time_end, area, priority, is_top3, done, recur_rule, tags, created_at)
       VALUES (@title, @notes, @deadline, @time_start, @time_end, @area, @priority, 0, 0, NULL, @tags, @created_at)`,
    )
    .run({
      title: fields.title,
      notes: null,
      deadline: fields.deadline || null,
      time_start: fields.time_start || null,
      time_end: fields.time_end || null,
      area: fields.area || null,
      priority: fields.priority || null,
      tags: normalizeTags(fields.tags || []),
      created_at: now,
    });
  return db.prepare('SELECT * FROM todos WHERE id = ?').get(result.lastInsertRowid);
}

function createHabit(h) {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO habits (name, description, weekdays, time_of_day, mode, start_date, end_date, archived, tags, created_at)
       VALUES (@name, NULL, @weekdays, NULL, @mode, @start_date, @end_date, 0, @tags, @created_at)`,
    )
    .run({
      name: h.name,
      weekdays: h.weekdays || '0,1,2,3,4,5,6',
      mode: h.mode === 'fixed' ? 'fixed' : 'forever',
      start_date: h.start_date || null,
      end_date: h.end_date || null,
      tags: normalizeTags(h.tags || []),
      created_at: now,
    });
  return db.prepare('SELECT * FROM habits WHERE id = ?').get(result.lastInsertRowid);
}

function createRemember(text, tags) {
  const now = new Date().toISOString();
  const result = db
    .prepare(`INSERT INTO remembers (text, active, tags, created_at) VALUES (?, 1, ?, ?)`)
    .run(text, normalizeTags(tags || []), now);
  return db.prepare('SELECT * FROM remembers WHERE id = ?').get(result.lastInsertRowid);
}

function createNote(text, tags) {
  const now = new Date().toISOString();
  const result = db
    .prepare(`INSERT INTO notes (text, tags, created_at) VALUES (?, ?, ?)`)
    .run(text, normalizeTags(tags || []), now);
  return db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid);
}

// POST /api/capture  body: {text, type?}
// `type` ("todo" | "habit" | "remember") comes from the UI category selector and
// is authoritative — the LLM only cleans/parses the content for that type, no
// classification needed. If `type` is omitted we fall back to first-word prefix
// detection, then to a single classify+parse call.
router.post('/', async (req, res) => {
  const { text, type } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }

  const cfg = getConfig();
  const tz = getTimezone();
  const existingTags = getAllTags(db);
  const llmOpts = {
    model: cfg.openrouter_model,
    key: cfg.openrouter_key,
    captureRules: cfg.capture_rules_md,
    tz,
    existingTags,
  };

  // Explicit type from the UI wins; otherwise detect from the first word.
  const explicit = ['todo', 'habit', 'remember', 'note'].includes(type) ? type : null;
  const detected = explicit ? { type: explicit, body: text.trim() } : detectPrefix(text);
  const routeType = detected.type;
  const body = detected.body;

  try {
    // Notes are stored verbatim (facts/raw jottings — no LLM rewrite).
    // Tags are derived separately so the text stays untouched.
    if (routeType === 'note') {
      const tags = await deriveTags(body, llmOpts);
      return res.status(201).json({ type: 'note', item: createNote(body, tags) });
    }
    // For all types the user's text is kept VERBATIM (no LLM rephrasing).
    // The LLM is used only for metadata: dates/times/weekdays/duration + tags.
    if (routeType === 'remember') {
      const result = await parseRemember(body, llmOpts);
      return res.status(201).json({ type: 'remember', item: createRemember(body, result.tags) });
    }
    if (routeType === 'habit') {
      const h = await parseHabit(body, llmOpts);
      return res.status(201).json({ type: 'habit', item: createHabit({ ...h, name: body }) });
    }
    if (routeType === 'todo') {
      const parsed = await parseCapture(body, llmOpts);
      return res.status(201).json({ type: 'todo', item: createTodo({ ...parsed, title: body }) });
    }

    // No type and no prefix — classify (for routing) but keep text verbatim.
    const c = await classifyCapture(text.trim(), llmOpts);
    if (c.type === 'remember') {
      const result = await parseRemember(text.trim(), llmOpts);
      return res.status(201).json({ type: 'remember', item: createRemember(text.trim(), result.tags) });
    }
    if (c.type === 'habit') {
      const h = await parseHabit(text.trim(), llmOpts);
      return res.status(201).json({ type: 'habit', item: createHabit({ ...h, name: text.trim() }) });
    }
    return res.status(201).json({ type: 'todo', item: createTodo({ ...c, title: text.trim() }) });
  } catch (err) {
    console.error('[capture] route error:', err.message);
    return res.status(500).json({ error: 'capture failed' });
  }
});

export default router;
