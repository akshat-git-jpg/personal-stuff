# worktree-tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Claude Code skill that creates and persistently tracks git worktrees for ZluriHQ repos on the Desktop, organized into named sets where each repo is pinned to its own branch.

**Architecture:** A prose `SKILL.md` orchestrates the natural-language flow (parse request → resolve repo → guard → git worktree ops → `.env` copy → workspace file). All persistent state lives in `~/Desktop/worktrees/.registry.json`, mutated only through a zero-dependency Node helper `scripts/registry.mjs` (unit-tested), so registry edits are deterministic. The skill is authored in `personal-stuff` for immediate use, then mirrored into the shared `zluri-skills` repo via a PR.

**Tech Stack:** Node 22 (built-in `node:fs`, `node --test`), bash/git, jq available but not required.

## Global Constraints

- **ZluriHQ repos only** — before any worktree creation, `git -C <src> remote get-url origin` MUST match `github.com[:/]ZluriHQ/`. Otherwise refuse and show the detected remote.
- **User-supplied existing branches only** — the user always names the branch per repo; the skill checks it out. If the branch does not exist (local or remote), STOP and tell the user. Never auto-create branches.
- **Plain `git worktree`** — never use `wt`/worktrunk, for exact path control.
- **Base directory** — `~/Desktop/worktrees/`. **Layout** — flat `<set>.<repo>/`. **Workspace** — `<set>.code-workspace` at top. **Registry** — `~/Desktop/worktrees/.registry.json`.
- **Source repos** — under `/Users/kbtg/codebase/`, possibly nested; resolve by name via `find`.
- **Commit messages** — single-line conventional-commit subject only (no body, no em dash, no AI/generator mention).
- **Skill location** — `personal-stuff/tooling/claude-skills/worktree-tracker/` and `zluri-skills/skills/dev-utils/worktree-tracker/`.

---

## File Structure

- `worktree-tracker/SKILL.md` — orchestration instructions (all operations).
- `worktree-tracker/scripts/registry.mjs` — registry JSON state helper (CLI).
- `worktree-tracker/scripts/registry.test.mjs` — unit tests for the helper.
- `worktree-tracker/CHANGELOG.md` — version history (zluri-skills convention).
- `worktree-tracker/MANIFEST.sha256` — generated (zluri-skills copy only).

The canonical author location during implementation is
`/Users/kbtg/codebase/personal-stuff/tooling/claude-skills/worktree-tracker/`.
Referred to below as `$SKILL`.

---

## Task 1: Registry helper (`registry.mjs`) + unit tests

**Files:**
- Create: `/Users/kbtg/codebase/personal-stuff/tooling/claude-skills/worktree-tracker/scripts/registry.mjs`
- Test: `/Users/kbtg/codebase/personal-stuff/tooling/claude-skills/worktree-tracker/scripts/registry.test.mjs`

**Interfaces:**
- Produces the registry CLI consumed by `SKILL.md`:
  `node scripts/registry.mjs <registryPath> <command> [args]`
  Commands:
  - `init` → ensure file exists (`{version:1,sets:{}}`), print `ok`.
  - `list` → print the whole registry as JSON.
  - `get <set>` → print one set as JSON; exit 1 if missing.
  - `add-set <set> --workspace <path>` → create empty set; exit 1 if it exists.
  - `remove-set <set>` → delete a set; exit 1 if missing.
  - `add-member <set> <repo> --branch <b> --path <p> --source <s>` → add/replace member; exit 1 if set missing.
  - `remove-member <set> <repo>` → delete member; exit 1 if set/member missing.
  - `set-branch <set> <repo> <branch>` → update recorded branch; exit 1 if set/member missing.
  - All errors print `Error: <msg>` to stderr and exit 1.

- [ ] **Step 1: Write the failing tests**

Create `scripts/registry.test.mjs`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "$SKILL" && node --test scripts/registry.test.mjs`
Expected: FAIL — `registry.mjs` does not exist (module not found / all tests error).

- [ ] **Step 3: Implement `registry.mjs`**

Create `scripts/registry.mjs`:

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "$SKILL" && node --test scripts/registry.test.mjs`
Expected: PASS — all 12 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/kbtg/codebase/personal-stuff
git add tooling/claude-skills/worktree-tracker/scripts/registry.mjs tooling/claude-skills/worktree-tracker/scripts/registry.test.mjs
git commit -m "feat(worktree-tracker): add registry state helper with tests"
```

(If on `main`, create a branch first: `git checkout -b feat/worktree-tracker-skill`.)

---

## Task 2: Author `SKILL.md`

**Files:**
- Create: `/Users/kbtg/codebase/personal-stuff/tooling/claude-skills/worktree-tracker/SKILL.md`

**Interfaces:**
- Consumes: `scripts/registry.mjs` CLI from Task 1 (all commands).
- Produces: the skill entry point. References the helper as
  `node "$SKILL_DIR/scripts/registry.mjs" ~/Desktop/worktrees/.registry.json <cmd>`,
  where `$SKILL_DIR` is the skill's base directory provided at invocation.

- [ ] **Step 1: Write `SKILL.md`**

Create `SKILL.md` with exactly this content:

````markdown
---
name: worktree-tracker
version: 1.0.0
description: >
  Create and persistently track git worktrees for ZluriHQ repositories on the
  Desktop, grouped into named sets where each repo is pinned to its own branch.
  Use when the user wants to spin up a tracked multi-repo worktree set, list what
  worktrees exist, add a repo to a set, or tear a set down. Triggers on
  "make a worktree set", "track my worktrees", "what worktrees do I have",
  "add <repo> to <set>", "tear down <set>", "worktree tracker".
metadata:
  author: kushal-zluri
---

# Worktree Tracker

Creates and tracks git worktrees for ZluriHQ repos under `~/Desktop/worktrees/`,
grouped into named **sets**. Each repo in a set is pinned to its own branch.
State lives in `~/Desktop/worktrees/.registry.json`, edited only via the bundled
helper `scripts/registry.mjs`.

## Conventions (fixed)

- Base dir: `~/Desktop/worktrees/`
- Member worktree: `~/Desktop/worktrees/<set>.<repo>/`
- Workspace file: `~/Desktop/worktrees/<set>.code-workspace`
- Registry: `~/Desktop/worktrees/.registry.json`
- Source repos: under `/Users/kbtg/codebase/` (may be nested).
- The helper: `node "<this-skill-dir>/scripts/registry.mjs" ~/Desktop/worktrees/.registry.json <cmd> [args]`.
  Run `... init` once before other commands; it is idempotent.

## Hard rules

1. **ZluriHQ repos only.** Before creating a worktree, run
   `git -C <source_repo> remote get-url origin`. If it does not match
   `github.com[:/]ZluriHQ/`, refuse and show the detected remote.
2. **Branches must already exist.** The user names the branch. Verify it exists
   (`git -C <src> show-ref --verify --quiet refs/heads/<branch>` OR
   `git -C <src> ls-remote --exit-code --heads origin <branch>`). If neither, STOP
   and tell the user — never auto-create a branch.
3. **Plain `git worktree` only** — never `wt`.

## Resolving a repo path

```bash
find /Users/kbtg/codebase -type d -name "<repo>" -not -path '*node_modules*' -not -path '*/.git/*' 2>/dev/null
```
- One match → use it. Multiple → ask which. None → tell the user, ask for exact path.

## Reconciliation (run on list/status and before mutations)

For each member in the registry:
- If `worktreePath` is missing or has no `.git` file → flag `missing`; offer to
  `remove-member` it from the registry.
- Else read actual branch: `git -C <worktreePath> rev-parse --abbrev-ref HEAD`.
  If it differs from the recorded branch → run `set-branch` to record reality and
  note the drift to the user.

## Operation: Create a set

User: "make a worktree set `policy-platform` with dashboard-api on `feature/x` and backend-scripts on `fix/y`".

1. Parse the set name and each `(repo, branch)` pair.
2. `... init` the registry.
3. If the set already exists (registry `get <set>` succeeds): do NOT merge silently.
   Tell the user it exists and route new repos through **Add a repo to a set**.
4. For each `(repo, branch)`:
   a. Resolve the source repo path (see above).
   b. ZluriHQ guard (hard rule 1).
   c. Branch-exists check (hard rule 2).
   d. `git -C <source_repo> worktree add ~/Desktop/worktrees/<set>.<repo> <branch>`
   e. Copy env if present: `cp <source_repo>/.env ~/Desktop/worktrees/<set>.<repo>/.env`.
      Special case `dashboard-api`: also
      `cp <source_repo>/postgres/.env ~/Desktop/worktrees/<set>.<repo>/postgres/.env` if it exists.
5. Register the set once: `... add-set <set> --workspace ~/Desktop/worktrees/<set>.code-workspace`.
6. For each created member:
   `... add-member <set> <repo> --branch <branch> --path ~/Desktop/worktrees/<set>.<repo> --source <source_repo>`.
7. Write `~/Desktop/worktrees/<set>.code-workspace`:
   ```json
   { "folders": [ { "path": "<worktreePath>" } ], "settings": {} }
   ```
   Include one `folders` entry per member. For `dashboard-api`, point at its
   `postgres` subdir: `{ "path": "<worktreePath>/postgres" }`.
8. Offer to open: `cursor ~/Desktop/worktrees/<set>.code-workspace` (if `cursor`
   is missing, print the path).
9. Print a summary of members, branches, paths, and env files copied.

## Operation: List / status

User: "what worktrees do I have?" / "show set <set>".

1. `... init`, then `... list` (or `... get <set>`).
2. Run reconciliation.
3. For each member: `git -C <worktreePath> status --porcelain` (dirty/clean) and,
   when an upstream exists, ahead/behind via `git -C <worktreePath> rev-list --left-right --count @{u}...HEAD`.
4. Print a tree: set → repo → branch → status, with any drift/missing flags.

## Operation: Add a repo to a set

User: "add rules-engine on `feature/x` to policy-platform".

1. `... get <set>` (error if the set does not exist — offer to create it instead).
2. Run create-steps 4a–4e for the one repo.
3. `... add-member <set> <repo> --branch <branch> --path <worktreePath> --source <source_repo>`.
4. Regenerate the `<set>.code-workspace` from the updated `... get <set>` members.

## Operation: Remove

User: "remove backend-scripts from policy-platform" / "tear down policy-platform".

1. Determine targets: one member, or all members of the set.
2. For each target: `git -C <worktreePath> status --porcelain`. If non-empty
   (uncommitted changes) → WARN and require explicit confirmation before force.
3. Remove: `git -C <source_repo> worktree remove <worktreePath>`
   (add `--force` only if the user confirmed discarding changes). If the dir was
   already deleted manually, run `git -C <source_repo> worktree prune`.
4. Update registry: `... remove-member <set> <repo>` per member, or
   `... remove-set <set>` for a full teardown.
5. On full teardown, delete the workspace file:
   `rm -f ~/Desktop/worktrees/<set>.code-workspace`. On partial removal, regenerate it.
6. Print a summary of removed / skipped members.

## Error handling

- Repo not found under codebase → report, ask for exact path.
- Non-ZluriHQ remote → refuse, show the remote.
- Branch missing → STOP, tell the user (no auto-create).
- Branch already checked out elsewhere / worktree path exists → surface git's error, do not overwrite.
- `cursor` missing → print the workspace path.
````

- [ ] **Step 2: Manual integration verification**

Pick one real ZluriHQ repo and an existing branch to prove the end-to-end flow,
then clean up. Run from the skill dir (substitute a branch that exists in
`backend-scripts`, e.g. `develop`):

```bash
SKILL=/Users/kbtg/codebase/personal-stuff/tooling/claude-skills/worktree-tracker
REG=~/Desktop/worktrees/.registry.json
SRC=/Users/kbtg/codebase/backend-scripts

# guard passes for a ZluriHQ repo
git -C "$SRC" remote get-url origin | grep -qE 'github.com[:/]ZluriHQ/' && echo "guard: OK"

node "$SKILL/scripts/registry.mjs" "$REG" init
git -C "$SRC" worktree add ~/Desktop/worktrees/verify-set.backend-scripts develop
node "$SKILL/scripts/registry.mjs" "$REG" add-set verify-set --workspace ~/Desktop/worktrees/verify-set.code-workspace
node "$SKILL/scripts/registry.mjs" "$REG" add-member verify-set backend-scripts --branch develop --path ~/Desktop/worktrees/verify-set.backend-scripts --source "$SRC"
node "$SKILL/scripts/registry.mjs" "$REG" get verify-set
```

Expected: the guard prints `guard: OK`; `get verify-set` shows the member with
branch `develop` and the correct paths; the worktree dir exists on the Desktop.

- [ ] **Step 3: Clean up the verification artifacts**

```bash
git -C "$SRC" worktree remove ~/Desktop/worktrees/verify-set.backend-scripts
node "$SKILL/scripts/registry.mjs" "$REG" remove-set verify-set
node "$SKILL/scripts/registry.mjs" "$REG" get verify-set 2>&1 | grep -q 'set not found' && echo "cleanup: OK"
```

Expected: `cleanup: OK`; the Desktop worktree dir is gone.

- [ ] **Step 4: Commit**

```bash
cd /Users/kbtg/codebase/personal-stuff
git add tooling/claude-skills/worktree-tracker/SKILL.md
git commit -m "feat(worktree-tracker): add skill orchestration for tracked worktree sets"
```

---

## Task 3: CHANGELOG + confirm personal skill loads

**Files:**
- Create: `/Users/kbtg/codebase/personal-stuff/tooling/claude-skills/worktree-tracker/CHANGELOG.md`

- [ ] **Step 1: Write `CHANGELOG.md`**

```markdown
# Changelog

## 1.0.0

- Initial release. Create and track git worktrees for ZluriHQ repos under
  `~/Desktop/worktrees/`, grouped into named sets with per-repo branches.
  Persistent JSON registry with git reconciliation; list/status, add, and
  teardown operations.
```

- [ ] **Step 2: Confirm the skill is discoverable**

Check how personal skills are registered (mirror how `worktree-manager` is wired):

```bash
grep -rn "worktree-manager" /Users/kbtg/codebase/personal-stuff/tooling/claude-skills/manifest 2>/dev/null || true
cat /Users/kbtg/codebase/personal-stuff/tooling/claude-skills/manifest 2>/dev/null | head -40
```

If there is a manifest/registry file that enumerates skills, add a
`worktree-tracker` entry alongside `worktree-manager` following the same format.
If skills are auto-discovered by directory, no action needed.

Expected: `worktree-tracker` appears wherever `worktree-manager` does (or is
auto-discovered).

- [ ] **Step 3: Commit**

```bash
cd /Users/kbtg/codebase/personal-stuff
git add tooling/claude-skills/worktree-tracker/CHANGELOG.md
# plus any manifest edit from step 2
git commit -m "chore(worktree-tracker): add changelog and register skill"
```

---

## Task 4: Mirror into `zluri-skills` and open a PR

**Files:**
- Create: `/Users/kbtg/codebase/zluri-skills/skills/dev-utils/worktree-tracker/{SKILL.md,CHANGELOG.md,scripts/registry.mjs,scripts/registry.test.mjs,MANIFEST.sha256}`

- [ ] **Step 1: Branch and copy**

```bash
cd /Users/kbtg/codebase/zluri-skills
git checkout -b feat/worktree-tracker-skill
mkdir -p skills/dev-utils/worktree-tracker/scripts
cp /Users/kbtg/codebase/personal-stuff/tooling/claude-skills/worktree-tracker/SKILL.md skills/dev-utils/worktree-tracker/SKILL.md
cp /Users/kbtg/codebase/personal-stuff/tooling/claude-skills/worktree-tracker/CHANGELOG.md skills/dev-utils/worktree-tracker/CHANGELOG.md
cp /Users/kbtg/codebase/personal-stuff/tooling/claude-skills/worktree-tracker/scripts/registry.mjs skills/dev-utils/worktree-tracker/scripts/registry.mjs
cp /Users/kbtg/codebase/personal-stuff/tooling/claude-skills/worktree-tracker/scripts/registry.test.mjs skills/dev-utils/worktree-tracker/scripts/registry.test.mjs
```

- [ ] **Step 2: Run tests, generate manifest, validate**

```bash
cd /Users/kbtg/codebase/zluri-skills
node --test skills/dev-utils/worktree-tracker/scripts/registry.test.mjs
./scripts/generate-skill-manifest.sh skills/dev-utils/worktree-tracker
./scripts/validate-skills.sh skills/dev-utils/worktree-tracker
```

Expected: tests PASS; manifest generated; validation reports PASS (frontmatter,
kebab-case name, `skills/dev-utils/worktree-tracker` nesting depth all OK).

- [ ] **Step 3: Commit and open PR**

Use the `github-router` skill first to confirm the correct git account for
`zluri-skills`, then:

```bash
cd /Users/kbtg/codebase/zluri-skills
git add skills/dev-utils/worktree-tracker
git commit -m "feat(worktree-tracker): add tracked multi-repo worktree skill"
git push -u origin feat/worktree-tracker-skill
gh pr create --repo <zluri-skills-remote> --base main --title "feat: worktree-tracker skill" --body "<PR body>"
```

The PR body prose is human-facing — run the `humanizer` skill on it before
creating the PR. Confirm the target repo/base with the user before pushing.

Expected: PR opened against `zluri-skills` `main`.

---

## Self-Review

- **Spec coverage:** create/list/add/remove ✓ (Task 2), per-repo branches ✓,
  ZluriHQ guard ✓ (global constraint + SKILL rule 1), registry + reconciliation
  ✓ (Task 1 helper + SKILL reconciliation section), Desktop flat layout ✓,
  `.env` copy incl. dashboard-api postgres ✓, no auto-create branches ✓, dual
  placement ✓ (Tasks 3–4), plain git not wt ✓.
- **Placeholders:** none — full code for `registry.mjs`, tests, and `SKILL.md`.
  The only `<...>` tokens are runtime substitutions (repo, branch, remote), which
  are inherent to a prose orchestration skill, plus the PR remote/body confirmed
  with the user in Task 4.
- **Type consistency:** helper command names and flags (`add-set --workspace`,
  `add-member --branch/--path/--source`, `set-branch`, `remove-member`,
  `remove-set`) are identical between the Task 1 interface block, the test file,
  the implementation, and every `SKILL.md` call site.
