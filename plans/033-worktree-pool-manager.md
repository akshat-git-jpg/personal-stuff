# Plan 033: `wt` — managed worktree pool for agent runs

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fd8e0df..HEAD -- tooling/cli/wt/ .claude/skills/personal-stuff-change-control/SKILL.md CLAUDE.md decisions.md`
> (Empty output, or changes only in files this plan owns, means no drift. Anything else: STOP.)

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (foundation for 034/035/037)
- **Category**: dx
- **Executor**: antigravity
- **Difficulty**: standard
- **Planned at**: commit `fd8e0df`, 2026-07-06

## Why this matters

The owner has decided (2026-07-06) to lift this repo's "no worktrees" rule for
**managed runs only**: agent/executor/parallel sessions get isolated worktrees
allocated by a pool manager; the owner's own interactive sessions, deploys, and
skill edits stay on the main checkout. This unlocks parallel agent sessions
(plan 037's captain) and isolated validation runs (plan 034) — both impossible
on one shared tree, which is why the old one-run-at-a-time rule existed.

The design adapts `kunchenguid/treehouse` (studied 2026-07-06): a daemon-free
pool of detached-HEAD worktrees with durable leases, reset-on-acquire, and a
bootstrap hook that recreates untracked runtime files (`.env`, credentials)
that a fresh worktree lacks. We deliberately build a smaller bash tool, not a
Go port: lease-only (no PID tracking — our only consumers are scripted agent
runs that explicitly return their lease), state as marker files (no JSON+jq
dependency), macOS-only.

## Current state

- `.claude/settings.json` is exactly:
  ```json
  {
    "worktree": {
      "bgIsolation": "none"
    }
  }
  ```
  Leave this file alone — it governs Claude Code's own bg-session isolation,
  which stays off; `wt` is a separate, explicit mechanism.
- `.claude/skills/personal-stuff-change-control/SKILL.md` contains this row in
  its non-negotiables table (edit target for Step 5):
  ```
  | **No worktrees in this repo.** Edit the main checkout directly. `.claude/settings.json` sets `worktree.bgIsolation: "none"`. | External systems (VPS pulls, symlinks, .mcp.json) key on the one checkout path; the orchestrate loop already enforces one-run-at-a-time on the shared tree. | Owner-set stance; also why orchestrate v2.1 added the one-run-at-a-time rule. |
  ```
  and this red-flag bullet: `- "A worktree would be cleaner here"`.
- Untracked runtime files that exist in the main checkout but not in a fresh
  worktree (verified 2026-07-06): `pipelines/.env`, `pipelines/credentials.json`,
  `.mcp.json` (repo root, machine-local), per-app `node_modules/` (recreated on
  demand by `npm install`, NOT bootstrapped).
- Heavy artifacts live outside the repo in `~/kb-scratch/` (media policy,
  decisions.md 2026-07-04) — the pool goes there too.
- CLI conventions: match `tooling/cli/youtube/` (a `pp-*` bash wrapper + README).
  Exemplar wrapper: `tooling/cli/youtube/pp-yt-transcript`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Bash syntax check | `bash -n tooling/cli/wt/wt` | exit 0, no output |
| Run the test script | `bash tooling/cli/wt/test-wt.sh` | last line `ALL TESTS PASSED`, exit 0 |
| Repo health | `./scripts/check-apps.sh` | exit 0 (KNOWN_FAILING skips are fine) |

## Scope

**In scope**:
- `tooling/cli/wt/wt` (new — the tool)
- `tooling/cli/wt/bootstrap.d/personal-stuff.sh` (new — per-repo bootstrap hook)
- `tooling/cli/wt/test-wt.sh` (new — self-test using a throwaway git repo)
- `tooling/cli/wt/README.md` (new)
- `.claude/skills/personal-stuff-change-control/SKILL.md` (amend the worktree rule)
- `CLAUDE.md` (one routing-table row)
- `decisions.md` (one entry)

**Out of scope**:
- `.claude/settings.json` — do not touch (bgIsolation stays "none").
- `scripts/relink.sh`, any skill under `tooling/claude-skills/` — skill-edit
  rules are unchanged.
- Anything under `apps/`, `pipelines/` — the bootstrap hook reads them, never
  edits them.

## Git workflow

- Branch: `advisor/033-worktree-pool`
- Commit per step: `feat(wt): <step summary>` — no AI footers. Do NOT push.

## Steps

### Step 1: Create `tooling/cli/wt/wt`

A single bash script implementing exactly this contract (no extra features):

```
wt get    [--repo <path>] [--holder <label>]   # acquire a worktree, print its path (ONLY the path on stdout)
wt return <worktree-path>                      # release the lease, reset the worktree
wt status [--repo <path>]                      # table: N, state (free|leased|dirty), holder, age
wt prune  [--repo <path>] [--yes]              # delete free+clean worktrees (dry-run without --yes)
```

Design constants and rules (all decided — implement as stated):

- Pool dir: `~/kb-scratch/worktrees/<repo-basename>-<hash8>/` where `hash8` is
  the first 8 hex chars of `shasum -a 256` of the repo's absolute path
  (`git rev-parse --show-toplevel`). `--repo` defaults to the current repo.
- Worktrees are numbered dirs: `<pool>/<N>/<repo-basename>` (nested basename so
  tools see a familiar dir name — treehouse's trick).
- Lease state = marker file `<pool>/<N>.lease` containing two lines:
  `holder=<label>` and `leased_at=<ISO8601>`. No lease file = free.
  All state mutations happen under `flock` on `<pool>/.lock`
  (macOS has no flock(1) by default — use `mkdir`-based locking:
  `until mkdir "<pool>/.lock.d" 2>/dev/null; do sleep 0.2; done` … `rmdir` on
  exit via `trap`).
- **Acquire**: `git -C <repo> fetch origin` (tolerate failure with a stderr
  warning — offline must still work); scan numbered dirs in order; a candidate
  is free iff no `.lease` file AND `git -C <wt> status --porcelain
  --untracked-files=all` is empty. On a candidate: reset it
  (`git checkout --detach <ref> && git reset --hard <ref> && git clean -fd`,
  where `<ref>` is `origin/<default>` if it exists else local default branch;
  default branch from `git symbolic-ref refs/remotes/origin/HEAD` with
  fallback `main`). No candidate: `git worktree add --detach <path> <ref>`,
  capped at 8 worktrees per pool (`ERROR: pool full (8)` on stdout, exit 1).
  Then write the `.lease` file, run the bootstrap hook (Step 2), and print
  **only the worktree path** on stdout (everything else to stderr) so
  `path=$(wt get --holder captain)` works.
- **Return**: verify the path is inside a pool (else exit 2 with
  `ERROR: not a wt-managed worktree`); warn on stderr if
  `git log --oneline @{u}..HEAD 2>/dev/null` or a dirty tree suggests unlanded
  work, but proceed (the caller owns that judgment); delete the `.lease`,
  detach + reset + clean as in acquire.
- **Dirty worktrees stay parked**: acquire skips them; `status` shows `dirty`;
  only `prune --yes` on a FREE+CLEAN worktree deletes
  (`git worktree remove <path>` then remove the numbered dir). Never delete
  dirty or leased ones — no `--force` flag exists in v1.
- Exit codes: 0 success, 1 operational error (pool full, git failure), 2 usage
  error (unknown flag/command — fail loud, list valid commands in the error).

**Verify**: `bash -n tooling/cli/wt/wt` → exit 0

### Step 2: Create the bootstrap hook

`wt get` runs `tooling/cli/wt/bootstrap.d/<repo-basename>.sh` (if it exists,
resolved relative to the `wt` script's own location via
`"$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"`) with cwd = the new worktree
and `$WT_MAIN_CHECKOUT` = the main repo path. Hook failures print a stderr
warning but never fail the acquire.

`bootstrap.d/personal-stuff.sh` — exactly this content:

```bash
#!/bin/bash
# wt bootstrap for personal-stuff worktrees: link machine-local runtime files
# from the main checkout. Symlinks (not copies) so secrets have one home.
set -u
main="${WT_MAIN_CHECKOUT:?}"
link() {  # link <relpath>
  [ -e "$main/$1" ] || return 0
  mkdir -p "$(dirname "$1")"
  ln -sfn "$main/$1" "$1"
}
link pipelines/.env
link pipelines/credentials.json
link .mcp.json
```

**Verify**: `bash -n tooling/cli/wt/bootstrap.d/personal-stuff.sh` → exit 0

### Step 3: Create `test-wt.sh`

Self-test that never touches the real repo: create a throwaway git repo in
`$(mktemp -d)` (one commit, a `main` branch, plus a fake untracked
`pipelines/.env` to prove bootstrap linking), point `wt` at it with `--repo`,
and assert, in order:

1. `wt get` prints exactly one line, which is an existing directory ending in
   the repo basename.
2. The pool contains `1.lease` with a `holder=` line.
3. A second `wt get` yields a DIFFERENT path (first is leased).
4. `wt return <path1>` frees it: third `wt get` reuses path 1.
5. Dirty parking: `touch <wt>/junk` after returning, next `get` skips it and
   allocates a new number.
6. `wt status` output contains one `leased` and one `dirty` line.
7. `wt prune` without `--yes` deletes nothing; with `--yes` removes only the
   free+clean worktree.
8. Unknown command exits 2.

Use `set -e` + a `fail()` helper; print `ALL TESTS PASSED` as the last line.
Clean up the temp dirs on exit via `trap`.

**Verify**: `bash tooling/cli/wt/test-wt.sh` → `ALL TESTS PASSED`, exit 0

### Step 4: README

`tooling/cli/wt/README.md`: what it is (managed pool, lease-only, detached
HEAD), the 4 commands with one example each, the bootstrap.d contract, the
"managed runs only" policy (owner sessions/deploys/skill edits stay on the
main checkout), and the design provenance (adapted from kunchenguid/treehouse;
what we dropped: PID owner-tracking, process cwd scanning, repo-level hooks).

**Verify**: `test -s tooling/cli/wt/README.md` → exit 0

### Step 5: Amend the house rule docs

1. In `.claude/skills/personal-stuff-change-control/SKILL.md`, replace the
   "No worktrees in this repo." table row (quoted in Current state) with:
   ```
   | **Worktrees only via `wt` (managed runs).** Agent/executor/parallel runs work in pool worktrees from `tooling/cli/wt`; owner interactive sessions, deploys, VPS/cron ops, and skill edits stay on the main checkout. Never create ad-hoc worktrees by hand. | Parallel agent runs need isolation, but external systems (VPS pulls, symlinks, .mcp.json) and the deploy/skill toolchain key on the one checkout path — the pool bootstraps runtime files and keeps the main checkout canonical. | Rule lifted 2026-07-06 (decisions.md) after the agentic-workflow study; replaces the 2026-07-05 blanket ban. |
   ```
   and replace the red-flag bullet `- "A worktree would be cleaner here"` with
   `- "I'll just git worktree add by hand instead of wt get"`.
2. In root `CLAUDE.md`, add one row to the "Find it fast" table:
   `| Worktree pool for agent runs (wt) | tooling/cli/wt/README.md |`
   (match the existing table's link style).
3. Append to `decisions.md` under `## Decisions` (newest at top):
   `2026-07-06 — lifted the no-worktree rule to "managed runs only": agent/executor/parallel runs use the wt pool (tooling/cli/wt, adapted from kunchenguid/treehouse — lease-only, detached HEAD, bootstrap.d symlinks pipelines/.env + credentials.json + .mcp.json); owner interactive sessions, deploys, and skill edits stay on the main checkout — parallel captain/validation runs (plans 034/037) are impossible on one shared tree, and the pool + bootstrap removes the path-keying hazards the old ban protected against. (plans/033)`

**Verify**: `grep -c "wt get" .claude/skills/personal-stuff-change-control/SKILL.md` → `1` or more; `grep -c "managed runs only" decisions.md` → `1` or more

## Test plan

`test-wt.sh` is the test (Step 3) — it exercises acquire/lease/return/dirty/
prune end-to-end on a throwaway repo. No unit-test framework: this repo's
convention is executable self-tests (compare `scripts/fixtures/` +
`test-runlog.sh` in `.claude/skills/orchestrate/scripts/`).

## Done criteria

- [ ] `bash tooling/cli/wt/test-wt.sh` prints `ALL TESTS PASSED`, exit 0
- [ ] `bash -n` passes on both scripts
- [ ] `wt get` in personal-stuff produces a worktree where `pipelines/.env` is
      a symlink to the main checkout's copy: `test -L <wt>/pipelines/.env`
      (then `wt return` it)
- [ ] `./scripts/check-apps.sh` exit 0
- [ ] SKILL.md row + CLAUDE.md row + decisions.md entry all present

## STOP conditions

- The real personal-stuff repo's `git worktree list` shows worktrees you did
  not create — report, don't prune them.
- `wt get` on the real repo takes >60s (fetch hang) — report; do not add
  retries or timeouts beyond what's specced.
- Any need to modify `.claude/settings.json` — that file is out of scope.

## Maintenance notes

- Plan 034 (greenlight) and 037 (captain) consume `wt get --holder <label>` /
  `wt return` — the stdout-path-only contract is load-bearing; never add
  stdout chatter to `get`.
- The 8-worktree cap is per-pool; raise it in one place (`MAX_TREES` constant)
  if the captain regularly exhausts it.
- New untracked runtime files (a future `.env` elsewhere) must be added to
  `bootstrap.d/personal-stuff.sh` — the config-and-secrets skill's inventory
  is the checklist.
