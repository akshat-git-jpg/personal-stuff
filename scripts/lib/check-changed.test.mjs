import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseVerifyMap, pickCommands, changedPaths } from './check-changed.mjs';
import { testJobs } from './test-jobs.mjs';

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), 'check-changed.mjs');
const ROWS = [
  { prefix: 'a/', full: 'full-a', fast: null },
  { prefix: 'b/', full: 'full-b', fast: 'fast-b' },
  { prefix: 'b/sub/', full: 'full-b', fast: 'fast-b' },
];

function git(dir, ...args) { execFileSync('git', args, { cwd: dir, stdio: 'pipe' }); }
function write(dir, rel, text = 'x\n') {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
}
// A repo with one commit on main and a branch carrying a committed, a staged and an untracked change.
function repoWithChanges(committed = 'c/one.txt') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-changed-'));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 't@t');
  git(dir, 'config', 'user.name', 't');
  write(dir, 'base.txt');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'base');
  git(dir, 'checkout', '-q', '-b', 'work');
  write(dir, committed);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'one');
  write(dir, 's/two.txt');
  git(dir, 'add', 's/two.txt');
  write(dir, 'u/three.txt');
  return dir;
}

test('parseVerifyMap reads 2- and 3-column rows and skips comments', () => {
  const rows = parseVerifyMap('# c\n\na/\tfull-a\nb/\tfull-b\tfast-b\r\nc/\t\n');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].fast, null);
  assert.equal(rows[1].fast, 'fast-b');
  assert.equal(rows[1].full, 'full-b');
});

test('pickCommands prefers fast, falls back to full, and dedupes', () => {
  const { commands, unmapped } = pickCommands(ROWS, ['a/x', 'b/sub/y', 'z/q']);
  assert.deepEqual(commands, [{ cmd: 'full-a', tier: 'full' }, { cmd: 'fast-b', tier: 'fast' }]);
  assert.deepEqual(unmapped, ['z/q']);
});

test('pickCommands --full ignores the fast column', () => {
  const { commands } = pickCommands(ROWS, ['a/x', 'b/sub/y'], { full: true });
  assert.ok(commands.every(c => c.tier === 'full'));
  assert.deepEqual(commands.map(c => c.cmd), ['full-a', 'full-b']);
});

test('changedPaths sees committed, staged and untracked changes', () => {
  const dir = repoWithChanges();
  assert.deepEqual(changedPaths(dir, 'main'), ['c/one.txt', 's/two.txt', 'u/three.txt']);
});

test('the CLI runs the picked commands and logs one line each', () => {
  const dir = repoWithChanges('b/x');
  const map = path.join(dir, '..', path.basename(dir) + '-map.tsv');
  fs.writeFileSync(map, 'b/\texit 1\tnode -e "process.exit(0)"\n');
  const log = path.join(dir, '..', path.basename(dir) + '-runs.jsonl');
  const env = { ...process.env, PP_CHECKS_MAP: map, PP_CHECKS_LOG: log };
  const fast = spawnSync(process.execPath, [CLI, '--repo', dir, '--base', 'main'], { env, encoding: 'utf8' });
  assert.equal(fast.status, 0, fast.stdout + fast.stderr);
  let lines = fs.readFileSync(log, 'utf8').trim().split('\n').map(l => JSON.parse(l));
  assert.equal(lines.length, 1);
  assert.equal(lines[0].tier, 'fast');
  assert.equal(lines[0].exit, 0);
  const full = spawnSync(process.execPath, [CLI, '--repo', dir, '--base', 'main', '--full'], { env, encoding: 'utf8' });
  assert.equal(full.status, 1);
  lines = fs.readFileSync(log, 'utf8').trim().split('\n').map(l => JSON.parse(l));
  assert.equal(lines.length, 2);
  assert.equal(lines[1].tier, 'full');
  assert.equal(lines[1].exit, 1);
});

test('testJobs honours PP_TEST_JOBS and halves the cores', () => {
  assert.equal(testJobs({ PP_TEST_JOBS: '3' }, 10), 3);
  assert.equal(testJobs({}, 10), 5);
  assert.equal(testJobs({}, 1), 1);
  assert.equal(testJobs({ PP_TEST_JOBS: '0' }, 10), 5);
});
