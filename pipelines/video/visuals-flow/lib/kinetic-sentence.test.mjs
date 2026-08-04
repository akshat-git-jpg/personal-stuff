import test from 'node:test';
import assert from 'node:assert';
import { wordSyncBeats } from './kinetic-sentence.mjs';

const W = [
  { text: 'Because', start: 10.0 }, { text: 'picking', start: 10.35 },
  { text: 'the', start: 10.62 },    { text: 'wrong', start: 10.80 },
  { text: 'model', start: 11.15 },  { text: 'just', start: 11.50 },
  { text: 'burns', start: 11.75 },  { text: 'credits', start: 12.10 }
].map(x => ({ ...x, n: x.text.toLowerCase() }));

test('wordSyncBeats derives one beat per word with transcript-relative times', () => {
  const cue = { variables: { text: 'Because picking the wrong model just burns credits' } };
  const r = wordSyncBeats(cue, W, 0, 10.0);
  assert.equal(r.err, undefined);
  assert.equal(r.beats.length, 8);
  assert.equal(r.beats[0].at, 0);
  assert.equal(r.beats[7].at, 2.1);
});

test('wordSyncBeats marks exactly the accent span', () => {
  const cue = { variables: { text: 'Because picking the wrong model just burns credits', accent: 'burns credits' } };
  const r = wordSyncBeats(cue, W, 0, 10.0);
  assert.equal(r.err, undefined);
  assert.equal(r.beats.length, 8);
  for (let i = 0; i < 6; i++) {
    assert.equal(r.beats[i].accent, false);
  }
  assert.equal(r.beats[6].accent, true);
  assert.equal(r.beats[7].accent, true);
});

test('wordSyncBeats rejects an accent phrase absent from the text', () => {
  const cue = { variables: { text: 'Because picking the wrong model just burns credits', accent: 'wasted money' } };
  const r = wordSyncBeats(cue, W, 0, 10.0);
  assert.ok(r.err.includes('does not appear'));
});

test('wordSyncBeats rejects a word missing from the transcript', () => {
  const cue = { variables: { text: 'Because picking the wrong xylophone just burns credits' } };
  const r = wordSyncBeats(cue, W, 0, 10.0);
  assert.ok(r.err.includes('not found in the transcript'));
});
