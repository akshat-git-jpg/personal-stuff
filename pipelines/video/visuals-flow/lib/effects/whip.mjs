export const TYPE = 'whip';
export const CONSTANTS = { TRANSITION_DUR: 0.2, WHIP_SIGMAS: [10, 24], WHIP_ZOOM: 0.12 };

export function plan(ctx) {
  const { segments, overlays } = ctx;
  const duration = CONSTANTS.TRANSITION_DUR;
  const half = duration / 2;
  const out = [];
  for (let i = 0; i < segments.length - 1; i++) {
    const a = segments[i], b = segments[i + 1];
    const pair = `${a.kind}>${b.kind}`;
    if (pair !== 'screen>avatar' && pair !== 'avatar>screen') continue;
    if (a.end - a.start < 1.0 || b.end - b.start < 1.0) continue;
    const at = a.end;
    if (overlays.some((o) => o.start < at + half && o.end > at - half)) continue;
    
    out.push({
      id: `whip-${at.toFixed(1)}`,
      type: TYPE,
      at,
      direction: pair === 'screen>avatar' ? 'left' : 'right',
      fromIdx: i,
      toIdx: i + 1,
      enabled: true
    });
  }
  return out;
}

export function boundarySegments(instance, ctx) {
  const { segments, avatarJobs, screen, screenOffset, w, h, VF } = ctx;
  const half = CONSTANTS.TRANSITION_DUR / 2;
  const b = instance.at;
  
  const toIdx = segments.findIndex(s => Math.abs(s.start - b) < 0.01);
  const fromIdx = toIdx - 1;
  const fromSeg = segments[fromIdx];
  const toSeg = segments[toIdx];
  
  let sliceA, sliceB;
  if (fromSeg.kind === 'screen') {
    sliceA = ['-ss', String(b - half + screenOffset), '-to', String(b + screenOffset), '-i', screen];
  } else {
    const j = avatarJobs.find(j => j.id === fromSeg.id);
    const sourceStartA = Math.max(0, b - half - j.start);
    const sourceEndA = Math.max(0, b - j.start);
    sliceA = ['-ss', String(sourceStartA), '-to', String(sourceEndA), '-i', j.file];
  }
  if (toSeg.kind === 'screen') {
    sliceB = ['-ss', String(b + screenOffset), '-to', String(b + half + screenOffset), '-i', screen];
  } else {
    const j = avatarJobs.find(j => j.id === toSeg.id);
    const sourceStartB = Math.max(0, b - j.start);
    sliceB = ['-ss', String(sourceStartB), '-to', String(sourceStartB + half), '-i', j.file];
  }

  const chainOut =
    `[0:v]${VF},tpad=stop_mode=clone:stop_duration=1,` +
    `gblur=sigma=${CONSTANTS.WHIP_SIGMAS[0]}:sigmaV=1:enable='gte(t,0.032)',` +
    `gblur=sigma=${CONSTANTS.WHIP_SIGMAS[1]}:sigmaV=1:enable='gte(t,0.065)',` +
    `crop=w='iw-iw*${CONSTANTS.WHIP_ZOOM}*min(t/0.1,1)':h='ih-ih*${CONSTANTS.WHIP_ZOOM}*min(t/0.1,1)',` +
    `scale=${w}:${h},setsar=1[v]`;

  const chainIn =
    `[0:v]${VF},tpad=stop_mode=clone:stop_duration=1,` +
    `gblur=sigma=${CONSTANTS.WHIP_SIGMAS[1]}:sigmaV=1:enable='lt(t,0.035)',` +
    `gblur=sigma=${CONSTANTS.WHIP_SIGMAS[0]}:sigmaV=1:enable='lt(t,0.068)',` +
    `crop=w='iw-iw*${CONSTANTS.WHIP_ZOOM}*max(1-t/0.1,0)':h='ih-ih*${CONSTANTS.WHIP_ZOOM}*max(1-t/0.1,0)',` +
    `scale=${w}:${h},setsar=1[v]`;

  return {
    extraSegments: [
      { fileTag: `trans-${fromSeg.id}-out`, sliceArgs: sliceA, chain: chainOut, dur: half },
      { fileTag: `trans-${toSeg.id}-in`, sliceArgs: sliceB, chain: chainIn, dur: half }
    ]
  };
}
