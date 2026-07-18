import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveShots } from './resolve-shots.mjs';

const words = Array.from({ length: 120 }, (_, i) => ({ text: `w${i}`, start: i, end: i + 1 }));

test('happy path: span {id:"s01", kind:"avatar-full", from_anchor:"w10 w11 w12", to_anchor:"w20 w21 w22"}, engineMode "test" → one resolved span', () => {
  const { spans, errors } = resolveShots({
    engineMode: 'test',
    spans: [{ id: 's01', kind: 'avatar-full', from_anchor: 'w10 w11 w12', to_anchor: 'w20 w21 w22' }]
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
    spans: [{ id: 's01', kind: 'avatar-full', from_anchor: 'w20 w21 w22', to_anchor: 'w10 w11 w12' }]
  }, words);
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes('to_anchor'));
});

test('unknown kind → error; flagged: true span → skipped, no error', () => {
  const { spans, errors } = resolveShots({
    engineMode: 'test',
    spans: [
      { id: 's01', kind: 'unknown', from_anchor: 'w10 w11 w12', to_anchor: 'w20 w21 w22' },
      { id: 's02', kind: 'avatar-full', flagged: true, from_anchor: 'w10 w11 w12', to_anchor: 'w20 w21 w22' }
    ]
  }, words);
  assert.equal(spans.length, 0);
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes('unknown kind'));
});

test('engineMode: "production" → error containing not implemented; engineMode: "nope" → error containing invalid', () => {
  const res1 = resolveShots({ engineMode: 'production' }, words);
  assert.equal(res1.errors.length, 1);
  assert.ok(res1.errors[0].includes('not implemented'));

  const res2 = resolveShots({ engineMode: 'nope' }, words);
  assert.equal(res2.errors.length, 1);
  assert.ok(res2.errors[0].includes('invalid'));
});

test('duplicate span ids → error', () => {
  const { errors } = resolveShots({
    engineMode: 'test',
    spans: [
      { id: 's01', kind: 'avatar-full', from_anchor: 'w10 w11 w12', to_anchor: 'w20 w21 w22' },
      { id: 's01', kind: 'avatar-full', from_anchor: 'w30 w31 w32', to_anchor: 'w40 w41 w42' }
    ]
  }, words);
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes('duplicate'));
});

test('anchor with < 3 words → error (via findPhrase)', () => {
  const { errors } = resolveShots({
    engineMode: 'test',
    spans: [{ id: 's01', kind: 'avatar-full', from_anchor: 'w10 w11', to_anchor: 'w20 w21 w22' }]
  }, words);
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes('fewer than 3 words'));
});
