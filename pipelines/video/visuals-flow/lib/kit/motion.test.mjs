import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { deadRuns, busyCells, motionGrid, deadBeats, motionMap, phoneSheet, probeVideo } from './motion.mjs';
import { parseProbeOutput } from './composition-probe.mjs';

test('a still stretch longer than the limit is one dead beat; exempt spans are skipped', () => {
  const pts = [];
  for (let t = 0.5; t < 12; t += 0.25) pts.push([t, t >= 3 && t < 8.5 ? 0.1 : 5]);
  const r = deadRuns(pts, { maxStill: 4, end: 12 });
  assert.deepEqual(r.runs, [{ from: 3, to: 8.5, seconds: 5.5 }]);
  assert.deepEqual(deadRuns(pts, { maxStill: 6, end: 12 }).runs, []);
  assert.deepEqual(deadRuns(pts, { maxStill: 4, end: 12, exempt: [[2, 9]] }).runs, []);
});

test('a still tail runs to the end of the video', () => {
  const pts = [[0.5, 5], [1, 5], [1.5, 0], [2, 0], [2.5, 0]];
  assert.deepEqual(deadRuns(pts, { maxStill: 1, end: 3 }).runs, [{ from: 1.5, to: 3, seconds: 1.5 }]);
});

test('busy cells are the ones near the busiest, boxed in fractions', () => {
  const grid = [0, 0, 0, 0, 0, 9, 8, 0, 0, 0, 0, 0];
  const r = busyCells(grid, { cols: 4, rows: 3 });
  assert.deepEqual(r.box, { x0: 0.25, y0: 1 / 3, x1: 0.75, y1: 2 / 3 });
  assert.equal(busyCells(grid.map(() => 0.1), { cols: 4, rows: 3 }).box, null);
});

test('motionGrid puts change in the cell where pixels moved', () => {
  const w = 4, h = 2, px = w * h, data = Buffer.alloc(px * 2);
  data[px + 3] = 200; // frame 1, top-right pixel
  const g = motionGrid({ data, w, h, px, n: 2 }, { cols: 2, rows: 1 });
  assert.equal(g[0], 0);
  assert.ok(g[1] > 0);
});

test('the probe result is read back from the dumped page', () => {
  assert.deepEqual(parseProbeOutput('<html><script id="__probe">PROBE>>{"ok":true,"a":"&lt;b&gt;"}<<PROBE</script></html>'), { ok: true, a: '<b>' });
  assert.throws(() => parseProbeOutput('<html></html>'), /no result/);
});

test('on a real file: a frozen half is a dead beat, motion is mapped, the phone sheet tiles', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-motion-'));
  const v = path.join(dir, 'v.mp4');
  // 3s of moving test pattern, then 5s frozen on one colour; motion lives in the left half only.
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=160x90:r=10:d=3', '-f', 'lavfi', '-i', 'color=c=gray:s=160x90:r=10:d=5',
    '-filter_complex', '[0:v]crop=80:90:0:0,pad=160:90:0:0:gray[a];[a][1:v]concat=n=2:v=1[o]', '-map', '[o]', '-pix_fmt', 'yuv420p', v]);
  assert.equal(r.status, 0, String(r.stderr));
  assert.equal(probeVideo(v).w, 160);
  const d = deadBeats(v, { maxStill: 4 });
  assert.equal(d.runs.length, 1);
  assert.ok(d.runs[0].from >= 2.5 && d.runs[0].from <= 3.5, JSON.stringify(d.runs));
  const m = motionMap(v, { from: 0, to: 3, cols: 2, rows: 1 });
  assert.deepEqual(m.box, { x0: 0, y0: 0, x1: 0.5, y1: 1 });
  const s = phoneSheet(v, path.join(dir, 'phone.jpg'));
  assert.ok(fs.existsSync(s.out));
  assert.equal(s.frames, 8);
  fs.rmSync(dir, { recursive: true, force: true });
});
