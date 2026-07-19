import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { planCaptions } from './captions.mjs';

test('planCaptions empty', () => {
  assert.deepStrictEqual(planCaptions([]), []);
});

test('planCaptions chunking by word cap', () => {
  const words = Array.from({length: 7}, (_, i) => ({
    text: `w${i}`,
    start: i,
    end: i + 0.5
  }));
  const res = planCaptions(words);
  assert.strictEqual(res.length, 2);
  assert.strictEqual(res[0].i, 0);
  assert.strictEqual(res[0].text, 'w0 w1 w2 w3 w4 w5');
  assert.strictEqual(res[1].i, 1);
  assert.strictEqual(res[1].text, 'w6');
});

test('planCaptions chunking by char cap', () => {
  const words = [
    { text: 'this_is_a_very_long_word_indeed', start: 0, end: 1 },
    { text: 'too_long', start: 1, end: 2 }
  ];
  const res = planCaptions(words);
  assert.strictEqual(res.length, 2);
  assert.strictEqual(res[0].text, 'this_is_a_very_long_word_indeed');
  assert.strictEqual(res[1].text, 'too_long');
});

test('planCaptions chunking by gap split', () => {
  const words = [
    { text: 'a', start: 0, end: 1 },
    { text: 'b', start: 1.6, end: 2 }
  ];
  const res = planCaptions(words);
  assert.strictEqual(res.length, 2);
  assert.strictEqual(res[0].text, 'a');
  assert.strictEqual(res[1].text, 'b');
});

test('planCaptions CAP_TAIL vs next-chunk clamp', () => {
  const words2 = [
    { text: 'a', start: 0, end: 1 },
    { text: 'b', start: 1.6, end: 2 },
    { text: 'c', start: 2.1, end: 2.2 }
  ];
  const res2 = planCaptions(words2);
  assert.strictEqual(res2.length, 2);
  assert.strictEqual(res2[0].end, 1.4);
  
  const words3 = [
    { text: 'w0', start: 0, end: 0.1 },
    { text: 'w1', start: 0.2, end: 0.3 },
    { text: 'w2', start: 0.4, end: 0.5 },
    { text: 'w3', start: 0.6, end: 0.7 },
    { text: 'w4', start: 0.8, end: 0.9 },
    { text: 'w5', start: 1.0, end: 1.1 },
    { text: 'w6', start: 1.2, end: 1.3 }
  ];
  const res3 = planCaptions(words3);
  assert.strictEqual(res3[0].end, 1.2);
});

test('caption-render.py directly', () => {
  const pilCheck = spawnSync('python3', ['-c', 'import PIL']);
  if (pilCheck.status !== 0) {
    return; // skip
  }
  
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'caption-test-'));
  const chunks = [
    { i: 0, text: 'Hello world' },
    { i: 1, text: 'Second chunk' }
  ];
  const stdin = JSON.stringify({
    outDir: tmp,
    width: 1000,
    fontPx: 44,
    chunks
  });
  
  const pyPath = path.resolve(import.meta.dirname, 'caption-render.py');
  const res = spawnSync('python3', [pyPath], {
    input: stdin,
    encoding: 'utf8'
  });
  
  assert.strictEqual(res.status, 0, res.stderr);
  assert.strictEqual(fs.existsSync(path.join(tmp, 'cap-0.png')), true);
  assert.strictEqual(fs.existsSync(path.join(tmp, 'cap-1.png')), true);
  
  const st0 = fs.statSync(path.join(tmp, 'cap-0.png'));
  const st1 = fs.statSync(path.join(tmp, 'cap-1.png'));
  assert.ok(st0.size > 0);
  assert.ok(st1.size > 0);
  
  fs.rmSync(tmp, { recursive: true, force: true });
});
