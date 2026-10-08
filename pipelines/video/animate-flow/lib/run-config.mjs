// run-config.json: the one file that says a workdir belongs to this recipe.
import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJson, isSlug } from './paths.mjs';

export const RECIPE = 'animate';
export const DEFAULT_MODELS = Object.freeze({ plan: 'opus', author: 'opus' });

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
