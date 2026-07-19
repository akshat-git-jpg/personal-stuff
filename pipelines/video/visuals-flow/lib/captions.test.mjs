import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { planCaptions, markKeyword } from './captions.mjs';

test('markKeyword rules', () => {
  assert.strictEqual(markKeyword('180'), true);
  assert.strictEqual(markKeyword('$49'), true);
  assert.strictEqual(markKeyword('93%'), true);
  assert.strictEqual(markKeyword('HeyGen'), true);
  assert.strictEqual(markKeyword('INSANE'), true);
  assert.strictEqual(markKeyword('the'), false);
  assert.strictEqual(markKeyword('A'), false);
  assert.strictEqual(markKeyword('Kling,'), false);
});

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
  assert.ok(res[0].words);
  assert.strictEqual(res[0].words.length, 6);
  assert.strictEqual(res[1].words.length, 1);
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

test('caption-render.py highlight pixel proof', () => {
  const pilCheck = spawnSync('python3', ['-c', 'import PIL']);
  if (pilCheck.status !== 0) {
    return; // skip
  }
  
  const tmp = 'tmp-captest';
  const chunks = [
    { i: 0, text: 'costs 180 credits', words: [
      { text: 'costs', hl: false }, { text: '180', hl: true }, { text: 'credits', hl: false } ],
      start: 0, end: 1 },
    { i: 1, text: 'plain words only', words: [
      { text: 'plain', hl: false }, { text: 'words', hl: false }, { text: 'only', hl: false } ],
      start: 1, end: 2 }
  ];
  const stdin = JSON.stringify({
    outDir: tmp,
    width: 800,
    fontPx: 44,
    chunks
  });
  
  const pyPath = path.resolve(import.meta.dirname, 'caption-render.py');
  const res = spawnSync('python3', [pyPath], {
    cwd: import.meta.dirname,
    input: stdin,
    encoding: 'utf8'
  });
  
  assert.strictEqual(res.status, 0, res.stderr);
  assert.ok(res.stdout.includes('2 rendered'));
  
  const checkScript = `
from PIL import Image
def count_accent(path):
    img = Image.open(path).convert('RGBA')
    c = 0
    for r, g, b, a in img.getdata():
        if abs(r - 251) < 12 and abs(g - 146) < 12 and abs(b - 60) < 12:
            c += 1
    return c
print(count_accent('${tmp}/cap-0.png'), count_accent('${tmp}/cap-1.png'))
`;
  const pixelRes = spawnSync('python3', ['-c', checkScript], {
    cwd: import.meta.dirname,
    encoding: 'utf8'
  });
  
  assert.strictEqual(pixelRes.status, 0, pixelRes.stderr);
  const [c0, c1] = pixelRes.stdout.trim().split(' ').map(Number);
  
  assert.ok(c0 > 50, `cap-0.png should have accent pixels (got ${c0})`);
  assert.strictEqual(c1, 0, `cap-1.png should have no accent pixels (got ${c1})`);
  
  fs.rmSync(path.resolve(import.meta.dirname, tmp), { recursive: true, force: true });
});
