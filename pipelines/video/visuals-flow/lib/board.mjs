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
    --text:#f5ede2; --dim:rgba(245,237,226,0.55); --accent:#fb923c; --accent-light:#fdba74; --ok:#34d399; --err:#ff6b6b;
    --font:"Inter",-apple-system,system-ui,sans-serif; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:var(--font); background:var(--bg); color:var(--text); padding:28px 32px 80px; }
  .sticky-header { position:sticky; top:0; background:var(--bg); z-index:100; margin:-28px -32px 20px -32px; padding:28px 32px 16px 32px; border-bottom:1px solid var(--line); }
  .topbar { display:flex; align-items:center; gap:20px; margin-bottom:16px; font-size:14px; color:var(--dim); }
  .topbar strong { color:var(--text); }
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
  textarea.frag { width:100%; min-height:140px; font-family:ui-monospace,Menlo,monospace; font-size:11px;
    background:#0f0b07; color:var(--text); border:1px solid var(--line); border-radius:6px; padding:8px; }
  textarea.feedback { width:100%; min-height:34px; font:inherit; font-size:12px; margin:8px 0 4px;
    background:rgba(251,146,60,0.05); color:var(--text); border:1px dashed rgba(251,146,60,0.4); border-radius:6px; padding:6px 8px; }
  textarea.feedback:focus { border-style:solid; outline:none; }
  .feedback-folded { font-size:12px; color:var(--dim); margin-bottom:8px; padding:0 8px; }
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

function timecode(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
}

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

function renderBoardPage(cuesFile, resolved, words, feedbackItems = {}) {
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
        colorVar = '--accent-light';
      }
    }
    return `<div class="minimap-seg" title="${title}" style="flex-grow:${duration}; background:var(${colorVar});" onclick="document.getElementById('seg-${i + unresolvedSegs.length}').scrollIntoView({behavior:'smooth'})"></div>`;
  }).join('');

  const timelineHtml = segments.map((seg, idx) => {
    const i = idx;
    if (seg.kind === 'gap') {
      const durSecs = seg.end - seg.start;
      const m = Math.floor(durSecs / 60);
      const s = Math.floor(durSecs % 60);
      const durStr = m > 0 ? `${m}m ${s}s` : `${s}s`;
      const allWords = seg.words.map(w => w.text).join(' ');
      const previewWords = seg.words.slice(0, 14).map(w => w.text).join(' ') + (seg.words.length > 14 ? '…' : '');
      return `<div class="timeline-block gap-block" id="seg-${i}">
        <div class="gap-header" onclick="this.parentElement.classList.toggle('expanded')">
          <span class="gap-icon">▸</span> ${timecode(seg.start)} &rarr; ${timecode(seg.end)} &middot; ${durStr} &middot; <span style="color:var(--dim)">"${escapeHtml(previewWords)}"</span>
        </div>
        <div class="gap-body">${escapeHtml(allWords)}
          ${fbBox(`gap-${timecode(seg.start)}`, 'feedback for this stretch (read by the next Claude session)')}
        </div>
      </div>`;
    }

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

    return `<div class="timeline-block tile ${cue.flagged ? 'flagged' : ''}" id="seg-${i}" data-id="${escapeHtml(cue.id)}" data-card="${escapeHtml(cue.card)}" data-lead="${cue.lead ?? ''}">
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
  }).join('\n');

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
      <div>video: <strong>${escapeHtml(cuesFile.video ?? '')}</strong></div>
      <div>duration: ${timecode(totalDuration)}</div>
      <div>${cues.length} graphics &middot; ${flaggedCount} flagged</div>
      <button id="approveBtn">Approve</button>
      <button id="saveBtn">Save</button>
      <a href="/calibrate" style="color:var(--dim); font-size:13px;">calibrate</a>
    </div>
    <div id="banner">${cuesFile.approved ? '<div class="banner ok"><button class="banner-x" title="dismiss" onclick="this.parentElement.remove()">&times;</button>approved — ready for <code>node lib/render.mjs</code></div>' : ''}</div>
    <div class="usage">${(() => {
      const counts = new Map();
      for (const c of cues) counts.set(c.card, (counts.get(c.card) ?? 0) + 1);
      return [...counts.entries()].sort((a, b) => b[1] - a[1])
        .map(([card, n]) => `<span class="usage-chip${n > 3 ? ' hot' : ''}">${escapeHtml(card.split('/').pop())} &times;${n}</span>`)
        .join('');
    })()}</div>
    <div class="minimap">${minimapHtml}</div>
    ${fbBox('_global', 'overall feedback on this video\'s graphics plan — saved with Save, read by the next Claude session')}
  </div>
  <div class="timeline">${timelineHtml}</div>
  <script>
    ${OVERFLOW_BADGE_JS}
    let FB_DIRTY = false;
    window.addEventListener('beforeunload', (e) => { if (FB_DIRTY) { e.preventDefault(); e.returnValue = ''; } });
    document.addEventListener('input', (e) => { if (e.target.classList && e.target.classList.contains('feedback')) FB_DIRTY = true; });
    const VIDEO = ${JSON.stringify(cuesFile.video ?? '')};
    let APPROVED = ${JSON.stringify(!!cuesFile.approved)};

    document.querySelectorAll('.tile').forEach((tile) => {
      const iframe = tile.querySelector('iframe');
      const audio = tile.querySelector('audio');
      if (!iframe || !audio) return;
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

      wireProbe(tile);
    });

    wireOverflowBadges();

    function showBanner(html, cls) {
      document.getElementById('banner').innerHTML = '<div class="banner ' + cls + '">'
        + '<button class="banner-x" title="dismiss" onclick="this.parentElement.remove()">&times;</button>' + html + '</div>';
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
      const feedback = {};
      document.querySelectorAll('textarea.feedback').forEach((t) => { feedback[t.dataset.ref] = t.value; });
      const res = await fetch('/save', { method: 'POST', body: JSON.stringify({ video: VIDEO, approved: APPROVED, cues, feedback }) });
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

    function escapeForBanner(s) {
      return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    }
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
  if (prev.approved === true && JSON.stringify(canon(prev.cues)) !== JSON.stringify(canon(incoming.cues))) {
    merged.approved = false;
  }

  fs.writeFileSync(cuesPath, JSON.stringify(merged, null, 2));

  const words = JSON.parse(fs.readFileSync(path.join(workdir, 'transcript.json'), 'utf8'));
  const catalog = JSON.parse(fs.readFileSync(path.join(cardLibraryRoot, 'catalog.json'), 'utf8'));
  const { resolved, errors } = resolveCues(merged.cues ?? [], words, catalog, cardLibraryRoot);

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
            const cue = (merged.cues ?? []).find(c => c.id === ref);
            const r = resolved.find(c => c.id === ref);
            if (cue) {
              item.context = { card: cue.card, anchor: cue.anchor };
              if (r) item.context.start = r.start;
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
  
  const { errors: lintErrors, warnings: lintWarnings } = lintCues({ cuesFile: merged, resolved, words, catalog });

  fs.writeFileSync(
    path.join(workdir, 'resolved.json'),
    JSON.stringify({ video: merged.video, offset: merged.offset ?? 0, resolved }, null, 2),
  );
  ensureSlices(workdir);
  res.end(JSON.stringify({ ok: true, errors: lintErrors, warnings: lintWarnings }));
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

function fillerText(chars) {
  if (chars <= 0) return '';
  let s = '';
  while (s.length < chars) s += 'Mmmmmm ';
  return s.slice(0, chars);
}

// e.g. "'pro' | 'con'" -> ['pro', 'con']; null if the descriptor isn't an enum.
function parseEnumOptions(descriptor) {
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
  for (const [key, descriptor] of Object.entries(card.variables ?? {})) {
    if (/\(optional\)/i.test(descriptor)) continue;
    if (/^array/i.test(descriptor)) variables[key] = ['Calibration one', 'Calibration two', 'Calibration three'];
    else if (/^number/i.test(descriptor)) variables[key] = 88;
    else variables[key] = 'Calibration title';
  }

  const beats = [];
  for (let i = 0; i < maxBeats; i++) {
    const beat = { at: +((i + 1) * (card.default_duration / (maxBeats + 1))).toFixed(2) };
    for (const [key, descriptor] of Object.entries(card.beat_shape ?? {})) {
      if (/\(optional\)/i.test(descriptor)) continue;
      const overridden = override.beatField?.(key, i);
      if (overridden !== undefined) { beat[key] = overridden; continue; }
      // values arrays keyed one-per-product ride along whatever "products" synthesized to.
      if (key === 'values' && Array.isArray(variables.products) && /per product/i.test(descriptor)) {
        beat.values = variables.products.map((_, j) => (
          /true\/false/i.test(descriptor) && j % 2 === 0 ? true : fillerText(maxChars)
        ));
        continue;
      }
      const enumOpts = parseEnumOptions(descriptor);
      if (enumOpts) { beat[key] = enumOpts[i % enumOpts.length]; continue; }
      if (/^number/i.test(descriptor)) { beat[key] = 88; continue; }
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

async function handleRequest(req, res, workdir, cardLibraryRoot) {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index')) {
    const cuesFile = JSON.parse(fs.readFileSync(path.join(workdir, 'cues.json'), 'utf8'));
    const { resolved } = JSON.parse(fs.readFileSync(path.join(workdir, 'resolved.json'), 'utf8'));
    const words = JSON.parse(fs.readFileSync(path.join(workdir, 'transcript.json'), 'utf8'));
    const fbPath = path.join(workdir, 'feedback.json');
    const feedbackItems = fs.existsSync(fbPath) ? normalizeFeedbackItems(JSON.parse(fs.readFileSync(fbPath, 'utf8')).items) : {};
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    return res.end(renderBoardPage(cuesFile, resolved, words, feedbackItems));
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
      res.statusCode = 500;
      res.end(String((err && err.stack) || err));
    });
  });
}

function resolveWorkdir(arg) {
  if (arg.includes('/') || fs.existsSync(arg)) return path.resolve(arg);
  const pipelineRoot = path.resolve(import.meta.dirname, '..');
  return path.join(pipelineRoot, 'videos', arg);
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
