import { describe, it, expect } from 'vitest';
import { buildPlanIndex, isOverCap, isNewCard } from '../src/lib/cardStatus';

// Shaped like a real card-plan.json section list.
const plan = {
  sections: [
    {
      part: 'body',
      items: [
        { id: 'c01', card: 'section/section-card-flip', status: 'existing', placement: 'fullframe', structural: true },
        { id: 'c02', card: 'overlay/lower-third', status: 'existing', placement: 'overlay', structural: false },
        { id: 'c06', card: 'overlay/stat-hit', status: 'existing', placement: 'overlay', structural: false },
        { id: 'c10', card: 'slate/kinetic-sentence', status: 'existing', placement: 'fullframe', structural: false },
        {
          id: 'c20', card: 'enacted/character-card-stamp', status: 'new', placement: 'fullframe', structural: false,
          proposal: { does: 'stamps the anchor face into each scenario', kind: 'beat', placement: 'fullframe', beats: 2 },
        },
      ],
    },
  ],
};

describe('cardStatus', () => {
  const { byId, byCard, newCards } = buildPlanIndex(plan);

  it('indexes every plan row by cue id so a tile can find its own status', () => {
    expect(Object.keys(byId)).toHaveLength(5);
    expect(byId.c20.status).toBe('new');
    expect((byId.c20.proposal as any).beats).toBe(2);
  });

  // The regression that started this: plan 195 deleted the Card Plan tab, the
  // only surface that said EXISTING vs NEW, and nothing replaced it.
  it('marks a card that does not exist yet, and only that card', () => {
    expect(isNewCard('enacted/character-card-stamp', byCard)).toBe(true);
    expect(isNewCard('overlay/lower-third', byCard)).toBe(false);
    expect(isNewCard('section/section-card-flip', byCard)).toBe(false);
    expect(newCards).toEqual(['enacted/character-card-stamp']);
  });

  it('an unknown card is not silently called new', () => {
    expect(isNewCard('does/not-exist', byCard)).toBe(false);
  });

  // A flat n > 3 reported four false breaches on a plan the linter passed.
  it('does not flag cards that carry no cap, however often they repeat', () => {
    expect(isOverCap('overlay/lower-third', 14, byCard)).toBe(false);
    expect(isOverCap('section/section-card-flip', 8, byCard)).toBe(false);
  });

  it('flags a non-structural fullframe card over E3', () => {
    expect(isOverCap('slate/kinetic-sentence', 3, byCard)).toBe(false);
    expect(isOverCap('slate/kinetic-sentence', 4, byCard)).toBe(true);
  });

  it('flags overlay/stat-hit over its own E2 cap even though it is an overlay', () => {
    expect(isOverCap('overlay/stat-hit', 3, byCard)).toBe(false);
    expect(isOverCap('overlay/stat-hit', 4, byCard)).toBe(true);
  });

  it('says nothing at all before a card plan exists', () => {
    const empty = buildPlanIndex(null);
    expect(empty.newCards).toEqual([]);
    expect(isOverCap('slate/kinetic-sentence', 99, empty.byCard)).toBe(false);
    expect(isNewCard('enacted/character-card-stamp', empty.byCard)).toBe(false);
  });
});
