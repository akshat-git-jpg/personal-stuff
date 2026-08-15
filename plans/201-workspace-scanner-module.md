---
executor: agy
model:                   # blank = agy default (Gemini 3.1 Pro High)
test_cmd: node --test tooling/cli/ccusage-dashboard/test/workspace.test.mjs
ui:
deploy:
needs: []
needs_prs: []
touches: [tooling/cli/ccusage-dashboard/workspace.mjs, tooling/cli/ccusage-dashboard/test/workspace.test.mjs, tooling/cli/ccusage-dashboard/test/fixtures]

mutation_apply: node -e "const f='tooling/cli/ccusage-dashboard/test/fixtures/acct-work/settings.json';const j=JSON.parse(require('fs').readFileSync(f,'utf8'));delete j.skillOverrides;require('fs').writeFileSync(f,JSON.stringify(j,null,2)+'\n')"
mutation_command: node --test tooling/cli/ccusage-dashboard/test/workspace.test.mjs
mutation_expect: disabled skills are flagged
mutation_timeout: 300
---

# Plan 201: Workspace scanner module for the ccusage dashboard

## Summary

- **Problem statement**: The owner's Claude setup — MCP servers, local apps, VPS
  crons, memory docs, and ~100 skills across two accounts — has no single view.
  Dead entries (a skill never invoked in 1,360 startups, an MCP server with zero
  calls) are invisible until someone runs a manual audit.
- **Goals**:
  - Add `workspace.mjs`: one pure, dependency-free module that scans four layers
    (apps/connections, routines, memory, skills) across both Claude accounts and
    the repo, and returns one JSON object.
  - Attach usage data to every entry so "never used" is a visible field, not a
    manual investigation.
  - Make the whole thing testable against fixtures, not against the owner's real
    home directory.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — fully inlined, no design
  decisions left, pure data transformation with fixture-backed tests.
- **Done criteria** (terse — full list below): `node --test tooling/cli/ccusage-dashboard/test/workspace.test.mjs` exits 0 with ≥ 9 passing tests; `scanWorkspace` returns all four layers against fixtures; no new dependencies.
- **Stop conditions** (terse — full list below): any need for a package.json or npm dependency; any test that reads the real `$HOME`; weakening an assertion to make a test pass.
- **Test / verification for success**: Node's built-in test runner against a
  committed fixture tree, plus a mutation gate proving the disabled-skill
  assertion can actually fail.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 24677c33..HEAD -- tooling/cli/ccusage-dashboard/ tooling/cli/local-apps-dashboard/apps.json`
> Expected: no changes to `tooling/cli/ccusage-dashboard/`. If `dashboard.mjs`
> has changed, re-read it before starting — this plan does not edit it, but
> plan 202 does.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `24677c33`, 2026-08-15

## Why this matters

The owner watched a video pitching a "second brain" graph over a Claude
workspace and asked for a local version. The valuable half is not the picture —
it is knowing which of ~100 skills, ~11 MCP servers, ~10 local apps, and 5 VPS
crons are actually alive. A `/doctor` run on 2026-08-15 found 26 skills with
zero lifetime uses across 1,360 startups and two MCP servers with zero calls;
that audit was manual and one-off. This module makes it a standing view.

This plan is deliberately **data only, no UI**. The scanner is the part with all
the file-format knowledge and all the ways to be subtly wrong, so it gets tested
in isolation first. Plan 202 renders it.

Note for context: `context/` (plan 007) already exists and holds the owner's
written identity layer — profile, bets, inventory, ideas. This module **reads**
it as a memory source. It does not replace or rewrite it.

## Current state

### The host tool

`tooling/cli/ccusage-dashboard/dashboard.mjs` (544 lines) is a zero-dependency
Node HTTP server on port 4319 that visualises `ccusage` token spend. It is
already registered in the local-apps dashboard (`apps.json`, id `ccusage`, port
4319), so the owner starts it from http://localhost:4321 like every other app.

Its account list, which this module must mirror (lines 18–22, read directly):

```js
const SCOPES = [
  { id: 'work', label: 'Work', dir: `${homedir()}/.claude-work`, accent: '#5aa0e8' },
  { id: 'personal', label: 'Personal', dir: `${homedir()}/.claude-personal`, accent: '#5fd08a' },
  { id: 'all', label: 'Total', dir: `${homedir()}/.claude-work,${homedir()}/.claude-personal`, accent: '#cbb46a' },
];
```

Both `~/.claude-work` and `~/.claude-personal` exist on this machine and are the
two real accounts. **`~/.claude` also exists but is NOT an account** — ignore it.

Its imports (lines 5–10) — the full dependency budget available to you:

```js
import http from 'node:http';
import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
```

`tooling/cli/local-apps-dashboard/CLAUDE.md` states the hard constraint for this
family of tools: **"Do not add a `package.json` or dependencies — this tool is
Node built-ins only, matching the sibling `ccusage-dashboard`."**

### The four data sources, verified on 2026-08-15

**1. Apps and connections**

- Local apps: `tooling/cli/local-apps-dashboard/apps.json`, shape
  `{ "_note": "...", "port": 4321, "apps": [ { id, name, cwd, start, port, ports?, url, env? } ] }`.
  Currently 10 apps: `ccusage, tracker, lists, founders, card-gallery,
  yt-workflow, media-board, timeblock, heygen-renders, graphics-board`.
- Repo-scope MCP servers: `.mcp.json` at repo root → `.mcpServers` keys.
  Currently: `cloudflare, davinci-resolve, davinci-resolve-advanced,
  google-drive, indian-railways`.
- User-scope MCP servers: `<account>/.claude.json` → `.mcpServers` keys.
  In `~/.claude-work` currently: `mongo-app-dev, mongo-app-prod,
  postgres-app-dev, postgres-app-prod`.
- Disabled MCP servers: `<account>/.claude.json` →
  `.projects["<repo-root>"].disabledMcpServers` (array of names) and
  `.projects["<repo-root>"].disabledMcpjsonServers` (array of names). Both may
  be absent. As of this plan `disabledMcpServers` contains
  `["postgres-app-dev","postgres-app-prod"]`.
- CLIs: directory names under `tooling/cli/*/` (each is one CLI).

**2. Routines (VPS crons)**

The cron registry is a sibling repo at `../vps-crons` (cloned on this machine at
`/Users/kbtg/codebase/vps-crons`). One directory per cron: `d1-backup`,
`gmail-digest`, `my-planner`, `repo-sync`, `site-probe` (plus `_shared` and
`_template`, which are NOT crons — skip any directory whose name starts with
`_`).

`../vps-crons/README.md` carries a markdown table whose header is exactly:

```
| Job | Schedule (IST) | UTC cron | Real code path (in `personal-stuff` repo) | Status |
```

This table is the schedule source. If `../vps-crons` is absent (a fresh clone
without the sibling repo), the routines layer must return `[]` plus a warning —
never throw.

**3. Memory / docs**

Always-loaded or index-role files in the repo, each with size and mtime:
`CLAUDE.md`, `decisions.md`, `INFRA.md`, `VPS-CRONS.md`, `my-hosted-sites.md`,
`README.md`, and every `*.md` directly under `context/`.
Plus the auto-memory index at
`<account>/projects/<sanitized-repo-root>/memory/MEMORY.md`, where
`<sanitized-repo-root>` is the absolute repo path with every `/` replaced by `-`
(e.g. `/Users/kbtg/codebase/personal-stuff` → `-Users-kbtg-codebase-personal-stuff`).

**4. Skills**

- User-scope: `<account>/skills/*/SKILL.md`
- Project-scope: `<repoRoot>/.claude/skills/*/SKILL.md` (many are symlinks into
  `pipelines/.claude/skills/` — follow them; `readFileSync` does this already)
- Usage counters: `<account>/.claude.json` → `.skillUsage`, shape
  `{ "<name>": { "usageCount": 96, "lastUsedAt": 1786350580715 } }`. `lastUsedAt`
  is **epoch milliseconds**, not an ISO string.
- Disabled state: `<account>/settings.json` → `.skillOverrides`, shape
  `{ "<name>": "off" | "name-only" | "user-invocable-only" | "on" }`.
  As of this plan the work account has 18 entries set to `"off"`.

**Frontmatter caveat, already hit on this repo**: three SKILL.md files have a
`description:` value containing an unquoted `: ` (e.g. `Verbs: run graphics`).
A strict YAML parser rejects the whole block. You are NOT writing a YAML parser
— use the line-regex extractor given in Step 2, which handles these correctly.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Run this plan's tests | `node --test tooling/cli/ccusage-dashboard/test/workspace.test.mjs` | exit 0, `# fail 0` |
| Confirm no deps added | `ls tooling/cli/ccusage-dashboard/package.json` | `No such file or directory` |
| Smoke the scanner on real data | `node -e "import('./tooling/cli/ccusage-dashboard/workspace.mjs').then(m=>m.scanWorkspace()).then(d=>console.log(Object.keys(d.layers), d.layers.skills.length))"` | prints the 4 layer keys and a skill count > 50 |
| Node version | `node --version` | `v22.14.0` (built-in test runner available) |

## Scope

**In scope**:
- `tooling/cli/ccusage-dashboard/workspace.mjs` (new)
- `tooling/cli/ccusage-dashboard/test/workspace.test.mjs` (new)
- `tooling/cli/ccusage-dashboard/test/fixtures/**` (new)
- `tooling/cli/ccusage-dashboard/README.md` (append a "Workspace scan" section)

**Out of scope — do not touch**:
- `tooling/cli/ccusage-dashboard/dashboard.mjs` — plan 202 wires the tab. Editing
  it here creates a merge collision with 202.
- `tooling/cli/local-apps-dashboard/**` — read `apps.json`, never write it.
- `../vps-crons` — read-only, and it is a different repo.
- Any file under `~/.claude-work` or `~/.claude-personal` — this module is
  strictly read-only against the owner's config. Writing there is a STOP.
- The 3 SKILL.md files with folded-scalar descriptions — already fixed in the
  working tree, unrelated to this plan.

## Git workflow

- Branch: `advisor/201-workspace-scanner-module`
- Commit: `feat(ccusage-dashboard): workspace scanner for apps, crons, memory, skills` — no AI footers. Do NOT push.

## Steps

### Step 1: Create the fixture tree

Create `tooling/cli/ccusage-dashboard/test/fixtures/` with a miniature but
realistic world. Exact contents:

`fixtures/repo/.mcp.json`
```json
{ "mcpServers": { "cloudflare": {}, "google-drive": {} } }
```

`fixtures/repo/CLAUDE.md` — any 3 lines of text.
`fixtures/repo/decisions.md` — any 2 lines of text.
`fixtures/repo/context/profile.md` — any 1 line of text.

`fixtures/repo/.claude/skills/live-skill/SKILL.md`
```markdown
---
name: live-skill
description: A skill that is used and enabled.
---
body
```

`fixtures/repo/.claude/skills/colon-skill/SKILL.md` — reproduces the real
unquoted-colon case, which must still parse:
```markdown
---
name: colon-skill
description: Operate the thing by verb. Verbs: run, stop, check. Triggers on "go".
---
body
```

`fixtures/acct-work/settings.json`
```json
{
  "skillOverrides": { "dead-skill": "off" }
}
```

`fixtures/acct-work/.claude.json`
```json
{
  "mcpServers": { "mongo-app-dev": {}, "postgres-app-dev": {} },
  "skillUsage": {
    "live-skill": { "usageCount": 12, "lastUsedAt": 1786350580715 }
  },
  "projects": {
    "__REPO__": { "disabledMcpServers": ["postgres-app-dev"] }
  }
}
```
The literal string `__REPO__` is a placeholder: the test replaces it with the
absolute fixture repo path at load time (see Step 4). Do not hardcode a real
path into a committed fixture.

`fixtures/acct-work/skills/dead-skill/SKILL.md`
```markdown
---
name: dead-skill
description: Never invoked, and switched off in settings.
---
body
```

`fixtures/acct-work/projects/__REPO_SANITIZED__/memory/MEMORY.md` — any 1 line.
Create this directory at test time rather than committing a path with a
machine-specific name (Step 4 covers it).

`fixtures/vps-crons/README.md`
```markdown
# VPS crons

| Job | Schedule (IST) | UTC cron | Real code path (in `personal-stuff` repo) | Status |
|---|---|---|---|---|
| site-probe | hourly | `0 * * * *` | `scripts/probe-sites.sh` | active |
| d1-backup | 03:00 daily | `30 21 * * *` | `apps/x/backup.sh` | active |
```

`fixtures/vps-crons/site-probe/README.md` and `fixtures/vps-crons/d1-backup/README.md`
— any 1 line each. Also create `fixtures/vps-crons/_template/README.md` so the
underscore-skip rule has something to skip.

**Verify**: `find tooling/cli/ccusage-dashboard/test/fixtures -type f | wc -l` → `12` or more

### Step 2: Write `workspace.mjs`

Create `tooling/cli/ccusage-dashboard/workspace.mjs`. Node built-ins only.

The module exports exactly one function:

```js
export async function scanWorkspace(opts = {}) { … }
```

`opts` shape (all optional, defaulting to the real machine):

```js
{
  repoRoot,      // default: resolved 3 levels up from this file
  accounts,      // default: [{id:'work', dir:`${homedir()}/.claude-work`},
                 //           {id:'personal', dir:`${homedir()}/.claude-personal`}]
  cronsRoot,     // default: `${repoRoot}/../vps-crons`
  maxTranscripts // default: 50
}
```

Return shape — every field is required, arrays may be empty:

```js
{
  generatedAt: '<ISO string>',
  repoRoot: '<abs path>',
  accounts: [{ id, dir, present: true|false }],
  layers: {
    apps:     [{ id, name, kind, scope, account, port, url, status, uses, lastUsed }],
    routines: [{ id, name, schedule, cronUtc, codePath, status }],
    memory:   [{ path, role, bytes, mtime, scope }],
    skills:   [{ name, source, account, uses, lastUsed, disabled, descChars }],
  },
  warnings: ['<string>'],
}
```

Field rules — these are the encoding, follow them exactly:

- `kind` ∈ `'local-app' | 'mcp' | 'cli'`.
- `scope` ∈ `'repo' | 'user'`. Local apps and CLIs and `.mcp.json` servers are
  `'repo'`; `.claude.json` servers are `'user'`.
- `account` is the account id for user-scope rows, `null` for repo-scope rows.
- `status` ∈ `'active' | 'disabled' | 'unused'`, resolved in this order:
  1. name appears in `disabledMcpServers` or `disabledMcpjsonServers`, or the
     skill is `"off"` in `skillOverrides` → `'disabled'`
  2. `uses === 0` → `'unused'`
  3. otherwise → `'active'`
- `uses` is an integer, never null. Use `0` when there is no counter.
- `lastUsed` is an **ISO string or null**. Convert `skillUsage.lastUsedAt`
  (epoch ms) with `new Date(ms).toISOString()`.
- `role` for memory rows ∈ `'always-loaded' | 'index' | 'context' | 'auto-memory'`.
  `CLAUDE.md` → `'always-loaded'`; `decisions.md`, `INFRA.md`, `VPS-CRONS.md`,
  `my-hosted-sites.md`, `README.md` → `'index'`; anything under `context/` →
  `'context'`; `MEMORY.md` → `'auto-memory'`.
- `source` for skills ∈ `'user' | 'project'`.
- `descChars` is `name.length + description.length` — the skill-listing cost.

**Frontmatter extraction — use exactly this, do not write a YAML parser.** It is
the piece that must handle the unquoted-colon descriptions:

```js
function readSkillMeta(text, dirName) {
  let name = dirName, desc = '';
  if (text.startsWith('---')) {
    const end = text.indexOf('\n---', 3);
    const fm = end > 0 ? text.slice(3, end) : '';
    const n = fm.match(/^name:[ \t]*(.+)$/m);
    if (n) name = n[1].trim();
    // description may be a plain scalar OR a folded block (`>-` then indented lines)
    const d = fm.match(/^description:[ \t]*(>[-+]?|\|[-+]?)?[ \t]*\n?((?:.|\n(?=[ \t]))*)/m);
    if (d) desc = (d[2] || '').split('\n').map((s) => s.trim()).filter(Boolean).join(' ');
  }
  return { name, desc };
}
```

**MCP name normalisation** — transcript tool names use a normalised server
segment. When counting calls, normalise the configured name the same way before
matching:

```js
const norm = (s) => s.replace(/[^a-zA-Z0-9_-]/g, '_');
// a call looks like: mcp__<norm(server)>__<tool>
```

**Transcript scan** — for each account, take the `maxTranscripts` most recently
modified `*.jsonl` under `<account>/projects/*/`, read line by line, JSON.parse
each line inside a try/catch (skip unparseable lines), and count `tool_use`
entries whose `name` starts with `mcp__`. Never throw on a malformed file.
Never read a file larger than 64 MB.

**Every read is defensive.** A missing file, an unparseable JSON, or an absent
account directory produces a `warnings[]` entry and an empty result for that
source — never an exception. `scanWorkspace()` on a machine with neither account
present must still resolve, with all four layers present and `warnings.length > 0`.

**Verify**: `node -e "import('./tooling/cli/ccusage-dashboard/workspace.mjs').then(m=>m.scanWorkspace()).then(d=>{if(!d.layers.skills.length)throw new Error('no skills');console.log('ok',d.layers.skills.length,'skills',d.layers.apps.length,'apps')})"` → prints `ok <n> skills <m> apps` with n > 50

### Step 3: Add a 60-second cache

Export a second function `getWorkspace(opts)` that wraps `scanWorkspace` with an
in-module cache: 60_000 ms TTL, plus an `inflight` promise so two concurrent
callers share one scan. Mirror the pattern already in `dashboard.mjs` lines
262–269, which you should read first:

```js
if (cache.inflight) return cache.inflight;
cache.inflight = Promise.all([...]).then((r) => { cache = { at: Date.now(), data, inflight: null }; return data; })
  .catch((e) => { cache.inflight = null; throw e; });
```

The cache key must include the account ids, so a fixture-backed test never
returns cached real-machine data. Simplest correct approach: skip the cache
entirely whenever `opts.accounts` is provided, and only cache the default call.

**Verify**: `node -e "import('./tooling/cli/ccusage-dashboard/workspace.mjs').then(async m=>{const t=Date.now();await m.getWorkspace();const a=Date.now()-t;const u=Date.now();await m.getWorkspace();const b=Date.now()-u;if(b>=a)throw new Error('cache not hit: '+a+' then '+b);console.log('cached',a+'ms then '+b+'ms')})"` → prints two timings, the second smaller

### Step 4: Write the tests

Create `tooling/cli/ccusage-dashboard/test/workspace.test.mjs`, following the
idiom in `tooling/cli/heygen-web/test/smoke.test.mjs` (read it first):
`import test from "node:test"; import assert from "node:assert";` and resolve
paths from `import.meta.url`.

A `before` hook must materialise the two machine-specific fixture bits:
1. Read `fixtures/acct-work/.claude.json`, replace the literal `__REPO__` with
   the absolute fixture repo path, write the result to a temp copy used by the
   tests (do NOT rewrite the committed fixture).
2. `mkdirSync` the `fixtures/acct-work/projects/<sanitized>/memory/` path and
   write `MEMORY.md`, where `<sanitized>` is the absolute fixture repo path with
   `/` → `-`. Add that generated directory to
   `tooling/cli/ccusage-dashboard/test/fixtures/.gitignore`.

**Guaranteed teardown**: register a `test.after` that removes anything the
`before` hook created, in a `try/finally`, so a failing assertion never leaves
the fixture tree dirty.

Write at least these 9 tests. The names matter — the mutation gate keys on one
of them:

1. `returns all four layers` — `Object.keys(d.layers)` deep-equals `['apps','routines','memory','skills']`
2. `finds repo-scope MCP servers` — apps contains `cloudflare` with `kind:'mcp'`, `scope:'repo'`
3. `finds user-scope MCP servers` — apps contains `mongo-app-dev` with `scope:'user'`, `account:'work'`
4. `disabled MCP servers are flagged` — `postgres-app-dev` has `status:'disabled'`
5. `disabled skills are flagged` — `dead-skill` has `disabled === true` and `status`-equivalent handling; assert `d.layers.skills.find(s=>s.name==='dead-skill').disabled === true`
6. `skill usage counts and lastUsed are attached` — `live-skill` has `uses === 12` and `lastUsed` is an ISO string starting `'2026-'`
7. `unquoted-colon descriptions still parse` — `colon-skill` has `descChars > 40` (proves the description was read, not dropped)
8. `parses the cron table` — routines has 2 entries; `site-probe` has `cronUtc === '0 * * * *'`
9. `missing accounts produce warnings, not throws` — `scanWorkspace({accounts:[{id:'ghost',dir:'/nonexistent/xyz'}], repoRoot: FIX_REPO})` resolves, all four layers present, `warnings.length > 0`

**Verify**: `node --test tooling/cli/ccusage-dashboard/test/workspace.test.mjs` → exit 0, `# pass 9` or more, `# fail 0`

### Step 5: Document it

Append a `## Workspace scan` section to
`tooling/cli/ccusage-dashboard/README.md` (currently a 4-line stub): what
`workspace.mjs` reads, the four layers, the two accounts, and the note that
`../vps-crons` is optional. Six to twelve lines. Do not rewrite the existing
ccusage description.

**Verify**: `grep -c "Workspace scan" tooling/cli/ccusage-dashboard/README.md` → `1`

## Test plan

New file `test/workspace.test.mjs`, Node's built-in runner, 9 tests against the
committed fixture tree. No network, no real `$HOME` reads, no timing
dependencies. Follows `tooling/cli/heygen-web/test/smoke.test.mjs` for structure.

The mutation gate in the frontmatter proves test 5 can fail: it deletes the
`skillOverrides` key from the fixture settings, which must make
`disabled skills are flagged` fail, then reverts.

## Done criteria

- [ ] `node --test tooling/cli/ccusage-dashboard/test/workspace.test.mjs` exits 0 with `# fail 0` and `# pass` ≥ 9
- [ ] `ls tooling/cli/ccusage-dashboard/package.json` → does not exist
- [ ] `grep -cE "^import .* from 'node:" tooling/cli/ccusage-dashboard/workspace.mjs` ≥ 1 and `grep -c "from '[^n]" tooling/cli/ccusage-dashboard/workspace.mjs` → `0` (no non-builtin imports)
- [ ] Smoke command from "Commands you will need" prints a skill count > 50 against the real machine
- [ ] `git status --porcelain` shows no modification to `dashboard.mjs`
- [ ] `plans/README.md` row for 201 updated to DONE

## STOP conditions

- Any step appears to require a `package.json`, `npm install`, or a non-`node:` import — STOP and report. This tool family is built-ins-only by explicit house rule.
- Any test needs to read the real `~/.claude-work` or `~/.claude-personal` to pass — STOP. Tests are fixture-backed; a test that only passes on this Mac is not a test.
- A write of any kind lands under `~/.claude-work`, `~/.claude-personal`, or `../vps-crons` — STOP immediately and report. This module is read-only against all three.
- **Gate integrity**: if an assertion fails, fix the code or the fixture. Weakening, swapping, or deleting the assertion is a STOP.
- `dashboard.mjs` needs editing to make something work — STOP. That file belongs to plan 202; touching it here causes a merge collision.
- The real-machine smoke returns fewer than 50 skills — STOP and report the count. It means a source path is wrong, and a silently-thin scan is the failure mode this plan exists to prevent.

## Maintenance notes

- **The riskiest coupling is file formats owned elsewhere.** `skillUsage.lastUsedAt` being epoch-ms, `disabledMcpServers` living under `.projects[<abs path>]`, and the cron table's exact column header are all external contracts that Claude Code or the owner can change. Each has a fixture; if a layer silently empties in the UI, check the fixture still matches reality before debugging the scanner.
- The transcript scan is the only expensive part (50 files × up to a few MB). It is capped and cached. If the Workspace tab ever feels slow, lower `maxTranscripts` before optimising anything else.
- `~/.claude` exists on this machine but is not an account. If a future reader adds it to the account list, the skill counts will double-count.
- A reviewer should scrutinise: the `status` resolution order (disabled beats unused beats active), and that `uses: 0` is never conflated with `uses: null`.
