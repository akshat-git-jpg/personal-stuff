#!/usr/bin/env node
// worktree-tracker registry helper — pure JSON state manager, no deps.
// Usage: node registry.mjs <registryPath> <command> [args...]
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';

function die(msg) {
  process.stderr.write(`Error: ${msg}\n`);
  process.exit(1);
}

function loadRegistry(path) {
  if (!existsSync(path)) return { version: 1, sets: {} };
  const raw = readFileSync(path, 'utf8').trim();
  if (!raw) return { version: 1, sets: {} };
  const data = JSON.parse(raw);
  if (!data.sets) data.sets = {};
  if (!data.version) data.version = 1;
  return data;
}

function saveRegistry(path, data) {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  renameSync(tmp, path);
}

function parseFlags(args) {
  const positionals = [];
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = args[i + 1];
      if (val === undefined || val.startsWith('--')) die(`flag --${key} requires a value`);
      flags[key] = val;
      i++;
    } else {
      positionals.push(a);
    }
  }
  return { positionals, flags };
}

function requireFlags(flags, names) {
  for (const n of names) if (flags[n] === undefined) die(`missing required flag --${n}`);
}

function requireSet(reg, set) {
  if (!reg.sets[set]) die(`set not found: ${set}`);
}

function requireMember(reg, set, repo) {
  requireSet(reg, set);
  if (!reg.sets[set].members[repo]) die(`member not found: ${set}/${repo}`);
}

function main() {
  const [registryPath, command, ...rest] = process.argv.slice(2);
  if (!registryPath || !command) die('usage: registry.mjs <registryPath> <command> [args...]');
  const { positionals, flags } = parseFlags(rest);
  const reg = loadRegistry(registryPath);

  switch (command) {
    case 'init': {
      if (!existsSync(registryPath)) saveRegistry(registryPath, reg);
      process.stdout.write('ok\n');
      break;
    }
    case 'list': {
      process.stdout.write(JSON.stringify(reg, null, 2) + '\n');
      break;
    }
    case 'get': {
      const [set] = positionals;
      if (!set) die('get requires <set>');
      requireSet(reg, set);
      process.stdout.write(JSON.stringify(reg.sets[set], null, 2) + '\n');
      break;
    }
    case 'add-set': {
      const [set] = positionals;
      if (!set) die('add-set requires <set>');
      requireFlags(flags, ['workspace']);
      if (reg.sets[set]) die(`set already exists: ${set}`);
      reg.sets[set] = { createdAt: new Date().toISOString(), workspaceFile: flags.workspace, members: {} };
      saveRegistry(registryPath, reg);
      process.stdout.write('ok\n');
      break;
    }
    case 'remove-set': {
      const [set] = positionals;
      if (!set) die('remove-set requires <set>');
      requireSet(reg, set);
      delete reg.sets[set];
      saveRegistry(registryPath, reg);
      process.stdout.write('ok\n');
      break;
    }
    case 'add-member': {
      const [set, repo] = positionals;
      if (!set || !repo) die('add-member requires <set> <repo>');
      requireFlags(flags, ['branch', 'path', 'source']);
      requireSet(reg, set);
      reg.sets[set].members[repo] = {
        branch: flags.branch,
        worktreePath: flags.path,
        sourceRepo: flags.source,
        createdAt: new Date().toISOString(),
      };
      saveRegistry(registryPath, reg);
      process.stdout.write('ok\n');
      break;
    }
    case 'remove-member': {
      const [set, repo] = positionals;
      if (!set || !repo) die('remove-member requires <set> <repo>');
      requireMember(reg, set, repo);
      delete reg.sets[set].members[repo];
      saveRegistry(registryPath, reg);
      process.stdout.write('ok\n');
      break;
    }
    case 'set-branch': {
      const [set, repo, branch] = positionals;
      if (!set || !repo || !branch) die('set-branch requires <set> <repo> <branch>');
      requireMember(reg, set, repo);
      reg.sets[set].members[repo].branch = branch;
      saveRegistry(registryPath, reg);
      process.stdout.write('ok\n');
      break;
    }
    default:
      die(`unknown command: ${command}`);
  }
}

main();
