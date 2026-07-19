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

export function contribute(seg, instances, ctx) {
  if (seg.kind !== 'screen') return null;
  const instance = instances[0];
  if (!instance) return null;
  
  const { capDir, capChunks, startTrim } = ctx;
  if (!capDir || !capChunks || capChunks.length === 0) return null;

  const segCaps = [];
  for (const c of capChunks) {
    const cAt = c.start - seg.start - (startTrim || 0);
    const cUntil = c.end - seg.start - (startTrim || 0);
    if (cUntil > 0 && cAt < ctx.dur) {
      const f = `${capDir}/cap-${c.i}.png`;
      // We assume it exists based on previous rendering
      segCaps.push({ file: f, at: Math.max(0, cAt), until: cUntil });
    }
  }
  if (segCaps.length === 0) return null;

  const inputs = [];
  for (const c of segCaps) {
    inputs.push('-loop', '1', '-i', c.file);
  }

  const h = ctx.h;
  const yFrac = instance.yFrac !== undefined ? instance.yFrac : CONSTANTS.CAP_Y_FRAC;

  return {
    inputs,
    chainFragments: [
      (lastV, state) => {
        let chain = '';
        let nextV = lastV;
        for (let j = 0; j < segCaps.length; j++) {
          const c = segCaps[j];
          const inputIdx = state.inputOffset + j;
          nextV = `b_cap_${j}`;
          chain += `[${lastV}][${inputIdx}:v]overlay=(main_w-overlay_w)/2:${Math.round(h * yFrac)}-overlay_h:enable='between(t,${c.at.toFixed(3)},${c.until.toFixed(3)})'[${nextV}];`;
          lastV = nextV;
        }
        return { chain, nextV };
      }
    ]
  };
}
