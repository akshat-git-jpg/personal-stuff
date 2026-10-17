// In-session checks: run each changed suite's FAST command from verify-map.tsv (its full one when it has none) and log the time.
// node scripts/lib/check-changed.mjs [--repo <dir>] [--base <ref>] [--full] [--list]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { testJobs } from './test-jobs.mjs';

export function parseVerifyMap(text) {
  const rows = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (!line.trim() || line.startsWith('#')) continue;
    const [prefix, full, fast] = line.split('\t');
    if (!prefix || !full) continue;
    rows.push({ prefix, full, fast: fast ? fast : null });
  }
  return rows;
}

export function pickCommands(rows, changed, { full = false } = {}) {
  const commands = [];
  const seen = new Set();
  for (const row of rows) {
    if (!changed.some(p => p.startsWith(row.prefix))) continue;
    const pick = !full && row.fast ? { cmd: row.fast, tier: 'fast' } : { cmd: row.full, tier: 'full' };
    if (seen.has(pick.cmd)) continue;
    seen.add(pick.cmd);
    commands.push(pick);
  }
  const unmapped = changed.filter(p => !rows.some(r => p.startsWith(r.prefix)));
  return { commands, unmapped };
}

function gitLines(repo, args) {
  const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.split('\n').filter(Boolean) : [];
}

export function changedPaths(repo, base = 'origin/main') {
  const all = [
    ...gitLines(repo, ['diff', '--name-only', `${base}...HEAD`]),
    ...gitLines(repo, ['diff', '--name-only', 'HEAD']),
    ...gitLines(repo, ['ls-files', '--others', '--exclude-standard']),
  ];
  return [...new Set(all)].sort();
}

export function logPath(env = process.env) {
  if (env.PP_CHECKS_LOG) return env.PP_CHECKS_LOG;
  const base = env.XDG_STATE_HOME
    || (process.platform === 'win32' ? env.LOCALAPPDATA : null)
    || path.join(os.homedir(), '.local', 'state');
  return path.join(base, 'pp-checks', 'runs.jsonl');
}

function appendLog(env, row) {
  try {
    const file = logPath(env);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify(row) + '\n');
  } catch (e) {
    console.error(`[check-changed] could not write the run log: ${e.message}`);
  }
}

export function runChecks({ repo, commands, env = process.env }) {
  const childEnv = { ...env, PP_TEST_JOBS: String(testJobs(env)) };
  const shell = process.platform === 'win32' ? true : '/bin/bash';
  return commands.map(({ cmd, tier }) => {
    const t0 = Date.now();
    const r = spawnSync(cmd, { cwd: repo, stdio: 'inherit', shell, env: childEnv });
    const ms = Date.now() - t0;
    const exit = r.status ?? 1;
    appendLog(env, { at: new Date().toISOString(), repo, cmd, tier, ms, exit });
    return { cmd, tier, ms, exit };
  });
}

function main(argv) {
  const opt = { repo: process.cwd(), base: 'origin/main', full: false, list: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--repo') opt.repo = path.resolve(argv[++i]);
    else if (a === '--base') opt.base = argv[++i];
    else if (a === '--full') opt.full = true;
    else if (a === '--list') opt.list = true;
    else { console.error('usage: node scripts/lib/check-changed.mjs [--repo <dir>] [--base <ref>] [--full] [--list]'); return 2; }
  }
  const mapFile = process.env.PP_CHECKS_MAP || path.join(opt.repo, 'tooling', 'cli', 'pp-land', 'verify-map.tsv');
  const rows = parseVerifyMap(fs.readFileSync(mapFile, 'utf8'));
  const changed = changedPaths(opt.repo, opt.base);
  if (!changed.length) { console.log('nothing changed'); return 0; }
  const { commands, unmapped } = pickCommands(rows, changed, { full: opt.full });
  const unmappedLines = () => unmapped.forEach(p => console.log(`unmapped  ${p}`));
  if (opt.list) {
    commands.forEach(c => console.log(`${c.tier}  ${c.cmd}`));
    unmappedLines();
    return 0;
  }
  const t0 = Date.now();
  const results = runChecks({ repo: opt.repo, commands });
  console.log('');
  for (const r of results) console.log(`${r.exit === 0 ? 'ok  ' : 'FAIL'}  ${(r.ms / 1000).toFixed(1)}s  ${r.tier}  ${r.cmd}`);
  unmappedLines();
  console.log(`total ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return results.some(r => r.exit !== 0) ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.exit(main(process.argv.slice(2)));
}
