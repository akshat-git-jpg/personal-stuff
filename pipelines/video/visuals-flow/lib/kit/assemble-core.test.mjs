import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { planSegments, drawtextFont, assembleEditPlan } from './index.mjs';

test('films anywhere: each is a base segment, the bed fills the gaps', () => {
  const segs = planSegments({ resolved: [], avatarJobs: [], total: 30, films: [
    { id: 'm01', start: 5, end: 9 }, { id: 'm02', start: 9, end: 12 }, { id: 'm03', start: 20, end: 24 }] });
  assert.deepEqual(segs.map((s) => [s.kind, s.id, s.start, s.end]), [
    ['screen', 'screen-01', 0, 5], ['film', 'm01', 5, 9], ['film', 'm02', 9, 12],
    ['screen', 'screen-02', 12, 20], ['film', 'm03', 20, 24], ['screen', 'screen-03', 24, 30]]);
});

test('only a shadowing film drops what starts inside it; the legacy opening film always shadows', () => {
  const resolved = [{ id: 'c1', placement: 'fullframe', start: 22, duration: 1 }];
  const kept = planSegments({ resolved, avatarJobs: [], total: 30, films: [{ id: 'm', start: 20, end: 24, shadows: true }] });
  assert.ok(!kept.some((s) => s.id === 'c1'));
  const legacy = planSegments({ resolved: [{ id: 'c0', placement: 'fullframe', start: 3, duration: 1 }], avatarJobs: [], total: 30, filmSpan: { id: 'intro', end: 8 } });
  assert.deepEqual(legacy.map((s) => [s.kind, s.id]), [['film', 'intro'], ['screen', 'screen-01']]);
});

test('drawtext font: first file present, Windows drive escaped, fontconfig name as the last resort', () => {
  assert.equal(drawtextFont({ candidates: ['/a.ttc', '/b.ttf'], exists: (p) => p === '/b.ttf' }), 'fontfile=/b.ttf');
  assert.equal(drawtextFont({ candidates: ['C:/Windows/Fonts/arial.ttf'], exists: () => true }), "fontfile='C\\:/Windows/Fonts/arial.ttf'");
  assert.equal(drawtextFont({ candidates: ['/nope'], exists: () => false }), 'font=Sans');
  if (process.platform === 'darwin' && fs.existsSync('/System/Library/Fonts/Helvetica.ttc')) {
    assert.equal(drawtextFont(), 'fontfile=/System/Library/Fonts/Helvetica.ttc');   // unchanged output on the Mac
  }
});

const hasFfmpeg = !spawnSync('ffmpeg', ['-version']).error;
test('two mid-timeline compositions, the plan audio, and the bed kept after the last clip', { skip: !hasFfmpeg && 'ffmpeg not found' }, async () => {
  const wd = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-comps-'));
  try {
    const ff = (args) => assert.equal(spawnSync('ffmpeg', ['-v', 'error', '-y', ...args]).status, 0);
    const clip = (name, colour, secs) => { const p = path.join(wd, name); ff(['-f', 'lavfi', '-i', `color=c=${colour}:s=320x180:r=30`, '-t', String(secs), '-pix_fmt', 'yuv420p', p]); return p; };
    const bed = clip('bed.mp4', 'green', 7);
    const red = clip('m01.mp4', 'red', 2), blue = clip('m02.mp4', 'blue', 1.5);
    const audio = path.join(wd, 'take.wav');   // not master.wav, not vo.mp3: only the plan names it
    ff(['-f', 'lavfi', '-i', 'sine=f=440:r=44100', '-t', '6', audio]);
    const out = path.join(wd, 'out.mp4');
    await assembleEditPlan({ total: 6, canvas: { w: 320, h: 180, fps: 30 }, audio: { src: audio }, clips: [
      { kind: 'footage', id: 'bed', src: bed },
      { kind: 'composition', id: 'm01', start: 1, end: 3, src: red },
      { kind: 'composition', id: 'm02', start: 3, end: 4.5, src: blue },
    ] }, { workdir: wd, out, encoder: 'x264', captions: 'off', transitions: 'none', beats: 'off', effects: 'off', holdTail: false });
    const rgbAt = (t) => {
      const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', String(t), '-i', out, '-frames:v', '1', '-vf', 'scale=1:1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1e6 });
      return [...r.stdout];
    };
    const dominant = (px) => ['r', 'g', 'b'][px.indexOf(Math.max(...px))];
    assert.deepEqual([0.5, 2, 3.7, 5.5].map((t) => dominant(rgbAt(t))), ['g', 'r', 'b', 'g']);
    assert.match(fs.readFileSync(path.join(wd, 'assembly.md'), 'utf8'), /Audio: take\.wav throughout/);
    const aDur = parseFloat(spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=duration', '-of', 'csv=p=0', out], { encoding: 'utf8' }).stdout);
    assert.ok(Math.abs(aDur - 6) < 0.1, `audio ${aDur}s`);
  } finally {
    fs.rmSync(wd, { recursive: true, force: true });
  }
});
