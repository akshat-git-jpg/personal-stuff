// 060: encode each moment's compositions (one per format) to mp4s in the media folder, then prove they are usable.
// An overlay renders on a key-green plate that 070 keys out, the way the kit composites overlay clips.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { workdirOf, mediaDirOf, writeJson } from './paths.mjs';
import { readRunConfig, canvasOf, formatsOf } from './run-config.mjs';
import { loadMoments } from './author-moments.mjs';
import { renderComposition, frameLuma } from './kit.mjs';
import { probeDuration } from './media.mjs';
import { restoreAssets } from './assets.mjs';
import { MAIN_FORMAT, FORMATS, formatDirName } from './formats.mjs';

export const OVERLAY_KEY = '0x00FF00';
const KEY_CSS = '<style>html,body,#root{background:#00ff00 !important}</style>';

export const momentClip = (slug, id, format = MAIN_FORMAT) => path.join(mediaDirOf(slug), 'moments', `${id}${FORMATS[format].suffix}.mp4`);

const newestMtime = (dir) => fs.readdirSync(dir, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile()).reduce((t, e) => Math.max(t, fs.statSync(path.join(e.parentPath ?? e.path, e.name)).mtimeMs), 0);

// A render newer than every file of its composition is reused.
export function isFresh(dir, clip) {
  return fs.existsSync(clip) && fs.statSync(clip).mtimeMs > newestMtime(dir);
}

// The overlay's page on the key plate, in a scratch copy so the committed composition stays transparent.
export function keyedCopy(dir) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'animate-key-'));
  fs.cpSync(dir, tmp, { recursive: true });
  const html = path.join(tmp, 'index.html');
  fs.writeFileSync(html, fs.readFileSync(html, 'utf8').replace(/<\/head>/i, `${KEY_CSS}</head>`));
  return tmp;
}

export function renderMoments(slug, { only = null, force = false } = {}) {
  const workdir = workdirOf(slug);
  const cfg = readRunConfig(workdir);
  const canvas = canvasOf(cfg);
  const out = {};
  for (const m of loadMoments(slug).filter((x) => !only || only.includes(x.id))) {
    for (const format of formatsOf(cfg)) {
      const key = formatDirName(m.id, format);
      const dir = path.join(workdir, 'moments', key);
      if (!fs.existsSync(path.join(dir, 'index.html'))) throw new Error(`moment ${key} has no composition: run author-moments (040)`);
      const unknown = restoreAssets(dir);
      if (unknown.length) throw new Error(`moment ${key} names assets that are neither in assets/ nor a registry logo: ${unknown.join(', ')}`);
      const clip = momentClip(slug, m.id, format);
      fs.mkdirSync(path.dirname(clip), { recursive: true });
      if (force || !isFresh(dir, clip)) {
        console.log(`060 ${key}: rendering ${m.duration}s${m.kind === 'overlay' ? ' on the key plate' : ''}`);
        const src = m.kind === 'overlay' ? keyedCopy(dir) : dir;
        try { renderComposition(src, clip, { fps: canvas.fps }); } finally { if (src !== dir) fs.rmSync(src, { recursive: true, force: true }); }
      } else console.log(`060 ${key}: up to date`);
      const got = probeDuration(clip);
      const luma = frameLuma(clip);
      const problems = [];
      if (Math.abs(got - m.duration) > 2 / canvas.fps + 0.02) problems.push(`rendered ${got.toFixed(3)}s, the moment is ${m.duration}s`);
      if (luma.length && Math.max(...luma) < 4) problems.push('every frame is black');
      out[key] = { clip, kind: m.kind ?? 'takeover', format, seconds: +got.toFixed(3), problems };
      if (problems.length) console.error(`060 ${key}: ${problems.join('; ')}`);
    }
  }
  writeJson(path.join(mediaDirOf(slug), 'moments', 'renders.json'), out);
  return out;
}
