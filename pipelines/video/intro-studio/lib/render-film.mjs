import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveWorkdir } from './workdir.mjs';
import { probeDuration } from './intake.mjs';

const HYPERFRAMES = process.env.HYPERFRAMES_VERSION ? `hyperframes@${process.env.HYPERFRAMES_VERSION}` : 'hyperframes@0.7.62';

export function renderArgs(filmDir, outFile) {
  return ['-y', HYPERFRAMES, 'render', filmDir, '--output', outFile];
}

export function renderFilm(slug) {
  const workdir = resolveWorkdir(slug);
  const filmDir = path.join(workdir, 'film');
  const index = path.join(filmDir, 'index.html');
  if (!fs.existsSync(index)) throw new Error(`missing ${index} — run the author step first`);
  const outDir = path.join(workdir, 'renders');
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, 'intro-film.mp4');
  const r = spawnSync('npx', renderArgs(filmDir, out), { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`hyperframes render failed (exit ${r.status})`);
  if (!fs.existsSync(out) || fs.statSync(out).size === 0) throw new Error('render produced no output');
  return { file: out, duration: probeDuration(out) };
}
