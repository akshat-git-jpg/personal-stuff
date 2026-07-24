export const TYPE = 'whip';
export const CONSTANTS = {
  TRANSITION_DUR: 0.2,
  WHIP_SIGMAS: [10, 24],
  WHIP_ZOOM: 0.12,
  FLASH_COLOR: { r: 1.25, g: 1.08, b: 0.85 },
  FLASH_GAIN: 0.85
};

export function plan(ctx) {
  const { segments, overlays } = ctx;
  const duration = CONSTANTS.TRANSITION_DUR;
  const half = duration / 2;
  const out = [];
  for (let i = 0; i < segments.length - 1; i++) {
    const a = segments[i], b = segments[i + 1];
    const pair = `${a.kind}>${b.kind}`;
    const isWhip = pair === 'avatar>screen';
    const isFlash = pair === 'screen>graphic' || pair === 'avatar>graphic';
    if (!isWhip && !isFlash) continue;
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
      style: isFlash ? 'flash' : 'blur',
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
  } else if (fromSeg.kind === 'avatar') {
    const j = avatarJobs.find(j => j.id === fromSeg.id);
    const sourceStartA = Math.max(0, b - half - j.start);
    const sourceEndA = Math.max(0, b - j.start);
    sliceA = ['-ss', String(sourceStartA), '-to', String(sourceEndA), '-i', j.file];
  } else {
    const cue = ctx.resolved.find(c => c.id === fromSeg.id);
    const gFile = ctx.graphicFile(cue);
    const sourceStartA = Math.max(0, b - half - fromSeg.start);
    const sourceEndA = Math.max(0, b - fromSeg.start);
    sliceA = ['-ss', String(sourceStartA), '-to', String(sourceEndA), '-i', gFile];
  }

  if (toSeg.kind === 'screen') {
    sliceB = ['-ss', String(b + screenOffset), '-to', String(b + half + screenOffset), '-i', screen];
  } else if (toSeg.kind === 'avatar') {
    const j = avatarJobs.find(j => j.id === toSeg.id);
    const sourceStartB = Math.max(0, b - j.start);
    sliceB = ['-ss', String(sourceStartB), '-to', String(sourceStartB + half), '-i', j.file];
  } else {
    const cue = ctx.resolved.find(c => c.id === toSeg.id);
    const gFile = ctx.graphicFile(cue);
    const sourceStart = Math.max(0, b - toSeg.start);
    sliceB = ['-ss', String(sourceStart), '-to', String(sourceStart + half), '-i', gFile];
  }

  const { FLASH_GAIN: G, FLASH_COLOR: C } = CONSTANTS;
  const up = `min(t/0.1,1)`, down = `max(1-t/0.1,0)`;
  const chainOutFlash =
    `[0:v]${VF},tpad=stop_mode=clone:stop_duration=1,` +
    `gblur=sigma=20:sigmaV=6:enable='gte(t,0.033)',` +
    `gblur=sigma=40:sigmaV=12:enable='gte(t,0.066)',` +
    `colorchannelmixer=rr=${C.r}:gg=${C.g}:bb=${C.b}:enable='gte(t,0.03)',` +
    `eq=brightness='${G}*${up}':eval=frame,scale=${w}:${h},setsar=1[v]`;
  const chainInFlash =
    `[0:v]${VF},tpad=stop_mode=clone:stop_duration=1,` +
    `gblur=sigma=40:sigmaV=12:enable='lt(t,0.033)',` +
    `gblur=sigma=20:sigmaV=6:enable='lt(t,0.066)',` +
    `colorchannelmixer=rr=${C.r}:gg=${C.g}:bb=${C.b}:enable='lt(t,0.07)',` +
    `eq=brightness='${G}*${down}':eval=frame,scale=${w}:${h},setsar=1[v]`;

  const isFlash = instance.style === 'flash';

  const chainOut = isFlash ? chainOutFlash :
    `[0:v]${VF},tpad=stop_mode=clone:stop_duration=1,` +
    `gblur=sigma=${CONSTANTS.WHIP_SIGMAS[0]}:sigmaV=1:enable='gte(t,0.032)',` +
    `gblur=sigma=${CONSTANTS.WHIP_SIGMAS[1]}:sigmaV=1:enable='gte(t,0.065)',` +
    `crop=w='iw-iw*${CONSTANTS.WHIP_ZOOM}*min(t/0.1,1)':h='ih-ih*${CONSTANTS.WHIP_ZOOM}*min(t/0.1,1)',` +
    `scale=${w}:${h},setsar=1[v]`;

  const chainIn = isFlash ? chainInFlash :
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
