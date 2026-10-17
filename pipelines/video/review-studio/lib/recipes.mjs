// One adapter per recipe: where its videos and media live, and how it writes a comment.
// Every write goes through the recipe's own feedback code, so the old boards read what we write.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  appendFinalFeedback, applyFeedback, feedbackContextFromDisk,
  saveFeedbackImages, dropFeedbackImage, itemImages,
} from '../../visuals-flow/lib/board.mjs';
import { appendFinalItem } from '../../animate-flow/lib/feedback.mjs';
import { resolveMoments, momentAt } from '../../animate-flow/lib/moments.mjs';

const VIDEO_DIR = path.resolve(import.meta.dirname, '..', '..');
const KB = path.join(os.homedir(), 'kb-scratch', 'video');

const readJson = (p, fallback = null) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
};
const writeJson = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2));
const today = () => new Date().toISOString().slice(0, 10);
export const isSlug = (s) => typeof s === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(s);
export const isLabel = (s) => typeof s === 'string' && /^v\d+$/.test(s);
export const clock = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

function words(workdir) {
  for (const f of ['transcript.cleaned.json', 'transcript.json']) {
    const w = readJson(path.join(workdir, f));
    const list = Array.isArray(w) ? w : Array.isArray(w?.words) ? w.words : null;
    if (list?.length) return list.filter((x) => Number.isFinite(x?.start)).map((x) => ({ text: String(x.text ?? x.word ?? ''), start: x.start, end: x.end ?? x.start }));
  }
  return [];
}

const visualsFlow = {
  id: 'visuals-flow',
  label: 'yt-video-edit',
  videosDir: process.env.REVIEW_VF_VIDEOS ?? path.join(VIDEO_DIR, 'visuals-flow', 'videos'),
  mediaDir: (slug) => path.join(process.env.ASSEMBLE_MEDIA_ROOT ?? path.join(KB, 'visuals-flow'), slug),
  approved(workdir) {
    const fc = readJson(path.join(workdir, 'final-cut.json'));
    return fc?.approved ? { version: fc.version ?? null } : null;
  },
  timeline(workdir) {
    const w = words(workdir);
    const cues = readJson(path.join(workdir, 'resolved.json'))?.resolved ?? [];
    const cards = cues.map((c) => ({ id: c.id, card: c.card, start: c.start, duration: c.duration ?? 4 }));
    const sections = cues.filter((c) => String(c.card).startsWith('section/'))
      .map((c) => ({ name: c.variables?.title ?? c.variables?.name ?? c.id, start: c.start }));
    return { words: w, cards, parts: withIntro(sections) };
  },
  async addComment(workdir, label, { text, why, t, images }) {
    const fbPath = path.join(workdir, 'feedback.json');
    let fb = readJson(fbPath, {});
    const item = { text, t, context: `final@${clock(t)}`, added: today() };
    if (why) item.why = why;
    fb = appendFinalFeedback(fb, label, item);
    const prefix = `final-${label}:`;
    const key = Object.keys(fb.items).filter((k) => k.startsWith(prefix))
      .sort((a, b) => Number(a.slice(prefix.length)) - Number(b.slice(prefix.length))).pop();
    const saved = saveFeedbackImages(workdir, key, images);
    if (saved.length) fb.items[key].images = saved;
    fb.updated = today();
    writeJson(fbPath, fb);
    return { key, item: fb.items[key] };
  },
  dropImages: (workdir, item) => dropFeedbackImage(workdir, item),
  // Video-wide notes are the old board's `_global` box.
  saveNotes: (workdir, text) => applyFeedback(workdir, { feedback: { _global: text } }, feedbackContextFromDisk(workdir)),
};

const animateFlow = {
  id: 'animate-flow',
  label: 'yt-animate',
  videosDir: process.env.REVIEW_AF_VIDEOS ?? path.join(VIDEO_DIR, 'animate-flow', 'videos'),
  mediaDir: (slug) => path.join(process.env.ANIMATE_MEDIA_ROOT ?? path.join(KB, 'animate-flow'), slug),
  approved: () => null,
  moments(workdir, w) {
    const doc = readJson(path.join(workdir, 'moments.json'));
    if (!doc?.moments) return [];
    if (doc.moments.every((m) => Number.isFinite(m.start))) return doc.moments;
    return resolveMoments(doc, w, { total: doc.total }).moments;
  },
  timeline(workdir) {
    const w = words(workdir);
    const ms = this.moments(workdir, w);
    const cards = ms.map((m) => ({ id: m.id, card: m.kind ?? 'moment', start: m.start, duration: m.end - m.start }));
    const parts = ms.map((m) => ({ name: m.id, start: m.start }));
    return { words: w, cards, parts: withIntro(parts) };
  },
  async addComment(workdir, label, { text, why, t }) {
    const fbPath = path.join(workdir, 'feedback.json');
    const moment = momentAt(this.moments(workdir, words(workdir)), t)?.id ?? null;
    const { fb, key } = appendFinalItem(readJson(fbPath, { items: {} }), label, { text, t, moment });
    if (why) fb.items[key].why = why;
    writeJson(fbPath, fb);
    return { key, item: fb.items[key] };
  },
  dropImages: () => {},
  saveNotes: null,
};

function withIntro(parts) {
  const sorted = [...parts].sort((a, b) => a.start - b.start);
  if (!sorted.length || sorted[0].start > 1) sorted.unshift({ name: 'Intro', start: 0 });
  return sorted;
}

export const RECIPES = { [visualsFlow.id]: visualsFlow, [animateFlow.id]: animateFlow };
export { readJson, writeJson, itemImages, words };
