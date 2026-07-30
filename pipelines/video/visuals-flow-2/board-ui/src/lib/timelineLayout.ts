export function fitPxps(wrapWidth: number, total: number): number {
  return Math.min(30, Math.max(0.4, (wrapWidth - 90) / total));
}

export function blockRect(start: number, dur: number, pxps: number): { left: number; width: number } {
  return {
    left: start * pxps,
    width: Math.max(2, dur * pxps),
  };
}

export function fmtClock(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

export function rulerTicks(total: number, pxps: number): { t: number; label: string }[] {
  const step = Math.max(1, Math.round(80 / pxps));
  const ticks = [];
  for (let t = 0; t <= total; t += step) {
    ticks.push({ t, label: fmtClock(t) });
  }
  return ticks;
}

export function timeAtOffset(x: number, pxps: number): number {
  return x / pxps;
}
