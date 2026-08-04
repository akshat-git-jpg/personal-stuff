import { describe, it, expect } from 'vitest';
import { fxContext, fxEventsAt } from '../src/lib/fxSim';

describe('fxSim', () => {
  it('fxContext / fxEventsAt helpers', () => {
    const fullframes = [{ id: 'f1', start: 10, end: 15 }];
    const spans = [{ id: 's1', start: 5, end: 12 }];

    expect(fxContext(8, fullframes, spans)).toBe('avatar');
    expect(fxContext(11, fullframes, spans)).toBe('graphic');
    expect(fxContext(2, fullframes, spans)).toBe('screen');

    const instances = [
      { type: 'whip', at: 5, enabled: true },
      { type: 'whip', at: 8, enabled: false }
    ];

    const ev1 = fxEventsAt(4, 5, instances);
    expect(ev1.length).toBe(1);
    expect(ev1[0].at).toBe(5);

    const ev2 = fxEventsAt(5, 6, instances);
    expect(ev2.length).toBe(0);
  });
});
