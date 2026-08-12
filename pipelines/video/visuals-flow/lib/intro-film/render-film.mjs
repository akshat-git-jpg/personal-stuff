// The glue between the authored composition and the mp4 the assembler needs.
// Plans 185-187 landed the author step, the review libs, the gate and the
// assembly splice, but nothing that turns film/index.html into a video — so
// `run.sh <slug> intro-render` reported success and produced nothing.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { resolveWorkdir } from './workdir.mjs';
import { linkFilmMedia, STAND_IN_IMAGE } from './film-assets.mjs';
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
  //
  // standInImage is offered unconditionally: linkFilmMedia only reaches for it
  // when the real avatar.mp4 is absent, so this is a no-op once 108 has run.
  // Before that, every review before the real avatar exists renders against a
  // still, and never spends a HeyGen second to do it (owner 2026-08-07).
  const { standIn } = linkFilmMedia(slug, { standInImage: STAND_IN_IMAGE });

  const rendersDir = path.join(workdir, 'renders');
  fs.mkdirSync(rendersDir, { recursive: true });
  const rel = path.join('renders', 'intro-film.mp4');
  const abs = path.join(workdir, rel);
  fs.rmSync(abs, { force: true });

  const r = spawnSync('npx', renderArgs(rel), { cwd: workdir, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`hyperframes render failed (exit ${r.status})`);
  if (!fs.existsSync(abs)) throw new Error(`render reported success but ${abs} does not exist`);

  // A record on disk, not just a console line — a reviewer opening this
  // workdir cold must be able to tell a proof from the deliverable without
  // having watched the render happen.
  fs.writeFileSync(
    path.join(rendersDir, 'render-meta.json'),
    JSON.stringify({ standIn, renderedAt: new Date().toISOString() }, null, 2) + '\n',
  );
  if (standIn) {
    console.log(`note: rendered with a STATIC avatar stand-in; run.sh ${slug} intro-rerender after 103`);
  }

  return { path: abs, standIn };
}

// Render -> gate -> deliver. The film only reaches out/ when the gate passes,
// so assemble.mjs can treat the presence of out/intro.mp4 as "gate passed".
export function renderAndDeliver(slug) {
  const workdir = resolveWorkdir(slug);
  const rendered = renderFilm(slug);
  const verdict = runGate(slug);
  if (!verdict.pass) return { rendered: rendered.path, standIn: rendered.standIn, verdict, delivered: null };

  const outDir = path.join(workdir, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const delivered = path.join(outDir, 'intro.mp4');
  fs.copyFileSync(rendered.path, delivered);
  return { rendered: rendered.path, standIn: rendered.standIn, verdict, delivered };
}

// pathToFileURL, not `file://${argv[1]}`: on Windows argv[1] is a backslash
// path, so naive string concatenation never matches import.meta.url.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
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
