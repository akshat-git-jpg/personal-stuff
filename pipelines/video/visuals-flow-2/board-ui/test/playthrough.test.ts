import { describe, it, expect } from 'vitest';
import { playthroughView } from '../src/lib/playthrough';

describe('playthroughView', () => {
  it('picks the active block and a gap carries the next cue\'s start', () => {
    const blocks: any[] = [
      { id: 'seg-0', start: 0, kind: 'cue' },
      { id: 'seg-1', start: 5, kind: 'gap' },
      { id: 'seg-2', start: 12, kind: 'cue' },
    ];
    expect(playthroughView(blocks, -1)).toBeNull();
    expect(playthroughView(blocks, 0)).toEqual({ kind: 'cue', id: 'seg-0' });
    expect(playthroughView(blocks, 4.9)).toEqual({ kind: 'cue', id: 'seg-0' });
    expect(playthroughView(blocks, 5)).toEqual({ kind: 'gap', id: 'seg-1', nextStart: 12 });
    expect(playthroughView(blocks, 11.9)).toEqual({ kind: 'gap', id: 'seg-1', nextStart: 12 });
    expect(playthroughView(blocks, 12)).toEqual({ kind: 'cue', id: 'seg-2' });
    expect(playthroughView(blocks, 999)).toEqual({ kind: 'cue', id: 'seg-2' });
  });

  it('a trailing gap (no next cue) reports nextStart null', () => {
    const blocks: any[] = [
      { id: 'seg-0', start: 0, kind: 'cue' },
      { id: 'seg-1', start: 5, kind: 'gap' },
    ];
    expect(playthroughView(blocks, 7)).toEqual({ kind: 'gap', id: 'seg-1', nextStart: null });
  });
});
