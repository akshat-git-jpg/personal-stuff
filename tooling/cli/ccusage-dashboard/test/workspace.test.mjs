import test from 'node:test';
import assert from 'node:assert';
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { scanWorkspace, getWorkspace } from '../workspace.mjs';

const FIXTURES_DIR = resolve(new URL('.', import.meta.url).pathname, 'fixtures');
const REPO_ROOT = join(FIXTURES_DIR, 'repo');
const CRONS_ROOT = join(FIXTURES_DIR, 'vps-crons');
const ACCT_WORK_SRC = join(FIXTURES_DIR, 'acct-work');
const ACCT_WORK_TEMP = join(FIXTURES_DIR, 'acct-work-temp');

test.before(() => {
  // Setup temp acct directory
  cpSync(ACCT_WORK_SRC, ACCT_WORK_TEMP, { recursive: true });

  // 1. Rewrite acct-work-temp/.claude.json with real absolute REPO_ROOT
  const claudeJsonPath = join(ACCT_WORK_TEMP, '.claude.json');
  const content = readFileSync(claudeJsonPath, 'utf8');
  writeFileSync(claudeJsonPath, content.replace(/__REPO__/g, REPO_ROOT));

  // 2. mkdirSync the memory path and write MEMORY.md
  const sanitized = REPO_ROOT.replace(/\//g, '-');
  const memoryDir = join(ACCT_WORK_TEMP, 'projects', sanitized, 'memory');
  mkdirSync(memoryDir, { recursive: true });
  writeFileSync(join(memoryDir, 'MEMORY.md'), 'line 1\n');
  
  // also add to .gitignore
  writeFileSync(join(FIXTURES_DIR, '.gitignore'), 'acct-work-temp\n');
});

test.after(() => {
  try {
    rmSync(ACCT_WORK_TEMP, { recursive: true, force: true });
    rmSync(join(FIXTURES_DIR, '.gitignore'), { force: true });
  } catch { }
});

const getOpts = () => ({
  repoRoot: REPO_ROOT,
  accounts: [{ id: 'work', dir: ACCT_WORK_TEMP }],
  cronsRoot: CRONS_ROOT
});

test('returns all four layers', async () => {
  const d = await scanWorkspace(getOpts());
  assert.deepStrictEqual(Object.keys(d.layers), ['apps', 'routines', 'memory', 'skills']);
});

test('finds repo-scope MCP servers', async () => {
  const d = await scanWorkspace(getOpts());
  const server = d.layers.apps.find(a => a.id === 'cloudflare');
  assert.ok(server);
  assert.strictEqual(server.kind, 'mcp');
  assert.strictEqual(server.scope, 'repo');
});

test('finds user-scope MCP servers', async () => {
  const d = await scanWorkspace(getOpts());
  const server = d.layers.apps.find(a => a.id === 'mongo-app-dev');
  assert.ok(server);
  assert.strictEqual(server.scope, 'user');
  assert.strictEqual(server.account, 'work');
});

test('disabled MCP servers are flagged', async () => {
  const d = await scanWorkspace(getOpts());
  const server = d.layers.apps.find(a => a.id === 'postgres-app-dev');
  assert.ok(server);
  assert.strictEqual(server.status, 'disabled');
});

test('disabled skills are flagged', async () => {
  const d = await scanWorkspace(getOpts());
  const dead = d.layers.skills.find(s => s.name === 'dead-skill');
  assert.ok(dead);
  assert.strictEqual(dead.disabled, true);
  assert.strictEqual(dead.status, 'disabled');
});

test('skill usage counts and lastUsed are attached', async () => {
  const d = await scanWorkspace(getOpts());
  const live = d.layers.skills.find(s => s.name === 'live-skill');
  assert.ok(live);
  assert.strictEqual(live.uses, 12);
  assert.ok(live.lastUsed.startsWith('2026-'));
});

test('unquoted-colon descriptions still parse', async () => {
  const d = await scanWorkspace(getOpts());
  const colon = d.layers.skills.find(s => s.name === 'colon-skill');
  assert.ok(colon);
  assert.ok(colon.descChars > 40);
});

test('parses the cron table', async () => {
  const d = await scanWorkspace(getOpts());
  assert.strictEqual(d.layers.routines.length, 2);
  const probe = d.layers.routines.find(r => r.name === 'site-probe');
  assert.ok(probe);
  assert.strictEqual(probe.cronUtc, '0 * * * *');
});

test('missing accounts produce warnings, not throws', async () => {
  const d = await scanWorkspace({
    repoRoot: REPO_ROOT,
    accounts: [{ id: 'ghost', dir: '/nonexistent/xyz' }],
    cronsRoot: CRONS_ROOT
  });
  assert.ok(d.layers);
  assert.ok(d.warnings.length > 0);
  assert.deepStrictEqual(Object.keys(d.layers), ['apps', 'routines', 'memory', 'skills']);
});
