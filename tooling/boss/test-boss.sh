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
      labels)
        # boss-dispatch reads the PR's CURRENT labels as its duplicate-dispatch lock.
        # The stub ignores -q and prints the already-joined list the caller expects.
        echo "${GH_STUB_LABELS:-}" ;;
      *) echo "{}" ;;
    esac ;;
  pr:edit) echo "$*" >> "$BOSS_TEST_TMP/gh-edit.log"; exit 0 ;;
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
# (7b) codex.sh: dispatch meta, the 0-token guard, rc=124 -> truncated, and
#      thread-id recovery from an archived stream.
#      The 0-token case is the one that matters: a clean exit whose turn used
#      no tokens means the CLI never reached the model, and calling that
#      "done" is exactly the failure agy taught us (LESSONS 2026-07-07).
# -----------------------------------------------------------------------
echo "--- (7b) codex dispatch + collect verdicts ---"

if [ -f "$BOSSDIR/executors/codex.sh" ]; then
  bash -n "$BOSSDIR/executors/codex.sh" || fail "(7b) codex.sh bash -n failed"

  CDX_BOSS="$TMP/codex-boss"
  mkdir -p "$CDX_BOSS/state" "$CDX_BOSS/executors" "$CDX_BOSS/bin"
  cp "$BOSSDIR/bin/boss-lib.sh" "$CDX_BOSS/bin/"
  cp "$BOSSDIR/executors/codex.sh" "$CDX_BOSS/executors/"

  # Stubs. codex.sh APPENDS its fallback PATH entries, so these win.
  cat > "$STUB_DIR/codex" <<'CDXEOF'
#!/bin/bash
echo '{"type":"thread.started","thread_id":"stub-thread-1"}'
echo '{"type":"turn.completed","usage":{"input_tokens":10,"output_tokens":5}}'
CDXEOF
  chmod +x "$STUB_DIR/codex"
  cat > "$STUB_DIR/gtimeout" <<'GTEOF'
#!/bin/bash
# Drop `-k <n>` and the duration, then run the rest.
[ "$1" = "-k" ] && shift 2
shift
exec "$@"
GTEOF
  chmod +x "$STUB_DIR/gtimeout"

  cdx_wt="$TMP/codex-wt"
  mkdir -p "$cdx_wt"
  git init -q "$cdx_wt"
  git -C "$cdx_wt" commit -q --allow-empty -m init

  echo "worktree=$cdx_wt" > "$CDX_BOSS/state/500.meta"
  cdx_brief="$TMP/codex-brief.md"
  echo "test codex brief" > "$cdx_brief"

  ( export CODEX_DEFAULT_MODEL="test-model"
    "$CDX_BOSS/executors/codex.sh" dispatch 500 "$cdx_brief" ) \
    || fail "(7b) codex dispatch failed"

  grep -q "^pid=" "$CDX_BOSS/state/500.meta" || fail "(7b) dispatch did not write pid="
  grep -q "^head_before=" "$CDX_BOSS/state/500.meta" || fail "(7b) dispatch did not write head_before="
  grep -q "^rcfile=" "$CDX_BOSS/state/500.meta" || fail "(7b) dispatch did not write rcfile="
  # The brief the crew actually receives must carry the non-interactive addendum;
  # without it a mirrored interactive skill can park the crew on a question.
  grep -q "You are non-interactive" "$CDX_BOSS/state/500.codex.md" \
    || fail "(7b) codex brief is missing the non-interactive addendum"

  # Let the backgrounded stub finish and write its rc.
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    [ -f "$CDX_BOSS/state/500.rc" ] && break
    sleep 0.2
  done

  # HEAD never advanced (the stub commits nothing) -> blocked, never done.
  result=$("$CDX_BOSS/executors/codex.sh" collect 500 2>/dev/null)
  echo "$result" | grep -q "^blocked" \
    || fail "(7b) collect should report blocked when HEAD did not advance, got: $result"

  # thread_id must be pinned onto the meta by collect, so a resume survives the
  # stream being overwritten.
  grep -q "^thread_id=stub-thread-1" "$CDX_BOSS/state/500.meta" \
    || fail "(7b) collect did not pin thread_id onto the meta"

  # rc=124 (gtimeout) is truncated, NOT blocked — it must route to resume.
  echo 124 > "$CDX_BOSS/state/500.rc"
  result=$("$CDX_BOSS/executors/codex.sh" collect 500 2>/dev/null)
  echo "$result" | grep -q "^truncated" \
    || fail "(7b) rc=124 should report truncated, got: $result"

  # A 0-token turn is never a success, even on a clean exit with commits.
  echo 0 > "$CDX_BOSS/state/500.rc"
  printf '%s\n%s\n' '{"type":"thread.started","thread_id":"stub-thread-1"}' \
                    '{"type":"turn.completed","usage":{}}' > "$CDX_BOSS/state/500.out"
  git -C "$cdx_wt" commit -q --allow-empty -m "crew work"
  result=$("$CDX_BOSS/executors/codex.sh" collect 500 2>/dev/null)
  echo "$result" | grep -q "^dead" \
    || fail "(7b) a 0-token turn must not be reported as done, got: $result"

  # Same state, real token usage -> done.
  printf '%s\n%s\n' '{"type":"thread.started","thread_id":"stub-thread-1"}' \
                    '{"type":"turn.completed","usage":{"input_tokens":10}}' > "$CDX_BOSS/state/500.out"
  result=$("$CDX_BOSS/executors/codex.sh" collect 500 2>/dev/null)
  echo "$result" | grep -q "^done" \
    || fail "(7b) collect should report done when HEAD advanced, got: $result"

  echo "PASS: codex dispatch + collect verdicts"
else
  echo "SKIP: codex.sh not present"
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
    boss_fixup_claim "$id" || exit 3
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

# Stub fallback executor. Same contract, its own log, and it claims the fix-up budget
# exactly like executors/claude-p.sh — which is what makes L10 a real test of the
# refund: without it, boss_fixup_claim refuses the fallback dispatch outright.
CLAUDEP_LOG="$TMP/land-claudep.log"
: > "$CLAUDEP_LOG"
cat > "$LAND_BOSS/executors/claude-p.sh" <<'LANDCPEOF'
#!/bin/bash
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../bin" && pwd)/boss-lib.sh"
verb="${1:?}"; id="${2:?}"
case "$verb" in
  dispatch)
    wt=$(meta_get "$id" worktree) || { echo "ERROR: no worktree for $id" >&2; exit 1; }
    [ -f "${3:-}" ] || { echo "ERROR: brief unreadable: ${3:-}" >&2; exit 1; }
    # The claim comes BEFORE the log line, unlike the agy stub: this log is what L10
    # reads to decide whether the fallback actually RAN, so a refused dispatch must
    # leave it empty or the test passes on a dispatch that never happened.
    boss_fixup_claim "$id" || exit 3
    printf '%s\n' "$id" >> "${CLAUDEP_STUB_LOG:-/dev/null}"
    meta_set "$id" head_before "$(git -C "$wt" rev-parse HEAD 2>/dev/null || echo none)"
    ( exec sleep "${LAND_STUB_SLEEP:-60}" ) & pid=$!
    disown "$pid" 2>/dev/null || true
    meta_set "$id" pid "$pid"; meta_set "$id" dispatched_at "$(date +%s)" ;;
  alive)
    pid=$(meta_get "$id" pid) || exit 2; [ -n "$pid" ] || exit 2
    kill -0 "$pid" 2>/dev/null && exit 0; exit 1 ;;
  *) exit 2 ;;
esac
LANDCPEOF
chmod +x "$LAND_BOSS/executors/claude-p.sh"
export CLAUDEP_STUB_LOG="$CLAUDEP_LOG"

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

# (L7-L9) added 2026-08-27, after land-work-pp-agents-ui stalled for 36 minutes.
# A quota-dead fix-up consumed the whole REAL budget and the cap was announced only to a
# stdout nobody reads, so two finished commits silently stopped reaching main.
echo "--- (L7) a fix-up that never RAN refunds the real attempt and pays transient ---"
land_reset
land_entry boss-l7 "verify failed: npm test"
LAND_STUB_SLEEP=0 BOSS_CHROME_WAIT_MIN=0 "$LAND_SWEEP" > "$TMP/l7a.out" 2>&1
[ -f "$LANDS/land-boss-l7.dispatching" ] \
  || fail "(L7) the land was not dispatched: $(cat "$TMP/l7a.out")"
[ "$(land_field "$LANDS/land-boss-l7.dispatching" real_attempts)" = "1" ] \
  || fail "(L7) dispatch did not charge a real attempt"
# The executor's own envelope: an agy 429, exactly as recorded on 2026-08-27.
printf '%s\n' '{"status":"ERROR","response":"","error":"RESOURCE_EXHAUSTED (code 429): Individual quota reached. Please upgrade your subscription to increase your limits. Resets in 44m2s.","num_turns":1}' \
  > "$LANDS/land-boss-l7.out"
l7_out=$(LAND_STUB_SLEEP=0 BOSS_CHROME_WAIT_MIN=0 "$LAND_SWEEP" 2>&1)
echo "$l7_out" | grep -q 'INFRA ' \
  || fail "(L7) a quota death was not classified as infra: $l7_out"
echo "$l7_out" | grep -q 'CAPPED' \
  && fail "(L7) a quota death capped the land: $l7_out"
l7e="$LANDS/land-boss-l7.dispatching"
[ -f "$l7e" ] || l7e="$LANDS/land-boss-l7.blocked"
[ "$(land_field "$l7e" transient_attempts)" = "1" ] \
  || fail "(L7) a quota death did not charge the transient budget (got '$(land_field "$l7e" transient_attempts)')"
[ "$(land_field "$l7e" real_attempts)" -le 1 ] \
  || fail "(L7) a quota death consumed a real attempt (got '$(land_field "$l7e" real_attempts)')"
echo "PASS: an executor that never ran costs the transient budget, not the real one"

echo "--- (L8) one fix-up costs exactly one real attempt, charged at dispatch ---"
land_reset
land_entry boss-l8 "verify failed: npm test"
LAND_STUB_SLEEP=0 BOSS_CHROME_WAIT_MIN=0 "$LAND_SWEEP" > "$TMP/l8a.out" 2>&1
[ -f "$LANDS/land-boss-l8.dispatching" ] \
  || fail "(L8) the land was not dispatched: $(cat "$TMP/l8a.out")"
l8_before=$(land_field "$LANDS/land-boss-l8.dispatching" real_attempts)
[ "$l8_before" = "1" ] \
  || fail "(L8) dispatch did not charge exactly one real attempt (got '$l8_before')"
# Freeze phase B so the reap is measured ALONE. reap_one does not look at
# no_auto_resolve, so it still runs; sweep_one HOLDs and restores byte-identically, which
# leaves the reap's own counters readable with no second dispatch mixed in.
printf 'no_auto_resolve=1\n' >> "$LANDS/land-boss-l8.dispatching"
printf '%s\n' '{"status":"SUCCESS","response":"I read the failing test and could not find a safe fix.","num_turns":24}' \
  > "$LANDS/land-boss-l8.out"
l8_out=$(LAND_STUB_SLEEP=0 BOSS_CHROME_WAIT_MIN=0 "$LAND_SWEEP" 2>&1)
echo "$l8_out" | grep -q 'NOADVANCE' \
  || fail "(L8) a real no-commit fix-up was not reaped: $l8_out"
echo "$l8_out" | grep -q 'INFRA' \
  && fail "(L8) ordinary agent output was misread as an infra death: $l8_out"
l8_after=$(land_field "$LANDS/land-boss-l8.blocked" real_attempts)
[ "$l8_after" = "$l8_before" ] \
  || fail "(L8) the reap charged a SECOND attempt for one fix-up ($l8_before then $l8_after) — REAL_CAP buys half what it says"
echo "PASS: one fix-up costs one real attempt, and only an executor that never ran is refunded"

echo "--- (L8b) REAL_CAP really buys REAL_CAP dispatches ---"
land_reset
land_entry boss-l8b "verify failed: npm test"
l8b_n=0
for _ in 1 2 3 4; do
  printf '%s\n' '{"status":"SUCCESS","response":"no safe fix","num_turns":9}' \
    > "$LANDS/land-boss-l8b.out"
  LAND_STUB_SLEEP=0 BOSS_CHROME_WAIT_MIN=0 "$LAND_SWEEP" > "$TMP/l8b.out" 2>&1
  l8b_n=$(grep -c 'boss-l8b' "$AGY_LOG" || true)
done
[ "$l8b_n" = "2" ] \
  || fail "(L8b) REAL_CAP=2 bought $l8b_n dispatch(es), expected 2"
land_reset
echo "PASS: two dispatches for a cap of two, then it stops"

echo "--- (L9) a capped land notifies, exactly once ---"
land_reset
: > "$TMP/notify.log"
land_entry boss-l9 "verify failed: npm test" "real_attempts=2"
l9_out=$(BOSS_CHROME_WAIT_MIN=0 "$LAND_SWEEP" 2>&1)
echo "$l9_out" | grep -q 'CAPPED' || fail "(L9) the land was not capped: $l9_out"
grep -q 'land-boss-l9' "$TMP/notify.log" \
  || fail "(L9) a capped land sent no notification: $(cat "$TMP/notify.log" 2>/dev/null)"
[ "$(land_field "$LANDS/land-boss-l9.blocked" capped_notified)" = "1" ] \
  || fail "(L9) the notified flag was not recorded in the entry"
l9_n=$(grep -c 'land-boss-l9' "$TMP/notify.log")
BOSS_CHROME_WAIT_MIN=0 "$LAND_SWEEP" > /dev/null 2>&1
BOSS_CHROME_WAIT_MIN=0 "$LAND_SWEEP" > /dev/null 2>&1
l9_n2=$(grep -c 'land-boss-l9' "$TMP/notify.log")
[ "$l9_n" = "$l9_n2" ] \
  || fail "(L9) a capped land re-notified on every sweep ($l9_n then $l9_n2)"
land_reset
echo "PASS: a capped land is announced once, not silently and not repeatedly"

echo "--- (L10) after an infra death the next fix-up falls back to claude-p on sonnet ---"
land_reset
: > "$CLAUDEP_LOG"
land_entry boss-l10 "verify failed: npm test"
LAND_STUB_SLEEP=0 BOSS_CHROME_WAIT_MIN=0 "$LAND_SWEEP" > "$TMP/l10a.out" 2>&1
grep -q 'boss-l10' "$AGY_LOG" \
  || fail "(L10) the first dispatch did not use the primary executor: $(cat "$TMP/l10a.out")"
[ ! -s "$CLAUDEP_LOG" ] || fail "(L10) the fallback ran before anything had failed"
# A fix-up round is already spent. Without the refund in reap_one, boss_fixup_claim
# REFUSES the fallback (BOSS_MAX_FIXUPS=1) and the outage takes the land down with it.
printf 'fixups=1\n' >> "$LANDS/land-boss-l10.meta"
printf '%s\n' '{"status":"ERROR","response":"","error":"RESOURCE_EXHAUSTED (code 429): Individual quota reached.","num_turns":1}' \
  > "$LANDS/land-boss-l10.out"
l10_out=$(LAND_STUB_SLEEP=0 BOSS_CHROME_WAIT_MIN=0 "$LAND_SWEEP" 2>&1)
grep -q 'boss-l10' "$CLAUDEP_LOG" \
  || fail "(L10) a quota death did not fall back to claude-p: $l10_out"
[ "$(land_field "$LANDS/land-boss-l10.meta" executor)" = "claude-p" ] \
  || fail "(L10) the meta does not name the fallback executor (got '$(land_field "$LANDS/land-boss-l10.meta" executor)')"
[ "$(land_field "$LANDS/land-boss-l10.meta" model)" = "sonnet" ] \
  || fail "(L10) the fallback model was not pinned to sonnet (got '$(land_field "$LANDS/land-boss-l10.meta" model)')"
land_reset
echo "PASS: a provider outage hands the fix-up to claude-p on sonnet"

echo "--- (L11) an entry whose land already SUCCEEDED is dropped, not dispatched ---"
# 2026-08-27. pp-land clears its own entry with `rm -f land-<slug>.blocked` once a land
# finishes — but a sweep that runs mid-land has already RENAMED that file to
# `.dispatching`, so the rm hits a name that no longer exists and the entry outlives a
# land that worked. work/land-retry-hardening landed 09:41:41 -> 09:51:22 (a 9m41s verify
# suite) and a session-start sweep claimed its entry at 09:51:06, sixteen seconds early:
# an agy fix-up was dispatched to repair a branch that was already on main, and every
# later sweep would have done it again. The guard is pp-land's own question asked here —
# is the workspace HEAD an ancestor of origin/main?
land_reset
: > "$CLAUDEP_LOG"
l11_origin="$TMP/l11-origin.git"; l11_ws="$TMP/l11-ws"
rm -rf "$l11_origin" "$l11_ws"
git init -q --bare -b main "$l11_origin"
git clone -q "$l11_origin" "$l11_ws" 2>/dev/null || true
git -C "$l11_ws" symbolic-ref HEAD refs/heads/main
git -C "$l11_ws" -c user.email=t@t -c user.name=t commit -q --allow-empty -m init
git -C "$l11_ws" push -q origin main
l11_entry() {
  {
    printf 'workspace=%s\n' "$l11_ws"
    printf 'branch=%s\n' "boss/l11"
    printf 'reason=%s\n' "verify failed: npm test"
    printf 'attempts=1\n'
    printf 'at=2026-08-27T00:00:00Z\n'
  } > "$LANDS/land-boss-l11.blocked"
}
l11_entry
l11_out=$(LAND_STUB_SLEEP=0 BOSS_CHROME_WAIT_MIN=0 "$LAND_SWEEP" 2>&1)
echo "$l11_out" | grep -q 'LANDED' \
  || fail "(L11) a land already on origin/main was not reported as landed: $l11_out"
[ -e "$LANDS/land-boss-l11.blocked" ] && fail "(L11) the stale entry was kept"
[ -e "$LANDS/land-boss-l11.dispatching" ] && fail "(L11) the stale entry was claimed for dispatch"
grep -q 'boss-l11' "$AGY_LOG" && fail "(L11) a fix-up was dispatched for a land already on main"
# The negative half, and the reason this guard is safe: a workspace carrying a commit
# that is NOT on origin/main is a genuinely blocked land and must still dispatch.
# Without this case the guard could silence the whole queue and still pass.
land_reset
l11_entry
git -C "$l11_ws" -c user.email=t@t -c user.name=t commit -q --allow-empty -m unlanded
l11_out2=$(LAND_STUB_SLEEP=0 BOSS_CHROME_WAIT_MIN=0 "$LAND_SWEEP" 2>&1)
grep -q 'boss-l11' "$AGY_LOG" \
  || fail "(L11) an unlanded workspace was wrongly treated as landed: $l11_out2"
land_reset
echo "PASS: a stale entry for a landed branch is dropped; an unlanded one still dispatches"

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

# --- (T3) claude-p `resume` continues the SAME session, bounded ----------------
# Truncation is not a plan failure, so it must not spend the single fix-up round.
# The continuation MUST resume the same session id: boss holds no plan context by
# design, so the model's own prior context is the only strong handoff available.
# Every case below drives the REAL executor and reads the argv its stub saw.
(
  t3="$TMP/t3"; mkdir -p "$t3/wt"
  git init -q "$t3/wt"
  git -C "$t3/wt" -c user.email=t@t -c user.name=t commit -q --allow-empty -m init
  mkdir -p "$t3/wt/plans"
  i=0; while [ "$i" -lt 500 ]; do printf 'x\n' >> "$t3/wt/plans/p.md"; i=$((i+1)); done

  cat > "$t3/claude-stub" <<'T3EOF'
#!/bin/bash
printf 'ARGV: %s\n' "$*"
T3EOF
  chmod +x "$t3/claude-stub"

  SID="a86c2acf-e9a1-40e3-af37-033faf78fbcb"

  # t3_setup <label> [resumes] — build a state dir holding a max-turns envelope.
  t3_setup() {
    local label="$1" res="${2:-}"
    t3sd="$t3/state-$label"
    rm -rf "$t3sd"; mkdir -p "$t3sd"
    printf '%s\n' "{\"is_error\":true,\"subtype\":\"error_max_turns\",\"session_id\":\"$SID\",\"result\":\"\"}" \
      > "$t3sd/900.out"
    ( export BOSS_STATE_DIR="$t3sd"
      # shellcheck disable=SC1090
      source "$BOSSDIR/bin/boss-lib.sh" >/dev/null 2>&1
      meta_set 900 worktree "$t3/wt"
      meta_set 900 model sonnet
      meta_set 900 planpath "plans/p.md"
      meta_set 900 plan_lines 500
      meta_set 900 out "$t3sd/900.out"
      meta_set 900 head_before "deadbeef"
      meta_set 900 test_cmd 'cd apps/x && npm test'
      meta_set 900 test_timeout 600
      [ -n "$res" ] && meta_set 900 resumes "$res"
      true )
  }
  t3_run() {   # t3_run <state-dir> <verb> [env...]
    local sd="$1" v="$2"; shift 2
    ( export BOSS_STATE_DIR="$sd" BOSS_CLAUDE_CMD="$t3/claude-stub"
      for kv in "$@"; do export "$kv"; done
      bash "$BOSSDIR/executors/claude-p.sh" "$v" 900 2>&1 )
  }
  t3_wait_argv() {
    local f="$1" n=0
    while [ "$n" -lt 100 ]; do grep -q 'ARGV:' "$f" 2>/dev/null && return 0; n=$((n+1)); command sleep 0.1; done
    return 1
  }
  t3_meta() { sed -n "s/^$2=//p" "$1/900.meta" | tail -1; }

  # -- happy path -------------------------------------------------------------
  t3_setup happy
  out=$(t3_run "$t3sd" resume) || fail "(T3) resume failed on a resumable run: $out"
  t3_wait_argv "$t3sd/900.out" || fail "(T3) the resumed run never invoked claude: $(cat "$t3sd/900.out")"
  argv=$(cat "$t3sd/900.out")
  case "$argv" in
    *"--resume $SID"*) ;;
    *) fail "(T3) resume did not pass --resume with the envelope's session id: $argv" ;;
  esac
  case "$argv" in
    *"--max-turns 200"*) ;;
    *) fail "(T3) resume did not size its own turn budget from the plan: $argv" ;;
  esac
  case "$argv" in
    *"--model sonnet"*) ;;
    *) fail "(T3) resume dropped the recorded model, so a continuation could drift tiers: $argv" ;;
  esac
  [ "$(t3_meta "$t3sd" resumes)" = 1 ] \
    || fail "(T3) resume did not record the round (got '$(t3_meta "$t3sd" resumes)')"
  [ -f "$t3sd/900.out.r0" ] || fail "(T3) the previous envelope was not kept as .out.r0"
  grep -q "$SID" "$t3sd/900.out.r0" || fail "(T3) the archived envelope lost the session id"
  # The baseline for "did this PR produce work at all" must stay the original dispatch.
  [ "$(t3_meta "$t3sd" head_before)" = deadbeef \
    ] || fail "(T3) resume rewrote head_before, so a no-op continuation would read as done"
  # A resume must re-stamp dispatched_at, or boss_stall_check measures idle time from
  # the PREVIOUS run and can kill a healthy continuation instantly.
  [ -n "$(t3_meta "$t3sd" dispatched_at)" ] || fail "(T3) resume did not re-stamp dispatched_at"

  # -- refusals ---------------------------------------------------------------
  t3_setup nosid
  printf '%s\n' '{"is_error":true,"subtype":"error_max_turns","result":""}' > "$t3sd/900.out"
  t3_run "$t3sd" resume >/dev/null 2>&1 && fail "(T3) resumed an envelope with no session_id"

  t3_setup capped 2
  t3_run "$t3sd" resume >/dev/null 2>&1 && fail "(T3) resumed past BOSS_MAX_RESUMES"
  t3_setup raised 2
  t3_run "$t3sd" resume BOSS_MAX_RESUMES=3 >/dev/null 2>&1 \
    || fail "(T3) BOSS_MAX_RESUMES could not raise the bound for one run"

  t3_setup live
  ( exec sleep 30 ) & livepid=$!
  disown "$livepid" 2>/dev/null || true
  ( export BOSS_STATE_DIR="$t3sd"
    # shellcheck disable=SC1090
    source "$BOSSDIR/bin/boss-lib.sh" >/dev/null 2>&1
    meta_set 900 pid "$livepid" )
  t3_run "$t3sd" resume >/dev/null 2>&1 \
    && { kill "$livepid" 2>/dev/null; fail "(T3) resume forked a second crew onto a live worktree"; }
  kill "$livepid" 2>/dev/null

  # -- collect classifies truncation separately from a real failure -----------
  t3_setup coll
  got=$(t3_run "$t3sd" collect)
  case "$got" in
    truncated*) ;;
    *) fail "(T3) a max-turns run must collect as 'truncated', not '$got'" ;;
  esac
  case "$got" in
    *"resume 900"*) ;;
    *) fail "(T3) the truncated message must name the resume command: $got" ;;
  esac

  # At the cap it becomes a real block: no resume left, so the plan is too big.
  t3_setup collcap 2
  got=$(t3_run "$t3sd" collect)
  case "$got" in
    blocked*) ;;
    *) fail "(T3) at the resume cap a max-turns run must collect as 'blocked', got '$got'" ;;
  esac
) || exit 1
echo "PASS: claude-p resumes the same session, bounded, and truncation is not a block"

# --- (T4) duplicate dispatch is refused --------------------------------------
# boss-dispatch never read the PR's CURRENT labels, so a second dispatch of a live
# PR flipped labels blindly, leased a SECOND worktree, and then either handed the PR
# back to boss:ready while crew 1 was still running (inviting a third) or truncated
# $pr.meta, orphaning crew 1's pid/worktree/head_before beyond recovery.
# boss:in-progress was designated as the lock and was never checked.
(
  t4="$TMP/t4"; mkdir -p "$t4"
  export BOSS_STATE_DIR="$t4/state"; mkdir -p "$BOSS_STATE_DIR"
  export GH_STUB_BRANCH="boss/998-dup"
  real_git4=$(PATH="${PATH#"$STUB_DIR:"}" command -v git)
  cat > "$STUB_DIR/git" <<GIT4EOF
#!/bin/bash
if echo "\$*" | grep -q "show.*:plans/"; then
  cat <<'PLAN4EOF'
---
executor: claude-p
model: sonnet
test_cmd: cd apps/x && npm test
needs: []
---
# a valid plan
PLAN4EOF
  exit 0
fi
exec "$real_git4" "\$@"
GIT4EOF
  chmod +x "$STUB_DIR/git"
  rm -f "$TMP/gh-edit.log"

  # (a) the label IS the lock, and it is now actually read.
  export GH_STUB_LABELS="type:tool,boss:in-progress"
  set +e; err=$("$BOSSDIR/bin/boss-dispatch.sh" 998 2>&1); rc=$?; set -e
  [ "$rc" -eq 3 ] || fail "(T4a) a boss:in-progress PR must be refused with exit 3, got $rc: $err"
  echo "$err" | grep -q 'already boss:in-progress' \
    || fail "(T4a) refusal did not name the reason: $err"
  [ ! -f "$TMP/gh-edit.log" ] || fail "(T4a) a refused dispatch still edited labels: $(cat "$TMP/gh-edit.log")"

  # (b) belt: a live pid refuses even when the label says otherwise.
  export GH_STUB_LABELS="boss:ready"
  # The test process itself stands in for a live crew: guaranteed alive for the whole
  # case, where a backgrounded `sleep` races the two full dispatch runs below.
  t4pid=$$
  printf 'pid=%s\n' "$t4pid" > "$BOSS_STATE_DIR/998.meta"
  set +e; err=$("$BOSSDIR/bin/boss-dispatch.sh" 998 2>&1); rc=$?; set -e
  [ "$rc" -eq 3 ] || fail "(T4b) a live crew must be refused with exit 3, got $rc: $err"
  echo "$err" | grep -q 'LIVE crew' || fail "(T4b) refusal did not name the live crew: $err"

  # (c) --force gets past the refusal, and the abort path must NOT hand a PR with a
  #     live crew back to the ready queue — that is what invited a third dispatch.
  set +e; err=$("$BOSSDIR/bin/boss-dispatch.sh" 998 --force 2>&1); rc=$?; set -e
  echo "$err" | grep -q 'leaving boss:in-progress' \
    || fail "(T4c) the abort path did not protect a live crew: $err"
  if [ -f "$TMP/gh-edit.log" ]; then
    grep -q 'add-label boss:ready' "$TMP/gh-edit.log" \
      && fail "(T4c) abort handed a live PR back to boss:ready: $(cat "$TMP/gh-edit.log")"
  fi
  rm -f "$STUB_DIR/git"
) || { rm -f "$STUB_DIR/git"; exit 1; }
unset GH_STUB_LABELS BOSS_STATE_DIR
export GH_STUB_BRANCH="not-a-boss-branch"
echo "PASS: a second dispatch of a live PR is refused, and abort protects the crew"

# -----------------------------------------------------------------------
# (T4d) the crew brief fences the crew INTO its worktree.
#
# Crews are PLACED in a leased worktree, not walled into one: the
# no-history-in-main.sh hook only runs for claude-p (it is a Claude hook), agy has
# no hooks at all, and codex has only dcg. So for two of the three executors the
# brief is the only thing standing between a crew and the owner's shared main
# checkout, where a commit can capture another live session's uncommitted work
# (2026-08-22). The old wording said "outside this repo", which the main checkout
# is not.
#
# LIMIT, stated rather than hidden: this asserts on the heredoc SOURCE, not on a
# generated brief — no case in this suite drives boss-dispatch far enough to write
# one (they all stop at a refusal or the abort path). The brief is emitted verbatim
# from this block, so a deletion is caught; a break in the surrounding heredoc
# would not be.
# -----------------------------------------------------------------------
echo "--- (T4d) crew brief fences the crew into its worktree ---"
grep -q 'Work ONLY inside this worktree' "$BOSSDIR/bin/boss-dispatch.sh" \
  || fail "(T4d) the crew brief no longer fences the crew into its worktree"
grep -q 'Work ONLY inside this worktree: \$wt' "$BOSSDIR/bin/boss-dispatch.sh" \
  || fail "(T4d) the fence does not name the leased worktree (\$wt must interpolate)"
grep -q 'NOT in \$REPO_ROOT' "$BOSSDIR/bin/boss-dispatch.sh" \
  || fail "(T4d) the fence does not name the main checkout (\$REPO_ROOT must interpolate)"
# The fence must sit in the UNQUOTED heredoc; in a quoted one ('EOF') the crew would
# be told to avoid the literal strings "$wt" and "$REPO_ROOT".
awk '/^cat > "\$brief" <<EOF$/,/^EOF$/' "$BOSSDIR/bin/boss-dispatch.sh" \
  | grep -q 'Work ONLY inside this worktree' \
  || fail "(T4d) the fence is not inside the interpolating brief heredoc"
echo "PASS: the crew brief fences the crew into its leased worktree"

# --- (T5) the fix-up bound is persisted, not remembered -----------------------
# The "one fix-up then blocked" policy lived only in the boss session's working
# memory. After a compaction it could not tell round 1 from round 3, so the bound
# was silently unbounded — exactly the failure the policy exists to prevent.
(
  t5="$TMP/t5"; mkdir -p "$t5/wt"
  git init -q "$t5/wt"
  git -C "$t5/wt" -c user.email=t@t -c user.name=t commit -q --allow-empty -m init
  printf 'brief\n' > "$t5/brief.md"

  export BOSS_STATE_DIR="$t5/state"; mkdir -p "$BOSS_STATE_DIR"
  # shellcheck disable=SC1090
  source "$BOSSDIR/bin/boss-lib.sh" >/dev/null 2>&1
  type boss_fixup_claim >/dev/null 2>&1 || fail "(T5) boss_fixup_claim not defined"

  # A FRESH dispatch has no pid yet (boss-dispatch truncates the meta first), so it
  # is not a fix-up and must not consume anything.
  meta_set 901 worktree "$t5/wt"
  boss_fixup_claim 901 2>/dev/null || fail "(T5) a fresh dispatch was counted as a fix-up"
  [ -z "$(meta_get 901 fixups 2>/dev/null)" ] || fail "(T5) a fresh dispatch wrote a fixup count"

  # A DIRECT executor dispatch runs against a meta that still carries pid => round 1.
  meta_set 901 pid 1
  boss_fixup_claim 901 2>/dev/null || fail "(T5) the first fix-up round was refused"
  [ "$(meta_get 901 fixups)" = 1 ] || fail "(T5) round 1 was not recorded (got '$(meta_get 901 fixups)')"
  boss_fixup_claim 901 >/dev/null 2>&1 && fail "(T5) a SECOND fix-up round was allowed at BOSS_MAX_FIXUPS=1"
  ( BOSS_MAX_FIXUPS=2; boss_fixup_claim 901 >/dev/null 2>&1 ) \
    || fail "(T5) BOSS_MAX_FIXUPS could not raise the bound for one run"

  # Wiring: both executors must claim the budget, and must do it BEFORE they
  # overwrite head_before — otherwise a refused fix-up has already destroyed the
  # baseline that tells boss whether the PR ever produced work.
  for ex in claude-p agy; do
    sd="$t5/state-$ex"; rm -rf "$sd"; mkdir -p "$sd"
    ( export BOSS_STATE_DIR="$sd"
      # shellcheck disable=SC1090
      source "$BOSSDIR/bin/boss-lib.sh" >/dev/null 2>&1
      meta_set 902 worktree "$t5/wt"
      meta_set 902 model sonnet
      meta_set 902 pid 1
      meta_set 902 fixups 1
      meta_set 902 head_before "deadbeef" )
    set +e
    ( export BOSS_STATE_DIR="$sd" BOSS_CLAUDE_CMD="$STUB_DIR/claude"
      bash "$BOSSDIR/executors/$ex.sh" dispatch 902 "$t5/brief.md" >/dev/null 2>&1 )
    rc=$?
    set -e
    [ "$rc" -eq 3 ] || fail "(T5) $ex dispatch past the fix-up cap must exit 3, got $rc"
    [ "$(sed -n 's/^head_before=//p' "$sd/902.meta" | tail -1)" = deadbeef ] \
      || fail "(T5) $ex overwrote head_before before claiming the fix-up budget"
  done
) || exit 1
unset BOSS_STATE_DIR
echo "PASS: the fix-up bound is persisted in the meta and both executors claim it"

echo "--- (T6) three gates added after the 2026-08-25 batch ---"
(
  t6="$TMP/t6"; mkdir -p "$t6"
  # shellcheck disable=SC1090
  source "$BOSSDIR/bin/boss-lib.sh" >/dev/null 2>&1

  # --- T6a: a ui:true plan naming a GITIGNORED image path -------------------
  # Plan 239 (PR#200) told its crew to commit
  # apps/tutorial-tracker-app/docs/shots/new-video-slug.png; /docs/shots is
  # gitignored, so the ui gate could never pass and the crew spent a round on it.
  printf 'shot at apps/tutorial-tracker-app/docs/shots/new-video-slug.png\n' > "$t6/ui-bad.md"
  printf 'shot at pipelines/video/visuals-flow/docs/screenshots/186-intro-tab.png\n' > "$t6/ui-ok.md"
  [ -n "$(boss_ui_ignored_paths "$t6/ui-bad.md")" ] \
    || fail "(T6a) ui path gate did not flag a gitignored screenshot path"
  [ -z "$(boss_ui_ignored_paths "$t6/ui-ok.md")" ] \
    || fail "(T6a) ui path gate flagged a TRACKED screenshot path"

  # --- T6b: the .dev.vars prelude, and it must stay ONE line ----------------
  # A leased slot has no .dev.vars, so every tracker e2e / ui:true shot renders
  # "Not found" from the dev-login 404 (tracker CLAUDE.md; PRs #172/#173/#176).
  pre="$(boss_dep_prelude 'cd apps/tutorial-tracker-app && npm test' origin/main)"
  case "$pre" in *DEV_AUTH=1*) ;; *) fail "(T6b) prelude did not seed DEV_AUTH for an app shipping .dev.vars.example" ;; esac
  case "$pre" in *"$BOSS_NL"*) fail "(T6b) prelude is multi-line — meta_set would refuse it" ;; esac
  meta_set 903 test_cmd "$pre" >/dev/null 2>&1 \
    || fail "(T6b) meta_set refused the prelude — it must be a single line"
  pre2="$(boss_dep_prelude 'cd pipelines/video-registry && node --test registry.test.mjs' origin/main)"
  case "$pre2" in *DEV_AUTH*) fail "(T6b) prelude seeded DEV_AUTH for an app with no .dev.vars.example" ;; esac

  # --- T6c: a migration with no deploy ------------------------------------
  # Plan 239 landed migrations/0003_card_slug.sql with an empty deploy:, and the
  # app's `deploy` script runs no migrations. Production `cards` had no slug
  # column while the landed code wrote one.
  printf -- '---\ndeploy:\nui:\n---\n' > "$t6/mig-nodeploy.md"
  printf -- '---\ndeploy: wrangler d1 migrations apply DB --remote\nui:\n---\n' > "$t6/mig-deploy.md"
  printf -- '---\ndeploy:\nmigration_deploy: external\nui:\n---\n' > "$t6/mig-escape.md"
  mig_verdict() {
    local plan="$1" migs mig_deploy mig_esc
    migs="apps/tutorial-tracker-app/migrations/0003_card_slug.sql"
    mig_deploy=$(fm_get deploy "$plan" 2>/dev/null)
    mig_esc=$(fm_get migration_deploy "$plan" 2>/dev/null)
    case "$mig_esc" in external|manual|done) return 0 ;; esac
    [ -n "$migs" ] && [ -z "$mig_deploy" ] && echo VIOLATION
    return 0
  }
  [ "$(mig_verdict "$t6/mig-nodeploy.md")" = VIOLATION ] \
    || fail "(T6c) migration-without-deploy was not reported"
  [ -z "$(mig_verdict "$t6/mig-deploy.md")" ] \
    || fail "(T6c) a plan WITH a deploy was wrongly reported"
  [ -z "$(mig_verdict "$t6/mig-escape.md")" ] \
    || fail "(T6c) migration_deploy: external did not suppress the report"
) || exit 1
echo "PASS: ui-path, dev.vars prelude and migration-deploy gates all fire and stay quiet correctly"

echo ""
echo "ALL TESTS PASSED"
