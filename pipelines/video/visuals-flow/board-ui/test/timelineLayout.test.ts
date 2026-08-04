import { describe, it, expect } from 'vitest';
import { fitPxps, blockRect, rulerTicks, timeAtOffset } from '../src/lib/timelineLayout';

describe('timelineLayout', () => {
  it('fitPxps', () => {
    expect(fitPxps(1090, 100)).toBe(10);
    expect(fitPxps(1090, 10000)).toBe(0.4);
    expect(fitPxps(10000, 10)).toBe(30);
  });

  it('blockRect', () => {
    expect(blockRect(5, 2, 10)).toEqual({ left: 50, width: 20 });
    expect(blockRect(5, 0.1, 10)).toEqual({ left: 50, width: 2 });
  });

  it('rulerTicks', () => {
    const ticks = rulerTicks(10, 10);
    expect(ticks).toEqual([
      { t: 0, label: '00:00' },
      { t: 8, label: '00:08' },
    ]);
  });

  it('timeAtOffset', () => {
    expect(timeAtOffset(50, 10)).toBe(5);
  });
});
