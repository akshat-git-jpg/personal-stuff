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

test('8s span → E3; 200s span → W1', () => {
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

test('400s gap between spans → W4; 250s gap → no W4', () => {
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
        { id: 's2', start: 340, end: 380, duration: 40 }
      ]
    },
    resolvedCues: [],
    words
  });
  assert.ok(!res2.warnings.some(w => w.startsWith('W4')));
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
