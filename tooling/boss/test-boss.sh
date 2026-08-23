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

echo ""
echo "ALL TESTS PASSED"
