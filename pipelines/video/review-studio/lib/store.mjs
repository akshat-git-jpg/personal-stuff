// Reads and writes for the studio. Every request reads from disk, so the old board's writes show up at once.
import fs from 'node:fs';
import path from 'node:path';
import { RECIPES, isSlug, isLabel, readJson, writeJson, itemImages } from './recipes.mjs';

const REGISTRY = path.resolve(import.meta.dirname, '..', '..', '..', 'video-registry', 'videos.json');

export const isOpen = (i) => !i.folded && !i.applied && !i.deferred;
const humanize = (slug) => slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

export function workdirOf(recipeId, slug) {
  const r = RECIPES[recipeId];
  if (!r || !isSlug(slug)) return null;
  const dir = path.join(r.videosDir, slug);
  return fs.existsSync(dir) && fs.statSync(dir).isDirectory() ? dir : null;
}

function versionsOf(r, slug) {
  const v = readJson(path.join(r.mediaDir(slug), 'versions.json'))?.versions ?? [];
  return v.filter((x) => isLabel(x.label)).map(({ label, created, draft }) => ({ label, created: created ?? null, draft: !!draft }));
}

const mtime = (p) => { try { return fs.statSync(p).mtimeMs; } catch { return 0; } };

export function listVideos() {
  const titles = readJson(REGISTRY)?.videos ?? {};
  const out = [];
  for (const r of Object.values(RECIPES)) {
    if (!fs.existsSync(r.videosDir)) continue;
    for (const slug of fs.readdirSync(r.videosDir)) {
      const dir = path.join(r.videosDir, slug);
      if (!isSlug(slug) || !fs.statSync(dir).isDirectory()) continue;
      const fb = readJson(path.join(dir, 'feedback.json'));
      const items = Object.entries(fb?.items ?? {}).filter(([k]) => k !== '_global').map(([, v]) => v);
      const versions = versionsOf(r, slug);
      // File mtimes reset on a fresh clone, so prefer dates the pipeline wrote down.
      const updated = Math.max(
        Date.parse(versions.at(-1)?.created ?? '') || 0,
        Date.parse(fb?.updated ?? '') || 0,
        ...items.map((i) => Date.parse(i.added ?? '') || 0),
      ) || mtime(dir);
      out.push({
        recipe: r.id, recipeLabel: r.label, slug,
        title: titles[slug]?.title ?? humanize(slug),
        updated: new Date(updated).toISOString(),
        versions: versions.map((v) => v.label),
        approved: r.approved(dir),
        comments: { total: items.length, open: items.filter(isOpen).length },
      });
    }
  }
  return out.sort((a, b) => b.updated.localeCompare(a.updated));
}

export function videoDetail(recipeId, slug) {
  const dir = workdirOf(recipeId, slug);
  if (!dir) return null;
  const r = RECIPES[recipeId];
  const titles = readJson(REGISTRY)?.videos ?? {};
  const fb = readJson(path.join(dir, 'feedback.json'), {});
  const { words, cards, parts } = r.timeline(dir);
  const items = {};
  for (const [k, v] of Object.entries(fb.items ?? {})) {
    if (k === '_global') continue;
    items[k] = { ...v, images: itemImages(v).length };
  }
  const duration = Math.max(words.at(-1)?.end ?? 0, ...cards.map((c) => c.start + c.duration), 0);
  return {
    recipe: r.id, recipeLabel: r.label, slug,
    title: titles[slug]?.title ?? humanize(slug),
    versions: versionsOf(r, slug),
    approved: r.approved(dir),
    duration,
    parts, cards,
    words: words.map((w) => [+w.start.toFixed(2), +w.end.toFixed(2), w.text]),
    items,
    notes: fb.items?._global?.text ?? '',
    notesEnabled: !!r.saveNotes,
  };
}

export function mediaFile(recipeId, slug, label) {
  const r = RECIPES[recipeId];
  if (!workdirOf(recipeId, slug) || !isLabel(label)) return null;
  const media = r.mediaDir(slug);
  const v = (readJson(path.join(media, 'versions.json'))?.versions ?? []).find((x) => x.label === label);
  if (!v) return null;
  const file = path.resolve(media, v.file);
  return file.startsWith(media + path.sep) && fs.existsSync(file) ? file : null;
}

export function imageFile(recipeId, slug, key, n) {
  const dir = workdirOf(recipeId, slug);
  if (!dir) return null;
  const item = readJson(path.join(dir, 'feedback.json'))?.items?.[key];
  const rel = itemImages(item)[n];
  if (!rel) return null;
  const file = path.resolve(dir, rel);
  return file.startsWith(path.join(dir, 'feedback-images') + path.sep) && fs.existsSync(file) ? file : null;
}

const fail = (code, error) => { const e = new Error(error); e.code = code; throw e; };

export async function addComment(recipeId, slug, { label, t, text, why, images }) {
  const dir = workdirOf(recipeId, slug) ?? fail(404, 'no such video');
  if (!isLabel(label)) fail(400, 'label must look like v2');
  const clean = String(text ?? '').trim();
  if (!clean) fail(400, 'empty comment');
  const time = Number(t);
  if (!Number.isFinite(time) || time < 0) fail(400, 't must be seconds');
  const imgs = Array.isArray(images) ? images.filter((s) => typeof s === 'string' && s.startsWith('data:image/')) : [];
  return RECIPES[recipeId].addComment(dir, label, { text: clean, why: String(why ?? '').trim(), t: +time.toFixed(3), images: imgs });
}

function editableItem(dir, key) {
  const fbPath = path.join(dir, 'feedback.json');
  const fb = readJson(fbPath) ?? fail(404, 'no feedback.json');
  const item = fb.items?.[key] ?? fail(404, 'no such comment');
  if (item.folded) fail(409, 'folded items are read-only history');
  return { fb, fbPath, item };
}

export function editComment(recipeId, slug, { key, text, why }) {
  const dir = workdirOf(recipeId, slug) ?? fail(404, 'no such video');
  if (!/^final-v\d+:\d+$/.test(String(key))) fail(400, 'not a comment key');
  const { fb, fbPath, item } = editableItem(dir, key);
  if (text !== undefined) {
    const clean = String(text).trim();
    if (!clean) fail(400, 'empty text');
    item.text = clean;
  }
  if (why !== undefined) {
    const w = String(why).trim();
    if (w) item.why = w; else delete item.why;
  }
  fb.updated = new Date().toISOString().slice(0, 10);
  writeJson(fbPath, fb);
  return item;
}

export function deleteComment(recipeId, slug, { key }) {
  const dir = workdirOf(recipeId, slug) ?? fail(404, 'no such video');
  if (!/^final-v\d+:\d+$/.test(String(key))) fail(400, 'not a comment key');
  const { fb, fbPath, item } = editableItem(dir, key);
  RECIPES[recipeId].dropImages(dir, item);
  delete fb.items[key];
  writeJson(fbPath, fb);
}

export function saveNotes(recipeId, slug, { text }) {
  const dir = workdirOf(recipeId, slug) ?? fail(404, 'no such video');
  const r = RECIPES[recipeId];
  if (!r.saveNotes) fail(400, 'this recipe has no video notes');
  r.saveNotes(dir, String(text ?? ''));
}
