import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadRunConfig } from './run-config.mjs';

function tmpWorkdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'run-config-test-'));
}

test('no run-config.json → configured=false, no engine/review/intro key', () => {
  const w = tmpWorkdir();
  const cfg = loadRunConfig(w);
  assert.equal(cfg.configured, false);
  assert.equal('engine' in cfg, false);
  assert.equal('review' in cfg, false);
  assert.equal('intro' in cfg, false);
  fs.rmSync(w, { recursive: true, force: true });
});

test('written config loads with configured=true and extra fields intact', () => {
  const w = tmpWorkdir();
  fs.writeFileSync(path.join(w, 'run-config.json'), JSON.stringify({
    drive_folder: 'abc', drive_account: 'a@b.com',
  }));
  const cfg = loadRunConfig(w);
  assert.equal(cfg.drive_folder, 'abc');
  assert.equal(cfg.drive_account, 'a@b.com');
  assert.equal(cfg.configured, true);
  fs.rmSync(w, { recursive: true, force: true });
});

// The avatar spend gate (lib/avatar-plan.mjs, step 102) is the single
// spelling of this decision now — a run-config.json left over from before
// plan 197 must not resurrect the old kickoff engine choice.
test('a stale engine/review/intro key on disk is stripped, not passed through', () => {
  const w = tmpWorkdir();
  fs.writeFileSync(path.join(w, 'run-config.json'), JSON.stringify({
    engine: 'heygen4', review: 'express', intro: 'film', drive_folder: 'abc',
  }));
  const cfg = loadRunConfig(w);
  assert.equal('engine' in cfg, false);
  assert.equal('review' in cfg, false);
  assert.equal('intro' in cfg, false);
  assert.equal(cfg.drive_folder, 'abc');
  fs.rmSync(w, { recursive: true, force: true });
});

test('introMode defaults to simple', () => {
  const w = tmpWorkdir();
  const cfg = loadRunConfig(w);
  assert.equal(cfg.introMode, 'simple');
  fs.rmSync(w, { recursive: true, force: true });
});

test('introMode overrides correctly', () => {
  const w = tmpWorkdir();
  fs.writeFileSync(path.join(w, 'run-config.json'), JSON.stringify({
    introMode: 'complex',
  }));
  const cfg = loadRunConfig(w);
  assert.equal(cfg.introMode, 'complex');
  fs.rmSync(w, { recursive: true, force: true });
});

test('introMode typo throws', () => {
  const w = tmpWorkdir();
  fs.writeFileSync(path.join(w, 'run-config.json'), JSON.stringify({
    introMode: 'simpel',
  }));
  assert.throws(() => loadRunConfig(w), /introMode "simpel"/);
  fs.rmSync(w, { recursive: true, force: true });
});
