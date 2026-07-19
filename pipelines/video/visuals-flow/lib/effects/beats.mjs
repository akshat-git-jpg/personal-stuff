export const TYPE = 'beat';
export const CONSTANTS = {
  BEAT_INTERVAL: 20, BEAT_MIN_EDGE: 8, BEAT_SNAP_WINDOW: 3, BEAT_MIN_GAP: 0.25,
  FLASH_COLOR: '0xfb923c',
  FLASH_OUT_OPACITIES: [0.45, 0.75, 1.0],
  FLASH_IN_OPACITIES: [0.8, 0.5, 0.25],
  FLASH_BAND_OPACITIES: [0.35, 0.2, 0.1],
  PUNCH_SCALE: 1.08
};

export function plan(ctx) {
  const { segments, words, resolved } = ctx;
  const instances = [];
  const cueTimes = resolved.filter(c => c.placement === 'overlay').map(c => c.start);

  for (const seg of segments) {
    if (seg.kind !== 'avatar') continue;
    const gaps = [];
    for (let i = 0; i < words.length - 1; i++) {
      const g = words[i + 1].start - words[i].end;
      if (g >= CONSTANTS.BEAT_MIN_GAP) gaps.push(+((words[i].end + words[i + 1].start) / 2).toFixed(3));
    }
    const lo = seg.start + CONSTANTS.BEAT_MIN_EDGE;
    const hi = seg.end - CONSTANTS.BEAT_MIN_EDGE;
    const beatsForSeg = [];
    for (let t = seg.start + CONSTANTS.BEAT_INTERVAL; t <= hi; t += CONSTANTS.BEAT_INTERVAL) {
      let best = null;
      let cueFound = false;
      for (const c of cueTimes) {
        if (c < lo || c > hi || Math.abs(c - t) > CONSTANTS.BEAT_SNAP_WINDOW) continue;
        if (best === null || !cueFound || Math.abs(c - t) < Math.abs(best - t)) {
          best = c;
          cueFound = true;
        }
      }
      if (!cueFound) {
        for (const g of gaps) {
          if (g < lo || g > hi || Math.abs(g - t) > CONSTANTS.BEAT_SNAP_WINDOW) continue;
          if (best === null || Math.abs(g - t) < Math.abs(best - t)) best = g;
        }
      }
      if (best !== null && (beatsForSeg.length === 0 || best - beatsForSeg[beatsForSeg.length - 1] >= CONSTANTS.BEAT_INTERVAL / 2)) {
        beatsForSeg.push(best);
      }
    }
    for (const b of beatsForSeg) {
      instances.push({
        id: `beat-${b.toFixed(1)}`,
        type: TYPE,
        at: b,
        punch: CONSTANTS.PUNCH_SCALE,
        enabled: true
      });
    }
  }
  return instances;
}

export function transformSegments(segments, instances, ctx) {
  const out = [];
  for (const seg of segments) {
    if (seg.kind !== 'avatar') {
      out.push(seg);
      continue;
    }
    const segInstances = instances.filter(inst => inst.at > seg.start && inst.at < seg.end).sort((a, b) => a.at - b.at);
    if (segInstances.length === 0) {
      out.push(seg);
      continue;
    }

    let currentStart = seg.start;
    for (let i = 0; i <= segInstances.length; i++) {
      const isFirst = i === 0;
      const isLast = i === segInstances.length;
      const inst = isLast ? null : segInstances[i];
      const prevInst = isFirst ? null : segInstances[i - 1];
      
      const end = isLast ? seg.end : inst.at;
      
      const subSeg = {
        ...seg,
        sub: i,
        start: currentStart,
        end: end,
        punch: i % 2 === 1 ? (prevInst ? prevInst.punch : CONSTANTS.PUNCH_SCALE) : 1.0
      };
      
      if (!isLast) subSeg.flashOut = true;
      if (!isFirst) subSeg.flashIn = true;
      
      out.push(subSeg);
      currentStart = end;
    }
  }
  return out;
}

export function contribute(seg, instances, ctx) {
  let vfSuffix = '';
  if (seg.punch && seg.punch > 1.0) {
    vfSuffix = `,scale=trunc(iw*${seg.punch}/2)*2:-2,crop=${ctx.w}:${ctx.h}`;
  }

  const chainFragments = [];
  if (seg.flashIn || seg.flashOut) {
    chainFragments.push((lastV) => {
      let chain = '';
      const w = ctx.w, h = ctx.h;
      
      let numSplits = 0;
      if (seg.flashIn) numSplits += 6;
      if (seg.flashOut) numSplits += 3;
      
      chain += `gradients=s=${w}x${h}:c0=${CONSTANTS.FLASH_COLOR}:c1=0xffffff:x0=0:y0=${h}:x1=${w}:y1=0:speed=0.00001,format=gbrp[g];`;
      chain += `[g]split=${numSplits}`;
      const gNames = [];
      for (let i = 0; i < numSplits; i++) {
        gNames.push(`g${i+1}`);
        chain += `[${gNames[i]}]`;
      }
      chain += `;`;
      chain += `[${lastV}]format=gbrp[b_rgb];`;
      lastV = 'b_rgb';

      let splitIdx = 0;
      if (seg.flashIn) {
        const inTimes = [
          ['lt', '0.033'],
          ['between', '0.033', '0.066'],
          ['between', '0.066', '0.100']
        ];
        for (let i = 0; i < 3; i++) {
          const nextV = `b_fin_${i}`;
          const op = CONSTANTS.FLASH_IN_OPACITIES[i];
          const cond = inTimes[i][0] === 'lt' ? `lt(t,${inTimes[i][1]})` : `between(t,${inTimes[i][1]},${inTimes[i][2]})`;
          chain += `[${lastV}][${gNames[splitIdx++]}]blend=all_mode=screen:all_opacity=${op}:enable='${cond}'[${nextV}];`;
          lastV = nextV;
        }
        const bandTimes = [
          ['between', '0.100', '0.133'],
          ['between', '0.133', '0.166'],
          ['between', '0.166', '0.200']
        ];
        for (let i = 0; i < 3; i++) {
          const nextV = `b_fband_${i}`;
          const op = CONSTANTS.FLASH_BAND_OPACITIES[i];
          const cond = `between(t,${bandTimes[i][1]},${bandTimes[i][2]})`;
          chain += `[${lastV}][${gNames[splitIdx++]}]blend=all_mode=screen:all_opacity=${op}:enable='${cond}'[${nextV}];`;
          lastV = nextV;
        }
      }
      if (seg.flashOut) {
        const offsets = [0.100, 0.066, 0.033];
        const dur = ctx.dur;
        for (let i = 0; i < 3; i++) {
          const nextV = `b_fout_${i}`;
          const op = CONSTANTS.FLASH_OUT_OPACITIES[i];
          const tStart = Math.max(0, dur - offsets[i]).toFixed(3);
          chain += `[${lastV}][${gNames[splitIdx++]}]blend=all_mode=screen:all_opacity=${op}:enable='gte(t,${tStart})'[${nextV}];`;
          lastV = nextV;
        }
      }
      chain += `[${lastV}]format=yuv420p[b_fyuv];`;
      return { chain, nextV: 'b_fyuv' };
    });
  }

  if (!vfSuffix && chainFragments.length === 0) return null;
  return { vfSuffix, chainFragments };
}
