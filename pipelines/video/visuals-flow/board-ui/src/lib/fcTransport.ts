export const FC_FPS = 30;

export function fmtClock(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

// mm:ss:ff — the current-time readout carries FRAMES. Without them a frame
// step moves the clock 1/30s, mm:ss does not change, the scrubber moves
// 0.01% of its width, and the button reads as broken even though it fired
// correctly (owner report 2026-07-25).
// Counted in WHOLE FRAMES, not seconds-plus-a-fraction: 5 + 1/30 is
// 5.0333333, and (5.0333333 - 5) * 30 floors to 0, so two consecutive
// frames would both read ":00" and stepping would still look stuck.
export function fmtClockFrames(t: number): string {
  const total = Math.round(t * FC_FPS);
  const m = Math.floor(total / (60 * FC_FPS));
  const s = Math.floor(total / FC_FPS) % 60;
  const f = total % FC_FPS;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + ':' + String(f).padStart(2, '0');
}

export function clampSeek(t: number, dur: number, delta: number): number {
  return Math.max(0, Math.min(dur || 0, t + delta));
}

export function frameStep(t: number, dir: number, fps: number): number {
  return clampSeek(t, Infinity, dir / fps);
}
