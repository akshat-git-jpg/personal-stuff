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
