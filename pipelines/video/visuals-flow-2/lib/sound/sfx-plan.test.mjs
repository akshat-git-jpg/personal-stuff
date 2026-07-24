import test from 'node:test';
import assert from 'node:assert';
import { planSfx } from './sfx-plan.mjs';
import { SOUND_CONSTANTS } from './sound-constants.mjs';

test('sfx planner rules', () => {
  const resolved = [
    {
      id: 'c1',
      card: 'enacted/fill-gauge',
      placement: 'fullframe',
      start: 1.0,
      duration: 10,
      variables: {
        beats: [
          { at: 1.0 }, // beat 0 -> at 2.0
          { at: 1.2 }, // beat 1 -> at 2.2 (dropped due to min spacing? Wait, let's see. 2.0 + 0.35 = 2.35, so 2.2 drops)
          { at: 1.4 }, // beat 2 -> at 2.4 (2.4 - 2.0 = 0.4 > 0.35, so kept. Wait, POP_CAP drops beat 2 anyway since cap=3 keeps 0, 1, last)
          { at: 2.0 }  // beat 3 -> at 3.0 (kept)
        ]
      }
    },
    {
      id: 'c2',
      card: 'enacted/counter-tally',
      placement: 'fullframe',
      start: 12.0,
      duration: 5,
      variables: {
        beats: [
          { at: 1.0 }, // 13.0
          { at: 2.0 }  // 14.0
        ]
      }
    }
  ];

  const effects = {
    instances: [
      { id: 'w1', type: 'whip', at: 11.5, enabled: true }
    ]
  };

  const segments = [];
  const total = 20;

  const res1 = planSfx({ resolved, effects, segments, total });
  const res2 = planSfx({ resolved, effects, segments, total });

  assert.deepStrictEqual(res1, res2, 'deterministic');

  // Riser
  assert.ok(res1.find(x => x.sample === 'riser' && x.at === 0.5));
  
  // Entrances
  assert.ok(res1.find(x => x.sample === 'whoosh-up' && x.at === 1.0));
  assert.ok(res1.find(x => x.sample === 'whoosh-up' && x.at === 12.0));

  // Transitions
  assert.ok(res1.find(x => x.sample === 'swipe' && x.at === 11.5));
  
  // Success end (c2 ends at 17)
  assert.ok(res1.find(x => x.sample === 'success' && x.at === 17.0));

  // c1 uses 'pop' class (actually 'pop' because last was 'blip', so 'pop').
  // beats kept by POP_CAP (which is 3, keeping 0, 1, 3):
  // beat 0 (2.0): kept
  // beat 1 (2.2): drops because MIN_SPACING 0.35 against 2.0
  // beat 3 (3.0): kept
  // Let's verify 'pop' elements at 2.0 and 3.0.
  // Wait, the "lone pop" rule! Distance from whoosh-up(1.0) to 2.0 is 1.0s. Next is 3.0.
  // So neither is >5, they are kept!
  const c1Beats = res1.filter(x => x.at >= 2.0 && x.at <= 4.0 && x.sample === 'pop');
  assert.strictEqual(c1Beats.length, 2, 'keeps beats 0 and 3, MIN_SPACING drops beat 1');
  assert.strictEqual(c1Beats[0].semi, SOUND_CONSTANTS.RUN_SEMITONES[0], 'contour starts at 0');
  // Since beat 3 was at index 3, it should have semi of RUN_SEMITONES[3 % len] which is RUN_SEMITONES[0].
  assert.strictEqual(c1Beats[1].semi, SOUND_CONSTANTS.RUN_SEMITONES[3 % 3], 'last beat keeps index semitone');

  // c2 uses 'tick' because enacted/counter-tally
  const c2Beats = res1.filter(x => x.at >= 13.0 && x.at <= 15.0 && x.sample === 'tick');
  assert.strictEqual(c2Beats.length, 2);
  assert.strictEqual(c2Beats[0].semi, 0, 'tick semi 0');
  assert.strictEqual(c2Beats[1].semi, 0, 'tick semi 0');
});
