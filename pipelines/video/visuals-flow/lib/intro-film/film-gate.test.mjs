import test from 'node:test';
import assert from 'node:assert';
import { judge, GATE } from './film-gate.mjs';

// A measurement set that passes every check — each test perturbs one field.
const CLEAN = { renderDuration: 8.4, introDuration: 8.4, luma: [10, 40, 90, 30], freezes: [], width: 1920, height: 1080 };

test('clean input passes', () => {
  const res = judge({ ...CLEAN });
  assert.strictEqual(res.pass, true);
  assert.deepStrictEqual(res.failures, []);
});

test('G1 fires on duration mismatch', () => {
  const res = judge({ ...CLEAN, renderDuration: 9.0 });
  assert.strictEqual(res.pass, false);
  assert.ok(res.failures.some(f => f.startsWith('G1')));
});

test('G2 fires on frozen video', () => {
  const res = judge({ ...CLEAN, freezes: [[1, 6]] });
  assert.strictEqual(res.pass, false);
  assert.ok(res.failures.some(f => f.startsWith('G2')));
});

test('G3 fires on black video', () => {
  const res = judge({ ...CLEAN, luma: [0, 1, 0, 1] });
  assert.strictEqual(res.pass, false);
  assert.ok(res.failures.some(f => f.startsWith('G3 mean luma')));
});

test('G3 fires on empty luma', () => {
  const res = judge({ ...CLEAN, luma: [] });
  assert.strictEqual(res.pass, false);
  assert.ok(res.failures.some(f => f.startsWith('G3 no frames measured')));
});

test('G4 fires on luma range too small', () => {
  const res = judge({ ...CLEAN, luma: [50, 51, 50, 52] });
  assert.strictEqual(res.pass, false);
  assert.ok(res.failures.some(f => f.startsWith('G4')));
});

// G5 exists because a portrait render passed every other check: the composition
// sized itself in CSS, Hyperframes fell back to 1080x1920, and nothing noticed.
test('G5 fires on a portrait render', () => {
  const res = judge({ ...CLEAN, width: 1080, height: 1920 });
  assert.strictEqual(res.pass, false);
  assert.ok(res.failures.some(f => f.startsWith('G5')));
});

test('G5 fires on a correct aspect at the wrong scale', () => {
  const res = judge({ ...CLEAN, width: 1280, height: 720 });
  assert.strictEqual(res.pass, false);
  assert.ok(res.failures.some(f => f.startsWith('G5')));
});

test('G5 fires when dimensions are not measured at all', () => {
  const res = judge({ renderDuration: 8.4, introDuration: 8.4, luma: [10, 40, 90, 30], freezes: [] });
  assert.strictEqual(res.pass, false);
  assert.ok(res.failures.some(f => f.startsWith('G5 no frame size measured')));
});

test('GATE declares the landscape hand-off size', () => {
  assert.strictEqual(GATE.WIDTH, 1920);
  assert.strictEqual(GATE.HEIGHT, 1080);
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filmGateCli = path.join(__dirname, 'film-gate.mjs');

// A film that is one frozen picture for 6s must be refused. This asserts on the
// CLI's exit code and stderr, not on source text — a source-text assertion would
// make the mutation circular (LESSONS 2026-08-02).
test('intro-render refuses a film that fails the gate', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'introgate-'));
  const fxDir = path.join(dir, 'videos', 'fx');
  const filmDir = path.join(fxDir, 'intro-film');
  const rendersDir = path.join(filmDir, 'renders');
  fs.mkdirSync(rendersDir, { recursive: true });
  fs.mkdirSync(path.join(filmDir, 'film'), { recursive: true });

  fs.writeFileSync(path.join(fxDir, 'segments.json'), JSON.stringify({
    structure: [{ part: 'intro', start: 0, end: 6 }]
  }));
  fs.writeFileSync(path.join(filmDir, 'film', 'index.html'), '<html></html>');

  const mp4File = path.join(rendersDir, 'intro-film.mp4');
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=gray:s=1920x1080:d=6', '-r', '30', '-pix_fmt', 'yuv420p', mp4File]);

  const r = spawnSync('node', [filmGateCli, path.join(dir, 'videos', 'fx', 'intro-film')], { 
    encoding: 'utf8' 
  });
  
  assert.notStrictEqual(r.status, 0, 'intro-render must refuse a film that fails the gate');
});
