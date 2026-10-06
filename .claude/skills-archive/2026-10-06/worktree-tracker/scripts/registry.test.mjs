import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, 'registry.mjs');

function run(regPath, args) {
  return execFileSync('node', [SCRIPT, regPath, ...args], { encoding: 'utf8' });
}
function runFail(regPath, args) {
  try {
    execFileSync('node', [SCRIPT, regPath, ...args], { encoding: 'utf8', stdio: 'pipe' });
    return null;
  } catch (e) {
    return e;
  }
}
function freshRegPath() {
  const dir = mkdtempSync(join(tmpdir(), 'wt-reg-'));
  return join(dir, '.registry.json');
}

test('init creates an empty registry', () => {
  const p = freshRegPath();
  assert.equal(run(p, ['init']).trim(), 'ok');
  assert.ok(existsSync(p));
  assert.deepEqual(JSON.parse(readFileSync(p, 'utf8')), { version: 1, sets: {} });
});

test('list on missing registry returns empty structure', () => {
  const p = freshRegPath();
  assert.deepEqual(JSON.parse(run(p, ['list'])), { version: 1, sets: {} });
});

test('add-set then get returns the set', () => {
  const p = freshRegPath();
  run(p, ['add-set', 'policy-platform', '--workspace', '/ws/policy-platform.code-workspace']);
  const set = JSON.parse(run(p, ['get', 'policy-platform']));
  assert.equal(set.workspaceFile, '/ws/policy-platform.code-workspace');
  assert.deepEqual(set.members, {});
  assert.match(set.createdAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('add-set twice fails', () => {
  const p = freshRegPath();
  run(p, ['add-set', 's', '--workspace', '/ws']);
  const e = runFail(p, ['add-set', 's', '--workspace', '/ws']);
  assert.ok(e);
  assert.equal(e.status, 1);
  assert.match(e.stderr, /already exists/);
});

test('add-set requires --workspace', () => {
  const p = freshRegPath();
  const e = runFail(p, ['add-set', 's']);
  assert.ok(e);
  assert.match(e.stderr, /--workspace/);
});

test('get unknown set fails', () => {
  const p = freshRegPath();
  const e = runFail(p, ['get', 'nope']);
  assert.ok(e);
  assert.match(e.stderr, /set not found/);
});

test('add-member records branch/path/source', () => {
  const p = freshRegPath();
  run(p, ['add-set', 's', '--workspace', '/ws']);
  run(p, ['add-member', 's', 'dashboard-api', '--branch', 'feature/x', '--path', '/wt/s.dashboard-api', '--source', '/codebase/dashboard-api']);
  const m = JSON.parse(run(p, ['get', 's'])).members['dashboard-api'];
  assert.equal(m.branch, 'feature/x');
  assert.equal(m.worktreePath, '/wt/s.dashboard-api');
  assert.equal(m.sourceRepo, '/codebase/dashboard-api');
  assert.match(m.createdAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('add-member to missing set fails', () => {
  const p = freshRegPath();
  const e = runFail(p, ['add-member', 'nope', 'r', '--branch', 'b', '--path', '/p', '--source', '/s']);
  assert.ok(e);
  assert.match(e.stderr, /set not found/);
});

test('remove-member removes only that member', () => {
  const p = freshRegPath();
  run(p, ['add-set', 's', '--workspace', '/ws']);
  run(p, ['add-member', 's', 'a', '--branch', 'b', '--path', '/p/a', '--source', '/s/a']);
  run(p, ['add-member', 's', 'b', '--branch', 'b', '--path', '/p/b', '--source', '/s/b']);
  run(p, ['remove-member', 's', 'a']);
  assert.deepEqual(Object.keys(JSON.parse(run(p, ['get', 's'])).members), ['b']);
});

test('set-branch updates recorded branch', () => {
  const p = freshRegPath();
  run(p, ['add-set', 's', '--workspace', '/ws']);
  run(p, ['add-member', 's', 'a', '--branch', 'old', '--path', '/p/a', '--source', '/s/a']);
  run(p, ['set-branch', 's', 'a', 'new']);
  assert.equal(JSON.parse(run(p, ['get', 's'])).members['a'].branch, 'new');
});

test('remove-set deletes the whole set', () => {
  const p = freshRegPath();
  run(p, ['add-set', 's', '--workspace', '/ws']);
  run(p, ['remove-set', 's']);
  assert.deepEqual(JSON.parse(run(p, ['list'])).sets, {});
});

test('unknown command fails', () => {
  const p = freshRegPath();
  const e = runFail(p, ['frobnicate']);
  assert.ok(e);
  assert.match(e.stderr, /unknown command/);
});
