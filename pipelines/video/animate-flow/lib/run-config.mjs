// run-config.json: the one file that says a workdir belongs to this recipe.
import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJson, isSlug } from './paths.mjs';
import { FORMATS, MAIN_FORMAT } from './formats.mjs';

export const RECIPE = 'animate';
export const DEFAULT_MODELS = Object.freeze({ plan: 'opus', storyboard: 'sonnet', author: 'opus' });
// Measured-check knobs (050). deadMax: longest stretch with no visible change, in seconds.
export const DEFAULT_REVIEW = Object.freeze({ deadMax: 4 });

export function runConfigErrors(cfg) {
  const errs = [];
  if (!cfg || typeof cfg !== 'object') return ['run-config.json must be an object'];
  if (cfg.template !== RECIPE) errs.push(`template must be "${RECIPE}" (got ${JSON.stringify(cfg.template)}): this workdir belongs to another recipe`);
  if (!isSlug(cfg.video)) errs.push('video must be the registry key');
  if (!isSlug(cfg.designSystem)) errs.push('designSystem must name a folder under pipelines/video/design-systems/');
  if (cfg.canvas !== undefined) {
    const { w, h, fps } = cfg.canvas ?? {};
    for (const [k, v] of Object.entries({ w, h })) if (v !== undefined && !(Number.isInteger(v) && v > 0 && v % 2 === 0)) errs.push(`canvas.${k} must be a positive even integer`);
    if (fps !== undefined && !(Number.isInteger(fps) && fps > 0)) errs.push('canvas.fps must be a positive integer');
  }
  if (cfg.formats !== undefined) {
    if (!Array.isArray(cfg.formats) || !cfg.formats.length) errs.push('formats must be a non-empty list, e.g. ["16:9", "9:16"]');
    else {
      for (const f of cfg.formats) if (!FORMATS[f]) errs.push(`formats: unknown format ${JSON.stringify(f)} (known: ${Object.keys(FORMATS).join(', ')})`);
      if (cfg.formats[0] !== MAIN_FORMAT) errs.push(`formats must start with the main format "${MAIN_FORMAT}"`);
    }
  }
  if (cfg.review !== undefined && !(Number.isFinite(cfg.review?.deadMax ?? 4) && (cfg.review?.deadMax ?? 4) > 0)) errs.push('review.deadMax must be a positive number of seconds');
  if (!cfg.source || typeof cfg.source.audio !== 'string') errs.push('source.audio is required (the voiceover file in the media folder)');
  if (cfg.source && cfg.source.screen !== null && typeof cfg.source.screen !== 'string') errs.push('source.screen must be a file name or null');
  return errs;
}

export function readRunConfig(workdir) {
  const p = path.join(workdir, 'run-config.json');
  if (!fs.existsSync(p)) throw new Error(`no run-config.json in ${workdir}: run intake (010) first`);
  const cfg = readJson(p);
  const errs = runConfigErrors(cfg);
  if (errs.length) throw new Error(`run-config.json is not an animate run:\n  ${errs.join('\n  ')}`);
  return cfg;
}

export function writeRunConfig(workdir, cfg) {
  const errs = runConfigErrors(cfg);
  if (errs.length) throw new Error(`refusing to write run-config.json:\n  ${errs.join('\n  ')}`);
  writeJson(path.join(workdir, 'run-config.json'), cfg);
}

export const canvasOf = (cfg) => ({ w: 1920, h: 1080, fps: 30, ...(cfg.canvas ?? {}) });
export const modelsOf = (cfg) => ({ ...DEFAULT_MODELS, ...(cfg.models ?? {}) });
export const reviewOf = (cfg) => ({ ...DEFAULT_REVIEW, ...(cfg.review ?? {}) });
// The formats this run lays out; the main one is always the run's canvas.
export const formatsOf = (cfg) => cfg.formats ?? [MAIN_FORMAT];
