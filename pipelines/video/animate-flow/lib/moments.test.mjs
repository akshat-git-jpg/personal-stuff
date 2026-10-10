import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveMoments, momentWords, momentAt, wordTable } from './moments.mjs';

// 40 words, one every 0.5s, each 0.4s long.
const words = Array.from({ length: 40 }, (_, i) => ({ text: `w${i}`, start: i * 0.5, end: i * 0.5 + 0.4 }));
const mom = (id, a, b, extra = {}) => ({ id, from: { i: a, text: `w${a}` }, to: { i: b, text: `w${b}` }, idea: 'x', why: 'y', ...extra });

test('anchors resolve to word times plus the hold', () => {
  const { errors, moments } = resolveMoments({ moments: [mom('m01', 2, 10)] }, words, { total: 20 });
  assert.deepEqual(errors, []);
  assert.deepEqual([moments[0].start, moments[0].end, moments[0].duration], [1, 5.9, 4.9]);
});

test('anchor text must match the transcript word, ignoring case and punctuation', () => {
  const ok = resolveMoments({ moments: [{ ...mom('m01', 2, 10), from: { i: 2, text: 'W2,' } }] }, words, { total: 20 });
  assert.deepEqual(ok.errors, []);
  const bad = resolveMoments({ moments: [{ ...mom('m01', 2, 10), from: { i: 2, text: 'OpenArt' } }] }, words, { total: 20 });
  assert.match(bad.errors.join('\n'), /from.text "OpenArt" does not match word 2 "w2"/);
});

test('overlapping speech is an error; a hold running into the next moment is trimmed', () => {
  const clash = resolveMoments({ moments: [mom('m01', 0, 12), mom('m02', 10, 20)] }, words, { total: 20 });
  assert.match(clash.errors.join('\n'), /moments m01 and m02 overlap/);
  const trimmed = resolveMoments({ moments: [mom('m01', 0, 10, { hold: 1.5 }), mom('m02', 11, 20)] }, words, { total: 20 });
  assert.deepEqual(trimmed.errors, []);
  assert.equal(trimmed.moments[0].end, trimmed.moments[1].start);
});

test('a gap shorter than a second is closed so the bed never flashes', () => {
  const { errors, moments } = resolveMoments({ moments: [mom('m01', 0, 8, { hold: 0 }), mom('m02', 10, 20)] }, words, { total: 20 });
  assert.deepEqual(errors, []);
  assert.equal(moments[0].end, 5);
});

test('length limits, ids, required fields and empty plans are reported together', () => {
  const { errors } = resolveMoments({ moments: [mom('m01', 0, 1, { hold: 0 }), mom('M 2', 5, 6), { ...mom('m03', 20, 30), idea: '' }] }, words, { total: 20 });
  const all = errors.join('\n');
  assert.match(all, /m01: 0.9s is shorter than 3s/);
  assert.match(all, /id must be lowercase kebab/);
  assert.match(all, /m03: idea is required/);
  assert.match(resolveMoments({ moments: [] }, words).errors.join(), /empty/);
});

test('a moment is a takeover unless it says overlay; any other kind is an error', () => {
  const { errors, moments } = resolveMoments({ moments: [mom('m01', 2, 10), mom('m02', 14, 24, { kind: 'overlay' })] }, words, { total: 20 });
  assert.deepEqual(errors, []);
  assert.deepEqual(moments.map((m) => m.kind), ['takeover', 'overlay']);
  assert.match(resolveMoments({ moments: [mom('m01', 2, 10, { kind: 'popup' })] }, words, { total: 20 }).errors.join(), /kind must be takeover or overlay/);
});

test('moment words are relative to the moment and the lookup finds the moment at t', () => {
  const { moments } = resolveMoments({ moments: [mom('m01', 4, 9)] }, words, { total: 20 });
  const w = momentWords(words, moments[0]);
  assert.deepEqual(w[0], { text: 'w4', start: 0, end: 0.4 });
  assert.equal(momentAt(moments, 3)?.id, 'm01');
  assert.equal(momentAt(moments, 10), null);
  assert.match(wordTable(words.slice(0, 2)), /^i\tstart\tend\ttext\n0\t0\.00\t0\.40\tw0\n/);
});
