export const TYPE = 'drift';
export const CONSTANTS = { DRIFT_MAX: 0.05, DRIFT_MIN_SEG: 4, DRIFT_PERIOD: 30 };

export function plan(ctx) {
  const instances = [];
  let screenOrdinal = 0;
  for (const seg of ctx.segments) {
    if (seg.kind === 'screen') {
      instances.push({
        id: `drift-${seg.id}`,
        type: TYPE,
        segId: seg.id,
        direction: screenOrdinal % 2 === 0 ? 'in' : 'out',
        start: seg.start,
        end: seg.end,
        enabled: true
      });
      screenOrdinal++;
    }
  }
  return instances;
}

export function contribute(seg, instances, ctx) {
  if (seg.kind !== 'screen') return null;
  const instance = instances.find(i => i.segId === seg.id);
  if (!instance) return null;

  if (ctx.dur < CONSTANTS.DRIFT_MIN_SEG) return null;

  const T = Math.min(ctx.dur, CONSTANTS.DRIFT_PERIOD).toFixed(3);
  const p = instance.direction === 'in'
    ? `${CONSTANTS.DRIFT_MAX}*min(t/${T},1)`
    : `${CONSTANTS.DRIFT_MAX}*max(1-t/${T},0)`;
  return {
    vfSuffix: `,scale=w='trunc(iw*(1+${p})/2)*2':h='trunc(ih*(1+${p})/2)*2':eval=frame,crop=${ctx.w}:${ctx.h},setsar=1`
  };
}
