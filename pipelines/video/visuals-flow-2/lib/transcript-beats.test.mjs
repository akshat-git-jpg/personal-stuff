import { test } from 'node:test';
import assert from 'node:assert';
import { transcriptBeats } from './transcript-beats.mjs';

const W = [
  { word: 'Today', start: 14.08 },
  { word: 'we', start: 14.28 },
  { word: 'are', start: 14.48 },
  { word: 'looking', start: 14.83 },
  { word: 'at', start: 15.52 },
  { word: 'OpenArt', start: 15.76 },
  { word: 'Higgsfield', start: 17.33 },
  { word: 'Synthesia', start: 18.94 },
  { word: 'HeyGen', start: 20.49 },
  { word: 'and', start: 21.19 },
  { word: 'Arcads', start: 21.61 },
  { word: 'Arcads', start: 22.00 }
];

test('transcriptBeats - happy path', () => {
  const cue = {
    id: 'z02',
    variables: {
      platforms: [
        { name: 'OpenArt' },
        { name: 'Higgsfield' },
        { name: 'Synthesia' },
        { name: 'HeyGen' },
        { name: 'Arcads' }
      ]
    }
  };

  const cat = { beat_items: 'platforms', beat_shape: { name: 'string' } };
  const result = transcriptBeats(cue, cat, W, 0, 14.08);
  
  assert.strictEqual(result.err, undefined);
  assert.strictEqual(result.beats.length, 5);
  assert.strictEqual(result.beats[0].at, +(15.76 - 14.08).toFixed(2));
  assert.strictEqual(result.beats[4].at, +(21.61 - 14.08).toFixed(2));
});

test('transcriptBeats - label never appears', () => {
  const cue = { variables: { platforms: [{ name: 'FakeTool' }] } };
  const cat = { beat_items: 'platforms', beat_shape: { name: 'string' } };
  const result = transcriptBeats(cue, cat, W, 0, 14.08);
  assert.ok(result.err.includes('not found'));
});

test('transcriptBeats - multi-word label', () => {
  const cue = { variables: { platforms: [{ name: 'looking at OpenArt' }] } };
  const cat = { beat_items: 'platforms', beat_shape: { name: 'string' } };
  const result = transcriptBeats(cue, cat, W, 0, 14.08);
  assert.strictEqual(result.err, undefined);
  assert.strictEqual(result.beats[0].at, +(14.83 - 14.08).toFixed(2));
});

test('transcriptBeats - item appearing twice', () => {
  const cue = { variables: { platforms: [{ name: 'Arcads' }, { name: 'Arcads' }] } };
  const cat = { beat_items: 'platforms', beat_shape: { name: 'string' } };
  const result = transcriptBeats(cue, cat, W, 0, 14.08);
  assert.strictEqual(result.err, undefined);
  assert.strictEqual(result.beats[0].at, +(21.61 - 14.08).toFixed(2)); // first Arcads
  assert.strictEqual(result.beats[1].at, +(22.00 - 14.08).toFixed(2)); // second Arcads
});

test('transcriptBeats - empty item list', () => {
  const cue = { variables: { platforms: [] } };
  const cat = { beat_items: 'platforms', beat_shape: { name: 'string' } };
  const result = transcriptBeats(cue, cat, W, 0, 14.08);
  assert.ok(result.err.includes('missing or empty'));
});
