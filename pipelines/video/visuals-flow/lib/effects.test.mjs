import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const FIXTURE_DIR = path.join(import.meta.dirname, 'fixtures', 'board');
const TMP_ROOT = path.join(import.meta.dirname, '.test-tmp', 'effects');

function makeWorkdir() {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(TMP_ROOT, 'fx-'));
  for (const f of ['resolved.json', 'transcript.json']) {
    fs.copyFileSync(path.join(FIXTURE_DIR, f), path.join(dir, f));
  }
  return dir;
}

function runPlan(dir) {
  const res = spawnSync('node', [path.join(import.meta.dirname, 'effects-plan.mjs'), dir], { encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  return JSON.parse(fs.readFileSync(path.join(dir, 'effects.json'), 'utf8'));
}

test.before(() => {
  if (fs.existsSync(TMP_ROOT)) fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

test('effects-plan writes default instances for a fresh workdir', () => {
  const dir = makeWorkdir();
  const manifest = runPlan(dir);
  assert.ok(Array.isArray(manifest.instances));
  assert.ok(manifest.instances.length >= 1, 'expected at least one planned instance');
  assert.ok(manifest.instances.every((i) => typeof i.id === 'string' && typeof i.type === 'string' && typeof i.enabled === 'boolean'));
});

test('per-id overrides survive regeneration', () => {
  const dir = makeWorkdir();
  const first = runPlan(dir);
  const target = first.instances[0];
  const manifestPath = path.join(dir, 'effects.json');
  const edited = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  edited.instances.find((i) => i.id === target.id).enabled = false;
  fs.writeFileSync(manifestPath, JSON.stringify(edited, null, 2));
  const second = runPlan(dir);
  assert.equal(second.instances.find((i) => i.id === target.id).enabled, false, 'enabled override preserved on regen');
});
