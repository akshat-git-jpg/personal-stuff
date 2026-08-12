import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { enrichLogos } from './logos-inline.mjs';
import { enrichImages } from './images-inline.mjs';
import { pathToFileURL } from 'node:url';

import { resolveCues, extendExposure } from './resolve.mjs';
import { avatarFullSpans } from './lint-cues.mjs';
import { checkAccentVisible } from './frame-gate.mjs';

import { resolveWorkdir } from './workdir.mjs';
import { loadVideoManifest } from './video-manifest.mjs';
import { loadBrand, injectBrand } from './brand-inline.mjs';
import { SHOT_CONSTANTS } from './shot-constants.mjs';
import { sideModeCueIds } from './side-mode.mjs';
import { CARD_RENDERER } from './renderer-constants.mjs';

const HYPERFRAMES = CARD_RENDERER;
const DURATION_TOLERANCE = 0.15;

const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
export const DEFAULT_JOBS = 3;

// Hash the STAGED directory rather than a hand-listed set of inputs. The staged
// tree is literally what the renderer reads, so the key cannot silently miss an
// input — the classic way a content cache starts serving stale output. It
// already contains the card files, the brand-injected html with its rewritten
// duration/canvas, and vars.json with the enriched logos.
export function hashRenderInputs(stagedDir, args) {
  const h = createHash('sha1');
  const walk = (dir, rel = '') => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = path.join(dir, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(abs, r);
      else { h.update(r); h.update('\0'); h.update(fs.readFileSync(abs)); h.update('\0'); }
    }
  };
  walk(stagedDir);
  // The spawn args carry quality, format and output naming, none of which live
  // in the staged tree.
  for (const a of args) { h.update(String(a)); h.update(' '); }
  h.update(HYPERFRAMES);
  return h.digest('hex');
}

export function pruneCache(cacheDir, now = Date.now(), ttl = CACHE_TTL_MS) {
  if (!fs.existsSync(cacheDir)) return 0;
  let removed = 0;
  for (const f of fs.readdirSync(cacheDir)) {
    const p = path.join(cacheDir, f);
    try {
      if (now - fs.statSync(p).mtimeMs > ttl) { fs.rmSync(p, { force: true }); removed++; }
    } catch { /* a file that vanished under us needs no pruning */ }
  }
  return removed;
}

// A bounded worker pool. Each render is an independent staged dir and an
// independent output file, so the only shared state is the results array.
export async function runPool(items, nWorkers, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.max(1, nWorkers) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

export function mmss(seconds) {
  const s = Math.max(0, seconds);
  const mm = Math.floor(s / 60);
  const ss = s - mm * 60;
  return `${String(mm).padStart(2, '0')}:${ss.toFixed(1).padStart(4, '0')}`;
}

function mmssDigits(seconds) {
  const s = Math.floor(Math.max(0, seconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, '0')}${String(ss).padStart(2, '0')}`;
}

export function rewriteDuration(html, seconds) {
  const re = /data-duration="([0-9.]+)"/g;
  const values = new Set();
  let m;
  while ((m = re.exec(html))) values.add(m[1]);
  if (values.size === 0) {
    return { html, error: 'no data-duration attribute found' };
  }
  if (values.size > 1) {
    return { html, error: `mixed data-duration values: ${[...values].sort().join(', ')}` };
  }
  const newHtml = html.replace(/data-duration="[0-9.]+"/g, `data-duration="${seconds}"`);
  return { html: newHtml, error: null };
}

// Side-mode cues render the card into the left column instead of the full canvas.
// The hyperframes CLI has no size flag — the canvas comes from the card's own
// data-width — so bake it into the staged HTML, exactly as rewriteDuration does
// for duration. A side-ready card lays out relative to its root, so changing
// data-width is sufficient; a card with hardcoded 1920px CSS is rejected by
// card-library's side gate, not here.
export function rewriteCanvas(html, width) {
  const re = /data-width="(\d+)"/g;
  const values = new Set();
  let m;
  while ((m = re.exec(html))) values.add(m[1]);
  if (values.size === 0) {
    return { html, error: 'no data-width attribute found' };
  }
  if (values.size > 1) {
    return { html, error: `mixed data-width values: ${[...values].sort().join(', ')}` };
  }
  const newHtml = html.replace(/data-width="\d+"/g, `data-width="${width}"`);
  return { html: newHtml, error: null };
}

export function applySideMode(resolved, workdir) {
  const shotsResolvedPath = path.join(workdir, 'shots.resolved.json');
  const sideIds = fs.existsSync(shotsResolvedPath)
    ? sideModeCueIds(resolved, JSON.parse(fs.readFileSync(shotsResolvedPath, 'utf8')).spans)
    : new Set();
  for (const cue of resolved) cue.sideMode = sideIds.has(cue.id);
}

export function planRender(cue, quality = 'standard') {
  const format = cue.placement === 'overlay' ? 'mov' : 'mp4';
  const cardBase = path.basename(cue.card);
  const outFile = `${mmssDigits(cue.start)}-${cue.id}-${cardBase}.${format}`;
  const args = [
    'render', cue.card,
    '--variables-file', 'vars.json',
    '--fps', '30',
    '--format', format,
    '--quality', quality,
    '--quiet',
  ];
  return { args, outFile, format };
}

export function manifestCues(resolved, renderDir) {
  return resolved.filter((cue) => fs.existsSync(path.join(renderDir, planRender(cue).outFile)));
}

export function manifestMd(video, cues, offset = 0) {
  const sorted = [...cues].sort((a, b) => a.start - b.start);
  const rows = sorted.map((cue) => {
    const { outFile } = planRender(cue);
    return `| ${mmss(cue.start + offset)} | ${outFile} | ${cue.duration}s | ${cue.placement} | ${cue.card} |`;
  });
  const offsetNote = offset
    ? `Timecodes assume the voiceover starts at ${mmss(offset)} on the editor timeline (offset ${offset}s).`
    : 'Timecodes assume the voiceover starts at 00:00.0 on the editor timeline. If an intro shifts the VO, set "offset" (seconds) in cues.json and re-run render.';
  return [
    `# ${video} — graphics manifest`,
    '',
    offsetNote,
    '',
    '| place at | file | duration | placement | card |',
    '|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}

function parseArgs(argv) {
  const opts = { workdir: null, only: null, quality: 'standard', force: false, jobs: DEFAULT_JOBS, noCache: false };
  const rest = [...argv];
  opts.workdir = rest.shift();
  while (rest.length) {
    const a = rest.shift();
    if (a === '--only') opts.only = rest.shift();
    else if (a === '--quality') opts.quality = rest.shift();
    else if (a === '--force') opts.force = true;
    else if (a === '--jobs') opts.jobs = Math.max(1, parseInt(rest.shift(), 10) || DEFAULT_JOBS);
    else if (a === '--no-cache') opts.noCache = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  return opts;
}


async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.workdir) {
    console.error('usage: node lib/render.mjs <slug-or-path> [--only <cueId>] [--quality draft|standard] [--force] [--jobs N] [--no-cache]');
    process.exit(1);
  }

  const cardLibraryRoot = path.resolve(import.meta.dirname, '..', '..', 'card-library');
  const workdir = resolveWorkdir(opts.workdir);

  // The storyboard gate. The new-card look-preview is separate and earlier: it is a conversation gate before a card is ever built (DESIGN.md item 0), so nothing at render time stands in for it.
  // The 037 card-plan gate was removed 2026-08-07 (plan 195): approving cards
  // from a written description is the weaker of the two reviews, and the
  // storyboard gate below judges the SAME cards built and in context. The
  // safety property 037 carried — a card nobody looked at cannot reach render —
  // now lives in card-plan.mjs's resetStoryboardApproval().

  const cuesPath = path.join(workdir, 'cues.json');

  const cuesFile = JSON.parse(fs.readFileSync(cuesPath, 'utf8'));
  if (cuesFile.approved !== true && !opts.force) {
    console.error('refusing to render: cues.json approved=false — review on the board (node lib/board.mjs <slug>) or pass --force');
    process.exit(1);
  }

  const manifest = loadVideoManifest(workdir);
  const root = path.resolve(import.meta.dirname, '..');
  const brand = loadBrand(root, manifest);

  const resolvedPath = path.join(workdir, 'resolved.json');
  const renderDir = path.join(workdir, 'renders');
  
  const { video, resolved, offset = 0 } = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));

  const words = JSON.parse(fs.readFileSync(path.join(workdir, 'transcript.json'), 'utf8'));
  const catalog = JSON.parse(fs.readFileSync(path.join(cardLibraryRoot, 'catalog.json'), 'utf8'));
  const recomputed = resolveCues(cuesFile.cues, words, catalog, cardLibraryRoot, workdir);
  // Compare post-extendExposure output — see the matching note in assemble.mjs.
  // avatarSpans is REQUIRED: resolved.json was written with it, so omitting it
  // here makes the freshness comparison fail for every video with avatar-full
  // spans (found 2026-07-29).
  const freshnessAvatarJobs = (() => {
    const p = path.join(workdir, 'avatar-jobs.json');
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
  })();
  const recomputedExtended = extendExposure(recomputed.resolved, {
    base: manifest.base,
    total: words.length ? words[words.length - 1].end + 1.0 : 0,
    avatarSpans: avatarFullSpans(freshnessAvatarJobs),
  });
  const fresh = recomputed.errors.length === 0
    && JSON.stringify(recomputedExtended) === JSON.stringify(resolved);
  if (!fresh && !opts.force) {
    console.error('resolved.json is stale or cues.json no longer resolves — re-run node lib/resolve.mjs <slug>');
    process.exit(1);
  } else if (!fresh && opts.force) {
    console.warn('warning: resolved.json is stale, but proceeding anyway due to --force');
  }

  fs.mkdirSync(renderDir, { recursive: true });

  // shots.resolved.json only exists for a video with an avatar plan (step 060
  // runs after cues resolve at step 040), so a side span's cue can only be
  // known here at render time — see lib/side-mode.mjs.
  applySideMode(resolved, workdir);

  const cues = opts.only ? resolved.filter((c) => c.id === opts.only) : resolved;

  const errors = [];
  const cacheDir = path.join(workdir, 'render-cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  pruneCache(cacheDir);
  let cacheHits = 0;
  let cacheMisses = 0;

  async function renderOne(cue) {
    const stagedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-render-'));
    try {
      fs.cpSync(path.join(cardLibraryRoot, 'hyperframes.json'), path.join(stagedDir, 'hyperframes.json'));
      fs.cpSync(path.join(cardLibraryRoot, 'meta.json'), path.join(stagedDir, 'meta.json'));
      const stagedCardDir = path.join(stagedDir, cue.card);
      fs.mkdirSync(path.dirname(stagedCardDir), { recursive: true });
      fs.cpSync(path.join(cardLibraryRoot, cue.card), stagedCardDir, { recursive: true });

      const indexPath = path.join(stagedCardDir, 'index.html');
      const html = fs.readFileSync(indexPath, 'utf8');
      let { html: newHtml, error: rewriteError } = rewriteDuration(html, cue.duration);
      if (rewriteError) {
        errors.push(`${cue.id}: data-duration rewrite failed: ${rewriteError}`);
        return;
      }
      if (cue.sideMode) {
        const { html: canvasHtml, error: canvasError } = rewriteCanvas(newHtml, SHOT_CONSTANTS.SIDE_GRAPHICS_W.value);
        if (canvasError) {
          errors.push(`${cue.id}: data-width rewrite failed: ${canvasError}`);
          return;
        }
        newHtml = canvasHtml;
      }
      fs.writeFileSync(indexPath, injectBrand(newHtml, brand));

      const { variables: withImages, missing: missingImages } = enrichImages(cue.variables, workdir);
      if (missingImages.length > 0) {
        errors.push(`${cue.id}: image not found in the video workdir: ${missingImages.join(', ')}`);
        return;
      }
      const { variables: enrichedVars, missing } = enrichLogos(withImages, cardLibraryRoot);
      if (missing.length > 0) {
        errors.push(`${cue.id}: missing logo slugs in registry: ${missing.join(', ')}`);
        return;
      }
      fs.writeFileSync(path.join(stagedDir, 'vars.json'), JSON.stringify(enrichedVars));

      const { args, outFile } = planRender(cue, opts.quality);
      const outPath = path.join(renderDir, outFile);
      const spawnArgs = [HYPERFRAMES, ...args, '-o', outPath];

      const key = hashRenderInputs(stagedDir, spawnArgs);
      const cachePath = path.join(cacheDir, `${key}${path.extname(outFile)}`);
      if (!opts.noCache && fs.existsSync(cachePath)) {
        fs.copyFileSync(cachePath, outPath);
        // Touch it so a card still in use survives the 14-day prune.
        const now = new Date();
        fs.utimesSync(cachePath, now, now);
        cacheHits++;
      } else {
        const result = await new Promise((resolve) => {
          const child = spawn('npx', spawnArgs, { cwd: stagedDir, stdio: ['ignore', 'pipe', 'pipe'] });
          let out = ''; let err = '';
          child.stdout.setEncoding('utf8');
          child.stderr.setEncoding('utf8');
          child.stdout.on('data', (d) => { out += d; });
          child.stderr.on('data', (d) => { err += d; });
          child.on('error', (e) => resolve({ status: -1, stdout: out, stderr: String(e) }));
          child.on('close', (code) => resolve({ status: code, stdout: out, stderr: err }));
        });
        if (result.status !== 0) {
          console.error(result.stdout ?? '');
          console.error(result.stderr ?? '');
          errors.push(`${cue.id}: render failed (exit ${result.status})`);
          return;
        }
        cacheMisses++;

        const probe = spawnSync(
          'ffprobe',
          ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', outPath],
          { encoding: 'utf8' },
        );
        const actualDuration = parseFloat(probe.stdout);
        if (!Number.isFinite(actualDuration) || Math.abs(actualDuration - cue.duration) > DURATION_TOLERANCE) {
          errors.push(`${cue.id}: rendered duration ${actualDuration} != expected ${cue.duration}`);
          return;
        }

        // Only a clip that passed the duration check earns a cache entry, so a
        // bad render can never be served back on the next run.
        fs.copyFileSync(outPath, cachePath);
      }

      if (typeof cue.variables?.accent === 'string' && cue.variables.accent.trim()) {
        const msg = checkAccentVisible(cue, outPath, (brand?.tokens?.['--accent'] ?? '#fb923c'));
        if (msg) errors.push(`${cue.id}: ${msg}`);
      }
    } catch (e) {
      // One unrenderable cue must not take the other 22 down with it. Before
      // the pool this threw straight out of the loop and killed the whole run;
      // inside a pool it would also abandon every worker still in flight.
      // A card deleted from the catalog is the common cause.
      errors.push(`${cue.id}: ${e.code === 'ENOENT' ? `card "${cue.card}" is not in the card library` : e.message}`);
    } finally {
      fs.rmSync(stagedDir, { recursive: true, force: true });
    }
  }

  const started = Date.now();
  await runPool(cues, opts.jobs, renderOne);
  // Workers finish out of order, so sort for a stable, diffable error list.
  errors.sort();
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`renders: ${cacheHits} cached, ${cacheMisses} rendered (jobs=${opts.jobs}) in ${secs}s`);

  const cuesForManifest = manifestCues(resolved, renderDir);
  if (cuesForManifest.length < resolved.length) {
    const missing = resolved.filter(r => !cuesForManifest.includes(r)).map(r => r.id);
    console.warn(`warning: leaving missing files out of manifest: ${missing.join(', ')}`);
  }
  fs.writeFileSync(path.join(workdir, 'manifest.md'), manifestMd(video, cuesForManifest, offset));

  if (errors.length) {
    for (const e of errors) console.error(e);
    process.exit(1);
  }

  console.log(`board: node lib/board.mjs ${video}  →  http://127.0.0.1:4322/`);
}

// pathToFileURL, not `file://${argv[1]}`: on Windows argv[1] is a backslash
// path, so naive string concatenation never matches import.meta.url.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
