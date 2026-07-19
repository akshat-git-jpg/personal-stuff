import { planCaptions } from '../captions.mjs';

export const TYPE = 'captions';
export const CONSTANTS = {
  CAP_MAX_WORDS: 6,
  CAP_MAX_CHARS: 32,
  CAP_GAP_SPLIT: 0.6,
  CAP_TAIL: 0.4,
  CAP_FONT_PX: 44,
  CAP_Y_FRAC: 0.87
};

export function plan(ctx) {
  return [{
    id: 'captions',
    type: TYPE,
    enabled: true,
    fontPx: CONSTANTS.CAP_FONT_PX,
    yFrac: CONSTANTS.CAP_Y_FRAC
  }];
}

import fs from 'node:fs';

export function contribute(seg, instances, ctx) {
  if (seg.kind !== 'screen') return null;
  const instance = instances[0];
  if (!instance) return null;
  
  const { capDir, capChunks } = ctx;
  if (!capDir || !capChunks || capChunks.length === 0) return null;

  const assFile = `${capDir}/seg-${seg.id}.ass`;
  if (!fs.existsSync(assFile)) return null;

  const escapedAssPath = assFile.replace(/:/g, '\\:').replace(/'/g, "'\\''");

  return {
    vfSuffix: `,subtitles=filename='${escapedAssPath}'`
  };
}
