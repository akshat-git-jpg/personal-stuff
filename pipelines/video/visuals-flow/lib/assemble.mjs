// Template (card) recipe adapter over the recipe-agnostic core in lib/kit/.
// Owns the gates (cues, shots, intro, final cut), maps resolved cues, avatar jobs
// and the intro film into an edit plan, and keeps this file's CLI and exports.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { planRender } from './render.mjs';
import { resolveCues, extendExposure } from './resolve.mjs';
import { avatarFullSpans } from './lint-cues.mjs';
import { resolveWorkdir } from './workdir.mjs';
import { EFFECT_MODULES } from './effects/registry.mjs';
import { loadVideoManifest } from './video-manifest.mjs';
import { registerVersion } from './versions.mjs';
import { loadConceptSpans } from './concept-spans.mjs';
import { SHOT_CONSTANTS, jobPurpose } from './shot-constants.mjs';
import { readFinalCut } from './final-cut.mjs';
import { introSpan, introMode } from './intro-modes.mjs';
import { requireIntroApproved } from './intro-film/approve.mjs';
import { isCouponTemplate, loadRunConfig } from './run-config.mjs';
import { pathToFileURL } from 'node:url';

import * as whipMod from './effects/whip.mjs';
import * as beatsMod from './effects/beats.mjs';
import { loadBrand } from './brand-inline.mjs';
import { assembleEditPlan, detectEncoder, planSegments as corePlanSegments } from './kit/index.mjs';

export {
  CANVAS, AVATAR_LIPSYNC_LEAD, SLIVER_GRAPHIC_HOLD, SLIVER_GRAPHIC_HEAD, SLIVER_GRAPHIC, SLIVER_AVATAR,
  framesUntil, probeSrcAspect, planPanelGeometry, planSideGeometry,
  freezeTrailingGap, fillGapsWithFreeze, planSegmentOverlays, absorbSlivers,
  captionSegKey, maskCaptionWords, captionsApply, encoderArgs, detectEncoder, assemblyMd,
} from './kit/index.mjs';

// The intro film is this recipe's opening composition; its segment id is part of the plan.
export const INTRO_FILM_ID = 'intro-film';

export function planSegments({ filmSpan, ...rest }) {
  return corePlanSegments({ ...rest, filmSpan: filmSpan ? { id: INTRO_FILM_ID, ...filmSpan } : filmSpan });
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

// Coupon videos never show the code (it changes; the description is where it lives).
export const COUPON_CODE_RE = /^[A-Z]{2,}[A-Z0-9]*\d[A-Z0-9]*$/;

// This recipe's artifacts as the core's edit plan. Order is kept: overlays composite in it.
export function templateEditPlan({ workdir, resolved, avatarJobs = [], panelJobs = [], sideJobs = [], cornerJobs = [], total, screen, screenOffset = 0, filmSpan, captionClearCards = [], canvas }) {
  const renderDir = path.join(workdir, 'renders');
  const clips = [];
  if (loadVideoManifest(workdir).base === 'screen') clips.push({ kind: 'footage', id: 'screen', src: screen, offset: screenOffset });
  // The intro film owns the opening: cards and avatars cued inside it are dropped, not refused.
  if (filmSpan) clips.push({ kind: 'composition', id: INTRO_FILM_ID, start: 0, end: filmSpan.end, shadows: true, src: path.join(workdir, 'intro-film', 'out', 'intro.mp4') });
  for (const c of resolved) {
    if (c.placement !== 'fullframe' && c.placement !== 'overlay') throw new Error(`cue ${c.id}: unknown placement "${c.placement}"`);
    clips.push({ kind: 'card', id: c.id, start: c.start, duration: c.duration, src: path.join(renderDir, planRender(c).outFile),
      layer: c.placement === 'overlay' ? 'overlay' : 'base', ...(c.chroma ? { chroma: c.chroma } : {}),
      ...(captionClearCards.includes(c.card) ? { clearsCaptions: true } : {}), data: c });
  }
  const avatar = (j, mode) => ({ kind: 'avatar', id: j.id, mode, start: j.start, end: j.end, src: j.file,
    ...(j.placeholder ? { placeholder: j.placeholderFile } : {}), data: j });
  for (const j of avatarJobs) if (jobPurpose(j) === 'avatar-full') clips.push(avatar(j, 'full'));
  for (const j of panelJobs) clips.push(avatar(j, 'panel'));
  for (const j of sideJobs) clips.push(avatar(j, 'side'));
  for (const j of cornerJobs) clips.push(avatar(j, 'bubble'));
  return { total, ...(canvas ? { canvas } : {}), clips };
}

export async function runAssembly({ workdir, resolved, avatarJobs = [], panelJobs = [], sideJobs = [], cornerJobs = [], total, screen, screenOffset = 0, filmSpan, captionClearCards = [], canvas, words = [], bubbleOpts = {}, transitionStyle = null, catalog, ...opts }) {
  const plan = templateEditPlan({ workdir, resolved, avatarJobs, panelJobs, sideJobs, cornerJobs, total, screen, screenOffset, filmSpan, captionClearCards, canvas });
  // conceptSpans must match what effects-plan.mjs used, or the whip-reg
  // transitions it wrote into effects.json look "unknown" here and get dropped.
  const conceptSpans = loadConceptSpans(workdir, words);
  return assembleEditPlan(plan, { ...opts, workdir, words, effectModules: EFFECT_MODULES, avatarLayout: SHOT_CONSTANTS,
    effectContext: { conceptSpans, bubbleOpts, transitionStyle } });
}

function parseArgs(argv) {
  const opts = { workdir: null, screen: null, screenOffset: 0, out: null, draft: false, encoder: null, keepTemp: false, force: false, transitions: 'whip', beats: 'on', captions: 'on', effects: 'on', bubble: null, captionScope: null, bubbleCorner: null, jobs: 3, noCache: false, bare: false };
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
    else if (a === '--caption-scope') {
      const c = rest.shift();
      if (c !== 'screen' && c !== 'all') throw new Error('--caption-scope must be screen or all');
      opts.captionScope = c;
    }
    else if (a === '--bubble-corner') {
      const c = rest.shift();
      if (c !== 'top-right' && c !== 'bottom-right') throw new Error('--bubble-corner must be top-right or bottom-right');
      opts.bubbleCorner = c;
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
  const coupon = isCouponTemplate(workdir);
  // Coupon template videos have no intro film (owner, 2026-09-30).
  const filmSpan = coupon ? null : introSpan(workdir);
  const introFile = path.join(workdir, 'intro-film', 'out', 'intro.mp4');
  if (!coupon && !fs.existsSync(introFile)) {
    // Both intro flows deliver to this SAME path (plan 220) — only the verb
    // that produces it differs per mode. See intro-modes.mjs / approve.mjs.
    const renderVerb = introMode(workdir) === 'simple' ? 'intro-simple-render' : 'intro-render';
    throw new Error(`missing intro film: ${introFile} — run.sh ${video} ${renderVerb}`);
  }
  // THIS is the door gate 027 (complex) / 125 (simple) guards. It used to sit
  // on intro-render, which both deadlocked the review and left this path —
  // the one that puts the film in front of an audience — completely
  // unguarded. requireIntroApproved() is itself mode-aware (approve.mjs).
  if (!coupon) requireIntroApproved(workdir);

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
  
  const avatarTemplate = fs.existsSync(avatarJobsPath) ? JSON.parse(fs.readFileSync(avatarJobsPath, 'utf8')).template : null;
  // Output canvas: run-config.json `canvas` overrides the core default (1920x1080 @ 30).
  const canvas = loadRunConfig(workdir).canvas;
  return { workdir, video, resolved, avatarJobs, panelJobs, sideJobs, cornerJobs, words, total, screen, catalog, filmSpan, coupon, avatarTemplate, canvas };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.workdir) {
    console.error('usage: node lib/assemble.mjs <slug-or-path> [--screen <path>] [--screen-offset <sec>] [--out <path>] [--draft] [--encoder x264|videotoolbox] [--keep-temp] [--force] [--captions on|off] [--caption-scope screen|all] [--bubble on|off] [--bubble-corner top-right|bottom-right] [--effects on|off]');
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

  // Coupon template videos skip the final-cut review; the owner reviews the delivered file.
  if (!opts.draft && !opts.force && !inputs.coupon) {
    const fc = readFinalCut(inputs.workdir);
    if (!fc.approved) {
      console.error('refusing to build the full-resolution final: final-cut.json approved=false — review the Final Cut tab (node lib/board.mjs <slug>) or pass --force. Use --draft for a review copy.');
      process.exit(1);
    }
  }

  const out = opts.out ?? path.join(kbWorkdir, opts.draft ? 'final-draft.mp4' : 'final.mp4');
  const bubble = opts.bubble ?? (inputs.coupon ? 'on' : 'off');
  const captionScope = opts.captionScope ?? (inputs.coupon ? 'all' : 'screen');
  const firstFull = inputs.avatarJobs.map((j) => j.end).sort((a, b) => a - b)[0];
  const bubbleOpts = { corner: opts.bubbleCorner ?? (inputs.coupon ? 'bottom-right' : 'top-right'), template: inputs.avatarTemplate,
    from: inputs.coupon && firstFull !== undefined ? firstFull : 0 };
  await runAssembly({ ...inputs, screenOffset: opts.screenOffset, out, draft: opts.draft, encoder: opts.encoder ?? detectEncoder(), keepTemp: opts.keepTemp, transitions: opts.transitions, beats: opts.beats, captions: opts.captions, effects: opts.effects, bubble, captionScope, bubbleOpts, transitionStyle: inputs.coupon ? 'leak' : null, captionClearCards: inputs.coupon ? ['like-subscribe/like-subscribe'] : [], captionMask: inputs.coupon ? COUPON_CODE_RE : null, jobsN: opts.jobs, noCache: opts.noCache, brand: brandObj, catalog: inputs.catalog });

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
