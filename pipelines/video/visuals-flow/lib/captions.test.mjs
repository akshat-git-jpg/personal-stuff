import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { planCaptions, markKeyword, assEscape } from './captions.mjs';

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

test('assEscape', () => {
  assert.strictEqual(assEscape('hello {world} \\n'), 'hello \\{world\\} \\\\n');
});

test('ASS highlight pixel proof', () => {
  const pilCheck = spawnSync('python3', ['-c', 'import PIL']);
  if (pilCheck.status !== 0) {
    return; // skip if no PIL
  }
  
  const tmp = 'tmp-captest';
  fs.mkdirSync(path.join(import.meta.dirname, tmp), { recursive: true });
  
  const assText = `[Script Info]
ScriptType: v4.00+
PlayResX: 800
PlayResY: 600

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Helvetica,44,&H00FFFFFF,&H00000000,&H00000000,1,2,0,2,40,40,10,1

[Events]
Format: Layer, Start, End, Style, Text
Dialogue: 0,0:00:00.00,0:00:01.00,Cap,,0,0,0,,costs {\\1c&H3C92FB&}180{\\1c&HFFFFFF&} credits
Dialogue: 0,0:00:01.00,0:00:02.00,Cap,,0,0,0,,plain words only
`;
  
  const assFile = path.join(import.meta.dirname, tmp, 'fixture.ass');
  fs.writeFileSync(assFile, assText);
  
  const outPng0 = path.join(import.meta.dirname, tmp, 'cap-0.png');
  const outPng1 = path.join(import.meta.dirname, tmp, 'cap-1.png');
  
  const escapedAssPath = assFile.replace(/:/g, '\\\\:').replace(/'/g, "'\\\\''");
  
  spawnSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'color=c=black:s=800x600:d=2',
    '-vf', `subtitles=filename='${escapedAssPath}'`,
    '-ss', '0.5', '-vframes', '1', outPng0
  ], { encoding: 'utf8' });
  
  spawnSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'color=c=black:s=800x600:d=2',
    '-vf', `subtitles=filename='${escapedAssPath}'`,
    '-ss', '1.5', '-vframes', '1', outPng1
  ], { encoding: 'utf8' });
  
  const checkScript = `
from PIL import Image
import sys
def count_accent(path):
    img = Image.open(path).convert('RGBA')
    c = 0
    for r, g, b, a in img.getdata():
        if abs(r - 251) < 12 and abs(g - 146) < 12 and abs(b - 60) < 12:
            c += 1
    return c
print(count_accent(sys.argv[1]), count_accent(sys.argv[2]))
`;
  const pixelRes = spawnSync('python3', ['-c', checkScript, outPng0, outPng1], {
    encoding: 'utf8'
  });
  
  assert.strictEqual(pixelRes.status, 0, pixelRes.stderr);
  const [c0, c1] = pixelRes.stdout.trim().split(' ').map(Number);
  
  assert.ok(c0 > 50, `cap-0.png should have accent pixels (got ${c0})`);
  assert.strictEqual(c1, 0, `cap-1.png should have no accent pixels (got ${c1})`);
  
  fs.rmSync(path.join(import.meta.dirname, tmp), { recursive: true, force: true });
});
