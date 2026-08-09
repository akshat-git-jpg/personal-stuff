import test from 'node:test';
import assert from 'node:assert';
import { spokenSpan } from './spoken-span.mjs';
import { normWord } from './resolve.mjs';

const mk = (pairs) => pairs.map(([text, start, end]) => ({ text, start, end, n: normWord(text) }));

// "I have my prompt here: Lucy taking a sip from a coffee cup in her hand,
// showing a smile" — the real c24 shape, where the card copy drops "in her
// hand" that the presenter actually says.
const W = mk([
  ['I', 0.0, 0.2], ['have', 0.2, 0.4], ['my', 0.4, 0.6], ['prompt', 0.6, 0.9], ['here:', 0.9, 1.2],
  ['Lucy', 1.5, 1.8], ['taking', 1.8, 2.0], ['a', 2.0, 2.1], ['sip', 2.1, 2.4],
  ['from', 2.4, 2.6], ['a', 2.6, 2.7], ['coffee', 2.7, 3.0], ['cup', 3.0, 3.3],
  ['in', 3.3, 3.4], ['her', 3.4, 3.6], ['hand,', 3.6, 3.9],
  ['showing', 4.0, 4.3], ['a', 4.3, 4.4], ['smile', 4.4, 4.9],
  ['So', 6.0, 6.2], ['from', 6.2, 6.4], ['there', 6.4, 6.8],
]);

test('spans from the first to the last spoken word of the copy', () => {
  const r = spokenSpan(W, 0, 'Lucy taking a sip from a coffee cup, showing a smile');
  assert.ok(r);
  assert.equal(r.start, 1.5);
  assert.equal(r.end, 4.9);
  assert.equal(r.seconds, 3.4);
});

test('tolerates words the card copy omits from the narration', () => {
  // "in her hand" is spoken but absent from the card text; the aligner must
  // step over it rather than stopping at "cup".
  const r = spokenSpan(W, 0, 'Lucy taking a sip from a coffee cup, showing a smile');
  assert.equal(r.matched, r.total);
});

test('stops at the end of the copy, not the end of the sentence', () => {
  const r = spokenSpan(W, 0, 'Lucy taking a sip from a coffee cup, showing a smile');
  assert.ok(r.end < 6.0, 'must not run into the following sentence');
});

test('searches forward from the anchor index only', () => {
  const later = mk([
    ['Lucy', 0.0, 0.3], ['waits', 0.3, 0.6],
    ['then', 5.0, 5.2], ['Lucy', 5.2, 5.5], ['taking', 5.5, 5.8], ['a', 5.8, 5.9], ['sip', 5.9, 6.3],
  ]);
  const r = spokenSpan(later, 2, 'Lucy taking a sip');
  assert.equal(r.start, 5.2);
});

test('returns null when the copy is barely present', () => {
  assert.equal(spokenSpan(W, 0, 'completely unrelated wording nobody said aloud here'), null);
});

test('returns null for copy shorter than three words', () => {
  assert.equal(spokenSpan(W, 0, 'Lucy taking'), null);
});

test('returns null for empty or missing copy', () => {
  assert.equal(spokenSpan(W, 0, ''), null);
  assert.equal(spokenSpan(W, 0, undefined), null);
});

test('measures the real c04 lag it exists to remove', () => {
  // 89 chars of prompt spoken in 5.5s; the card was typing it over 10.95s.
  const words = mk([
    ['A', 0.0, 0.2], ['high', 0.2, 0.5], ['quality,', 0.5, 0.9],
    ['hyper', 1.0, 1.4], ['realistic,', 1.4, 1.9], ['candid', 1.9, 2.3],
    ['portrait', 2.3, 2.8], ['of', 2.8, 2.9], ['a', 2.9, 3.0],
    ['22', 3.0, 3.4], ['year', 3.4, 3.7], ['old', 3.7, 4.0],
    ['Filipina', 4.0, 4.8], ['AI', 4.8, 5.1], ['influencer.', 5.1, 5.5],
  ]);
  const r = spokenSpan(words, 0, 'A high quality, hyper realistic, candid portrait of a 22 year old Filipina AI influencer.');
  assert.equal(r.seconds, 5.5);
});
