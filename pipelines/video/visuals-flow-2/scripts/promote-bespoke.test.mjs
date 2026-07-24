import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const TMP_ROOT = path.join(import.meta.dirname, '..', 'lib', '.test-tmp', 'promote');

test.before(() => {
  if (fs.existsSync(TMP_ROOT)) {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  }
});

test('promote-bespoke script', () => {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const workdir = fs.mkdtempSync(path.join(TMP_ROOT, 'bespoke-'));
  const bespokeDir = path.join(workdir, 'bespoke', 'test-card');
  fs.mkdirSync(bespokeDir, { recursive: true });
  fs.writeFileSync(path.join(bespokeDir, 'index.html'), 'DATA.beats');
  
  const cardLib = path.join(TMP_ROOT, 'card-library');
  fs.mkdirSync(cardLib, { recursive: true });

  const result = spawnSync(process.execPath, [
    path.join(import.meta.dirname, 'promote-bespoke.mjs'), 
    workdir, 
    'test-card', 
    'family/test-card'
  ], { encoding: 'utf8', env: { ...process.env, CARD_LIBRARY_ROOT: cardLib } });
  
  assert.equal(result.status, 0);
  assert.match(result.stdout, /family\/test-card/);
  assert.match(result.stdout, /"kind": "beat"/);
  assert.ok(fs.existsSync(path.join(cardLib, 'family', 'test-card', 'index.html')));

  // refuses existing target
  const result2 = spawnSync(process.execPath, [
    path.join(import.meta.dirname, 'promote-bespoke.mjs'), 
    workdir, 
    'test-card', 
    'family/test-card'
  ], { encoding: 'utf8', env: { ...process.env, CARD_LIBRARY_ROOT: cardLib } });
  assert.equal(result2.status, 1);
  assert.match(result2.stderr, /already exists/);
});
