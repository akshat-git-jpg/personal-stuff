#!/bin/bash
# Self-test for the boss toolkit. Stubs gh/wt/greenlight/notify/claude/agy on PATH.
# The real binaries are NEVER launched here.
set -uo pipefail

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

BOSSDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

STUB_DIR="$TMP/stub"
mkdir -p "$STUB_DIR"

# --- stub: gh -----------------------------------------------------------
cat > "$STUB_DIR/gh" <<'GHEOF'
#!/bin/bash
# Minimal gh stub: intercepts pr view, pr edit, pr list, label create.
case "$1:$2" in
  pr:view)
    shift 2
    pr_num="$1"; shift
    # Parse --json <fields> -q <expr>
    json=""; query=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --json) json="$2"; shift 2 ;; -q) query="$2"; shift 2 ;; *) shift ;;
      esac
    done
    case "$json" in
      headRefName)
        # Return a branch name based on an env var, or default non-boss branch
        echo "${GH_STUB_BRANCH:-not-a-boss-branch}" ;;
      title) echo "stub title" ;;
      *) echo "{}" ;;
    esac ;;
  pr:edit) exit 0 ;;
  pr:list) echo "[]" ;;
  pr:comment) exit 0 ;;
  label:create) exit 0 ;;
  api:user)
    # boss_assert_gh runs `gh api user -q .login` before anything else. Without this
    # case the stub fell through to `*) exit 0`, printed nothing, and every test after
    # boss_assert_gh failed with "gh active account is 'none'" — so the whole suite was
    # red and boss had no usable merge gate.
    echo "${BOSS_GH_USER:-akshat-git-jpg}" ;;
  *) exit 0 ;;
esac
GHEOF
chmod +x "$STUB_DIR/gh"

# --- stub: wt -----------------------------------------------------------
cat > "$STUB_DIR/wt" <<'WTEOF'
#!/bin/bash
if [ "$1" = "get" ]; then
  d="$BOSS_TEST_TMP/wt-work"
  mkdir -p "$d"
  git init -q "$d" 2>/dev/null || true
  git -C "$d" commit -q --allow-empty -m init 2>/dev/null || true
  echo "$d"
elif [ "$1" = "return" ]; then
  echo "returned:$2" >> "$BOSS_TEST_TMP/wt-return.log"
fi
WTEOF
chmod +x "$STUB_DIR/wt"

# --- stub: greenlight ---------------------------------------------------
cat > "$STUB_DIR/greenlight" <<'GLEOF'
#!/bin/bash
echo "stub greenlight: $*" >> "$BOSS_TEST_TMP/greenlight.log"
# Check that --branch and --verify are passed
echo "$*" | grep -q -- '--branch' || { echo "ERROR: greenlight missing --branch" >&2; exit 1; }
echo "$*" | grep -q -- '--verify' || { echo "ERROR: greenlight missing --verify" >&2; exit 1; }
exit 0
GLEOF
chmod +x "$STUB_DIR/greenlight"

# --- stub: notify -------------------------------------------------------
mkdir -p "$STUB_DIR/tooling-cli-notify"
cat > "$STUB_DIR/notify" <<'NTEOF'
#!/bin/bash
echo "stub notify: $*" >> "$BOSS_TEST_TMP/notify.log"
NTEOF
chmod +x "$STUB_DIR/notify"

# --- stub: claude -------------------------------------------------------
cat > "$STUB_DIR/claude" <<'CLEOF'
#!/bin/bash
echo '{"result": "stubbed claude output"}'
CLEOF
chmod +x "$STUB_DIR/claude"

# --- stub: agy ----------------------------------------------------------
cat > "$STUB_DIR/agy" <<'AGYEOF'
#!/bin/bash
echo '{"status":"SUCCESS"}'
AGYEOF
chmod +x "$STUB_DIR/agy"

# --- stub: git (limited — only intercepts specific subcommands) ----------
# We need a pass-through git that handles our test scenarios.
# For this test, we use real git where possible + env flags for special cases.

export PATH="$STUB_DIR:$PATH"
export BOSS_TEST_TMP="$TMP"
export BOSS_CLAUDE_CMD="$STUB_DIR/claude"

# Also make the notify stub reachable where boss-lib expects it.
BOSS_HOME="$BOSSDIR"
REPO_ROOT="$(cd "$BOSSDIR/../.." && pwd)"

# -----------------------------------------------------------------------
# (1) bash -n on all tooling/boss/**/*.sh
# -----------------------------------------------------------------------
echo "--- (1) bash -n checks ---"
while IFS= read -r f; do
  bash -n "$f" || fail "(1) bash -n failed on $f"
done < <(find "$BOSSDIR" -name '*.sh' -type f)
echo "PASS: all scripts pass bash -n"

# -----------------------------------------------------------------------
# (2) fm_get extracts executor/model/test_cmd from a fixture plan
# -----------------------------------------------------------------------
echo "--- (2) fm_get ---"
fixture="$TMP/fixture.md"
cat > "$fixture" <<'PLAN'
---
executor: agy
model: opus
test_cmd: npm test
deploy: wrangler deploy
needs: []
---

# Plan 999: test fixture
PLAN

# Source boss-lib in a subshell to test fm_get
ex=$(bash -c "source '$BOSSDIR/bin/boss-lib.sh'; fm_get executor '$fixture'")
[ "$ex" = "agy" ] || fail "(2) fm_get executor: expected 'agy', got '$ex'"
mo=$(bash -c "source '$BOSSDIR/bin/boss-lib.sh'; fm_get model '$fixture'")
[ "$mo" = "opus" ] || fail "(2) fm_get model: expected 'opus', got '$mo'"
tc=$(bash -c "source '$BOSSDIR/bin/boss-lib.sh'; fm_get test_cmd '$fixture'")
[ "$tc" = "npm test" ] || fail "(2) fm_get test_cmd: expected 'npm test', got '$tc'"
dp=$(bash -c "source '$BOSSDIR/bin/boss-lib.sh'; fm_get deploy '$fixture'")
[ "$dp" = "wrangler deploy" ] || fail "(2) fm_get deploy: expected 'wrangler deploy', got '$dp'"
echo "PASS: fm_get works"

# -----------------------------------------------------------------------
# (3) boss-dispatch.sh refuses a non-boss/* branch
# -----------------------------------------------------------------------
echo "--- (3) non-boss branch refused ---"
export GH_STUB_BRANCH="feature/not-boss"
set +e
err=$("$BOSSDIR/bin/boss-dispatch.sh" 99 2>&1)
rc=$?
set -e
[ "$rc" -ne 0 ] || fail "(3) dispatch should refuse a non-boss/* branch"
echo "$err" | grep -qi "not boss" || fail "(3) error should mention 'not boss': $err"
echo "PASS: non-boss branch refused"

# -----------------------------------------------------------------------
# (4) boss-dispatch.sh refuses a plan missing test_cmd
# -----------------------------------------------------------------------
echo "--- (4) missing test_cmd refused ---"
export GH_STUB_BRANCH="boss/999-test"

# Override git show to return a plan with empty test_cmd
real_git=$(PATH="${PATH#"$STUB_DIR:"}" command -v git)
cat > "$STUB_DIR/git" <<GITEOF
#!/bin/bash
if echo "\$*" | grep -q "show.*:plans/"; then
  cat <<'PLANEOF'
---
executor: claude-p
model:
test_cmd:
deploy:
needs: []
---
# empty test_cmd plan
PLANEOF
  exit 0
fi
exec "$real_git" "\$@"
GITEOF
chmod +x "$STUB_DIR/git"

set +e
err=$("$BOSSDIR/bin/boss-dispatch.sh" 100 2>&1)
rc=$?
set -e
[ "$rc" -ne 0 ] || fail "(4) dispatch should refuse missing test_cmd"
echo "$err" | grep -qi "test_cmd" || fail "(4) error should mention test_cmd: $err"

# Restore real git
rm -f "$STUB_DIR/git"
echo "PASS: missing test_cmd refused"

# -----------------------------------------------------------------------
# (5) claude-p.sh dispatch writes pid=/out= meta; alive returns defined code
# -----------------------------------------------------------------------
echo "--- (5) claude-p dispatch + alive ---"
cp_state="$BOSSDIR/state"
# Create a temporary state dir for this test
TEST_STATE="$TMP/test-state"
mkdir -p "$TEST_STATE"

# Write worktree meta so dispatch can find it
test_wt="$TMP/test-worktree"
mkdir -p "$test_wt"
echo "worktree=$test_wt" > "$TEST_STATE/200.meta"

# Create a brief
test_brief="$TMP/test-brief.md"
echo "test brief content" > "$test_brief"

# Run dispatch with BOSS_CLAUDE_CMD=echo (echo will exit quickly)
(
  export BOSS_CLAUDE_CMD="echo"
  # Point the executor at our test state
  BOSS_HOME_SAVE="$BOSSDIR"
  # We need to make the executor use our test state dir
  # The executor hardcodes STATE_DIR from BOSS_HOME. We need a temp boss home.
  FAKE_BOSS="$TMP/fake-boss"
  mkdir -p "$FAKE_BOSS/state" "$FAKE_BOSS/executors" "$FAKE_BOSS/bin"
  cp "$BOSSDIR/bin/boss-lib.sh" "$FAKE_BOSS/bin/"
  cp "$BOSSDIR/executors/claude-p.sh" "$FAKE_BOSS/executors/"
  cp "$TEST_STATE/200.meta" "$FAKE_BOSS/state/200.meta"
  "$FAKE_BOSS/executors/claude-p.sh" dispatch 200 "$test_brief"
) || fail "(5) claude-p dispatch failed"

# Check meta was written
FAKE_BOSS="$TMP/fake-boss"
grep -q "^pid=" "$FAKE_BOSS/state/200.meta" || fail "(5) claude-p dispatch did not write pid="
grep -q "^out=" "$FAKE_BOSS/state/200.meta" || fail "(5) claude-p dispatch did not write out="

# alive should return 1 (process exited) since echo finishes immediately
sleep 0.2
set +e
"$FAKE_BOSS/executors/claude-p.sh" alive 200
alive_rc=$?
set -e
# echo finishes fast, so alive should be 1 (finished/idle) — NOT 2 (dead/no pid)
[ "$alive_rc" -eq 1 ] || [ "$alive_rc" -eq 0 ] || fail "(5) claude-p alive returned $alive_rc, expected 0 or 1"
echo "PASS: claude-p dispatch + alive"

# -----------------------------------------------------------------------
# (6) boss-merge.sh invokes greenlight with --branch and --verify
# -----------------------------------------------------------------------
echo "--- (6) boss-merge ---"
: > "$TMP/greenlight.log"

# Create a fake repo tree so REPO_ROOT resolves correctly
# boss-lib.sh derives REPO_ROOT as $BOSS_HOME/../.. (tooling/boss -> repo root)
FAKE_REPO="$TMP/fake-repo"
MERGE_BOSS="$FAKE_REPO/tooling/boss"
mkdir -p "$MERGE_BOSS/state" "$MERGE_BOSS/bin" "$MERGE_BOSS/executors"
mkdir -p "$FAKE_REPO/tooling/cli/greenlight"
mkdir -p "$FAKE_REPO/tooling/cli/notify"
mkdir -p "$FAKE_REPO/plans"
echo "# plans" > "$FAKE_REPO/plans/README.md"

# Place greenlight and notify stubs where boss-lib.sh expects them
cp "$STUB_DIR/greenlight" "$FAKE_REPO/tooling/cli/greenlight/greenlight"
cp "$STUB_DIR/notify" "$FAKE_REPO/tooling/cli/notify/notify"
chmod +x "$FAKE_REPO/tooling/cli/greenlight/greenlight" "$FAKE_REPO/tooling/cli/notify/notify"

# Copy boss scripts
cp "$BOSSDIR/bin/boss-lib.sh" "$MERGE_BOSS/bin/"
cp "$BOSSDIR/bin/boss-merge.sh" "$MERGE_BOSS/bin/"
chmod +x "$MERGE_BOSS/bin/"*.sh

# Write the meta boss-merge.sh reads
cat > "$MERGE_BOSS/state/300.meta" <<EOF
branch=boss/300-test
slug=300-test
test_cmd=npm test
worktree=$TMP/merge-wt
EOF
mkdir -p "$TMP/merge-wt"

(
  export GH_STUB_BRANCH="boss/300-test"
  export GREENLIGHT_STATE_ROOT="$TMP/gl"
  mkdir -p "$GREENLIGHT_STATE_ROOT/run-boss-300-test"
  echo "landed" > "$GREENLIGHT_STATE_ROOT/run-boss-300-test/state"

  bash "$MERGE_BOSS/bin/boss-merge.sh" 300
) || fail "(6) boss-merge failed"

grep -q -- '--branch' "$TMP/greenlight.log" || fail "(6) greenlight not called with --branch"
grep -q -- '--verify' "$TMP/greenlight.log" || fail "(6) greenlight not called with --verify"
echo "PASS: boss-merge invokes greenlight correctly"

# -----------------------------------------------------------------------
# (7) agy.sh: dispatch writes pid=/head_before= meta; bash -n passes
#     (only runs if agy.sh exists — plan 040 creates it)
# -----------------------------------------------------------------------
echo "--- (7) agy dispatch + head-advanced guard ---"

AGY_BOSS="$TMP/agy-boss"
mkdir -p "$AGY_BOSS/state" "$AGY_BOSS/executors" "$AGY_BOSS/bin"
  cp "$BOSSDIR/bin/boss-lib.sh" "$AGY_BOSS/bin/"

# Only test agy if the file exists (plan 040 creates it)
if [ -f "$BOSSDIR/executors/agy.sh" ]; then
  bash -n "$BOSSDIR/executors/agy.sh" || fail "(7) agy.sh bash -n failed"
  cp "$BOSSDIR/executors/agy.sh" "$AGY_BOSS/executors/"
  agy_wt="$TMP/agy-wt"
  mkdir -p "$agy_wt"
  git init -q "$agy_wt"
  git -C "$agy_wt" commit -q --allow-empty -m init
  head_before=$(git -C "$agy_wt" rev-parse HEAD)

  echo "worktree=$agy_wt" > "$AGY_BOSS/state/400.meta"
  cp "$BOSSDIR/executors/agy.sh" "$AGY_BOSS/executors/"

  agy_brief="$TMP/agy-brief.md"
  echo "test agy brief" > "$agy_brief"

  (
    export AGY_DEFAULT_MODEL="test-model"
    "$AGY_BOSS/executors/agy.sh" dispatch 400 "$agy_brief"
  ) || fail "(7) agy dispatch failed"

  grep -q "^pid=" "$AGY_BOSS/state/400.meta" || fail "(7) agy dispatch did not write pid="
  grep -q "^head_before=" "$AGY_BOSS/state/400.meta" || fail "(7) agy dispatch did not write head_before="

  # Test the HEAD-advanced guard: stub agy output with SUCCESS but no new commit
  sleep 0.2
  echo '{"status":"SUCCESS"}' > "$AGY_BOSS/state/400.out"
  echo "out=$AGY_BOSS/state/400.out" >> "$AGY_BOSS/state/400.meta"
  result=$("$AGY_BOSS/executors/agy.sh" collect 400 2>/dev/null)
  echo "$result" | grep -q "blocked" || fail "(7) collect should report blocked when HEAD did not advance, got: $result"

  echo "PASS: agy dispatch + head-advanced guard"
else
  echo "SKIP: agy.sh not yet created (plan 040)"
fi

# -----------------------------------------------------------------------
# (8) boss_stall_check: a RE-DISPATCH must not inherit the previous run's
#     stall clock. PR#180 (2026-08-22) was re-dispatched twice after its first
#     crew hung on MCP startup. stall_fp/progress_at survived in the same
#     .meta; the fresh crew's first fingerprint MATCHED the stale one (same
#     HEAD, clean tree, empty out, sub-minute CPU — what a just-started crew
#     always looks like), so the idle window was measured from the ORIGINAL
#     dispatch and the killer fired on a 90-second-old healthy crew as
#     "stalled 45m". The fix keys off dispatched_at, which every executor
#     rewrites on dispatch, so it covers the direct
#     `executors/<e>.sh dispatch` salvage path too.
#
#     The seeded fingerprint MUST match what boss computes, or this test is
#     vacuous: with a non-matching one the `fp != last_fp` branch re-seeds
#     progress_at and the case passes with or without the fix.
# -----------------------------------------------------------------------
echo "--- (8) stall clock resets on re-dispatch ---"

STALL_REPO="$TMP/stall-repo"
STALL_BOSS="$STALL_REPO/tooling/boss"
mkdir -p "$STALL_BOSS/bin" "$STALL_BOSS/state" "$STALL_BOSS/executors"
mkdir -p "$STALL_REPO/tooling/cli/notify"
cp "$STUB_DIR/notify" "$STALL_REPO/tooling/cli/notify/notify"
chmod +x "$STALL_REPO/tooling/cli/notify/notify"
cp "$BOSSDIR/bin/boss-lib.sh" "$STALL_BOSS/bin/"

STALL_WT="$TMP/stall-wt"
mkdir -p "$STALL_WT"
git init -q "$STALL_WT"
git -C "$STALL_WT" commit -q --allow-empty -m init

STALL_META="$STALL_BOSS/state/500.meta"
STALL_OUT="$STALL_BOSS/state/500.out"

# seed_stall <dispatched_at> <progress_at> <stall_fp> <pid>
seed_stall() {
  printf 'worktree=%s\nexecutor=claude-p\nout=%s\npid=%s\nstall_fp=%s\nprogress_at=%s\ndispatched_at=%s\n' \
    "$STALL_WT" "$STALL_OUT" "$4" "$3" "$2" "$1" > "$STALL_META"
}

# stall_case <dispatched_at> <progress_at> <stall_fp> -> "<verdict> ALIVE|KILLED"
stall_case() {
  sleep 600 &
  local crew=$! verdict
  seed_stall "$1" "$2" "$3" "$crew"
  verdict=$(boss_stall_check 500)
  sleep 1
  if kill -0 "$crew" 2>/dev/null; then
    kill "$crew" 2>/dev/null
    echo "$verdict ALIVE"
  else
    echo "$verdict KILLED"
  fi
}

(
  source "$STALL_BOSS/bin/boss-lib.sh"
  touch "$STALL_OUT"
  now=$(date +%s)
  old=$(( now - 60*60 ))          # 60 min ago: past the 45m kill line

  # Learn the fingerprint boss actually computes for this worktree/pid/out.
  sleep 600 &
  bootstrap=$!
  seed_stall "$(( old - 600 ))" "$now" "bootstrap" "$bootstrap"
  boss_stall_check 500 > /dev/null
  real_fp=$(meta_get 500 stall_fp)
  kill "$bootstrap" 2>/dev/null
  [ -n "$real_fp" ] || fail "(8) could not learn a fingerprint"

  # Re-dispatch: dispatched_at NEWER than progress_at -> stale clock dropped.
  r=$(stall_case "$now" "$old" "$real_fp")
  [ "$r" = "working ALIVE" ] || fail "(8) re-dispatched crew should survive, got: $r"

  # Genuine stall: dispatched_at OLDER than progress_at -> still killed.
  r=$(stall_case "$(( old - 600 ))" "$old" "$real_fp")
  case "$r" in
    STALLED-KILLED*" KILLED") ;;
    *) fail "(8) a real stall should still be killed, got: $r" ;;
  esac
) || exit 1

echo "PASS: stall clock resets on re-dispatch, real stalls still killed"

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

# -----------------------------------------------------------------------
# (L1-L6) the land sweep (plan 229). Every case drives the REAL
# tooling/boss/bin/boss-land-sweep.sh through a fake boss home, with a stub
# executor that writes exactly the meta fields agy.sh writes. Nothing here
# asserts on source text: L1 asks boss_crews_running what it reports, and the
# rest read the entry files the sweep actually produced.
# -----------------------------------------------------------------------
LAND_REPO="$TMP/land-repo"
LAND_BOSS="$LAND_REPO/tooling/boss"
LANDS="$LAND_BOSS/state/lands"
AGY_LOG="$TMP/land-agy.log"
mkdir -p "$LAND_BOSS/bin" "$LAND_BOSS/executors" "$LANDS"
mkdir -p "$LAND_REPO/tooling/cli/notify"
cp "$STUB_DIR/notify" "$LAND_REPO/tooling/cli/notify/notify"
chmod +x "$LAND_REPO/tooling/cli/notify/notify"
cp "$BOSSDIR/bin/boss-lib.sh" "$BOSSDIR/bin/boss-land-sweep.sh" \
   "$BOSSDIR/bin/boss-session-start.sh" "$BOSSDIR/bin/boss-state.sh" "$LAND_BOSS/bin/"
chmod +x "$LAND_BOSS/bin/"*.sh
LAND_SWEEP="$LAND_BOSS/bin/boss-land-sweep.sh"

# Stub executor. Same contract as executors/agy.sh: resolve the worktree from
# $STATE_DIR/$id.meta, record head_before, background the run, record pid/dispatched_at.
# It resolves STATE_DIR through boss-lib exactly like the real one, which is what makes
# L1 a test of where the sweep's bookkeeping LANDS rather than of a string in a file.
cat > "$LAND_BOSS/executors/agy.sh" <<'LANDAGYEOF'
#!/bin/bash
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../bin" && pwd)/boss-lib.sh"
verb="${1:?}"; id="${2:?}"
case "$verb" in
  dispatch)
    printf '%s\n' "$id" >> "${AGY_STUB_LOG:-/dev/null}"
    wt=$(meta_get "$id" worktree) || { echo "ERROR: no worktree for $id" >&2; exit 1; }
    [ -f "${3:-}" ] || { echo "ERROR: brief unreadable: ${3:-}" >&2; exit 1; }
    meta_set "$id" head_before "$(git -C "$wt" rev-parse HEAD 2>/dev/null || echo none)"
    ( exec sleep "${LAND_STUB_SLEEP:-60}" ) & pid=$!
    disown "$pid" 2>/dev/null || true
    meta_set "$id" pid "$pid"; meta_set "$id" dispatched_at "$(date +%s)" ;;
  alive)
    pid=$(meta_get "$id" pid) || exit 2; [ -n "$pid" ] || exit 2
    kill -0 "$pid" 2>/dev/null && exit 0; exit 1 ;;
  *) exit 2 ;;
esac
LANDAGYEOF
chmod +x "$LAND_BOSS/executors/agy.sh"

LAND_WS="$TMP/land-ws"
mkdir -p "$LAND_WS"
git init -q "$LAND_WS"
git -C "$LAND_WS" commit -q --allow-empty -m init

export AGY_STUB_LOG="$AGY_LOG"
export BOSS_LAND_LOCK_MAX_WAIT=10

# land_kill <pid> — kill a stub fix-up, but ONLY if that pid is still the `sleep` we
# started. macOS recycles pids inside 100k, and a blind `kill` on a recorded pid took
# out one of this suite's own children and ended the run with no message at all.
land_kill() {
  local p="${1:-}"
  case "$p" in ''|*[!0-9]*) return 0 ;; esac
  ps -o command= -p "$p" 2>/dev/null | grep -q '^sleep' || return 0
  kill "$p" 2>/dev/null || true
  return 0
}

# land_reset — kill any stub fix-up still sleeping, then wipe every trace so the next
# case starts from a known state (including the chrome lock a dispatch hands over).
land_reset() {
  local m
  for m in "$LANDS"/*.meta "$LAND_BOSS/state"/*.meta; do
    [ -f "$m" ] || continue
    land_kill "$(sed -n 's/^pid=//p' "$m" | tail -1)"
  done
  rm -rf "$LANDS" "$LAND_BOSS/state"
  mkdir -p "$LANDS"
  : > "$AGY_LOG"
  return 0
}

# land_entry <slug> <reason> [extra key=value ...]
land_entry() {
  local slug="$1" reason="$2"; shift 2
  {
    printf 'workspace=%s\n' "$LAND_WS"
    printf 'branch=%s\n' "boss/$slug"
    printf 'reason=%s\n' "$reason"
    printf 'attempts=%s\n' 1
    printf 'at=%s\n' "2026-08-23T00:00:00Z"
    local kv; for kv in "$@"; do printf '%s\n' "$kv"; done
  } > "$LANDS/land-$slug.blocked"
}

land_field() { sed -n "s/^$2=//p" "$1" 2>/dev/null | tail -1; }

echo "--- (L1) a land fix-up is invisible to boss_crews_running ---"
land_reset
land_entry boss-l1 "verify failed: npm test"
LAND_STUB_SLEEP=120 BOSS_CHROME_WAIT_MIN=0 "$LAND_SWEEP" > "$TMP/l1.out" 2>&1
grep -q DISPATCHED "$TMP/l1.out" \
  || fail "(L1) fixture is vacuous — the sweep dispatched nothing: $(cat "$TMP/l1.out")"
l1_meta=""
for c in "$LANDS/land-boss-l1.meta" "$LAND_BOSS/state/land-boss-l1.meta"; do
  [ -f "$c" ] && l1_meta="$c"
done
[ -n "$l1_meta" ] || fail "(L1) fixture is vacuous — no land meta was written anywhere"
l1_pid=$(land_field "$l1_meta" pid)
kill -0 "$l1_pid" 2>/dev/null \
  || fail "(L1) fixture is vacuous — the stub fix-up (pid '$l1_pid') is not alive"
# The question the hazard actually asks: with the DEFAULT state dir, does boss see a crew?
l1_crews=$(bash -c 'source "'"$LAND_BOSS"'/bin/boss-lib.sh" >/dev/null 2>&1; boss_crews_running' 2>/dev/null)
case "$l1_crews" in
  *land-*) land_kill "$l1_pid"
           fail "a land fix-up was reported as a live boss crew" ;;
esac
land_kill "$l1_pid"
echo "PASS: a land fix-up is invisible to boss_crews_running"

echo "--- (L2) the per-slug claim is atomic under two concurrent sweeps ---"
land_reset
land_entry boss-l2 "verify failed: npm test"
( LAND_STUB_SLEEP=20 BOSS_CHROME_WAIT_MIN=0 "$LAND_SWEEP" > "$TMP/l2a.out" 2>&1 ) &
l2a=$!
( LAND_STUB_SLEEP=20 BOSS_CHROME_WAIT_MIN=0 "$LAND_SWEEP" > "$TMP/l2b.out" 2>&1 ) &
l2b=$!
wait "$l2a"; wait "$l2b"
l2_n=$(ls "$LANDS"/land-*.dispatching 2>/dev/null | wc -l | tr -d ' ')
[ "$l2_n" -eq 1 ] || fail "(L2) expected exactly 1 .dispatching entry, got $l2_n"
l2_inv=$(grep -c . "$AGY_LOG" || true)
[ "$l2_inv" -eq 1 ] || fail "(L2) executor was invoked $l2_inv time(s), expected exactly 1"
echo "PASS: the claim is atomic — one .dispatching, one dispatch"

echo "--- (L3) no_auto_resolve=1 is held, restored byte-identically, no attempt spent ---"
land_reset
land_entry boss-l3 "deploy-live-conflict" "no_auto_resolve=1" "real_attempts=1" \
  "conflicts=tooling/boss/bin/boss-merge.sh"
l3_before=$(shasum -a 256 < "$LANDS/land-boss-l3.blocked")
l3_out=$(BOSS_CHROME_WAIT_MIN=0 "$LAND_SWEEP" 2>&1)
[ -f "$LANDS/land-boss-l3.blocked" ] || fail "(L3) the .blocked name was not restored"
[ -e "$LANDS/land-boss-l3.dispatching" ] && fail "(L3) a held land was left claimed"
l3_after=$(shasum -a 256 < "$LANDS/land-boss-l3.blocked")
[ "$l3_before" = "$l3_after" ] || fail "(L3) a held land's entry changed (an attempt was spent)"
[ ! -s "$AGY_LOG" ] || fail "(L3) a deploy-live land was dispatched: $(cat "$AGY_LOG")"
echo "$l3_out" | grep -q 'HOLD' || fail "(L3) the hold was not listed: $l3_out"
echo "PASS: no_auto_resolve holds without consuming an attempt"

echo "--- (L4) transient resets the real counter; real consumes one ---"
land_reset
land_entry boss-l4t "PPLAND-MUTEX refusing to land: held for >3600s" "real_attempts=1"
BOSS_CHROME_WAIT_MIN=0 "$LAND_SWEEP" > "$TMP/l4t.out" 2>&1
l4t="$LANDS/land-boss-l4t.dispatching"
[ -f "$l4t" ] || fail "(L4) a transient land was not dispatched: $(cat "$TMP/l4t.out")"
[ "$(land_field "$l4t" real_attempts)" = "0" ] \
  || fail "(L4) transient did not RESET real_attempts (got '$(land_field "$l4t" real_attempts)')"
[ "$(land_field "$l4t" transient_attempts)" = "1" ] \
  || fail "(L4) transient did not consume a transient attempt (got '$(land_field "$l4t" transient_attempts)')"

land_reset
land_entry boss-l4r "verify failed: card-qa exited 1" "real_attempts=0" "transient_attempts=3"
BOSS_CHROME_WAIT_MIN=0 "$LAND_SWEEP" > "$TMP/l4r.out" 2>&1
l4r="$LANDS/land-boss-l4r.dispatching"
[ -f "$l4r" ] || fail "(L4) a real-failure land was not dispatched: $(cat "$TMP/l4r.out")"
[ "$(land_field "$l4r" real_attempts)" = "1" ] \
  || fail "(L4) a verify failure did not CONSUME a real attempt (got '$(land_field "$l4r" real_attempts)')"
[ "$(land_field "$l4r" transient_attempts)" = "3" ] \
  || fail "(L4) a real failure moved the transient counter (got '$(land_field "$l4r" transient_attempts)')"
echo "PASS: the classifier routes transient and real to the right counter"

echo "--- (L5) at the real cap: no dispatch, still listed at session start ---"
land_reset
land_entry boss-l5 "verify failed: npm test" "real_attempts=2"
l5_out=$(BOSS_CHROME_WAIT_MIN=0 "$LAND_SWEEP" 2>&1)
echo "$l5_out" | grep -q 'CAPPED' || fail "(L5) a capped land was not reported capped: $l5_out"
[ -f "$LANDS/land-boss-l5.blocked" ] || fail "(L5) a capped land lost its .blocked entry"
[ ! -s "$AGY_LOG" ] || fail "(L5) a capped land was dispatched anyway: $(cat "$AGY_LOG")"
# Visibility without a notification: session start must still print it.
l5_ss=$(cd "$LAND_REPO" && BOSS_CHROME_WAIT_MIN=0 bash "$LAND_BOSS/bin/boss-session-start.sh" 2>&1)
echo "$l5_ss" | grep -q 'land-boss-l5' \
  || fail "(L5) boss-session-start did not list the capped land"
[ ! -s "$AGY_LOG" ] || fail "(L5) session start dispatched a capped land: $(cat "$AGY_LOG")"
echo "PASS: a capped land stops dispatching but stays visible at session start"

echo "--- (L6) the transient bound holds inside the window ---"
land_reset
land_entry boss-l6 "PPLAND-MUTEX refusing to land: held for >3600s" \
  "transient_attempts=5" "transient_window_start=$(date +%s)"
l6_out=$(BOSS_CHROME_WAIT_MIN=0 "$LAND_SWEEP" 2>&1)
echo "$l6_out" | grep -q 'CAPPED' || fail "(L6) a 6th transient retry was not capped: $l6_out"
[ -f "$LANDS/land-boss-l6.blocked" ] || fail "(L6) a transient-capped land lost its entry"
[ ! -s "$AGY_LOG" ] || fail "(L6) a 6th transient retry dispatched: $(cat "$AGY_LOG")"
land_reset
echo "PASS: the transient bound holds"

echo "--- (D1) boss_dep_prelude installs deps for the dirs a command cd's into ---"
# The verify and the mutation gate run in a POOL slot, not the crew's worktree, and
# node_modules is per-slot — PR#197 (2026-08-23) read that as a broken mutation
# recipe for two merge cycles. Presence is tested against the BRANCH so a plan that
# creates a new app still works. HEAD stands in for the branch here.
dep_repo=$(mktemp -d); git -C "$dep_repo" init -q
mkdir -p "$dep_repo/apps/thing" "$dep_repo/tooling/plain"
echo '{}' > "$dep_repo/apps/thing/package.json"
echo 'x' > "$dep_repo/tooling/plain/notes.txt"
git -C "$dep_repo" add -A >/dev/null
git -C "$dep_repo" -c user.email=t@t -c user.name=t commit -qm init
( source "$BOSSDIR/bin/boss-lib.sh" >/dev/null 2>&1
  REPO_ROOT="$dep_repo"
  out=$(boss_dep_prelude 'cd apps/thing && npm run typecheck && npm test' HEAD)
  echo "$out" | grep -q 'cd apps/thing && npm install' \
    || fail "(D1) no install step for a dir that HAS a package.json: [$out]"
  out=$(boss_dep_prelude 'cd tooling/plain && ./check.sh' HEAD)
  [ -z "$out" ] || fail "(D1) invented an install step for a dir with NO package.json: [$out]"
  out=$(boss_dep_prelude 'npm test' HEAD)
  [ -z "$out" ] || fail "(D1) invented an install step for a command with no cd: [$out]"
  out=$(boss_dep_prelude 'cd apps/thing && npm test && cd apps/thing && npm run shot' HEAD)
  [ "$(echo "$out" | grep -c 'npm install')" -eq 1 ] \
    || fail "(D1) did not de-duplicate a dir named twice: [$out]"
) || exit 1
rm -rf "$dep_repo"
echo "PASS: boss_dep_prelude targets exactly the dirs that need installing"

# --- land_class: an auth 403 is transient, a secret refusal is still never -------
# Regression for 2026-08-23: every land 403'd because the crew shell had no GH_TOKEN and
# authenticated as the work account. The reason string pp-land recorded carries neither
# `pp-push` nor `push rejected`, so it fell through to the default `real`, burned REAL_CAP
# in four attempts, and the land sat listed as capped while its verify was passing.
(
  export BOSS_LAND_SWEEP_LIB=1
  # shellcheck disable=SC1090
  source "$BOSSDIR/bin/boss-land-sweep.sh" >/dev/null 2>&1 \
    || fail "(LC) cannot source boss-land-sweep.sh as a library"
  type land_class >/dev/null 2>&1 || fail "(LC) land_class not defined after sourcing"

  real403='land push refused by the push gate (exit 128) — remote: Permission to acct/repo.git denied to other-user. fatal: The requested URL returned error: 403'
  got=$(land_class "$real403")
  [ "$got" = "transient" ] \
    || fail "(LC) the real 2026-08-23 403 string must be transient, got [$got]"

  # Ordering guard: a genuine secret refusal must NEVER be softened to transient, even
  # though pp-push's own message can also mention a push failing.
  got=$(land_class 'pp-push refused: secret-shaped value in apps/x/.dev.vars (exit 128)')
  [ "$got" = "never" ] \
    || fail "(LC) a pp-push secret refusal must stay never, got [$got]"
  got=$(land_class 'deploy-live-conflict')
  [ "$got" = "never" ] || fail "(LC) deploy-live must stay never, got [$got]"

  # A verify failure stays real: auto-retrying a flaky verify lands red code.
  got=$(land_class 'verify failed: cd apps/tutorial-tracker-app && npm test')
  [ "$got" = "real" ] || fail "(LC) a verify failure must stay real, got [$got]"
  got=$(land_class 'rebase conflict')
  [ "$got" = "real" ] || fail "(LC) a rebase conflict must stay real, got [$got]"

  # The safe default survives.
  got=$(land_class 'something nobody predicted')
  [ "$got" = "real" ] || fail "(LC) an unrecognised cause must default to real, got [$got]"
) || exit 1
echo "PASS: land_class treats an auth 403 as transient without softening a secret refusal"

# --- boss_gh_restore hands the owner's gh account back on exit ------------------
# `gh auth switch` moves the GLOBAL active account. Before this, every boss write
# path (session-start/dispatch/merge/deploy) left the owner switched to
# BOSS_GH_USER, so their next ZluriHQ work-repo `gh` call authenticated as the
# personal account. The account is never logged OUT -- only "active" moves -- but
# it had to be moved back by hand every time.
(
  ghT=$(mktemp -d)
  mkdir -p "$ghT/stub" "$ghT/state"
  printf 'work-acct' > "$ghT/active"
  cat > "$ghT/stub/gh" <<'GHR'
#!/bin/bash
case "$1:$2" in
  api:user) cat "$GH_FAKE_HOME/active" ;;
  auth:switch)
    shift 2; user=""
    while [ $# -gt 0 ]; do case "$1" in --user) user="$2"; shift 2 ;; *) shift ;; esac; done
    printf '%s' "$user" > "$GH_FAKE_HOME/active"
    printf '%s\n' "$user" >> "$GH_FAKE_HOME/switches.log" ;;
  *) exit 0 ;;
esac
GHR
  chmod +x "$ghT/stub/gh"
  export GH_FAKE_HOME="$ghT"
  export PATH="$ghT/stub:$PATH"
  export BOSS_STATE_DIR="$ghT/state"
  # shellcheck disable=SC1090
  source "$BOSSDIR/bin/boss-lib.sh" >/dev/null 2>&1
  type boss_gh_restore >/dev/null 2>&1 || fail "(GH) boss_gh_restore not defined"

  boss_assert_gh >/dev/null 2>&1 || fail "(GH) boss_assert_gh failed against the stub"
  [ "$(cat "$ghT/active")" = "akshat-git-jpg" ] || fail "(GH) did not switch to BOSS_GH_USER"
  [ "$(cat "$ghT/state/gh_prev" 2>/dev/null)" = "work-acct" ] \
    || fail "(GH) the displaced account was not recorded in gh_prev"

  boss_gh_restore >/dev/null 2>&1
  [ "$(cat "$ghT/active")" = "work-acct" ] \
    || fail "(GH) the owner's account was NOT restored, got [$(cat "$ghT/active")]"
  [ ! -f "$ghT/state/gh_prev" ] || fail "(GH) gh_prev survived the restore"

  # Idempotent: a second restore (two traps, or a trap after a manual call) is a no-op.
  boss_gh_restore >/dev/null 2>&1
  [ "$(cat "$ghT/active")" = "work-acct" ] || fail "(GH) a second restore moved the account"

  # BOSS_GH_KEEP=1 leaves boss's account active for hand-chained commands.
  boss_assert_gh >/dev/null 2>&1
  [ "$(cat "$ghT/active")" = "akshat-git-jpg" ] || fail "(GH) re-switch failed"
  ( export BOSS_GH_KEEP=1; boss_gh_restore >/dev/null 2>&1 )
  [ "$(cat "$ghT/active")" = "akshat-git-jpg" ] || fail "(GH) BOSS_GH_KEEP=1 still restored"
  rm -f "$ghT/state/gh_prev"

  # Already-correct account: no switch, nothing recorded, restore is a no-op.
  printf 'akshat-git-jpg' > "$ghT/active"
  rm -f "$ghT/switches.log"
  boss_assert_gh >/dev/null 2>&1 || fail "(GH) assert failed when already correct"
  [ ! -s "$ghT/switches.log" ] || fail "(GH) switched despite already being correct"
  [ ! -f "$ghT/state/gh_prev" ] || fail "(GH) wrote gh_prev despite no switch"
  boss_gh_restore >/dev/null 2>&1
  [ "$(cat "$ghT/active")" = "akshat-git-jpg" ] || fail "(GH) no-op restore moved the account"
  rm -rf "$ghT"
) || exit 1
echo "PASS: boss_gh_restore returns the owner's gh account after every boss write path"

# --- every boss entry script traps the restore ----------------------------------
# The helper is useless if an entry script forgets it: boss_assert_gh's switch is
# what leaks, so a path that asserts without trapping the restore is the whole bug
# back again on that one path.
for _e in boss-session-start boss-dispatch boss-merge boss-deploy; do
  grep -q 'trap boss_gh_restore EXIT' "$BOSSDIR/bin/$_e.sh" \
    || fail "(GH2) $_e.sh calls boss_assert_gh but never traps boss_gh_restore"
done
echo "PASS: all four boss entry scripts trap boss_gh_restore on EXIT"

# --- (T1) test_cmd shape is gated at dispatch, not discovered at merge ---------
# Both shapes below were documented as prose in CLAUDE.md and violated anyway. A
# multi-line value corrupts the line-based meta silently; an inner `bash -c` gets
# double-wrapped by boss-merge and parks greenlight on `unexpected EOF`.
(
  export BOSS_STATE_DIR="$TMP/t1-state"
  # shellcheck disable=SC1090
  source "$BOSSDIR/bin/boss-lib.sh" >/dev/null 2>&1
  type boss_check_test_cmd >/dev/null 2>&1 || fail "(T1) boss_check_test_cmd not defined"

  got=$(boss_check_test_cmd 'cd apps/x && npm test') \
    || fail "(T1) refused a perfectly bare one-line command"
  [ "$got" = 'cd apps/x && npm test' ] || fail "(T1) mangled a bare command: [$got]"

  # A `key: |` block scalar arrives with surrounding whitespace. That alone is fine.
  got=$(boss_check_test_cmd '   cd apps/x && npm test   ') \
    || fail "(T1) refused a command that only needed trimming"
  [ "$got" = 'cd apps/x && npm test' ] || fail "(T1) did not trim: [$got]"

  boss_check_test_cmd "cd apps/x${BOSS_NL}npm test" >/dev/null 2>&1 \
    && fail "(T1) accepted a MULTI-LINE test_cmd"
  boss_check_test_cmd "bash -c 'cd apps/x && npm test'" >/dev/null 2>&1 \
    && fail "(T1) accepted a test_cmd carrying its own bash -c wrapper"
  boss_check_test_cmd "sh -c 'npm test'" >/dev/null 2>&1 \
    && fail "(T1) accepted a test_cmd carrying its own sh -c wrapper"

  # meta_set is the second line of defence: even if a future call site skips the
  # check, a newline must fail loudly rather than corrupt the file.
  meta_set t1 test_cmd "cd apps/x${BOSS_NL}npm test" >/dev/null 2>&1 \
    && fail "(T1) meta_set wrote a multi-line value"
  [ ! -f "$BOSS_STATE_DIR/t1.meta" ] || [ ! -s "$BOSS_STATE_DIR/t1.meta" ] \
    || fail "(T1) meta_set corrupted the file before refusing: $(cat "$BOSS_STATE_DIR/t1.meta")"
  meta_set t1 test_cmd 'cd apps/x && npm test' || fail "(T1) meta_set refused a valid value"
  [ "$(meta_get t1 test_cmd)" = 'cd apps/x && npm test' ] \
    || fail "(T1) round-trip through the meta lost the value"
) || exit 1
echo "PASS: test_cmd shape is refused at dispatch and the meta cannot be corrupted"

# --- (T2) claude-p sizes --max-turns from the plan's line count ----------------
# A flat 60 was really a ~300-line plan ceiling: across all 18 historical claude-p
# runs turns scaled at ~0.15-0.2 turns/line, every success had a plan <=292L, and
# both error_max_turns deaths were 315L and 537L. This drives the REAL executor and
# reads the argv its stub `claude` received -- not the source text.
(
  t2="$TMP/t2"; mkdir -p "$t2/wt"
  git init -q "$t2/wt"
  git -C "$t2/wt" -c user.email=t@t -c user.name=t commit -q --allow-empty -m init
  mkdir -p "$t2/wt/plans"

  # Stub `claude`: print the argv it was handed. claude-p redirects the run into
  # $STATE_DIR/$id.out, so that file becomes the assertion surface.
  cat > "$t2/claude-stub" <<'T2EOF'
#!/bin/bash
printf 'ARGV: %s\n' "$*"
T2EOF
  chmod +x "$t2/claude-stub"
  printf 'brief\n' > "$t2/brief.md"

  # t2_turns <label> <plan-lines> [env assignments...] -> echoes the --max-turns value
  t2_turns() {
    local label="$1" plines="$2"; shift 2
    local sd="$t2/state-$label"
    rm -rf "$sd"; mkdir -p "$sd"
    if [ "$plines" -gt 0 ]; then
      : > "$t2/wt/plans/$label.md"
      local i=0
      while [ "$i" -lt "$plines" ]; do printf 'x\n' >> "$t2/wt/plans/$label.md"; i=$((i+1)); done
    fi
    ( export BOSS_STATE_DIR="$sd" BOSS_CLAUDE_CMD="$t2/claude-stub"
      # shellcheck disable=SC1090
      source "$BOSSDIR/bin/boss-lib.sh" >/dev/null 2>&1
      meta_set 900 worktree "$t2/wt"
      meta_set 900 model sonnet
      meta_set 900 planpath "plans/$label.md"
      [ "$plines" -gt 0 ] && [ "${T2_NO_PLAN_LINES:-0}" != 1 ] && meta_set 900 plan_lines "$plines"
      true
    )
    ( export BOSS_STATE_DIR="$sd" BOSS_CLAUDE_CMD="$t2/claude-stub"
      for kv in "$@"; do export "$kv"; done
      bash "$BOSSDIR/executors/claude-p.sh" dispatch 900 "$t2/brief.md" >/dev/null 2>&1 )
    local n=0
    while [ "$n" -lt 100 ]; do
      [ -s "$sd/900.out" ] && grep -q 'ARGV:' "$sd/900.out" && break
      n=$((n+1)); command sleep 0.1
    done
    sed -n 's/.*--max-turns \([0-9]*\).*/\1/p' "$sd/900.out" | head -1
  }

  got=$(t2_turns floor 100)
  [ "$got" = 60 ] || fail "(T2) a 100L plan must still get the 60-turn floor, got [$got]"

  got=$(t2_turns scaled 500)
  [ "$got" = 200 ] || fail "(T2) a 500L plan must scale to 200 turns, got [$got]"

  # The two historical error_max_turns deaths, 315L and 537L, must now clear 60.
  got=$(t2_turns death315 315)
  [ "$got" -gt 60 ] || fail "(T2) the 315L plan that died on max-turns still gets 60, got [$got]"
  got=$(t2_turns death537 537)
  [ "$got" -gt 60 ] || fail "(T2) the 537L plan that died on max-turns still gets 60, got [$got]"

  got=$(t2_turns cap 2000)
  [ "$got" = 600 ] || fail "(T2) the upper cap must hold at 600, got [$got]"

  got=$(t2_turns override 500 BOSS_MAX_TURNS=42)
  [ "$got" = 42 ] || fail "(T2) BOSS_MAX_TURNS must win over the sizing, got [$got]"

  # A DIRECT fix-up dispatch runs against a meta written before plan_lines existed;
  # the executor must fall back to counting the plan in the worktree.
  got=$(T2_NO_PLAN_LINES=1 t2_turns fallback 500)
  [ "$got" = 200 ] || fail "(T2) no plan_lines in the meta must fall back to the plan file, got [$got]"
) || exit 1
echo "PASS: claude-p budgets --max-turns from plan size, with BOSS_MAX_TURNS still winning"

echo ""
echo "ALL TESTS PASSED"
