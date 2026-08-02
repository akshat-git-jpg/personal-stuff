import test from 'node:test';
import assert from 'node:assert';
import { parseFreezeLog, longestFreeze } from './frames.mjs';

test('parseFreezeLog handles no freezes', () => {
  const stderr = `ffmpeg version 7.0 Copyright (c) 2000-2024 the FFmpeg developers\nSome other output\n`;
  assert.deepStrictEqual(parseFreezeLog(stderr, 10.0), []);
});

test('parseFreezeLog handles paired lines', () => {
  const stderr = `
[freezedetect @ 0x123] freeze_start: 1.5
[freezedetect @ 0x123] freeze_end: 4.2
  `;
  assert.deepStrictEqual(parseFreezeLog(stderr, 10.0), [[1.5, 4.2]]);
});

test('parseFreezeLog handles multiple freezes', () => {
  const stderr = `
[freezedetect @ 0x123] freeze_start: 1.0
[freezedetect @ 0x123] freeze_end: 2.0
[freezedetect @ 0x123] freeze_start: 3.5
[freezedetect @ 0x123] freeze_end: 5.5
  `;
  assert.deepStrictEqual(parseFreezeLog(stderr, 10.0), [[1.0, 2.0], [3.5, 5.5]]);
});

test('parseFreezeLog handles an unterminated freeze', () => {
  const stderr = `
[freezedetect @ 0x123] freeze_start: 6.0
  `;
  assert.deepStrictEqual(parseFreezeLog(stderr, 10.0), [[6.0, 10.0]]);
});

test('longestFreeze picks max', () => {
  assert.strictEqual(longestFreeze([]), 0);
  assert.strictEqual(longestFreeze([[1.0, 3.0]]), 2.0);
  assert.strictEqual(longestFreeze([[1.0, 2.0], [3.0, 6.0], [7.0, 8.0]]), 3.0);
});
