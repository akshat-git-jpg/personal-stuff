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
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveCues, normWord } from './resolve.mjs';
import { lintCues } from './lint-cues.mjs';
import { mmss } from './render.mjs';
import { enrichLogos } from './logos-inline.mjs';
import { resolveShots } from './resolve-shots.mjs';
import { resolveWorkdir } from './workdir.mjs';
import { planCaptions } from './captions.mjs';

const REQUIRED_FILES = ['cues.json', 'resolved.json', 'vo.mp3'];

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
  function __measureOverflow() {
    const W = 1920, H = 1080, TOL = 2;
    const offenders = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > W + TOL || r.bottom > H + TOL || r.left < -TOL || r.top < -TOL) {
        offenders.push((el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : '')));
        if (offenders.length >= 5) break;
      }
    }
    const doc = document.documentElement;
    const scrolled = doc.scrollWidth > W + TOL || doc.scrollHeight > H + TOL;
    return { broken: offenders.length > 0 || scrolled, offenders };
  }
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

const BOARD_CSS = `
  :root { --bg:#0f0b07; --panel:#181210; --line:rgba(255,255,255,0.10);
    --text:#f5ede2; --dim:rgba(245,237,226,0.55); --accent:#fb923c; --accent-light:#fdba74; --ok:#34d399; --err:#ff6b6b; --shot:#a78bfa; --overlay-seg:#38bdf8;
    --font:"Inter",-apple-system,system-ui,sans-serif; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:var(--font); background:var(--bg); color:var(--text); padding:28px 32px 80px; }
  .sticky-header { position:sticky; top:0; background:var(--bg); z-index:100; margin:-28px -32px 20px -32px; padding:28px 32px 16px 32px; border-bottom:1px solid var(--line); }
  .topbar { display:flex; align-items:center; gap:20px; margin-bottom:16px; font-size:14px; color:var(--dim); }
  .topbar strong { color:var(--text); }
  .view-toggle { display:flex; gap:2px; border:1px solid var(--line); border-radius:8px; padding:2px; }
  .view-toggle a { padding:5px 12px; border-radius:6px; font-size:13px; font-weight:600; text-decoration:none; color:var(--dim); }
  .view-toggle a.active { color:var(--accent); background:rgba(251,146,60,0.12); }
  .topbar button { font:inherit; font-weight:700; border-radius:9px; padding:9px 16px; cursor:pointer;
    border:1px solid var(--line); background:var(--panel); color:var(--text); }
  #approveBtn { border-color:var(--ok); color:var(--ok); }
  #saveBtn { border-color:var(--accent); color:var(--accent); }
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
  #fxStage.fx-drift .frame { transform:scale(1.04); transition:transform 3s linear; }
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
function fxDriftActive(t, instances, ctx) {
  return ctx === 'screen' && instances.some((i) => i.type === 'drift' && i.enabled
    && typeof i.start === 'number' && t >= i.start && t <= i.end);
}
`;
// Node-side bindings for tests:
const fxSim = {};
new Function('exports', FX_SIM_HELPERS
  + '\nexports.fxContext = fxContext; exports.fxEventsAt = fxEventsAt; exports.fxDriftActive = fxDriftActive;')(fxSim);
export const { fxContext, fxEventsAt, fxDriftActive } = fxSim;

// Probe times for the overflow shim: just after each beat reveals, plus just
// before the card ends (catches a final state that never got a mid-beat check).
function computeProbeTimes(beats, duration) {
  const times = (beats ?? []).map((b) => +(b.at + 0.6).toFixed(2)).filter((t) => t >= 0);
  const end = +(duration - 0.1).toFixed(2);
  if (end >= 0) times.push(end);
  return times;
}

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
function buildDetailBlocks(cues, segments, shots, feedbackItems) {
  const fb = (ref) => feedbackItems[ref]?.folded ? '' : escapeHtml(feedbackItems[ref]?.text ?? '');
  const fbBox = (ref, placeholder) => {
    const foldedHtml = feedbackItems[ref]?.folded
      ? `<div class="feedback-folded">✓ folded ${escapeHtml(feedbackItems[ref].folded)} — "${escapeHtml(feedbackItems[ref].text)}"</div>`
      : '';
    return `<textarea class="feedback" data-ref="${escapeHtml(ref)}" placeholder="${escapeHtml(placeholder)}">${fb(ref)}</textarea>${foldedHtml}`;
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

    const header = r
      ? `#${escapeHtml(cue.id)} &middot; ${timecode(r.start)} &rarr; ${timecode(r.start + r.duration)} &middot; ${escapeHtml(cue.card)} &middot; ${r.duration}s &middot; ${escapeHtml(r.placement)}`
      : `#${escapeHtml(cue.id)} &middot; unresolved &middot; ${escapeHtml(cue.card)}`;

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

    html = `<div class="timeline-block tile ${cue.flagged ? 'flagged' : ''}${inShot}" id="${id}" data-id="${escapeHtml(cue.id)}" data-card="${escapeHtml(cue.card)}" data-lead="${cue.lead ?? ''}">
      <div class="tile-header">${header}</div>
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
      const noteHtml = span.note ? ` &mdash; ${escapeHtml(span.note)}` : '';
      const id = `shot-${escapeHtml(span.id)}`;
      const shotHtml = `<div class="timeline-block shot-block" id="${id}">
  <div class="shot-header">🧍 <b>${escapeHtml(span.id)}</b> avatar-full &middot; ${timecode(span.start)} &rarr; ${timecode(span.start + span.duration)} &middot; ${span.duration}s${noteHtml}</div>
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

function renderBoardPage(cuesFile, resolved, words, feedbackItems = {}, shots = null, effects = null) {
  const byId = new Map(resolved.map((r) => [r.id, r]));
  const cues = cuesFile.cues || [];
  const flaggedCount = cues.filter((c) => c.flagged).length;
  const fb = (ref) => feedbackItems[ref]?.folded ? '' : escapeHtml(feedbackItems[ref]?.text ?? '');
  const fbBox = (ref, placeholder) => {
    const foldedHtml = feedbackItems[ref]?.folded
      ? `<div class="feedback-folded">✓ folded ${escapeHtml(feedbackItems[ref].folded)} — "${escapeHtml(feedbackItems[ref].text)}"</div>`
      : '';
    return `<textarea class="feedback" data-ref="${escapeHtml(ref)}" placeholder="${escapeHtml(placeholder)}">${fb(ref)}</textarea>${foldedHtml}`;
  };
  
  const segments = buildSegments(words, resolved);
  const unresolvedSegs = cues.filter(c => !byId.has(c.id)).map(c => ({
    kind: 'cue', cue: c, start: 0, end: 0, words: [], unresolved: true
  }));
  segments.unshift(...unresolvedSegs);
  
  const totalDuration = words.length ? words[words.length - 1].end : 0;

  const fxInstances = effects?.instances ?? [];
  const fxPoint = fxInstances.filter((i) => i.type === 'whip' || i.type === 'beat');
  const fxSpan = fxInstances.filter((i) => i.type === 'drift' && typeof i.start === 'number');
  const fxGlobal = fxInstances.filter((i) => i.type === 'captions' || i.type === 'bubble');
  const capChunks = fxInstances.some((i) => i.type === 'captions' && i.enabled) ? planCaptions(words) : [];
  const fxFullframes = resolved.filter((c) => c.placement === 'fullframe').map((c) => ({ id: c.id, start: c.start, end: c.start + c.duration }));
  const fxShotSpans = (shots?.spans ?? []).map((s) => ({ id: s.id, start: s.start, end: s.start + s.duration }));

  const fxLaneHtml = fxInstances.length ? `
  <div class="lane-row"><span class="lane-label">effects</span>
    <div class="minimap minimap-fx" style="position:relative; background:transparent;">
      \${fxSpan.map((i) => \`<div class="fx-span\${i.enabled ? '' : ' fx-off'}" title="\${escapeHtml(i.id)}" style="left:\${(i.start / totalDuration * 100).toFixed(2)}%; width:\${((i.end - i.start) / totalDuration * 100).toFixed(2)}%"></div>\`).join('')}
      \${fxPoint.map((i) => \`<div class="fx-marker fx-\${escapeHtml(i.type)}\${i.enabled ? '' : ' fx-off'}" title="\${escapeHtml(i.id)}\${i.style ? ' · ' + escapeHtml(i.style) : ''}" style="left:\${(i.at / totalDuration * 100).toFixed(2)}%"></div>\`).join('')}
      <div id="fxPlayhead"></div>
    </div>
  </div>` : '';

  const fxChipsHtml = fxInstances.length ? `<div class="fx-chips">\${fxInstances.map((i) => {
    const when = typeof i.at === 'number' ? ' ' + timecode(i.at) : (typeof i.start === 'number' ? ' ' + timecode(i.start) : '');
    const extra = i.style ? ' ' + escapeHtml(i.style) : '';
    return \`<label class="fx-chip"><input type="checkbox" class="fx-toggle" data-fx-id="\${escapeHtml(i.id)}" \${i.enabled ? 'checked' : ''}/>\${escapeHtml(i.type)}\${when}\${extra}</label>\`;
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
      items.push(`<div class="minimap-seg" title="${timecode(span.start)} &middot; ${escapeHtml(span.id)} &middot; avatar-full" style="flex-grow:${span.duration}; background:var(--shot)" onclick="document.getElementById('shot-${escapeHtml(span.id)}').scrollIntoView({behavior:'smooth'})"></div>`);
      t = span.start + span.duration;
    }
    if (t < totalDuration) {
      items.push(`<div class="minimap-seg" style="flex-grow:${totalDuration - t}; background:var(--line)"></div>`);
    }
    minimapShotsHtml = `<div class="minimap minimap-shots">${items.join('')}</div>`;
  }

  const timelineBlocks = buildDetailBlocks(cues, segments, shots, feedbackItems);
  const timelineHtml = timelineBlocks.map(b => b.html).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Graphics storyboard timeline</title>
<style>${BOARD_CSS}</style>
</head>
<body>
  <div class="sticky-header">
    <div class="topbar">
      <span class="view-toggle"><a href="/">Timeline</a><a href="/list" class="active">List</a></span>
      <div>video: <strong>${escapeHtml(cuesFile.video ?? '')}</strong></div>
      <div>duration: ${timecode(totalDuration)}</div>
      <div>${cues.length} graphics &middot; ${flaggedCount} flagged</div>
      <button id="approveBtn">Approve graphics</button>
      ${shots ? `<span class="usage-chip">engineMode: ${escapeHtml(shots.shotsFile?.engineMode || 'none')}</span><button id="approveShotsBtn">Approve shots</button>` : ''}
      ${effects ? `<button id="approveEffectsBtn">Approve effects</button>` : ''}
      <button id="saveBtn">Save</button>
      <a href="/calibrate" style="color:var(--dim); font-size:13px;">calibrate</a>
    </div>
    <div id="banner">
      ${cuesFile.approved ? '<div class="banner ok"><button class="banner-x" title="dismiss" onclick="this.parentElement.remove()">&times;</button>approved — ready for <code>node lib/render.mjs</code></div>' : ''}
      ${shots && shots.shotsFile?.approved ? '<div class="banner ok"><button class="banner-x" title="dismiss" onclick="this.parentElement.remove()">&times;</button>shot plan approved — ready for the avatar render step</div>' : ''}
      ${effects && effects.approved ? '<div class="banner ok"><button class="banner-x" title="dismiss" onclick="this.parentElement.remove()">&times;</button>effects approved — ready for step 090 assemble</div>' : ''}
      ${shots?.errors?.length ? `<div class="banner err"><button class="banner-x" title="dismiss" onclick="this.parentElement.remove()">&times;</button>shots: ${shots.errors.map(escapeHtml).join('<br>')}</div>` : ''}
    </div>
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
    <div class="lane-legend">
      <span><span class="dot" style="background:var(--accent)"></span>fullframe card</span>
      <span><span class="dot" style="background:var(--overlay-seg)"></span>overlay card</span>
      ${minimapShotsHtml ? '<span><span class="dot" style="background:var(--shot)"></span>full-screen avatar</span>' : ''}
      <span><span class="dot" style="background:var(--line)"></span>screen recording + corner avatar</span>
    </div>
    ${fxChipsHtml}
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
          fxStage.classList.toggle('fx-drift', fxDriftActive(t, FX_DATA.instances, ctx));
          
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
function renderTimelinePage(cuesFile, resolved, words, feedbackItems = {}, shots = null, effects = null) {
  const byId = new Map(resolved.map((r) => [r.id, r]));
  const cues = cuesFile.cues || [];
  const flaggedCount = cues.filter((c) => c.flagged).length;
  const fb = (ref) => feedbackItems[ref]?.folded ? '' : escapeHtml(feedbackItems[ref]?.text ?? '');
  const fbBox = (ref, placeholder) => {
    const foldedHtml = feedbackItems[ref]?.folded
      ? `<div class="feedback-folded">✓ folded ${escapeHtml(feedbackItems[ref].folded)} — "${escapeHtml(feedbackItems[ref].text)}"</div>`
      : '';
    return `<textarea class="feedback" data-ref="${escapeHtml(ref)}" placeholder="${escapeHtml(placeholder)}">${fb(ref)}</textarea>${foldedHtml}`;
  };

  const segments = buildSegments(words, resolved);
  const unresolvedSegs = cues.filter(c => !byId.has(c.id)).map(c => ({
    kind: 'cue', cue: c, start: 0, end: 0, words: [], unresolved: true
  }));
  segments.unshift(...unresolvedSegs);

  const totalDuration = Math.max(0.1, words.length ? words[words.length - 1].end : 0);

  const fxInstances = effects?.instances ?? [];
  const fxPoint = fxInstances.filter((i) => i.type === 'whip' || i.type === 'beat');
  const fxSpan = fxInstances.filter((i) => i.type === 'drift' && typeof i.start === 'number');
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

  const avatarBlocksHtml = (shots?.spans ?? []).map((span) => `<div class="tl-block" data-start="${span.start}" data-dur="${span.duration}"
    data-detail="shot-${escapeHtml(span.id)}" title="${escapeHtml(span.id)}" style="background:var(--shot)">${escapeHtml(span.id)}</div>`).join('');

  const fxMarksHtml = fxPoint.map((i) => `<div class="tl-mark${i.enabled ? '' : ' fx-off'}" data-start="${i.at}"
    title="${escapeHtml(i.id)}${i.style ? ' · ' + escapeHtml(i.style) : ''}" style="background:var(${i.type === 'whip' ? '--accent' : '--ok'})"></div>`).join('');
  const fxSpansHtml = fxSpan.map((i) => `<div class="tl-span${i.enabled ? '' : ' fx-off'}" data-start="${i.start}" data-dur="${i.end - i.start}"
    title="${escapeHtml(i.id)}"></div>`).join('');
  const fxChipsHtml = fxGlobal.length ? `<div class="tl-fx-chips">${fxGlobal.map((i) =>
    `<span class="tl-chip${i.enabled ? '' : ' fx-off'}">${escapeHtml(i.type)}</span>`).join('')}</div>` : '';

  const detailBlocks = buildDetailBlocks(cues, segments, shots, feedbackItems);
  const storeHtml = detailBlocks.map((b) =>
    `<div class="detail-item" id="detail-${b.id}">${b.html.replace('<iframe loading="lazy" src=', '<iframe loading="lazy" data-src=')}</div>`
  ).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Graphics storyboard timeline</title>
<style>${BOARD_CSS}${TIMELINE_CSS}</style>
</head>
<body>
  <div class="sticky-header">
    <div class="topbar">
      <span class="view-toggle"><a href="/" class="active">Timeline</a><a href="/list">List</a></span>
      <div>video: <strong>${escapeHtml(cuesFile.video ?? '')}</strong></div>
      <div>duration: ${timecode(totalDuration)}</div>
      <div>${cues.length} graphics &middot; ${flaggedCount} flagged</div>
      <button id="approveBtn">Approve graphics</button>
      ${shots ? `<span class="usage-chip">engineMode: ${escapeHtml(shots.shotsFile?.engineMode || 'none')}</span><button id="approveShotsBtn">Approve shots</button>` : ''}
      ${effects ? `<button id="approveEffectsBtn">Approve effects</button>` : ''}
      <button id="saveBtn">Save</button>
      <a href="/calibrate" style="color:var(--dim); font-size:13px;">calibrate</a>
    </div>
    <div id="banner">
      ${cuesFile.approved ? '<div class="banner ok"><button class="banner-x" title="dismiss" onclick="this.parentElement.remove()">&times;</button>approved — ready for <code>node lib/render.mjs</code></div>' : ''}
      ${shots && shots.shotsFile?.approved ? '<div class="banner ok"><button class="banner-x" title="dismiss" onclick="this.parentElement.remove()">&times;</button>shot plan approved — ready for the avatar render step</div>' : ''}
      ${effects && effects.approved ? '<div class="banner ok"><button class="banner-x" title="dismiss" onclick="this.parentElement.remove()">&times;</button>effects approved — ready for step 090 assemble</div>' : ''}
      ${shots?.errors?.length ? `<div class="banner err"><button class="banner-x" title="dismiss" onclick="this.parentElement.remove()">&times;</button>shots: ${shots.errors.map(escapeHtml).join('<br>')}</div>` : ''}
    </div>
    <audio id="master" class="scrub" controls src="/vo.mp3"></audio>
    <div class="tl-zoom-row"><label>zoom <input type="range" id="zoom" min="0.4" max="30" step="0.1" value="1"/></label></div>
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
          <div class="tl-label">EFFECTS</div>
        </div>
        <div class="tl-tracks" id="tlTracks">
          <div class="tl-ruler" id="tlRuler"></div>
          <div class="tl-track" id="tlScreen"><div class="tl-screen-bar"></div></div>
          <div class="tl-track" id="tlGraphics">${graphicsBlocksHtml}</div>
          <div class="tl-track" id="tlAvatar">${avatarBlocksHtml}</div>
          <div class="tl-track" id="tlEffects">${fxChipsHtml}${fxSpansHtml}${fxMarksHtml}</div>
          <div class="tl-playhead" id="tlPlayhead"></div>
        </div>
      </div>
    </div>
    <aside id="detail-panel"><div class="placeholder">click a block to preview</div></aside>
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
    master.addEventListener('play', () => {
      document.querySelectorAll('.tile audio').forEach((a) => { if (!a.paused) a.pause(); });
    });
    master.addEventListener('timeupdate', () => {
      document.getElementById('tlPlayhead').style.left = (master.currentTime * pxps) + 'px';
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
  </script>
</body>
</html>`;
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
  const { feedback, ...incoming } = cuesFile;
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
  const { resolved, errors } = resolveCues(merged.cues ?? [], words, catalog, cardLibraryRoot);

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
      if (!text) { delete items[ref]; continue; }
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

async function handleApprove(req, res, workdir) {
  await readBody(req);
  const cuesPath = path.join(workdir, 'cues.json');
  const cuesFile = JSON.parse(fs.readFileSync(cuesPath, 'utf8'));
  cuesFile.approved = true;
  fs.writeFileSync(cuesPath, JSON.stringify(cuesFile, null, 2));
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ ok: true }));
}

async function handleApproveShots(req, res, workdir) {
  await readBody(req);
  const shotsPath = path.join(workdir, 'shots.json');
  const shotsFile = JSON.parse(fs.readFileSync(shotsPath, 'utf8'));
  shotsFile.approved = true;
  fs.writeFileSync(shotsPath, JSON.stringify(shotsFile, null, 2));
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
  const maxChars = card.max_reveal_chars ?? 20;
  const override = CALIBRATE_OVERRIDES[card.slug] ?? {};

  const variables = {};
  for (const [key, spec] of Object.entries(card.variables ?? {})) {
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
  res.end(injectShim(html, enrichedVars));
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

function loadBoardData(workdir) {
  const cuesFile = JSON.parse(fs.readFileSync(path.join(workdir, 'cues.json'), 'utf8'));
  const { resolved } = JSON.parse(fs.readFileSync(path.join(workdir, 'resolved.json'), 'utf8'));
  const words = JSON.parse(fs.readFileSync(path.join(workdir, 'transcript.json'), 'utf8'));
  const fbPath = path.join(workdir, 'feedback.json');
  const feedbackItems = fs.existsSync(fbPath) ? normalizeFeedbackItems(JSON.parse(fs.readFileSync(fbPath, 'utf8')).items) : {};
  const shots = loadShots(workdir, words);
  const effects = loadEffects(workdir);
  return { cuesFile, resolved, words, feedbackItems, shots, effects };
}

async function handleRequest(req, res, workdir, cardLibraryRoot) {
  const url = new URL(req.url, 'http://localhost');

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

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index')) {
    const { cuesFile, resolved, words, feedbackItems, shots, effects } = loadBoardData(workdir);
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    return res.end(renderTimelinePage(cuesFile, resolved, words, feedbackItems, shots, effects));
  }

  if (req.method === 'GET' && url.pathname === '/list') {
    const { cuesFile, resolved, words, feedbackItems, shots, effects } = loadBoardData(workdir);
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    return res.end(renderBoardPage(cuesFile, resolved, words, feedbackItems, shots, effects));
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

  if (req.method === 'POST' && url.pathname === '/approve-effects') {
    return handleApproveEffects(req, res, workdir);
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

  res.statusCode = 404;
  res.end('not found');
}

export function createServer(workdir) {
  const cardLibraryRoot = path.resolve(import.meta.dirname, '..', '..', 'card-library');
  for (const name of REQUIRED_FILES) {
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
function latestWorkdir() {
  const videosDir = path.join(path.resolve(import.meta.dirname, '..'), 'videos');
  if (!fs.existsSync(videosDir)) return null;
  const candidates = fs.readdirSync(videosDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(videosDir, d.name, 'cues.json')))
    .map((d) => ({ name: d.name, mtime: fs.statSync(path.join(videosDir, d.name, 'cues.json')).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (!candidates.length) return null;
  console.log(`no workdir given — using latest: videos/${candidates[0].name}`);
  return path.join(videosDir, candidates[0].name);
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
