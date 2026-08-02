import test from 'node:test';
import assert from 'node:assert';
import { judge, GATE } from './film-gate.mjs';

test('clean input passes', () => {
  const res = judge({ renderDuration: 8.4, introDuration: 8.4, luma: [10, 40, 90, 30], freezes: [] });
  assert.strictEqual(res.pass, true);
  assert.deepStrictEqual(res.failures, []);
});

test('G1 fires on duration mismatch', () => {
  const res = judge({ renderDuration: 9.0, introDuration: 8.4, luma: [10, 40, 90, 30], freezes: [] });
  assert.strictEqual(res.pass, false);
  assert.ok(res.failures.some(f => f.startsWith('G1')));
});

test('G2 fires on frozen video', () => {
  const res = judge({ renderDuration: 8.4, introDuration: 8.4, luma: [10, 40, 90, 30], freezes: [[1, 6]] });
  assert.strictEqual(res.pass, false);
  assert.ok(res.failures.some(f => f.startsWith('G2')));
});

test('G3 fires on black video', () => {
  const res = judge({ renderDuration: 8.4, introDuration: 8.4, luma: [0, 1, 0, 1], freezes: [] });
  assert.strictEqual(res.pass, false);
  assert.ok(res.failures.some(f => f.startsWith('G3 mean luma')));
});

test('G3 fires on empty luma', () => {
  const res = judge({ renderDuration: 8.4, introDuration: 8.4, luma: [], freezes: [] });
  assert.strictEqual(res.pass, false);
  assert.ok(res.failures.some(f => f.startsWith('G3 no frames measured')));
});

test('G4 fires on luma range too small', () => {
  const res = judge({ renderDuration: 8.4, introDuration: 8.4, luma: [50, 51, 50, 52], freezes: [] });
  assert.strictEqual(res.pass, false);
  assert.ok(res.failures.some(f => f.startsWith('G4')));
});
