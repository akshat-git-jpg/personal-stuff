<!-- boss frontmatter -->
---
executor: claude-p
model: opus
test_cmd: bash tooling/cli/wt/test-wt.sh
ui:
deploy:
needs: []
needs_prs: []
touches: [tooling/cli/wt/wt, tooling/cli/wt/test-wt.sh, tooling/cli/wt/README.md, tooling/cli/greenlight/greenlight]

mutation_apply: |
  python3 - <<'PY'
  import re,io
  p='tooling/cli/wt/wt'
  s=open(p).read()
  # Reintroduce the real defect: `return` warns about a dirty tree, then wipes it.
  needle='ERROR: worktree is DIRTY — NOT returned'
  assert needle in s, 'mutation target not found — the fix is missing or was reworded'
  s=s.replace('      if [ "$FORCE_DIRTY" -ne 1 ]; then\n        echo "ERROR: worktree is DIRTY — NOT returned',
              '      if false; then\n        echo "ERROR: worktree is DIRTY — NOT returned')
  open(p,'w').write(s)
  PY
mutation_command: bash tooling/cli/wt/test-wt.sh
mutation_expect: "FAIL: return WIPED a dirty worktree without --force-dirty"
mutation_cwd:
mutation_timeout: 600
---

# Plan 222: `wt` must never destroy uncommitted work, and must never wedge forever

## Summary

- **Problem statement**: `tooling/cli/wt/wt` has three defects that each cost real work or block
  all future work. `wt return` prints `WARNING: worktree is dirty` and then wipes the worktree
  anyway. `wt get` reclaims an unleased-but-dirty slot with the message
  `uncommitted work discarded`. And `lock_pool` is an unbounded `until mkdir` spin with no
  timeout and no stale-break, so one holder killed with `SIGKILL` (which skips its `EXIT` trap)
  leaves the lock directory in place and **every future `wt` invocation hangs forever, silently**.
- **Goals**:
  - `wt return` refuses a dirty worktree unless `--force-dirty` is passed.
  - `wt get` skips (never reclaims) an unleased-but-dirty slot unless `--force-dirty` is passed.
  - `lock_pool` breaks a provably-stale lock, bounds its wait, and fails loudly instead of
    hanging; `unlock_pool` only removes a lock it actually owns.
  - `greenlight`'s `EXIT` trap keeps its exit code when a return is refused (see Step 5 — this is
    the one interaction that makes the rest safe to land).
- **Executor proposed**: `claude-p` / `opus`. Per `tooling/boss/data/rules.md`, *tricky — subtle
  concurrency* routes here, and `lock_pool` is exactly that: the executor has to reason about a
  dead-vs-live holder, a lock with no pid file, and subshell ownership in an `EXIT` trap. The
  owner approved opus where the rules require it. Every snippet is still inlined verbatim so the
  model places rather than invents, and each new test fails if its guard does not actually fire.
- **Done criteria** (terse — full list below): `bash tooling/cli/wt/test-wt.sh` prints
  `ALL TESTS PASSED`; the four new tests exist and are numbered 17-20; the mutation recipe fails
  with the expected marker.
- **Stop conditions** (terse — full list below): any existing test 1-16 is weakened, renumbered or
  deleted; `wt return` is made to refuse on *unpushed commits* as well as dirt; a fix requires
  touching any file outside the four in `touches`.
- **Test / verification for success**: the repo's existing `tooling/cli/wt/test-wt.sh` harness,
  extended with four new tests. Every new test asserts an *observable refusal* — that the file
  still exists, or that the lock was broken — never that a string appears in the source.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If anything in the "STOP conditions" section
> occurs, stop and report. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 69042eb1..HEAD -- tooling/cli/wt/ tooling/cli/greenlight/greenlight`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED — `wt` is on the critical path of every boss dispatch and every greenlight land.
- **Depends on**: none. This plan is standalone and useful on its own.
- **Category**: bug
- **Difficulty**: standard (see the executor note in Summary)
- **Planned at**: commit `69042eb1`, 2026-08-23

## Why this matters

`wt` exists to protect isolated work. Today it destroys it in two places and can lock the whole
pool in a third.

The load-bearing fact, recorded in `decisions.md` (2026-08-02) and in this repo's own memory
(`boss-claudep-maxturns-uncommitted`, `boss-killed-merge-leaves-mutation-applied`): **a
mid-flight kill routinely leaves a complete-but-uncommitted implementation.** Losing a pool slot
is far cheaper than losing that work. `wt reap` and `wt release` were written on exactly that
principle in August 2026 — they refuse a dirty tree and say so. `wt get` and `wt return` were
never brought in line, so the invariant holds only while a lease file happens to exist.

The `lock_pool` defect is a different shape and worse in one way: it fails **silently and
permanently**. `mkdir` is the lock, an `EXIT` trap is the release, and `SIGKILL` skips traps. One
killed `wt` and every later `wt get`, `wt return`, `wt status`, `wt reap` spins on
`sleep 0.2` with no timeout and no message — including the ones boss and greenlight call, so a
dispatch or a land simply hangs. There is no diagnostic to lead anyone to `.lock.d`.

## Current state

### `tooling/cli/wt/wt` — the four sites to change

**Site A — `lock_pool` / `unlock_pool` (lines 88-99).** Verbatim:

```bash
function lock_pool() {
  mkdir -p "$POOL"
  until mkdir "$LOCK_DIR" 2>/dev/null; do
    sleep 0.2
  done
}

function unlock_pool() {
  rmdir "$LOCK_DIR" 2>/dev/null || true
}

trap unlock_pool EXIT
```

No timeout, no staleness test, no owner record. `unlock_pool` runs from the `EXIT` trap on
**every** exit path, including ones where this process never held the lock — so a process that
gave up (or exited early) can remove another process's lock.

**Site B — `wt get`, the unleased-slot branch (lines 178-189).** Verbatim:

```bash
      if [ -d "$wt_path" ]; then
        if [ ! -f "$lease_file" ]; then
          # Check if clean
          if [ -n "$(git -C "$wt_path" status --porcelain --untracked-files=all 2>/dev/null)" ]; then
            echo "wt: reclaimed dirty orphaned slot $wt_path (crashed holder, uncommitted work discarded)" >&2
          fi
          reset_worktree "$wt_path"
          allocated_path="$wt_path"
          allocated_lease="$lease_file"
          break
        fi
      else
```

It prints that the work is being discarded and then discards it.

**Site C — `wt return` (lines 245-268).** Verbatim:

```bash
  return)
    wt_path=$(cd "$TARGET_WT" 2>/dev/null && pwd) || { echo "ERROR: invalid path" >&2; exit 2; }

    if [[ "$wt_path" != "$POOL/"*"/$REPO_BASENAME" ]]; then
      echo "ERROR: not a wt-managed worktree" >&2
      exit 2
    fi

    # Check if dirty or unpushed
    if [ -n "$(git -C "$wt_path" log --oneline @{u}..HEAD 2>/dev/null)" ]; then
      echo "WARNING: worktree has unpushed commits" >&2
    fi
    if [ -n "$(git -C "$wt_path" status --porcelain --untracked-files=all 2>/dev/null)" ]; then
      echo "WARNING: worktree is dirty" >&2
    fi

    n_dir=$(dirname "$wt_path")
    i=$(basename "$n_dir")
    lease_file="$POOL/$i.lease"

    lock_pool
    rm -f "$lease_file"
    reset_worktree "$wt_path"
    unlock_pool
    ;;
```

`reset_worktree` (lines 110-121) is `checkout --detach` + `reset --hard` + `clean -fd`. So the
`WARNING` is followed immediately by the wipe.

**Site D — the `return` argument parser (lines 63-66).** Verbatim:

```bash
  return)
    if [ $# -ne 1 ]; then usage; fi
    TARGET_WT="$1"
    ;;
```

`return` accepts **exactly one** argument, so `wt return --force-dirty <path>` currently calls
`usage` and exits 2. This parser **must** change or Step 3's escape hatch is unreachable.

`FORCE_DIRTY` already exists (initialised to `0` at line 47) and is already parsed for
`get|status|prune|reap|release` (line 59: `--force-dirty) FORCE_DIRTY=1; shift ;;`), so **no
change is needed for `get`.**

### The precedent to imitate

`reap_slot` already implements exactly the refusal this plan adds, and its wording is the house
style. Read it before writing Steps 2 and 3 and match its tone:

```bash
  if ! wt_is_clean "$wt_path" && [ "$FORCE_DIRTY" -ne 1 ]; then
    echo "wt: slot $i STALE but DIRTY — NOT reaped (holder=$holder, ${age}h old)" >&2
```

`wt_is_clean` already exists as a helper — **use it** in Steps 2 and 3 rather than re-inlining a
`git status --porcelain` call.

### `tooling/cli/greenlight/greenlight` — the interaction that makes this safe

Line 1-2 are `#!/bin/bash` and `set -euo pipefail`. Lines 125-129 are verbatim:

```bash
function cleanup() {
  log "Releasing worktree..."
  "$WT_BIN" return "$WT_PATH"
}
trap cleanup EXIT
```

That call is **unguarded**, inside an `EXIT` trap, under `set -e`. Once Step 3 makes
`wt return` exit non-zero on a dirty tree, a land that leaves any dirt would make greenlight
itself exit non-zero — so boss would read a **successful** land as a failure. Step 5 fixes this
and is not optional.

### Existing test that this plan must rewrite, not delete

`tooling/cli/wt/test-wt.sh` test 5 (lines 57-69) asserts the **old** behaviour:

```bash
# 5. Reclaim unleased dirty slot
"$WT_BIN" return "$path1" 2>/dev/null
touch "$path1/junk"
echo "dirty change" >> "$path1/README.md"
...
path4=$("$WT_BIN" get --repo "$TEST_REPO" --holder test4 2>"$get_err")
[ "$path1" = "$path4" ] || fail "dirty unleased path 1 was not reclaimed/reused, got $path4"
[ -z "$(git -C "$path1" status --porcelain --untracked-files=all 2>/dev/null)" ] || fail "reclaimed path 1 is still dirty"
grep -q "wt: reclaimed dirty orphaned slot $path1" "$get_err" || fail "reclaim log message not printed to stderr"
```

Step 4 rewrites test 5 to the new contract. Tests 1-4 and 6-16 must be left byte-identical.

Note that test 5 also depends on `wt return "$path1"` succeeding while `path1` is **clean** — it
dirties the slot only afterwards. That ordering still works after Step 3.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Baseline the suite before touching anything | `bash tooling/cli/wt/test-wt.sh` | prints `ALL TESTS PASSED`, exit 0 |
| Run the suite (the merge gate) | `bash tooling/cli/wt/test-wt.sh` | prints `ALL TESTS PASSED`, exit 0 |
| Syntax-check the script after each edit | `bash -n tooling/cli/wt/wt` | no output, exit 0 |
| Syntax-check greenlight | `bash -n tooling/cli/greenlight/greenlight` | no output, exit 0 |
| Confirm the real pool is untouched | `wt status --repo /Users/kbtg/codebase/personal-stuff` | 8 rows, all `free` |

## Scope

**In scope** — only these four files:
- `tooling/cli/wt/wt`
- `tooling/cli/wt/test-wt.sh`
- `tooling/cli/wt/README.md`
- `tooling/cli/greenlight/greenlight` — Step 5 only, the three-line `cleanup` function only

**Out of scope** — looks related, do not touch:
- `tooling/boss/bin/*.sh` — boss also calls `wt return` (`boss-dispatch.sh` error paths). Its
  calls are **not** in traps and not under a trap's exit-code contract, so they surface a refusal
  as a visible error, which is the desired behaviour. Changing boss is a separate plan.
- `tooling/cli/wt/bootstrap.d/personal-stuff.sh` — a later plan adds `.dev.vars` to it.
- `reap_slot`, `wt release`, `wt reap`, `wt prune` — they already refuse dirty trees correctly.
- The `WARNING: worktree has unpushed commits` check in `return`. **Leave it as a warning.**
  Promoting it to a refusal would block greenlight, which legitimately returns worktrees whose
  branch is ahead of its upstream. Dirt is the data-loss case; unpushed commits are recoverable
  from the branch.

## Git workflow

- Branch: `advisor/222-wt-never-destroys-uncommitted-work`
- Commit per step, message style `fix(wt): <what>` — no AI footers. Do **NOT** push.

## Steps

### Step 1: Harden the pool lock

Record the baseline first: run `bash tooling/cli/wt/test-wt.sh` and confirm `ALL TESTS PASSED`.
If it does not pass **before** your changes, STOP and report — you would otherwise be unable to
tell your own breakage from pre-existing breakage.

In `tooling/cli/wt/wt`, add this constant immediately below the existing
`DEFAULT_TTL_HOURS=24` line:

```bash
# Bounded wait for the pool lock. Pre-2026-08-23 `lock_pool` was an unbounded
# `until mkdir` spin released only by an EXIT trap — and SIGKILL skips traps, so a
# single killed `wt` wedged EVERY later `wt` call forever, with no timeout and no
# message. There is no diagnostic that leads anyone to the lock dir, so the fix is
# to break a provably-dead lock, bound the wait, and fail loudly.
LOCK_WAIT_SECS=30
```

Then replace Site A (the whole `lock_pool` / `unlock_pool` / `trap` block) with **exactly** this:

```bash
function lock_pool() {
  mkdir -p "$POOL"
  local iters=0 max_iters=$((LOCK_WAIT_SECS * 5)) owner_pid now mtime
  while ! mkdir "$LOCK_DIR" 2>/dev/null; do
    owner_pid=$(cat "$LOCK_DIR/pid" 2>/dev/null || echo "")
    # A recorded holder that no longer exists was killed before its trap ran.
    if [ -n "$owner_pid" ] && ! kill -0 "$owner_pid" 2>/dev/null; then
      echo "wt: breaking stale pool lock (holder pid $owner_pid is gone)" >&2
      rm -rf "$LOCK_DIR"; continue
    fi
    # No pid file at all: either a lock created before this fix, or a holder killed
    # between `mkdir` and the pid write. Break it on age alone.
    if [ -z "$owner_pid" ]; then
      now=$(date +%s)
      mtime=$(stat -f %m "$LOCK_DIR" 2>/dev/null || echo "$now")
      if [ $((now - mtime)) -ge "$LOCK_WAIT_SECS" ]; then
        echo "wt: breaking stale pool lock (no pid recorded, ${LOCK_WAIT_SECS}s+ old)" >&2
        rm -rf "$LOCK_DIR"; continue
      fi
    fi
    if [ "$iters" -ge "$max_iters" ]; then
      echo "ERROR: pool lock held >${LOCK_WAIT_SECS}s by live pid ${owner_pid:-unknown}" >&2
      echo "  Not breaking a lock whose holder is alive. Inspect that process, or if it is" >&2
      echo "  wedged, remove: $LOCK_DIR" >&2
      exit 1
    fi
    sleep 0.2; iters=$((iters + 1))
  done
  printf '%s\n' "$$" > "$LOCK_DIR/pid"
}

# Only remove a lock this process actually owns. The EXIT trap fires on every exit
# path, including ones where lock_pool was never called or gave up — a blind rmdir
# there lets a process that never held the lock free someone else's.
function unlock_pool() {
  local owner_pid
  owner_pid=$(cat "$LOCK_DIR/pid" 2>/dev/null || echo "")
  if [ -n "$owner_pid" ] && [ "$owner_pid" != "$$" ]; then
    return 0
  fi
  rm -rf "$LOCK_DIR" 2>/dev/null || true
}

trap unlock_pool EXIT
```

Note the change from `rmdir` to `rm -rf`: the lock directory now contains a `pid` file, so
`rmdir` would always fail and leave the lock behind.

**Verify**: `bash -n tooling/cli/wt/wt` -> no output, exit 0
**Verify**: `bash tooling/cli/wt/test-wt.sh` -> `ALL TESTS PASSED`

Commit: `fix(wt): bound the pool lock and break a dead holder's`

### Step 2: `wt get` skips a dirty unleased slot instead of reclaiming it

Replace Site B's inner block with **exactly** this:

```bash
      if [ -d "$wt_path" ]; then
        if [ ! -f "$lease_file" ]; then
          if ! wt_is_clean "$wt_path"; then
            if [ "$FORCE_DIRTY" -ne 1 ]; then
              echo "wt: slot $i unleased but DIRTY — skipped, NOT reclaimed" >&2
              echo "  Uncommitted work is still there: $wt_path" >&2
              echo "  Rescue it, or discard it with: wt get --force-dirty" >&2
              continue
            fi
            echo "wt: reclaimed dirty orphaned slot $wt_path (--force-dirty: uncommitted work discarded)" >&2
          fi
          reset_worktree "$wt_path"
          allocated_path="$wt_path"
          allocated_lease="$lease_file"
          break
        fi
      else
```

`continue` moves to the next candidate slot, so a single dirty orphan no longer blocks
allocation — it just stops being silently destroyed. `FORCE_DIRTY` needs no parser change for
`get`.

**Verify**: `bash -n tooling/cli/wt/wt` -> no output, exit 0
**Verify**: `grep -c 'uncommitted work discarded' tooling/cli/wt/wt` -> `1` (only the
`--force-dirty` path says it now)

Commit: `fix(wt): get skips a dirty unleased slot instead of wiping it`

### Step 3: `wt return` refuses a dirty worktree

First fix Site D, the parser. Replace the `return)` arm of the argument-parsing `case` with
**exactly** this:

```bash
  return)
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --force-dirty) FORCE_DIRTY=1; shift ;;
        -*) usage ;;
        *) [ -n "$TARGET_WT" ] && usage; TARGET_WT="$1"; shift ;;
      esac
    done
    [ -n "$TARGET_WT" ] || usage
    ;;
```

Then in Site C, replace the dirty `WARNING` block with **exactly** this:

```bash
    if ! wt_is_clean "$wt_path"; then
      if [ "$FORCE_DIRTY" -ne 1 ]; then
        echo "ERROR: worktree is DIRTY — NOT returned" >&2
        echo "  A mid-flight kill routinely leaves a complete-but-uncommitted implementation;" >&2
        echo "  losing a slot is far cheaper than losing that work (decisions.md 2026-08-02)." >&2
        echo "  $wt_path" >&2
        echo "  Rescue it, or discard it with: wt return --force-dirty $wt_path" >&2
        exit 1
      fi
      echo "wt: returning a DIRTY worktree (--force-dirty: uncommitted work discarded)" >&2
    fi
```

Leave the `WARNING: worktree has unpushed commits` check immediately above it **unchanged** —
see Scope for why.

Also update the `usage()` function's `return` line to show the new flag:

```bash
  echo "  return <worktree-path> [--force-dirty]" >&2
```

**Verify**: `bash -n tooling/cli/wt/wt` -> no output, exit 0
**Verify**: `bash tooling/cli/wt/wt return 2>&1 | grep -c -- '--force-dirty'` -> at least `1`

Commit: `fix(wt): return refuses a dirty worktree without --force-dirty`

### Step 4: Rewrite test 5 and add tests 17-20

In `tooling/cli/wt/test-wt.sh`, replace the whole of test 5 (from the `# 5. Reclaim unleased
dirty slot` comment through the `rm -f "$get_err"` line) with **exactly** this:

```bash
# 5. An unleased DIRTY slot is SKIPPED, not reclaimed. Pre-2026-08-23 `get` wiped it
#    and announced "uncommitted work discarded"; a mid-flight kill routinely leaves a
#    complete-but-uncommitted implementation there.
"$WT_BIN" return "$path1" 2>/dev/null
touch "$path1/junk"
echo "dirty change" >> "$path1/README.md"

get_err=$(mktemp)
path4=$("$WT_BIN" get --repo "$TEST_REPO" --holder test4 2>"$get_err")
[ "$path1" != "$path4" ] || fail "get RECLAIMED a dirty unleased slot (work destroyed)"
[ -f "$path1/junk" ] || fail "get DESTROYED untracked work in the dirty unleased slot"
grep -q "dirty change" "$path1/README.md" || fail "get DESTROYED tracked edits in the dirty unleased slot"
grep -q "unleased but DIRTY — skipped" "$get_err" || fail "get did not explain why it skipped the dirty slot"
rm -f "$get_err"

# 5b. --force-dirty is the explicit opt-in that DOES reclaim it.
path4=$("$WT_BIN" get --repo "$TEST_REPO" --holder test4b --force-dirty 2>/dev/null)
[ "$path1" = "$path4" ] || fail "get --force-dirty did not reclaim the dirty unleased slot"
[ ! -f "$path1/junk" ] || fail "get --force-dirty did not clean the reclaimed slot"
```

Then append tests 17-20 at the end of the file, immediately **before** the final
`echo "ALL TESTS PASSED"` line, exactly as written:

```bash
# ---------------------------------------------------------------------------
# 17-20 (2026-08-23). `return` must refuse a dirty tree, and the pool lock must
# never wedge. Both were silent-failure defects: `return` printed
# "WARNING: worktree is dirty" and wiped it anyway, and lock_pool was an unbounded
# `until mkdir` spin whose only release was an EXIT trap that SIGKILL skips.
# ---------------------------------------------------------------------------

# 17. return REFUSES a dirty worktree, and the work survives.
p17=$("$WT_BIN" get --repo "$TEST_REPO" --holder ret17 2>/dev/null)
printf 'precious\n' > "$p17/KEEPME.txt"
echo "tracked edit" >> "$p17/README.md"
set +e
"$WT_BIN" return "$p17" >/dev/null 2>&1
rc=$?
set -e
[ "$rc" -ne 0 ] || fail "return WIPED a dirty worktree without --force-dirty"
[ -f "$p17/KEEPME.txt" ] || fail "return WIPED a dirty worktree without --force-dirty"
grep -q "tracked edit" "$p17/README.md" || fail "return WIPED a dirty worktree without --force-dirty"

# 18. return --force-dirty is the explicit opt-in that does clean it.
"$WT_BIN" return "$p17" --force-dirty >/dev/null 2>&1 || fail "return --force-dirty failed on a dirty tree"
[ ! -f "$p17/KEEPME.txt" ] || fail "return --force-dirty did not clean the worktree"

# 19. return still succeeds on a clean worktree (the common path).
p19=$("$WT_BIN" get --repo "$TEST_REPO" --holder ret19 2>/dev/null)
"$WT_BIN" return "$p19" >/dev/null 2>&1 || fail "return failed on a CLEAN worktree"

# 20. lock_pool breaks a lock whose recorded holder is gone, instead of spinning forever.
#     999999 is not a live pid; pre-fix this call never returned.
mkdir -p "$pool_dir/.lock.d"
echo 999999 > "$pool_dir/.lock.d/pid"
lock_err=$(mktemp)
set +e
"$WT_BIN" status --repo "$TEST_REPO" >/dev/null 2>"$lock_err"
rc=$?
set -e
[ "$rc" -eq 0 ] || fail "wt hung or failed on a stale pool lock (exit $rc)"
grep -q "breaking stale pool lock" "$lock_err" || fail "wt did not report breaking the stale lock"
rm -f "$lock_err"
```

Test 20's lock path is correct as written and needs no lookup: `tooling/cli/wt/wt:86` is the
literal `LOCK_DIR="$POOL/.lock.d"`, and the harness's `$pool_dir` is that same `$POOL`.

Test 20 needs a bounded runtime so a regression fails instead of hanging (LESSONS 2026-07-31: a
hanging test is an *invisible* failure). Wrap it if a `timeout`-compatible binary is present:
prefix the `"$WT_BIN" status` call with `timeout 60` (or `gtimeout 60`) if either is on `PATH`.

**Verify**: `bash tooling/cli/wt/test-wt.sh` -> `ALL TESTS PASSED`
**Verify**: `grep -c '^# 1[789]\.\|^# 20\.' tooling/cli/wt/test-wt.sh` -> `4`

Commit: `test(wt): pin the dirty-refusal and stale-lock-break contracts`

### Step 5: Stop a refused return from breaking greenlight's exit code

This step is **not optional**. `greenlight` runs `set -euo pipefail` and its `EXIT` trap calls
`wt return` unguarded, so after Step 3 a land that leaves any dirt would make greenlight exit
non-zero even when the land succeeded — and boss reads greenlight's exit code.

In `tooling/cli/greenlight/greenlight`, replace the `cleanup` function with **exactly** this:

```bash
function cleanup() {
  log "Releasing worktree..."
  # `wt return` refuses a dirty worktree (plan 222) so a killed run's uncommitted work
  # survives. This trap must not turn that refusal into a non-zero exit for an otherwise
  # successful land — boss reads this script's exit code.
  "$WT_BIN" return "$WT_PATH" || log "WARN: worktree NOT returned (dirty?) — slot stays leased: $WT_PATH"
}
```

**Verify**: `bash -n tooling/cli/greenlight/greenlight` -> no output, exit 0
**Verify**: `grep -c 'slot stays leased' tooling/cli/greenlight/greenlight` -> `1`

Commit: `fix(greenlight): a refused worktree return must not fail the run`

### Step 6: Document the new contract

In `tooling/cli/wt/README.md`, under the existing **"Leases leak, and that is what `reap` /
`release` exist for"** section, extend the existing paragraph that begins **"A dirty worktree is
never freed silently"** so it covers all four commands, and update the `wt return` bullet in the
Commands list to show `[--force-dirty]`. Add one sentence recording that `lock_pool` now breaks a
dead holder's lock and fails loudly after `LOCK_WAIT_SECS`.

Keep it to the existing prose style — this file is read by humans orienting on the tool.

**Verify**: `grep -c 'force-dirty' tooling/cli/wt/README.md` -> at least `3`

Commit: `docs(wt): record the dirty-refusal and lock-break contracts`

## Test plan

All verification runs through the existing harness, `tooling/cli/wt/test-wt.sh`, which builds a
throwaway repo in `mktemp -d` and never touches the real pool.

- Tests 1-4 and 6-16: unchanged, and must still pass. They are the regression net for allocation,
  leasing, `prune`, `reap`, `release` and pool-full reclaim.
- Test 5 / 5b (rewritten): `get` skips a dirty unleased slot and the work survives;
  `--force-dirty` reclaims it.
- Tests 17-19 (new): `return` refuses a dirty tree and the work survives; `--force-dirty`
  cleans it; a clean return still works.
- Test 20 (new): a lock whose recorded pid is dead gets broken rather than spun on.

Every new assertion is about **observable state** — a file still present, a non-zero exit, a
broken lock — never about a string appearing in `wt`'s source. A source-text assertion would be
circular and its mutation meaningless (LESSONS 2026-08-02).

## Done criteria

- [ ] `bash tooling/cli/wt/test-wt.sh` prints `ALL TESTS PASSED` and exits 0.
- [ ] `bash -n tooling/cli/wt/wt` and `bash -n tooling/cli/greenlight/greenlight` both exit 0.
- [ ] `grep -c '^# 1[789]\.\|^# 20\.' tooling/cli/wt/test-wt.sh` returns `4` — the new tests
      exist as files, not as intentions (LESSONS 2026-08-17: a specified-but-absent test file
      leaves the gate green with zero coverage).
- [ ] `grep -c 'unleased but DIRTY — skipped' tooling/cli/wt/wt` returns `1`.
- [ ] `grep -c 'ERROR: worktree is DIRTY — NOT returned' tooling/cli/wt/wt` returns `1`.
- [ ] `grep -c 'slot stays leased' tooling/cli/greenlight/greenlight` returns `1`.
- [ ] `grep -c 'force-dirty' tooling/cli/wt/README.md` returns 3 or more.
- [ ] The mutation recipe in the frontmatter behaves as specified: clean run passes; applying it
      makes `bash tooling/cli/wt/test-wt.sh` fail printing
      `FAIL: return WIPED a dirty worktree without --force-dirty`; reverting it passes again.
- [ ] `wt status --repo /Users/kbtg/codebase/personal-stuff` still shows 8 slots, and no slot
      that was `free` before this plan is now leased.
- [ ] `git diff --stat` against the branch point touches **only** the four files in `touches`.

## STOP conditions

- **Any existing test 1-16 fails and the fix would be to change that test.** Those tests encode
  paid-for lessons. Fix your code, or STOP and report. Weakening, renumbering, swapping or
  deleting an assertion is a STOP, not a workaround.
- **The baseline suite does not pass before you start.** STOP and report — you cannot distinguish
  your breakage from pre-existing breakage.
- **`bash tooling/cli/wt/test-wt.sh` hangs** (no output, no exit). That is the `lock_pool`
  defect reproducing inside the harness. STOP and report rather than adding a `sleep` or removing
  the test — a hanging test is an invisible failure.
- **You find yourself needing to edit a file outside the four in `touches`.** STOP and report
  which file and why. In particular do not "fix" `tooling/boss/bin/*.sh` to accommodate the new
  refusal; boss surfacing a visible error is the intended behaviour and is a separate plan.
- **`tooling/cli/wt/wt:86` is not the literal `LOCK_DIR="$POOL/.lock.d"`** when you read it (i.e.
  the drift check found a change there). STOP and report rather than guessing test 20's path.
- **A test needs `--force-dirty` on the real pool.** Never run `--force-dirty` against
  `/Users/kbtg/kb-scratch/worktrees/` — the harness uses a `mktemp -d` repo, and that is the only
  place these tests may touch.

## Maintenance notes

- Four commands now share one invariant: `get`, `return`, `reap`, `release` all refuse a dirty
  worktree unless `--force-dirty`. A fifth command that resets a worktree must join them. The
  shared helper is `wt_is_clean`.
- `unlock_pool` is now owner-checked. Any future code path that calls `lock_pool` in a subshell
  will see `$$` differ from the recorded pid and will decline to unlock — that is deliberate, but
  it means locking must stay in the main shell.
- `LOCK_WAIT_SECS=30` is a deliberate compromise: long enough to outlast a normal `git worktree
  add` on a 1.1 GB tree, short enough that a wedge is reported in one shell prompt. If a
  legitimate operation ever exceeds it, raise the constant — do not remove the bound.
- The `WARNING: worktree has unpushed commits` path is intentionally still only a warning.
  A reviewer should scrutinise any change that promotes it to a refusal: greenlight legitimately
  returns worktrees whose branch is ahead of upstream, and refusing there would wedge landing.
- Later plans in this series (the workspace root, the landing tree) deliberately live **outside**
  `wt`'s pool so that `return`'s `$POOL/*/$REPO_BASENAME` guard can never match them. If a future
  change widens that guard, re-check that it still cannot reach
  `$HOME/kb-scratch/workspaces/` or `$HOME/kb-scratch/landing/`.
