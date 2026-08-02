import test from 'node:test';
import assert from 'node:assert';
import { validateTranscript, transcriptText } from './transcript.mjs';

test('validateTranscript', () => {
  assert.deepStrictEqual(validateTranscript({}), ['transcript is not an array']);
  assert.deepStrictEqual(validateTranscript([]), ['transcript is empty']);

  const noText = [{ start: 0, end: 1 }];
  assert.deepStrictEqual(validateTranscript(noText), ['word 0: missing text']);

  const noTimes = [{ text: 'hello' }];
  assert.deepStrictEqual(validateTranscript(noTimes), ['word 0: non-numeric start/end']);

  const backwards = [{ text: 'hello', start: 1, end: 0 }];
  assert.deepStrictEqual(validateTranscript(backwards), ['word 0: end before start']);

  const overlap = [
    { text: 'hello', start: 0, end: 1 },
    { text: 'world', start: -1, end: 2 }
  ];
  assert.deepStrictEqual(validateTranscript(overlap), ['word 1: start goes backwards']);

  const valid = [
    { text: 'hello', start: 0.0, end: 0.5 },
    { text: 'world', start: 0.5, end: 1.0 },
    { text: 'test', start: 1.0, end: 1.5 }
  ];
  assert.deepStrictEqual(validateTranscript(valid), []);
});

test('transcriptText', () => {
  const words = [
    { text: ' hello ', start: 0, end: 1 },
    { text: 'world  ', start: 1, end: 2 },
    { text: 'test', start: 2, end: 3 }
  ];
  assert.strictEqual(transcriptText(words), 'hello world test');
});
