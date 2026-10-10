import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { motionReportMd } from './qc-motion.mjs';

const CLI = path.join(import.meta.dirname, 'qc-motion.mjs');

test('the report lists each dead beat as a warning and names the phone sheet', () => {
  const md = motionReportMd('/x/final-draft.mp4', { maxStill: 4, median: 3, threshold: 0.8, runs: [{ from: 10, to: 15.5, seconds: 5.5 }] }, '/q/phone.jpg');
  assert.match(md, /WARN 10\.00-15\.50s: 5\.5s with nothing new/);
  assert.match(md, /`\/q\/phone\.jpg`/);
});

test('it is report-only: a broken input still exits 0', () => {
  const r = spawnSync(process.execPath, [CLI, '/no/such/video.mp4', os.tmpdir()], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /motion qc skipped \(report-only\)/);
});

test('on a real file it writes motion.md and the phone sheet', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qc-motion-'));
  const v = path.join(dir, 'v.mp4');
  const g = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=gray:s=160x90:r=10:d=6', '-pix_fmt', 'yuv420p', v]);
  assert.equal(g.status, 0);
  const r = spawnSync(process.execPath, [CLI, v, dir], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /WARN: dead beat/);
  assert.ok(fs.existsSync(path.join(dir, 'motion.md')) && fs.existsSync(path.join(dir, 'phone.jpg')));
  fs.rmSync(dir, { recursive: true, force: true });
});
