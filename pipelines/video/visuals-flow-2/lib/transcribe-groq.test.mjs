import test from 'node:test';
import assert from 'node:assert/strict';
import { clampAndJudge } from './transcribe-groq.mjs';

test('clampAndJudge', () => {
  // empty array
  assert.doesNotThrow(() => {
    clampAndJudge([]);
  });

  // real failure case: 5974 words with 129 sub-second backwards jitters
  const words1 = [];
  for (let i = 0; i < 5974; i++) {
    words1.push({ text: 'x', start: i * 0.32, end: i * 0.32 + 0.3 });
  }
  for (let i = 1; i < 130; i++) {
    words1[i * 40].start = words1[i * 40 - 1].start - 0.2; // 0.2s jitter
  }
  const result1 = clampAndJudge(words1);
  assert.equal(result1.poisoned, false);
  assert.equal(result1.clamped, 129);

  // rejects genuinely backwards timeline
  const words2 = [
    { text: 'a', start: 0.0, end: 1.0 },
    { text: 'b', start: 5.0, end: 6.0 },
    { text: 'c', start: 1.0, end: 2.0 }, // 4s backwards
  ];
  const result2 = clampAndJudge(words2);
  assert.equal(result2.poisoned, true);

  // rejects death-by-a-thousand-cuts
  // >2% of runtime
  // Runtime: e.g. 100s. Jitter > 2s.
  const words3 = [];
  for (let i = 0; i < 100; i++) {
    words3.push({ text: 'x', start: i, end: i + 0.9 });
  }
  // Total runtime 100.9s. 2% is ~2s. We need > 2s of jitter.
  // 5 jitters of 0.5s = 2.5s jitter.
  for (let i = 1; i <= 5; i++) {
    words3[i * 10].start = words3[i * 10 - 1].start - 0.5;
  }
  const result3 = clampAndJudge(words3);
  assert.equal(result3.poisoned, true);
});
