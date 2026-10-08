// feedback.json: the owner's timestamped notes on a cut. Same item schema and key scheme as the
// other recipes' final-cut review (`final-<version>:<n>`), so one fold procedure reads them all.
import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJson } from './paths.mjs';

export const feedbackPath = (workdir) => path.join(workdir, 'feedback.json');

export function readFeedback(workdir) {
  const p = feedbackPath(workdir);
  return fs.existsSync(p) ? readJson(p) : { items: {} };
}

const clock = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(1).padStart(4, '0')}`;

export function appendFinalItem(fb, label, { text, t, moment = null, today = new Date().toISOString().slice(0, 10) }) {
  if (!/^v\d+$/.test(label)) throw new Error(`version label must look like v3 (got "${label}")`);
  const clean = String(text ?? '').trim();
  if (!clean) throw new Error('empty comment');
  if (!(Number.isFinite(t) && t >= 0)) throw new Error('t must be a time in seconds');
  const items = { ...(fb.items ?? {}) };
  const prefix = `final-${label}:`;
  const next = Object.keys(items).filter((k) => k.startsWith(prefix)).reduce((n, k) => Math.max(n, Number(k.slice(prefix.length)) + 1), 0);
  const key = `${prefix}${next}`;
  items[key] = { text: clean, t: +t.toFixed(2), context: `final@${clock(t)}`, added: today, ...(moment ? { moment } : {}) };
  return { fb: { ...fb, items, updated: today }, key };
}

export function deleteItem(fb, key) {
  const item = fb.items?.[key];
  if (!item) throw new Error(`no comment ${key}`);
  if (item.folded) throw new Error('folded items are read-only history');
  const items = { ...fb.items };
  delete items[key];
  return { ...fb, items };
}

// What still needs a decision: neither applied to the video nor folded into a rule, and not parked.
export function pendingItems(fb) {
  return Object.entries(fb.items ?? {}).filter(([, i]) => !i.deferred && !i.applied && !i.folded).map(([key, i]) => ({ key, ...i }));
}

export function saveFeedback(workdir, fb) { writeJson(feedbackPath(workdir), fb); }
