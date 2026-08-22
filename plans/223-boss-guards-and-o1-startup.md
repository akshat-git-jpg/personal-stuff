<!-- boss frontmatter -->
---
executor: agy
model:
test_cmd: bash tooling/boss/test-boss.sh
ui:
deploy:
needs: []
needs_prs: []
touches: [tooling/boss/test-boss.sh, tooling/boss/bin/boss-lib.sh, tooling/boss/bin/boss-merge.sh, tooling/boss/bin/boss-session-start.sh, tooling/boss/CLAUDE.md]

mutation_apply: |
  python3 - <<'PY'
  p='tooling/boss/bin/boss-lib.sh'
  s=open(p).read()
  needle='boss: refusing to release a chrome lock owned by'
  assert needle in s, 'mutation target not found — the fix is missing or was reworded'
  # Reintroduce the real defect: release deletes the lock without checking who owns it.
  i=s.index('boss_chrome_lock_release()')
  j=s.index('\n', s.index('}', i))
  s=s[:i] + 'boss_chrome_lock_release() { rm -rf "$BOSS_LOCK_DIR/chrome.lock" 2>/dev/null || true; }' + s[j:]
  open(p,'w').write(s)
  PY
mutation_command: bash tooling/boss/test-boss.sh
mutation_expect: "FAIL: chrome lock release DELETED a lock owned by another process"
mutation_cwd:
mutation_timeout: 600
---

# Plan 223: boss guards — an owner-checked chrome lock, an overridable state dir, and an O(1) startup

## Summary

- **Problem statement**: Three defects in boss, all verified. (a) `boss_chrome_lock_acquire`
  gives up after `BOSS_CHROME_WAIT_MIN` and **returns 0 without holding the lock**, while
  `boss_chrome_lock_release` is a blind `rm -rf` that never checks the owner — so a caller that
  timed out proceeds unlocked and then **deletes the real holder's lock** on its way out.
  (b) `STATE_DIR` is hardcoded, so every `state/*.meta` consumer sees every meta, with no way to
  namespace a different kind of task. (c) `boss-session-start.sh`'s in-flight loop runs
  `gh pr view` for **every** `.meta` on **every** startup — 171 network calls today — because its
  only skip test is a live GitHub lookup and nothing records a terminal verdict locally.
  Separately, `tooling/boss/test-boss.sh` has been failing at test 3 for some time, so boss has
  had **no usable merge gate**; the cause is a gap in the test's own `gh` stub.
- **Goals**:
  - Fix the `gh` stub so `bash tooling/boss/test-boss.sh` passes and can serve as a gate.
  - `boss_chrome_lock_release` refuses to remove a lock it does not own;
    `boss_chrome_lock_acquire` returns non-zero when it times out; callers arm the release only
    when they actually hold the lock.
  - `STATE_DIR="${BOSS_STATE_DIR:-$BOSS_HOME/state}"` — byte-identical when unset.
  - The in-flight loop skips on a **local** terminal marker with no `gh` call, and back-fills that
    marker whenever it does learn a PR is terminal, so startup self-heals toward O(1).
- **Executor proposed**: `agy` / agy default (Gemini 3.1 Pro High). Graded **standard**: four
  edits, each inlined verbatim here, with no interleaving reasoning required — the lock fix is an
  ownership comparison, not a new locking protocol. No boss script uses `set -e` (verified), so
  the new non-zero return cannot abort a caller as a side effect.
- **Done criteria** (terse — full list below): `bash tooling/boss/test-boss.sh` passes; three new
  tests exist; the mutation recipe fails with the expected marker; `STATE_DIR` honours
  `BOSS_STATE_DIR`.
- **Stop conditions** (terse — full list below): `test-boss.sh` still fails after Step 1 for any
  reason other than the stub gap; a fix would change what `boss_chrome_lock_acquire` does on the
  **success** path; `state/` is pruned or a meta is deleted.
- **Test / verification for success**: the repo's own `tooling/boss/test-boss.sh` harness, made
  green in Step 1 and then extended with three tests that assert observable behaviour — a lock
  surviving a foreign release, a non-zero timeout return, and a `gh`-free skip.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If anything in the "STOP conditions" section
> occurs, stop and report. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 69042eb1..HEAD -- tooling/boss/`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — `boss-lib.sh` is sourced by every boss entry point.
- **Depends on**: none. Standalone and useful on its own.
- **Category**: bug
- **Difficulty**: standard
- **Planned at**: commit `69042eb1`, 2026-08-23

## Why this matters

The chrome lock exists because PR#134 lost a merge cycle to `Chrome dump-dom timeout` with 44
live Chrome processes. As written it cannot deliver that protection under contention: the one
situation it was built for — someone else already holding it — is the situation where it gives up,
lies to its caller by returning 0, and then destroys the holder's lock. A later plan in this
series adds a second long-lived holder class (a land fix-up, which can run to `agy`'s 180-minute
default against a 45-minute wait), so the defect goes from occasional to routine.

`STATE_DIR` being hardcoded is what forces every kind of boss task into one namespace. A later
plan needs a second namespace, and the alternative — patching each `state/*.meta` glob site one
at a time — is how a second site gets missed. One overridable default fixes every present and
future site at once.

The startup scan is the surface a later plan relies on for visibility, so an unbounded 171-call
`gh` loop stops being merely slow and becomes load-bearing.

And a red test suite means none of this is verifiable. Step 1 fixes that first, deliberately.

## Current state

### `tooling/boss/test-boss.sh` — why it is red

Test 3 (verbatim):

```bash
echo "--- (3) non-boss branch refused ---"
export GH_STUB_BRANCH="feature/not-boss"
set +e
err=$("$BOSSDIR/bin/boss-dispatch.sh" 99 2>&1)
rc=$?
set -e
[ "$rc" -ne 0 ] || fail "(3) dispatch should refuse a non-boss/* branch"
echo "$err" | grep -qi "not boss" || fail "(3) error should mention 'not boss': $err"
```

Observed failure:

```
FAIL: (3) error should mention 'not boss': FATAL: gh active account is 'none',
      need akshat-git-jpg (run: gh auth switch --user akshat-git-jpg)
```

The cause is a **stub gap, not a real bug**. `boss-dispatch.sh` calls `boss_assert_gh` before it
checks the branch, and `boss_assert_gh` is:

```bash
boss_assert_gh() {
  local u; u=$(gh api user -q .login 2>/dev/null)
  [ "$u" = "$BOSS_GH_USER" ] && return 0
  gh auth switch --hostname github.com --user "$BOSS_GH_USER" >/dev/null 2>&1
  u=$(gh api user -q .login 2>/dev/null)
  [ "$u" = "$BOSS_GH_USER" ] || { echo "FATAL: gh active account is '${u:-none}', need $BOSS_GH_USER …" >&2; return 1; }
```

`BOSS_GH_USER` defaults to `akshat-git-jpg`. The harness puts a stub `gh` on `PATH`
(`export PATH="$STUB_DIR:$PATH"`), and that stub dispatches on a `"$1:$2"` pattern with cases for
`pr:view`, `pr:edit`, `pr:list`, `pr:comment`, `label:create` and a final `*) exit 0`. There is
**no `api:` case** (verified: no `api:` string in the file), so `gh api user -q .login` falls to
`*) exit 0`, prints nothing, `u` is empty, and `boss_assert_gh` reports `'none'` and returns 1 —
before test 3's branch check is ever reached.

So every test after `boss_assert_gh` is unverified today.

### Site A — the chrome lock (`tooling/boss/bin/boss-lib.sh`, the `boss_chrome_lock_*` pair)

Verbatim:

```bash
boss_chrome_lock_acquire() {
  local who="$1" lock="$BOSS_LOCK_DIR/chrome.lock" waited=0 owner
  mkdir -p "$BOSS_LOCK_DIR"
  while ! mkdir "$lock" 2>/dev/null; do
    owner=$(cat "$lock/owner" 2>/dev/null || echo unknown)
    # Stale-lock reaper: if the recorded pid is gone, the holder died mid-run.
    if [ -f "$lock/pid" ] && ! kill -0 "$(cat "$lock/pid" 2>/dev/null)" 2>/dev/null; then
      echo "boss: reaping stale chrome lock (owner=$owner)" >&2; rm -rf "$lock"; continue
    fi
    [ "$waited" -ge $((BOSS_CHROME_WAIT_MIN * 60)) ] && {
      echo "boss: chrome lock held by $owner for >${BOSS_CHROME_WAIT_MIN}m — proceeding anyway" >&2
      return 0; }
    [ "$waited" = 0 ] && echo "boss: waiting for chrome lock (held by $owner)…" >&2
    sleep 15; waited=$((waited + 15))
  done
  echo "$who" > "$lock/owner"; echo $$ > "$lock/pid"
}
boss_chrome_lock_release() { rm -rf "$BOSS_LOCK_DIR/chrome.lock" 2>/dev/null || true; }
```

Two defects: the timeout path `return 0` without the lock, and a release that never reads
`$lock/owner` or `$lock/pid`.

### Site B — the only caller, in `tooling/boss/bin/boss-merge.sh`

Verbatim (lines 112-115):

```bash
boss_chrome_lock_acquire "merge-$pr"
trap 'boss_chrome_lock_release' EXIT
"$REPO_ROOT/tooling/cli/greenlight/greenlight" run --branch "$branch" --verify "$verify" || true
boss_chrome_lock_release; trap - EXIT
```

The trap is armed unconditionally, so a timed-out acquire still leads to a release. **No boss
script sets `-e`** (verified across `boss-merge.sh`, `boss-dispatch.sh`,
`boss-session-start.sh`, `boss-commit-main.sh`), so returning non-zero from acquire cannot abort
a caller by itself — the caller must test it.

### Site C — `tooling/boss/bin/boss-lib.sh:7`

```bash
STATE_DIR="$BOSS_HOME/state"; mkdir -p "$STATE_DIR"
```

`BOSS_HOME` is derived from `BASH_SOURCE` two lines above and is deliberately not overridable;
`STATE_DIR` has no default at all.

The meta helpers (lines 9-10) are:

```bash
meta_get()    { local f="$STATE_DIR/$1.meta"; [ -f "$f" ] || return 1; grep "^$2=" "$f" | tail -1 | cut -d= -f2-; }
meta_set()    { echo "$2=$3" >> "$STATE_DIR/$1.meta"; }
```

`meta_set` appends and `meta_get` takes `tail -1`, so **appending a field again overrides it** —
no rewrite logic is needed for the marker in Step 4.

### Site D — the in-flight loop (`tooling/boss/bin/boss-session-start.sh`)

Verbatim:

```bash
for m in "$STATE_DIR"/*.meta; do
  [ -e "$m" ] || continue; n=$(basename "$m" .meta)
  st=$(gh pr view "$n" --json state,labels -q '"\(.state) \(.labels[].name)"' 2>/dev/null)
  case "$st" in *boss:done*|CLOSED*|MERGED*) continue;; esac
  "$BOSS_HOME/bin/boss-state.sh" "$n"
done
```

`ls tooling/boss/state/*.meta | wc -l` is **171**. So this is 171 `gh pr view` calls per startup,
almost all for PRs that reached a terminal state weeks or months ago. Note also that an **empty**
`$st` (a `gh` failure, or an id that is not a PR number) matches no branch and falls through to
`boss-state.sh` — so a lookup failure is reported as in-flight.

### Site E — where a terminal verdict is known (`tooling/boss/bin/boss-merge.sh:158`)

```bash
gh pr edit "$pr" --remove-label boss:in-progress --add-label boss:done 2>/dev/null || true
```

This is the moment boss itself decides a PR is done. It is where the marker must be written.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Baseline (expected to FAIL at test 3 before Step 1) | `bash tooling/boss/test-boss.sh` | fails at `(3) non-boss branch refused` |
| The merge gate, after Step 1 | `bash tooling/boss/test-boss.sh` | all tests pass, exit 0 |
| Syntax-check after each edit | `bash -n tooling/boss/bin/boss-lib.sh` | no output, exit 0 |
| Count metas | `ls tooling/boss/state/*.meta \| wc -l` | `171` (informational) |
| Prove `STATE_DIR` is overridable | see Step 3's Verify | prints the override path |

## Scope

**In scope**:
- `tooling/boss/test-boss.sh` — the stub gap (Step 1) and three new tests (Step 5)
- `tooling/boss/bin/boss-lib.sh` — the chrome lock pair, and `STATE_DIR`
- `tooling/boss/bin/boss-merge.sh` — the trap arming, and the terminal marker
- `tooling/boss/bin/boss-session-start.sh` — the in-flight loop
- `tooling/boss/CLAUDE.md` — one short subsection recording the new contracts

**Out of scope** — looks related, do not touch:
- `tooling/cli/wt/` — plan 222 owns it. Do not "also fix" `lock_pool`; it is a different lock with
  a different fix and a different test suite.
- `boss_crews_running` — a later plan changes how land tasks interact with it. Leave it alone.
- **Do not create `state/lands/`** or any second store. Step 3 only makes the override *possible*;
  the consumer arrives in a later plan.
- **Never prune `state/` or delete any `.meta`.** `boss-deploy.sh` and the in-flight loop's own
  comment both rely on a landed PR keeping its meta. The O(1) fix is a marker, not a deletion.
- `GH_TOKEN` and `gh` auth configuration. Note for context only: `gh` currently authenticates as
  `akshat-git-jpg` **via `GH_TOKEN`**, and with that variable unset it falls back to the keyring
  account `kushal-zluri`, which `boss_assert_gh` rejects. A later plan relocates the token; this
  plan must not touch it, and must not "helpfully" change `boss_assert_gh`.

## Git workflow

- Branch: `advisor/223-boss-guards-and-o1-startup`
- Commit per step, message style `fix(boss): <what>` — no AI footers. Do **NOT** push.

## Steps

### Step 1: Make the test suite green by closing the `gh` stub gap

Run `bash tooling/boss/test-boss.sh` first and confirm it fails at `(3) non-boss branch refused`
with the `gh active account is 'none'` message. If it fails somewhere else, or for a different
reason, **STOP and report** — the rest of this plan assumes that exact starting point.

In `tooling/boss/test-boss.sh`, inside the stub `gh` heredoc, add an `api:user` case immediately
**before** the final `*) exit 0` case:

```bash
  api:user)
    # boss_assert_gh runs `gh api user -q .login` before anything else. Without this
    # case the stub fell through to `*) exit 0`, printed nothing, and every test after
    # boss_assert_gh failed with "gh active account is 'none'" — so the whole suite was
    # red and boss had no usable merge gate.
    echo "${BOSS_GH_USER:-akshat-git-jpg}" ;;
```

Note the stub dispatches on `"$1:$2"`, so the case label is `api:user` and it must sit before the
catch-all.

**Verify**: `bash tooling/boss/test-boss.sh` -> every test passes, exit 0. If any test **other
than 3** now fails, STOP and report — it was previously masked, and it is not this plan's to fix.

Commit: `test(boss): stub gh api user so the suite can run past boss_assert_gh`

### Step 2: Make the chrome lock owner-safe

Replace the `boss_chrome_lock_acquire` timeout branch and the whole
`boss_chrome_lock_release` function with **exactly** this.

In `boss_chrome_lock_acquire`, replace the timeout block:

```bash
    [ "$waited" -ge $((BOSS_CHROME_WAIT_MIN * 60)) ] && {
      echo "boss: chrome lock held by $owner for >${BOSS_CHROME_WAIT_MIN}m — proceeding anyway" >&2
      return 0; }
```

with:

```bash
    [ "$waited" -ge $((BOSS_CHROME_WAIT_MIN * 60)) ] && {
      echo "boss: chrome lock held by $owner for >${BOSS_CHROME_WAIT_MIN}m — proceeding WITHOUT it" >&2
      # Return non-zero so the caller knows it never held the lock and must not
      # release it on exit. Returning 0 here made a timed-out caller delete the real
      # holder's lock, which is the one situation the lock exists for.
      return 1; }
```

Then replace `boss_chrome_lock_release` entirely with:

```bash
# Only remove a lock this process owns. A blind rm -rf let a caller that timed out
# (and therefore never held it) delete the real holder's lock on its way out.
boss_chrome_lock_release() {
  local lock="$BOSS_LOCK_DIR/chrome.lock" owner_pid
  owner_pid=$(cat "$lock/pid" 2>/dev/null || echo "")
  if [ -n "$owner_pid" ] && [ "$owner_pid" != "$$" ]; then
    echo "boss: refusing to release a chrome lock owned by pid $owner_pid (we are $$)" >&2
    return 0
  fi
  rm -rf "$lock" 2>/dev/null || true
}
```

Leave the success path and the existing stale-pid reaper **unchanged**.

**Verify**: `bash -n tooling/boss/bin/boss-lib.sh` -> no output, exit 0
**Verify**: `bash tooling/boss/test-boss.sh` -> all pass, exit 0

Commit: `fix(boss): chrome lock release checks ownership; timeout returns non-zero`

### Step 3: Make `STATE_DIR` overridable

In `tooling/boss/bin/boss-lib.sh`, replace line 7:

```bash
STATE_DIR="$BOSS_HOME/state"; mkdir -p "$STATE_DIR"
```

with:

```bash
# Overridable so a different KIND of boss task can get its own namespace. Every
# `state/*.meta` glob (boss_crews_running, the session-start in-flight loop, and any
# future one) then simply never sees it — patching those call sites one at a time is
# how a second site gets missed. Byte-identical behaviour when BOSS_STATE_DIR is unset.
STATE_DIR="${BOSS_STATE_DIR:-$BOSS_HOME/state}"; mkdir -p "$STATE_DIR"
```

Do **not** create any second store, and do not set `BOSS_STATE_DIR` anywhere. This step only
makes the override possible.

**Verify**: `bash -n tooling/boss/bin/boss-lib.sh` -> no output, exit 0
**Verify**: the override is honoured —
`BOSS_STATE_DIR=/tmp/bossstate-probe bash -c 'source tooling/boss/bin/boss-lib.sh >/dev/null 2>&1; echo "$STATE_DIR"'`
-> prints `/tmp/bossstate-probe`
**Verify**: the default is unchanged —
`bash -c 'source tooling/boss/bin/boss-lib.sh >/dev/null 2>&1; echo "$STATE_DIR"'`
-> prints a path ending in `tooling/boss/state`

Commit: `fix(boss): STATE_DIR honours BOSS_STATE_DIR`

### Step 4: Record a terminal marker, and make the startup scan use it

**4a — write the marker.** In `tooling/boss/bin/boss-merge.sh`, immediately **after** line 158
(`gh pr edit "$pr" --remove-label boss:in-progress --add-label boss:done …`), add:

```bash
# Record the terminal verdict LOCALLY. The session-start in-flight loop can then skip
# this PR with no `gh` call at all; before this it ran `gh pr view` for every one of
# 171 metas on every startup, because a live lookup was its only skip test.
meta_set "$pr" terminal done
```

`meta_set` appends and `meta_get` reads `tail -1`, so re-writing the field is safe and needs no
rewrite logic.

**4b — use it, and back-fill.** In `tooling/boss/bin/boss-session-start.sh`, replace the
in-flight loop with **exactly** this:

```bash
for m in "$STATE_DIR"/*.meta; do
  [ -e "$m" ] || continue; n=$(basename "$m" .meta)
  # Local terminal marker: skip with no network call. This is what makes startup O(1)
  # in the number of long-finished PRs.
  [ -n "$(meta_get "$n" terminal 2>/dev/null)" ] && continue
  st=$(gh pr view "$n" --json state,labels -q '"\(.state) \(.labels[].name)"' 2>/dev/null)
  case "$st" in
    *boss:done*|CLOSED*|MERGED*)
      # Back-fill the marker we just learned, so this meta costs nothing next time.
      # No pruning: boss-deploy.sh still needs a landed PR's meta.
      meta_set "$n" terminal done
      continue ;;
  esac
  "$BOSS_HOME/bin/boss-state.sh" "$n"
done
```

Back-filling means no one-time migration step is needed — the scan converges to O(1) over the
next couple of startups on its own.

Do **not** add a branch for an empty `$st`. An empty result still falls through and is reported,
which is the existing behaviour and is correct: a meta whose PR cannot be read is genuinely
unknown, not terminal.

**Verify**: `bash -n tooling/boss/bin/boss-merge.sh` and
`bash -n tooling/boss/bin/boss-session-start.sh` -> no output, exit 0
**Verify**: `bash tooling/boss/test-boss.sh` -> all pass, exit 0
**Verify**: no meta was deleted — `ls tooling/boss/state/*.meta | wc -l` -> still `171`

Commit: `perf(boss): skip terminal PRs at startup with a local marker`

### Step 5: Add three tests that prove each guard fires

Append to `tooling/boss/test-boss.sh`, before its final pass line, exactly these. Match the
file's existing `fail`/`echo PASS` idiom.

```bash
# -----------------------------------------------------------------------
# (2026-08-23) The three guards from plan 223. Each asserts OBSERVABLE
# behaviour — a lock surviving, a non-zero return, a scan making no network
# call — never that a string appears in a source file.
# -----------------------------------------------------------------------

echo "--- (G1) chrome lock release refuses a foreign lock ---"
LOCKTMP=$(mktemp -d)
(
  export BOSS_LOCK_DIR="$LOCKTMP"
  source "$BOSSDIR/bin/boss-lib.sh" >/dev/null 2>&1
  mkdir -p "$BOSS_LOCK_DIR/chrome.lock"
  echo "someone-else" > "$BOSS_LOCK_DIR/chrome.lock/owner"
  echo 999999        > "$BOSS_LOCK_DIR/chrome.lock/pid"
  boss_chrome_lock_release >/dev/null 2>&1
  [ -d "$BOSS_LOCK_DIR/chrome.lock" ] || exit 3
) || fail "chrome lock release DELETED a lock owned by another process"
echo "PASS: chrome lock release refuses a foreign lock"

echo "--- (G2) chrome lock acquire returns non-zero when it times out ---"
(
  export BOSS_LOCK_DIR="$LOCKTMP" BOSS_CHROME_WAIT_MIN=0
  source "$BOSSDIR/bin/boss-lib.sh" >/dev/null 2>&1
  mkdir -p "$BOSS_LOCK_DIR/chrome.lock"
  echo "holder"  > "$BOSS_LOCK_DIR/chrome.lock/owner"
  echo "$$"      > "$BOSS_LOCK_DIR/chrome.lock/pid"   # a LIVE pid, so the reaper skips it
  boss_chrome_lock_acquire "probe" >/dev/null 2>&1
  [ $? -ne 0 ] || exit 3
) || fail "chrome lock acquire returned 0 without holding the lock"
echo "PASS: chrome lock acquire reports a timeout"
rm -rf "$LOCKTMP"

echo "--- (G3) STATE_DIR honours BOSS_STATE_DIR ---"
sd=$(BOSS_STATE_DIR="$LOCKTMP-state" bash -c 'source '"$BOSSDIR"'/bin/boss-lib.sh >/dev/null 2>&1; echo "$STATE_DIR"')
[ "$sd" = "$LOCKTMP-state" ] || fail "STATE_DIR ignored BOSS_STATE_DIR (got '$sd')"
sd=$(bash -c 'source '"$BOSSDIR"'/bin/boss-lib.sh >/dev/null 2>&1; echo "$STATE_DIR"')
case "$sd" in */tooling/boss/state) : ;; *) fail "STATE_DIR default changed (got '$sd')";; esac
echo "PASS: STATE_DIR override works and the default is unchanged"
rm -rf "$LOCKTMP-state"
```

G2 uses `$$` as the recorded pid deliberately: it must be a **live** process so the existing
stale-pid reaper does not free the lock before the timeout path is reached. With
`BOSS_CHROME_WAIT_MIN=0` the wait is immediate, so this test cannot hang.

Both variables these tests rely on are already correct and need no lookup:
`tooling/boss/test-boss.sh:11` defines `BOSSDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"`,
and `tooling/boss/bin/boss-lib.sh:144` is `BOSS_LOCK_DIR="${BOSS_LOCK_DIR:-$STATE_DIR/locks}"` —
already env-overridable, which is what lets G1 and G2 point it at a temp dir.

**Verify**: `bash tooling/boss/test-boss.sh` -> all pass including G1, G2, G3, exit 0
**Verify**: `grep -c '(G1)\|(G2)\|(G3)' tooling/boss/test-boss.sh` -> `3`

Commit: `test(boss): pin the lock-ownership, timeout and STATE_DIR contracts`

### Step 6: Record the contracts

Add one short subsection to `tooling/boss/CLAUDE.md` covering: the chrome lock now reports a
timeout and refuses a foreign release; `BOSS_STATE_DIR` exists for namespacing a different kind
of task; startup skips terminal PRs on a local marker and back-fills it, and `state/` is **never**
pruned. Keep it to the file's existing terse style.

**Verify**: `grep -c 'BOSS_STATE_DIR' tooling/boss/CLAUDE.md` -> at least `1`

Commit: `docs(boss): record the lock, state-dir and startup contracts`

## Test plan

`bash tooling/boss/test-boss.sh` is the gate, and Step 1 is what makes it usable — it has been
red at test 3, so every assertion after `boss_assert_gh` has been unverified.

- Existing tests: must all pass after Step 1. **If a test other than 3 fails after Step 1, that
  is a pre-existing masked failure — STOP and report it, do not fix it here.**
- G1: a lock owned by another pid survives a release call.
- G2: acquire returns non-zero when it cannot get the lock.
- G3: `STATE_DIR` honours the override and its default is unchanged.

The O(1) startup change is verified structurally (`171` metas still present, both scripts parse)
rather than by a live run, because a live run would make real `gh` calls. Its behaviour is
covered by the back-fill being idempotent: `meta_set` appends and `meta_get` takes `tail -1`.

## Done criteria

- [ ] `bash tooling/boss/test-boss.sh` exits 0 with every test passing.
- [ ] `grep -c '(G1)\|(G2)\|(G3)' tooling/boss/test-boss.sh` returns `3` — the tests exist as
      code, not as intentions (LESSONS 2026-08-17).
- [ ] `bash -n` passes on `boss-lib.sh`, `boss-merge.sh`, `boss-session-start.sh`,
      `test-boss.sh`.
- [ ] `grep -c 'refusing to release a chrome lock owned by' tooling/boss/bin/boss-lib.sh` -> `1`
- [ ] `grep -c 'proceeding WITHOUT it' tooling/boss/bin/boss-lib.sh` -> `1`
- [ ] `grep -c 'BOSS_STATE_DIR' tooling/boss/bin/boss-lib.sh` -> `1`
- [ ] `grep -c 'meta_set "$pr" terminal done' tooling/boss/bin/boss-merge.sh` -> `1`
- [ ] `grep -c 'terminal' tooling/boss/bin/boss-session-start.sh` -> at least `2`
- [ ] `ls tooling/boss/state/*.meta | wc -l` still returns `171` — nothing was pruned.
- [ ] `ls -d tooling/boss/state/lands` fails — no second store was created by this plan.
- [ ] The mutation recipe behaves as specified: clean passes; applying it makes
      `bash tooling/boss/test-boss.sh` fail printing
      `FAIL: chrome lock release DELETED a lock owned by another process`; reverting passes again.
- [ ] `git diff --stat` against the branch point touches only the five files in `touches`.

## STOP conditions

- **`test-boss.sh` fails at anything other than test 3 before Step 1**, or still fails after
  Step 1. Report the exact failing test. Do not weaken, skip, or delete a test to get green —
  if a gate assertion fails, fix the code or the fixture; changing the assertion is a STOP.
- **A test other than 3 fails only after Step 1.** That is a real failure the stub gap was
  hiding. Report it; it is not in this plan's scope.
- **You are tempted to change `boss_assert_gh`, `GH_TOKEN`, or any `gh` auth setting.** STOP.
  `gh` authenticates as `akshat-git-jpg` only because `GH_TOKEN` is set; without it, `gh` falls
  back to the `kushal-zluri` work account and boss refuses to run. A later plan handles this.
- **You are tempted to prune `state/` or delete a `.meta`.** STOP — `boss-deploy.sh` needs a
  landed PR's meta. The marker is the fix.
- **A fix would change `boss_chrome_lock_acquire`'s success path or its stale-pid reaper.** STOP
  and report; only the timeout branch changes.
- **`boss_crews_running` needs editing to make something pass.** STOP — a later plan owns it.

## Maintenance notes

- Two locks in this repo now follow the same rule: only the owner releases, and a timeout is
  reported rather than hidden. `wt`'s pool lock (plan 222) is the other. A third lock should
  copy the pattern, not invent one.
- `BOSS_STATE_DIR` has exactly one intended consumer, arriving in a later plan (a land-fix-up
  namespace). If anything else starts setting it, re-check every `state/*.meta` glob —
  `boss_crews_running` and the session-start in-flight loop are the two that exist today.
- The `terminal` marker is written in two places (at merge time, and back-filled at startup).
  If a third code path ever decides a PR is terminal, it should write the marker too, or startup
  quietly regains a `gh` call per meta.
- A reviewer should scrutinise: that `boss_chrome_lock_release`'s early `return 0` (rather than a
  non-zero) is deliberate — callers treat release as best-effort cleanup, and a non-zero there
  would surface as noise on every legitimate no-op.
