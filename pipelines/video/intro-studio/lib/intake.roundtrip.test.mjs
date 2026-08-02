import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runIntake } from './intake.mjs';
import { resolveWorkdir } from './workdir.mjs';

test('runIntake roundtrip', async (t) => {
  const ffmpegCheck = spawnSync('ffmpeg', ['-version']);
  if (ffmpegCheck.error || ffmpegCheck.status !== 0) {
    t.skip('ffmpeg is not on PATH');
    return;
  }

  const slug = '.test-tmp/rt';
  const workdir = resolveWorkdir(slug);
  const inputDir = path.join(workdir, 'input');
  
  // ensure clean state for the test
  if (fs.existsSync(workdir)) fs.rmSync(workdir, { recursive: true, force: true });
  fs.mkdirSync(inputDir, { recursive: true });

  t.after(() => {
    if (fs.existsSync(workdir)) fs.rmSync(workdir, { recursive: true, force: true });
  });

  const inputMp4 = path.join(inputDir, 'intro.mp4');
  const genResult = spawnSync('ffmpeg', [
    '-y', '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=30:duration=6',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=6',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', inputMp4
  ], { stdio: 'ignore' });
  
  assert.strictEqual(genResult.status, 0, 'ffmpeg fixture generation failed');
  assert.ok(fs.existsSync(inputMp4), 'fixture video created');

  const meta = runIntake(slug);

  assert.ok(fs.existsSync(path.join(workdir, 'vo.mp3')), 'vo.mp3 exists');
  assert.ok(fs.existsSync(path.join(workdir, 'screen.mp4')), 'screen.mp4 exists');
  assert.ok(fs.existsSync(path.join(workdir, 'intake.json')), 'intake.json exists');

  const voStats = fs.statSync(path.join(workdir, 'vo.mp3'));
  assert.ok(voStats.size > 0, 'vo.mp3 is not empty');
  
  const screenStats = fs.statSync(path.join(workdir, 'screen.mp4'));
  assert.ok(screenStats.size > 0, 'screen.mp4 is not empty');

  const intakeData = JSON.parse(fs.readFileSync(path.join(workdir, 'intake.json'), 'utf8'));
  assert.strictEqual(intakeData.slug, 'rt', 'slug is recorded');
  assert.ok(Math.abs(intakeData.duration - 6) <= 0.3, `duration ${intakeData.duration} is within 0.3s of 6`);

  const ffprobeResult = spawnSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path.join(workdir, 'screen.mp4')
  ], { encoding: 'utf8' });
  
  assert.strictEqual(ffprobeResult.status, 0, 'ffprobe failed');
  assert.strictEqual(String(ffprobeResult.stdout).trim(), '1920,1080', 'screen pass is 1920x1080');
});
