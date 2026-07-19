export const TYPE = 'bubble';
export const CONSTANTS = {
  BUBBLE_D_1080: 150,
  BUBBLE_INSET_1080: 40,
  RING_PX_1080: 3,
  RING_COLOR: '#FB923C',
  RING_COLOR_HI: '#FFE3C2',
  RING_SPIN_PERIOD: 4,
  RING_SPIN_SHARP: 2,
  GLOW_SIGMA: 6
};

function hexToRgb(hex) {
  const s = hex.replace('#', '');
  return [
    parseInt(s.slice(0, 2), 16),
    parseInt(s.slice(2, 4), 16),
    parseInt(s.slice(4, 6), 16)
  ];
}

// Geometry of the corner bubble, derived from the canvas height so the look is
// identical at 720p (draft) and 1080p (final). All values are integers.
export function bubbleGeometry(w, h) {
  const D = Math.round(h * CONSTANTS.BUBBLE_D_1080 / 1080);
  const R = Math.round(D / 2);
  const RING = Math.max(1, Math.round(h * CONSTANTS.RING_PX_1080 / 1080));
  const INSET = Math.round(h * CONSTANTS.BUBBLE_INSET_1080 / 1080);
  const [rr, gg, bb] = hexToRgb(CONSTANTS.RING_COLOR);
  const [hr, hg, hb] = hexToRgb(CONSTANTS.RING_COLOR_HI);
  return { D, R, RING, INSET, rr, gg, bb, hr, hg, hb, OX: w - INSET - D, OY: INSET, GLOW: CONSTANTS.GLOW_SIGMA };
}

// Slice each overlapping corner chunk to the part of it that overlaps this
// segment's visible content ([seg.start + startTrim, seg.end - endTrim]).
// Segment-local at/until use the SAME arithmetic as captions.mjs.
export function bubbleSlices(seg, cornerJobs, ctx) {
  const startTrim = ctx.startTrim || 0;
  const endTrim = ctx.endTrim || 0;
  const contentStart = seg.start + startTrim;
  const contentEnd = seg.end - endTrim;
  const slices = [];
  for (const j of cornerJobs) {
    if (!j.file) continue;
    if (!(j.start < contentEnd && j.end > contentStart)) continue;
    const oStart = Math.max(j.start, contentStart);
    const oEnd = Math.min(j.end, contentEnd);
    const overlapDur = +(oEnd - oStart).toFixed(3);
    if (overlapDur <= 0.01) continue;
    slices.push({
      file: j.file,
      sliceStart: +(oStart - j.start).toFixed(3),
      overlapDur,
      at: +Math.max(0, oStart - contentStart).toFixed(3),
      until: +(oEnd - contentStart).toFixed(3)
    });
  }
  return slices;
}

export function plan(ctx) {
  return [{ id: 'bubble', type: TYPE, enabled: true }];
}

export function contribute(seg, instances, ctx) {
  if (seg.kind !== 'screen') return null;
  const instance = instances[0];
  if (!instance) return null;

  const cornerJobs = (ctx.cornerJobs || []).filter(j => j.file);
  if (cornerJobs.length === 0) return null;

  const slices = bubbleSlices(seg, cornerJobs, ctx);
  if (slices.length === 0) return null;

  const { D, R, RING, INSET, rr, gg, bb, hr, hg, hb, OX, OY, GLOW } = bubbleGeometry(ctx.w, ctx.h);

  const inputs = [];
  for (const s of slices) {
    inputs.push('-ss', String(s.sliceStart), '-t', String(s.overlapDur), '-i', s.file);
  }

  const PHASE = +(seg.start + (ctx.startTrim || 0)).toFixed(3);
  const P = CONSTANTS.RING_SPIN_PERIOD;
  const K = CONSTANTS.RING_SPIN_SHARP;

  return {
    inputs,
    chainFragments: [
      (lastV, state) => {
        let chain = '';
        let nextV = lastV;
        const th = `(2*PI*(T+${PHASE})/${P})`;
        const wgt = `pow(0.5*(1+((X-${R})*cos(${th})+(Y-${R})*sin(${th}))/max(hypot(X-${R},Y-${R}),1)),${K})`;
        const mix = (base, hi) => `'${base}+(${hi}-${base})*${wgt}'`;
        for (let j = 0; j < slices.length; j++) {
          const s = slices[j];
          const idx = state.inputOffset + j;
          const bub = `bub_${j}`;
          const ring = `bring_${j}`;
          const bubr = `bubr_${j}`;
          nextV = `bb_${j}`;
          // format=rgba before every geq: alpha math must run in RGB space, never
          // yuv (the pink-flash lesson). Circle alpha masks the square crop; a
          // separate orange ring+glow is composited on top.
          chain += `[${idx}:v]setpts=PTS-STARTPTS,scale=${D}:${D}:force_original_aspect_ratio=increase,crop=${D}:${D},format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte(hypot(X-${R},Y-${R}),${R}-1),255,0)'[${bub}];`;
          chain += `color=c=0x00000000:s=${D}x${D},format=rgba,geq=r=${mix(rr, hr)}:g=${mix(gg, hg)}:b=${mix(bb, hb)}:a='if(between(hypot(X-${R},Y-${R}),${R}-${RING}-1,${R}+1),255,0)',gblur=sigma=${GLOW}:steps=2[${ring}];`;
          chain += `[${bub}][${ring}]overlay=0:0,setpts=PTS-STARTPTS+${s.at.toFixed(3)}/TB[${bubr}];`;
          chain += `[${lastV}][${bubr}]overlay=${OX}:${OY}:enable='between(t,${s.at.toFixed(3)},${s.until.toFixed(3)})'[${nextV}];`;
          lastV = nextV;
        }
        return { chain, nextV };
      }
    ]
  };
}
