// The glue between the authored composition and the mp4 the assembler needs.
// Plans 185-187 landed the author step, the review libs, the gate and the
// assembly splice, but nothing that turns film/index.html into a video — so
// `run.sh <slug> intro-render` reported success and produced nothing.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { resolveWorkdir } from './workdir.mjs';
import { linkFilmMedia } from './film-assets.mjs';
import { runGate } from './film-gate.mjs';
import { FILM_RENDERER } from '../renderer-constants.mjs';

// Same pin as review-film.mjs, now enforced rather than remembered: both import
// FILM_RENDERER from lib/renderer-constants.mjs, so they cannot drift apart.
// Reviewing on one renderer and shipping on another is how a green review ships
// a broken film.
const HYPERFRAMES = FILM_RENDERER;

// `-o` MUST be a filename. `-o renders` is read as an extensionless output file
// and the run dies at the audio mux with "Unable to choose an output format".
export function renderArgs(outFile) {
  return ['-y', HYPERFRAMES, 'render', 'film',
    '--fps', '30', '--format', 'mp4', '--quality', 'high',
    '-o', outFile];
}

export function renderFilm(slug) {
  const workdir = resolveWorkdir(slug);
  const filmDir = path.join(workdir, 'film');
  if (!fs.existsSync(path.join(filmDir, 'index.html'))) {
    throw new Error(`missing ${filmDir}/index.html — author the film first (step 025)`);
  }

  // Same reason review-film links media: a path above the project root is a
  // hyperframes lint error, and the composition's own media lives one level up.
  linkFilmMedia(slug);

  const rendersDir = path.join(workdir, 'renders');
  fs.mkdirSync(rendersDir, { recursive: true });
  const rel = path.join('renders', 'intro-film.mp4');
  const abs = path.join(workdir, rel);
  fs.rmSync(abs, { force: true });

  const r = spawnSync('npx', renderArgs(rel), { cwd: workdir, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`hyperframes render failed (exit ${r.status})`);
  if (!fs.existsSync(abs)) throw new Error(`render reported success but ${abs} does not exist`);
  return abs;
}

// Render -> gate -> deliver. The film only reaches out/ when the gate passes,
// so assemble.mjs can treat the presence of out/intro.mp4 as "gate passed".
export function renderAndDeliver(slug) {
  const workdir = resolveWorkdir(slug);
  const rendered = renderFilm(slug);
  const verdict = runGate(slug);
  if (!verdict.pass) return { rendered, verdict, delivered: null };

  const outDir = path.join(workdir, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const delivered = path.join(outDir, 'intro.mp4');
  fs.copyFileSync(rendered, delivered);
  return { rendered, verdict, delivered };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const slug = process.argv[2];
  if (!slug || slug.startsWith('--')) {
    console.error('usage: node lib/intro-film/render-film.mjs <slug-or-path> [--skip-render]');
    process.exit(1);
  }
  const skipRender = process.argv.includes('--skip-render');
  try {
    let verdict, delivered;
    if (skipRender) {
      verdict = runGate(slug);
      if (verdict.pass) {
        const workdir = resolveWorkdir(slug);
        const outDir = path.join(workdir, 'out');
        fs.mkdirSync(outDir, { recursive: true });
        delivered = path.join(outDir, 'intro.mp4');
        fs.copyFileSync(path.join(workdir, 'renders', 'intro-film.mp4'), delivered);
      }
    } else {
      ({ verdict, delivered } = renderAndDeliver(slug));
    }

    if (!verdict.pass) {
      for (const f of verdict.failures) console.error(`film gate: ${f}`);
      console.error('intro-render must refuse a film that fails the gate');
      process.exit(1);
    }
    console.log(`film gate: pass -> ${delivered}`);
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
