import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadRunConfig, gateWaived } from './run-config.mjs';

function tmpWorkdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'run-config-test-'));
}

test('no run-config.json → safe defaults (heygen3 + full), configured=false', () => {
  const w = tmpWorkdir();
  const cfg = loadRunConfig(w);
  assert.equal(cfg.engine, 'heygen3');
  assert.equal(cfg.review, 'full');
  assert.equal(cfg.configured, false);
  fs.rmSync(w, { recursive: true, force: true });
});

test('written config loads with configured=true and extra fields intact', () => {
  const w = tmpWorkdir();
  fs.writeFileSync(path.join(w, 'run-config.json'), JSON.stringify({
    engine: 'heygen4', review: 'express', drive_folder: 'abc', drive_account: 'a@b.com',
  }));
  const cfg = loadRunConfig(w);
  assert.equal(cfg.engine, 'heygen4');
  assert.equal(cfg.review, 'express');
  assert.equal(cfg.drive_folder, 'abc');
  assert.equal(cfg.configured, true);
  fs.rmSync(w, { recursive: true, force: true });
});

test('invalid engine or review throws instead of silently defaulting', () => {
  const w = tmpWorkdir();
  fs.writeFileSync(path.join(w, 'run-config.json'), JSON.stringify({ engine: 'heygen5' }));
  assert.throws(() => loadRunConfig(w), /engine must be one of/);
  fs.writeFileSync(path.join(w, 'run-config.json'), JSON.stringify({ review: 'yolo' }));
  assert.throws(() => loadRunConfig(w), /review must be one of/);
  fs.rmSync(w, { recursive: true, force: true });
});

test('gateWaived: false in full mode and when unconfigured, true in express', () => {
  const w = tmpWorkdir();
  assert.equal(gateWaived(w, 'test-gate'), false);                       // no file
  fs.writeFileSync(path.join(w, 'run-config.json'), JSON.stringify({ review: 'full' }));
  assert.equal(gateWaived(w, 'test-gate'), false);                       // full
  fs.writeFileSync(path.join(w, 'run-config.json'), JSON.stringify({ review: 'express' }));
  assert.equal(gateWaived(w, 'test-gate'), true);                        // express
  fs.rmSync(w, { recursive: true, force: true });
});
