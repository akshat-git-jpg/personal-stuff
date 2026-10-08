import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  parseArgs, parseTime, isUrl, pathsFor, selectFrameTimes, evenPick, pickBursts,
  layoutSheets, dominantColors, toHex, fmtTime, renderPrompt, stageFiles,
} from './from-reference.mjs';

test('parseTime accepts seconds, m:ss and h:mm:ss', () => {
  assert.equal(parseTime('75'), 75);
  assert.equal(parseTime('2:33.3'), 153.3);
  assert.equal(parseTime('1:02:03'), 3723);
  assert.equal(parseTime(undefined), undefined);
  assert.throws(() => parseTime('abc'), /bad time/);
});

test('parseArgs reads a full command', () => {
  const o = parseArgs(['https://youtu.be/x', '--name', 'my-style', '--start', '1:00', '--end', '1:30', '--crop', '10:20:0:0', '--no-author']);
  assert.equal(o.source, 'https://youtu.be/x');
  assert.equal(o.name, 'my-style');
  assert.equal(o.start, 60);
  assert.equal(o.end, 90);
  assert.equal(o.crop, '10:20:0:0');
  assert.equal(o.author, false);
  assert.equal(o.frames, 48);
});

test('parseArgs rejects bad input', () => {
  assert.throws(() => parseArgs(['a.mp4']), /--name/);
  assert.throws(() => parseArgs(['a.mp4', '--name', 'Bad Name']), /kebab/);
  assert.throws(() => parseArgs(['a.mp4', '--name', 'default']), /reserved/);
  assert.throws(() => parseArgs(['a.mp4', '--name', 'x', '--start', '20', '--end', '10']), /after/);
  assert.throws(() => parseArgs(['a.mp4', '--name', 'x', '--crop', '10x10']), /W:H:X:Y/);
  assert.throws(() => parseArgs(['a.mp4', '--name', 'x', '--bogus']), /unknown flag/);
  assert.throws(() => parseArgs(['a.mp4', 'b.mp4', '--name', 'x']), /exactly one/);
  assert.equal(parseArgs(['--help']).help, true);
});

test('isUrl', () => {
  assert.equal(isUrl('https://youtu.be/abc'), true);
  assert.equal(isUrl('/tmp/a.mp4'), false);
});

test('pathsFor keeps media in scratch and only the reference in the repo', () => {
  const p = pathsFor('flat', '/repo/ds', '/scratch');
  assert.equal(p.reference, '/repo/ds/flat/reference');
  assert.equal(p.design, '/repo/ds/flat/DESIGN.md');
  assert.equal(p.tokens, '/repo/ds/flat/tokens.json');
  assert.equal(p.video, '/scratch/flat/source.mp4');
  assert.equal(p.frames, '/scratch/flat/frames');
  assert.equal(p.stage, '/scratch/flat/stage');
});

test('selectFrameTimes hits the target, is sorted and in range', () => {
  const times = selectFrameTimes({ duration: 40, sceneTimes: [5, 5.1, 12, 30], target: 32 });
  assert.equal(times.length, 32);
  for (let i = 1; i < times.length; i++) assert.ok(times[i].t > times[i - 1].t);
  assert.ok(times.every((x) => x.t >= 0 && x.t <= 40));
});

test('selectFrameTimes keeps scene cuts, nudged past the cut, and drops near-duplicates', () => {
  const times = selectFrameTimes({ duration: 40, sceneTimes: [5, 5.1, 12], target: 32 });
  const scenes = times.filter((x) => x.kind === 'scene').map((x) => x.t);
  assert.deepEqual(scenes, [5.3, 12.3]);
});

test('selectFrameTimes caps scene frames at half the target', () => {
  const cuts = Array.from({ length: 60 }, (_, i) => i * 0.6);
  const times = selectFrameTimes({ duration: 36, sceneTimes: cuts, target: 20 });
  assert.equal(times.length, 20);
  assert.ok(times.filter((x) => x.kind === 'scene').length <= 10);
});

test('selectFrameTimes with no duration is empty', () => {
  assert.deepEqual(selectFrameTimes({ duration: 0 }), []);
});

test('evenPick spreads picks across the list', () => {
  assert.deepEqual(evenPick([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 2), [3, 8]);
  assert.deepEqual(evenPick([1, 2], 5), [1, 2]);
  assert.deepEqual(evenPick([1, 2], 0), []);
});

test('pickBursts prefers soft change over hard cuts and spaces windows', () => {
  const scores = [
    { t: 3, score: 0.9 },                     // hard cut, ignored
    { t: 10, score: 0.1 }, { t: 10.2, score: 0.1 }, { t: 10.4, score: 0.1 },
    { t: 10.6, score: 0.05 },                 // same burst as 10s, not a second one
    { t: 20, score: 0.05 },
  ];
  const b = pickBursts(scores, { count: 3, duration: 30, cut: 0.3 });
  assert.equal(b.length, 2);
  assert.ok(Math.abs(b[0].start - 9.933) < 0.01);
  assert.ok(b.every((w) => w.start + 0.8 <= 30));
  assert.ok(b[1].start > 19 && b[1].start < 20);
});

test('layoutSheets numbers sheets and cells', () => {
  const l = layoutSheets(50, 24);
  assert.deepEqual(l[0], { sheet: 1, cell: 1, of: 3 });
  assert.deepEqual(l[23], { sheet: 1, cell: 24, of: 3 });
  assert.deepEqual(l[24], { sheet: 2, cell: 1, of: 3 });
  assert.deepEqual(l[49], { sheet: 3, cell: 2, of: 3 });
});

test('dominantColors ranks by share and merges near shades', () => {
  const px = [];
  for (let i = 0; i < 70; i++) px.push(233, 189, 56);
  for (let i = 0; i < 10; i++) px.push(236, 190, 58);
  for (let i = 0; i < 20; i++) px.push(216, 50, 50);
  const c = dominantColors(Buffer.from(px));
  assert.equal(c.length, 2);
  assert.equal(c[0].share, 0.8);
  assert.equal(c[1].hex, '#d83232');
});

test('toHex and fmtTime', () => {
  assert.equal(toHex(255, 0, 15.6), '#ff0010');
  assert.equal(fmtTime(153.3), '2:33.3');
  assert.equal(fmtTime(5), '0:05.0');
});

test('renderPrompt fills name and sheet list', () => {
  const out = renderPrompt('# {{NAME}}\n{{SHEETS}}\n{{NAME}}', { name: 'flat', sheets: [{ file: 'sheet-1.jpg', kind: 'overview' }] });
  assert.equal(out, '# flat\n- sheet-1.jpg (overview)\nflat');
});

test('stageFiles puts only sheets, index and prompt in the stage', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-stage-'));
  const p = pathsFor('x', path.join(tmp, 'repo'), path.join(tmp, 'scratch'));
  fs.mkdirSync(p.sheets, { recursive: true });
  fs.writeFileSync(path.join(p.sheets, 'sheet-1.jpg'), 'img');
  fs.mkdirSync(p.stage, { recursive: true });
  fs.writeFileSync(path.join(p.stage, 'stale.txt'), 'old');
  stageFiles(p, { name: 'x', sheets: [{ file: 'sheet-1.jpg', kind: 'overview' }] }, 'prompt');
  assert.deepEqual(fs.readdirSync(p.stage).sort(), ['PROMPT.md', 'frames.json', 'sheet-1.jpg']);
  fs.rmSync(tmp, { recursive: true, force: true });
});
