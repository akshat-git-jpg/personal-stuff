import { describe, it, expect } from 'vitest';
import { fmtClock, fmtClockFrames, clampSeek, frameStep, FC_FPS } from '../src/lib/fcTransport';

describe('fcTransport', () => {
  it('fmtClock formats duration', () => {
    expect(fmtClock(0)).toBe('00:00');
    expect(fmtClock(61.5)).toBe('01:01');
  });

  it('fmtClockFrames counts whole frames properly', () => {
    expect(fmtClockFrames(0)).toBe('00:00:00');
    expect(fmtClockFrames(5)).toBe('00:05:00');
    // the exact bug the legacy comment documents
    expect(fmtClockFrames(5 + 1/30)).toBe('00:05:01');
    expect(fmtClockFrames(61 + 29/30)).toBe('01:01:29');
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
