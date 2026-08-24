// The simple-flow renderer (plan 220). Turns an approved intro-simple/cutlist.json
// into intro-film/out/intro.mp4 — the SAME output path the complex flow writes,
// on purpose (see lib/intro-film/approve.mjs's APPROVAL_FILE comment): both
// flows' downstream consumers (assemble.mjs, export-timeline.mjs) stay mode-blind.
//
// Card rendering reuses lib/render.mjs's staging machinery (hashRenderInputs,
// runPool, rewriteDuration, DEFAULT_JOBS) rather than re-implementing it, and
// since plan 229 it stages from the SAME source the body does — card-library/.
// The ~8 staging lines are duplicated with a comment naming the original,
// because lib/render.mjs's own staging block is inlined inside its single
// renderOne() closure and pulling it out would touch how the body pipeline
// renders every card — the plan's STOP condition on this exact point.
//
// Because the source is now shared, the ASSET PROTOCOL must be shared too:
// a card reaches its images and logos only through the data URIs enrichImages
// and enrichLogos write into vars.json. Plan 229 imported both and never
// called them, so every intro beat carrying a shot or a logo staged a card
// whose src paths do not resolve inside the temp dir (fixed 2026-08-23).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { resolveWorkdir } from '../workdir.mjs';
import { CARD_RENDERER } from '../renderer-constants.mjs';
import { npxArgs, npxSpawnOpts } from '../intro-film/npx.mjs';
import { hashRenderInputs, runPool, rewriteDuration, DEFAULT_JOBS } from '../render.mjs';
import { STAND_IN_IMAGE } from '../intro-film/film-assets.mjs';
import { lintCutlist, truncationNotices } from './lint-cutlist.mjs';
import { loadKit, loadCutlist, CARD_LIBRARY_ROOT } from './inputs.mjs';
import { enrichLogos } from '../logos-inline.mjs';
import { enrichImages } from '../images-inline.mjs';
import { loadBrand, injectBrand } from '../brand-inline.mjs';
import { loadVideoManifest } from '../video-manifest.mjs';

// visuals-flow/ — the root loadBrand resolves brand.json (and brands/<name>.json)
// against, matching lib/render.mjs:217.
const FLOW_ROOT = path.resolve(import.meta.dirname, '..', '..');

const HYPERFRAMES = CARD_RENDERER;
const CANVAS_VF = 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p';

// The reference videos' only transition (KIT.md / plan 220): a hard cut
// punctuated by a couple of frames of white, never a crossfade or a blur.
const FLASH_FRAMES = 2;
const FPS = 30;

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed (exit ${r.status}): ${r.stderr || r.stdout}`);
  }
  return r;
}

// The variables ONE beat's card is rendered with. Exported (and kept separate
// from renderCardBeat's filesystem work) so the gate can assert the contract
// without spending a real render on it — the two defects below both shipped
// green because nothing could see this object.
//
//  1. ASSETS. A staged card lives in a temp dir, so a workdir-relative image
//     src and a logo slug resolve ONLY through the data URIs enrichImages and
//     enrichLogos write in. Plan 229 imported both and called neither.
//  2. DURATION, injected LAST — after the enrichers and over anything the cut
//     list carries — because it is renderer-owned: the beat's own length is
//     the only truth about how long this card is on screen. The four ported
//     kit cards read `VARS.duration ?? 3.5` to scale their motion schedule, so
//     without it a 2.5s beat ran a 3.5s schedule and got chopped, while S4's
//     renderer-owned-var rule told authors the injection already happened
//     (found 2026-08-23 — the rule was right, the renderer was not).
export function buildBeatVars(beat, { workdir, duration }) {
  const { variables: withImages, missing: missingImages } = enrichImages(beat.vars ?? {}, workdir);
  if (missingImages.length > 0) {
    throw new Error(`${beat.id}: image not found in the video workdir: ${missingImages.join(', ')}`);
  }
  const { variables: enrichedVars, missing: missingLogos } = enrichLogos(withImages, CARD_LIBRARY_ROOT);
  if (missingLogos.length > 0) {
    throw new Error(`${beat.id}: missing logo slugs in registry: ${missingLogos.join(', ')}`);
  }
  return { ...enrichedVars, duration };
}

// Renders ONE card or overlay beat to a clip via the hyperframes CLI, staged
// against card-library/ — the one catalogue the intro and the body share
// (plan 229). Mirrors lib/render.mjs's renderOne staging block, verbatim
// per plan 220's "The render machinery to REUSE" section.
// Deleting a staging dir must never fail a render that already succeeded.
// On Windows the dir was a child process's cwd, and the handle can outlive
// spawnSync's return by longer than a retry budget — rmSync then throws EPERM
// from a `finally`, which discards a finished render and every other beat in
// the pool. A leaked temp dir under os.tmpdir() costs nothing and the OS
// reclaims it; a lost render costs the whole step. (Windows, 2026-08-23.)
function rmQuiet(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  } catch (e) {
    console.warn(`note: could not remove staging dir ${dir} (${e.code ?? e.message}) — left for the OS to reclaim`);
  }
}

function renderCardBeat(beat, { renderDir, cacheDir, noCache, workdir, brand }) {
  const stagedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-intro-simple-'));
  try {
    // --- staging, copied from lib/render.mjs's renderOne (see header comment) ---
    fs.cpSync(path.join(CARD_LIBRARY_ROOT, 'hyperframes.json'), path.join(stagedDir, 'hyperframes.json'));
    fs.cpSync(path.join(CARD_LIBRARY_ROOT, 'meta.json'), path.join(stagedDir, 'meta.json'));
    // A catalog slug IS the relative path ("<type>/<card>"), unlike the old
    // kit which prefixed every card with "cards/".
    const cardRel = beat.card;
    const stagedCardDir = path.join(stagedDir, cardRel);
    fs.mkdirSync(path.dirname(stagedCardDir), { recursive: true });
    fs.cpSync(path.join(CARD_LIBRARY_ROOT, cardRel), stagedCardDir, { recursive: true });
    // --- end staging ---

    const duration = +(beat.t_end - beat.t_start).toFixed(3);
    const indexPath = path.join(stagedCardDir, 'index.html');
    const html = fs.readFileSync(indexPath, 'utf8');
    // rewriteDuration stamps data-duration so the render encodes the right
    // frame count; the kit card's own DURATION block (KIT.md) scales its
    // motion schedule to that same value — both are needed, neither is a
    // duplicate of the other (plan 220).
    const { html: newHtml, error } = rewriteDuration(html, duration);
    if (error) throw new Error(`${beat.id}: data-duration rewrite failed: ${error}`);
    // Same brand tokens the body gets (lib/render.mjs:290). Without this a
    // video on a non-default brand rendered a branded body and an unbranded
    // intro from the very same card.
    fs.writeFileSync(indexPath, injectBrand(newHtml, brand));

    fs.writeFileSync(path.join(stagedDir, 'vars.json'), JSON.stringify(buildBeatVars(beat, { workdir, duration })));

    const format = beat.kind === 'overlay' ? 'mov' : 'mp4';
    const outFile = `${beat.id}-${beat.card}.${format}`;
    const outPath = path.join(renderDir, outFile);
    const spawnArgs = [HYPERFRAMES, 'render', cardRel, '--variables-file', 'vars.json', '--fps', String(FPS), '--format', format, '--quality', 'standard', '--quiet', '-o', outPath];

    const key = hashRenderInputs(stagedDir, spawnArgs);
    const cachePath = path.join(cacheDir, `${key}${path.extname(outFile)}`);
    if (!noCache && fs.existsSync(cachePath)) {
      fs.copyFileSync(cachePath, outPath);
    } else {
      const r = spawnSync('npx', npxArgs(spawnArgs), npxSpawnOpts({ cwd: stagedDir, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }));
      if (r.status !== 0) {
        throw new Error(`${beat.id}: hyperframes render failed (exit ${r.status}): ${r.stderr || r.stdout}`);
      }
      if (!fs.existsSync(outPath)) throw new Error(`${beat.id}: render reported success but ${outPath} does not exist`);
      fs.copyFileSync(outPath, cachePath);
    }
    return { path: outPath, format };
  } finally {
    rmQuiet(stagedDir);
  }
}

// A stand-in avatar for videos with no real avatar.mp4 yet (before step 430
// downloads it) — one repeated still, long enough to cover the whole span.
// Same idea as lib/intro-film/film-assets.mjs's buildAvatarStandIn, kept as
// its own small function here rather than imported: that module builds into
// film/assets/ under its OWN workdir convention, which is a complex-flow
// directory shape this flow does not share.
function buildStandIn(workdir, seconds) {
  const dest = path.join(workdir, 'intro-simple', 'stand-in-avatar.mp4');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  run('ffmpeg', [
    '-y', '-framerate', '1', '-loop', '1', '-i', STAND_IN_IMAGE, '-t', String(Math.max(1, Math.ceil(seconds))),
    '-r', String(FPS), '-vf', CANVAS_VF, '-pix_fmt', 'yuv420p', dest,
  ]);
  return dest;
}

function makeAvatarClip(avatarSrc, ss, duration, outPath) {
  run('ffmpeg', ['-y', '-ss', String(ss), '-i', avatarSrc, '-t', String(duration), '-vf', CANVAS_VF, '-an', '-r', String(FPS), '-pix_fmt', 'yuv420p', '-c:v', 'libx264', outPath]);
}

function makeCardClip(cardSrc, duration, outPath) {
  run('ffmpeg', ['-y', '-i', cardSrc, '-t', String(duration), '-vf', CANVAS_VF, '-an', '-r', String(FPS), '-pix_fmt', 'yuv420p', '-c:v', 'libx264', outPath]);
}

// The card's background is transparent (rendered to .mov with an alpha
// channel — see planRender's overlay->mov choice in lib/render.mjs), so it
// composites over the avatar slice rather than replacing it.
function makeOverlayClip(avatarSrc, ss, duration, overlaySrc, outPath) {
  run('ffmpeg', [
    '-y', '-ss', String(ss), '-i', avatarSrc, '-i', overlaySrc,
    '-filter_complex', `[0:v]${CANVAS_VF}[base];[base][1:v]overlay=0:0:format=auto`,
    '-t', String(duration), '-an', '-r', String(FPS), '-pix_fmt', 'yuv420p', '-c:v', 'libx264', outPath,
  ]);
}

function makeFlashClip(duration, outPath) {
  run('ffmpeg', ['-y', '-f', 'lavfi', '-i', `color=c=white:s=1920x1080:d=${duration}:r=${FPS}`, '-pix_fmt', 'yuv420p', '-c:v', 'libx264', outPath]);
}

function concatClips(clipPaths, outPath) {
  const listPath = `${outPath}.concat.txt`;
  const listing = clipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
  fs.writeFileSync(listPath, `${listing}\n`);
  try {
    run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outPath]);
  } finally {
    fs.rmSync(listPath, { force: true });
  }
}

// The end-to-end render: lint -> render every card/overlay beat -> cut the
// timeline with 2-frame white flashes at every kind change -> deliver to
// intro-film/out/intro.mp4 (shared path, see lib/intro-film/approve.mjs).
export async function renderSimple(slugOrWorkdir, { jobs = DEFAULT_JOBS, noCache = false } = {}) {
  const workdir = resolveWorkdir(slugOrWorkdir);
  const kit = loadKit();
  const cutlist = loadCutlist(workdir);

  const transcriptPath = path.join(workdir, 'transcript.json');
  const words = fs.existsSync(transcriptPath) ? JSON.parse(fs.readFileSync(transcriptPath, 'utf8')) : [];

  // Refuses to run if the cut list fails its own pacing lint — rendering an
  // unlinted cut list is how a bad intro reaches the owner (plan 220).
  const { errors } = lintCutlist({ cutlist, kit, words });
  if (errors.length) {
    for (const e of errors) console.error(e);
    throw new Error(`intro-simple/cutlist.json fails the pacing lint (${errors.length} error(s)) — fix the cut list, do not weaken the lint`);
  }

  const simpleDir = path.join(workdir, 'intro-simple');
  const renderDir = path.join(simpleDir, 'renders');
  const cacheDir = path.join(simpleDir, 'render-cache');
  fs.mkdirSync(renderDir, { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });

  const sorted = [...cutlist.beats].sort((a, b) => a.t_start - b.t_start);
  const cardBeats = sorted.filter((b) => b.kind === 'card' || b.kind === 'overlay');

  // workdir and brand both reach renderCardBeat here: workdir is what
  // enrichImages resolves a shot path against, and brand is the token set the
  // body pipeline injects. Plan 229 declared workdir in the signature and
  // never passed it, so it was `undefined` at every call (fixed 2026-08-23).
  const brand = loadBrand(FLOW_ROOT, loadVideoManifest(workdir));

  const renderedByBeat = {};
  await runPool(cardBeats, jobs, async (beat) => {
    renderedByBeat[beat.id] = renderCardBeat(beat, { renderDir, cacheDir, noCache, workdir, brand });
  });

  const avatarPath = path.join(workdir, 'avatar.mp4');
  const span = cutlist.span.end - cutlist.span.start;
  let standIn = false;
  let avatarSrc = avatarPath;
  if (!fs.existsSync(avatarPath)) {
    avatarSrc = buildStandIn(workdir, span);
    standIn = true;
  }

  const cutDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-intro-simple-cut-'));
  try {
    const clipPaths = [];
    for (let i = 0; i < sorted.length; i++) {
      const beat = sorted[i];
      if (i > 0 && sorted[i - 1].kind !== beat.kind) {
        const flashPath = path.join(cutDir, `flash-${i}.mp4`);
        makeFlashClip(+(FLASH_FRAMES / FPS).toFixed(6), flashPath);
        clipPaths.push(flashPath);
      }
      const duration = +(beat.t_end - beat.t_start).toFixed(3);
      const clipPath = path.join(cutDir, `${beat.id}.mp4`);
      if (beat.kind === 'avatar') {
        makeAvatarClip(avatarSrc, beat.t_start, duration, clipPath);
      } else if (beat.kind === 'card') {
        makeCardClip(renderedByBeat[beat.id].path, duration, clipPath);
      } else if (beat.kind === 'overlay') {
        makeOverlayClip(avatarSrc, beat.t_start, duration, renderedByBeat[beat.id].path, clipPath);
      }
      clipPaths.push(clipPath);
    }

    const outDir = path.join(workdir, 'intro-film', 'out');
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, 'intro.mp4');
    fs.rmSync(outPath, { force: true });
    concatClips(clipPaths, outPath);

    fs.writeFileSync(
      path.join(simpleDir, 'render.json'),
      JSON.stringify(
        {
          standIn,
          renderedAt: new Date().toISOString(),
          beats: sorted.map((b) => ({
            id: b.id,
            kind: b.kind,
            card: b.card ?? null,
            duration: +(b.t_end - b.t_start).toFixed(3),
          })),
        },
        null,
        2,
      ) + '\n',
    );

    if (standIn) {
      console.log(`note: rendered with a STATIC avatar stand-in; run.sh <slug> intro-simple-rerender after avatar-download`);
    }
    return { path: outPath, standIn };
  } finally {
    rmQuiet(cutDir);
  }
}

// pathToFileURL, not `file://${argv[1]}`: on Windows argv[1] is a backslash
// path, so naive string concatenation never matches import.meta.url.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const slug = process.argv[2];
  if (!slug) {
    console.error('usage: node lib/intro-kit/render-simple.mjs <slug-or-path> [--no-cache]');
    process.exit(1);
  }
  const noCache = process.argv.includes('--no-cache');
  renderSimple(slug, { noCache })
    .then(({ path: p, standIn }) => {
      console.log(`intro-simple render -> ${p}${standIn ? ' (stand-in avatar)' : ''}`);
      process.exit(0);
    })
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}
