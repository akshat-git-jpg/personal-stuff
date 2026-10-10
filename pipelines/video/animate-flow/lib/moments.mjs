// moments.json: which spans of narration get a custom graphic, anchored to transcript words.
// Builtins only: 030 copies this file into its stage so the planner can check its own output.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

// takeover: the graphic owns the whole frame. overlay: it sits on the screen recording, which stays visible.
export const MOMENT_KINDS = Object.freeze(['takeover', 'overlay']);
export const MOMENT_LIMITS = Object.freeze({ minDur: 3, maxDur: 20, maxHold: 1.5, defaultHold: 0.5, minGap: 1 });
const EPS = 0.05;

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// One word per line: index, start, end, text. What the planner anchors on.
export function wordTable(words) {
  return ['i\tstart\tend\ttext', ...words.map((w, i) => `${i}\t${w.start.toFixed(2)}\t${w.end.toFixed(2)}\t${w.text}`)].join('\n') + '\n';
}

function anchorErrors(at, side, a, words) {
  if (!a || typeof a !== 'object') return [`${at}: missing ${side} anchor`];
  if (!Number.isInteger(a.i) || a.i < 0 || a.i >= words.length) return [`${at}: ${side}.i ${a.i} is not a word index (0-${words.length - 1})`];
  if (norm(a.text) !== norm(words[a.i].text)) return [`${at}: ${side}.text "${a.text}" does not match word ${a.i} "${words[a.i].text}"`];
  return [];
}

// Validates the planner's file against the transcript and resolves start/end in seconds.
// Returns { errors, moments }; moments are sorted, with `start`, `end`, `duration` filled in.
export function resolveMoments(doc, words, { total, limits = MOMENT_LIMITS } = {}) {
  const errors = [];
  if (!doc || !Array.isArray(doc.moments)) return { errors: ['moments.json must have a moments array'], moments: [] };
  if (doc.moments.length === 0) errors.push('moments array is empty');
  const end = total ?? (words.length ? words[words.length - 1].end : 0);
  const seen = new Set();
  const out = [];
  for (const [k, m] of doc.moments.entries()) {
    const at = `moment ${m?.id ?? `#${k}`}`;
    if (!m || typeof m !== 'object') { errors.push(`moment #${k} must be an object`); continue; }
    if (typeof m.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(m.id)) errors.push(`${at}: id must be lowercase kebab (e.g. m01)`);
    else if (seen.has(m.id)) errors.push(`${at}: duplicate id`);
    else seen.add(m.id);
    if (typeof m.idea !== 'string' || !m.idea.trim()) errors.push(`${at}: idea is required (one line)`);
    if (typeof m.why !== 'string' || !m.why.trim()) errors.push(`${at}: why is required (one line)`);
    if (m.kind !== undefined && !MOMENT_KINDS.includes(m.kind)) errors.push(`${at}: kind must be ${MOMENT_KINDS.join(' or ')}`);
    const anchorErrs = [...anchorErrors(at, 'from', m.from, words), ...anchorErrors(at, 'to', m.to, words)];
    errors.push(...anchorErrs);
    if (anchorErrs.length) continue;
    if (m.to.i < m.from.i) { errors.push(`${at}: to.i ${m.to.i} is before from.i ${m.from.i}`); continue; }
    const hold = m.hold ?? limits.defaultHold;
    if (!(Number.isFinite(hold) && hold >= 0 && hold <= limits.maxHold)) errors.push(`${at}: hold must be 0-${limits.maxHold}s`);
    const start = +words[m.from.i].start.toFixed(2);
    const stop = +Math.min(words[m.to.i].end + hold, end).toFixed(2);
    out.push({ ...m, kind: m.kind ?? 'takeover', start, end: stop });
  }
  out.sort((a, b) => a.start - b.start);
  // A hold may not run into the next moment; a gap shorter than minGap would flash the bed, so close it.
  for (let i = 0; i + 1 < out.length; i++) {
    const gap = out[i + 1].start - out[i].end;
    if (gap > 0 && gap < limits.minGap) out[i].end = out[i + 1].start;
    else if (gap < 0) {
      const spoken = words[out[i].to.i].end;
      if (spoken > out[i + 1].start + EPS) errors.push(`moments ${out[i].id} and ${out[i + 1].id} overlap (${out[i].id} speaks until ${spoken}s, ${out[i + 1].id} starts ${out[i + 1].start}s)`);
      else out[i].end = out[i + 1].start;
    }
  }
  for (const m of out) {
    m.duration = +(m.end - m.start).toFixed(2);
    if (m.duration < limits.minDur - EPS) errors.push(`moment ${m.id}: ${m.duration}s is shorter than ${limits.minDur}s`);
    if (m.duration > limits.maxDur + EPS) errors.push(`moment ${m.id}: ${m.duration}s is longer than ${limits.maxDur}s`);
  }
  return { errors, moments: out };
}

// The narration inside one moment, with times relative to the moment's start.
export function momentWords(words, m) {
  return words.filter((w) => w.start >= m.start - 0.01 && w.start < m.end)
    .map((w) => ({ text: w.text, start: +(w.start - m.start).toFixed(2), end: +(Math.min(w.end, m.end) - m.start).toFixed(2) }));
}

// The moment covering master time t, if any.
export function momentAt(moments, t) {
  return moments.find((m) => t >= m.start && t < m.end) ?? null;
}

// CLI: node moments.mjs check <moments.json> <transcript.json> [total-seconds]
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, mFile, tFile, total] = process.argv.slice(2);
  if (cmd !== 'check' || !mFile || !tFile) {
    console.error('usage: node moments.mjs check <moments.json> <transcript.json> [total-seconds]');
    process.exit(2);
  }
  const { errors, moments } = resolveMoments(JSON.parse(fs.readFileSync(mFile, 'utf8')), JSON.parse(fs.readFileSync(tFile, 'utf8')),
    { total: total ? Number(total) : undefined });
  for (const m of moments) console.log(`${m.id}  ${m.start.toFixed(2)}-${m.end.toFixed(2)}s  (${m.duration}s)  ${m.idea}`);
  for (const e of errors) console.error(`ERROR ${e}`);
  console.log(errors.length ? `${errors.length} error(s)` : 'moments OK');
  process.exit(errors.length ? 1 : 0);
}
