import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync, execSync } from 'node:child_process';
import { extractFrames, frameLuma, detectFreezes } from './frames.mjs';
import { judge, GATE } from './film-gate.mjs';
import { probeDuration, probeDimensions } from './intake.mjs';
import { renderArgs, renderEnv } from './render-film.mjs';

const OUT_DIR = '.test-tmp/film';

function hasFfmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

test('render roundtrip and stillness detection', async (t) => {
  if (!hasFfmpeg()) {
    t.skip('ffmpeg not found');
    return;
  }
  
  t.after(() => {
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
  });
  
  fs.mkdirSync(OUT_DIR, { recursive: true });
  
  // 1. Render the fixture
  // Render through the SAME argv and env the pipeline uses. Hand-rolling either
  // here is how the gate once passed against a path production never took.
  const r = spawnSync('npx', renderArgs('lib/fixtures/film-fixture', path.join(OUT_DIR, 'out.mp4')), { stdio: 'pipe', env: renderEnv() });
  if (r.status !== 0) {
    console.error(r.stderr?.toString());
    throw new Error('hyperframes render failed');
  }
  
  const mp4 = path.join(OUT_DIR, 'out.mp4');
  assert.ok(fs.existsSync(mp4));
  
  // 2. Duration check
  const dur = probeDuration(mp4);
  assert.ok(Math.abs(dur - 3.0) <= 0.15, `duration ${dur} not ~3.0`);

  // 2b. The fixture must come out landscape. Sizing a composition only in CSS
  // makes Hyperframes fall back to portrait 1080x1920 — caught here, not by eye.
  const dims = probeDimensions(mp4);
  assert.strictEqual(dims.width, GATE.WIDTH, `width ${dims.width} != ${GATE.WIDTH}`);
  assert.strictEqual(dims.height, GATE.HEIGHT, `height ${dims.height} != ${GATE.HEIGHT}`);
  
  // 3. Extract frames
  const framesDir = path.join(OUT_DIR, 'frames');
  const pngs = extractFrames(mp4, framesDir, 2);
  assert.ok(pngs.length >= 5, `Expected >=5 frames, got ${pngs.length}`);
  
  // 4. Distinct frame hashes
  const hashes = new Set();
  for (const png of pngs) {
    const data = fs.readFileSync(path.join(framesDir, png));
    const hash = crypto.createHash('md5').update(data).digest('hex');
    hashes.add(hash);
  }
  assert.ok(hashes.size >= 3, `Expected >=3 distinct frames, got ${hashes.size}`);
  
  // 5. Luma assertions
  const luma = frameLuma(mp4);
  const range = Math.max(...luma) - Math.min(...luma);
  const mean = luma.reduce((a, b) => a + b, 0) / luma.length;
  assert.ok(range > GATE.MIN_LUMA_RANGE, `range ${range} <= ${GATE.MIN_LUMA_RANGE}`);
  assert.ok(mean > GATE.MIN_MEAN_LUMA, `mean ${mean} <= ${GATE.MIN_MEAN_LUMA}`);
  
  // 6. Negative control
  const frozenMp4 = path.join(OUT_DIR, 'frozen.mp4');
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=gray:s=320x180:d=5', '-r', '30', frozenMp4]);
  
  const frozenFreezes = detectFreezes(frozenMp4, 5.0);
  const frozenLuma = frameLuma(frozenMp4);
  const res = judge({ renderDuration: 5.0, introDuration: 5.0, luma: frozenLuma, freezes: frozenFreezes, width: GATE.WIDTH, height: GATE.HEIGHT });
  
  assert.strictEqual(res.pass, false);
  assert.ok(res.failures.some(f => f.startsWith('G2')));
  assert.ok(res.failures.some(f => f.startsWith('G4')));
}, { timeout: 60000 });
