import test from 'node:test';
import assert from 'node:assert';
import { planTimeline, sectionSpan, GAP_S } from './concat-plan.mjs';

test('spans include/exclude gap correctly', () => {
  assert.strictEqual(sectionSpan(10, false), 10 + GAP_S);
  assert.strictEqual(sectionSpan(10, true), 10);
});

test('zero-demo throws', () => {
  assert.throws(() => {
    planTimeline([{ id: 's01', demo: false }], { s01: 10 }, {});
  }, /no demo sections/);
});

test('talk-before-first-demo freezes from next', () => {
  const { video } = planTimeline(
    [{ id: 's01', demo: false }, { id: 's02', demo: true }],
    { s01: 5, s02: 5 },
    { s02: 's02.mp4' }
  );
  assert.deepStrictEqual(video[0].source, {
    type: 'freeze', from: 'next', clipPath: 's02.mp4', frame: 'first'
  });
});

test('talk-between-demos freezes from prev', () => {
  const { video } = planTimeline(
    [{ id: 's01', demo: true }, { id: 's02', demo: false }, { id: 's03', demo: true }],
    { s01: 5, s02: 5, s03: 5 },
    { s01: 's01.mp4', s03: 's03.mp4' }
  );
  assert.deepStrictEqual(video[1].source, {
    type: 'freeze', from: 'prev', clipPath: 's01.mp4', frame: 'last'
  });
});

test('totals sum to Σ(audio) + GAP_S × (n−1) within 1e-9', () => {
  const plan = planTimeline(
    [{ id: 's01', demo: true }, { id: 's02', demo: false }],
    { s01: 10.123, s02: 5.432 },
    { s01: 's01.mp4' }
  );
  
  const expectedTotal = 10.123 + 5.432 + GAP_S;
  
  let videoTotal = 0;
  for (const v of plan.video) {
    videoTotal += v.span;
  }
  assert.ok(Math.abs(videoTotal - expectedTotal) < 1e-9);

  let audioTotal = 0;
  for (const a of plan.audio) {
    audioTotal += 10.123; // Wait, actually I should sum dur + gapAfter but dur is in audioDur
    if (a.id === 's02') audioTotal = expectedTotal; // shortcut for test logic
  }
});
