import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveShots } from './resolve-shots.mjs';

const words = Array.from({ length: 120 }, (_, i) => ({ text: `w${i}`, start: i, end: i + 1 }));

test('happy path: span {id:"s01", kind:"avatar-full", from_anchor:"w10 w11 w12", to_anchor:"w20 w21 w22"}, engineMode "test" → one resolved span', () => {
  const { spans, errors } = resolveShots({
    engineMode: 'test',
    spans: [{ id: 's01', kind: 'avatar-full', mode: 'full', from_anchor: 'w10 w11 w12', to_anchor: 'w20 w21 w22' }]
  }, words);
  assert.deepEqual(errors, []);
  assert.equal(spans.length, 1);
  assert.equal(spans[0].id, 's01');
  assert.equal(spans[0].start, 10);
  assert.equal(spans[0].end, 23);
  assert.equal(spans[0].duration, 13);
});

test('to_anchor before from_anchor in the transcript → error mentioning to_anchor', () => {
  const { errors } = resolveShots({
    engineMode: 'test',
    spans: [{ id: 's01', kind: 'avatar-full', mode: 'full', from_anchor: 'w20 w21 w22', to_anchor: 'w10 w11 w12' }]
  }, words);
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes('to_anchor'));
});

test('unknown purpose → error; flagged: true span → skipped, no error', () => {
  const { spans, errors } = resolveShots({
    engineMode: 'test',
    spans: [
      { id: 's01', purpose: 'unknown', from_anchor: 'w10 w11 w12', to_anchor: 'w20 w21 w22' },
      { id: 's02', purpose: 'avatar-full', flagged: true, from_anchor: 'w10 w11 w12', to_anchor: 'w20 w21 w22' }
    ]
  }, words);
  assert.equal(spans.length, 0);
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes('unknown purpose'));
});

test('legacy "kind" field still resolves (renamed to "purpose" 2026-07-31)', () => {
  const { spans, errors } = resolveShots({
    engineMode: 'test',
    spans: [
      { id: 's01', kind: 'avatar-full', mode: 'full', from_anchor: 'w10 w11 w12', to_anchor: 'w20 w21 w22' }
    ]
  }, words);
  assert.equal(errors.length, 0);
  assert.equal(spans.length, 1);
  assert.equal(spans[0].purpose, 'avatar-full');
});

test('engineMode: "production" → legal (Avatar IV, implemented 2026-08-01); engineMode: "nope" → error containing invalid', () => {
  const res1 = resolveShots({ engineMode: 'production' }, words);
  assert.equal(res1.errors.length, 0);

  const res2 = resolveShots({ engineMode: 'nope' }, words);
  assert.equal(res2.errors.length, 1);
  assert.ok(res2.errors[0].includes('invalid'));
});

test('duplicate span ids → error', () => {
  const { errors } = resolveShots({
    engineMode: 'test',
    spans: [
      { id: 's01', kind: 'avatar-full', mode: 'full', from_anchor: 'w10 w11 w12', to_anchor: 'w20 w21 w22' },
      { id: 's01', kind: 'avatar-full', mode: 'full', from_anchor: 'w30 w31 w32', to_anchor: 'w40 w41 w42' }
    ]
  }, words);
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes('duplicate'));
});

test('anchor with < 3 words → error (via findPhrase)', () => {
  const { errors } = resolveShots({
    engineMode: 'test',
    spans: [{ id: 's01', kind: 'avatar-full', mode: 'full', from_anchor: 'w10 w11', to_anchor: 'w20 w21 w22' }]
  }, words);
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes('fewer than 3 words'));
});

test('snap at both edges', () => {
  const customWords = Array.from({ length: 120 }, (_, i) => ({ text: `w${i}`, start: i, end: i + 1 }));
  // total is 120
  const { spans } = resolveShots({
    engineMode: 'test',
    spans: [{ id: 's01', kind: 'avatar-full', mode: 'full', from_anchor: 'w1 w2 w3', to_anchor: 'w117 w118 w119' }] // w1 starts at 1.0; w119 ends at 120.0, wait. 119 ends at 120.0. To snap we need end to be > 118.5.
  }, customWords);
  // w1 starts at 1.0 (which is < 1.5) -> snaps to 0.0
  // w119 ends at 120.0. If we use w117 w118 w119, end is 120.0. Wait, 120-120 = 0 < 1.5, so it "snaps" to 120 anyway.
  // We want it to end at 119, which is 120 - 1 = 1 < 1.5, so it snaps to 120.
  // Let's use 'w116 w117 w118' -> ends at 119.0. total = 120.0. 120.0 - 119.0 = 1.0 < 1.5. Snaps to 120.0.
});

test('snap at 1.4s, no snap at 1.6s, sets snapped flag', () => {
  // start snap
  const { spans: spans1 } = resolveShots({
    engineMode: 'test',
    spans: [{ id: 's1', kind: 'avatar-full', mode: 'full', from_anchor: 'w1 w2 w3', to_anchor: 'w50 w51 w52' }]
  }, words);
  assert.equal(spans1[0].start, 0); // w1 starts at 1 -> snaps to 0
  assert.equal(spans1[0].snapped, true);

  // no start snap (starts at 2)
  const { spans: spans2 } = resolveShots({
    engineMode: 'test',
    spans: [{ id: 's2', kind: 'avatar-full', mode: 'full', from_anchor: 'w2 w3 w4', to_anchor: 'w50 w51 w52' }]
  }, words);
  assert.equal(spans2[0].start, 2); // > 1.5 -> no snap
  assert.equal(spans2[0].snapped, undefined);

  // end snap (total 120)
  // ends at 119 (w116, w117, w118). 120-119 = 1 <= 1.5
  const { spans: spans3 } = resolveShots({
    engineMode: 'test',
    spans: [{ id: 's3', kind: 'avatar-full', mode: 'full', from_anchor: 'w10 w11 w12', to_anchor: 'w116 w117 w118' }]
  }, words);
  assert.equal(spans3[0].end, 120);
  assert.equal(spans3[0].snapped, true);

  // no end snap (ends at 118)
  const { spans: spans4 } = resolveShots({
    engineMode: 'test',
    spans: [{ id: 's4', kind: 'avatar-full', mode: 'full', from_anchor: 'w10 w11 w12', to_anchor: 'w115 w116 w117' }]
  }, words);
  assert.equal(spans4[0].end, 118);
  assert.equal(spans4[0].snapped, undefined);
});

test('absent mode → error mentioning mode is required', () => {
  const { spans, errors } = resolveShots({ engineMode: 'test', spans: [{ id: 's01', kind: 'avatar-full', from_anchor: 'w10 w11 w12', to_anchor: 'w20 w21 w22' }] }, words);
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes('mode is required'));
  assert.equal(spans.length, 0);
});

test('mode: "panel" is carried through', () => {
  const { spans, errors } = resolveShots({ engineMode: 'test', spans: [{ id: 's01', kind: 'avatar-full', mode: 'panel', from_anchor: 'w10 w11 w12', to_anchor: 'w20 w21 w22' }] }, words);
  assert.equal(errors.length, 0);
  assert.equal(spans[0].mode, 'panel');
});

test('mode: "side" is carried through', () => {
  const { spans, errors } = resolveShots({ engineMode: 'test', spans: [{ id: 's01', kind: 'avatar-full', mode: 'side', from_anchor: 'w10 w11 w12', to_anchor: 'w20 w21 w22' }] }, words);
  assert.equal(errors.length, 0);
  assert.equal(spans[0].mode, 'side');
});

test('mode: "stage" is rejected', () => {
  const { spans, errors } = resolveShots({ engineMode: 'test', spans: [{ id: 's01', kind: 'avatar-full', mode: 'stage', from_anchor: 'w10 w11 w12', to_anchor: 'w20 w21 w22' }] }, words);
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes('stage'));
  assert.equal(spans.length, 0);
});

test('mode: "bogus" -> error mentioning bogus', () => {
  const { spans, errors } = resolveShots({ engineMode: 'test', spans: [{ id: 's01', kind: 'avatar-full', mode: 'bogus', from_anchor: 'w10 w11 w12', to_anchor: 'w20 w21 w22' }] }, words);
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes('bogus'));
  assert.equal(spans.length, 0);
});
