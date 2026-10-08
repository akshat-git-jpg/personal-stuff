// 060: encode each moment's composition to an mp4 in the media folder, then prove it is usable.
import fs from 'node:fs';
import path from 'node:path';
import { workdirOf, mediaDirOf, writeJson } from './paths.mjs';
import { readRunConfig, canvasOf } from './run-config.mjs';
import { loadMoments } from './author-moments.mjs';
import { renderComposition, frameLuma } from './kit.mjs';
import { probeDuration } from './media.mjs';
import { restoreAssets } from './assets.mjs';

export const momentClip = (slug, id) => path.join(mediaDirOf(slug), 'moments', `${id}.mp4`);

const newestMtime = (dir) => fs.readdirSync(dir, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile()).reduce((t, e) => Math.max(t, fs.statSync(path.join(e.parentPath ?? e.path, e.name)).mtimeMs), 0);

// A render newer than every file of its composition is reused.
export function isFresh(dir, clip) {
  return fs.existsSync(clip) && fs.statSync(clip).mtimeMs > newestMtime(dir);
}

export function renderMoments(slug, { only = null, force = false } = {}) {
  const workdir = workdirOf(slug);
  const canvas = canvasOf(readRunConfig(workdir));
  const out = {};
  for (const m of loadMoments(slug).filter((x) => !only || only.includes(x.id))) {
    const dir = path.join(workdir, 'moments', m.id);
    if (!fs.existsSync(path.join(dir, 'index.html'))) throw new Error(`moment ${m.id} has no composition: run author-moments (040)`);
    const unknown = restoreAssets(dir);
    if (unknown.length) throw new Error(`moment ${m.id} names assets that are neither in assets/ nor a registry logo: ${unknown.join(', ')}`);
    const clip = momentClip(slug, m.id);
    fs.mkdirSync(path.dirname(clip), { recursive: true });
    if (force || !isFresh(dir, clip)) {
      console.log(`060 ${m.id}: rendering ${m.duration}s`);
      renderComposition(dir, clip, { fps: canvas.fps });
    } else console.log(`060 ${m.id}: up to date`);
    const got = probeDuration(clip);
    const luma = frameLuma(clip);
    const problems = [];
    if (Math.abs(got - m.duration) > 2 / canvas.fps + 0.02) problems.push(`rendered ${got.toFixed(3)}s, the moment is ${m.duration}s`);
    if (luma.length && Math.max(...luma) < 4) problems.push('every frame is black');
    out[m.id] = { clip, seconds: +got.toFixed(3), problems };
    if (problems.length) console.error(`060 ${m.id}: ${problems.join('; ')}`);
  }
  writeJson(path.join(mediaDirOf(slug), 'moments', 'renders.json'), out);
  return out;
}
