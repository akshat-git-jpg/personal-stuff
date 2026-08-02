import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from './workdir.mjs';
import { probeDuration, probeDimensions, probeVideoDuration } from './intake.mjs';
import { frameLuma, detectFreezes, longestFreeze } from './frames.mjs';

export const GATE = {
  DURATION_TOLERANCE: 0.05,   // seconds — the render must match the intro to ~a frame
  MAX_FREEZE: 3.0,            // seconds — no stretch this long may sit motionless
  MIN_MEAN_LUMA: 4,           // below this the picture is effectively black
  MIN_LUMA_RANGE: 6,          // the whole film at one luma means nothing is happening
  WIDTH: 1920,                // the intro hands off to a landscape edit — a
  HEIGHT: 1080,               // portrait render is unusable no matter how good
};

// Pure so it is unit-testable without ffmpeg. Callers gather the measurements.
export function judge({ renderDuration, introDuration, luma, freezes, width, height }) {
  const failures = [];
  // Required, not optional — an unmeasured frame size must fail rather than skip.
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    failures.push('G5 no frame size measured');
  } else if (width !== GATE.WIDTH || height !== GATE.HEIGHT) {
    failures.push(`G5 render is ${width}x${height} — the intro must be ${GATE.WIDTH}x${GATE.HEIGHT}`);
  }
  if (Math.abs(renderDuration - introDuration) > GATE.DURATION_TOLERANCE) {
    failures.push(`G1 duration ${renderDuration.toFixed(2)}s != intro ${introDuration.toFixed(2)}s`);
  }
  const worst = longestFreeze(freezes);
  if (worst > GATE.MAX_FREEZE) failures.push(`G2 ${worst.toFixed(1)}s of frozen picture (max ${GATE.MAX_FREEZE}s)`);
  if (!luma.length) failures.push('G3 no frames measured');
  else {
    const mean = luma.reduce((a, b) => a + b, 0) / luma.length;
    if (mean < GATE.MIN_MEAN_LUMA) failures.push(`G3 mean luma ${mean.toFixed(1)} — the render is black`);
    const range = Math.max(...luma) - Math.min(...luma);
    if (range < GATE.MIN_LUMA_RANGE) failures.push(`G4 luma range ${range.toFixed(1)} — nothing changes across the film`);
  }
  return { pass: failures.length === 0, failures };
}

export function runGate(slug) {
  const workdir = resolveWorkdir(slug);
  const video = path.join(workdir, 'renders', 'intro-film.mp4');
  if (!fs.existsSync(video)) throw new Error(`missing ${video} — run the render step first`);
  const introDuration = JSON.parse(fs.readFileSync(path.join(workdir, 'intake.json'), 'utf8')).duration;
  const renderDuration = probeVideoDuration(video);
  const { width, height } = probeDimensions(video);
  return judge({ renderDuration, introDuration, luma: frameLuma(video), freezes: detectFreezes(video, renderDuration), width, height });
}
