export const TYPE = 'motif';

export function plan(ctx) {
  const motifs = ctx.resolved.filter(c => c.motif);
  if (motifs.length === 0) return [];
  
  const first = motifs[0];
  const last = motifs[motifs.length - 1];
  
  let start = first.start;
  if (first.variables && first.variables.beats && first.variables.beats.length > 0) {
    const minBeat = Math.min(...first.variables.beats.map(b => Number(b.at)));
    if (Number.isFinite(minBeat)) {
      start += minBeat;
    }
  }
  
  const end = last.start + last.duration;
  
  return [{
    id: 'motif-overlay',
    type: TYPE,
    start,
    end,
    enabled: true
  }];
}

export function contribute(seg, instances, ctx) {
  const inst = instances[0];
  if (!inst) return null;

  const PHASE = +(seg.start + (ctx.startTrim || 0)).toFixed(3);
  const segEndGlobal = seg.end;
  
  if (PHASE >= inst.end || segEndGlobal <= inst.start) {
    return null;
  }

  const { w, h, dur } = ctx;

  return {
    chainFragments: [
      (lastV, state) => {
        const motifInput = `motif_${state.idx}`;
        const nextV = `motif_out_${state.idx}`;
        let chain = `color=c=white:s=1x1:d=${dur},format=rgba,geq=r=255:g=255:b=255:a='255*0.03*clip(t+${PHASE}-${inst.start},0,1)*clip(${inst.end}-(t+${PHASE}),0,1)',scale=${w}:${h}[${motifInput}];`;
        chain += `[${lastV}][${motifInput}]overlay=0:0[${nextV}];`;
        
        state.idx++;
        
        return {
          nextV,
          chain
        };
      }
    ]
  };
}
