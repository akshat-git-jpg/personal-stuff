import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { mmss, planRender } from './render.mjs';
import { resolveCues, extendExposure } from './resolve.mjs';
import { avatarFullSpans } from './lint-cues.mjs';
import { resolveWorkdir } from './workdir.mjs';
import { EFFECT_MODULES } from './effects/registry.mjs';
import { loadVideoManifest } from './video-manifest.mjs';
import { registerVersion } from './versions.mjs';
import { loadConceptSpans } from './concept-spans.mjs';
import { SHOT_CONSTANTS, jobPurpose } from './shot-constants.mjs';
import { readFinalCut } from './final-cut.mjs';
import { introSpan } from './intro-modes.mjs';
import { requireIntroApproved } from './intro-film/approve.mjs';
import { pathToFileURL } from 'node:url';

import * as whipMod from './effects/whip.mjs';
import * as beatsMod from './effects/beats.mjs';
import * as captionsMod from './effects/captions.mjs';
import { planCaptions, assEscape, formatAssText } from './captions.mjs';
import { loadBrand } from './brand-inline.mjs';
import { createHash } from 'node:crypto';

function formatAssTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec % 1) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function jobKey(args) {
  const h = createHash('sha1');
  for (const a of args) {
    h.update(a); h.update(' ');
    if (fs.existsSync(a) && fs.statSync(a).isFile()) {
      const st = fs.statSync(a);
      h.update(`${st.size}:${Math.floor(st.mtimeMs)}`);
    }
  }
  return h.digest('hex');
}

const EPS = 0.05;
export const CANVAS = { w: 1920, h: 1080, fps: 30 };

// How many frames a concat piece gets, given where it ENDS on the master clock
// and how many frames the concat has already committed.
//
// Pieces used to be encoded with `-t <float seconds>`, and ffmpeg emits
// floor(dur * fps) frames from that — so every piece silently dropped its
// sub-frame remainder and the concat lost the sum of all of them. On
// consistent-ai-influencer that came to 1.562s across 104 pieces against a
// 1230.229s master: the video stream ran short while the audio did not, so the
// avatar read ~1.5s out of lip-sync by the last clip, which is what the owner
// reported on 2026-08-07. Only ~0.24s of the loss came from the 25fps HeyGen
// clips; the rest was ordinary graphic and screen segments, so re-rendering the
// avatars at 30fps would not have fixed it.
//
// Measuring against `framePos` re-absorbs the rounding at every boundary rather
// than letting it accumulate, so the concat lands on round(total * fps) frames
// however the segment plan's floats fall. Callers encode with `-frames:v`, not
// `-t`: the count is then what ffmpeg is told, not what it infers from a float.
export function framesUntil(endTime, framePos, fps = CANVAS.fps) {
  return Math.max(1, Math.round(endTime * fps) - framePos);
}

// The source clip's real aspect ratio, probed from the file.
//
// planPanelGeometry/planSideGeometry have accepted `srcAspect` since they were
// written, but NO caller ever passed it, so every composite silently took the
// 16/9 default (found 2026-08-06). A portrait 9:16 HeyGen render was therefore
// stretched 3.16x wide before cropping — and decisions.md 2026-08-03 makes a
// portrait render a FIRST-CLASS avatar source, naming this the blocking
// prerequisite. It stayed unfixed because the integration fixtures are
// solid-colour clips: a blue rectangle stretched 3.16x is still a blue
// rectangle, so no test could see it (the fixture-blindness lesson of
// decisions.md 2026-07-19).
//
// Memoised per file: the overlay loop asks once per segment per overlay, and
// spawning ffprobe for each would add a process per composite.
// Falls back to 16/9 on any probe failure — a missing or unreadable clip must
// not take down an assembly that would otherwise succeed, and 16/9 is what the
// code did before this existed.
const SRC_ASPECT_CACHE = new Map();
export function probeSrcAspect(file, { run = spawnSync, cache = SRC_ASPECT_CACHE } = {}) {
  if (cache.has(file)) return cache.get(file);
  let aspect = 16 / 9;
  try {
    const p = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
      'stream=width,height', '-of', 'csv=p=0:s=x', file], { encoding: 'utf8' });
    const m = /^(\d+)x(\d+)/.exec(String(p.stdout ?? '').trim());
    if (m) {
      const w = Number(m[1]), h = Number(m[2]);
      if (w > 0 && h > 0) aspect = w / h;
    }
  } catch {
    // fall through to the 16/9 default
  }
  cache.set(file, aspect);
  return aspect;
}

// Panel geometry: an inset rounded-rect PIP, bottom-right, preserving the
// source clip's aspect. Dimensions are forced EVEN because yuv420p encoding
// rejects odd width/height.
export function planPanelGeometry({ canvas, constants, srcAspect = 16 / 9 }) {
  const { w: W, h: H } = canvas;
  const inset = constants.PANEL_INSET_PX.value;
  const pw = Math.round((W * constants.PANEL_WIDTH_FRAC.value) / 2) * 2;
  const ph = Math.round(pw / srcAspect / 2) * 2;
  return { w: pw, h: ph, x: W - pw - inset, y: H - ph - inset, radius: constants.PANEL_RADIUS_PX.value };
}

// Side geometry: the host occupies a fixed right-hand column, the motion-graphics
// card the left. The clip is cover-cropped to the column's aspect (scale up, crop
// centre) so the face is never letterboxed or squashed. Dimensions forced EVEN for
// yuv420p. This preserves the prior cover-crop maths with a fixed zone instead of an arbitrary one.
export function planSideGeometry({ canvas, constants, srcAspect = 16 / 9 }) {
  const { w: W, h: H } = canvas;
  const zw = Math.round(constants.SIDE_AVATAR_W.value / 2) * 2;
  const zh = Math.round(H / 2) * 2;
  const zoneAspect = zw / zh;
  // cover: scale so the SHORT side fills, then centre-crop the overflow
  const scaleW = zoneAspect > srcAspect ? zw : Math.round((zh * srcAspect) / 2) * 2;
  const scaleH = zoneAspect > srcAspect ? Math.round((zw / srcAspect) / 2) * 2 : zh;
  return {
    scaleW, scaleH,
    cropW: zw, cropH: zh,
    cropX: Math.round((scaleW - zw) / 2),
    cropY: Math.round((scaleH - zh) / 2),
    x: W - zw,
    y: 0,
    radius: 0,
  };
}

export const ASSEMBLE_MEDIA_ROOT = process.env.ASSEMBLE_MEDIA_ROOT
  ?? path.join(os.homedir(), 'kb-scratch', 'video', 'visuals-flow');

export const TRANSITION_DUR = whipMod.CONSTANTS.TRANSITION_DUR;
export const WHIP_SIGMAS = whipMod.CONSTANTS.WHIP_SIGMAS;
export const WHIP_ZOOM = whipMod.CONSTANTS.WHIP_ZOOM;

export const BEAT_INTERVAL = beatsMod.CONSTANTS.BEAT_INTERVAL;
export const BEAT_MIN_EDGE = beatsMod.CONSTANTS.BEAT_MIN_EDGE;
export const BEAT_SNAP_WINDOW = beatsMod.CONSTANTS.BEAT_SNAP_WINDOW;
export const BEAT_MIN_GAP = beatsMod.CONSTANTS.BEAT_MIN_GAP;
export const FLASH_COLOR = beatsMod.CONSTANTS.FLASH_COLOR;
export const FLASH_OUT_OPACITIES = beatsMod.CONSTANTS.FLASH_OUT_OPACITIES;
export const FLASH_IN_OPACITIES = beatsMod.CONSTANTS.FLASH_IN_OPACITIES;
export const FLASH_BAND_OPACITIES = beatsMod.CONSTANTS.FLASH_BAND_OPACITIES;
export const PUNCH_SCALE = beatsMod.CONSTANTS.PUNCH_SCALE;


export function planSegments({ resolved, avatarJobs, total, filmSpan }) {
  const repl = [];
  if (filmSpan) {
    repl.push({ kind: 'film', id: 'intro-film', start: 0, end: filmSpan.end });
  }
  for (const c of resolved.filter((c) => c.placement === 'fullframe')) {
    if (filmSpan && c.start < filmSpan.end - EPS) continue;
    repl.push({ kind: 'graphic', id: c.id, start: c.start,
      end: Math.min(+(c.start + c.duration).toFixed(3), total) });
  }
  // Base selection must stay full-only — a panel must not replace the base.
  for (const j of avatarJobs.filter((j) => jobPurpose(j) === 'avatar-full')) {
    if (filmSpan && j.start < filmSpan.end - EPS) continue;
    repl.push({ kind: 'avatar', id: j.id, start: j.start,
      end: Math.min(j.end, total) });
  }
  repl.sort((a, b) => a.start - b.start);
  for (let i = 1; i < repl.length; i++) {
    if (repl[i].start < repl[i - 1].end - EPS) {
      throw new Error(`overlapping base segments: ${repl[i - 1].id} ends ${repl[i - 1].end}, ${repl[i].id} starts ${repl[i].start}`);
    }
  }
  const segments = [];
  let t = 0;
  let n = 0;
  for (const r of repl) {
    const start = Math.max(r.start, t);
    if (start > t + EPS) {
      n++;
      segments.push({ kind: 'screen', id: `screen-${String(n).padStart(2, '0')}`, start: t, end: start });
    }
    segments.push({ ...r, start });
    t = Math.max(t, r.end);
  }
  if (total > t + EPS) {
    n++;
    segments.push({ kind: 'screen', id: `screen-${String(n).padStart(2, '0')}`, start: t, end: total });
  }
  return segments;
}

/* The LAST segment is special, whatever the base is.
 *
 * A voiceover stops on its final word, but the master carries a couple of
 * seconds of room tone after it. With base:"screen" that tail is handed back to
 * the screen recording, so the video's closing frame is whatever happened to be
 * on the desktop — on best-no-code-automation-tool that was a raw browser
 * window with the taskbar, the open tabs and an email address legible in one of
 * them. Owner, 2026-08-20: "why the end screen is like this".
 *
 * That is not a taste problem. A video's last frame is the one that sits on the
 * thumbnail rail, gets screenshotted and stays on screen while the viewer
 * decides what to watch next, and unauthored desktop footage there can leak
 * whatever the recording happened to contain. So the tail after the final
 * authored segment always freezes that segment instead — the film ends on the
 * presenter or on a card, held, which is what a sign-off should do anyway.
 */
export function freezeTrailingGap(segments) {
  if (segments.length === 0) return segments;
  const last = segments[segments.length - 1];
  if (last.kind !== 'screen') return segments;
  let from = null;
  for (let j = segments.length - 2; j >= 0; j--) {
    if (segments[j].kind !== 'screen') { from = segments[j].id; break; }
  }
  if (!from) return segments;   // nothing authored to hold; leave it alone
  return [...segments.slice(0, -1), { ...last, kind: 'freeze', from }];
}

export function fillGapsWithFreeze(segments, { base }) {
  if (base !== 'none') return segments;
  const out = [];
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (s.kind === 'screen') {
      let from = null;
      for (let j = i - 1; j >= 0; j--) {
        if (segments[j].kind !== 'screen') { from = segments[j].id; break; }
      }
      if (!from) {
        for (let j = i + 1; j < segments.length; j++) {
          if (segments[j].kind !== 'screen') { from = segments[j].id; break; }
        }
      }
      out.push({ ...s, kind: 'freeze', from });
    } else {
      out.push(s);
    }
  }
  return out;
}

export function planSegmentOverlays(segments, overlays) {
  return segments.map((seg) => {
    const local = [];
    for (const o of overlays) {
      const s = Math.max(o.start, seg.start);
      const e = Math.min(o.end, seg.end);
      if (e - s > 0.01) {
        local.push({
          id: o.id,
          file: o.file,
          ...(o.chroma ? { chroma: o.chroma } : {}),
          ...(o.isPanel ? { isPanel: o.isPanel } : {}),
          ...(o.isSide ? { isSide: o.isSide } : {}),
          trimStart: +Math.max(seg.start - o.start, 0).toFixed(3),
          at: +(s - seg.start).toFixed(3),
          until: +(e - seg.start).toFixed(3),
        });
      }
    }
    return local;
  });
}

// Assembly-level absorption is GLITCH MOP-UP ONLY — it runs after every lint,
// so any decision it makes is invisible to the gates. The resolver owns the
// intentional calls: GAP_ABSORB (4s) extends a card's exposure over short
// gaps, and anything longer is a DELIBERATE return to screen recording that
// assembly must never override. Both caps therefore sit BELOW GAP_ABSORB.
// (Bitten 2026-07-31, final-v4:0: a 6s hold cap silently froze the intro
// title card over its 5.8s screen return — the exact static-screen class the
// owner keeps flagging — and no lint could see it because the absorption
// happened after they all ran.) The head direction additionally clones the
// card's pre-entrance frame (near-black), so it was already glitch-length.
// Longer pre-card slivers are a planning problem: entry_phase cards anchor
// flush to the avatar end, and lint W5/E5 flags what remains. Avatar clips
// are fixed-length renders, so avatar absorption stays a brief 1s freeze.
export const SLIVER_GRAPHIC_HOLD = 2.5;
export const SLIVER_GRAPHIC_HEAD = 2.5;
export const SLIVER_GRAPHIC = SLIVER_GRAPHIC_HOLD; // max reach, for lint mirrors
export const SLIVER_AVATAR = 1.0;

export function absorbSlivers(segments, { graphicHoldMax = SLIVER_GRAPHIC_HOLD, graphicHeadMax = SLIVER_GRAPHIC_HEAD, avatarMax = SLIVER_AVATAR } = {}) {
  const currentSegments = JSON.parse(JSON.stringify(segments));
  let changed = true;
  while (changed) {
    changed = false;
    for (let j = 0; j < currentSegments.length; j++) {
      const seg = currentSegments[j];
      if (seg.kind !== 'screen') continue;
      const dur = +(seg.end - seg.start).toFixed(3);
      const prev = j > 0 ? currentSegments[j - 1] : null;
      const next = j < currentSegments.length - 1 ? currentSegments[j + 1] : null;
      
      let absorbed = false;
      if (dur <= graphicHoldMax && prev && prev.kind === 'graphic') {
        prev.end = seg.end;
        prev.padEnd = +( (prev.padEnd || 0) + dur ).toFixed(3);
        absorbed = true;
      } else if (dur <= graphicHeadMax && next && next.kind === 'graphic') {
        next.start = seg.start;
        next.padStart = +( (next.padStart || 0) + dur ).toFixed(3);
        absorbed = true;
      }
      if (!absorbed && dur <= avatarMax) {
        if (prev && prev.kind === 'avatar') {
          prev.end = seg.end;
          prev.padEnd = +( (prev.padEnd || 0) + dur ).toFixed(3);
          absorbed = true;
        } else if (next && next.kind === 'avatar') {
          next.start = seg.start;
          next.padStart = +( (next.padStart || 0) + dur ).toFixed(3);
          absorbed = true;
        }
      }
      
      if (absorbed) {
        currentSegments.splice(j, 1);
        changed = true;
        break;
      }
    }
  }
  return currentSegments;
}

export const planTransitions = (segments, overlays, opts = {}) => {
  return whipMod.plan({ segments, overlays }).map(t => ({
    at: t.at,
    direction: t.direction,
    fromIdx: t.fromIdx,
    toIdx: t.toIdx
  }));
};

export const planAvatarBeats = (seg, words, opts = {}) => {
  const cueTimes = opts.cueTimes || [];
  const dummyResolved = cueTimes.map(t => ({ placement: 'overlay', start: t }));
  const instances = beatsMod.plan({ segments: [{ ...seg, kind: 'avatar' }], words, resolved: dummyResolved });
  return instances.map(i => i.at);
};

export const splitAvatarSegments = (segments, words, opts = {}) => {
  const cueTimes = opts.cueTimes || [];
  const dummyResolved = cueTimes.map(t => ({ placement: 'overlay', start: t }));
  const instances = beatsMod.plan({ segments, words, resolved: dummyResolved });
  return beatsMod.transformSegments(segments, instances, { words, resolved: dummyResolved });
};

export function encoderArgs({ encoder, draft }) {
  if (encoder === 'videotoolbox') {
    return ['-c:v', 'h264_videotoolbox', '-b:v', draft ? '4M' : '12M', '-pix_fmt', 'yuv420p'];
  }
  return draft
    ? ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28']
    : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18'];
}

export function detectEncoder() {
  const res = spawnSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8' });
  return (res.stdout || '').includes('h264_videotoolbox') ? 'videotoolbox' : 'x264';
}

export function assemblyMd(video, segments, overlays, total, outPath, transitions = [], captions = 'on', audioSource = 'vo.mp3') {
  const getSegId = (s) => s.sub !== undefined ? `${s.id}.${s.sub + 1}` : s.id;
  // Register whips (style:"register") mark a dark<->light change, not a segment
  // boundary, so they legitimately carry no fromIdx/toIdx. This threw on
  // segments[undefined] the first time they actually reached assembly
  // (2026-07-25 — they had always been dropped upstream before then).
  const segIdAt = (i) => (i === undefined || !segments[i]) ? 'n/a' : getSegId(segments[i]);
  const seg = segments.map((s) =>
    `| ${mmss(s.start)} | ${mmss(s.end)} | ${s.kind} | ${getSegId(s)} |`);
  const ov = overlays.map((o) =>
    `| ${mmss(o.start)} | ${mmss(o.end)} | ${path.basename(o.file)} |`);
  const transSentence = transitions.length > 0
    ? 'Whip transitions at the listed boundaries; hard cuts elsewhere.'
    : 'Hard cuts.';

  const capSentence = captions === 'on' ? ' Captions burned on screen segments.' : '';

  const lines = [
    `# ${video} — assembly`,
    '',
    `Master timeline = voiceover (${total.toFixed(1)}s starts at 00:00.0; any editor-timeline offset is NOT applied here). Audio: ${audioSource} throughout — screen and avatar audio muted. ${transSentence}${capSentence} Effects/sound are Final-Cut-reviewed.`,
    '',
    `Output: ${outPath}`,
    '',
    '## Base track',
    '',
    '| from | to | source | id |',
    '|---|---|---|---|',
    ...seg,
    '',
    '## Overlays (composited on top)',
    '',
    '| at | until | file |',
    '|---|---|---|',
    ...ov,
    ''
  ];

  if (transitions.length > 0) {
    const tr = transitions.map((t) =>
      `| ${mmss(t.at)} | ${t.direction} | ${segIdAt(t.fromIdx)} | ${segIdAt(t.toIdx)} |`);
    lines.push(
      '## Transitions',
      '',
      '| at | direction | from | to |',
      '|---|---|---|---|',
      ...tr,
      ''
    );
  }

  return lines.join('\n');
}

function parseArgs(argv) {
  const opts = { workdir: null, screen: null, screenOffset: 0, out: null, draft: false, encoder: null, keepTemp: false, force: false, transitions: 'whip', beats: 'on', captions: 'on', effects: 'on', bubble: 'off', jobs: 3, noCache: false, bare: false };
  const rest = [...argv];
  opts.workdir = rest.shift();
  while (rest.length) {
    const a = rest.shift();
    if (a === '--screen') opts.screen = rest.shift();
    else if (a === '--screen-offset') opts.screenOffset = parseFloat(rest.shift());
    else if (a === '--out') opts.out = rest.shift();
    else if (a === '--draft') opts.draft = true;
    else if (a === '--encoder') {
      const e = rest.shift();
      if (e !== 'x264' && e !== 'videotoolbox') throw new Error('--encoder must be x264 or videotoolbox');
      opts.encoder = e;
    }
    else if (a === '--transitions') {
      const t = rest.shift();
      if (t !== 'whip' && t !== 'none') throw new Error('--transitions must be whip or none');
      opts.transitions = t;
    }
    else if (a === '--beats') {
      const b = rest.shift();
      if (b !== 'on' && b !== 'off') throw new Error('--beats must be on or off');
      opts.beats = b;
    }
    else if (a === '--captions') {
      const c = rest.shift();
      if (c !== 'on' && c !== 'off') throw new Error('--captions must be on or off');
      opts.captions = c;
    }
    else if (a === '--effects') {
      const e = rest.shift();
      if (e !== 'on' && e !== 'off') throw new Error('--effects must be on or off');
      opts.effects = e;
    }
    else if (a === '--bubble') {
      const b = rest.shift();
      if (b !== 'on' && b !== 'off') throw new Error('--bubble must be on or off');
      opts.bubble = b;
    }
    else if (a === '--keep-temp') opts.keepTemp = true;
    else if (a === '--force') opts.force = true;
    else if (a === '--jobs') opts.jobs = parseInt(rest.shift(), 10);
    else if (a === '--no-cache') opts.noCache = true;
    else if (a === '--bare') opts.bare = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  if (opts.bare) {
    const hasCapOn = argv.findIndex(x => x === '--captions') >= 0 && argv[argv.findIndex(x => x === '--captions')+1] === 'on';
    const hasTransWhip = argv.findIndex(x => x === '--transitions') >= 0 && argv[argv.findIndex(x => x === '--transitions')+1] === 'whip';
    if (hasCapOn || hasTransWhip) throw new Error('--bare cannot be combined with explicit --captions on or --transitions whip');
    opts.captions = 'off';
    opts.transitions = 'none';
  }
  return opts;
}

export async function runAssembly({ workdir, video = 'it', resolved, avatarJobs = [], panelJobs = [], sideJobs = [], cornerJobs = [], total, screen, screenOffset = 0, out, draft = false, encoder = detectEncoder(), keepTemp = false, transitions = 'whip', beats = 'on', captions = 'on', effects = 'on', bubble = 'off', words = [], jobsN = 3, noCache = false, overlayComposite = true, segmentsOutDir = null, brand = { caption: {} }, catalog, filmSpan }) {
  const videoManifest = loadVideoManifest(workdir);
  let segments = planSegments({ resolved, avatarJobs, total, filmSpan });
  segments = absorbSlivers(segments);
  segments = fillGapsWithFreeze(segments, { base: videoManifest.base });
  // Always, not only for base:'none' — see freezeTrailingGap.
  segments = freezeTrailingGap(segments);

  const renderDir = path.join(workdir, 'renders');
  const overlays = resolved.filter(c => c.placement === 'overlay').map(c => {
    return { id: c.id, start: c.start, end: c.start + c.duration, file: path.join(renderDir, planRender(c).outFile), ...(c.chroma ? { chroma: c.chroma } : {}) };
  });

  const panelOverlays = panelJobs.map(j => ({
    id: j.id, start: j.start, end: j.end, file: j.file, isPanel: true
  }));
  const sideOverlays = sideJobs.map(j => ({
    id: j.id, start: j.start, end: j.end, file: j.file, isSide: true
  }));
  overlays.push(...panelOverlays, ...sideOverlays);

  const tmpDir = path.join(workdir, 'assembly-tmp');
  fs.mkdirSync(tmpDir, { recursive: true });

  const cacheDir = path.join(workdir, 'assembly-cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  const now = Date.now();
  if (fs.existsSync(cacheDir)) {
    for (const f of fs.readdirSync(cacheDir)) {
      if (f.endsWith('.ts')) {
        const p = path.join(cacheDir, f);
        if (now - fs.statSync(p).mtimeMs > 14 * 24 * 60 * 60 * 1000) fs.rmSync(p);
      }
    }
  }

  const { w, h } = draft ? { w: 1280, h: 720 } : { w: CANVAS.w, h: CANVAS.h };
  const VF = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p`;
  const ENC = encoderArgs({ encoder, draft });

  const effectFlags = {
    whip: transitions !== 'none',
    beat: beats === 'on',
    captions: captions === 'on',
    bubble: bubble === 'on'
  };

  const manifestPath = path.join(workdir, 'effects.json');
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { instances: [] };

  const defaultInstances = [];
  const enabledInstances = [];
  
  // conceptSpans must match what effects-plan.mjs used, or the whip-reg
  // transitions it wrote into effects.json look "unknown" here and get dropped.
  const conceptSpans = loadConceptSpans(workdir, words);

  let ctx = { segments, overlays, words, resolved, avatarJobs, cornerJobs, total, w, h, VF, screen, conceptSpans, workdir };
  
  for (const mod of EFFECT_MODULES) {
    if (mod.plan) {
      const modInstances = mod.plan(ctx);
      defaultInstances.push(...modInstances);
      
      for (const inst of modInstances) {
        const isEnabled = effectFlags[inst.type] !== false && effects !== 'off';
        const override = manifest.instances.find(m => m.id === inst.id);
        if (override) {
          if (isEnabled && override.enabled !== false) {
            enabledInstances.push({ ...inst, ...override, enabled: true });
          }
        } else if (isEnabled) {
          enabledInstances.push(inst);
        }
      }
    }
    
    if (mod.transformSegments) {
      const modEnabledInsts = enabledInstances.filter(i => i.type === mod.TYPE);
      segments = mod.transformSegments(segments, modEnabledInsts, ctx);
      ctx.segments = segments;
    }
  }

  if (manifest.instances && effects !== 'off') {
    for (const m of manifest.instances) {
      if (!defaultInstances.some(inst => inst.id === m.id)) {
        console.warn(`warning: ignoring effects.json instance with unknown id: ${m.id}`);
      }
    }
  }

  const segOverlays = planSegmentOverlays(segments, overlayComposite ? overlays : []);
  
  let capDir = null;
  let capChunks = [];
  const capInstances = enabledInstances.filter(i => i.type === 'captions');
  if (capInstances.length > 0) {
    const inst = capInstances[0];
    capChunks = planCaptions(words);
    const screenChunks = capChunks.filter(c => 
      segments.some(seg => seg.kind === 'screen' && c.start < seg.end && c.end > seg.start)
    );
    if (screenChunks.length > 0) {
      capDir = path.join(tmpDir, 'captions');
      fs.mkdirSync(capDir, { recursive: true });
      const capWidth = Math.round(w * 0.86);
      const capFontPx = Math.round((inst.fontPx || captionsMod.CONSTANTS.CAP_FONT_PX) * h / 1080);
      
      const outline = Math.max(2, Math.floor(capFontPx / 16));
      const marginV = h - Math.round(h * (inst.yFrac !== undefined ? inst.yFrac : captionsMod.CONSTANTS.CAP_Y_FRAC));
      const whipInstancesTmp = enabledInstances.filter(i => i.type === 'whip');
      
      for (const seg of segments) {
        if (seg.kind !== 'screen') continue;
        const tIn = whipInstancesTmp.find(t => Math.abs(t.at - seg.start) < 0.01);
        const startTrim = tIn ? TRANSITION_DUR / 2 : 0;
        
        let assBody = '';
        for (const c of capChunks) {
          const cAt = c.start - seg.start - startTrim;
          const cUntil = c.end - seg.start - startTrim;
          if (cUntil > 0 && cAt < (seg.end - seg.start)) {
            const startStr = formatAssTime(Math.max(0, cAt));
            const endStr = formatAssTime(cUntil);
            const textASS = formatAssText(c.words, brand?.caption?.keywordColor);
            assBody += `Dialogue: 0,${startStr},${endStr},Cap,,0,0,0,,${textASS}\n`;
          }
        }
        
        if (assBody) {
          const assHead = `[Script Info]
ScriptType: v4.00+
PlayResX: ${w}
PlayResY: ${h}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Helvetica,${capFontPx},&H00FFFFFF,&H00000000,&H00000000,1,${outline},0,2,40,40,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
          fs.writeFileSync(path.join(capDir, `seg-${seg.id}.ass`), assHead + assBody);
        }
      }
    }
  }

  const whipInstances = enabledInstances.filter(i => i.type === 'whip');
  
  const concatLines = [];
  const timelineClips = [];
  let segIndex = 1;
  const jobs = [];

  // Frames already committed to the concat. Every piece's length is measured
  // against this counter rather than computed on its own, so the sub-frame
  // remainder is CARRIED instead of discarded — see the note at the `segFrames`
  // computation below for the incident this fixes.
  let framePos = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const L = segOverlays[i];
    const segFileStr = `seg-${String(segIndex).padStart(3, '0')}-${seg.id}.ts`;
    const segFile = path.join(tmpDir, segFileStr);
    concatLines.push(`file '${segFileStr}'`);
    segIndex++;

    let startTrim = 0;
    let endTrim = 0;

    // Placeholder-avatar segments (review drafts assembled before HeyGen
    // finishes, owner ask 2026-07-31): a still image stands in for the clip.
    // Transitions at a placeholder boundary are skipped — the whip machinery
    // slices the avatar FILE, which a placeholder job does not have; a hard
    // cut is fine for a review draft.
    const segAvatarJob = seg.kind === 'avatar' ? avatarJobs.find(j => j.id === seg.id) : null;
    const nextBaseSeg = segments[i + 1];
    const nextAvatarJob = nextBaseSeg?.kind === 'avatar' ? avatarJobs.find(j => j.id === nextBaseSeg.id) : null;
    const prevBaseSeg = segments[i - 1];
    const prevAvatarJob = prevBaseSeg?.kind === 'avatar' ? avatarJobs.find(j => j.id === prevBaseSeg.id) : null;

    const tOut = (segAvatarJob?.placeholder || nextAvatarJob?.placeholder)
      ? undefined
      : whipInstances.find(t => Math.abs(t.at - seg.end) < 0.01);
    const tIn = (segAvatarJob?.placeholder || prevAvatarJob?.placeholder)
      ? undefined
      : whipInstances.find(t => Math.abs(t.at - seg.start) < 0.01);

    if (tOut) endTrim = TRANSITION_DUR / 2;
    if (tIn) startTrim = TRANSITION_DUR / 2;

    // Frame-exact piece length, with the sub-frame remainder CARRIED — see
    // framesUntil for why this is not simply (end - start).
    const segFrames = framesUntil(seg.end - endTrim, framePos);
    framePos += segFrames;
    const dur = segFrames / CANVAS.fps;
    let src = '';
    let seekArgs = [];

    const pStart = seg.padStart || 0;
    const actualPadStart = Math.max(0, pStart - startTrim);
    if (seg.kind === 'screen') {
      seekArgs = ['-ss', String(seg.start + screenOffset + startTrim), '-to', String(seg.end + screenOffset - endTrim)];
      src = screen;
    } else if (seg.kind === 'freeze') {
      const cue = resolved.find(c => c.id === seg.from);
      if (cue) src = path.join(renderDir, planRender(cue).outFile);
      else {
        const job = avatarJobs.find(j => j.id === seg.from);
        if (job) src = job.file;
      }
      const fromIdx = segments.findIndex(s => s.id === seg.from);
      const isHead = fromIdx > i;
      if (isHead) {
        // Read only the first sliver of the source and let the existing
        // `tpad=stop_mode=clone` hold that frame for the rest of the segment —
        // the mirror image of the tail case below. `-frames:v 1` was used here
        // and is an OUTPUT option: spliced before `-i` ffmpeg rejects it with
        // "Option frames:v cannot be applied to input url". Latent on
        // base:"screen" (no freezes); base:"none" fills gaps with freezes and
        // exposed it (found 2026-07-29). `-ss`/`-t` are genuine input options,
        // so this works in both the filter_complex and the plain -vf branch.
        seekArgs = ['-ss', '0', '-t', '0.05'];
      } else {
        seekArgs = ['-sseof', '-0.05'];
      }
    } else if (seg.kind === 'avatar') {
      const job = avatarJobs.find(j => j.id === seg.id);
      if (job.placeholder) {
        // Loop the reference still for the span; the master VO keeps playing
        // underneath, so pacing review works before HeyGen delivers.
        src = job.placeholderFile;
        seekArgs = ['-loop', '1', '-framerate', String(CANVAS.fps), '-t', String(dur + 2)];
      } else {
        src = job.file;
        const contentStartTrim = Math.max(0, startTrim - pStart);
        seekArgs = ['-ss', String(seg.start + pStart - job.start + contentStartTrim)];
      }
    } else if (seg.kind === 'graphic') {
      const cue = resolved.find(c => c.id === seg.id);
      src = path.join(renderDir, planRender(cue).outFile);
    } else if (seg.kind === 'film') {
      src = path.join(workdir, 'intro-film', 'out', 'intro.mp4');
      const contentStartTrim = Math.max(0, startTrim - pStart);
      seekArgs = ['-ss', String(contentStartTrim)];
    }
    
    let punchVF = VF;
    // A side-mode card is rendered NARROWER than the canvas on purpose: it owns
    // the left 1200 of 1920 and the host takes the right 720. The shared VF
    // centre-pads every segment, so that card lands 360px right of where it
    // belongs (240 at draft scale) — its last column sits UNDER the host and a
    // black bar opens on the left. Worse, it is silent: the frame looks
    // deliberately letterboxed rather than misplaced, and the column that goes
    // missing is the one carrying the verdict. Left-align the pad for any
    // graphic whose render is narrower than the canvas. Aspect is the honest
    // signal here — rendering narrow IS the renderer's side contract, so this
    // reads the same fact rather than re-deriving it from the span table and
    // risking the two disagreeing.
    if (seg.kind === 'graphic') {
      const srcAspect = probeSrcAspect(src);
      if (Number.isFinite(srcAspect) && srcAspect < (CANVAS.w / CANVAS.h) - 0.01) {
        punchVF = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:0:(oh-ih)/2,fps=30,format=yuv420p`;
      }
    }
    // Placeholder spans are visually marked so a reviewer never mistakes the
    // still for the final look: slight dim + a labelled band along the bottom.
    if (segAvatarJob?.placeholder) {
      punchVF += ",eq=brightness=-0.05" +
        ",drawbox=x=0:y=ih-70:w=iw:h=70:color=black@0.55:t=fill" +
        ",drawtext=fontfile=/System/Library/Fonts/Helvetica.ttc:text='AVATAR PLACEHOLDER - clip rendering on HeyGen':fontcolor=white@0.9:fontsize=30:x=28:y=h-48";
    }
    const contribCtx = { ...ctx, dur, startTrim, endTrim, capDir, capChunks };
    let finalVFSuffix = '';
    let inputs = [];
    let fragments = [];
    
    for (const mod of EFFECT_MODULES) {
      if (mod.contribute) {
        const insts = enabledInstances.filter(inst => inst.type === mod.TYPE);
        if (insts.length > 0) {
          const contrib = mod.contribute(seg, insts, contribCtx);
          if (contrib) {
            if (contrib.vfSuffix) finalVFSuffix += contrib.vfSuffix;
            if (contrib.inputs) {
              const offset = inputs.length;
              inputs.push(...contrib.inputs);
              const numInputs = contrib.inputs.filter(x => x === '-i').length;
              if (contrib.chainFragments) {
                for (const frag of contrib.chainFragments) {
                  fragments.push({ frag, offset, numInputs });
                }
              }
            } else if (contrib.chainFragments) {
              for (const frag of contrib.chainFragments) {
                fragments.push({ frag, offset: 0, numInputs: 0 });
              }
            }
          }
        }
      }
    }
    
    punchVF += finalVFSuffix;
    
    let needsComplex = false;
    if (L && L.length > 0) needsComplex = true;
    if (fragments.length > 0) needsComplex = true;

    let spawnArgs = [];

    if (needsComplex) {
      const padStartFilter = actualPadStart > 0 ? `,tpad=start_mode=clone:start_duration=${actualPadStart}` : '';
      let chain = `[0:v]${punchVF}${padStartFilter},tpad=stop_mode=clone:stop_duration=30[b0];`;
      let lastV = 'b0';
      
      let allInputs = [];
      let globalInputIdx = 1;

      if (L && L.length > 0) {
        for (const o of L) allInputs.push('-i', o.file);
        for (let j = 0; j < L.length; j++) {
          const o = L[j];
          const oj = `o${j}`;
          const nextV = `b${j + 1}`;
          const adjustedAt = +(o.at - startTrim).toFixed(3);
          const adjustedUntil = +(o.until - startTrim).toFixed(3);
          // Panel/side geometry is defined in full-res (1920x1080) pixels, but a
          // --draft segment renders at 1280x720 — scale every coordinate to the
          // ACTUAL canvas or the composite lands off-frame (found 2026-07-31,
          // side mode's first draft: overlay x=1200 on a 1280-wide canvas left
          // an 80px sliver of host at the right edge). Even-rounded for yuv420.
          const gsx = w / CANVAS.w, gsy = h / CANVAS.h;
          const even = (v) => Math.round(v / 2) * 2;
          if (o.isPanel) {
            const gf = planPanelGeometry({ canvas: CANVAS, constants: SHOT_CONSTANTS, srcAspect: probeSrcAspect(o.file) });
            const g = { w: even(gf.w * gsx), h: even(gf.h * gsy), x: Math.round(gf.x * gsx), y: Math.round(gf.y * gsy), radius: gf.radius * gsx };
            const r = g.radius;
            chain += `[${globalInputIdx}:v]trim=start=${o.trimStart},setpts=PTS-STARTPTS+${adjustedAt}/TB,scale=${g.w}:${g.h},format=yuva444p,` +
              `geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':` +
              `a='if(lt(hypot(max(abs(X-W/2)-(W/2-${r}),0),max(abs(Y-H/2)-(H/2-${r}),0)),${r + 0.5}),255,0)'[${oj}];`;
            chain += `[${lastV}][${oj}]overlay=x=${g.x}:y=${g.y}:eof_action=pass:enable='between(t,${adjustedAt},${adjustedUntil})'[${nextV}];`;
          } else if (o.isSide) {
            const gf = planSideGeometry({ canvas: CANVAS, constants: SHOT_CONSTANTS, srcAspect: probeSrcAspect(o.file) });
            const g = {
              scaleW: even(gf.scaleW * gsx), scaleH: even(gf.scaleH * gsy),
              cropW: even(gf.cropW * gsx), cropH: even(gf.cropH * gsy),
              cropX: Math.round(gf.cropX * gsx), cropY: Math.round(gf.cropY * gsy),
              x: Math.round(gf.x * gsx), y: Math.round(gf.y * gsy),
            };
            chain += `[${globalInputIdx}:v]trim=start=${o.trimStart},setpts=PTS-STARTPTS+${adjustedAt}/TB,scale=${g.scaleW}:${g.scaleH},crop=${g.cropW}:${g.cropH}:${g.cropX}:${g.cropY}[${oj}];`;
            chain += `[${lastV}][${oj}]overlay=x=${g.x}:y=${g.y}:eof_action=pass:enable='between(t,${adjustedAt},${adjustedUntil})'[${nextV}];`;
          } else {
            // Chroma cards carry no alpha of their own — key the plate out first,
            // otherwise the overlay lands as a solid colour block (owner v2:5).
            const keyFilter = o.chroma ? `,colorkey=${o.chroma}:0.30:0.10` : '';
            chain += `[${globalInputIdx}:v]trim=start=${o.trimStart},setpts=PTS-STARTPTS+${adjustedAt}/TB,scale=${w}:${h}${keyFilter}[${oj}];`;
            chain += `[${lastV}][${oj}]overlay=eof_action=pass:enable='between(t,${adjustedAt},${adjustedUntil})'[${nextV}];`;
          }
          lastV = nextV;
          globalInputIdx++;
        }
      }
      
      if (fragments.length > 0) {
        allInputs.push(...inputs);
        let inputsProcessed = 0;
        for (const { frag, offset, numInputs } of fragments) {
          // the frag receives inputOffset corresponding to its inputs start
          // wait, inputs from all modules are concatenated into `inputs` array.
          // how many inputs were BEFORE this module?
          // Since we pushed in order, globalInputIdx + (number of -i before this module).
          // We can just calculate number of -i in `inputs.slice(0, offset)`.
          const numBefore = inputs.slice(0, offset).filter(x => x === '-i').length;
          const state = { inputOffset: globalInputIdx + numBefore };
          const res = frag(lastV, state);
          chain += res.chain;
          lastV = res.nextV;
        }
      }
      
      if (chain.endsWith(';')) chain = chain.slice(0, -1);
      
      spawnArgs = [
        '-y', ...seekArgs, '-i', src, ...allInputs,
        '-filter_complex', chain, '-map', `[${lastV}]`,
        '-frames:v', String(segFrames), '-an', ...ENC, '-f', 'mpegts', segFile
      ];
    } else {
      spawnArgs = [
        '-y', ...seekArgs, '-i', src,
        '-vf', `${punchVF}${actualPadStart > 0 ? ',tpad=start_mode=clone:start_duration=' + actualPadStart : ''},tpad=stop_mode=clone:stop_duration=30`,
        '-frames:v', String(segFrames), '-an', ...ENC, '-f', 'mpegts', segFile
      ];
    }

    jobs.push({ outFile: segFile, args: spawnArgs, label: `segment ${seg.id}` });
    timelineClips.push({
      file: segFileStr,
      kind: seg.kind,
      id: seg.sub !== undefined ? `${seg.id}.${seg.sub + 1}` : seg.id,
      dur,
    });

    if (tOut) {
      const bSegsRes = whipMod.boundarySegments(tOut, {
        ...ctx, screenOffset, ENC,
        graphicFile: (cue) => path.join(renderDir, planRender(cue).outFile)
      });
      if (bSegsRes && bSegsRes.extraSegments) {
        // Transition halves sit on the same frame clock as the segments they
        // join, walking forward from where this segment's content ended.
        let exEnd = seg.end - endTrim;
        for (const ex of bSegsRes.extraSegments) {
          const transStr = `seg-${String(segIndex).padStart(3, '0')}-${ex.fileTag}.ts`;
          const transFile = path.join(tmpDir, transStr);
          concatLines.push(`file '${transStr}'`);
          segIndex++;

          exEnd += ex.dur;
          const exFrames = framesUntil(exEnd, framePos);
          framePos += exFrames;

          const spawnArgsEx = ['-y', ...ex.sliceArgs,
            '-filter_complex', ex.chain, '-map', '[v]',
            '-frames:v', String(exFrames), '-an', ...ENC, '-f', 'mpegts', transFile];

          jobs.push({ outFile: transFile, args: spawnArgsEx, label: `transition ${ex.fileTag}` });
          timelineClips.push({ file: transStr, kind: 'transition', id: ex.fileTag, dur: exFrames / CANVAS.fps });
        }
      }
    }
  }

  // Fail BEFORE encoding anything, and fail EXACTLY.
  //
  // The A/V gate after the mux is the outer net; this is the cheap inner one.
  // Being pure arithmetic over the plan it can demand an exact match instead of
  // the three-frame tolerance the muxed check needs, and it costs nothing —
  // where the outer gate only speaks after a full encode (two minutes on a
  // 20-minute video).
  //
  // What it actually catches: a segment plan that does not reach `total`, and a
  // future segment kind, effect module or transition that appends to
  // `concatLines` without walking `framePos` — real frames the clock never
  // accounted for, which would slide everything after them.
  //
  // What it does NOT catch, deliberately: one piece coming out a frame short.
  // framesUntil re-anchors on the next boundary, so the following piece takes
  // that frame back and the total still lands. That is the carry working as
  // designed — a local rounding wobble is sub-perceptual and, unlike the bug
  // this replaced, can never accumulate.
  const expectedFrames = Math.round(total * CANVAS.fps);
  if (framePos !== expectedFrames) {
    console.error(`segment plan does not fill the timeline: pieces total ${framePos} frames`
      + ` (${(framePos / CANVAS.fps).toFixed(3)}s) but the master clock is ${expectedFrames} frames`
      + ` (${total.toFixed(3)}s), a gap of ${((framePos - expectedFrames) / CANVAS.fps).toFixed(3)}s.`
      + ` Assembling would hand back a cut that drifts out of sync — refusing before encoding.`);
    process.exit(1);
  }

  let cacheHits = 0;
  let cacheMisses = 0;

  async function runPool(jobsList, jobsNWorkers) {
    let i = 0; let failed = null;
    async function worker() {
      while (i < jobsList.length && !failed) {
        const job = jobsList[i++];
        const key = jobKey(job.args);
        const cachePath = path.join(cacheDir, `${key}.ts`);

        if (!noCache && fs.existsSync(cachePath)) {
          fs.copyFileSync(cachePath, job.outFile);
          cacheHits++;
          continue;
        }

        const res = await new Promise((resolve) => {
          import('node:child_process').then(({ spawn }) => {
            const p = spawn('ffmpeg', job.args, { stdio: ['ignore', 'ignore', 'pipe'] });
            let err = '';
            p.stderr.setEncoding('utf8');
            p.stderr.on('data', (d) => { err += d; });
            p.on('close', (code) => resolve({ code, err }));
          });
        });

        if (res.code !== 0) failed = { job, err: res.err };
        else {
          cacheMisses++;
          fs.copyFileSync(job.outFile, cachePath);
        }
      }
    }
    await Promise.all(Array.from({ length: jobsNWorkers }, worker));
    if (failed) {
      console.error(`ffmpeg failed for ${failed.job.label}\n${failed.err.slice(-2000)}`);
      process.exit(1);
    }
  }

  await runPool(jobs, jobsN);
  console.log(`segments: ${cacheHits} cached, ${cacheMisses} encoded (jobs=${jobsN})`);

  if (segmentsOutDir) {
    fs.mkdirSync(segmentsOutDir, { recursive: true });
    for (const c of timelineClips) {
      const mp4 = path.join(segmentsOutDir, c.file.replace(/\.ts$/, '.mp4'));
      const r = spawnSync('ffmpeg', ['-y', '-i', path.join(tmpDir, c.file), '-c', 'copy', mp4], { encoding: 'utf8' });
      if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
      c.file = mp4;
    }
    if (!keepTemp) fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log(`exported ${timelineClips.length} segment clips to ${segmentsOutDir}`);
    return { clips: timelineClips, overlays, total, w, h };
  }

  const masterPath = path.join(workdir, 'master.wav');
  const hasMaster = fs.existsSync(masterPath);
  const voPath = hasMaster ? masterPath : path.join(workdir, 'vo.mp3');
  console.log(`using ${hasMaster ? 'master.wav' : 'vo.mp3'} for audio`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'concat.txt'), concatLines.join('\n') + '\n');
  
  const finalArgs = [
    '-y', '-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-i', path.resolve(voPath),
    '-map', '0:v', '-c:v', 'copy', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k',
    '-t', String(total), '-movflags', '+faststart', out
  ];
  const finalRes = spawnSync('ffmpeg', finalArgs, { cwd: tmpDir, encoding: 'utf8' });
  if (finalRes.status !== 0) {
    console.error(finalRes.stderr);
    process.exit(1);
  }

  const probeRes = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out], { encoding: 'utf8' });
  const actualTotal = parseFloat(probeRes.stdout);
  if (Math.abs(actualTotal - total) > 0.5) {
    console.error(`mismatched duration: ${actualTotal} != ${total}`);
    process.exit(1);
  }

  // A/V length gate. The check above reads format=duration, which is the
  // CONTAINER's length — the longest stream in it. A short VIDEO stream under a
  // full-length audio stream sails straight through it, which is exactly how
  // 1.562s of missing video shipped on consistent-ai-influencer with nobody
  // noticing until the avatar was visibly ~1.5s out of lip-sync by the last
  // clip (2026-08-07). The mix stage has had a frame-exact length check since
  // it was written; the video side had none. Tolerance is three frames, which
  // covers the AAC encoder's tail padding and still sits far under the ~50ms
  // where a viewer starts to see the mismatch.
  const streamDur = (kind) => parseFloat(spawnSync('ffprobe', ['-v', 'error',
    '-select_streams', kind, '-show_entries', 'stream=duration', '-of', 'csv=p=0', out],
    { encoding: 'utf8' }).stdout);
  const vDur = streamDur('v:0');
  const aDur = streamDur('a:0');
  const avTol = 3 / CANVAS.fps;
  if (Number.isFinite(vDur) && Number.isFinite(aDur) && Math.abs(vDur - aDur) > avTol) {
    console.error(`A/V length drift: video ${vDur.toFixed(3)}s vs audio ${aDur.toFixed(3)}s`
      + ` (${(aDur - vDur).toFixed(3)}s apart, tolerance ${avTol.toFixed(3)}s).`
      + ` The cut plays progressively out of sync — refusing to hand it over.`);
    process.exit(1);
  }

  const streamProbe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', out], { encoding: 'utf8' });
  if (streamProbe.stdout.trim() !== `${w}x${h}`) {
    console.error(`mismatched video resolution: ${streamProbe.stdout.trim()} != ${w}x${h}`);
    process.exit(1);
  }

  const audioProbe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', out], { encoding: 'utf8' });
  if (!audioProbe.stdout.includes('audio')) {
    console.error('mismatched audio: missing audio stream');
    process.exit(1);
  }

  const transitionsObj = whipInstances.map(t => {
    const toIdx = segments.findIndex(s => Math.abs(s.start - t.at) < 0.01);
    const fromIdx = toIdx - 1;
    return { at: t.at, direction: t.direction, fromIdx, toIdx };
  });

  const md = assemblyMd(video, segments, overlays, total, out, transitionsObj, captions, hasMaster ? 'master.wav' : 'vo.mp3');
  fs.writeFileSync(path.join(workdir, 'assembly.md'), md);

  if (!keepTemp) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log(`assembled: ${out} (${mmss(total)})`);
  return { clips: timelineClips, overlays, total, w, h };
}

export async function loadAssemblyInputs(opts) {
  const workdir = resolveWorkdir(opts.workdir);
  const cuesPath = path.join(workdir, 'cues.json');
  
  const cuesFile = JSON.parse(fs.readFileSync(cuesPath, 'utf8'));
  // 080 board approval. Express review was removed 2026-08-07 (plan 194): there is no waiver, only --force, which is a developer escape hatch and is never used in a real run.
  if (cuesFile.approved !== true && !opts.force) {
    console.error('refusing to render: cues.json approved=false — review on the board (node lib/board.mjs <slug>) or pass --force');
    process.exit(1);
  }

  const resolvedPath = path.join(workdir, 'resolved.json');
  const { video, resolved } = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));

  const cardLibraryRoot = path.resolve(import.meta.dirname, '..', '..', 'card-library');
  const words = JSON.parse(fs.readFileSync(path.join(workdir, 'transcript.json'), 'utf8'));
  const catalog = JSON.parse(fs.readFileSync(path.join(cardLibraryRoot, 'catalog.json'), 'utf8'));
  const recomputed = resolveCues(cuesFile.cues, words, catalog, cardLibraryRoot, workdir);
  // Freshness must compare post-extendExposure output — resolved.json is written
  // after the post-pass, so a raw recompute is always "stale" for any video with
  // an extended fullframe (bug found on test-01's first draft, 2026-07-24).
  // avatarSpans is REQUIRED here, not optional: resolved.json was written by
  // resolve.mjs WITH it, so recomputing without it can never match and the
  // freshness guard below trips unconditionally on any video carrying
  // avatar-full spans (found 2026-07-29, third plan blocked by a missed
  // extendExposure call site).
  const freshnessAvatarJobs = (() => {
    const p = path.join(workdir, 'avatar-jobs.json');
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
  })();
  const recomputedExtended = extendExposure(recomputed.resolved, {
    base: loadVideoManifest(workdir).base,
    total: words.length ? words[words.length - 1].end + 1.0 : 0,
    avatarSpans: avatarFullSpans(freshnessAvatarJobs),
  });
  const fresh = recomputed.errors.length === 0
    && JSON.stringify(recomputedExtended) === JSON.stringify(resolved);
  if (!fresh && !opts.force) {
    console.error('resolved.json is stale or cues.json no longer resolves — re-run node lib/resolve.mjs <slug>');
    process.exit(1);
  }

  const shotsPath = path.join(workdir, 'shots.json');
  const avatarJobsPath = path.join(workdir, 'avatar-jobs.json');
  let avatarJobs = [];
  let panelJobs = [];
  let sideJobs = [];
  let cornerJobs = [];
  if (fs.existsSync(shotsPath)) {
    const shotsFile = JSON.parse(fs.readFileSync(shotsPath, 'utf8'));
    if (shotsFile.approved !== true && !opts.force) {
      console.error('shots.json approved=false');
      process.exit(1);
    }
    if (!fs.existsSync(avatarJobsPath)) {
      console.error('run "download the avatar videos" first');
      process.exit(1);
    }
    const avatarJobsFile = JSON.parse(fs.readFileSync(avatarJobsPath, 'utf8'));
    avatarJobs = avatarJobsFile.jobs.filter(j => jobPurpose(j) === 'avatar-full');
    panelJobs = avatarJobsFile.jobs.filter(j => jobPurpose(j) === 'avatar-panel' && j.file && fs.existsSync(j.file));
    sideJobs = avatarJobsFile.jobs.filter(j => jobPurpose(j) === 'avatar-side' && j.file && fs.existsSync(j.file));
    // Corner chunks composited as the top-right bubble (plan 100). Absent files
    // are dropped so the bubble module simply no-ops rather than failing assembly.
    cornerJobs = avatarJobsFile.jobs.filter(j => jobPurpose(j) === 'corner' && j.file && fs.existsSync(j.file));
    const missing = avatarJobs.filter(j => !j.file || !fs.existsSync(j.file));
    if (missing.length > 0) {
      const missingIds = missing.map(j => j.id).join(', ');
      if (opts.draft) {
        // Review drafts do not wait for HeyGen (owner ask 2026-07-31): spans
        // whose clip has not downloaded render as the template's reference
        // still, visibly labelled. A re-cut after downloads swaps in the real
        // clips automatically (the file's presence changes the segment cache
        // key). The FINAL assemble below still refuses to ship a placeholder.
        const template = avatarJobsFile.template;
        const regPath = path.resolve(import.meta.dirname, '..', '..', 'heygen', 'registry.json');
        const reg = fs.existsSync(regPath) ? JSON.parse(fs.readFileSync(regPath, 'utf8')) : {};
        const still = reg[template]?.image ? path.resolve(path.dirname(regPath), reg[template].image) : null;
        if (!still || !fs.existsSync(still)) {
          console.error(`cannot placeholder ${missingIds}: no reference image for template "${template}" in video/heygen/registry.json`);
          process.exit(1);
        }
        for (const j of missing) { j.placeholder = true; j.placeholderFile = still; }
        console.error(`draft: ${missing.length} avatar clip(s) still rendering on HeyGen (${missingIds}) — using the "${template}" reference still; re-run the cut once downloads finish to swap in the real clips`);
      } else {
        console.error(`run "download the avatar videos" first. missing: ${missingIds}`);
        process.exit(1);
      }
    }
  }

  // Derived from the shared helper, not privately: this was computed inline
  // here, which meant lint-shots could not see it and E8 kept demanding a host
  // inside the span the film owns. One derivation, every surface.
  const filmSpan = introSpan(workdir);
  const introFile = path.join(workdir, 'intro-film', 'out', 'intro.mp4');
  if (!fs.existsSync(introFile)) {
    throw new Error(`missing intro film: ${introFile} — run.sh ${video} intro-render`);
  }
  // THIS is the door gate 027 guards. It used to sit on intro-render, which
  // both deadlocked the review and left this path — the one that puts the
  // film in front of an audience — completely unguarded.
  requireIntroApproved(workdir);

  const voPath = path.join(workdir, 'vo.mp3');
  const screen = opts.screen ?? path.join(workdir, 'screen.mp4');
  if (!fs.existsSync(voPath)) {
    console.error(`missing file: ${voPath}`);
    process.exit(1);
  }
  // base:"none" means there IS no screen recording — every screen segment is
  // replaced by a freeze frame (see fillGapsWithFreeze). Requiring the file
  // unconditionally made a base:"none" video impossible to assemble at all,
  // and the only way past it was a dummy file (found 2026-07-29).
  if (loadVideoManifest(workdir).base !== 'none' && !fs.existsSync(screen)) {
    console.error(`missing file: ${screen}`);
    process.exit(1);
  }

  const renderDir = path.join(workdir, 'renders');
  const missingRenders = resolved.filter(c => !fs.existsSync(path.join(renderDir, planRender(c).outFile)));
  if (missingRenders.length > 0) {
    const missingIds = missingRenders.map(c => c.id).join(', ');
    console.error(`run node lib/render.mjs first. missing renders: ${missingIds}`);
    process.exit(1);
  }

  const probeVo = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', voPath], { encoding: 'utf8' });
  const total = parseFloat(probeVo.stdout);

  const probeScreen = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', screen], { encoding: 'utf8' });
  const screenDuration = parseFloat(probeScreen.stdout);
  const segments = planSegments({ resolved, avatarJobs, total, filmSpan });
  const lastScreen = segments.findLast(s => s.kind === 'screen');
  if (lastScreen && screenDuration + opts.screenOffset < lastScreen.end - 2.0) {
    console.warn('warning: screen source duration + offset is more than 2s short of the last screen segment end');
  }
  
  return { workdir, video, resolved, avatarJobs, panelJobs, sideJobs, cornerJobs, words, total, screen, catalog, filmSpan };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.workdir) {
    console.error('usage: node lib/assemble.mjs <slug-or-path> [--screen <path>] [--screen-offset <sec>] [--out <path>] [--draft] [--encoder x264|videotoolbox] [--keep-temp] [--force] [--captions on|off] [--bubble on|off] [--effects on|off]');
    process.exit(1);
  }

  if (opts.captions === 'on') {
    const ffprobeRes = spawnSync('ffmpeg', ['-hide_banner', '-filters'], { encoding: 'utf8' });
    if (!ffprobeRes.stdout.includes(' subtitles ')) {
      console.error('ffmpeg lacks the subtitles filter (libass required)');
      process.exit(1);
    }
  }

  const inputs = await loadAssemblyInputs(opts);
  const root = path.resolve(import.meta.dirname, '..');
  const brandObj = loadBrand(root, { brand: inputs.brand || 'default' });
  const kbWorkdir = path.join(ASSEMBLE_MEDIA_ROOT, inputs.video);

  if (!opts.draft && !opts.force) {
    const fc = readFinalCut(inputs.workdir);
    if (!fc.approved) {
      console.error('refusing to build the full-resolution final: final-cut.json approved=false — review the Final Cut tab (node lib/board.mjs <slug>) or pass --force. Use --draft for a review copy.');
      process.exit(1);
    }
  }

  const out = opts.out ?? path.join(kbWorkdir, opts.draft ? 'final-draft.mp4' : 'final.mp4');
  await runAssembly({ ...inputs, screenOffset: opts.screenOffset, out, draft: opts.draft, encoder: opts.encoder ?? detectEncoder(), keepTemp: opts.keepTemp, transitions: opts.transitions, beats: opts.beats, captions: opts.captions, effects: opts.effects, bubble: opts.bubble, jobsN: opts.jobs, noCache: opts.noCache, brand: brandObj, catalog: inputs.catalog });

  const usedPlaceholders = inputs.avatarJobs.some((j) => j.placeholder);
  const entry = registerVersion(kbWorkdir, out, { draft: opts.draft, placeholder: usedPlaceholders });
  console.log(`registered version: ${entry.label}${usedPlaceholders ? ' (placeholder avatar — re-cut after avatar-download to swap in real clips)' : ''}`);
  console.log(`board: node lib/board.mjs ${inputs.video}  →  http://127.0.0.1:4322/`);
  console.log('Final Cut hint: Review the video in the Final Cut tab of the board.');
  process.exit(0);
}

// pathToFileURL, not `file://${argv[1]}`: on Windows argv[1] is a backslash
// path, so naive string concatenation never matches import.meta.url.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
