// board.mjs — local review board (port 4322) for a video's graphics cues.
//
//   node lib/board.mjs <slug-or-path>
//   → open the printed http://localhost:4322
//
// One tile per cue: the REAL card, playing in an iframe, driven by that cue's
// VO slice (postMessage seeks the card's paused GSAP timeline). Edits write
// back through the same resolver lib/resolve.mjs's CLI uses; nothing here
// duplicates the anchor-matching logic.

import { createServer as httpCreateServer } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveCues, normWord, extendExposure } from './resolve.mjs';
import { lintCues, avatarFullSpans } from './lint-cues.mjs';
import { mmss } from './render.mjs';
import { enrichLogos } from './logos-inline.mjs';
import { resolveShots } from './resolve-shots.mjs';
import { resolveWorkdir } from './workdir.mjs';
import { planCaptions } from './captions.mjs';
import { loadBrand, injectBrand } from './brand-inline.mjs';
import { loadVideoManifest } from './video-manifest.mjs';
import { appendCardPlanFeedback, PLAN_PARTS } from './card-plan.mjs';
import { MEASURE_OVERFLOW_SRC } from './overflow-measure.mjs';
import { computeProbeTimes, loadBoardData, buildBoardData, introData, avatarPlanData } from './board-data.mjs';
import { buildAvatarPlan, mergeAvatarPlan, avatarPlanPath, loadRegistry } from './avatar-plan.mjs';

import { stepView, summarize as summarizeRun, nextStep, readRunLog, writeRunLog, setStep, resolveStepId } from './run-log.mjs';
import { approveIntro } from './intro-film/approve.mjs';
import { loadSteps } from './steps.mjs';

// What the board needs to BOOT. resolved.json is deliberately not here: it is
// produced by 040, and 040 refuses any cue naming a card that does not exist
// yet — a card that only 038 builds, AFTER the owner approves it at 037. Since
// 037's review surface is this board's Card Plan tab, requiring resolved.json
// to start made Gate 1 unreachable on exactly the videos it exists for.
// resolved.json is a requirement of the Storyboard tab, not of the board.
const BOOT_FILES = ['cues.json', 'vo.mp3'];

// What a given workdir must have before the board can open on it. An intro-film
// video is reviewed at gate 027, which runs BEFORE 030 authors a single cue, so
// cues.json cannot be a precondition there — that locked the Intro tab behind
// the body pass and made 027 unreachable in flow order.
//
// This is a function and not three inline filters because it WAS three: the
// 2026-08-06 fix exempted createServer and loadBoardData but missed
// requestedWorkdir, so the board booted on an intro-film video yet silently
// refused to SWITCH to one — ?video=<slug> fell through to the launch workdir
// and the owner reviewed the wrong video with the right URL in the bar.
export function bootFilesFor(workdir) {
  // The film owns the intro on every video (plan 194), and cues.json is not
  // written until the body pass — so it can never be a boot precondition.
  return BOOT_FILES.filter((n) => n !== 'cues.json');
}
// One definition, used by the storyboard tiles and the card plan rows alike.
// fbBox taught us what three drifting copies of the same control costs.

const REQUIRED_FILES = ['cues.json', 'resolved.json', 'vo.mp3'];

function videosRoot() {
  return path.join(path.resolve(import.meta.dirname, '..'), 'videos');
}

// resolve.mjs's main() CLI applies extendExposure as a post-pass on top of
// resolveCues; the board's save path must run the identical composition or
// every board save silently drops the exposure fix (background stays orange
// only until the owner edits anything).
export function resolveAndExtend(cues, words, catalog, cardLibraryRoot, workdir) {
  const { resolved, errors } = resolveCues(cues, words, catalog, cardLibraryRoot, workdir);
  if (errors.length) return { resolved, errors };
  const manifest = loadVideoManifest(workdir);
  const total = words.length ? words[words.length - 1].end + 1.0 : 0;

  const avatarJobsPath = path.join(workdir, 'avatar-jobs.json');
  let avatarJobs = null;
  if (fs.existsSync(avatarJobsPath)) {
    avatarJobs = JSON.parse(fs.readFileSync(avatarJobsPath, 'utf8'));
  }

  return { resolved: extendExposure(resolved, { base: manifest.base, total, avatarSpans: avatarFullSpans(avatarJobs) }), errors };
}

// Reads shots.json + computes resolved spans; null when the video has no shot
// plan yet — every caller must handle null and render the pre-078 board.
export function loadShots(workdir, words) {
  const p = path.join(workdir, 'shots.json');
  if (!fs.existsSync(p)) return null;
  let shotsFile;
  try { shotsFile = JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { return { shotsFile: null, spans: [], errors: [`shots.json unreadable: ${e.message}`] }; }
  const { spans, errors } = resolveShots(shotsFile, words);
  return { shotsFile, spans, errors };
}

export function appendFinalFeedback(feedback, label, item) {
  const updated = { ...feedback };
  if (!updated.items) updated.items = {};
  const prefix = `final-${label}:`;
  let maxIdx = -1;
  for (const k of Object.keys(updated.items)) {
    if (k.startsWith(prefix)) {
      const idx = parseInt(k.slice(prefix.length), 10);
      if (idx > maxIdx) maxIdx = idx;
    }
  }
  const nextKey = `${prefix}${maxIdx + 1}`;
  updated.items[nextKey] = { ...item };
  return updated;
}

// The intro has ONE deliverable (out/intro.mp4), so unlike final-cut there is no
// version axis and no label in the key. Same feedback.json, so the 130 fold sees
// intro notes and final-cut notes in one place with no extra plumbing.
export function appendIntroFeedback(feedback, item) {
  const updated = { ...feedback };
  if (!updated.items) updated.items = {};
  const prefix = 'intro:';
  let maxIdx = -1;
  for (const k of Object.keys(updated.items)) {
    if (k.startsWith(prefix)) {
      const idx = parseInt(k.slice(prefix.length), 10);
      if (Number.isFinite(idx) && idx > maxIdx) maxIdx = idx;
    }
  }
  const nextKey = `${prefix}${maxIdx + 1}`;
  updated.items[nextKey] = { ...item };
  return updated;
}

export function pinFromClick(clientX, clientY, rect) {
  const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
  return { x: +(x.toFixed(2)), y: +(y.toFixed(2)) };
}

// Merge semantics mirror handleSave's cue merge: key-order-insensitive
// compare; a real change to spans resets approval.
export function mergeShots(prevShotsFile, incomingSpans) {
  const canon = (v) => Array.isArray(v) ? v.map(canon)
    : (v && typeof v === 'object')
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]))
      : v;
  const merged = { ...prevShotsFile, spans: incomingSpans };
  const changed = JSON.stringify(canon(prevShotsFile.spans ?? [])) !== JSON.stringify(canon(incomingSpans ?? []));
  if (prevShotsFile.approved === true && changed) merged.approved = false;
  return { merged, changed };
}

// Reads effects.json; null when the video has no effects plan yet — every
// caller must handle null and render the pre-effects board.
export function loadEffects(workdir) {
  const p = path.join(workdir, 'effects.json');
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { return { instances: [], errors: [`effects.json unreadable: ${e.message}`] }; }
}

// Merge semantics mirror mergeShots: only `enabled` is board-writable;
// a real change resets approval.
export function mergeEffects(prevEffectsFile, toggles) {
  const canon = (v) => Array.isArray(v) ? v.map(canon)
    : (v && typeof v === 'object')
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]))
      : v;
  const byId = new Map((toggles ?? []).map((t) => [t.id, !!t.enabled]));
  const instances = (prevEffectsFile.instances ?? []).map((inst) =>
    byId.has(inst.id) ? { ...inst, enabled: byId.get(inst.id) } : inst);
  const changed = JSON.stringify(canon(prevEffectsFile.instances ?? [])) !== JSON.stringify(canon(instances));
  const merged = { ...prevEffectsFile, instances };
  if (prevEffectsFile.approved === true && changed) merged.approved = false;
  return { merged, changed };
}

// Owner-side pair of plan 142's audit gate: accepting a labelled verdict
// writes accepted: true; un-accepting drops the field entirely rather than
// writing false, so audit.json stays terse for items nobody has touched.
export function toggleAuditAccepted(audit, id, accepted) {
  const cues = { ...(audit?.cues ?? {}) };
  const item = cues[id];
  if (!item) return { ...audit, cues };
  if (accepted) {
    cues[id] = { ...item, accepted: true };
  } else {
    const { accepted: _drop, ...rest } = item;
    cues[id] = rest;
  }
  return { ...audit, cues };
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function injectShim(html, variables, isStatic) {
  const staticCss = isStatic ? `<style>*, *::before, *::after { animation: none !important; transition: none !important; }</style>` : '';
  const varsJson = JSON.stringify(variables ?? {}).replace(/</g, '\\u003c');
  const shim = `${staticCss}<script>
  window.__hyperframes = { getVariables: () => (${varsJson}) };
  function __hfSeek(t) {
    const tls = Object.values(window.__timelines || {});
    if (!tls.length) return false;
    const tl = tls[0];
    tl.pause();
    tl.time(Math.min(t, tl.duration()));
    return true;
  }
  ${MEASURE_OVERFLOW_SRC}
  function __runProbe(times) {
    let i = 0;
    function step() {
      if (i >= times.length) { parent.postMessage({ __overflowDone: true }, '*'); return; }
      const t = times[i++];
      __hfSeek(t);
      requestAnimationFrame(() => {
        const result = __measureOverflow();
        if (result.broken) parent.postMessage({ __overflow: { t, broken: result.broken, offenders: result.offenders } }, '*');
        step();
      });
    }
    step();
  }
  window.addEventListener('message', (e) => {
    if (!e.data) return;
    if (Array.isArray(e.data.probe)) { __runProbe(e.data.probe); return; }
    if (typeof e.data.t === 'number') __hfSeek(e.data.t);
  });
</script>
`;
  const idx = html.search(/<script/i);
  if (idx === -1) return shim + html;
  return html.slice(0, idx) + shim + html.slice(idx);
}

function ensureSlices(workdir) {
  const resolvedPath = path.join(workdir, 'resolved.json');
  // Slices are cut per RESOLVED cue, so before 040 there is nothing to cut.
  // The Card Plan and Run tabs play no per-cue audio, so this is a clean no-op.
  if (!fs.existsSync(resolvedPath)) return;
  const { resolved } = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  const slicesDir = path.join(workdir, 'slices');
  fs.mkdirSync(slicesDir, { recursive: true });
  const indexFile = path.join(slicesDir, '.index.json');
  const cache = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : {};
  const newCache = {};
  const voPath = path.join(workdir, 'vo.mp3');
  for (const cue of resolved) {
    const slicePath = path.join(slicesDir, `${cue.id}.mp3`);
    const key = `${cue.start}:${cue.duration}`;
    newCache[cue.id] = key;
    const stale = !fs.existsSync(slicePath) || cache[cue.id] !== key;
    if (!stale) continue;
    const result = spawnSync('ffmpeg', [
      '-y', '-ss', String(cue.start), '-t', String(cue.duration),
      '-i', voPath, '-c:a', 'libmp3lame', '-q:a', '4',
      slicePath,
    ], { encoding: 'utf8' });
    if (result.status !== 0) {
      console.error(`slice failed for ${cue.id}: ${result.stderr || result.error}`);
    }
  }
  for (const oldId of Object.keys(cache)) {
    if (!newCache[oldId]) {
      const p = path.join(slicesDir, `${oldId}.mp3`);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  }
  fs.writeFileSync(indexFile, JSON.stringify(newCache, null, 2));
}

// One slice, cut lazily at request time. The bulk ensureSlices used to run
// synchronously BEFORE the page response whenever a video was opened or
// switched — 30+ ffmpeg cuts of dead air with a blank browser ("Waiting for
// localhost…", owner report 2026-07-31). Pages now respond instantly and a
// slice is cut the moment its audio is actually requested (~100ms, and tile
// audios use preload="none" so nothing stampedes). ensureSlices remains on
// the SAVE path only, where its prune-stale-slices half matters.
function ensureSlice(workdir, id) {
  const resolvedPath = path.join(workdir, 'resolved.json');
  if (!fs.existsSync(resolvedPath)) return null;
  const { resolved } = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  const cue = resolved.find((c) => c.id === id);
  if (!cue) return null;
  const slicesDir = path.join(workdir, 'slices');
  fs.mkdirSync(slicesDir, { recursive: true });
  const slicePath = path.join(slicesDir, `${id}.mp3`);
  const indexFile = path.join(slicesDir, '.index.json');
  const cache = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : {};
  const key = `${cue.start}:${cue.duration}`;
  if (fs.existsSync(slicePath) && cache[id] === key) return slicePath;
  const result = spawnSync('ffmpeg', [
    '-y', '-ss', String(cue.start), '-t', String(cue.duration),
    '-i', path.join(workdir, 'vo.mp3'), '-c:a', 'libmp3lame', '-q:a', '4',
    slicePath,
  ], { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(`slice failed for ${id}: ${result.stderr || result.error}`);
    return null;
  }
  cache[id] = key;
  fs.writeFileSync(indexFile, JSON.stringify(cache, null, 2));
  return slicePath;
}

function ensurePoster(workdir, id) {
  const resolvedPath = path.join(workdir, 'resolved.json');
  if (!fs.existsSync(resolvedPath)) return null;
  const { resolved } = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  const cue = resolved.find((c) => c.id === id);
  if (!cue) return null;

  const rendersDir = path.join(workdir, 'renders');
  const renderPath = path.join(rendersDir, `${id}.mp4`);
  if (!fs.existsSync(renderPath)) return null;

  const postersDir = path.join(workdir, '.posters');
  if (!fs.existsSync(postersDir)) fs.mkdirSync(postersDir, { recursive: true });
  const posterPath = path.join(postersDir, `${id}.jpg`);

  if (fs.existsSync(posterPath)) return posterPath;

  let frameTime = cue.duration * 0.6;
  if (cue.beats && cue.beats.length > 0) {
    frameTime = cue.beats[cue.beats.length - 1].at + 0.35;
  }

  const result = spawnSync('ffmpeg', [
    '-y', '-ss', String(frameTime), '-i', renderPath,
    '-vframes', '1', '-q:v', '2', posterPath
  ], { encoding: 'utf8' });

  if (result.status !== 0) {
    console.error(`poster failed for ${id}: ${result.stderr || result.error}`);
    return null;
  }
  return posterPath;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

// Run tab. The status lives on the RIGHT as an emoji, so the eye scans one
// column to see where the video is instead of reading every row.


// Styles for the / (timeline) view only — appended alongside BOARD_CSS.

// Shared client script for both / (board) and /calibrate: posts each tile's
// probe times into its iframe on load, and turns broken reports into a badge
// on the tile header. Kept as one string so the two pages can't drift.

// initBlock(root): wire probe + audio<->iframe sync for every .tile inside
// `root` that hasn't been wired yet. Idempotent (data-inited guard) so it's
// safe to call again when the timeline dock reveals a previously-parked
// block. Shared by /list (whole-document init) and / (per-block, on reveal).

// Shared Save/Approve wiring — reads VIDEO/APPROVED (page-local consts) and
// the current DOM's .tile/.shot-block/.feedback elements. Both / and /list
// use the identical handlers so save/approve semantics can't drift between
// the two views.

function timecode(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
}

export const FX_SIM_HELPERS = `
function fxContext(t, fullframes, spans) {
  if (fullframes.some((f) => t >= f.start && t < f.end)) return 'graphic';
  if (spans.some((s) => t >= s.start && t < s.end)) return 'avatar';
  return 'screen';
}
function fxEventsAt(prevT, t, instances) {
  return instances.filter((i) => i.enabled && typeof i.at === 'number' && i.at > prevT && i.at <= t);
}
`;
// Node-side bindings for tests:
const fxSim = {};
new Function('exports', FX_SIM_HELPERS
  + '\nexports.fxContext = fxContext; exports.fxEventsAt = fxEventsAt;')(fxSim);
export const { fxContext, fxEventsAt } = fxSim;

// Which block the master clock's play-through is inside, given a flat list
// of { id, start, kind: 'cue'|'gap' } ordered by start. Shared by the
// storyboard tab's timeupdate handler and this test file so the two can't
// drift: a gap block gets a countdown to the next cue instead of the plain
// text-panel reveal cue blocks get.
export const PLAYTHROUGH_HELPERS = `
function playthroughView(blocks, t) {
  let active = null;
  for (const b of blocks) {
    if (b.start <= t) active = b;
  }
  if (!active) return null;
  if (active.kind === 'gap') {
    const next = blocks.find((b) => b.kind === 'cue' && b.start > active.start);
    return { kind: 'gap', id: active.id, nextStart: next ? next.start : null };
  }
  return { kind: 'cue', id: active.id };
}
`;
// Node-side bindings for tests:
const playthroughSim = {};
new Function('exports', PLAYTHROUGH_HELPERS + '\nexports.playthroughView = playthroughView;')(playthroughSim);
export const { playthroughView } = playthroughSim;

// Probe times for the overflow shim: just after each beat reveals, plus just
// before the card ends (catches a final state that never got a mid-beat check).


export function buildSegments(words, resolved, { gapMinWords = 8 } = {}) {
  const cues = [...resolved].sort((a, b) => a.start - b.start);
  const wordToCue = new Map();
  for (const w of words) {
    const c = cues.find(c => w.start >= c.start && w.start < c.start + c.duration);
    if (c) wordToCue.set(w, c);
  }

  const cueSegs = cues.map(c => ({
    kind: 'cue', cue: c, start: c.start, end: c.start + c.duration, words: []
  }));
  const cueSegByCue = new Map(cueSegs.map(s => [s.cue, s]));

  for (const w of words) {
    const c = wordToCue.get(w);
    if (c) cueSegByCue.get(c).words.push(w);
  }

  const items = [];
  for (const s of cueSegs) items.push({ type: 'cue', start: s.start, item: s });
  for (const w of words) {
    if (!wordToCue.has(w)) items.push({ type: 'word', start: w.start, item: w });
  }

  items.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    if (a.type !== b.type) return a.type === 'cue' ? -1 : 1;
    return 0;
  });

  const segments = [];
  let currentGap = null;
  for (const x of items) {
    if (x.type === 'word') {
      if (!currentGap) {
        currentGap = { kind: 'gap', start: x.item.start, end: x.item.end, words: [] };
        segments.push(currentGap);
      }
      currentGap.words.push(x.item);
      currentGap.end = x.item.end;
    } else {
      segments.push(x.item);
      currentGap = null;
    }
  }

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.kind === 'gap' && seg.words.length < gapMinWords && i + 1 < segments.length) {
      const next = segments[i + 1];
      next.words = [...seg.words, ...next.words];
      if (seg.start < next.start) next.start = seg.start;
      segments.splice(i, 1);
      i--;
    }
  }

  return segments;
}

function normalizeFeedbackItems(raw) {
  const items = {};
  for (const [ref, v] of Object.entries(raw ?? {})) {
    if (typeof v === 'string') items[ref] = { text: v };
    else if (v && typeof v === 'object' && typeof v.text === 'string') items[ref] = v;
  }
  return items;
}

// Returns an ordered array of { html, start, id, isShot } for every cue tile,
// gap block, and shot block — the single source of per-block detail HTML for
// both the timeline dock and the /list view. `id` is the DOM id the block
// HTML itself carries (`seg-<i>` for cue/gap, `shot-<span.id>` for shots).


// The board's default (`/`) landing page: a horizontal, editor-style timeline
// (SCREEN/GRAPHICS/AVATAR/EFFECTS lanes on one time ruler) with on-demand
// previews — clicking a block moves its buildDetailBlocks HTML (shared with
// /list) into a docked panel and only then loads its card iframe. Delivers
// GFX-08 (global play-through) via the master playhead.

// Screenshot attachment, shared by the Final Cut and Storyboard feedback paths.
// Saved beside feedback.json so the fixing session can Read the image directly
// (gitignored — media). Returns the workdir-relative path, or null if the
// payload was not a usable image.
export function saveFeedbackImage(workdir, key, dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const m = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/s);
  if (!m || m[2].length >= 9_000_000) return null;
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const dir = path.join(workdir, 'feedback-images');
  fs.mkdirSync(dir, { recursive: true });
  const fname = String(key).replace(/[^a-zA-Z0-9_-]/g, '-') + '.' + ext;
  fs.writeFileSync(path.join(dir, fname), Buffer.from(m[2], 'base64'));
  return 'feedback-images/' + fname;
}

// The tab-id -> review-namespace relation is NOT derivable from the registry
// alone (final-cut's namespace is "final", not "final-cut") — this is the one
// remaining hand-maintained map (decisions.md 2026-08-06, plan 193). Adding a
// row is a conscious act; guess a rule from these two data points and the next
// tab breaks it.
export const TAB_NAMESPACE = { intro: 'intro', 'final-cut': 'final' };

// THE EXTENSION POINT for a new review step — now derived, not maintained. A
// step declares `tab` and `gate` in its steps/<slug>/step.json; its review
// namespace is its tab id looked up in TAB_NAMESPACE above. Add the step, get
// edit + delete, change no code here (decisions.md 2026-08-06).
//
// STILL deliberately a closed list and NOT a permissive "anything:<n>"
// pattern: cue:7 is a storyboard cue note owned by a different surface with
// its own lifecycle, and letting this endpoint delete one is how a comment
// disappears from a tab that never offered to delete it.
export function reviewNamespacesFromRegistry(steps = null) {
  const namespaces = new Set();
  for (const s of (steps ?? loadSteps())) {
    if (!s.tab || !s.gate) continue;
    const ns = TAB_NAMESPACE[s.tab];
    if (ns) namespaces.add(ns);
  }
  return [...namespaces];
}

export const REVIEW_NAMESPACES = reviewNamespacesFromRegistry();

// A renumber can no longer desync a gate from the step it approves: this
// resolves the CURRENT number for the step that owns `gateFile`, keyed off
// the registry rather than a literal string baked in at every call site.
export function gateNumberFor(gateFile) {
  const hit = loadSteps().find((s) => s.gate?.file === gateFile);
  if (!hit) throw new Error(`E-BOARD no step declares a gate on "${gateFile}"`);
  return hit.number;
}

export function isEditableKey(key) {
  const m = /^([a-z0-9][a-z0-9-]*):\d+$/i.exec(String(key ?? ''));
  if (!m) return false;
  const ns = m[1].toLowerCase();
  return REVIEW_NAMESPACES.some((n) => ns === n || ns.startsWith(`${n}-`));
}

// Re-rendered media MUST win over whatever the browser already has. Both the
// intro film and its review frames keep the SAME path across re-renders, so a
// cached copy is indistinguishable from the fresh one by URL alone — the owner
// re-renders after giving feedback and is shown the film they just critiqued,
// with nothing on screen to say so. /intro-frame made this certain by claiming
// max-age=31536000: a year of immutability on a file that is rewritten by every
// review pass. /intro-video claimed nothing at all, which leaves it to the
// browser's heuristics (owner report 2026-08-06).
//
// no-cache is not no-store: the browser MAY keep the bytes, but must revalidate
// before reusing them. With a validator derived from mtime+size that costs one
// conditional request and a 304 when nothing changed — so the 36-frame beat
// sheet stays fast — while a re-render always sends the new bytes.
export function mediaValidator(stat) {
  return `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
}

export function serveRevalidating(req, res, stat) {
  const etag = mediaValidator(stat);
  res.setHeader('etag', etag);
  res.setHeader('last-modified', new Date(stat.mtimeMs).toUTCString());
  res.setHeader('cache-control', 'no-cache');
  if (req.headers['if-none-match'] === etag) {
    res.statusCode = 304;
    res.end();
    return true;      // caller must stop: 304 carries no body
  }
  return false;
}

// A comment can carry SEVERAL screenshots — one frame rarely shows a whole
// problem. `images` is the canonical field; `image` is the pre-2026-08-06
// single-shot form and stays readable forever, because feedback.json files
// already on disk carry it and a review comment is a record, not a cache.
// Every reader goes through here so the two shapes cannot drift.
export function itemImages(item) {
  if (Array.isArray(item?.images)) return item.images.filter((p) => typeof p === 'string');
  return typeof item?.image === 'string' ? [item.image] : [];
}

// Indexed names, so a second screenshot cannot land on the first one's path.
// The legacy single-image name is `<key>.<ext>`; these are `<key>-<n>.<ext>`,
// which cannot collide with it.
export function saveFeedbackImages(workdir, key, dataUrls) {
  const list = Array.isArray(dataUrls) ? dataUrls : (typeof dataUrls === 'string' ? [dataUrls] : []);
  const out = [];
  for (const [i, url] of list.entries()) {
    const saved = saveFeedbackImage(workdir, `${key}-${i}`, url);
    if (saved) out.push(saved);
  }
  return out;
}

// Deleting a comment must take its screenshots with it, or feedback-images/
// fills with orphans nothing references.
export function dropFeedbackImage(workdir, item) {
  for (const rel of itemImages(item)) {
    const p = path.join(workdir, rel);
    if (p.startsWith(path.join(workdir, 'feedback-images'))) fs.rmSync(p, { force: true });
  }
}

async function handleSave(req, res, workdir, cardLibraryRoot) {
  const body = await readBody(req);
  let cuesFile;
  try {
    cuesFile = JSON.parse(body);
  } catch (err) {
    res.statusCode = 400;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: false, errors: [`invalid JSON: ${err.message}`] }));
  }

  const cuesPath = path.join(workdir, 'cues.json');
  // Merge over the existing file so top-level fields the client doesn't send
  // (offset, future additions) survive a save. feedback is board-only — it goes
  // to feedback.json, never into cues.json.
  const prev = fs.existsSync(cuesPath) ? JSON.parse(fs.readFileSync(cuesPath, 'utf8')) : {};
  const { feedback, feedbackImages, ...incoming } = cuesFile;
  const merged = { ...prev, ...incoming };

  // key-order-insensitive comparison — cues.json may have been written by a
  // script with different key order than the board's serializer; raw
  // JSON.stringify would false-positive and silently un-approve.
  const canon = (v) => Array.isArray(v) ? v.map(canon)
    : (v && typeof v === 'object')
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]))
      : v;
  const cuesChanged = JSON.stringify(canon(prev.cues ?? [])) !== JSON.stringify(canon(incoming.cues ?? []));
  if (prev.approved === true && cuesChanged) {
    merged.approved = false;
  }

  fs.writeFileSync(cuesPath, JSON.stringify(merged, null, 2));

  const words = JSON.parse(fs.readFileSync(path.join(workdir, 'transcript.json'), 'utf8'));
  const catalog = JSON.parse(fs.readFileSync(path.join(cardLibraryRoot, 'catalog.json'), 'utf8'));
  const { resolved, errors } = resolveAndExtend(merged.cues ?? [], words, catalog, cardLibraryRoot, workdir);

  let mergedShots = null;
  let resolvedSpans = null;
  let shotErrors = null;
  const shotWarnings = [];
  const shotsPath = path.join(workdir, 'shots.json');
  if (fs.existsSync(shotsPath)) {
    const prevShotsFile = JSON.parse(fs.readFileSync(shotsPath, 'utf8'));
    mergedShots = prevShotsFile;
    if (cuesFile.spans !== undefined) {
      const { merged } = mergeShots(prevShotsFile, cuesFile.spans);
      mergedShots = merged;
    }
    if (cuesChanged && mergedShots.approved === true) {
      mergedShots.approved = false;
      shotWarnings.push('shots: un-approved — cues changed after shot approval (re-review the shot plan)');
    }
    fs.writeFileSync(shotsPath, JSON.stringify(mergedShots, null, 2));
    const resShots = resolveShots(mergedShots, words);
    resolvedSpans = resShots.spans;
    shotErrors = resShots.errors;
  }

  if (feedback && typeof feedback === 'object') {
    const fbPath = path.join(workdir, 'feedback.json');
    const existing = fs.existsSync(fbPath)
      ? normalizeFeedbackItems(JSON.parse(fs.readFileSync(fbPath, 'utf8')).items)
      : {};
    const items = { ...existing };
    const today = new Date().toISOString().slice(0, 10);
    const segments = buildSegments(words, resolved);
    const gaps = segments.filter(s => s.kind === 'gap');

    for (const [ref, v] of Object.entries(feedback ?? {})) {
      const text = String(v ?? '').trim();
      if (items[ref]?.folded) continue;            // folded items are immutable here
      if (!text) { dropFeedbackImage(workdir, items[ref]); delete items[ref]; continue; }
      if (items[ref]?.text !== text) {
        if (!items[ref]) {
          const item = { text, added: today };
          // Review rounds append a `#N` suffix (`c20#2`) so folded round-1
          // items stay immutable history — context still resolves against the
          // base cue/span id (owner report 2026-07-31).
          const baseRef = ref.includes('#') ? ref.slice(0, ref.indexOf('#')) : ref;
          if (ref.startsWith('gap-')) {
            const gap = gaps.find(g => `gap-${timecode(g.start)}` === baseRef);
            if (gap) {
              item.context = { start: gap.start, end: gap.end, excerpt: gap.words.slice(0, 8).map(w => w.text).join(' ') };
            }
          } else if (baseRef !== '_global') {
            const span = (mergedShots?.spans ?? []).find(s => s.id === baseRef);
            const rSpan = (resolvedSpans ?? []).find(s => s.id === baseRef);
            if (span && rSpan) {
              item.context = { start: rSpan.start, end: rSpan.end, note: span.note };
            } else {
              const cue = (merged.cues ?? []).find(c => c.id === baseRef);
              const r = resolved.find(c => c.id === baseRef);
              if (cue) {
                item.context = { card: cue.card, anchor: cue.anchor };
                if (r) item.context.start = r.start;
              }
            }
          }
          items[ref] = item;
        } else {
          items[ref] = { ...items[ref], text };
        }
      }
    }

    // Attach screenshots. Kept OUT of the text loop on purpose: that loop only
    // fires when the text changed, and attaching a screenshot to a comment you
    // already wrote is the common case. `null` clears an existing one.
    for (const [ref, dataUrl] of Object.entries(feedbackImages ?? {})) {
      if (!items[ref] || items[ref].folded) continue;
      if (dataUrl === null) {
        dropFeedbackImage(workdir, items[ref]);
        const { image, ...rest } = items[ref];
        items[ref] = rest;
        continue;
      }
      const saved = saveFeedbackImage(workdir, ref, dataUrl);
      if (saved) items[ref] = { ...items[ref], image: saved };
    }

    fs.writeFileSync(fbPath, JSON.stringify({ video: merged.video, updated: today, items }, null, 2));
  }

  res.setHeader('content-type', 'application/json');
  if (errors.length) {
    return res.end(JSON.stringify({ ok: false, errors }));
  }
  
  const resErrors = [];
  const resWarnings = [...shotWarnings];
  const resWarningsEffects = [];

  const effectsPath = path.join(workdir, 'effects.json');
  if (fs.existsSync(effectsPath)) {
    let mergedEffects = JSON.parse(fs.readFileSync(effectsPath, 'utf8'));
    if (cuesFile.effects !== undefined) {
      const prevApproved = mergedEffects.approved === true;
      const { merged, changed } = mergeEffects(mergedEffects, cuesFile.effects);
      mergedEffects = merged;
      if (prevApproved && changed) resWarningsEffects.push('effects: un-approved — effects changed after approval (re-approve on the board)');
    }
    if (cuesChanged && mergedEffects.approved === true) {
      mergedEffects.approved = false;
      resWarningsEffects.push('effects: un-approved — cues changed after effects approval (re-run node lib/effects-plan.mjs and re-review)');
    }
    fs.writeFileSync(effectsPath, JSON.stringify(mergedEffects, null, 2));
  }

  if (mergedShots) {
    if (shotErrors && shotErrors.length > 0) {
      resErrors.push(...shotErrors.map(e => `shots: ${e}`));
    } else {
      fs.writeFileSync(
        path.join(workdir, 'shots.resolved.json'),
        JSON.stringify({ video: mergedShots.video, offset: mergedShots.offset ?? 0, engineMode: mergedShots.engineMode ?? 'test', spans: resolvedSpans }, null, 2)
      );
      const { lintShots } = await import('./lint-shots.mjs');
      const { introSpan } = await import('./intro-modes.mjs');
      const { errors: sErrors, warnings: sWarnings } = lintShots({ shotsResolved: resolvedSpans, resolvedCues: resolved, words, filmSpan: introSpan(workdir) });
      if (sErrors) resErrors.push(...sErrors.map(e => `shots: ${e}`));
      if (sWarnings) resWarnings.push(...sWarnings.map(w => `shots: ${w}`));
    }
  }

  const { errors: lintErrors, warnings: lintWarnings } = lintCues({ cuesFile: merged, resolved, words, catalog });
  resErrors.push(...lintErrors);
  resWarnings.push(...lintWarnings);
  resWarnings.push(...resWarningsEffects);

  fs.writeFileSync(
    path.join(workdir, 'resolved.json'),
    JSON.stringify({ video: merged.video, offset: merged.offset ?? 0, resolved }, null, 2),
  );
  ensureSlices(workdir);
  res.end(JSON.stringify({ ok: true, errors: resErrors, warnings: resWarnings }));
}

// Gates are recorded in the ledger by the board itself, at the moment the owner
// clicks approve. Doing it here and not asking a session to remember is the
// whole lesson of the claude_status.json / feedback.json split brain: a status
// written by a second hand drifts from the thing it claims to describe.
// A ledger write must never break an approval, so it is best-effort.
function recordGate(workdir, stepNumber, did, output) {
  try {
    const id = resolveStepId(stepNumber);
    writeRunLog(workdir, setStep(readRunLog(workdir), id, 'done', { did, output }));
  } catch (e) {
    console.error(`run-log: could not record ${stepNumber}: ${e.message}`);
  }
}

// 080 approves BOTH the graphics and the avatar shots, and they are two
// separate clicks. Recording it done on the first click would claim a gate
// passed that the owner is still halfway through, so it stays `running` with
// the outstanding half named until both are in.
function recordStoryboardGate(workdir) {
  const approved = (name) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(workdir, name), 'utf8')).approved === true;
    } catch {
      return false;
    }
  };
  const cues = approved('cues.json');
  const shots = approved('shots.json');
  const hasShots = fs.existsSync(path.join(workdir, 'shots.json'));

  // A video with no avatar pass has no shots to approve, so cues alone finish it.
  if (cues && (shots || !hasShots)) {
    recordGate(
      workdir,
      gateNumberFor('cues.json'),
      hasShots
        ? 'Owner approved the storyboard composition: graphics and avatar shots.'
        : 'Owner approved the storyboard composition (graphics; this video has no avatar shots).',
      hasShots ? 'cues.json + shots.json approved=true' : 'cues.json approved=true',
    );
    return;
  }
  try {
    const waiting = !cues ? 'graphics' : 'avatar shots';
    writeRunLog(
      workdir,
      setStep(readRunLog(workdir), resolveStepId('080'), 'running', {
        issues: `waiting on the owner to approve the ${waiting}`,
      }),
    );
  } catch (e) {
    console.error(`run-log: could not record 080: ${e.message}`);
  }
}

async function handleApprove(req, res, workdir) {
  await readBody(req);
  const cuesPath = path.join(workdir, 'cues.json');
  const cuesFile = JSON.parse(fs.readFileSync(cuesPath, 'utf8'));
  cuesFile.approved = true;
  fs.writeFileSync(cuesPath, JSON.stringify(cuesFile, null, 2));
  recordStoryboardGate(workdir);
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ ok: true }));
}



async function handleApproveShots(req, res, workdir) {
  await readBody(req);
  const shotsPath = path.join(workdir, 'shots.json');
  const shotsFile = JSON.parse(fs.readFileSync(shotsPath, 'utf8'));
  shotsFile.approved = true;
  fs.writeFileSync(shotsPath, JSON.stringify(shotsFile, null, 2));
  recordStoryboardGate(workdir);
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ ok: true }));
}

async function handleApproveEffects(req, res, workdir) {
  await readBody(req);
  const effectsPath = path.join(workdir, 'effects.json');
  const effectsFile = JSON.parse(fs.readFileSync(effectsPath, 'utf8'));
  effectsFile.approved = true;
  fs.writeFileSync(effectsPath, JSON.stringify(effectsFile, null, 2));
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ ok: true }));
}

async function handleApproveFinalCut(req, res, workdir) {
  const body = await readBody(req);
  let payload;
  try { payload = JSON.parse(body); } catch(e) { res.statusCode = 400; return res.end('{"ok":false}'); }
  if (!payload.version) { res.statusCode = 400; return res.end('{"ok":false,"error":"missing version"}'); }
  const fcPath = path.join(workdir, 'final-cut.json');
  const fc = { approved: true, version: payload.version };
  fs.writeFileSync(fcPath, JSON.stringify(fc, null, 2));
  recordGate(workdir, gateNumberFor('final-cut.json'), `Owner approved the final cut (version ${payload.version}).`, `final-cut.json approved=true, version ${payload.version}`);
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ ok: true }));
}

// Gate 028. Approving sets BOTH chosen and approved, in one write — an
// approval with no chosen id is meaningless (plan 197).
async function handleApproveIntroIdea(req, res, workdir) {
  const body = await readBody(req);
  let payload;
  try { payload = JSON.parse(body); } catch (e) { res.statusCode = 400; return res.end('{"ok":false}'); }
  const chosen = String(payload.chosen ?? '').trim();
  if (!chosen) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'missing chosen direction id' })); }

  const ideaPath = path.join(workdir, 'intro-film', 'idea.json');
  if (!fs.existsSync(ideaPath)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'intro-film/idea.json does not exist yet' })); }
  const idea = JSON.parse(fs.readFileSync(ideaPath, 'utf8'));
  if (!(idea.directions || []).some((d) => d.id === chosen)) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: `unknown direction id "${chosen}"` }));
  }
  idea.chosen = chosen;
  idea.approved = true;
  fs.writeFileSync(ideaPath, JSON.stringify(idea, null, 2) + '\n');
  recordGate(workdir, gateNumberFor('intro-film/idea.json'), `Owner approved the intro idea: direction "${chosen}".`, `intro-film/idea.json approved=true, chosen=${chosen}`);
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ ok: true }));
}

// Gate 102 — the avatar spend gate. Approving writes character, model and
// approved TOGETHER; a POST missing either is refused rather than leaving a
// half-approved plan (plan 197 — an approval with no character/model
// authorises spend against nothing in particular).
async function handleApproveAvatarPlan(req, res, workdir) {
  const body = await readBody(req);
  let payload;
  try { payload = JSON.parse(body); } catch (e) { res.statusCode = 400; return res.end('{"ok":false}'); }
  const character = String(payload.character ?? '').trim();
  const model = String(payload.model ?? '').trim();
  if (!character || !model) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: 'both character and model are required' }));
  }

  const shotsResolvedPath = path.join(workdir, 'shots.resolved.json');
  if (!fs.existsSync(shotsResolvedPath)) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: 'shots.resolved.json does not exist yet — run storyboard-check first' }));
  }
  const shotsResolved = JSON.parse(fs.readFileSync(shotsResolvedPath, 'utf8'));
  const registry = loadRegistry();
  const fresh = buildAvatarPlan({ workdir, shotsResolved, registry });
  const plan = { ...fresh, character, model, approved: true };
  fs.writeFileSync(avatarPlanPath(workdir), JSON.stringify(plan, null, 2) + '\n');
  recordGate(
    workdir,
    gateNumberFor('avatar-plan.json'),
    `Owner approved the avatar spend: ${character} on ${model} (${plan.clips} clips, ${plan.seconds}s).`,
    `avatar-plan.json approved=true, character=${character}, model=${model}`,
  );
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ ok: true }));
}

function fillerText(chars) {
  if (chars <= 0) return '';
  let s = '';
  while (s.length < chars) s += 'Mmmmmm ';
  return s.slice(0, chars);
}

function parseEnumOptions(descriptor) {
  if (!descriptor) return null;
  const quoted = descriptor.match(/'([^']+)'/g);
  return quoted && quoted.length >= 2 ? quoted.map((q) => q.slice(1, -1)) : null;
}

// Fields where the generic string/array/number/enum rules below produce
// something meaningless — see plan 074's synthCalibrationVars step.
const CALIBRATE_OVERRIDES = {
  'verdict/verdict-report-card': {
    // color is a CSS value the card applies directly, not display text —
    // max_reveal_chars filler here would just render an invalid color
    // instead of stress-testing layout. Cycle the design system's real
    // accent/gold tokens (DESIGN.md) instead.
    beatField: (key, i) => (key === 'color' ? (i % 2 === 0 ? '#facc15' : '#fb923c') : undefined),
  },
};

// Builds variables + beats that fill a beat card to its declared caps
// (max_beats, max_reveal_chars) for /calibrate. See plan 074 and
// card-library/DESIGN.md's "measure honestly" checklist item.
export function synthCalibrationVars(card) {
  const maxBeats = card.max_beats ?? 0;
  const maxChars = card.beat_source === 'variables' ? undefined : (card.max_reveal_chars ?? 20);
  const override = CALIBRATE_OVERRIDES[card.slug] ?? {};

  const variables = {};
  for (const [key, spec] of Object.entries(card.variables ?? {})) {
    if (card.beat_source === 'variables' && key === card.beat_var) {
      const arr = [];
      for (let i = 0; i < maxBeats; i++) {
        if (spec.item_shape) {
          const item = {};
          for (const [k, v] of Object.entries(spec.item_shape)) {
            const isStr = typeof v === 'string';
            const desc = isStr ? v : (v.descriptor || v.type || '');
            if (isStr ? /^number/i.test(desc) : v.type === 'number') item[k] = 88;
            else if (isStr ? /^boolean/i.test(desc) : v.type === 'boolean') item[k] = i % 2 === 0;
            else item[k] = `Calibration ${i + 1}`;
          }
          arr.push(item);
        } else {
          arr.push(`Calibration ${i + 1}`);
        }
      }
      variables[key] = arr;
      continue;
    }

    const isString = typeof spec === 'string';
    const desc = isString ? spec : (spec.descriptor || spec.type || '');
    if (isString ? /\(optional\)/i.test(desc) : spec.required === false) continue;
    if (isString ? /^array/i.test(desc) : spec.type === 'array') variables[key] = ['Calibration one', 'Calibration two', 'Calibration three'];
    else if (isString ? /^number/i.test(desc) : spec.type === 'number') variables[key] = 88;
    else variables[key] = 'Calibration title';
  }

  const beats = [];
  for (let i = 0; i < maxBeats; i++) {
    const beat = { at: +((i + 1) * (card.default_duration / (maxBeats + 1))).toFixed(2) };
    if (card.beat_source !== 'variables') {
      for (const [key, spec] of Object.entries(card.beat_shape ?? {})) {
        const isString = typeof spec === 'string';
        const desc = isString ? spec : (spec.descriptor || spec.type || '');
        if (isString ? /\(optional\)/i.test(desc) : spec.required === false) continue;
        const overridden = override.beatField?.(key, i);
        if (overridden !== undefined) { beat[key] = overridden; continue; }
        // values arrays keyed one-per-product ride along whatever "products" synthesized to.
        if (key === 'values' && Array.isArray(variables.products) && (isString ? /per product/i.test(desc) : spec.type === 'array')) {
          beat.values = variables.products.map((_, j) => (
            /true\/false/i.test(desc) && j % 2 === 0 ? true : fillerText(maxChars)
          ));
          continue;
        }
        const enumOpts = isString ? parseEnumOptions(desc) : (spec.enum || parseEnumOptions(desc));
        if (enumOpts) { beat[key] = enumOpts[i % enumOpts.length]; continue; }
        if (isString ? /^number/i.test(desc) : spec.type === 'number') { beat[key] = 88; continue; }
        beat[key] = fillerText(maxChars);
      }
    }
    beats.push(beat);
  }

  return { variables, beats };
}


function serveCalibrateCard(res, cardLibraryRoot, catalog, slug) {
  const card = catalog.cards.find((c) => c.slug === slug && c.kind === 'beat');
  if (!card) {
    res.statusCode = 404;
    return res.end('unknown beat card');
  }
  const indexPath = path.join(cardLibraryRoot, card.slug, 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');
  const { variables, beats } = synthCalibrationVars(card);
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(injectShim(html, { ...variables, beats }));
}

function serveCard(res, workdir, cardLibraryRoot, id, isStatic) {
  const { resolved } = JSON.parse(fs.readFileSync(path.join(workdir, 'resolved.json'), 'utf8'));
  const cue = resolved.find((c) => c.id === id);
  if (!cue) {
    res.statusCode = 404;
    return res.end('cue has no resolved timing');
  }
  const indexPath = path.join(cardLibraryRoot, cue.card, 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  const { variables: enrichedVars } = enrichLogos(cue.variables, cardLibraryRoot);
  const root = path.resolve(import.meta.dirname, '..');
  const manifest = fs.existsSync(path.join(workdir, 'manifest.json')) ? loadVideoManifest(workdir) : {};
  const brand = loadBrand(root, manifest);
  const brandedHtml = injectBrand(html, brand);
  res.end(injectShim(brandedHtml, enrichedVars, isStatic));
}

function serveSlice(res, workdir, id) {
  // Cut lazily — see ensureSlice. Falls back to a pre-cut file so a slice
  // from the save-path bulk refresh still serves if resolved.json vanished.
  const slicePath = ensureSlice(workdir, id) ?? path.join(workdir, 'slices', `${id}.mp3`);
  if (!fs.existsSync(slicePath)) {
    res.statusCode = 404;
    return res.end('slice not found');
  }
  res.setHeader('content-type', 'audio/mpeg');
  res.setHeader('cache-control', 'no-store');
  res.end(fs.readFileSync(slicePath));
}

function servePoster(res, workdir, id) {
  const posterPath = ensurePoster(workdir, id);
  if (!posterPath) {
    res.statusCode = 404;
    return res.end('poster not found');
  }
  res.setHeader('content-type', 'image/jpeg');
  res.setHeader('cache-control', 'public, max-age=31536000');
  res.end(fs.readFileSync(posterPath));
}



// Which video this request is for. The board used to be pinned to the workdir
// it launched with, so switching meant restarting the server — and the Run
// tab's picker could only ever move its own tab. A slug arrives from a query
// string, so it must resolve to a direct child of videos/ or it is ignored.
export function requestedWorkdir(url, launchWorkdir) {
  const want = url.searchParams.get('video');
  if (!want) return launchWorkdir;
  const videosDir = videosRoot();
  const target = path.join(videosDir, want);
  if (path.dirname(target) !== videosDir || !fs.existsSync(target)) return launchWorkdir;
  // bootFilesFor(TARGET), not the launch workdir: what the requested video needs
  // depends on how THAT video is configured, not on how the board was started.
  for (const f of bootFilesFor(target)) if (!fs.existsSync(path.join(target, f))) return launchWorkdir;
  return target;
}

async function handleRequest(req, res, launchWorkdir, cardLibraryRoot) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  res.setHeader('Connection', 'close');

  // A cheap liveness probe that touches no filesystem — App.tsx's interval
  // used to poll /api/board-data every 2s purely to detect a dead backend
  // and discard the response, doing real fs work for nothing (plan 193).
  if (req.method === 'GET' && url.pathname === '/health') {
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    return res.end(JSON.stringify({ ok: true }));
  }

  const workdir = requestedWorkdir(url, launchWorkdir);
  // No bulk slice-cutting here: it ran BEFORE the response and blanked the
  // browser for seconds on every video switch. /slice/<id> cuts on demand.

  if (req.method === 'POST') {
    const host = req.headers.host || '';
    if (!/^localhost(:\d+)?$/.test(host) && !/^127\.0\.0\.1(:\d+)?$/.test(host)) {
      res.statusCode = 403;
      return res.end('forbidden origin');
    }
    const origin = req.headers.origin;
    if (origin && !/^http:\/\/localhost(:\d+)?$/.test(origin) && !/^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
      res.statusCode = 403;
      return res.end('forbidden origin');
    }
  }

  // A bare "/" hides which video you are on, which is how a stale tab gets
  // reviewed by mistake. Redirect so the URL always says.
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index' || url.pathname === '/app' || url.pathname === '/app/')
      && !url.searchParams.get('video')) {
    res.statusCode = 302;
    res.setHeader('location', `${url.pathname}?video=${encodeURIComponent(path.basename(workdir))}${''}`);
    return res.end();
  }

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index')) {
    return serveUi(res, '/app/');
  }

  // The Run tab is read-only and needs nothing but run-log.json plus the
  // artifact probe, so unlike the rest of the board it can answer for ANY video
  // without rebuilding cue/render state. That is what makes the picker cheap.
  if (req.method === 'GET' && url.pathname === '/run-videos') {
    const videosDir = videosRoot();
    const videos = fs.existsSync(videosDir)
      ? fs.readdirSync(videosDir, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name)
          .sort()
      : [];
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    return res.end(JSON.stringify({ current: path.basename(workdir), videos }));
  }

  if (req.method === 'GET' && url.pathname === '/run-log') {
    const want = url.searchParams.get('video');
    // With no ?video, answer for the workdir the board was started against —
    // which may be an external path outside videos/ (resolveWorkdir allows it),
    // so it must NOT be looked up by slug.
    let target = workdir;
    if (want && want !== path.basename(workdir)) {
      const videosDir = videosRoot();
      target = path.join(videosDir, want);
      // The slug arrives from a query string, so confirm it resolves to a
      // direct child of videos/ — that rejects "../.." before it reaches the
      // filesystem.
      if (path.dirname(target) !== videosDir || !fs.existsSync(target)) {
        res.statusCode = 404;
        res.setHeader('content-type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ error: `no such video: ${want}` }));
      }
    }
    let steps;
    try {
      steps = stepView(target);
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ error: e.message }));
    }
    const next = nextStep(steps);
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    return res.end(
      JSON.stringify({
        video: want || path.basename(target),
        steps,
        summary: summarizeRun(steps),
        next: next ? next.id : null,
      }),
    );
  }

  if (req.method === 'GET' && url.pathname === '/api/board-data') {
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    return res.end(JSON.stringify(buildBoardData(workdir, cardLibraryRoot, { buildSegments })));
  }
  if (req.method === 'GET' && url.pathname === '/api/calibrate-data') {
    const catalog = JSON.parse(fs.readFileSync(path.join(cardLibraryRoot, 'catalog.json'), 'utf8'));
    const cards = catalog.cards.filter((c) => c.kind === 'beat').map((card) => ({
      slug: card.slug, max_beats: card.max_beats ?? 0, max_reveal_chars: card.max_reveal_chars ?? null,
      probeTimes: computeProbeTimes(synthCalibrationVars(card).beats, card.default_duration),
    }));
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    return res.end(JSON.stringify({ cards }));
  }

  if (req.method === 'GET' && url.pathname === '/api/intro-data') {
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    return res.end(JSON.stringify(introData(workdir)));
  }

  if (req.method === 'GET' && url.pathname === '/api/avatar-data') {
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    return res.end(JSON.stringify(avatarPlanData(workdir)));
  }

  if (req.method === 'GET' && url.pathname === '/intro-frame') {
    const f = url.searchParams.get('f');
    if (!f || f.includes('/') || f.includes('..')) {
      res.statusCode = 400;
      return res.end('invalid frame name');
    }
    const framePath = path.join(workdir, 'intro-film', 'review', f);
    if (!fs.existsSync(framePath)) {
      res.statusCode = 404;
      return res.end('frame not found');
    }
    res.setHeader('content-type', f.endsWith('.jpg') || f.endsWith('.jpeg') ? 'image/jpeg' : 'image/png');
    // Review frames are rewritten by every review pass under the SAME name, so
    // they are never immutable — revalidate instead of trusting a cached copy.
    if (serveRevalidating(req, res, fs.statSync(framePath))) return;
    return res.end(fs.readFileSync(framePath));
  }

  if (req.method === 'GET' && url.pathname === '/intro-video') {
    const videoPath = path.join(workdir, 'intro-film', 'out', 'intro.mp4');
    if (!fs.existsSync(videoPath)) {
      res.statusCode = 404;
      res.setHeader('content-type', 'application/json');
      return res.end('{"ok":false,"error":"not rendered"}');
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    if (range) {
      // Validators, but never a 304 on a Range: a media element that asks for
      // bytes and gets a bodyless 304 just stalls. Revalidation happens on the
      // element's first, non-Range request.
      res.setHeader('etag', mediaValidator(stat));
      res.setHeader('last-modified', new Date(stat.mtimeMs).toUTCString());
      res.setHeader('cache-control', 'no-cache');
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(videoPath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      });
      file.pipe(res);
    } else {
      // The element's opening request. A 304 here means "your copy is current";
      // anything else and it re-reads a file a re-render may have replaced.
      if (serveRevalidating(req, res, stat)) return;
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      });
      fs.createReadStream(videoPath).pipe(res);
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/list') {
    res.statusCode = 302;
    res.setHeader('location', `/${url.search}#storyboard`);
    return res.end();
  }

  const cardMatch = url.pathname.match(/^\/card\/([^/]+)$/);
  if (req.method === 'GET' && cardMatch) {
    return serveCard(res, workdir, cardLibraryRoot, cardMatch[1], url.searchParams.get('static') === '1');
  }

  if (req.method === 'GET' && url.pathname === '/calibrate') {
    res.statusCode = 302;
    res.setHeader('location', `/${url.search}#calibrate`);
    return res.end();
  }

  const calibrateCardMatch = url.pathname.match(/^\/calibrate-card\/(.+)$/);
  if (req.method === 'GET' && calibrateCardMatch) {
    const catalog = JSON.parse(fs.readFileSync(path.join(cardLibraryRoot, 'catalog.json'), 'utf8'));
    return serveCalibrateCard(res, cardLibraryRoot, catalog, decodeURIComponent(calibrateCardMatch[1]));
  }

  const sliceMatch = url.pathname.match(/^\/slice\/([^/]+)\.mp3$/);
  if (req.method === 'GET' && sliceMatch) {
    return serveSlice(res, workdir, sliceMatch[1]);
  }

  const posterMatch = url.pathname.match(/^\/poster\/([^/]+)\.jpg$/);
  if (req.method === 'GET' && posterMatch) {
    return servePoster(res, workdir, posterMatch[1]);
  }

  if (req.method === 'POST' && url.pathname === '/save') {
    return handleSave(req, res, workdir, cardLibraryRoot);
  }

  if (req.method === 'POST' && url.pathname === '/approve') {
    return handleApprove(req, res, workdir);
  }

  if (req.method === 'POST' && url.pathname === '/approve-shots') {
    return handleApproveShots(req, res, workdir);
  }



  if (req.method === 'POST' && url.pathname === '/approve-intro') {
    await readBody(req);
    approveIntro(workdir);
    recordGate(workdir, gateNumberFor('intro-film/screenplay.json'), 'Owner approved the intro film.', 'intro-film/screenplay.json approved=true');
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: true }));
  }

  if (req.method === 'POST' && url.pathname === '/approve-intro-idea') {
    return handleApproveIntroIdea(req, res, workdir);
  }

  if (req.method === 'POST' && url.pathname === '/approve-avatar-plan') {
    return handleApproveAvatarPlan(req, res, workdir);
  }

  if (req.method === 'POST' && url.pathname === '/card-feedback') {
    const body = await readBody(req);
    let payload;
    try { payload = JSON.parse(body); } catch (e) { res.statusCode = 400; return res.end('{"ok":false}'); }
    const part = String(payload.part ?? '');
    const text = String(payload.text ?? '').trim();
    if (!PLAN_PARTS.includes(part)) { res.statusCode = 400; return res.end('{"ok":false,"error":"unknown part"}'); }
    if (!text) { res.statusCode = 400; return res.end('{"ok":false,"error":"empty text"}'); }
    const fbPath = path.join(workdir, 'feedback.json');
    const fb = fs.existsSync(fbPath) ? JSON.parse(fs.readFileSync(fbPath, 'utf8')) : {};
    const next = appendCardPlanFeedback(fb, part, { text, cue: payload.cue ?? null, card: payload.card ?? null });
    fs.writeFileSync(fbPath, JSON.stringify(next, null, 2));
    res.setHeader('content-type', 'application/json');
    return res.end('{"ok":true}');
  }

  if (req.method === 'POST' && url.pathname === '/approve-effects') {
    return handleApproveEffects(req, res, workdir);
  }

  if (req.method === 'POST' && url.pathname === '/approve-final-cut') {
    return handleApproveFinalCut(req, res, workdir);
  }

  if (req.method === 'GET' && url.pathname === '/vo.mp3') {
    const voPath = path.join(workdir, 'vo.mp3');
    if (!fs.existsSync(voPath)) {
      res.statusCode = 404;
      return res.end('vo.mp3 not found');
    }
    res.setHeader('content-type', 'audio/mpeg');
    res.setHeader('cache-control', 'no-store');
    return res.end(fs.readFileSync(voPath));
  }

  // Versions + version mp4s live in the kb-scratch workdir (assemble's
  // registerVersion writes there — media never in the repo); the repo workdir
  // only holds text artifacts. Reading workdir here left the Final Cut tab
  // permanently on "no versions" (found 2026-07-24).
  const kbWorkdir = path.join(
    process.env.ASSEMBLE_MEDIA_ROOT ?? path.join(os.homedir(), 'kb-scratch', 'video', 'visuals-flow'),
    path.basename(workdir),
  );

  if (req.method === 'GET' && url.pathname === '/versions') {
    const p = path.join(kbWorkdir, 'versions.json');
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    return res.end(fs.existsSync(p) ? fs.readFileSync(p) : '{"versions":[]}');
  }

  // /feedback-image/<key> is the first screenshot (what every existing link
  // means); /feedback-image/<key>/<n> is the nth. Keys never contain a slash,
  // so a trailing /<digits> is unambiguous.
  const fbImgMatch = url.pathname.match(/^\/feedback-image\/(.+?)(?:\/(\d+))?$/);
  if (req.method === 'GET' && fbImgMatch) {
    const key = decodeURIComponent(fbImgMatch[1]);
    const idx = fbImgMatch[2] ? Number(fbImgMatch[2]) : 0;
    const fbPath = path.join(workdir, 'feedback.json');
    const fb = fs.existsSync(fbPath) ? JSON.parse(fs.readFileSync(fbPath, 'utf8')) : { items: {} };
    const rel = itemImages(fb.items?.[key])[idx];
    const imgPath = rel ? path.join(workdir, rel) : null;
    if (!imgPath || !imgPath.startsWith(path.join(workdir, 'feedback-images')) || !fs.existsSync(imgPath)) {
      res.statusCode = 404; return res.end('no image');
    }
    const ext = path.extname(imgPath).slice(1);
    res.setHeader('content-type', ext === 'jpg' ? 'image/jpeg' : 'image/' + ext);
    res.setHeader('cache-control', 'no-store');
    return res.end(fs.readFileSync(imgPath));
  }

  if (req.method === 'GET' && url.pathname === '/status') {
    const p = path.join(workdir, 'claude_status.json');
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    return res.end(fs.existsSync(p) ? fs.readFileSync(p) : '{"items":{}}');
  }

  const videoMatch = url.pathname.match(/^\/video\/(.+)$/);
  if (req.method === 'GET' && videoMatch) {
    const versionsPath = path.join(kbWorkdir, 'versions.json');
    if (!fs.existsSync(versionsPath)) {
      res.statusCode = 404; return res.end('no versions');
    }
    const versionsJson = JSON.parse(fs.readFileSync(versionsPath, 'utf8'));
    let version = videoMatch[1] === 'current'
      ? versionsJson.versions[versionsJson.versions.length - 1]
      : versionsJson.versions.find(v => v.label === videoMatch[1]);
    if (!version) { res.statusCode = 404; return res.end('version not found'); }

    const videoPath = path.join(kbWorkdir, version.file);
    if (!fs.existsSync(videoPath)) { res.statusCode = 404; return res.end('video not found'); }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    if (range) {
      // Same reasoning as /intro-video: validators yes, 304-on-Range no.
      // "/video/current" in particular is one URL whose bytes change with every
      // re-cut, so a cached copy is indistinguishable from a fresh one by URL.
      res.setHeader('etag', mediaValidator(stat));
      res.setHeader('last-modified', new Date(stat.mtimeMs).toUTCString());
      res.setHeader('cache-control', 'no-cache');
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(videoPath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      });
      file.pipe(res);
    } else {
      // The element's opening request. A 304 here means "your copy is current";
      // anything else and it re-reads a file a re-render may have replaced.
      if (serveRevalidating(req, res, stat)) return;
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      });
      fs.createReadStream(videoPath).pipe(res);
    }
    return;
  }

  // /feedback-edit and /feedback-delete are the names a new review step should
  // use; the -final- spellings are the original ones and stay so existing
  // clients keep working. Both have always served intro too — the name was the
  // only thing that said "final".
  const isEdit = url.pathname === '/feedback-edit' || url.pathname === '/feedback-final-edit';
  const isDelete = url.pathname === '/feedback-delete' || url.pathname === '/feedback-final-delete';
  if (req.method === 'POST' && (isEdit || isDelete)) {
    const body = await readBody(req);
    let payload;
    try { payload = JSON.parse(body); } catch (e) { res.statusCode = 400; return res.end('{"ok":false}'); }
    const key = String(payload.key ?? '');
    if (!isEditableKey(key)) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: `not an editable comment key: ${key}` }));
    }
    const fbPath = path.join(workdir, 'feedback.json');
    const fb = fs.existsSync(fbPath) ? JSON.parse(fs.readFileSync(fbPath, 'utf8')) : { items: {} };
    const item = fb.items?.[key];
    if (!item) { res.statusCode = 404; return res.end('{"ok":false,"error":"no such comment"}'); }
    if (item.folded) { res.statusCode = 409; return res.end('{"ok":false,"error":"folded items are read-only history"}'); }
    if (isEdit) {
      const text = String(payload.text ?? '').trim();
      if (!text) { res.statusCode = 400; return res.end('{"ok":false,"error":"empty text"}'); }
      item.text = text;
    } else {
      dropFeedbackImage(workdir, item);   // every screenshot, not just the first
      delete fb.items[key];
    }
    fb.updated = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(fbPath, JSON.stringify(fb, null, 2));
    res.setHeader('content-type', 'application/json');
    return res.end('{"ok":true}');
  }

  if (req.method === 'POST' && url.pathname === '/feedback-final') {
    const body = await readBody(req);
    let payload;
    try { payload = JSON.parse(body); } catch(e) { res.statusCode = 400; return res.end('{"ok":false}'); }
    const fbPath = path.join(workdir, 'feedback.json');
    let fb = fs.existsSync(fbPath) ? JSON.parse(fs.readFileSync(fbPath, 'utf8')) : {};
    fb = appendFinalFeedback(fb, payload.label, payload.item);
    const prefix = 'final-' + payload.label + ':';
    const key = Object.keys(fb.items)
      .filter((k) => k.startsWith(prefix))
      .sort((a, b) => parseInt(a.slice(prefix.length), 10) - parseInt(b.slice(prefix.length), 10))
      .pop();
    // Optional screenshot attachments (data URLs): saved beside feedback.json so
    // the fixing session can Read them directly (gitignored — media). `image`
    // (singular) is still accepted so an older client keeps working.
    const savedImages = saveFeedbackImages(workdir, key, payload.images ?? payload.image);
    if (savedImages.length) fb.items[key].images = savedImages;
    fb.updated = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(fbPath, JSON.stringify(fb, null, 2));
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: true, key, item: fb.items[key] }));
  }

  if (req.method === 'POST' && url.pathname === '/feedback-intro') {
    const body = await readBody(req);
    let payload;
    try { payload = JSON.parse(body); } catch(e) { res.statusCode = 400; return res.end('{"ok":false}'); }
    const fbPath = path.join(workdir, 'feedback.json');
    let fb = fs.existsSync(fbPath) ? JSON.parse(fs.readFileSync(fbPath, 'utf8')) : {};
    fb = appendIntroFeedback(fb, payload.item);
    const prefix = 'intro:';
    const key = Object.keys(fb.items)
      .filter((k) => k.startsWith(prefix))
      .sort((a, b) => parseInt(a.slice(prefix.length), 10) - parseInt(b.slice(prefix.length), 10))
      .pop();
    const savedImages = saveFeedbackImages(workdir, key, payload.images ?? payload.image);
    if (savedImages.length) fb.items[key].images = savedImages;
    fb.updated = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(fbPath, JSON.stringify(fb, null, 2));
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: true, key, item: fb.items[key] }));
  }


  if (req.method === 'GET' && (url.pathname === '/app' || url.pathname.startsWith('/app/') || url.pathname.startsWith('/assets/'))) {
    return serveUi(res, url.pathname);
  }

  res.statusCode = 404;
  res.end('not found');
}

const UI_DIST = path.resolve(import.meta.dirname, '..', 'board-ui', 'dist');
const UI_MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.map': 'application/json' };
function serveUi(res, pathname) {
  if (!fs.existsSync(path.join(UI_DIST, 'index.html'))) {
    res.statusCode = 503;
    return res.end('board-ui not built — run: cd board-ui && npm ci && npm run build');
  }
  let rel;
  if (pathname === '/app' || pathname === '/app/') rel = 'index.html';
  else if (pathname.startsWith('/assets/')) rel = decodeURIComponent(pathname.slice(1));
  else rel = decodeURIComponent(pathname.slice('/app/'.length));
  const file = path.join(UI_DIST, rel);
  if (!file.startsWith(UI_DIST + path.sep) && file !== path.join(UI_DIST, 'index.html')) {
    res.statusCode = 403; return res.end('forbidden');
  }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.statusCode = 404; return res.end('not found'); }
  res.setHeader('content-type', UI_MIME[path.extname(file)] ?? 'application/octet-stream');
  res.setHeader('cache-control', 'no-store');
  return res.end(fs.readFileSync(file));
}

export function createServer(workdir) {
  const cardLibraryRoot = path.resolve(import.meta.dirname, '..', '..', 'card-library');
  for (const name of bootFilesFor(workdir)) {
    if (!fs.existsSync(path.join(workdir, name))) {
      throw new Error(`workdir missing ${name}: ${path.join(workdir, name)}`);
    }
  }

  // No bulk slice-cutting at boot — /slice/<id> cuts on demand (ensureSlice).

  return httpCreateServer((req, res) => {
    handleRequest(req, res, workdir, cardLibraryRoot).catch((err) => {
      console.error(err && err.stack ? err.stack : err);
      res.statusCode = 500;
      res.end('internal error');
    });
  });
}


// No-arg mode (used by the local-apps dashboard): most recently touched video
// workdir that has a cues.json.
// Pick the newest workdir the board can actually OPEN, which means every file
// in REQUIRED_FILES, not just cues.json. Sorting on cues.json alone made the
// dashboard fail the moment a new video was started: a fresh workdir gets
// cues.json long before resolved.json, so it won the sort and then threw.
// An intro-film video has no cues.json at gate 027, so keying candidacy on that
// file made the newest video INVISIBLE to the dashboard — it silently opened on
// whatever older video still had cues, and the owner reviewed that one instead.
// Candidacy is "the board could open it", which is exactly bootFilesFor.
export function latestWorkdir(videosDir = path.join(path.resolve(import.meta.dirname, '..'), 'videos')) {
  if (!fs.existsSync(videosDir)) return null;
  const dirs = fs
    .readdirSync(videosDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const dir = path.join(videosDir, d.name);
      // Rank on cues.json where there is one so the ordering of cue-driven
      // videos is unchanged; an intro-film video ranks on run-log.json, which
      // every step appends to and is therefore the truer "recently touched".
      const stamp = ['cues.json', 'run-log.json']
        .map((f) => path.join(dir, f))
        .find((p) => fs.existsSync(p));
      return {
        name: d.name,
        dir,
        mtime: stamp ? fs.statSync(stamp).mtimeMs : 0,
        missing: stamp ? bootFilesFor(dir).filter((f) => !fs.existsSync(path.join(dir, f))) : ['cues.json'],
      };
    })
    .sort((a, b) => b.mtime - a.mtime);

  const usable = dirs.filter((d) => d.missing.length === 0);
  if (usable.length) {
    const skipped = dirs.filter((d) => d.missing.length && d.mtime > usable[0].mtime);
    for (const s of skipped) {
      console.log(`skipping videos/${s.name} — not ready for the board yet (no ${s.missing.join(', ')})`);
    }
    console.log(`no workdir given — using latest: videos/${usable[0].name}`);
    return usable[0].dir;
  }

  // Say WHY rather than a bare "no video found": the usual cause is a video
  // mid-flight, which is not an error, just not board-ready.
  if (dirs.length) {
    console.error('no video is ready for the board yet:');
    for (const d of dirs) console.error(`  videos/${d.name} — missing ${d.missing.join(', ')}`);
  }
  return null;
}

function listenOnFreePort(server, startPort, attempts = 10) {
  return new Promise((resolve, reject) => {
    const tryPort = (p, left) => {
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE' && left > 0) {
          console.error('\n' + '='.repeat(60));
          console.error(`WARNING: port ${p} in use!`);
          console.error(`A stale board process is probably still running on ${startPort}.`);
          console.error(`The new board is falling back to ${p + 1}.`);
          console.error(`If you don't see your changes, KILL THE OLD BOARD.`);
          console.error('='.repeat(60) + '\n');
          tryPort(p + 1, left - 1);
        } else reject(err);
      });
      // resolve from the socket, not the closure: a failed earlier listen()
      // leaves its success callback registered, and it fires first with a
      // stale p when a later attempt binds.
      server.listen(p, '127.0.0.1', () => { server.removeAllListeners('error'); resolve(server.address().port); });
    };
    tryPort(startPort, attempts);
  });
}

async function main() {
  const arg = process.argv[2];
  const resolvedWorkdir = arg ? resolveWorkdir(arg) : latestWorkdir();
  if (!resolvedWorkdir) {
    console.error('usage: node lib/board.mjs <slug-or-path>  (no videos/*/cues.json found for no-arg mode)');
    process.exit(1);
  }
  let server;
  try {
    server = createServer(resolvedWorkdir);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const port = Number(process.env.BOARD_PORT) || 4322;
  try {
    const finalPort = await listenOnFreePort(server, port);
    console.log(`board at http://localhost:${finalPort}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
