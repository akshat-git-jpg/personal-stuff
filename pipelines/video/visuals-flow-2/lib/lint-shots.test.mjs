import test from 'node:test';
import assert from 'node:assert/strict';
import { lintShots } from './lint-shots.mjs';

const words = Array.from({ length: 1200 }, (_, i) => ({ text: `w${i}`, start: i, end: i + 1 }));

test('two overlapping spans → E1', () => {
  const shotsResolved = { spans: [{ id: 's1', start: 10, end: 30, duration: 20 }, { id: 's2', start: 25, end: 40, duration: 15 }] };
  const { errors } = lintShots({ shotsResolved, resolvedCues: [], words });
  assert.ok(errors.some(e => e.startsWith('E1')));
});

test('span overlapping a fullframe cue → E2; same span vs an overlay cue → no E2', () => {
  const shotsResolved = { spans: [{ id: 's1', start: 90, end: 130, duration: 40 }] };
  const res1 = lintShots({ shotsResolved, resolvedCues: [{ id: 'c1', placement: 'fullframe', start: 100, duration: 20 }], words });
  assert.ok(res1.errors.some(e => e.startsWith('E2')));

  const res2 = lintShots({ shotsResolved, resolvedCues: [{ id: 'c1', placement: 'overlay', start: 100, duration: 20 }], words });
  assert.ok(!res2.errors.some(e => e.startsWith('E2')));
});

test('8s span → E3; 200s span in front zone → W1', () => {
  const res1 = lintShots({ shotsResolved: { spans: [{ id: 's1', start: 10, end: 18, duration: 8 }] }, resolvedCues: [], words });
  assert.ok(res1.errors.some(e => e.startsWith('E3')));

  const res2 = lintShots({ shotsResolved: { spans: [{ id: 's1', start: 10, end: 210, duration: 200 }] }, resolvedCues: [], words });
  assert.ok(res2.warnings.some(w => w.startsWith('W1')));
});

test('spans totalling 350s → E4', () => {
  const shotsResolved = { spans: [{ id: 's1', start: 10, end: 360, duration: 350 }] };
  const { errors } = lintShots({ shotsResolved, resolvedCues: [], words });
  assert.ok(errors.some(e => e.startsWith('E4')));
});

test('single mid-video span → W3 twice; spans at edges → no W3', () => {
  const res1 = lintShots({ shotsResolved: { spans: [{ id: 's1', start: 500, end: 560, duration: 60 }] }, resolvedCues: [], words });
  const w3s = res1.warnings.filter(w => w.startsWith('W3'));
  assert.equal(w3s.length, 2);

  const res2 = lintShots({
    shotsResolved: {
      spans: [
        { id: 's1', start: 30, end: 90, duration: 60 },
        { id: 's2', start: 1150, end: 1190, duration: 40 }
      ]
    },
    resolvedCues: [],
    words
  });
  assert.ok(!res2.warnings.some(w => w.startsWith('W3')));
});

test('400s gap between spans → W4; 150s gap → no W4', () => {
  const res1 = lintShots({
    shotsResolved: {
      spans: [
        { id: 's1', start: 30, end: 90, duration: 60 },
        { id: 's2', start: 490, end: 530, duration: 40 }
      ]
    },
    resolvedCues: [],
    words
  });
  assert.ok(res1.warnings.some(w => w.startsWith('W4')));

  const res2 = lintShots({
    shotsResolved: {
      spans: [
        { id: 's1', start: 30, end: 90, duration: 60 },
        { id: 's2', start: 240, end: 280, duration: 40 }
      ]
    },
    resolvedCues: [],
    words
  });
  assert.ok(!res2.warnings.some(w => w.startsWith('W4')));
});

test('zone/mid span thresholds and Youri cadence gaps', () => {
  const words1800 = Array.from({ length: 1800 }, (_, i) => ({ text: `w${i}`, start: i, end: i + 1 }));

  // mid-video span of 50s → W1 fires with `mid-video` in the message
  const resMid50 = lintShots({ shotsResolved: { spans: [{ id: 's1', start: 500, end: 550, duration: 50 }] }, resolvedCues: [], words: words1800 });
  const w1Mid50 = resMid50.warnings.find(w => w.startsWith('W1'));
  assert.ok(w1Mid50 && w1Mid50.includes('mid-video'));

  // mid-video span of 30s → no W1
  const resMid30 = lintShots({ shotsResolved: { spans: [{ id: 's1', start: 500, end: 530, duration: 30 }] }, resolvedCues: [], words: words1800 });
  assert.ok(!resMid30.warnings.some(w => w.startsWith('W1')));

  // front-zone span (starts ≤ 270) of 100s → no W1
  const resFront100 = lintShots({ shotsResolved: { spans: [{ id: 's1', start: 50, end: 150, duration: 100 }] }, resolvedCues: [], words: words1800 });
  assert.ok(!resFront100.warnings.some(w => w.startsWith('W1')));

  // front-zone span of 130s → W1 fires with `intro/outro` in the message
  const resFront130 = lintShots({ shotsResolved: { spans: [{ id: 's1', start: 50, end: 180, duration: 130 }] }, resolvedCues: [], words: words1800 });
  const w1Front130 = resFront130.warnings.find(w => w.startsWith('W1'));
  assert.ok(w1Front130 && w1Front130.includes('intro/outro'));

  // gap of 200s between spans → W4 fires
  const resGap200 = lintShots({ shotsResolved: { spans: [{ id: 's1', start: 10, end: 50, duration: 40 }, { id: 's2', start: 250, end: 290, duration: 40 }] }, resolvedCues: [], words: words1800 });
  assert.ok(resGap200.warnings.some(w => w.startsWith('W4')));

  // gap of 170s → no W4
  const resGap170 = lintShots({ shotsResolved: { spans: [{ id: 's1', start: 10, end: 50, duration: 40 }, { id: 's2', start: 220, end: 260, duration: 40 }] }, resolvedCues: [], words: words1800 });
  assert.ok(!resGap170.warnings.some(w => w.startsWith('W4')));

  // 10.5s span → no E3
  const resSpan10_5 = lintShots({ shotsResolved: { spans: [{ id: 's1', start: 10, end: 20.5, duration: 10.5 }] }, resolvedCues: [], words: words1800 });
  assert.ok(!resSpan10_5.errors.some(e => e.startsWith('E3')));

  // 9s span → E3
  const resSpan9 = lintShots({ shotsResolved: { spans: [{ id: 's1', start: 10, end: 19, duration: 9 }] }, resolvedCues: [], words: words1800 });
  assert.ok(resSpan9.errors.some(e => e.startsWith('E3')));
});

test('empty spans array → no errors, no warnings', () => {
  const { errors, warnings } = lintShots({ shotsResolved: { spans: [] }, resolvedCues: [], words });
  assert.equal(errors.length, 0);
  assert.equal(warnings.length, 0);
});


test('screen segment between avatars < 2.5s -> E5', () => {
  const { errors, warnings } = lintShots({
    shotsResolved: {
      spans: [
        { id: 's1', start: 0, end: 50, duration: 50 },
        { id: 's2', start: 52.4, end: 100, duration: 47.6 }
      ]
    },
    resolvedCues: [],
    words
  });
  assert.ok(errors.some(e => e.startsWith('E5 orphan-screen')));
});

test('screen segment < 5s -> W5', () => {
  const { errors, warnings } = lintShots({
    shotsResolved: {
      spans: [
        { id: 's1', start: 4, end: 50, duration: 46 } // screen 0 to 4 (4s)
      ]
    },
    resolvedCues: [],
    words
  });
  assert.ok(warnings.some(w => w.startsWith('W5 short-screen')));
});

test('clean plan silent -> no E5/W5', () => {
  const { errors, warnings } = lintShots({
    shotsResolved: {
      spans: [
        { id: 's1', start: 10, end: 50, duration: 40 },
        { id: 's2', start: 60, end: 100, duration: 40 }
      ]
    },
    resolvedCues: [],
    words: Array.from({ length: 200 }, (_, i) => ({ text: 'w', start: i, end: i + 1 })) // total 200
  });
  // Wait, start 10 -> screen 10s. mid gap 10s. end gap 100s. All >= 5s.
  // W2 budget target might trigger if not enough duration, but we just check E5/W5.
  assert.ok(!errors.some(e => e.startsWith('E5')));
  assert.ok(!warnings.some(w => w.startsWith('W5')));
});
