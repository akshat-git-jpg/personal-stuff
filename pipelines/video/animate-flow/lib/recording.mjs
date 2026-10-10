// The screen recording is the stage: a frame of it at any time, and where it moves during a moment.
import fs from 'node:fs';
import path from 'node:path';
import { mediaDirOf, readJson, writeJson } from './paths.mjs';
import { ffmpeg } from './media.mjs';
import { motionMap } from './kit.mjs';

export const screenOf = (slug, cfg) => (cfg.source.screen ? path.join(mediaDirOf(slug), cfg.source.screen) : null);

// One frame of the recording at master time t (a flat frame in `colour` when there is no recording).
export function recordingFrame(slug, cfg, t, out, { w = 1920, h = 1080, colour = '#000000' } = {}) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const screen = screenOf(slug, cfg);
  if (screen) ffmpeg(['-ss', String(Math.max(0, t)), '-i', screen, '-frames:v', '1', '-vf', `scale=${w}:${h}`, out], 'recording frame');
  else ffmpeg(['-f', 'lavfi', '-i', `color=c=${colour.replace('#', '0x')}:s=${w}x${h}`, '-frames:v', '1', out], 'flat frame');
  return out;
}

// Where the recording moves during [start, end), as busy grid cells and their box (fractions). Cached per span.
export function busyRegion(slug, cfg, m) {
  const screen = screenOf(slug, cfg);
  if (!screen) return null;
  const cache = path.join(mediaDirOf(slug), 'motion', `${m.id}.json`);
  if (fs.existsSync(cache)) {
    const c = readJson(cache);
    if (c.start === m.start && c.end === m.end && c.mtime === fs.statSync(screen).mtimeMs) return c.map;
  }
  const map = motionMap(screen, { from: m.start, to: m.end });
  writeJson(cache, { start: m.start, end: m.end, mtime: fs.statSync(screen).mtimeMs, map });
  return map;
}

// The busy region in words, for a prompt.
export function describeBusy(map) {
  if (!map?.box) return 'The recording barely moves during this moment: no region of it needs protecting.';
  const p = (f) => `${Math.round(f * 100)}%`;
  return `The recording moves most in x ${p(map.box.x0)}-${p(map.box.x1)}, y ${p(map.box.y0)}-${p(map.box.y1)} of the frame (from the left and the top). That is what the voice is pointing at.`;
}
