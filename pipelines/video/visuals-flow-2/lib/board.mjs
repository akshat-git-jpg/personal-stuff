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
import { computeProbeTimes, loadBoardData, buildBoardData } from './board-data.mjs';
import { stepView, summarize as summarizeRun, nextStep, readRunLog, writeRunLog, setStep, resolveStepId } from './run-log.mjs';

// What the board needs to BOOT. resolved.json is deliberately not here: it is
// produced by 040, and 040 refuses any cue naming a card that does not exist
// yet — a card that only 038 builds, AFTER the owner approves it at 037. Since
// 037's review surface is this board's Card Plan tab, requiring resolved.json
// to start made Gate 1 unreachable on exactly the videos it exists for.
// resolved.json is a requirement of the Storyboard tab, not of the board.
const BOOT_FILES = ['cues.json', 'vo.mp3'];
// One definition, used by the storyboard tiles and the card plan rows alike.
// fbBox taught us what three drifting copies of the same control costs.
const REV_BOX = '<label class="rev" title="mark reviewed and collapse this card">'
  + '<input type="checkbox" class="rev-input"/> reviewed</label>';

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

function injectShim(html, variables) {
  const varsJson = JSON.stringify(variables ?? {}).replace(/</g, '\\u003c');
  const shim = `<script>
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

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

// Run tab. The status lives on the RIGHT as an emoji, so the eye scans one
// column to see where the video is instead of reading every row.
const RUN_CSS = `
  /* Reviewed-and-collapsed. Everything but the header row is hidden, so the
     tile keeps its place in the timeline instead of vanishing. */
  .rev { display:inline-flex; align-items:center; gap:5px; margin-left:auto; font-size:11px;
    color:var(--dim); cursor:pointer; user-select:none; white-space:nowrap; }
  .rev input { cursor:pointer; }
  .reviewable.is-reviewed > *:not(.rev-head) { display:none !important; }
  .reviewable.is-reviewed { opacity:.62; }
  .reviewable.is-reviewed .rev { color:var(--ok); }
  .reviewable.is-reviewed .rev-head { cursor:pointer; margin-bottom:0 !important; }
  .rev-head { display:flex; align-items:center; gap:10px; }
  .fb-shot { display:flex; align-items:center; gap:8px; margin-top:4px; }
  .fb-attach { background:none; border:1px solid var(--line); border-radius:5px; color:var(--dim);
    cursor:pointer; font-size:13px; line-height:1; padding:4px 8px; }
  .fb-attach:hover { color:var(--text); border-color:var(--accent); }
  .fb-attach.has-image { border-color:var(--ok); color:var(--ok); }
  .fb-thumb img { height:38px; border-radius:4px; border:1px solid var(--line); vertical-align:middle; }
  .fb-clear { background:none; border:none; color:var(--dim); cursor:pointer; font-size:15px; padding:0 4px; }
  .fb-clear:hover { color:#ef4444; }
  .run-row { display:flex; flex-direction:column; gap:2px; border:1px solid var(--line); border-radius:8px;
             padding:13px 16px; margin-bottom:8px; background:var(--panel); transition:border-color .12s; }
  /* Dim the TEXT of an unstarted step, never the row — parent opacity also
     dims the status emoji, and the one column the eye scans must stay legible
     at every status. */
  .run-row.is-todo { background:transparent; }
  .run-row.is-todo .run-num, .run-row.is-todo .run-name { color:var(--dim); font-weight:500; }
  .run-row.is-running { border-color:#fb923c; }
  .run-row.is-blocked { border-color:#ef4444; }
  .run-head { display:flex; align-items:center; gap:10px; }
  .run-num { color:var(--dim); font-variant-numeric:tabular-nums; font-size:13px; }
  .run-name { font-size:14px; font-weight:600; }
  .run-kind { font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:var(--dim);
              border:1px solid var(--line); border-radius:3px; padding:1px 5px; }
  .run-mark { margin-left:auto; font-size:19px; line-height:1; flex-shrink:0; }
  .run-mark.spin { display:inline-block; animation:run-spin 1.4s linear infinite; }
  @keyframes run-spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
  .run-fields { margin-top:8px; padding-left:2px; }
  .run-field { display:flex; gap:10px; margin-top:5px; font-size:13px; line-height:1.55; }
  .run-field b { color:var(--dim); font-weight:500; min-width:50px; flex-shrink:0; }
  .run-inferred { margin-top:7px; font-size:12px; color:var(--dim); font-style:italic; }
`;

const BOARD_CSS = `
  :root { --bg:#0f0b07; --panel:#181210; --line:rgba(255,255,255,0.10);
    --text:#f5ede2; --dim:rgba(245,237,226,0.55); --accent:#fb923c; --accent-light:#fdba74; --ok:#34d399; --err:#ff6b6b; --shot:#a78bfa; --overlay-seg:#38bdf8;
    --font:"Inter",-apple-system,system-ui,sans-serif; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:var(--font); background:var(--bg); color:var(--text); padding:28px 32px 80px; }
  .sticky-header { position:sticky; top:0; background:var(--bg); z-index:100; margin:-28px -32px 20px -32px; padding:28px 32px 16px 32px; border-bottom:1px solid var(--line); }
  .topbar { display:flex; align-items:center; gap:12px 20px; margin-bottom:16px; font-size:14px; color:var(--dim); flex-wrap:wrap; }
  .topbar strong { color:var(--text); }
  .view-toggle { display:flex; align-items:center; gap:2px; border:1px solid var(--line); border-radius:8px; padding:2px; flex:none; }
  .view-toggle a, .view-toggle button.tab-btn { padding:5px 12px; border-radius:6px; font-size:13px; font-weight:600; text-decoration:none;
    color:var(--dim); background:none; border:0; font-family:inherit; cursor:pointer; white-space:nowrap; line-height:1.4; }
  .view-toggle a.active, .view-toggle button.tab-btn.active { color:var(--accent); background:rgba(251,146,60,0.12); }
  #fc-version { font:inherit; font-size:13px; font-weight:600; padding:6px 10px; background:var(--panel); color:var(--text);
    border:1px solid var(--line); border-radius:8px; outline:none; }
  .fc-cbtn { background:none; border:0; color:var(--dim); cursor:pointer; font-size:13px; padding:2px 5px; border-radius:4px; }
  .fc-cbtn:hover { color:var(--text); background:rgba(255,255,255,0.08); }
  .fold-toggle { background:none; border:1px solid var(--line); color:var(--dim); cursor:pointer; font:inherit; font-size:12px;
    font-weight:600; padding:3px 10px; border-radius:6px; margin:2px 0 8px; }
  .fold-toggle:hover { color:var(--text); }
  .fold-toggle:disabled { opacity:0.4; cursor:default; }
  #fc-input { width:100%; padding:10px; font:inherit; font-size:14px; line-height:1.5; background:#0f0b07; color:var(--text);
    border:1px solid var(--line); border-radius:8px; resize:vertical; min-height:84px; box-sizing:border-box; }
  #fc-input:disabled { opacity:0.5; }
  /* Final Cut transport (frame.io/Loop-Studio style: scrubber + click transport + kbd layer) */
  #fc-scrub { width:100%; margin:10px 0 2px; appearance:none; -webkit-appearance:none; height:8px; border-radius:4px;
    background:linear-gradient(to right, var(--accent) 0%, var(--accent) var(--fc-prog,0%), rgba(255,255,255,0.14) var(--fc-prog,0%)); cursor:pointer; display:block; }
  #fc-scrub::-webkit-slider-thumb { appearance:none; -webkit-appearance:none; width:18px; height:18px; border-radius:50%;
    background:#fff; border:none; box-shadow:0 1px 4px rgba(0,0,0,0.5); cursor:grab; }
  #fc-scrub::-moz-range-thumb { width:18px; height:18px; border-radius:50%; background:#fff; border:none; cursor:grab; }
  #fc-transport { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin:8px 0 2px; }
  .fc-tbtn { font:inherit; font-weight:700; font-size:14px; padding:9px 14px; border-radius:9px; cursor:pointer;
    border:1px solid var(--line); background:var(--panel); color:var(--text); }
  .fc-tbtn:hover { border-color:var(--dim); }
  #fc-play { background:var(--accent); border-color:var(--accent); color:#1a1008; min-width:92px; }
  #fc-clock { font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:16px; font-weight:700; padding:0 6px; white-space:nowrap; }
  #fc-clock .cur { color:var(--accent); }
  #fc-speed { font:inherit; font-size:14px; font-weight:700; padding:8px 10px; border-radius:9px;
    border:1px solid var(--line); background:var(--panel); color:var(--text); cursor:pointer; }
  #fc-kbd-hint { margin-top:8px; font-size:12.5px; color:var(--dim); line-height:1.9; }
  #fc-kbd-hint kbd { font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:11px; background:rgba(255,255,255,0.08);
    border:1px solid var(--line); border-bottom-width:2px; border-radius:5px; padding:1px 7px; color:var(--text); }
  #fc-kbd-hint strong { color:var(--text); }
  .topbar button { font:inherit; font-weight:700; border-radius:9px; padding:9px 16px; cursor:pointer;
    border:1px solid var(--line); background:var(--panel); color:var(--text); }
  #approveBtn { border-color:var(--ok); color:var(--ok); }
  #saveBtn { border-color:var(--accent); color:var(--accent); }
  /* A disabled approve must LOOK disabled. Nothing styled :disabled before, so
     the button kept its green "ready to approve" outline while doing nothing. */
  .topbar button:disabled { cursor:not-allowed; opacity:.38; border-color:var(--line) !important;
    color:var(--dim) !important; background:transparent; }
  .banner { margin-bottom:16px; padding:10px 36px 10px 14px; border-radius:9px; font-size:13px; position:relative; }
  .banner-x { position:absolute; top:6px; right:8px; background:none; border:none; color:inherit; cursor:pointer; font-size:15px; line-height:1; padding:4px; opacity:0.7; }
  .banner-x:hover { opacity:1; }
  .banner.ok { background:rgba(52,211,153,0.12); border:1px solid var(--ok); color:var(--ok); }
  .banner.err { background:rgba(255,107,107,0.12); border:1px solid var(--err); color:var(--err); }
  .usage { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px; }
  .usage-chip { font-size:11px; font-family:ui-monospace,Menlo,monospace; color:var(--dim);
    border:1px solid var(--line); border-radius:20px; padding:3px 10px; }
  .usage-chip.hot { color:var(--err); border-color:var(--err); }
  .minimap { display:flex; height:28px; width:100%; border-radius:4px; overflow:hidden; gap:1px; background:var(--line); }
  .minimap-seg { cursor:pointer; transition:opacity 0.2s; }
  .minimap-seg:hover { opacity:0.8; }
  .timeline { display:flex; flex-direction:column; gap:20px; max-width:800px; margin:0 auto; }
  .timeline-block { background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:16px; }
  .gap-block { padding:12px 16px; }
  .lane-row { display:flex; align-items:center; gap:8px; margin-bottom:4px; }
  .lane-label { flex:none; width:60px; text-align:right; font-family:ui-monospace,Menlo,monospace;
    font-size:10px; color:var(--dim); text-transform:uppercase; letter-spacing:0.08em; }
  .lane-row .minimap { flex:1; width:auto; }
  .minimap-shots { height:18px; }
  .lane-legend { display:flex; flex-wrap:wrap; gap:14px; font-size:11px; color:var(--dim); margin:2px 0 8px 68px; }
  .lane-legend .dot { display:inline-block; width:9px; height:9px; border-radius:2px; margin-right:5px; }
  .shot-block { border-left:3px solid var(--shot); }
  .in-shot { border-left:3px solid var(--shot); }
  .gap-header { font-size:13px; color:var(--dim); cursor:pointer; display:flex; align-items:center; }
  .gap-icon { display:inline-block; width:16px; transition:transform 0.2s; }
  .gap-block.expanded .gap-icon { transform:rotate(90deg); }
  .gap-body { display:none; margin-top:10px; font-size:14px; line-height:1.6; color:var(--dim); max-width:70ch; }
  .gap-block.expanded .gap-body { display:block; }
  .tile.flagged { opacity:0.55; border-color:var(--err); }
  .tile-header { font-family:ui-monospace,Menlo,monospace; font-size:12px; color:var(--dim); margin-bottom:8px; }
  .excerpt { font-size:15px; line-height:1.6; margin-bottom:12px; color:var(--text); }
  mark { background:rgba(251,146,60,0.25); color:var(--accent); padding:2px 4px; border-radius:4px; }
  .anchor { font-size:14px; margin-bottom:6px; }
  .beats { list-style:none; font-size:12px; color:var(--dim); margin-bottom:10px; }
  .preview { width:480px; height:270px; overflow:hidden; position:relative; background:#000; border-radius:8px; margin-bottom:8px; }
  .preview iframe { width:1920px; height:1080px; border:0; transform:scale(0.25); transform-origin:top left; position:absolute; top:0; left:0; }
  .unresolved-note { font-size:12px; color:var(--err); margin-bottom:8px; }
  .overflow-badge { display:inline-block; margin-left:8px; font-family:ui-monospace,Menlo,monospace; font-size:11px; color:var(--err); background:rgba(255,107,107,0.12); border:1px solid var(--err); border-radius:4px; padding:2px 6px; }
  audio.scrub { width:100%; margin-bottom:10px; }
  .flag { display:block; font-size:12px; color:var(--dim); margin-bottom:6px; }
  .note { width:100%; font:inherit; font-size:12px; padding:6px 8px; margin-bottom:8px; background:#0f0b07; color:var(--text); border:1px solid var(--line); border-radius:6px; }
  textarea.frag, textarea.shot-frag { width:100%; min-height:140px; font-family:ui-monospace,Menlo,monospace; font-size:11px;
    background:#0f0b07; color:var(--text); border:1px solid var(--line); border-radius:6px; padding:8px; }
  textarea.shot-frag { min-height:120px; margin-top:8px; }
  textarea.feedback { width:100%; min-height:34px; font:inherit; font-size:12px; margin:8px 0 4px;
    background:rgba(251,146,60,0.05); color:var(--text); border:1px dashed rgba(251,146,60,0.4); border-radius:6px; padding:6px 8px; }
  textarea.feedback:focus { border-style:solid; outline:none; }
  .feedback-folded { font-size:12px; color:var(--dim); margin-bottom:8px; padding:0 8px; }

  .minimap-fx { height:18px; }
  .fx-marker { position:absolute; top:2px; bottom:2px; width:3px; border-radius:1px; }
  .fx-whip { background:var(--accent); }
  .fx-beat { background:var(--ok); }
  .fx-span { position:absolute; top:6px; height:6px; background:rgba(245,237,226,0.28); border-radius:3px; }
  .fx-off { opacity:0.25; }
  #fxPlayhead { position:absolute; top:-2px; bottom:-2px; width:2px; background:#fff; opacity:0; }
  .fx-chips { display:flex; flex-wrap:wrap; gap:6px; margin:8px 0; }
  .fx-chip { font-size:11px; font-family:ui-monospace,Menlo,monospace; color:var(--dim); border:1px solid var(--line); border-radius:20px; padding:3px 10px; cursor:pointer; display:inline-flex; align-items:center; gap:5px; }
  .fx-chip input { accent-color: var(--accent); }
  #approveEffectsBtn { border-color:var(--ok); color:var(--ok); }
  #fxStage { position:fixed; right:24px; bottom:24px; width:480px; height:270px; background:#141017; border:1px solid var(--line); border-radius:10px; overflow:hidden; z-index:200; display:none; }
  #fxStage.on { display:block; }
  #fxStage .frame { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; transition:transform 0.3s ease-out; }
  #fxStage .ctx { font:11px ui-monospace,Menlo,monospace; color:var(--dim); }
  #fxStage .flash { position:absolute; inset:0; background:#ffd9b0; opacity:0; pointer-events:none; }
  #fxStage.fx-flash .flash { animation:fxFlash 0.3s ease-out; }
  @keyframes fxFlash { 0%{opacity:0} 25%{opacity:0.9} 100%{opacity:0} }
  #fxStage.fx-punch .frame { transform:scale(1.08); }
  #fxStage.fx-whipblur .frame { animation:fxWhip 0.25s ease-in; }
  @keyframes fxWhip { 0%{filter:blur(0);transform:translateX(0)} 50%{filter:blur(8px);transform:translateX(-40px)} 100%{filter:blur(0);transform:translateX(0)} }
  #fxStage .cap { position:absolute; left:8px; right:8px; bottom:10%; text-align:center; font-weight:700; font-size:16px; color:#fff; text-shadow:0 0 4px #000; }
  #fxStage .cap .hl { color:var(--accent); }
  #fxStage .bubble { position:absolute; top:12px; right:12px; width:56px; height:56px; border-radius:50%; border:3px solid var(--accent); background:#2a1d14; display:none; }
  #fxStage.ctx-screen .bubble.on { display:block; }
  #fxStage .note-fixed { position:absolute; top:6px; right:10px; font-size:10px; color:var(--dim); }
`;

// Styles for the / (timeline) view only — appended alongside BOARD_CSS.
const TIMELINE_CSS = `
  .tl-zoom-row { display:flex; align-items:center; gap:10px; margin:0 0 14px; font-size:12px; color:var(--dim); }
  .tl-layout { display:flex; gap:16px; align-items:flex-start; }
  .tl-canvas-wrap { flex:1; min-width:0; overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
  .tl-canvas { display:flex; }
  .tl-labels { flex:none; width:90px; position:sticky; left:0; z-index:5; background:var(--bg); border-right:1px solid var(--line); }
  .tl-label { height:36px; display:flex; align-items:center; padding:0 10px; font-family:ui-monospace,Menlo,monospace;
    font-size:10px; color:var(--dim); text-transform:uppercase; letter-spacing:0.08em; }
  .tl-ruler-spacer { height:24px; }
  .tl-tracks { position:relative; flex:none; }
  .tl-ruler { height:24px; position:relative; border-bottom:1px solid var(--line); cursor:pointer; }
  .tl-tick { position:absolute; top:0; bottom:0; font-size:10px; color:var(--dim); border-left:1px solid var(--line); padding:2px 0 0 4px; white-space:nowrap; }
  .tl-track { position:relative; height:36px; border-bottom:1px solid var(--line); background:rgba(255,255,255,0.02); }
  .tl-screen-bar { position:absolute; inset:8px 0; background:var(--line); border-radius:3px; }
  .tl-block { position:absolute; top:4px; bottom:4px; overflow:hidden; cursor:pointer; border-radius:3px;
    font-size:10px; padding:2px 4px; color:#0f0b07; white-space:nowrap; }
  .tl-mark { position:absolute; top:4px; bottom:4px; width:3px; border-radius:1px; }
  .tl-span { position:absolute; top:12px; height:8px; border-radius:4px; background:rgba(245,237,226,0.28); }
  .tl-fx-chips { position:absolute; left:4px; top:4px; display:flex; gap:4px; z-index:2; }
  .tl-chip { font-size:11px; font-family:ui-monospace,Menlo,monospace; color:var(--dim);
    border:1px solid var(--line); border-radius:20px; padding:2px 8px; background:var(--bg); }
  .tl-playhead { position:absolute; top:0; bottom:0; width:2px; background:#fff; pointer-events:none; }
  #detail-panel { flex:none; width:520px; max-width:520px; position:sticky; top:140px;
    max-height:calc(100vh - 160px); overflow-y:auto; background:var(--panel); border:1px solid var(--line);
    border-radius:12px; padding:16px; }
  #detail-panel .placeholder { color:var(--dim); font-size:13px; }
`;

// Shared client script for both / (board) and /calibrate: posts each tile's
// probe times into its iframe on load, and turns broken reports into a badge
// on the tile header. Kept as one string so the two pages can't drift.
const OVERFLOW_BADGE_JS = `
  function wireProbe(tile) {
    const iframe = tile.querySelector('iframe');
    const preview = tile.querySelector('.preview');
    if (!iframe || !preview) return;
    let probeTimes = [];
    try { probeTimes = JSON.parse(preview.dataset.probeTimes || '[]'); } catch {}
    if (!probeTimes.length) return;
    iframe.addEventListener('load', () => {
      try { iframe.contentWindow.postMessage({ probe: probeTimes }, '*'); } catch {}
    });
  }
  function wireOverflowBadges() {
    const brokenTimesByTile = new WeakMap();
    window.addEventListener('message', (e) => {
      if (!e.data || !e.data.__overflow) return;
      const tile = [...document.querySelectorAll('.tile')].find((t) => t.querySelector('iframe')?.contentWindow === e.source);
      if (!tile) return;
      const { t, offenders } = e.data.__overflow;
      const times = brokenTimesByTile.get(tile) || [];
      times.push({ t, offenders });
      brokenTimesByTile.set(tile, times);
      let badge = tile.querySelector('.overflow-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'overflow-badge';
        (tile.querySelector('.tile-header') || tile).appendChild(badge);
      }
      const label = times.map((x) => x.t.toFixed(1) + 's').join(', ');
      const allOffenders = [...new Set(times.flatMap((x) => x.offenders))].slice(0, 5);
      badge.textContent = 'OVERFLOW @ ' + label + ' (' + allOffenders.join(' ') + ')';
    });
  }
`;

// initBlock(root): wire probe + audio<->iframe sync for every .tile inside
// `root` that hasn't been wired yet. Idempotent (data-inited guard) so it's
// safe to call again when the timeline dock reveals a previously-parked
// block. Shared by /list (whole-document init) and / (per-block, on reveal).
const INIT_BLOCK_JS = `
  function initBlock(root) {
    root.querySelectorAll('.tile:not([data-inited])').forEach((tile) => {
      tile.dataset.inited = '1';
      const iframe = tile.querySelector('iframe');
      const audio = tile.querySelector('audio');
      if (iframe && audio) {
        const post = () => { try { iframe.contentWindow.postMessage({ t: audio.currentTime }, '*'); } catch {} };
        let raf = null;
        audio.addEventListener('timeupdate', post);
        audio.addEventListener('seeked', post);
        audio.addEventListener('pause', () => { post(); if (raf) cancelAnimationFrame(raf); });
        audio.addEventListener('play', () => {
          document.querySelectorAll('.tile audio').forEach((a) => { if (a !== audio && !a.paused) a.pause(); });
          const loop = () => { post(); if (!audio.paused) raf = requestAnimationFrame(loop); };
          loop();
        });
      }
      wireProbe(tile);
    });
  }
`;

// Shared Save/Approve wiring — reads VIDEO/APPROVED (page-local consts) and
// the current DOM's .tile/.shot-block/.feedback elements. Both / and /list
// use the identical handlers so save/approve semantics can't drift between
// the two views.
const SAVE_ACTIONS_JS = `
  let FB_DIRTY = false;
  // ---- global video picker ----------------------------------------------
  // Switching reloads with ?video=<slug>; every tab then resolves that video
  // server-side, so this moves the whole board, not just one tab.
  (async function initVideoPicker() {
    var sel = document.getElementById('videoPicker');
    if (!sel) return;
    try {
      var d = await (await fetch('/run-videos')).json();
      var cur = new URLSearchParams(location.search).get('video') || d.current;
      sel.innerHTML = d.videos.map(function (v) {
        return '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + v + '</option>';
      }).join('');
      sel.addEventListener('change', function () {
        if (typeof FB_DIRTY !== 'undefined' && FB_DIRTY
            && !confirm('You have unsaved feedback. Switch video and lose it?')) {
          sel.value = cur; return;
        }
        // keep the tab you were on
        location.href = location.pathname + '?video=' + encodeURIComponent(sel.value) + location.hash;
      });
    } catch (e) { /* the board still works on its launch video */ }
  })();

  // ---- reviewed-and-collapsed -------------------------------------------
  // A view preference, kept in localStorage per video. NOT in cues.json:
  // handleSave un-approves the video whenever cues change, so a review
  // checkbox living there would silently revoke your own approval.
  var REV_KEY = 'board:reviewed:' + (typeof VIDEO === 'string' ? VIDEO : '');
  function revLoad() {
    try { return new Set(JSON.parse(localStorage.getItem(REV_KEY) || '[]')); }
    catch (e) { return new Set(); }
  }
  function revSave(set) {
    try { localStorage.setItem(REV_KEY, JSON.stringify([...set])); } catch (e) {}
  }
  function revApply(el, on) {
    el.classList.toggle('is-reviewed', on);
    var cb = el.querySelector('.rev-input');
    if (cb) cb.checked = on;
    // Drop the live card iframe while collapsed. A long video holds 30+ of
    // them, so collapsing as you go should make the page lighter, not just
    // shorter.
    el.querySelectorAll('iframe').forEach(function (f) {
      if (on) { if (f.src) { f.dataset.revSrc = f.src; f.removeAttribute('src'); } }
      else if (f.dataset.revSrc) { f.src = f.dataset.revSrc; delete f.dataset.revSrc; }
    });
    revCount();
  }
  function revCount() {
    var all = document.querySelectorAll('.reviewable');
    var done = document.querySelectorAll('.reviewable.is-reviewed');
    var out = document.getElementById('revCount');
    if (out) out.textContent = all.length ? done.length + ' / ' + all.length + ' reviewed' : '';
  }
  function revSet(el, on) {
    var set = revLoad();
    if (on) set.add(el.dataset.rid); else set.delete(el.dataset.rid);
    revSave(set);
    revApply(el, on);
  }
  function revAll(on) {
    document.querySelectorAll('.reviewable').forEach(function (el) { revSet(el, on); });
  }
  document.addEventListener('change', function (e) {
    var cb = e.target.closest && e.target.closest('.rev-input');
    if (!cb) return;
    revSet(cb.closest('.reviewable'), cb.checked);
  });
  // Clicking the collapsed header re-opens it, so you are never stuck.
  document.addEventListener('click', function (e) {
    if (e.target.closest('.rev') || e.target.closest('a') || e.target.closest('button')) return;
    var head = e.target.closest && e.target.closest('.rev-head');
    if (!head) return;
    var el = head.closest('.reviewable');
    if (el && el.classList.contains('is-reviewed')) revSet(el, false);
  });
  window.addEventListener('DOMContentLoaded', function () {
    var set = revLoad();
    document.querySelectorAll('.reviewable').forEach(function (el) {
      if (set.has(el.dataset.rid)) revApply(el, true);
    });
    revCount();
  });

  // ---- screenshot attachment on storyboard feedback ----------------------
  // Final Cut already took images; the storyboard boxes did not, so a comment
  // like "this card is wrong" arrived with no picture of what was wrong.
  // Pending attachments, keyed by cue ref, sent with the next Save.
  var FB_IMAGES = {};

  function fbShotFor(ref) { return document.querySelector('.fb-shot[data-ref="' + CSS.escape(ref) + '"]'); }

  function fbSetThumb(ref, dataUrl) {
    var box = fbShotFor(ref);
    if (!box) return;
    var thumb = box.querySelector('.fb-thumb');
    var btn = box.querySelector('.fb-attach');
    if (dataUrl) {
      thumb.innerHTML = '<img src="' + dataUrl + '" alt="attached screenshot"/>'
        + '<button type="button" class="fb-clear" title="remove screenshot">&times;</button>';
      btn.classList.add('has-image');
    } else {
      thumb.innerHTML = '';
      btn.classList.remove('has-image');
    }
  }

  function fbAttach(ref, file) {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 6 * 1024 * 1024) { alert('image too large (max 6MB)'); return; }
    var reader = new FileReader();
    reader.onload = function () {
      FB_IMAGES[ref] = reader.result;
      fbSetThumb(ref, reader.result);
      FB_DIRTY = true;   // an attachment is unsaved work like any other
    };
    reader.readAsDataURL(file);
  }

  document.addEventListener('click', function (e) {
    var attach = e.target.closest('.fb-attach');
    if (attach) {
      e.preventDefault();
      attach.parentElement.querySelector('.fb-file').click();
      return;
    }
    var clear = e.target.closest('.fb-clear');
    if (clear) {
      e.preventDefault();
      var ref = clear.closest('.fb-shot').dataset.ref;
      FB_IMAGES[ref] = null;        // null tells the server to drop it
      fbSetThumb(ref, null);
      FB_DIRTY = true;
    }
  });

  document.addEventListener('change', function (e) {
    var f = e.target.closest('.fb-file');
    if (!f) return;
    fbAttach(f.closest('.fb-shot').dataset.ref, f.files && f.files[0]);
    f.value = '';
  });

  // Paste straight into the comment box — the way you actually attach a
  // screenshot you just took.
  document.addEventListener('paste', function (e) {
    var ta = e.target.closest && e.target.closest('textarea.feedback');
    if (!ta || !e.clipboardData) return;
    var items = e.clipboardData.items || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].kind === 'file' && items[i].type.startsWith('image/')) {
        e.preventDefault();
        fbAttach(ta.dataset.ref, items[i].getAsFile());
        return;
      }
    }
  });

  window.addEventListener('beforeunload', (e) => { if (FB_DIRTY) { e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('input', (e) => { if (e.target.classList && e.target.classList.contains('feedback')) FB_DIRTY = true; });

  function showBanner(html, cls) {
    document.getElementById('banner').innerHTML = '<div class="banner ' + cls + '">'
      + '<button class="banner-x" title="dismiss" onclick="this.parentElement.remove()">&times;</button>' + html + '</div>';
  }

  function escapeForBanner(s) {
    return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }

  document.getElementById('saveBtn').onclick = async () => {
    const broken = [];
    const cues = [...document.querySelectorAll('.tile')].map((tile) => {
      let fragment;
      try { fragment = JSON.parse(tile.querySelector('.frag').value); }
      catch (e) { broken.push(tile.dataset.id + ': ' + e.message); return null; }
      const cue = {
        id: tile.dataset.id,
        card: tile.dataset.card,
        anchor: fragment.anchor,
        hold: fragment.hold,
        variables: fragment.variables,
        beats: fragment.beats,
        flagged: tile.querySelector('.flag-input').checked,
      };
      if (tile.dataset.lead !== '') cue.lead = Number(tile.dataset.lead);
      const note = tile.querySelector('.note').value;
      if (note) cue.note = note;
      return cue;
    }).filter(Boolean);
    if (broken.length) { showBanner('invalid fragment JSON — nothing saved:<br>' + broken.map(escapeForBanner).join('<br>'), 'err'); return; }

    const shotBroken = [];
    const spans = [...document.querySelectorAll('.shot-block')].map((b) => {
      try { return JSON.parse(b.querySelector('.shot-frag').value); }
      catch (e) { shotBroken.push(b.id + ': ' + e.message); return null; }
    }).filter(Boolean);
    if (shotBroken.length) { showBanner('invalid fragment JSON — nothing saved:<br>' + shotBroken.map(escapeForBanner).join('<br>'), 'err'); return; }

    const feedback = {};
    document.querySelectorAll('textarea.feedback').forEach((t) => { feedback[t.dataset.ref] = t.value; });
    const payload = { video: VIDEO, approved: APPROVED, cues, feedback };
    // Only refs the owner actually touched this session — sending every
    // existing image back would re-encode and rewrite files on every save.
    if (Object.keys(FB_IMAGES).length) payload.feedbackImages = FB_IMAGES;
    if (document.querySelectorAll('.shot-block').length > 0) payload.spans = spans;
    const toggles = [...document.querySelectorAll('.fx-toggle')];
    if (toggles.length > 0) {
      payload.effects = toggles.map((el) => ({ id: el.dataset.fxId, enabled: el.checked }));
    }

    const res = await fetch('/save', { method: 'POST', body: JSON.stringify(payload) });
    const data = await res.json();
    if (!data.ok) {
      showBanner(data.errors.map(escapeForBanner).join('<br>'), 'err');
    } else {
      FB_DIRTY = false;
      const warns = data.warnings || [];
      const errs = data.errors || [];
      if (warns.length > 0 || errs.length > 0) {
        let html = \`saved — \${warns.length} lint warnings, \${errs.length} errors<br><br>\`;
        const lines = [];
        for (const e of errs) lines.push(\`error: \${escapeForBanner(e)}\`);
        for (const w of warns) lines.push(escapeForBanner(w));
        showBanner(html + lines.join('<br>'), errs.length > 0 ? 'err' : 'ok');
      } else {
        location.reload();
      }
    }
  };

  document.getElementById('approveBtn').onclick = async () => {
    await fetch('/approve', { method: 'POST' });
    location.reload();
  };

  const approveShotsBtn = document.getElementById('approveShotsBtn');
  if (approveShotsBtn) {
    approveShotsBtn.onclick = async () => {
      await fetch('/approve-shots', { method: 'POST' });
      location.reload();
    };
  }

  const approveEffectsBtn = document.getElementById('approveEffectsBtn');
  if (approveEffectsBtn) {
    approveEffectsBtn.onclick = async () => {
      await fetch('/approve-effects', { method: 'POST' });
      location.reload();
    };
  }

  const approveCardPlanBtn = document.getElementById('approveCardPlanBtn');
  if (approveCardPlanBtn) {
    approveCardPlanBtn.onclick = async () => {
      await fetch('/approve-card-plan', { method: 'POST' });
      location.reload();
    };
  }

  // Card-plan notes. Saving one records WHY a card is right or wrong; the 130
  // fold routes it by section — intro/conclusion notes to the 035 rulebook,
  // body notes to the 030 one, never across.
  document.querySelectorAll('.plan-note-save').forEach((btn) => {
    btn.onclick = async () => {
      const input = btn.previousElementSibling;
      const text = (input.value || '').trim();
      if (!text) return;
      btn.disabled = true;
      await fetch('/card-feedback', {
        method: 'POST',
        body: JSON.stringify({
          part: input.dataset.part,
          cue: input.dataset.cue || null,
          card: input.dataset.card || null,
          text,
        }),
      });
      location.reload();
    };
  });

  const fcApproveBtn = document.getElementById('fc-approve-btn');
  if (fcApproveBtn) {
    fcApproveBtn.onclick = async () => {
      const ver = document.getElementById('fc-version').value;
      if (!ver) return;
      await fetch('/approve-final-cut', { method: 'POST', body: JSON.stringify({ version: ver }) });
      location.reload();
    };
  }
`;

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
function buildDetailBlocks(cues, segments, shots, feedbackItems, audit = null) {
  const fb = (ref) => feedbackItems[ref]?.folded ? '' : escapeHtml(feedbackItems[ref]?.text ?? '');
  const fbBox = (ref, placeholder) => {
    const foldedHtml = feedbackItems[ref]?.folded
      ? `<div class="feedback-folded">✓ folded ${escapeHtml(feedbackItems[ref].folded)} — "${escapeHtml(feedbackItems[ref].text)}"</div>`
      : '';
    const img = feedbackItems[ref]?.folded ? null : feedbackItems[ref]?.image;
    // Paste or attach a screenshot, same as the Final Cut tab. The thumbnail is
    // the receipt: without it there is no way to tell an attached comment from
    // a plain one until the fixing session opens feedback.json.
    const shotHtml = `
      <div class="fb-shot" data-ref="${escapeHtml(ref)}">
        <button type="button" class="fb-attach" title="attach a screenshot — or just paste one into the box above">&#128206; screenshot</button>
        <input type="file" class="fb-file" accept="image/*" hidden />
        <span class="fb-thumb">${img ? `<a href="/feedback-image/${encodeURIComponent(ref)}" target="_blank"><img src="/feedback-image/${encodeURIComponent(ref)}" alt="attached screenshot"/></a><button type="button" class="fb-clear" title="remove screenshot">&times;</button>` : ''}</span>
      </div>`;
    return `<textarea class="feedback" data-ref="${escapeHtml(ref)}" placeholder="${escapeHtml(placeholder)}">${fb(ref)}</textarea>${shotHtml}${foldedHtml}`;
  };

  const blocks = segments.map((seg, idx) => {
    const i = idx;
    const id = `seg-${i}`;
    const mid = (seg.start + seg.end) / 2;
    const inShot = shots?.spans?.some(s => mid >= s.start && mid <= s.start + s.duration) ? ' in-shot' : '';
    let html = '';

    if (seg.kind === 'gap') {
      const durSecs = seg.end - seg.start;
      const m = Math.floor(durSecs / 60);
      const s = Math.floor(durSecs % 60);
      const durStr = m > 0 ? `${m}m ${s}s` : `${s}s`;
      const allWords = seg.words.map(w => w.text).join(' ');
      const previewWords = seg.words.slice(0, 14).map(w => w.text).join(' ') + (seg.words.length > 14 ? '…' : '');
      html = `<div class="timeline-block gap-block${inShot}" id="${id}">
        <div class="gap-header" onclick="this.parentElement.classList.toggle('expanded')">
          <span class="gap-icon">▸</span> ${timecode(seg.start)} &rarr; ${timecode(seg.end)} &middot; ${durStr} &middot; <span style="color:var(--dim)">"${escapeHtml(previewWords)}"</span>
        </div>
        <div class="gap-body">${escapeHtml(allWords)}
          ${fbBox(`gap-${timecode(seg.start)}`, 'feedback for this stretch (read by the next Claude session)')}
        </div>
      </div>`;
    } else {

    const cue = cues.find(c => c.id === seg.cue.id);
    const r = seg.unresolved ? null : seg.cue;
    const beats = cue.beats ?? [];
    const fragment = { anchor: cue.anchor, hold: cue.hold ?? 3.0, variables: cue.variables ?? {}, beats };
    const beatLines = beats
      .map((b) => `<li><strong>${escapeHtml(b.reveal?.text ?? '')}</strong> @ "${escapeHtml(b.anchor ?? '')}"</li>`)
      .join('');

    let auditHtml = '';
    if (audit?.cues?.[cue.id]) {
      const v = audit.cues[cue.id];
      const color = v.verdict === 'labelled' ? 'var(--err)' : 'var(--ok)';
      const msg = v.fix ? ` title="${escapeHtml(v.fix)}"` : '';
      auditHtml = `<span class="usage-chip" style="border-color:${color}; color:${color}; margin-left:8px; cursor:default"${msg}>${escapeHtml(v.verdict)}</span>`;
    }

    const header = r
      ? `#${escapeHtml(cue.id)} &middot; ${timecode(r.start)} &rarr; ${timecode(r.start + r.duration)} &middot; ${escapeHtml(cue.card)} &middot; ${r.duration}s &middot; ${escapeHtml(r.placement)}${auditHtml}`
      : `#${escapeHtml(cue.id)} &middot; unresolved &middot; ${escapeHtml(cue.card)}${auditHtml}`;

    const probeTimes = r ? computeProbeTimes(r.variables?.beats, r.duration) : [];
    const media = r
      ? `<div class="preview" data-probe-times='${JSON.stringify(probeTimes)}'><iframe loading="lazy" src="/card/${encodeURIComponent(cue.id)}"></iframe></div>
      <audio class="scrub" controls src="/slice/${encodeURIComponent(cue.id)}.mp3"></audio>`
      : `<div class="unresolved-note">no resolved timing for this cue — fix the anchor and Save</div>`;

    const phrasesToHighlight = [cue.anchor, ...beats.map(b => b.anchor)];
    const highlighted = new Set();
    for (const phrase of phrasesToHighlight) {
      if (!phrase) continue;
      const p = phrase.split(/\s+/).map(normWord).filter(Boolean);
      if (p.length === 0) continue;
      for (let j = 0; j <= seg.words.length - p.length; j++) {
        let ok = true;
        for (let k = 0; k < p.length; k++) {
          if (normWord(seg.words[j + k].text) !== p[k]) { ok = false; break; }
        }
        if (ok) {
          for (let k = 0; k < p.length; k++) highlighted.add(j + k);
          break;
        }
      }
    }
    const excerptHtml = seg.words.map((w, j) => {
      const esc = escapeHtml(w.text);
      return highlighted.has(j) ? `<mark>${esc}</mark>` : esc;
    }).join(' ');

    const excerptDiv = seg.words.length ? `<div class="excerpt">${excerptHtml}</div>` : '';

    html = `<div class="timeline-block tile reviewable ${cue.flagged ? 'flagged' : ''}${inShot}" id="${id}" data-id="${escapeHtml(cue.id)}" data-rid="sb:${escapeHtml(cue.id)}" data-card="${escapeHtml(cue.card)}" data-lead="${cue.lead ?? ''}" data-start="${r ? r.start : 0}">
      <div class="tile-header rev-head">${header}${REV_BOX}</div>
      ${excerptDiv}
      <div class="anchor"><strong>${escapeHtml(cue.anchor ?? '')}</strong></div>
      <ul class="beats">${beatLines}</ul>
      ${media}
      <label class="flag"><input type="checkbox" class="flag-input" ${cue.flagged ? 'checked' : ''}/> flag: no card fits</label>
      <input class="note" type="text" placeholder="note (why no card fits)" value="${escapeHtml(cue.note ?? '')}" />
      ${fbBox(cue.id, 'feedback on this graphic — wrong card, wrong timing, wording… (read by the next Claude session)')}
      <textarea class="frag">${escapeHtml(JSON.stringify(fragment, null, 2))}</textarea>
    </div>`;
    }
    return { html, start: seg.start, id, isShot: false };
  });

  if (shots?.spans?.length) {
    for (const span of shots.spans) {
      const origSpan = shots.shotsFile?.spans?.find(s => s.id === span.id) || span;
      const label = origSpan.mode === 'panel' ? '[P]' : (origSpan.mode === 'side' ? '[S]' : '[A]');
      const noteHtml = span.note ? ` &mdash; ${escapeHtml(span.note)}` : '';
      const id = `shot-${escapeHtml(span.id)}`;
      const shotHtml = `<div class="timeline-block shot-block" id="${id}">
  <div class="shot-header">🧍 <b>${escapeHtml(span.id)}</b> ${label} &middot; ${timecode(span.start)} &rarr; ${timecode(span.start + span.duration)} &middot; ${span.duration}s${noteHtml}</div>
  <textarea class="shot-frag">${escapeHtml(JSON.stringify(origSpan, null, 2))}</textarea>
  ${fbBox(span.id, 'feedback on this shot span (read by the next Claude session)')}
</div>`;
      const block = { html: shotHtml, start: span.start, id, isShot: true };
      const idx = blocks.findIndex(b => !b.isShot && b.start >= span.start);
      if (idx !== -1) {
        blocks.splice(idx, 0, block);
      } else {
        blocks.push(block);
      }
    }
  }

  return blocks;
}

function renderBoardPage(cuesFile, resolved, words, feedbackItems = {}, shots = null, effects = null, sound = null, audit = null, cardPlan = null, hasResolved = true) {
  const byId = new Map(resolved.map((r) => [r.id, r]));
  const cues = cuesFile.cues || [];
  const flaggedCount = cues.filter((c) => c.flagged).length;
  const fb = (ref) => feedbackItems[ref]?.folded ? '' : escapeHtml(feedbackItems[ref]?.text ?? '');
  const fbBox = (ref, placeholder) => {
    const foldedHtml = feedbackItems[ref]?.folded
      ? `<div class="feedback-folded">✓ folded ${escapeHtml(feedbackItems[ref].folded)} — "${escapeHtml(feedbackItems[ref].text)}"</div>`
      : '';
    const img = feedbackItems[ref]?.folded ? null : feedbackItems[ref]?.image;
    // Paste or attach a screenshot, same as the Final Cut tab. The thumbnail is
    // the receipt: without it there is no way to tell an attached comment from
    // a plain one until the fixing session opens feedback.json.
    const shotHtml = `
      <div class="fb-shot" data-ref="${escapeHtml(ref)}">
        <button type="button" class="fb-attach" title="attach a screenshot — or just paste one into the box above">&#128206; screenshot</button>
        <input type="file" class="fb-file" accept="image/*" hidden />
        <span class="fb-thumb">${img ? `<a href="/feedback-image/${encodeURIComponent(ref)}" target="_blank"><img src="/feedback-image/${encodeURIComponent(ref)}" alt="attached screenshot"/></a><button type="button" class="fb-clear" title="remove screenshot">&times;</button>` : ''}</span>
      </div>`;
    return `<textarea class="feedback" data-ref="${escapeHtml(ref)}" placeholder="${escapeHtml(placeholder)}">${fb(ref)}</textarea>${shotHtml}${foldedHtml}`;
  };
  
  const segments = buildSegments(words, resolved);
  const unresolvedSegs = cues.filter(c => !byId.has(c.id)).map(c => ({
    kind: 'cue', cue: c, start: 0, end: 0, words: [], unresolved: true
  }));
  segments.unshift(...unresolvedSegs);
  
  const totalDuration = words.length ? words[words.length - 1].end : 0;

  const fxInstances = effects?.instances ?? [];
  const fxPoint = fxInstances.filter((i) => i.type === 'whip' || i.type === 'beat');
  const fxSpan = fxInstances.filter((i) => typeof i.start === 'number' && typeof i.end === 'number' && !['captions', 'bubble'].includes(i.type));
  const fxGlobal = fxInstances.filter((i) => i.type === 'captions' || i.type === 'bubble');
  const capChunks = fxInstances.some((i) => i.type === 'captions' && i.enabled) ? planCaptions(words) : [];
  const fxFullframes = resolved.filter((c) => c.placement === 'fullframe').map((c) => ({ id: c.id, start: c.start, end: c.start + c.duration }));
  const fxShotSpans = (shots?.spans ?? []).map((s) => ({ id: s.id, start: s.start, end: s.start + s.duration }));

  const fxLaneHtml = fxInstances.length ? `
  <div class="lane-row"><span class="lane-label">effects</span>
    <div class="minimap minimap-fx" style="position:relative; background:transparent;">
      ${fxSpan.map((i) => `<div class="fx-span${i.enabled ? '' : ' fx-off'}" title="${escapeHtml(i.id)}" style="left:${(i.start / totalDuration * 100).toFixed(2)}%; width:${((i.end - i.start) / totalDuration * 100).toFixed(2)}%"></div>`).join('')}
      ${fxPoint.map((i) => `<div class="fx-marker fx-${escapeHtml(i.type)}${i.enabled ? '' : ' fx-off'}" title="${escapeHtml(i.id)}${i.style ? ' · ' + escapeHtml(i.style) : ''}" style="left:${(i.at / totalDuration * 100).toFixed(2)}%"></div>`).join('')}
      <div id="fxPlayhead"></div>
    </div>
  </div>` : '';

  const fxChipsHtml = fxInstances.length ? `<div class="fx-chips">${fxInstances.map((i) => {
    const when = typeof i.at === 'number' ? ' ' + timecode(i.at) : (typeof i.start === 'number' ? ' ' + timecode(i.start) : '');
    const extra = i.style ? ' ' + escapeHtml(i.style) : '';
    return `<label class="fx-chip"><input type="checkbox" class="fx-toggle" data-fx-id="${escapeHtml(i.id)}" ${i.enabled ? 'checked' : ''}/>${escapeHtml(i.type)}${when}${extra}</label>`;
  }).join('')}</div>` : '';

  const minimapHtml = segments.filter(s => !s.unresolved).map((seg, i) => {
    const duration = Math.max(0.1, seg.end - seg.start);
    let colorVar = '--line';
    let title = `${timecode(seg.start)} · gap`;
    if (seg.kind === 'cue') {
      title = `${timecode(seg.start)} · ${escapeHtml(seg.cue.card)}`;
      const c = cues.find(c => c.id === seg.cue.id);
      if (c?.flagged) {
        colorVar = '--err';
      } else if (seg.cue.placement === 'fullframe') {
        colorVar = '--accent';
      } else {
        colorVar = '--overlay-seg';
      }
    }
    return `<div class="minimap-seg" title="${title}" style="flex-grow:${duration}; background:var(${colorVar});" onclick="document.getElementById('seg-${i + unresolvedSegs.length}').scrollIntoView({behavior:'smooth'})"></div>`;
  }).join('');

  let minimapShotsHtml = '';
  if (shots?.spans?.length || shots?.errors?.length) {
    const spans = [...(shots.spans || [])].sort((a, b) => a.start - b.start);
    let t = 0;
    const items = [];
    for (const span of spans) {
      if (span.start > t) {
        items.push(`<div class="minimap-seg" style="flex-grow:${span.start - t}; background:var(--line)"></div>`);
      }
      const origSpan = shots.shotsFile?.spans?.find(s => s.id === span.id) || span;
      const label = origSpan.mode === 'panel' ? '[P]' : (origSpan.mode === 'side' ? '[S]' : '[A]');
      items.push(`<div class="minimap-seg" title="${timecode(span.start)} &middot; ${escapeHtml(span.id)} &middot; ${label}" style="flex-grow:${span.duration}; background:var(--shot)" onclick="document.getElementById('shot-${escapeHtml(span.id)}').scrollIntoView({behavior:'smooth'})"></div>`);
      t = span.start + span.duration;
    }
    if (t < totalDuration) {
      items.push(`<div class="minimap-seg" style="flex-grow:${totalDuration - t}; background:var(--line)"></div>`);
    }
    minimapShotsHtml = `<div class="minimap minimap-shots">${items.join('')}</div>`;
  }

  const timelineBlocks = buildDetailBlocks(cues, segments, shots, feedbackItems, audit);
  const timelineHtml = timelineBlocks.map(b => b.html).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(cuesFile.video ?? "?")} — visuals-flow board</title>
<style>${BOARD_CSS}</style>
</head>
<body>
  <div class="sticky-header">
    <div class="topbar">
      <span class="view-toggle"><a href="/#card-plan">Card Plan</a><a href="/">Storyboard</a><a href="/#final-cut">Final Cut</a></span>
      <span class="view-toggle" style="margin-left:8px;"><a href="/">Timeline</a><a href="/list" class="active">List</a></span>
      <div>video: <strong>${escapeHtml(cuesFile.video ?? '')}</strong></div>
      <div>duration: ${timecode(totalDuration)}</div>
      <div>${cues.length} graphics &middot; ${flaggedCount} flagged</div>
      <button id="approveBtn">Approve graphics</button>
      ${shots ? `<span class="usage-chip">engineMode: ${escapeHtml(shots.shotsFile?.engineMode || 'none')}</span><button id="approveShotsBtn">Approve shots</button>` : ''}
      <button id="saveBtn">Save</button>
      <a href="/calibrate" style="color:var(--dim); font-size:13px;">calibrate</a>
    </div>
    <div id="banner">
      ${cuesFile.approved ? '<div class="banner ok"><button class="banner-x" title="dismiss" onclick="this.parentElement.remove()">&times;</button>approved — ready for <code>node lib/render.mjs</code></div>' : ''}
      ${shots && shots.shotsFile?.approved ? '<div class="banner ok"><button class="banner-x" title="dismiss" onclick="this.parentElement.remove()">&times;</button>shot plan approved — ready for the avatar render step</div>' : ''}
      ${effects && effects.approved ? '<div class="banner ok"><button class="banner-x" title="dismiss" onclick="this.parentElement.remove()">&times;</button>effects approved — ready for step 090 assemble</div>' : ''}
      ${shots?.errors?.length ? `<div class="banner err"><button class="banner-x" title="dismiss" onclick="this.parentElement.remove()">&times;</button>shots: ${shots.errors.map(escapeHtml).join('<br>')}</div>` : ''}
    </div>
    <button id="overviewToggle" class="fold-toggle" onclick="toggleOverview()">overview ▾</button>
    <div id="overviewBlock">
    <div class="usage">${(() => {
      const counts = new Map();
      for (const c of cues) counts.set(c.card, (counts.get(c.card) ?? 0) + 1);
      return [...counts.entries()].sort((a, b) => b[1] - a[1])
        .map(([card, n]) => `<span class="usage-chip${n > 3 ? ' hot' : ''}">${escapeHtml(card.split('/').pop())} &times;${n}</span>`)
        .join('');
    })()}</div>
    <div class="lane-row"><span class="lane-label">graphics</span><div class="minimap">${minimapHtml}</div></div>
    ${minimapShotsHtml ? `<div class="lane-row"><span class="lane-label">avatar</span>${minimapShotsHtml}</div>` : ''}
    ${fxLaneHtml}
    ${sound?.instances?.length ? `<div class="lane-row"><span class="lane-label">sound</span><div class="minimap minimap-fx" style="position:relative; background:transparent;">${
      sound.instances.map(inst => {
        if (typeof inst.at !== 'number') return '';
        return `<div class="tl-mark${inst.enabled === false ? ' fx-off' : ''}" title="${escapeHtml(inst.sample || inst.id)} @ ${timecode(inst.at)}" style="left:${(inst.at / totalDuration * 100).toFixed(2)}%; background:#fcd34d; position:absolute; width:4px; height:100%;"></div>`;
      }).join('')
    }</div></div>` : ''}
    <div class="lane-legend">
      <span><span class="dot" style="background:var(--accent)"></span>fullframe card</span>
      <span><span class="dot" style="background:var(--overlay-seg)"></span>overlay card</span>
      ${minimapShotsHtml ? '<span><span class="dot" style="background:var(--shot)"></span>full-screen avatar</span>' : ''}
      <span><span class="dot" style="background:var(--line)"></span>screen recording + corner avatar</span>
    </div>
    ${fxChipsHtml}
    </div>
    <script>
      function toggleOverview() {
        const el = document.getElementById('overviewBlock');
        const btn = document.getElementById('overviewToggle');
        const hide = el.style.display !== 'none';
        el.style.display = hide ? 'none' : '';
        btn.textContent = hide ? 'overview ▸' : 'overview ▾';
        try { localStorage.setItem('board:list-overview', hide ? 'closed' : 'open'); } catch (e) {}
      }
      if ((() => { try { return localStorage.getItem('board:list-overview'); } catch (e) { return null; } })() === 'closed') toggleOverview();

      function toggleDerivatives() {
        const lBlock = document.getElementById('derivativesLabelsBlock');
        const tBlock = document.getElementById('derivativesTracksBlock');
        const btn = document.getElementById('derivativesToggle');
        const show = tBlock.style.display === 'none';
        lBlock.style.display = show ? 'block' : 'none';
        tBlock.style.display = show ? 'block' : 'none';
        btn.textContent = show ? 'details ▾' : 'details ▸';
        try { localStorage.setItem('board:tl-derivatives', show ? 'open' : 'closed'); } catch (e) {}
      }
      if ((() => { try { return localStorage.getItem('board:tl-derivatives'); } catch (e) { return null; } })() === 'open') toggleDerivatives();
    </script>
    ${fbBox('_global', 'overall feedback on this video\'s graphics plan — saved with Save, read by the next Claude session')}
    ${fxInstances.length ? `
    <audio id="master" class="scrub" controls src="/vo.mp3"></audio>
    <div id="fxStage">
      <div class="frame"><span class="ctx" id="fxCtx"></span></div>
      <div class="flash"></div>
      <div class="bubble"></div>
      <div class="cap" id="fxCap"></div>
      <div class="note-fixed">timing preview — final look is the module's</div>
    </div>` : ''}
  </div>
  <div class="timeline">${timelineHtml}</div>
  <script>
    ${OVERFLOW_BADGE_JS}
    ${INIT_BLOCK_JS}
    const VIDEO = ${JSON.stringify(cuesFile.video ?? '')};
    let APPROVED = ${JSON.stringify(!!cuesFile.approved)};
    ${SAVE_ACTIONS_JS}
    const FX_DATA = ${JSON.stringify({ instances: fxInstances, fullframes: fxFullframes, spans: fxShotSpans, capChunks, total: totalDuration })};
    ${FX_SIM_HELPERS}
    let FX_DIRTY_TOGGLES = false;
    document.querySelectorAll('.fx-toggle').forEach(el => {
      el.addEventListener('change', () => {
        FX_DIRTY_TOGGLES = true;
        const marker = document.querySelector(\`.minimap-fx [title^="\${el.dataset.fxId}"]\`);
        if (marker) marker.classList.toggle('fx-off', !el.checked);
      });
    });

    initBlock(document);

    const master = document.getElementById('master');
    const fxStage = document.getElementById('fxStage');
    const fxPlayhead = document.getElementById('fxPlayhead');
    const fxCtx = document.getElementById('fxCtx');
    const fxCap = document.getElementById('fxCap');
    const fxBubble = document.querySelector('#fxStage .bubble');
    if (master) {
      let masterRaf = null;
      let prevT = 0;
      master.addEventListener('pause', () => { 
        fxStage.classList.remove('on'); 
        if (fxPlayhead) fxPlayhead.style.opacity = '0';
        if (masterRaf) cancelAnimationFrame(masterRaf); 
      });
      master.addEventListener('play', () => {
        document.querySelectorAll('.tile audio').forEach((a) => { if (!a.paused) a.pause(); });
        fxStage.classList.add('on');
        if (fxPlayhead) fxPlayhead.style.opacity = '1';
        prevT = master.currentTime;
        const loop = () => {
          const t = master.currentTime;
          if (fxPlayhead) fxPlayhead.style.left = (t / FX_DATA.total * 100) + '%';
          const ctx = fxContext(t, FX_DATA.fullframes, FX_DATA.spans);
          
          const ctxCls = 'ctx-' + ctx;
          if (!fxStage.classList.contains(ctxCls)) {
            fxStage.classList.remove('ctx-graphic', 'ctx-avatar', 'ctx-screen');
            fxStage.classList.add(ctxCls);
          }

          fxCtx.textContent = ctx === 'graphic' 
            ? (FX_DATA.fullframes.find(f => t >= f.start && t < f.end)?.id || 'graphic')
            : ctx;
          
          for (const ev of fxEventsAt(prevT, t, FX_DATA.instances)) {
            const cls = ev.type === 'whip' && ev.style === 'flash' ? 'fx-flash' 
              : ev.type === 'whip' ? 'fx-whipblur' : 'fx-punch';
            fxStage.classList.add(cls);
            setTimeout(() => fxStage.classList.remove(cls), 350);
          }
          
          const bubbleInst = FX_DATA.instances.find(i => i.type === 'bubble');
          if (fxBubble) fxBubble.classList.toggle('on', !!(bubbleInst && bubbleInst.enabled));
          
          const capChunk = FX_DATA.capChunks.find(c => t >= c.start && t < c.end);
          if (capChunk && ctx === 'screen') {
            fxCap.innerHTML = capChunk.words.map(w => w.hl ? '<span class="hl">'+escapeForBanner(w.text)+'</span>' : escapeForBanner(w.text)).join(' ');
          } else {
            fxCap.innerHTML = '';
          }
          
          prevT = t;
          if (!master.paused) masterRaf = requestAnimationFrame(loop);
        };
        loop();
      });
    }

    wireOverflowBadges();
  </script>
</body>
</html>`;
}

// The board's default (`/`) landing page: a horizontal, editor-style timeline
// (SCREEN/GRAPHICS/AVATAR/EFFECTS lanes on one time ruler) with on-demand
// previews — clicking a block moves its buildDetailBlocks HTML (shared with
// /list) into a docked panel and only then loads its card iframe. Delivers
// GFX-08 (global play-through) via the master playhead.
function renderTimelinePage(cuesFile, resolved, words, feedbackItems = {}, shots = null, effects = null, sound = null, audit = null, cardPlan = null, hasResolved = true) {
  const byId = new Map(resolved.map((r) => [r.id, r]));
  const cues = cuesFile.cues || [];
  const flaggedCount = cues.filter((c) => c.flagged).length;
  const fb = (ref) => feedbackItems[ref]?.folded ? '' : escapeHtml(feedbackItems[ref]?.text ?? '');
  const fbBox = (ref, placeholder) => {
    const foldedHtml = feedbackItems[ref]?.folded
      ? `<div class="feedback-folded">✓ folded ${escapeHtml(feedbackItems[ref].folded)} — "${escapeHtml(feedbackItems[ref].text)}"</div>`
      : '';
    const img = feedbackItems[ref]?.folded ? null : feedbackItems[ref]?.image;
    // Paste or attach a screenshot, same as the Final Cut tab. The thumbnail is
    // the receipt: without it there is no way to tell an attached comment from
    // a plain one until the fixing session opens feedback.json.
    const shotHtml = `
      <div class="fb-shot" data-ref="${escapeHtml(ref)}">
        <button type="button" class="fb-attach" title="attach a screenshot — or just paste one into the box above">&#128206; screenshot</button>
        <input type="file" class="fb-file" accept="image/*" hidden />
        <span class="fb-thumb">${img ? `<a href="/feedback-image/${encodeURIComponent(ref)}" target="_blank"><img src="/feedback-image/${encodeURIComponent(ref)}" alt="attached screenshot"/></a><button type="button" class="fb-clear" title="remove screenshot">&times;</button>` : ''}</span>
      </div>`;
    return `<textarea class="feedback" data-ref="${escapeHtml(ref)}" placeholder="${escapeHtml(placeholder)}">${fb(ref)}</textarea>${shotHtml}${foldedHtml}`;
  };

  const segments = buildSegments(words, resolved);
  const unresolvedSegs = cues.filter(c => !byId.has(c.id)).map(c => ({
    kind: 'cue', cue: c, start: 0, end: 0, words: [], unresolved: true
  }));
  segments.unshift(...unresolvedSegs);

  const totalDuration = Math.max(0.1, words.length ? words[words.length - 1].end : 0);

  const fxInstances = effects?.instances ?? [];
  const fxPoint = fxInstances.filter((i) => i.type === 'whip' || i.type === 'beat');
  const fxSpan = fxInstances.filter((i) => typeof i.start === 'number' && typeof i.end === 'number' && !['captions', 'bubble'].includes(i.type));
  const fxGlobal = fxInstances.filter((i) => i.type === 'captions' || i.type === 'bubble');

  const graphicsBlocksHtml = segments.map((seg, i) => {
    if (seg.kind !== 'cue' || seg.unresolved) return '';
    const r = seg.cue;
    const cue = cues.find((c) => c.id === r.id);
    const colorVar = cue?.flagged ? '--err' : (r.placement === 'fullframe' ? '--accent' : '--overlay-seg');
    const label = escapeHtml((r.card ?? '').split('/').pop());
    return `<div class="tl-block" data-start="${r.start}" data-dur="${r.duration}" data-detail="seg-${i}"
      title="${escapeHtml(r.card ?? '')} &middot; ${timecode(r.start)}" style="background:var(${colorVar})">${label}</div>`;
  }).join('');

  const avatarBlocksHtml = (shots?.spans ?? []).map((span) => {
    const mode = shots?.resolved?.find(s => s.id === span.id)?.mode || '?';
    return `<div class="tl-block" data-start="${span.start}" data-dur="${span.duration}"
      data-detail="shot-${escapeHtml(span.id)}" title="${escapeHtml(span.id)}" style="background:var(--shot)">${escapeHtml(span.id)} <small style="opacity:0.8">(${escapeHtml(mode)})</small></div>`;
  }).join('');

  const fxMarksHtml = fxPoint.map((i) => `<div class="tl-mark${i.enabled ? '' : ' fx-off'}" data-start="${i.at}"
    title="${escapeHtml(i.id)}${i.style ? ' · ' + escapeHtml(i.style) : ''}" style="background:var(${i.type === 'whip' ? '--accent' : '--ok'})"></div>`).join('');
  const fxSpansHtml = fxSpan.map((i) => `<div class="tl-span${i.enabled ? '' : ' fx-off'}" data-start="${i.start}" data-dur="${i.end - i.start}"
    title="${escapeHtml(i.id)}"></div>`).join('');
  const fxChipsHtml = fxGlobal.length ? `<div class="tl-fx-chips">${fxGlobal.map((i) =>
    `<span class="tl-chip${i.enabled ? '' : ' fx-off'}">${escapeHtml(i.type)}</span>`).join('')}</div>` : '';

  const detailBlocks = buildDetailBlocks(cues, segments, shots, feedbackItems, audit);
  const storeHtml = detailBlocks.map((b) =>
    `<div class="detail-item" id="detail-${b.id}">${b.html.replace('<iframe loading="lazy" src=', '<iframe loading="lazy" data-src=')}</div>`
  ).join('\n');

  let cardPlanHtml = '';
  if (cardPlan) {
    const items = cardPlan.sections.flatMap(s => s.items);
    const existing = items.filter(i => i.status === 'existing').length;
    const toBuild = items.filter(i => i.status === 'new').length;
    const summaryHtml = `<div>${items.length} cues &middot; ${existing} existing &middot; ${toBuild} to build</div>`;

    // Gate feedback already recorded, grouped by section so each card can show
    // its own history. Keys are `zone-<part>:<n>` for the intro/conclusion and
    // `card-body:<n>` for the body — the prefix is what routes the lesson to
    // the right rulebook at 130 (see lib/card-plan.mjs).
    const planComments = {};
    for (const [key, it] of Object.entries(feedbackItems ?? {})) {
      let part = null;
      if (key.startsWith('zone-')) part = it.zone ?? key.slice('zone-'.length).split(':')[0];
      else if (key.startsWith('card-body:')) part = 'body';
      else continue;
      (planComments[part] ??= []).push({
        text: it.text ?? '',
        added: it.added ?? '',
        folded: Boolean(it.folded),
        cue: it.context?.cue ?? null,
      });
    }

    const rulebookOf = (part) => part === 'body'
      ? 'the body rulebook (030)'
      : 'the intro/outro rulebook (035)';

    const sectionsHtml = cardPlan.sections.map(s => {
      const itemsHtml = s.items.map(item => {
        const badge = item.status === 'existing'
          ? `<span class="usage-chip" style="color:var(--ok); border-color:var(--ok)">EXISTING</span>`
          : `<span class="usage-chip" style="color:var(--err); border-color:var(--err); font-weight:bold;">NEW &mdash; to build</span>`;
        // The proposal is a structured spec, so the owner can judge the card
        // without opening anything: what it does, what kind it is, how many
        // beats, what varies.
        const p = item.proposal;
        const specBits = p ? [
          p.kind ? `kind: ${p.kind}` : null,
          p.beats ? `${p.beats} beats` : null,
          p.placement ? p.placement : null,
          Array.isArray(p.variables) && p.variables.length ? `vars: ${p.variables.join(', ')}` : null,
        ].filter(Boolean) : [];
        const proposal = item.status === 'new' && p
          ? `<div style="margin-top:4px; font-size:13px; color:var(--text); background:var(--panel); padding:8px; border-radius:4px; border:1px solid var(--line);">${escapeHtml(p.does ?? '')}${specBits.length ? `<div style="margin-top:4px; font-size:12px; color:var(--dim); font-family:ui-monospace,Menlo,monospace;">${specBits.map(escapeHtml).join(' &middot; ')}</div>` : ''}</div>`
          : '';
        const flagged = item.flagged ? `<span class="usage-chip" style="color:var(--err); border-color:var(--err)">flagged</span> ` : '';
        // Why-box. Approving or rejecting a card used to record nothing, so the
        // lesson died at the gate (see appendCardPlanFeedback in lib/card-plan.mjs).
        const priorHtml = (planComments[s.part] ?? [])
          .filter((c) => c.cue === item.id)
          .map((c) => `<div style="font-size:12px; color:var(--dim); margin-top:6px;">&ldquo;${escapeHtml(c.text)}&rdquo; <span style="opacity:.7">${escapeHtml(c.added ?? '')}${c.folded ? ' &middot; folded' : ''}</span></div>`)
          .join('');
        return `<div class="reviewable" data-rid="cp:${escapeHtml(item.id)}" style="margin-bottom:12px; padding:12px; border-bottom:1px solid var(--line);">
          <div class="rev-head" style="display:flex; align-items:center; gap:12px; margin-bottom:4px;">
            <strong style="font-family:ui-monospace,Menlo,monospace; font-size:12px;">#${escapeHtml(item.id)}</strong>
            <span style="color:var(--dim)">${escapeHtml(item.card ?? '(none)')}</span>
            <span class="usage-chip">${escapeHtml(item.placement ?? '?')}</span>
            ${badge}
            ${flagged}
            ${REV_BOX}
          </div>
          ${item.anchor ? `<div style="font-size:12px; color:var(--dim); font-style:italic;">@ &ldquo;${escapeHtml(item.anchor)}&rdquo;</div>` : ''}
          ${proposal}
          ${priorHtml}
          <div style="margin-top:8px; display:flex; gap:6px;">
            <input class="plan-note" data-part="${escapeHtml(s.part)}" data-cue="${escapeHtml(item.id)}" data-card="${escapeHtml(item.card ?? '')}"
                   placeholder="why is this right or wrong? (folds into ${escapeHtml(rulebookOf(s.part))})"
                   style="flex:1; font-size:12px; padding:6px; background:var(--panel); color:var(--text); border:1px solid var(--line); border-radius:4px;">
            <button class="plan-note-save" style="font-size:12px;">Save</button>
          </div>
        </div>`;
      }).join('');

      // Section-level box: not every note is about one card. "the whole intro
      // feels flat" is the most useful kind of feedback here and had nowhere
      // to live when the only inputs were per-cue.
      const sectionLevel = (planComments[s.part] ?? [])
        .filter((c) => !c.cue)
        .map((c) => `<div style="font-size:12px; color:var(--dim); margin-top:6px;">&ldquo;${escapeHtml(c.text)}&rdquo; <span style="opacity:.7">${escapeHtml(c.added ?? '')}${c.folded ? ' &middot; folded' : ''}</span></div>`)
        .join('');
      // The body has no measured span — only the zones are measured from the
      // source recordings, so a timecode range is shown only where one exists.
      const span = s.start != null
        ? ` <span style="font-size:13px; font-weight:normal; color:var(--dim); font-family:ui-monospace,Menlo,monospace;">(${timecode(s.start)} &rarr; ${timecode(s.end)})</span>`
        : '';
      return `
        <div style="margin-bottom:32px;">
          <h2 style="font-size:16px; margin-bottom:12px; text-transform:capitalize;">${escapeHtml(s.part)}${span}</h2>
          ${itemsHtml || '<div style="color:var(--dim); font-size:13px;">(no graphics planned)</div>'}
          ${sectionLevel}
          <div style="margin-top:10px; display:flex; gap:6px;">
            <input class="plan-note" data-part="${escapeHtml(s.part)}"
                   placeholder="a note about the ${escapeHtml(s.part)} as a whole"
                   style="flex:1; font-size:12px; padding:6px; background:var(--panel); color:var(--text); border:1px solid var(--line); border-radius:4px;">
            <button class="plan-note-save" style="font-size:12px;">Save</button>
          </div>
        </div>
      `;
    }).join('');

    cardPlanHtml = `
  <div id="tab-card-plan" style="display:none;">
    <div class="sticky-header">
      <div class="topbar">
        <span class="view-toggle" id="tab-toggle-cp">
          <button data-target="tab-run" class="tab-btn" onclick="switchTab(this)">Run</button>
          <button data-target="tab-card-plan" class="tab-btn active" onclick="switchTab(this)">Card Plan</button>
          <button data-target="tab-storyboard" class="tab-btn" onclick="switchTab(this)">Storyboard</button>
          <button data-target="tab-final-cut" class="tab-btn" onclick="switchTab(this)">Final Cut</button>
        </span>
        <span class="view-toggle" style="margin-left:8px;"><a href="/" class="active">Timeline</a><a href="/list">List</a></span>
        <div>video: <strong>${escapeHtml(cuesFile.video ?? '')}</strong> — card plan
          <select id="videoPicker" style="margin-left:6px; background:var(--panel); color:var(--text); border:1px solid var(--line); border-radius:4px; padding:3px 5px; font-size:12px;"></select>
        </div>
        ${summaryHtml}
        <button id="approveCardPlanBtn" style="border-color:var(--ok); color:var(--ok);">Approve card plan</button>
      </div>
      <div id="banner-card-plan">
        ${cardPlan.approved ? `<div class="banner ok"><button class="banner-x" title="dismiss" onclick="this.parentElement.remove()">&times;</button>approved — ${toBuild > 0 ? 'build the NEW cards (step 038), then <code>run.sh &lt;slug&gt; resolve</code>' : 'ready for <code>run.sh &lt;slug&gt; resolve</code>'}</div>` : ''}
      </div>
    </div>
    <div style="max-width:800px; margin:0 auto; padding-top:20px;">
      ${sectionsHtml}
    </div>
  </div>`;
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(cuesFile.video ?? "?")} — visuals-flow board</title>
<style>${BOARD_CSS}${TIMELINE_CSS}${RUN_CSS}</style>
<script>
  // Tab switching is hash-backed so browser back/forward works and a reload
  // restores the tab you were on (owner-reported gap, 2026-07-24).
  // Run is the landing tab: the point of it is that someone who has not been
  // watching the terminal can open one URL and see where the video is.
  // #storyboard is now an explicit hash, because "no hash" belongs to Run.
  var HASH_TAB = { '#run': 'tab-run', '#card-plan': 'tab-card-plan', '#storyboard': 'tab-storyboard', '#final-cut': 'tab-final-cut' };
  var TAB_HASH = { 'tab-run': '', 'tab-card-plan': '#card-plan', 'tab-storyboard': '#storyboard', 'tab-final-cut': '#final-cut' };
  function switchTab(btn) { applyTab(btn.dataset.target, true); }
  function applyTab(target, push) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.target === target));
    ['tab-run','tab-card-plan','tab-storyboard','tab-final-cut'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = id === target ? 'block' : 'none';
    });
    var wantHash = TAB_HASH[target] || '';
    if (push && (location.hash || '') !== wantHash) history.pushState(null, '', location.pathname + location.search + wantHash);
    if (target === 'tab-final-cut') initFinalCut();
    if (target === 'tab-run') loadRun();
  }
  function tabForHash() { return HASH_TAB[location.hash] || 'tab-run'; }
  window.addEventListener('popstate', () => applyTab(tabForHash(), false));
  window.addEventListener('DOMContentLoaded', () => applyTab(tabForHash(), false));

  // ---- Run tab ----------------------------------------------------------
  // Read-only. It renders run-log.json plus, for steps with no entry, a status
  // inferred from the artifacts on disk — those are labelled, because an
  // inferred step has no record of what was done or what went wrong.
  // One emoji per status, right-aligned into a single column.
  var RUN_MARK = {
    done:    ['✅', 'done'],
    running: ['🔄', 'in progress'],
    blocked: ['❌', 'blocked'],
    skipped: ['⏭️', 'skipped'],
    todo:    ['⚪', 'to do']
  };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }
  function runFieldRow(label, value) {
    if (!value) return '';
    return '<div class="run-field"><b>' + label + '</b><span>' + esc(value) + '</span></div>';
  }
  function runStepRow(s) {
    var mark = RUN_MARK[s.status] || RUN_MARK.todo;
    // The step id stays verbatim — it is the canonical name — but the leading
    // number is split off so the names line up in a column.
    var name = s.id.slice(4);
    var body = '';
    if (s.derived) {
      body = '<div class="run-inferred">status inferred from the files on disk — this step ran before the ledger, '
           + 'so nothing was recorded about it</div>';
    } else {
      var fields = runFieldRow('did', s.did) + runFieldRow('issues', s.issues) + runFieldRow('output', s.output);
      if (fields) body = '<div class="run-fields">' + fields + '</div>';
    }
    return '<div class="run-row is-' + esc(s.status) + '">'
      + '<div class="run-head">'
      + '<span class="run-num">' + esc(s.number) + '</span>'
      + '<span class="run-name">' + esc(name) + '</span>'
      + '<span class="run-kind">' + esc(s.kind) + '</span>'
      + '<span class="run-mark' + (s.status === 'running' ? ' spin' : '') + '" title="' + esc(mark[1]) + '">'
      + mark[0] + '</span>'
      + '</div>' + body + '</div>';
  }
  async function loadRun(video) {
    var target = video
      || new URLSearchParams(location.search).get('video')
      || (document.getElementById('runVideoPicker') || {}).value
      || '';
    var box = document.getElementById('runSteps');
    try {
      var r = await fetch('/run-log' + (target ? '?video=' + encodeURIComponent(target) : ''));
      var data = await r.json();
      if (data.error) { box.innerHTML = '<div style="color:#ef4444;">' + esc(data.error) + '</div>'; return; }
      box.innerHTML = data.steps.map(runStepRow).join('');
      var sm = data.summary;
      document.getElementById('runSummary').innerHTML =
        '<span style="font-size:14px;">✅ ' + sm.done + ' / ' + sm.total + '</span>'
        + (sm.running ? '<span style="margin-left:12px;">🔄 ' + sm.running + '</span>' : '')
        + (sm.blocked ? '<span style="margin-left:12px;">❌ ' + sm.blocked + '</span>' : '')
        + (sm.derived ? '<span style="margin-left:12px; font-size:12px;">(' + sm.derived + ' inferred)</span>' : '');
      document.getElementById('runBanner').innerHTML = data.next
        ? '<div class="banner">next: <code>' + esc(data.next) + '</code></div>'
        : '<div class="banner ok">every step is done</div>';
    } catch (e) {
      box.innerHTML = '<div style="color:#ef4444;">could not load the run log: ' + esc(e.message) + '</div>';
    }
  }
  async function initRunPicker() {
    var picker = document.getElementById('runVideoPicker');
    if (!picker) return;
    try {
      var r = await fetch('/run-videos');
      var d = await r.json();
      // The URL wins over the server's launch video: the page was rendered for
      // whatever ?video= says, so the picker and the ledger must agree with it.
      var cur = new URLSearchParams(location.search).get('video') || d.current;
      picker.innerHTML = d.videos.map(function (v) {
        return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(v) + '</option>';
      }).join('');
      // Navigate, don't swap content: the URL must always name the video you
      // are looking at, and switching must move every tab, not just this one.
      picker.addEventListener('change', function () {
        location.href = location.pathname + '?video=' + encodeURIComponent(picker.value) + location.hash;
      });
    } catch (e) { /* the tab still works against the current video */ }
  }
  window.addEventListener('DOMContentLoaded', function () { initRunPicker().then(function () { loadRun(); }); });
</script>
</head>
<body>
  <div id="tab-run" style="display:none;">
    <div class="sticky-header">
      <div class="topbar">
        <span class="view-toggle">
          <button data-target="tab-run" class="tab-btn active" onclick="switchTab(this)">Run</button>
          ${cardPlan ? '<button data-target="tab-card-plan" class="tab-btn" onclick="switchTab(this)">Card Plan</button>' : ''}
          <button data-target="tab-storyboard" class="tab-btn" onclick="switchTab(this)">Storyboard</button>
          <button data-target="tab-final-cut" class="tab-btn" onclick="switchTab(this)">Final Cut</button>
        </span>
        <div>video:
          <select id="runVideoPicker" style="background:var(--panel); color:var(--text); border:1px solid var(--line); border-radius:4px; padding:4px 6px; font-size:13px;"></select>
        </div>
        <div id="runSummary" style="color:var(--dim); font-size:13px;"></div>
      </div>
      <div id="runBanner" style="max-width:860px; margin:0 auto; padding:0 20px;"></div>
    </div>
    <div style="max-width:860px; margin:0 auto; padding:16px 20px 60px;">
      <div id="runSteps" style="color:var(--dim);">loading…</div>
    </div>
  </div>
  ${cardPlanHtml}
  <div id="tab-storyboard">
    <div class="sticky-header">
      <div class="topbar">
        <span class="view-toggle" id="tab-toggle">
          <button data-target="tab-run" class="tab-btn" onclick="switchTab(this)">Run</button>
          ${cardPlan ? '<button data-target="tab-card-plan" class="tab-btn" onclick="switchTab(this)">Card Plan</button>' : ''}
          <button data-target="tab-storyboard" class="tab-btn active" onclick="switchTab(this)">Storyboard</button>
          <button data-target="tab-final-cut" class="tab-btn" onclick="switchTab(this)">Final Cut</button>
        </span>
        <span class="view-toggle" style="margin-left:8px;"><a href="/" class="active">Timeline</a><a href="/list">List</a></span>
        <div>video: <strong>${escapeHtml(cuesFile.video ?? '')}</strong>
          <select id="videoPicker" style="margin-left:6px; background:var(--panel); color:var(--text); border:1px solid var(--line); border-radius:4px; padding:3px 5px; font-size:12px;"></select>
        </div>
        <div>duration: ${timecode(totalDuration)}</div>
        <div>${cues.length} graphics &middot; ${flaggedCount} flagged</div>
        <button id="approveBtn"${hasResolved ? '' : ' disabled title="nothing to approve until step 040 resolves the cues"'}>Approve graphics</button>
        ${shots ? `<span class="usage-chip">engineMode: ${escapeHtml(shots.shotsFile?.engineMode || 'none')}</span><button id="approveShotsBtn">Approve shots</button>` : ''}
        ${effects ? `<button id="approveEffectsBtn">Approve effects</button>` : ''}
        <button id="saveBtn">Save</button>
        <span id="revCount" style="color:var(--dim); font-size:12px;"></span>
        <button class="fold-toggle" onclick="revAll(true)" title="collapse every card">mark all reviewed</button>
        <button class="fold-toggle" onclick="revAll(false)" title="expand every card">expand all</button>
        <a href="/calibrate" style="color:var(--dim); font-size:13px;">calibrate</a>
      </div>
      <div id="banner">
        ${hasResolved ? '' : `<div class="banner">no <code>resolved.json</code> yet, so this timeline is empty &mdash; it is written by step 040. Approve the card plan first (Gate 1, the <a href="#card-plan">Card Plan</a> tab), build any NEW cards at 038, then run <code>run.sh ${escapeHtml(cuesFile.video ?? '&lt;slug&gt;')} resolve</code>.</div>`}
        ${cuesFile.approved ? '<div class="banner ok"><button class="banner-x" title="dismiss" onclick="this.parentElement.remove()">&times;</button>approved — ready for <code>node lib/render.mjs</code></div>' : ''}
        ${shots && shots.shotsFile?.approved ? '<div class="banner ok"><button class="banner-x" title="dismiss" onclick="this.parentElement.remove()">&times;</button>shot plan approved — ready for the avatar render step</div>' : ''}
        ${effects && effects.approved ? '<div class="banner ok"><button class="banner-x" title="dismiss" onclick="this.parentElement.remove()">&times;</button>effects approved — ready for step 090 assemble</div>' : ''}
        ${shots?.errors?.length ? `<div class="banner err"><button class="banner-x" title="dismiss" onclick="this.parentElement.remove()">&times;</button>shots: ${shots.errors.map(escapeHtml).join('<br>')}</div>` : ''}
      </div>
      <audio id="master" class="scrub" controls src="/vo.mp3"></audio>
      <div class="tl-zoom-row">
        <label>zoom <input type="range" id="zoom" min="0.4" max="30" step="0.1" value="1"/></label>
        ${sound?.instances?.length ? `<label style="margin-left:14px; font-size:13px; color:var(--dim);"><input type="checkbox" id="sfxToggle" checked> SFX preview</label>` : ''}
      </div>
      ${fbBox('_global', 'overall feedback on this video\'s graphics plan — saved with Save, read by the next Claude session')}
    </div>
    <div class="tl-layout">
      <div class="tl-canvas-wrap">
        <div class="tl-canvas">
          <div class="tl-labels">
            <div class="tl-label tl-ruler-spacer"></div>
            <div class="tl-label">SCREEN</div>
            <div class="tl-label">GRAPHICS</div>
            <div class="tl-label">AVATAR</div>
            <div class="tl-label" style="height:24px; border-bottom:1px solid var(--line);"></div>
            <div id="derivativesLabelsBlock" style="display:none;">
              <div class="tl-label">EFFECTS</div>
              ${sound?.instances?.length ? `<div class="tl-label">SOUND</div>` : ''}
            </div>
          </div>
          <div class="tl-tracks" id="tlTracks">
            <div class="tl-ruler" id="tlRuler"></div>
            <div class="tl-track" id="tlScreen"><div class="tl-screen-bar"></div></div>
            <div class="tl-track" id="tlGraphics">${graphicsBlocksHtml}</div>
            <div class="tl-track" id="tlAvatar">${avatarBlocksHtml}</div>
            <div class="tl-track tl-derivatives-toggle-track" style="height:24px; border-bottom:1px solid var(--line); display:flex; align-items:center;">
               <button id="derivativesToggle" class="fold-toggle" style="margin-left:8px;" onclick="toggleDerivatives()">details ▸</button>
               ${effects ? `<button id="approveEffectsBtn" style="margin-left:8px; padding:2px 8px; font-size:11px;">Approve effects</button>` : ''}
            </div>
            <div id="derivativesTracksBlock" style="display:none;">
              <div class="tl-track" id="tlEffects">${fxChipsHtml}${fxSpansHtml}${fxMarksHtml}</div>
              ${sound?.instances?.length ? `<div class="tl-track" id="tlSound">${
                sound.instances.map(inst => {
                  if (typeof inst.at !== 'number') return '';
                  return `<div class="tl-mark" data-start="${inst.at}" title="${escapeHtml(inst.sample || inst.id)}" style="background:#fcd34d"></div>`;
                }).join('')
              }</div>` : ''}
            </div>
            <div class="tl-playhead" id="tlPlayhead"></div>
          </div>
        </div>
      </div>
      <aside id="detail-panel"><div class="placeholder">click a block to preview</div></aside>
    </div>
  </div>
  
  <div id="tab-final-cut" style="display:none; padding:20px;">
    <div style="display:flex; align-items:center; gap:16px; margin-bottom:16px;">
      <span class="view-toggle">
        <button data-target="tab-run" class="tab-btn" onclick="switchTab(this)">Run</button>
        ${cardPlan ? '<button data-target="tab-card-plan" class="tab-btn" onclick="switchTab(this)">Card Plan</button>' : ''}
        <button data-target="tab-storyboard" class="tab-btn" onclick="switchTab(this)">Storyboard</button>
        <button data-target="tab-final-cut" class="tab-btn active" onclick="switchTab(this)">Final Cut</button>
      </span>
      <div>video: <strong>${escapeHtml(cuesFile.video ?? '')}</strong> — final cut review</div>
    </div>
    <div style="display:flex; gap:20px; align-items:flex-start;">
      <div style="flex:1;">
        <select id="fc-version"></select>
        <input type="range" id="fc-scrub" min="0" max="0" step="0.01" value="0" />
        <div id="fc-transport">
          <button id="fc-play" class="fc-tbtn">&#9654; Play</button>
          <span id="fc-clock"><span class="cur">0:00.0</span> / <span id="fc-dur">0:00.0</span></span>
          <button class="fc-tbtn" data-seek="-5">&minus;5s</button>
          <button class="fc-tbtn" data-seek="5">+5s</button>
          <button class="fc-tbtn" data-frame="-1">&#8249; frame</button>
          <button class="fc-tbtn" data-frame="1">frame &#8250;</button>
          <select id="fc-speed">
            <option value="0.5">0.5&times;</option>
            <option value="0.75">0.75&times;</option>
            <option value="1" selected>1&times;</option>
            <option value="1.25">1.25&times;</option>
            <option value="1.5">1.5&times;</option>
            <option value="2">2&times;</option>
          </select>
          <button id="fc-mute" class="fc-tbtn" title="mute/unmute">&#128266;</button>
        </div>
        <div style="position:relative; margin-top:8px; background:#000; border-radius:8px; overflow:hidden;" id="fc-video-container">
          <video id="fc-video" style="width:100%; display:block; cursor:crosshair;"></video>
          <div id="fc-pin-marker" style="position:absolute; width:12px; height:12px; background:var(--err); border:2px solid #fff; border-radius:50%; transform:translate(-50%,-50%); display:none; pointer-events:none; z-index:10; box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>
        </div>
        <div id="fc-kbd-hint">
          <kbd>Space</kbd> play/pause &middot; <kbd>&larr;</kbd> <kbd>&rarr;</kbd> &plusmn;5s &middot; <kbd>&#8679;</kbd>+<kbd>&larr;</kbd> <kbd>&rarr;</kbd> step a frame &middot; <strong>just start typing</strong> to note the current moment &middot; <strong>click the frame</strong> to pin a note to that exact spot
        </div>
        <div id="fc-msg" style="margin-top:6px; color:var(--dim);"></div>
      </div>
      <div style="width:400px; flex:none; background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:16px;">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <h3>Comments</h3>
          <button id="fc-approve-btn" class="fc-tbtn" style="border-color:var(--ok); color:var(--ok);" disabled>Approve final cut</button>
        </div>
        <div id="fc-comments" style="margin:16px 0; max-height:400px; overflow-y:auto; font-size:14px;"></div>
        <textarea id="fc-input" rows="4" placeholder="Pause video to type comment... (Enter to send · Shift+Enter for newline · paste a screenshot to attach)" disabled></textarea>
        <div style="display:flex; align-items:center; gap:8px; margin-top:8px;">
          <button id="fc-send" class="fold-toggle" style="margin:0" disabled>Send</button>
          <button id="fc-attach" class="fold-toggle" style="margin:0" disabled>&#128206; image</button>
          <input type="file" id="fc-file" accept="image/*" hidden />
          <span id="fc-img-preview" style="display:none; align-items:center; gap:6px; font-size:12px; color:var(--dim);"></span>
        </div>
      </div>
    </div>
  </div>

  <div id="detail-store" hidden>${storeHtml}</div>
  <script>
    ${OVERFLOW_BADGE_JS}
    ${INIT_BLOCK_JS}
    const VIDEO = ${JSON.stringify(cuesFile.video ?? '')};
    let APPROVED = ${JSON.stringify(!!cuesFile.approved)};
    ${SAVE_ACTIONS_JS}

    const TOTAL = ${totalDuration};
    const LABEL_W = 90;
    const canvasWrap = document.querySelector('.tl-canvas-wrap');
    const zoom = document.getElementById('zoom');
    let PXPS_FIT = Math.min(30, Math.max(0.4, (canvasWrap.clientWidth - LABEL_W) / TOTAL));
    let pxps = PXPS_FIT;
    zoom.min = PXPS_FIT;
    zoom.value = PXPS_FIT;

    function fmtClock(t) {
      const m = Math.floor(t / 60), s = Math.floor(t % 60);
      return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }
    function drawRuler() {
      const ruler = document.getElementById('tlRuler');
      ruler.innerHTML = '';
      const step = Math.max(1, Math.round(80 / pxps));
      for (let t = 0; t <= TOTAL; t += step) {
        const tick = document.createElement('div');
        tick.className = 'tl-tick';
        tick.style.left = (t * pxps) + 'px';
        tick.textContent = fmtClock(t);
        ruler.appendChild(tick);
      }
    }
    function layout() {
      document.querySelectorAll('.tl-track, #tlRuler').forEach((t) => { t.style.width = (TOTAL * pxps) + 'px'; });
      document.querySelectorAll('.tl-block').forEach((b) => {
        b.style.left = (parseFloat(b.dataset.start) * pxps) + 'px';
        b.style.width = Math.max(2, parseFloat(b.dataset.dur || 0) * pxps) + 'px';
      });
      document.querySelectorAll('.tl-mark, .tl-span').forEach((m) => {
        m.style.left = (parseFloat(m.dataset.start) * pxps) + 'px';
        if (m.classList.contains('tl-span')) m.style.width = Math.max(2, parseFloat(m.dataset.dur || 0) * pxps) + 'px';
      });
      drawRuler();
    }
    zoom.addEventListener('input', () => { pxps = +zoom.value; layout(); });

    let openId = null;
    function reveal(detailId) {
      const store = document.getElementById('detail-store');
      const panel = document.getElementById('detail-panel');
      if (openId) {
        const prev = document.getElementById('detail-' + openId);
        if (prev) store.appendChild(prev);
      }
      const node = document.getElementById('detail-' + detailId);
      if (!node) return;
      panel.replaceChildren(node);
      node.querySelectorAll('iframe[data-src]').forEach((f) => { if (!f.src) f.src = f.dataset.src; });
      initBlock(node);
      openId = detailId;
    }
    document.querySelectorAll('[data-detail]').forEach((el) =>
      el.addEventListener('click', () => reveal(el.dataset.detail)));

    const master = document.getElementById('master');
    const BLOCK_TIMES = ${JSON.stringify(detailBlocks.map(b => ({ id: b.id, start: b.start, isShot: b.isShot })))};
    master.addEventListener('play', () => {
      document.querySelectorAll('.tile audio').forEach((a) => { if (!a.paused) a.pause(); });
    });
    master.addEventListener('timeupdate', () => {
      document.getElementById('tlPlayhead').style.left = (master.currentTime * pxps) + 'px';
      const t = master.currentTime;
      let active = null;
      for (const b of BLOCK_TIMES) {
        if (b.isShot) continue;
        if (b.start <= t) active = b;
      }
      if (active && active.id !== openId) reveal(active.id);
      if (active) {
        const tile = document.querySelector('#detail-panel .tile');
        if (tile) {
          const iframe = tile.querySelector('iframe');
          const start = parseFloat(tile.dataset.start || '0');
          if (iframe && iframe.contentWindow) {
            try { iframe.contentWindow.postMessage({ t: t - start }, '*'); } catch {}
          }
        }
      }
    });
    document.getElementById('tlRuler').addEventListener('click', (e) => {
      master.currentTime = e.offsetX / pxps;
    });
    window.addEventListener('resize', () => {
      const wasFit = pxps === PXPS_FIT;
      PXPS_FIT = Math.min(30, Math.max(0.4, (canvasWrap.clientWidth - LABEL_W) / TOTAL));
      zoom.min = PXPS_FIT;
      if (wasFit) { pxps = PXPS_FIT; zoom.value = pxps; layout(); }
    });

    layout();
    wireOverflowBadges();

    // Final Cut Logic
    let fcInited = false;
    async function initFinalCut() {
      if (fcInited) return;
      fcInited = true;
      try {
        const res = await fetch('/versions');
        const data = await res.json();
        const sel = document.getElementById('fc-version');
        if (!data.versions || !data.versions.length) {
          sel.innerHTML = '<option>No versions available</option>';
          sel.disabled = true;
          return;
        }
        data.versions.reverse().forEach(v => {
          const opt = document.createElement('option');
          opt.value = v.label;
          opt.textContent = v.label;
          sel.appendChild(opt);
        });
        sel.onchange = () => loadFcVersion(sel.value);
        loadFcVersion(sel.value);
        // Live check-off: poll status while the tab is visible so fixes tick
        // off without a refresh (plan-140 Gate B behavior).
        setInterval(async () => {
          if (document.getElementById('tab-final-cut').style.display === 'none') return;
          try {
            const s = await fetch('/status');
            fcStatus = (await s.json()).items || {};
            renderFcComments(document.getElementById('fc-version').value);
          } catch (e) {}
        }, 2500);
      } catch (e) {
        console.error(e);
      }
    }

    let fcStatus = {};
    async function loadFcVersion(label) {
      const vid = document.getElementById('fc-video');
      vid.src = '/video/' + label;
      try {
        const s = await fetch('/status');
        const data = await s.json();
        fcStatus = data.items || {};
      } catch (e) {}
      const btn = document.getElementById('fc-approve-btn');
      if (btn) btn.disabled = false;
      renderFcComments(label);
    }

    let fcItems = ${JSON.stringify(feedbackItems)};
    async function editFcComment(key) {
      const cur = fcItems[key]; if (!cur) return;
      const text = prompt('Edit comment:', cur.text);
      if (text === null || !text.trim() || text === cur.text) return;
      const res = await fetch('/feedback-final-edit', { method: 'POST', body: JSON.stringify({ key, text: text.trim() }) });
      if (res.ok) { fcItems[key] = { ...cur, text: text.trim() }; renderFcComments(document.getElementById('fc-version').value); }
      else alert('failed to edit');
    }
    async function deleteFcComment(key) {
      if (!confirm('Delete this comment?')) return;
      const res = await fetch('/feedback-final-delete', { method: 'POST', body: JSON.stringify({ key }) });
      if (res.ok) { delete fcItems[key]; renderFcComments(document.getElementById('fc-version').value); }
      else alert('failed to delete');
    }
    function showFcPin(x, y) {
      const m = document.getElementById('fc-pin-marker');
      if (x === null || x === undefined) { m.style.display = 'none'; return; }
      m.style.left = x + '%'; m.style.top = y + '%'; m.style.display = 'block';
    }
    function renderFcComments(label) {
      const items = fcItems;
      const container = document.getElementById('fc-comments');
      container.innerHTML = '';
      const prefix = 'final-' + label + ':';
      for (const [k, v] of Object.entries(items)) {
        if (!k.startsWith(prefix)) continue;
        const div = document.createElement('div');
        div.style.marginBottom = '12px';
        div.style.padding = '8px';
        div.style.background = 'var(--bg)';
        div.style.borderRadius = '4px';
        let html = '';
        if (v.t !== undefined) html += \`<strong style="color:var(--accent); cursor:pointer" onclick="document.getElementById('fc-video').currentTime=\${v.t}; showFcPin(\${v.x ?? 'null'}, \${v.y ?? 'null'})">\${fmtClock(v.t)}</strong> \`;
        html += escapeHtml(v.text).replace(/\\n/g, '<br>');
        if (v.image) html += \`<div style="margin-top:6px;"><a href="/feedback-image/\${encodeURIComponent(k)}" target="_blank"><img src="/feedback-image/\${encodeURIComponent(k)}" style="max-width:100%; max-height:120px; border-radius:6px; border:1px solid var(--line);"/></a></div>\`;
        if (!v.folded) {
          html += \`<span style="float:right; white-space:nowrap;">
            <button class="fc-cbtn" title="edit" onclick="editFcComment('\${k}')">✎</button>
            <button class="fc-cbtn" title="delete" onclick="deleteFcComment('\${k}')">✕</button>
          </span>\`;
        }
        
        const st = fcStatus[k];
        if (st) {
          const color = st.status === 'fixed' ? 'var(--ok)' : (st.status === 'question' ? 'var(--err)' : 'var(--dim)');
          html += \`<div style="margin-top:4px; font-size:12px; color:\${color}; border:1px solid \${color}; display:inline-block; padding:2px 6px; border-radius:4px;">\${st.status}: \${escapeHtml(st.message||'')}</div>\`;
        }
        
        div.innerHTML = html;
        container.appendChild(div);
      }
    }

    const fcVideo = document.getElementById('fc-video');
    const fcInput = document.getElementById('fc-input');
    const fcMarker = document.getElementById('fc-pin-marker');
    let fcCurrentPin = null;

    fcVideo.addEventListener('pause', () => {
      fcInput.disabled = false;
      document.getElementById('fc-send').disabled = false;
      document.getElementById('fc-attach').disabled = false;
      fcInput.placeholder = 'Type comment for ' + fmtClock(fcVideo.currentTime) + '... (Enter to send · Shift+Enter for newline)';
      fcInput.focus();
    });
    fcVideo.addEventListener('play', () => {
      fcInput.disabled = true;
      document.getElementById('fc-send').disabled = true;
      document.getElementById('fc-attach').disabled = true;
      fcInput.value = '';
      fcMarker.style.display = 'none';
      fcCurrentPin = null;
      clearFcImage();
    });
    fcVideo.addEventListener('click', (e) => {
      if (!fcVideo.paused) {
        fcVideo.pause();
        return;
      }
      const rect = fcVideo.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      fcCurrentPin = { x: +(x.toFixed(2)), y: +(y.toFixed(2)) };
      fcMarker.style.left = x + '%';
      fcMarker.style.top = y + '%';
      fcMarker.style.display = 'block';
      fcInput.focus();
    });

    // ── Click transport + keyboard layer (owner ask 2026-07-24: Loop-Studio-
    // style review player — scrub, ±5s, frame stepping, speed, type-to-note) ──
    const FC_FPS = 30;
    const fcScrub = document.getElementById('fc-scrub');
    const fcPlayBtn = document.getElementById('fc-play');
    const fcClockCur = document.querySelector('#fc-clock .cur');
    const fcDurEl = document.getElementById('fc-dur');
    const fcSpeedSel = document.getElementById('fc-speed');
    const fcMuteBtn = document.getElementById('fc-mute');
    let fcScrubbing = false;
    function fcPaintScrub(t) {
      const p = fcVideo.duration ? (t / fcVideo.duration * 100) : 0;
      fcScrub.style.setProperty('--fc-prog', p + '%');
    }
    // mm:ss:ff — the current-time readout carries FRAMES. Without them a frame
    // step moves the clock 1/30s, mm:ss does not change, the scrubber moves
    // 0.01% of its width, and the button reads as broken even though it fired
    // correctly (owner report 2026-07-25).
    // Counted in WHOLE FRAMES, not seconds-plus-a-fraction: 5 + 1/30 is
    // 5.0333333, and (5.0333333 - 5) * 30 floors to 0, so two consecutive
    // frames would both read ":00" and stepping would still look stuck.
    function fmtClockFrames(t) {
      const total = Math.round(t * FC_FPS);
      const m = Math.floor(total / (60 * FC_FPS));
      const s = Math.floor(total / FC_FPS) % 60;
      const f = total % FC_FPS;
      return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + ':' + String(f).padStart(2, '0');
    }
    function fcUpdateClock() {
      fcClockCur.textContent = fmtClockFrames(fcVideo.currentTime);
      if (!fcScrubbing) { fcScrub.value = fcVideo.currentTime; fcPaintScrub(fcVideo.currentTime); }
    }
    fcVideo.addEventListener('loadedmetadata', () => {
      fcScrub.max = fcVideo.duration;
      fcDurEl.textContent = fmtClock(fcVideo.duration);
      fcVideo.playbackRate = +fcSpeedSel.value; // survives version switches
      fcUpdateClock();
    });
    fcVideo.addEventListener('timeupdate', fcUpdateClock);
    fcVideo.addEventListener('seeked', fcUpdateClock);
    fcVideo.addEventListener('play', () => { fcPlayBtn.innerHTML = '&#10074;&#10074; Pause'; });
    fcVideo.addEventListener('pause', () => { fcPlayBtn.innerHTML = '&#9654; Play'; fcUpdateClock(); });
    fcPlayBtn.addEventListener('click', () => { fcVideo.paused ? fcVideo.play() : fcVideo.pause(); });
    fcScrub.addEventListener('input', () => {
      fcScrubbing = true;
      fcVideo.currentTime = +fcScrub.value;
      fcClockCur.textContent = fmtClockFrames(+fcScrub.value);
      fcPaintScrub(+fcScrub.value);
    });
    fcScrub.addEventListener('change', () => { fcScrubbing = false; });
    function fcSeek(d) {
      fcVideo.currentTime = Math.max(0, Math.min(fcVideo.duration || 0, fcVideo.currentTime + d));
    }
    function fcFrameStep(dir) { if (!fcVideo.paused) fcVideo.pause(); fcSeek(dir / FC_FPS); }
    document.querySelectorAll('#fc-transport [data-seek]').forEach((b) => b.addEventListener('click', () => fcSeek(+b.dataset.seek)));
    document.querySelectorAll('#fc-transport [data-frame]').forEach((b) => b.addEventListener('click', () => fcFrameStep(+b.dataset.frame)));
    fcSpeedSel.addEventListener('change', () => { fcVideo.playbackRate = +fcSpeedSel.value; });
    fcMuteBtn.addEventListener('click', () => {
      fcVideo.muted = !fcVideo.muted;
      fcMuteBtn.innerHTML = fcVideo.muted ? '&#128263;' : '&#128266;';
    });

    function fcTransportKey(e) {
      if (e.key === ' ') { e.preventDefault(); fcVideo.paused ? fcVideo.play() : fcVideo.pause(); return true; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); e.shiftKey ? fcFrameStep(-1) : fcSeek(-5); return true; }
      if (e.key === 'ArrowRight') { e.preventDefault(); e.shiftKey ? fcFrameStep(1) : fcSeek(5); return true; }
      return false;
    }
    document.addEventListener('keydown', (e) => {
      if (document.getElementById('tab-final-cut').style.display === 'none') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      const inField = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (inField) {
        // empty comment box: transport keys pass through, so pause→focus never
        // steals Space/arrows; anything typed keeps the box working as normal
        if (t === fcInput && fcInput.value === '') fcTransportKey(e);
        return;
      }
      if (fcTransportKey(e)) return;
      // just start typing → pause and the keystroke lands in the comment box
      if (e.key.length === 1) {
        e.preventDefault();
        if (!fcVideo.paused) fcVideo.pause();
        fcInput.disabled = false;
        fcInput.focus();
        fcInput.value += e.key;
      }
    });
    // Image attachment state: paste a screenshot into the textarea or pick a
    // file — the image rides the comment so the fixing session can Read it
    // instead of extracting frames by timestamp (owner ask, 2026-07-24).
    let fcPendingImage = null;
    const fcPreview = document.getElementById('fc-img-preview');
    function setFcImage(dataUrl, name) {
      fcPendingImage = dataUrl;
      fcPreview.style.display = 'inline-flex';
      fcPreview.innerHTML = \`<img src="\${dataUrl}" style="height:34px; border-radius:4px; border:1px solid var(--line);"/> \${escapeHtml(name || 'pasted image')} <button class="fc-cbtn" title="remove image" onclick="clearFcImage()">✕</button>\`;
    }
    function clearFcImage() {
      fcPendingImage = null;
      fcPreview.style.display = 'none';
      fcPreview.innerHTML = '';
    }
    function readFcImageFile(file) {
      if (!file || !file.type.startsWith('image/')) return;
      if (file.size > 6 * 1024 * 1024) { alert('image too large (max 6MB)'); return; }
      const r = new FileReader();
      r.onload = () => setFcImage(r.result, file.name);
      r.readAsDataURL(file);
    }
    fcInput.addEventListener('paste', (e) => {
      for (const it of (e.clipboardData?.items || [])) {
        if (it.kind === 'file' && it.type.startsWith('image/')) {
          e.preventDefault();
          readFcImageFile(it.getAsFile());
          return;
        }
      }
    });
    document.getElementById('fc-attach').addEventListener('click', () => document.getElementById('fc-file').click());
    document.getElementById('fc-file').addEventListener('change', (e) => { readFcImageFile(e.target.files[0]); e.target.value = ''; });

    async function submitFcComment() {
      const text = fcInput.value.trim();
      if (!text && !fcPendingImage) return;
      const t = fcVideo.currentTime;
      const item = { text, t, context: 'final@' + fmtClock(t) };
      if (fcCurrentPin) {
        item.x = fcCurrentPin.x;
        item.y = fcCurrentPin.y;
      }
      fcInput.disabled = true;
      document.getElementById('fc-send').disabled = true;
      const label = document.getElementById('fc-version').value;
      const res = await fetch('/feedback-final', {
        method: 'POST',
        body: JSON.stringify({ label, item, image: fcPendingImage })
      });
      document.getElementById('fc-send').disabled = false;
      if (res.ok) {
        // No reload: keep the tab, the video position, and the pin flow intact.
        const data = await res.json();
        if (data.key) fcItems[data.key] = data.item;
        fcInput.value = '';
        fcInput.disabled = false;
        fcInput.placeholder = 'Pause video to type comment... (Enter to send · Shift+Enter for newline · paste a screenshot to attach)';
        fcMarker.style.display = 'none';
        fcCurrentPin = null;
        clearFcImage();
        renderFcComments(label);
      } else {
        fcInput.disabled = false;
        alert('failed to save');
      }
    }
    document.getElementById('fc-send').addEventListener('click', submitFcComment);
    fcInput.addEventListener('keydown', (e) => {
      // Enter = send (owner ask 2026-07-24); Shift+Enter = newline.
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitFcComment();
      }
    });

    function escapeHtml(s) {
      if (!s) return '';
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
  </script>
</body>
</html>`;
}

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

// Deleting a comment must take its screenshot with it, or feedback-images/
// fills with orphans nothing references.
export function dropFeedbackImage(workdir, item) {
  if (!item?.image) return;
  const p = path.join(workdir, item.image);
  if (p.startsWith(path.join(workdir, 'feedback-images'))) fs.rmSync(p, { force: true });
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
          if (ref.startsWith('gap-')) {
            const gap = gaps.find(g => `gap-${timecode(g.start)}` === ref);
            if (gap) {
              item.context = { start: gap.start, end: gap.end, excerpt: gap.words.slice(0, 8).map(w => w.text).join(' ') };
            }
          } else if (ref !== '_global') {
            const span = (mergedShots?.spans ?? []).find(s => s.id === ref);
            const rSpan = (resolvedSpans ?? []).find(s => s.id === ref);
            if (span && rSpan) {
              item.context = { start: rSpan.start, end: rSpan.end, note: span.note };
            } else {
              const cue = (merged.cues ?? []).find(c => c.id === ref);
              const r = resolved.find(c => c.id === ref);
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
      const { errors: sErrors, warnings: sWarnings } = lintShots({ shotsResolved: resolvedSpans, resolvedCues: resolved, words });
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
      '080',
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

async function handleApproveCardPlan(req, res, workdir) {
  await readBody(req);
  const zpPath = path.join(workdir, 'card-plan.json');
  const cardPlan = JSON.parse(fs.readFileSync(zpPath, 'utf8'));
  cardPlan.approved = true;
  fs.writeFileSync(zpPath, JSON.stringify(cardPlan, null, 2));
  recordGate(workdir, '037', 'Owner approved the card plan — every card the video will use, body and zones.', 'card-plan.json approved=true');
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
  recordGate(workdir, '120', `Owner approved the final cut (version ${payload.version}).`, `final-cut.json approved=true, version ${payload.version}`);
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

function renderCalibratePage(catalog) {
  const beatCards = catalog.cards.filter((c) => c.kind === 'beat');
  const tilesHtml = beatCards.map((card) => {
    const { beats } = synthCalibrationVars(card);
    const probeTimes = computeProbeTimes(beats, card.default_duration);
    const header = `${escapeHtml(card.slug)} &middot; max_beats=${card.max_beats} &middot; max_reveal_chars=${card.max_reveal_chars}`;
    return `<div class="timeline-block tile">
      <div class="tile-header">${header}</div>
      <div class="preview" data-probe-times='${JSON.stringify(probeTimes)}'>
        <iframe loading="lazy" src="/calibrate-card/${encodeURIComponent(card.slug)}"></iframe>
      </div>
    </div>`;
  }).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Calibrate beat card capacity</title>
<style>${BOARD_CSS}</style>
</head>
<body>
  <div class="sticky-header">
    <div class="topbar">
      <div><strong>Calibrate</strong> — every beat card filled to its declared caps</div>
      <div>${beatCards.length} beat cards</div>
      <a href="/" style="color:var(--dim); font-size:13px;">back to board</a>
    </div>
  </div>
  <div class="timeline">${tilesHtml}</div>
  <script>
    ${OVERFLOW_BADGE_JS}
    document.querySelectorAll('.tile').forEach(wireProbe);
    wireOverflowBadges();
  </script>
</body>
</html>`;
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

function serveCard(res, workdir, cardLibraryRoot, id) {
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
  res.end(injectShim(brandedHtml, enrichedVars));
}

function serveSlice(res, workdir, id) {
  const slicePath = path.join(workdir, 'slices', `${id}.mp3`);
  if (!fs.existsSync(slicePath)) {
    res.statusCode = 404;
    return res.end('slice not found');
  }
  res.setHeader('content-type', 'audio/mpeg');
  res.setHeader('cache-control', 'no-store');
  res.end(fs.readFileSync(slicePath));
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
  for (const f of BOOT_FILES) if (!fs.existsSync(path.join(target, f))) return launchWorkdir;
  return target;
}

async function handleRequest(req, res, launchWorkdir, cardLibraryRoot) {
  const url = new URL(req.url, 'http://localhost');
  const workdir = requestedWorkdir(url, launchWorkdir);
  // Slices are cut per video and only on demand, so a switched-to video gets
  // them the first time it is opened rather than at server start.
  if (workdir !== launchWorkdir) ensureSlices(workdir);

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
    const { cuesFile, resolved, words, feedbackItems, shots, effects, sound, audit, cardPlan, hasResolved } = loadBoardData(workdir);
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    return res.end(renderTimelinePage(cuesFile, resolved, words, feedbackItems, shots, effects, sound, audit, cardPlan, hasResolved));
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
    if (want) {
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

  if (req.method === 'GET' && url.pathname === '/list') {
    const { cuesFile, resolved, words, feedbackItems, shots, effects, sound, audit, cardPlan, hasResolved } = loadBoardData(workdir);
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    return res.end(renderBoardPage(cuesFile, resolved, words, feedbackItems, shots, effects, sound, audit, cardPlan, hasResolved));
  }

  const cardMatch = url.pathname.match(/^\/card\/([^/]+)$/);
  if (req.method === 'GET' && cardMatch) {
    return serveCard(res, workdir, cardLibraryRoot, cardMatch[1]);
  }

  if (req.method === 'GET' && url.pathname === '/calibrate') {
    const catalog = JSON.parse(fs.readFileSync(path.join(cardLibraryRoot, 'catalog.json'), 'utf8'));
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    return res.end(renderCalibratePage(catalog));
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

  if (req.method === 'POST' && url.pathname === '/save') {
    return handleSave(req, res, workdir, cardLibraryRoot);
  }

  if (req.method === 'POST' && url.pathname === '/approve') {
    return handleApprove(req, res, workdir);
  }

  if (req.method === 'POST' && url.pathname === '/approve-shots') {
    return handleApproveShots(req, res, workdir);
  }

  if (req.method === 'POST' && url.pathname === '/approve-card-plan') {
    return handleApproveCardPlan(req, res, workdir);
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
    process.env.ASSEMBLE_MEDIA_ROOT ?? path.join(os.homedir(), 'kb-scratch', 'video', 'visuals-flow-2'),
    path.basename(workdir),
  );

  if (req.method === 'GET' && url.pathname === '/versions') {
    const p = path.join(kbWorkdir, 'versions.json');
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    return res.end(fs.existsSync(p) ? fs.readFileSync(p) : '{"versions":[]}');
  }

  const fbImgMatch = url.pathname.match(/^\/feedback-image\/(.+)$/);
  if (req.method === 'GET' && fbImgMatch) {
    const key = decodeURIComponent(fbImgMatch[1]);
    const fbPath = path.join(workdir, 'feedback.json');
    const fb = fs.existsSync(fbPath) ? JSON.parse(fs.readFileSync(fbPath, 'utf8')) : { items: {} };
    const rel = fb.items?.[key]?.image;
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
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      });
      fs.createReadStream(videoPath).pipe(res);
    }
    return;
  }

  if (req.method === 'POST' && (url.pathname === '/feedback-final-edit' || url.pathname === '/feedback-final-delete')) {
    const body = await readBody(req);
    let payload;
    try { payload = JSON.parse(body); } catch (e) { res.statusCode = 400; return res.end('{"ok":false}'); }
    const key = String(payload.key ?? '');
    if (!key.startsWith('final-')) { res.statusCode = 400; return res.end('{"ok":false,"error":"final-* keys only"}'); }
    const fbPath = path.join(workdir, 'feedback.json');
    const fb = fs.existsSync(fbPath) ? JSON.parse(fs.readFileSync(fbPath, 'utf8')) : { items: {} };
    const item = fb.items?.[key];
    if (!item) { res.statusCode = 404; return res.end('{"ok":false,"error":"no such comment"}'); }
    if (item.folded) { res.statusCode = 409; return res.end('{"ok":false,"error":"folded items are read-only history"}'); }
    if (url.pathname === '/feedback-final-edit') {
      const text = String(payload.text ?? '').trim();
      if (!text) { res.statusCode = 400; return res.end('{"ok":false,"error":"empty text"}'); }
      item.text = text;
    } else {
      if (item.image) {
        const imgPath = path.join(workdir, item.image);
        if (imgPath.startsWith(path.join(workdir, 'feedback-images'))) fs.rmSync(imgPath, { force: true });
      }
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
    // Optional screenshot attachment (data URL): saved beside feedback.json so
    // the fixing session can Read the image directly (gitignored — media).
    const savedImage = saveFeedbackImage(workdir, key, payload.image);
    if (savedImage) fb.items[key].image = savedImage;
    fb.updated = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(fbPath, JSON.stringify(fb, null, 2));
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: true, key, item: fb.items[key] }));
  }

  if (req.method === 'GET' && (url.pathname === '/app' || url.pathname.startsWith('/app/'))) {
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
  const rel = pathname === '/app' || pathname === '/app/' ? 'index.html'
    : decodeURIComponent(pathname.slice('/app/'.length));
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
  for (const name of BOOT_FILES) {
    if (!fs.existsSync(path.join(workdir, name))) {
      throw new Error(`workdir missing ${name}: ${path.join(workdir, name)}`);
    }
  }

  ensureSlices(workdir);

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
export function latestWorkdir(videosDir = path.join(path.resolve(import.meta.dirname, '..'), 'videos')) {
  if (!fs.existsSync(videosDir)) return null;
  const dirs = fs
    .readdirSync(videosDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(videosDir, d.name, 'cues.json')))
    .map((d) => {
      const dir = path.join(videosDir, d.name);
      return {
        name: d.name,
        dir,
        mtime: fs.statSync(path.join(dir, 'cues.json')).mtimeMs,
        missing: BOOT_FILES.filter((f) => !fs.existsSync(path.join(dir, f))),
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
          console.error(`port ${p} in use — trying ${p + 1}`);
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
