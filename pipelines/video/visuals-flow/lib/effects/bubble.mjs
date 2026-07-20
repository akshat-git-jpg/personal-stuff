export const TYPE = 'bubble';
// Sizing is measured off the reference (references/vPqSgj8Ta3Y.md): the bubble
// is ~28% of frame height and hugs the corner. The doc's "~120px" was measured
// on a ~480-tall frame, not at 1080 — reading it as a 1080 value made the
// bubble half the size it should be.
// The ring is TWO independent things, measured off a high-zoom reference still
// (2026-07-20, circle d=432px) by taking radial profiles at the gleam angle and
// away from it — they are different SHAPES, not the same band at two
// brightnesses:
//   away from the gleam: sharp spike, ~5px FWHM, and NO halo at all
//   at the gleam:        blown-white plateau, ~12px FWHM, reaching ~22px
// So: a thin constant hairline circle, plus a THICK soft bloom arc travelling
// around it. Modelling the gleam as a colour shift inside a fixed-width ring
// (the 2026-07-20 first attempt) cannot produce this — the arc has to be its
// own wider, softer, angularly-masked layer.
export const CONSTANTS = {
  BUBBLE_D_1080: 300,
  BUBBLE_INSET_1080: 24,
  // Base hairline: 5px FWHM on d=432 => 1.16% of D => ~3.5px at D=300. Band
  // widths below are EXACT (centred on R); the old `R-RING-1 .. R+1` form was
  // RING+2 wide, which at draft resolution made the hairline 2.3x too thick and
  // collapsed the gleam/hairline width contrast to 1.19x (reference: 2.40x).
  RING_PX_1080: 3.5,
  RING_COLOR: '#FB923C',
  CORE_SIGMA_1080: 1,
  // Travelling bloom: 12px FWHM on d=432 => 2.78% of D => ~8.3px at D=300,
  // reached as band+blur combined, not band alone.
  GLEAM_PX_1080: 8.5,
  GLEAM_COLOR: '#FFF7ED',
  GLEAM_SIGMA_1080: 4.3,
  RING_SPIN_PERIOD: 4,
  RING_SPIN_SHARP: 8,
  RING_SPIN_BOOST: 2.5,
  // Avatar framing inside the circle. The reference is a head-and-shoulders
  // crop (head ~73% of the circle diameter); fitting the full source height
  // gives ~58% and leaves a band of torso at the bottom. Focus point is a
  // fraction of the SOURCE frame, tuned on the specs-man template — retune per
  // template if a future avatar sits differently in frame.
  AVATAR_ZOOM: 1.3,
  AVATAR_FOCUS_X: 0.445,
  AVATAR_FOCUS_Y: 0.389
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
  // Ring/blur widths stay FRACTIONAL. Rounding them to whole pixels inflates
  // the draft (720p) disproportionately — a 1px rounding on a 2px hairline is a
  // 50% error — and the 720p draft is what gets eyeballed.
  const RING = +Math.max(1, h * CONSTANTS.RING_PX_1080 / 1080).toFixed(2);
  const INSET = Math.round(h * CONSTANTS.BUBBLE_INSET_1080 / 1080);
  const GW = +Math.max(1, h * CONSTANTS.GLEAM_PX_1080 / 1080).toFixed(2);
  const GSIG = +Math.max(0.5, h * CONSTANTS.GLEAM_SIGMA_1080 / 1080).toFixed(2);
  // The canvas must be BIGGER than the circle. Drawn at exactly DxD the ring
  // sits on the canvas edge and gblur is clipped by it, which reads as a
  // hard-edged rectangle around the bubble. Clear the gleam's half-width plus
  // the gaussian's practical reach (3 sigma), plus a cushion.
  const PAD = Math.ceil(GW / 2 + 3 * GSIG) + 2;
  const S = D + 2 * PAD;
  const C = Math.round(S / 2);
  // Anti-alias only — the base hairline carries no halo of its own.
  const CORE = +Math.max(0.4, h * CONSTANTS.CORE_SIGMA_1080 / 1080).toFixed(2);
  // Band edges, centred on R so each band is EXACTLY its nominal width.
  const RIN = +(R - RING / 2).toFixed(2), ROUT = +(R + RING / 2).toFixed(2);
  const GIN = +(R - GW / 2).toFixed(2), GOUT = +(R + GW / 2).toFixed(2);
  const DZ = Math.round(D * CONSTANTS.AVATAR_ZOOM / 2) * 2;
  const [rr, gg, bb] = hexToRgb(CONSTANTS.RING_COLOR);
  const [hr, hg, hb] = hexToRgb(CONSTANTS.GLEAM_COLOR);
  return { D, R, RING, INSET, rr, gg, bb, hr, hg, hb, OX: w - INSET - D, OY: INSET, GW, GSIG, PAD, S, C, CORE, DZ, RIN, ROUT, GIN, GOUT };
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

  const { D, R, RING, INSET, rr, gg, bb, hr, hg, hb, OX, OY, GW, GSIG, PAD, S, C, CORE, DZ, RIN, ROUT, GIN, GOUT } = bubbleGeometry(ctx.w, ctx.h);

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
        // Arc geometry is relative to the PADDED canvas centre, not the circle.
        // The BOOST + clamp give the gleam a flat top before it falls away, so
        // it reads as a localised bloom (~+/-40deg) rather than a gradient
        // sweeping half the circumference. wgt drives the gleam's ALPHA, so the
        // arc fades out where it ends instead of merely changing colour.
        const cosA = `((X-${C})*cos(${th})+(Y-${C})*sin(${th}))/max(hypot(X-${C},Y-${C}),1)`;
        const wgt = `min(1,pow(0.5*(1+${cosA}),${K})*${CONSTANTS.RING_SPIN_BOOST})`;
        for (let j = 0; j < slices.length; j++) {
          const s = slices[j];
          const idx = state.inputOffset + j;
          const bub = `bub_${j}`;
          const ring = `bring_${j}`;
          const bubr = `bubr_${j}`;
          nextV = `bb_${j}`;
          // format=rgba before every geq: alpha math must run in RGB space, never
          // yuv (the pink-flash lesson). Circle alpha masks the square crop, then
          // pad centres it on the larger ring canvas; the ring+glow composites on
          // top and the whole thing lands offset by PAD so the circle itself
          // still sits at OX/OY.
          // Zoom + focus-point crop: scale the source taller than the circle,
          // then crop the circle out around the face instead of fitting the
          // whole frame height (which framed head + torso, not a portrait).
          chain += `[${idx}:v]setpts=PTS-STARTPTS,scale=-2:${DZ},crop=${D}:${D}:x='clip(iw*${CONSTANTS.AVATAR_FOCUS_X}-${R},0,iw-${D})':y='clip(ih*${CONSTANTS.AVATAR_FOCUS_Y}-${R},0,ih-${D})',format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte(hypot(X-${R},Y-${R}),${R}-1),255,0)',pad=${S}:${S}:${PAD}:${PAD}:color=0x00000000[${bub}];`;
          // Layer 1 — the hairline. Constant brand colour the whole way round,
          // uniform width, CORE blur for anti-aliasing only and NO halo: the
          // reference ring drops straight to background away from the gleam.
          // Explicit d= on the canvas: an unbounded color source keeps the graph
          // generating frames after the main input EOFs, which only stays
          // invisible because assemble.mjs caps each segment's output duration.
          chain += `color=c=0x00000000:s=${S}x${S}:d=${s.overlapDur},format=rgba,geq=r='${rr}':g='${gg}':b='${bb}':a='if(between(hypot(X-${C},Y-${C}),${RIN},${ROUT}),255,0)',gblur=sigma=${CORE}:steps=1[${ring}base];`;
          // Layer 2 — the travelling bloom. A WIDER band than the hairline,
          // near-white, its alpha shaped by wgt so the arc exists only where the
          // gleam is, then blurred soft. This width difference is the thing that
          // reads as "thick curved motion around a thin circle".
          chain += `color=c=0x00000000:s=${S}x${S}:d=${s.overlapDur},format=rgba,geq=r='${hr}':g='${hg}':b='${hb}':a='if(between(hypot(X-${C},Y-${C}),${GIN},${GOUT}),255*${wgt},0)',gblur=sigma=${GSIG}:steps=2[${ring}gleam];`;
          chain += `[${bub}][${ring}base]overlay=0:0[${ring}b];`;
          chain += `[${ring}b][${ring}gleam]overlay=0:0,setpts=PTS-STARTPTS+${s.at.toFixed(3)}/TB[${bubr}];`;
          chain += `[${lastV}][${bubr}]overlay=${OX - PAD}:${OY - PAD}:enable='between(t,${s.at.toFixed(3)},${s.until.toFixed(3)})'[${nextV}];`;
          lastV = nextV;
        }
        return { chain, nextV };
      }
    ]
  };
}
