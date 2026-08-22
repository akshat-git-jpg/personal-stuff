<!-- boss frontmatter -->
---
executor: claude-p
model: opus
test_cmd: bash tooling/cli/pp-land/test-pp-land.sh
ui:
deploy:
needs: []
needs_prs: [225, 226]
touches: [tooling/cli/pp-land/pp-land, tooling/cli/pp-land/verify-map.tsv, tooling/cli/pp-land/test-pp-land.sh, tooling/cli/pp-land/README.md, tooling/cli/greenlight/greenlight, scripts/lib/guard-install.sh]

mutation_apply: |
  python3 - <<'PY'
  p='tooling/cli/pp-land/pp-land'
  s=open(p).read()
  needle='PPLAND-MUTEX'
  assert needle in s, 'mutation target not found — the landing mutex is missing or was reworded'
  # Reintroduce the real defect: release the mutex BEFORE re-checking the coalesce flag,
  # so a commit arriving in that window sets a flag nobody ever reads and never lands.
  s=s.replace('coalesce_check_and_clear', 'true # coalesce_check_and_clear', 1)
  open(p,'w').write(s)
  PY
mutation_command: bash tooling/cli/pp-land/test-pp-land.sh
mutation_expect: "FAIL: a commit made during a land was silently dropped"
mutation_cwd:
mutation_timeout: 900
---

# Plan 228: `pp-land` — a commit lands on main by itself

## Summary

- **Problem statement**: With workspaces in place (plan 226) nothing carries a workspace commit to
  `main`. The obvious route — call `greenlight` — has three defects that only appear under real
  use. `greenlight:122` is an **unconditional** `wt get`, and `wt`'s pool is 8 slots
  (`wt:83 MAX_TREES=8`), so one land per commit exhausts the pool and — with the owner's
  no-notifications rule — commits silently stop landing. `greenlight` also has **no reset and no
  provisioning of its own**: it goes straight from `wt get` (line 122) to
  `git checkout "$BRANCH"` (line 131), because `wt get` was doing both jobs — reset **and**
  `run_bootstrap`, which symlinks `pipelines/.env`, `pipelines/credentials.json` and `.mcp.json`.
  And its land retry loop (lines 380-395) re-merges after a rejected push **without re-verifying**.
- **Goals**:
  - A new `pp-land` owns the landing sequence and a **dedicated landing worktree** outside the
    `wt` pool, so landing can never starve boss.
  - One mutex held across the **whole** land, not just the push, with **coalescing** so N commits
    during one land cost one extra land — and no commit is ever silently dropped.
  - `greenlight` gains only an optional `--worktree`, so its default behaviour stays
    byte-identical for boss, proven by a golden test.
  - A `post-commit` dispatcher fires the lander, writing **zero bytes** and only from a workspace.
- **Executor proposed**: `claude-p` / `opus`. Genuine concurrency: a mutex held across a
  minutes-long verify, a check-and-clear that must happen **inside** the lock, and a trigger that
  must acquire-then-flag rather than flag-then-exit.
- **Done criteria** (terse — full list below): `bash tooling/cli/pp-land/test-pp-land.sh` passes;
  the golden test proves greenlight's default path unchanged; the mutation recipe fails with the
  dropped-commit marker.
- **Stop conditions** (terse — full list below): `pp-land` calls `wt get`; the landing tree is
  cleaned with `-x` routinely; the coalesce flag is checked outside the mutex; anything pushes to
  the real origin.
- **Test / verification for success**: a new `tooling/cli/pp-land/test-pp-land.sh` with a real bare
  remote in `mktemp -d`, including a **concurrency case** that commits during an in-flight land and
  asserts both commits arrive.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If anything in the "STOP conditions" section
> occurs, stop and report. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 69042eb1..HEAD -- tooling/cli/greenlight/ scripts/lib/`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH — it publishes to a PUBLIC `main` with no branch protection, and it edits the
  lander boss depends on for every merge.
- **Depends on**: PRs for plan 225 (`pp-push` is the only way this pushes) and plan 226
  (`pp-work` defines the workspaces and manifests this reads).
- **Category**: feature
- **Difficulty**: tricky
- **Planned at**: commit `69042eb1`, 2026-08-23

## Why this matters

The owner's rule is: they commit when they choose, and it reaches `main` with no further action
and no notification. That last part is what makes each defect below severe rather than annoying —
a failure nobody is told about is a commit that silently never arrives.

Two of the three defects are invisible in a single-commit test and certain in real use. Pool
exhaustion needs two lands in flight, which is normal when the owner commits twice in the minutes
a verify takes. The missing reset+provisioning breaks the **first** land and every one after, and
the symptom is a test failure inside a tree with no `node_modules` and no credentials — which no
fix-up crew can repair.

## Current state

### `greenlight` — the three sites

Line 122, unconditional pool lease:

```bash
WT_PATH=$("$WT_BIN" get --repo "$REPO_TOPLEVEL" --holder "greenlight-$RUN_ID")
```

Lines 125-129, the cleanup trap (plan 222 already made this tolerate a refusal):

```bash
function cleanup() {
  log "Releasing worktree..."
  "$WT_BIN" return "$WT_PATH" || log "WARN: worktree NOT returned (dirty?) — slot stays leased: $WT_PATH"
}
trap cleanup EXIT
```

Line 131, straight to checkout — **no reset, no provisioning of its own**:

```bash
git -C "$WT_PATH" checkout "$BRANCH" >&2 || {
```

Lines 380-395, the land loop. Note it re-merges on a rejected push and does **not** re-verify:

```bash
for attempt in $(seq 1 "$LAND_ATTEMPTS"); do
  git -C "$WT_PATH" fetch origin main >&2 || true
  if ! git -C "$WT_PATH" checkout --detach origin/main >&2; then
    park "cannot detach at origin/main in worktree"
  fi
  if ! git -C "$WT_PATH" merge --no-ff "$BRANCH" -m "greenlight: land $BRANCH ($RUN_ID)" >&2; then
    git -C "$WT_PATH" merge --abort >&2 || true
    park "land merge conflict against origin/main"
  fi
  if pp-push … ; then   # plan 225 converted this line
    landed=1; break
  fi
  log "land push rejected (attempt $attempt/$LAND_ATTEMPTS) — origin/main moved; retrying"
done
```

Documented order (line 21): `rebase -> verify -> lint -> land`. So verify runs on the branch
**after** it has been rebased onto `origin/main` — the correct shape, and worth keeping.

### What `wt get` was silently providing

`tooling/cli/wt/wt:159-165`:

```bash
function run_bootstrap() {
  local wt_path=$1
  local hook_script="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/bootstrap.d/$REPO_BASENAME.sh"
  if [ -x "$hook_script" ]; then
    (export WT_MAIN_CHECKOUT="$REPO_TOPLEVEL"; cd "$wt_path" && "$hook_script") || echo "WARNING: bootstrap hook failed" >&2
  fi
}
```

and `bootstrap.d/personal-stuff.sh` links `pipelines/.env`, `pipelines/credentials.json`,
`.mcp.json` (plan 224 adds the 8 `apps/*/.dev.vars`). All are gitignored, so **`clean -x` would
delete exactly them**, plus all 14 `node_modules` directories. `wt`'s own `reset_worktree` uses
`clean -fd` **without** `-x` for that reason.

`-x` is also not needed for its supposed purpose: `checkout --detach` is blocked by modified
**tracked** files (handled by `reset --hard`) or an unmerged index (handled by the existing
`merge --abort` at 385-386), not by ignored build output.

### The three roots (plan 226 established the first two)

```
$HOME/kb-scratch/worktrees/<repo>-<hash8>   wt pool      reapable, reset on acquire
$HOME/kb-scratch/workspaces/<repo>-<hash8>  workspaces   NEVER reset
$HOME/kb-scratch/landing/<repo>-<hash8>     landing      ALWAYS reset — this plan
```

The landing tree is safe to reset precisely because no owner work ever lives there.

### `post-commit` facts, measured

- `git commit --no-verify` skips `pre-commit` but **still runs `post-commit`** — so the
  `commit-now` skill's `--no-verify` does not break the trigger.
- `post-commit` does **not** fire on `merge --no-ff` or on `rebase` (git uses `post-merge` for the
  former), so greenlight's own land cannot recurse into the lander.
- It **does** fire on a conflict-resolution `git commit`, which is intended — that is how a
  fix-up's resolution triggers the re-land.
- A hook in the shared `.git/hooks` fires from the main worktree **and** from linked worktrees when
  `core.hooksPath` is unset (plan 225 unsets it).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| The gate | `bash tooling/cli/pp-land/test-pp-land.sh` | prints `ALL TESTS PASSED`, exit 0 |
| Golden test (greenlight unchanged by default) | included in the harness | passes |
| Syntax-check | `bash -n tooling/cli/pp-land/pp-land tooling/cli/greenlight/greenlight` | no output |
| Regression net | `bash tooling/boss/test-boss.sh` | all pass, exit 0 |

## Scope

**In scope**:
- `tooling/cli/pp-land/pp-land`, `verify-map.tsv`, `test-pp-land.sh`, `README.md` — new
- `tooling/cli/greenlight/greenlight` — **only** the `--worktree` flag and the gated
  re-verify-on-retry
- `scripts/lib/guard-install.sh` — install the `post-commit` dispatcher alongside the existing
  `pre-push` one

**Out of scope** — looks related, do not touch:
- **`wt`.** `pp-land` must never call `wt get` or `wt return`. That is the pool-exhaustion defect.
- **boss's dispatch, merge, or state handling.** The blocked-land sweep is plan 229.
- **`pp-push`'s internals** — plan 225. `pp-land` calls it and never pushes directly.
- **`pp-work`'s removal rules** — plan 226. `pp-land` may call `pp-work remove` after a successful
  land, but must not reimplement its clean-and-merged test.
- **greenlight's rebase/verify/lint stages, its `LAND_ATTEMPTS` loop shape, and its parking
  behaviour.** Only the two changes named above.

## Git workflow

- Branch: `advisor/228-pp-land-automatic-landing`
- Commit per step, message style `feat(pp-land): <what>` — no AI footers. Do **NOT** push.

## Steps

### Step 1: Give greenlight an optional `--worktree`, and nothing else

Add a `--worktree <path>` option. When supplied:
- **skip** `wt get` entirely and use the given path as `WT_PATH`;
- **skip** the `cleanup` trap's `wt return` (there is no lease to return);
- enable re-verify on a forced re-merge in the land loop.

When **absent**, every one of those behaviours must be byte-identical to today. Implement it as a
single early branch around the acquire/cleanup block, not as scattered conditionals:

```bash
GL_WT_OVERRIDE="${GL_WT_OVERRIDE:-}"     # also settable by --worktree
...
if [ -n "$GL_WT_OVERRIDE" ]; then
  WT_PATH="$GL_WT_OVERRIDE"
  log "Using caller-provided worktree: $WT_PATH (no pool lease)"
  # No cleanup trap: the caller owns this tree's lifecycle. pp-land resets it before
  # every land, which is safe only because no owner work ever lives there.
else
  log "Acquiring worktree..."
  WT_PATH=$("$WT_BIN" get --repo "$REPO_TOPLEVEL" --holder "greenlight-$RUN_ID")
  log "Worktree acquired: $WT_PATH"
  function cleanup() { ... }   # unchanged
  trap cleanup EXIT
fi
```

In the land loop, add the re-verify **gated on the same flag**, so boss's retry path is untouched:

```bash
  log "land push rejected (attempt $attempt/$LAND_ATTEMPTS) — origin/main moved; retrying"
  if [ -n "$GL_WT_OVERRIDE" ] && [ "${#VERIFY_CMDS[@]}" -gt 0 ]; then
    # origin/main moved, so the tree we are about to push was never verified in this
    # combination. Re-verify before republishing. Gated on --worktree so boss's path
    # stays byte-identical.
    for cmd in "${VERIFY_CMDS[@]}"; do
      if ! ( cd "$WT_PATH" && eval "$cmd" ) >&2; then park "re-verify failed after re-merge: $cmd"; fi
    done
  fi
```

Read the existing verify stage (around line 329) and reuse its exact invocation form rather than
inventing one.

**Verify**: `bash -n tooling/cli/greenlight/greenlight` -> no output, exit 0
**Verify**: `grep -c 'GL_WT_OVERRIDE' tooling/cli/greenlight/greenlight` -> at least `3`

Commit: `feat(greenlight): optional --worktree, default path unchanged`

### Step 2: The verify map

Create `tooling/cli/pp-land/verify-map.tsv` — a path prefix, a tab, and the command whose exit 0
gates a land touching that prefix. There is deliberately **no** repo-wide suite (verified: no root
`scripts/check.sh` exists), so the map is how a land finds the right one. All entries below were
verified to exist.

```
tooling/cli/wt/	bash tooling/cli/wt/test-wt.sh
tooling/boss/	bash tooling/boss/test-boss.sh
tooling/cli/pp-push/	bash tooling/cli/pp-push/test-pp-push.sh
tooling/cli/pp-work/	bash tooling/cli/pp-work/test-pp-work.sh
tooling/cli/pp-land/	bash tooling/cli/pp-land/test-pp-land.sh
.claude/hooks/	bash .claude/hooks/test-no-history-in-main.sh
scripts/	bash scripts/check-repo-hygiene.sh
pipelines/video/visuals-flow/	cd pipelines/video/visuals-flow && bash scripts/check.sh
pipelines/video/intro-kit/	cd pipelines/video/intro-kit && bash scripts/check.sh
apps/tutorial-tracker-app/	cd apps/tutorial-tracker-app && npm test
```

`pp-land` runs **every** command whose prefix matches at least one changed path, de-duplicated. If
**no** prefix matches, it logs `no verify suite matched` and proceeds — the owner chose full
auto-merge, and refusing here would mean a doc-only commit never lands. The map is append-only:
adding a prefix narrows nothing.

**Verify**: every command's script exists —
`cut -f1 tooling/cli/pp-land/verify-map.tsv | while read -r p; do test -e "$p" || echo "MISSING $p"; done`
-> no output

Commit: `feat(pp-land): verify map`

### Step 3: Write `pp-land`

Create `tooling/cli/pp-land/pp-land`, `chmod +x`. Usage: `pp-land <workspace-path>`.

**The sequence. The order is load-bearing; do not reorder.**

```
acquire landing mutex        # held across the WHOLE land — pp-push's lock is taken at the
                             # push, AFTER a verify that takes minutes, so it cannot serialise
reset --hard  (landing tree)
clean -fd                    # NO -x: -x deletes the gitignored files wt's bootstrap links
                             # (pipelines/.env, credentials.json, .mcp.json, apps/*/.dev.vars)
                             # and all 14 node_modules, so every verify would fail
run bootstrap.d/<repo>.sh    # with WT_MAIN_CHECKOUT=<main>; wt get was doing this, and
                             # --worktree skips wt get
greenlight run --branch <b> --worktree <landing> --verify <each matched cmd>
on park  -> write land-<slug>.blocked, then goto coalesce
on land  -> pp-work remove <workspace>  (it refuses unless clean AND merged — do not force)
coalesce_check_and_clear     # INSIDE the mutex; loop if the flag was set
release mutex
invoke the land sweep        # AFTER releasing — plan 229 owns the sweep itself
```

**The mutex** — same hardening as `wt`'s pool lock and `pp-push`'s push lock: a `mkdir` lock
holding a `pid` file, a stale-break when the recorded pid is gone, an age-based break when there is
no pid, a bounded wait that fails loudly, and a release that only removes a lock this process owns.
Tag its refusal message `PPLAND-MUTEX`.

**Coalescing, not queueing.** Both sides must be atomic against the mutex:

```bash
# The land, INSIDE the mutex, at the end:
coalesce_check_and_clear() {
  # Check AND clear inside the lock, and loop if it was set. Checking before releasing and
  # then releasing would leave a window: a trigger arriving between the check and the
  # release finds the mutex held, sets the flag, and exits — and the holder has already
  # passed its check, so nobody re-runs. That commit then reaches main only if some LATER
  # commit happens to start a fresh land, and with no notifications it is indistinguishable
  # from success.
  if [ -f "$FLAG" ]; then rm -f "$FLAG"; return 0; fi   # 0 = re-run
  return 1
}

# The trigger side: acquire FIRST, flag only on failure, then retry acquisition once — so a
# holder that released in between makes this trigger the new runner.
```

**Escalation, and only on failure.** If `checkout --detach origin/main` fails, retry **once** after
`clean -xfd`, then give up and write `.blocked`. `-x` is never routine.

**On a blocked land**, write `land-<slug>.blocked` under
`$MAIN/tooling/boss/state/lands/` (create the directory) containing `workspace=`, `branch=`,
`reason=` (greenlight's parked reason), `attempts=`, `at=`. Change nothing else and leave the
workspace untouched.

**Refuse to auto-resolve deploy-live paths.** If the parked reason is a merge conflict and any
conflicted path is under `infra/`, `scripts/`, `.github/`, `tooling/boss/`, or matches
`apps/*/wrangler.toml`, record `reason=deploy-live-conflict` and mark the entry
`no_auto_resolve=1`. Those paths reach production via `vps-sync.sh`'s 15-minute pull; the land
simply waits.

**Verify**: `bash -n tooling/cli/pp-land/pp-land` -> no output, exit 0
**Verify**: `grep -c 'PPLAND-MUTEX' tooling/cli/pp-land/pp-land` -> `1`
**Verify**: `grep -c 'clean -xfd' tooling/cli/pp-land/pp-land` -> `1` (the single escalation)
**Verify**: `grep -cE 'wt get|wt return' tooling/cli/pp-land/pp-land` -> `0`

Commit: `feat(pp-land): the landing sequence, mutex and coalescing`

### Step 4: The `post-commit` dispatcher

Extend `scripts/lib/guard-install.sh`'s `guard_install` to also write
`$common/hooks/post-commit`, `chmod +x`. It must write **zero bytes** to stdout and stderr — its
output would otherwise land in the transcript of **every** commit — and must launch detached so a
commit never blocks on a minutes-long land.

It fires only when **all** hold:

1. it is in a **linked** worktree — `--path-format=absolute --git-dir` ≠ `--git-common-dir`;
2. the branch matches a workspace branch — `subject/*` or `work/*`;
3. a `pp-work` manifest exists naming that branch.

Condition 1 is what stops boss's own `main` commits triggering a land.
`boss-merge.sh:155` and `boss-commit-main.sh` both commit on `main` in the main worktree, and each
would otherwise spawn a full verify-and-push cycle, invisibly.

```bash
cat > "$hooks/post-commit" <<'HOOK'
#!/usr/bin/env bash
# Fires the lander when a WORKSPACE commit lands. Writes nothing: this runs on every
# commit, and any output would enter the session transcript each time.
set -uo pipefail
{
  gd=$(git rev-parse --path-format=absolute --git-dir 2>/dev/null) || exit 0
  gcd=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || exit 0
  [ "$gd" != "$gcd" ] || exit 0                       # main worktree -> never land
  br=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0
  case "$br" in subject/*|work/*) ;; *) exit 0;; esac
  top=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
  [ -f "$(dirname "$top")/manifest" ] || exit 0        # a pp-work workspace
  LAND="$(dirname "$gcd")/tooling/cli/pp-land/pp-land"
  [ -x "$LAND" ] || exit 0
  nohup "$LAND" "$top" >>"$(dirname "$top")/land.log" 2>&1 &
} >/dev/null 2>&1
exit 0
HOOK
```

**Verify**: `bash -n scripts/lib/guard-install.sh` -> no output, exit 0
**Verify**: the hook is silent — running it in a workspace produces no stdout/stderr (covered by
the harness)

Commit: `feat(pp-land): silent post-commit dispatcher`

### Step 5: The harness

Create `tooling/cli/pp-land/test-pp-land.sh`. `mktemp -d`, a bare origin, a sandboxed `HOME`,
`guard_install` into it, and a `pp-work` workspace. Required cases:

1. **A workspace commit lands on main.** `git ls-remote origin main` moves.
2. **A commit in the MAIN worktree does not trigger a land.** The dispatcher exits 0 silently and
   `origin/main` is unchanged. This is the boss-bookkeeping case.
3. **The dispatcher writes zero bytes.** Capture stdout+stderr of a workspace commit and assert the
   captured output is empty apart from git's own.
4. **A failing verify writes `land-<slug>.blocked`** with `workspace=`, `branch=`, `reason=`, and
   `origin/main` is unchanged.
5. **The landing tree is provisioned.** After a land, the landing tree contains the bootstrap
   symlinks and its `node_modules` was not deleted. Assert `clean -x` did not run: create an
   ignored file in the landing tree, land, and assert it survives.
6. **Concurrency / coalescing.** Start a land whose verify sleeps, commit again in the workspace
   during it, and assert **both** commits reach `origin/main` after everything settles. Failure
   message must be exactly `FAIL: a commit made during a land was silently dropped`.
7. **Golden test — greenlight's default path is unchanged.** Run `greenlight` **without**
   `--worktree` against a stub `wt` on `PATH` and assert the stub's `get` **and** `return` were
   both called, and that the retry path did **not** re-verify. This is what stops a bug here from
   wedging boss's merges.
8. **A deploy-live conflict is not auto-resolved.** Force a conflict in `infra/` and assert the
   `.blocked` entry carries `no_auto_resolve=1`.

Every long step needs a bounded timeout so a regression fails instead of hanging — a hanging test
is an invisible failure (LESSONS 2026-07-31).

**Verify**: `bash tooling/cli/pp-land/test-pp-land.sh` -> `ALL TESTS PASSED`, exit 0
**Verify**: `bash tooling/boss/test-boss.sh` -> all pass, exit 0

Commit: `test(pp-land): land, coalesce, and a greenlight golden test`

### Step 6: README

Create `tooling/cli/pp-land/README.md`: the sequence with the reason for each step's position; why
the mutex spans the whole land and not the push; why coalescing rather than queueing, and the
window that made the naive version drop a commit; why `clean -fd` and never routine `-x`; the three
roots; and the verify map's append-only rule.

**Verify**: `grep -c 'clean -fd' tooling/cli/pp-land/README.md` -> at least `1`

Commit: `docs(pp-land): record the landing sequence`

## Test plan

`bash tooling/cli/pp-land/test-pp-land.sh` is the gate — eight behavioural cases against a real
bare remote in a sandboxed `HOME`, never touching the real origin.

Cases 6 and 7 are the load-bearing pair. Case 6 is the concurrency window: the naive
`check flag → release mutex` order drops a commit that arrives between the two, and with no
notifications that is indistinguishable from success — so it is the mutation target. Case 7 is the
golden test protecting boss: greenlight is shared, and a duplicate lander would rot out of sync, so
the flag-absent path is asserted rather than assumed.

Case 5 is the one most likely to regress under a future "tidy the landing tree" change: it proves
`-x` did not run, which is what keeps credentials and `node_modules` present for the verify.

`bash tooling/boss/test-boss.sh` is the second regression net for the greenlight edit.

## Done criteria

- [ ] `bash tooling/cli/pp-land/test-pp-land.sh` prints `ALL TESTS PASSED`, exit 0.
- [ ] `bash tooling/boss/test-boss.sh` passes.
- [ ] `test -x tooling/cli/pp-land/pp-land` and `test -f tooling/cli/pp-land/test-pp-land.sh`
      both exit 0 (LESSONS 2026-08-17).
- [ ] `bash -n` passes on `pp-land`, `test-pp-land.sh`, `greenlight`, `guard-install.sh`.
- [ ] `grep -cE 'wt get|wt return' tooling/cli/pp-land/pp-land` returns `0`.
- [ ] `grep -c 'clean -xfd' tooling/cli/pp-land/pp-land` returns `1` — exactly one escalation site.
- [ ] `grep -c 'PPLAND-MUTEX' tooling/cli/pp-land/pp-land` returns `1`.
- [ ] `grep -c 'coalesce_check_and_clear' tooling/cli/pp-land/pp-land` returns at least `2`
      (definition and call).
- [ ] `grep -c 'GL_WT_OVERRIDE' tooling/cli/greenlight/greenlight` returns at least `3`.
- [ ] `grep -c 'post-commit' scripts/lib/guard-install.sh` returns at least `1`.
- [ ] Every verify-map command's script exists:
      `cut -f1 tooling/cli/pp-land/verify-map.tsv | while read -r p; do test -e "$p" || echo MISSING; done`
      prints nothing.
- [ ] `git ls-remote origin main` is unchanged from before the run — nothing was pushed to the
      real origin.
- [ ] The mutation recipe behaves as specified: clean passes; applying it makes the harness fail
      printing `FAIL: a commit made during a land was silently dropped`; reverting passes again.
- [ ] `git diff --stat` against the branch point touches only the six files in `touches`.

## STOP conditions

- **You are about to push to the real `origin`.** STOP. Every test uses a `mktemp -d` bare remote.
- **`pp-land` needs `wt get` or `wt return`.** STOP. That is the pool-exhaustion defect this plan
  exists to avoid — one land per commit against 8 slots, failing silently.
- **You are about to make `clean -xfd` the routine step.** STOP. It deletes the gitignored files
  the bootstrap links and all 14 `node_modules`, so every verify fails from the first land. It is
  a single retry-once escalation after a failed detach, nothing more.
- **You are about to check the coalesce flag outside the mutex, or release before checking.** STOP.
  That is the window that silently drops a commit, and it is the mutation gate.
- **Case 7 (the golden test) fails**, i.e. greenlight's behaviour changed with `--worktree` absent.
  STOP. boss depends on that path for every merge.
- **A verify suite fails inside the landing tree with a missing dependency or credential.** STOP
  and report — that means the reset/bootstrap order is wrong, not that the suite is broken. Do not
  "fix" it by adding an install step to the landing sequence.
- **You are tempted to fork greenlight** rather than add the flag. STOP — a duplicate lander rots
  out of sync with boss's critical path.
- **A test hangs.** STOP and report. Do not add a `sleep` or delete the case; a hanging test is an
  invisible failure.

## Maintenance notes

- Four locks now exist and must stay separate: `wt`'s pool lock, boss's Chrome lock, `pp-push`'s
  push lock, and `pp-land`'s landing mutex. Conflating the landing mutex with boss's Chrome lock
  would deadlock, because `boss-merge.sh` already holds the Chrome lock across the greenlight run
  that performs the push.
- The landing tree is the only worktree in this system that is always reset. That is safe **only**
  because no owner work ever lives there. If anything ever writes owner state into it, the reset
  becomes data loss.
- `verify-map.tsv` is append-only. A land whose changed paths match no prefix proceeds and logs
  `no verify suite matched` — deliberate, because the owner chose full auto-merge and a doc-only
  commit must still land. Adding a prefix is how coverage grows.
- The re-verify-on-retry is gated on `--worktree` on purpose. A reviewer should confirm the golden
  test still asserts boss's path does **not** re-verify; making it unconditional would change
  boss's merge timing without anyone asking for it.
- The `post-commit` dispatcher's silence is a requirement, not a style choice. Any `echo` added
  there costs tokens on every commit the owner makes, forever.
