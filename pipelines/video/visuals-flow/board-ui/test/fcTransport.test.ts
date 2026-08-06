import { describe, it, expect } from 'vitest';
import { fmtClock, fmtClockFrames, clampSeek, frameStep, FC_FPS } from '../src/lib/fcTransport';

describe('fcTransport', () => {
  it('fmtClock formats duration', () => {
    expect(fmtClock(0)).toBe('00:00');
    expect(fmtClock(61.5)).toBe('01:01');
  });

  it('fmtClockFrames counts whole frames properly', () => {
    expect(fmtClockFrames(0)).toBe('00:00.00');
    expect(fmtClockFrames(5)).toBe('00:05.00');
    // the exact bug the legacy comment documents
    expect(fmtClockFrames(5 + 1/30)).toBe('00:05.01');
    expect(fmtClockFrames(61 + 29/30)).toBe('01:01.29');
  });

  // The transport renders "<current> / <duration>" side by side. When current
  // was mm:ss:ff the pair read as "00:01:12 / 01:30" — parsed by a human as
  // "1m12s of 1m30s", 80% through — while actually meaning 1.4 SECONDS. The
  // owner scrubbed to what they believed was the end of a 90s film, landed on
  // the first beat, and reported a freshly rendered video as unchanged
  // (2026-08-06). The frame field must never look like a time field.
  it('current time cannot be misread as the mm:ss duration beside it', () => {
    const current = fmtClockFrames(1.4);     // 1.4s into the film
    const duration = fmtClock(90.7);         // a 90.7s film

    expect(current).toBe('00:01.12');
    expect(duration).toBe('01:30');
    expect(current).toMatch(/^\d{2}:\d{2}\.\d{2}$/);
    expect(duration).toMatch(/^\d{2}:\d{2}$/);
    // One colon in the current readout, so the trailing pair cannot read as
    // seconds-within-minutes the way a third colon did.
    expect((current.match(/:/g) ?? []).length).toBe(1);
  });

  it('clampSeek respects bounds', () => {
    expect(clampSeek(10, 100, 5)).toBe(15);
    expect(clampSeek(98, 100, 5)).toBe(100);
    expect(clampSeek(2, 100, -5)).toBe(0);
    expect(clampSeek(0, 0, 5)).toBe(0);
  });

  it('frameStep moves exactly one frame', () => {
    expect(frameStep(5, 1, FC_FPS)).toBeCloseTo(5 + 1/30, 5);
    expect(frameStep(5, -1, FC_FPS)).toBeCloseTo(5 - 1/30, 5);
  });
});
