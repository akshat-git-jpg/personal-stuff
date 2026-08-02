#!/bin/bash
set -e

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

# Create stubs
STUB_DIR=$(mktemp -d)
trap 'rm -rf "$STUB_DIR"' EXIT
export PATH="$STUB_DIR:$PATH"

# Isolate greenlight state so tests never pollute the real ~/kb-scratch/greenlight
export GREENLIGHT_STATE_ROOT="$STUB_DIR/gl-state"

# greenlight now calls tooling/cli/notify (Telegram-first, ntfy fallback)
# instead of pp-ntfy directly. Force the ntfy-fallback path deterministically:
# point at a telegram env file that never exists so notify always falls
# through to (stubbed) pp-ntfy, regardless of whether the real repo's
# infra/secrets/telegram.env has been filled in by the owner.
export NOTIFY_ENV_FILE="$STUB_DIR/no-such-telegram.env"
export NTFY_TOPIC="test-topic"

cat > "$STUB_DIR/pp-ntfy" << 'EOF'
#!/bin/bash
echo "$*" >> "$HOME/kb-scratch/test-ntfy.log"
EOF
chmod +x "$STUB_DIR/pp-ntfy"

cat > "$STUB_DIR/wt" << 'EOF'
#!/bin/bash
if [ "$1" = "get" ]; then
  mkdir -p "$GREENLIGHT_STATE_ROOT-test-wt"
  # Mock cloning repo
  cp -r "$3/"* "$GREENLIGHT_STATE_ROOT-test-wt/" 2>/dev/null || true
  cp -r "$3/.git" "$GREENLIGHT_STATE_ROOT-test-wt/"
  # Real `wt` hands out a CLEAN pooled worktree. The naive copy above would drag
  # the top-level's uncommitted changes along, which no real lease does and which
  # makes a dirty-main test fail for the wrong reason.
  git -C "$GREENLIGHT_STATE_ROOT-test-wt" reset --hard -q HEAD 2>/dev/null || true
  echo "$GREENLIGHT_STATE_ROOT-test-wt"
elif [ "$1" = "return" ]; then
  rm -rf "$GREENLIGHT_STATE_ROOT-test-wt"
fi
EOF
chmod +x "$STUB_DIR/wt"

cat > "$STUB_DIR/claude" << 'EOF'
#!/bin/bash
# Mock claude based on the env var MOCK_CLAUDE_RESPONSE
if [ -n "$MOCK_CLAUDE_RESPONSE" ]; then
  echo "$MOCK_CLAUDE_RESPONSE"
else
  echo '{"result": "{}", "usage": {"input_tokens": 0, "output_tokens": 0}}'
fi
EOF
chmod +x "$STUB_DIR/claude"

# Mock push
cat > "$STUB_DIR/git" << 'EOF'
#!/bin/bash
# Landing pushes from inside the worktree as `push origin HEAD:main` since
# 2026-08-02 (it no longer merges in the top-level checkout); match both forms
# so the "did we push to main?" assertion keeps working either way.
if [[ "$*" == *"push origin main"* ]] || [[ "$*" == *"push origin HEAD:main"* ]]; then
  touch "$HOME/kb-scratch/test-push.log"
  # Record the push, then LET IT HAPPEN against the real bare origin. Since
  # 2026-08-02 greenlight lands from inside the worktree and only fast-forwards
  # the top-level checkout afterwards, so swallowing the push would leave the
  # test repo with nothing to fast-forward TO and hide whether landing worked.
fi
exec /usr/bin/git "$@"
EOF
chmod +x "$STUB_DIR/git"

GREENLIGHT_BIN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/greenlight"

# Create test repo
TEST_REPO=$(mktemp -d)
trap 'rm -rf "$TEST_REPO" "$HOME/kb-scratch/test-ntfy.log" "$HOME/kb-scratch/test-push.log"' EXIT
cd "$TEST_REPO"
git init >/dev/null 2>&1
git branch -m main >/dev/null 2>&1 || true
git commit --allow-empty -m "initial commit" >/dev/null 2>&1

# Setup origin
ORIGIN_REPO=$(mktemp -d)
trap 'rm -rf "$ORIGIN_REPO"' EXIT
cd "$ORIGIN_REPO"
git init --bare >/dev/null 2>&1
cd "$TEST_REPO"
git remote add origin "$ORIGIN_REPO"
git push -u origin main >/dev/null 2>&1

# (a) empty-diff branch
git checkout -b empty-branch >/dev/null 2>&1
"$GREENLIGHT_BIN" run --branch empty-branch --repo "$TEST_REPO" >/dev/null 2>&1 || true
run_id=$(ls -t "$GREENLIGHT_STATE_ROOT" | head -n 1)
state=$(cat "$GREENLIGHT_STATE_ROOT/$run_id/state")
[ "$state" = "landed" ] || fail "(a) empty-diff branch state=$state, expected landed"

# Add a commit for other tests
git checkout main >/dev/null 2>&1
git checkout -b feat-branch >/dev/null 2>&1
echo "test" > file.txt
git add file.txt
git commit -m "feat" >/dev/null 2>&1

# (b) canned review with an ask-user finding. Review is OPT-IN now (--review),
# so the finding only gates the land when the pass is explicitly requested.
export MOCK_CLAUDE_RESPONSE='{"result": "{\"findings\": [{\"id\": \"r1\", \"severity\": \"warning\", \"file\": \"file.txt\", \"line\": 1, \"description\": \"test\", \"action\": \"ask-user\"}], \"risk_level\": \"low\"}", "usage": {"input_tokens": 0, "output_tokens": 0}}'
rm -f "$HOME/kb-scratch/test-ntfy.log"
"$GREENLIGHT_BIN" run --branch feat-branch --repo "$TEST_REPO" --review >/dev/null 2>&1 || true
run_id=$(ls -t "$GREENLIGHT_STATE_ROOT" | head -n 1)
state=$(cat "$GREENLIGHT_STATE_ROOT/$run_id/state")
[ "$state" = "parked" ] || fail "(b) ask-user state=$state, expected parked"
grep -q "parked" "$HOME/kb-scratch/test-ntfy.log" || fail "(b) ntfy not called with parked"

# (c) canned all-green run
export MOCK_CLAUDE_RESPONSE='{"result": "{\"findings\": [], \"risk_level\": \"low\", \"passed\": true, \"tested\": [], \"evidence\": [], \"updated\": [], \"unresolved\": []}", "usage": {"input_tokens": 0, "output_tokens": 0}}'
rm -f "$HOME/kb-scratch/test-push.log"
git checkout main >/dev/null 2>&1
git checkout -b green-branch >/dev/null 2>&1
echo "green" > file2.txt
git add file2.txt
git commit -m "green" >/dev/null 2>&1
git checkout main >/dev/null 2>&1 # Ensure we are on main
"$GREENLIGHT_BIN" run --branch green-branch --repo "$TEST_REPO" >/dev/null 2>&1 || true
run_id=$(ls -t "$GREENLIGHT_STATE_ROOT" | head -n 1)
state=$(cat "$GREENLIGHT_STATE_ROOT/$run_id/state")
[ "$state" = "landed" ] || fail "(c) all-green state=$state, expected landed"
[ -f "$HOME/kb-scratch/test-push.log" ] || fail "(c) push not invoked"
# Check merge commit on stub main
git -C "$TEST_REPO" log --oneline | grep -q "greenlight: land green-branch" || fail "(c) merge commit not present on main"

# (d) canned risk_level: high all-green, under --review (high ALWAYS parks)
export MOCK_CLAUDE_RESPONSE='{"result": "{\"findings\": [], \"risk_level\": \"high\", \"passed\": true, \"tested\": [], \"evidence\": [], \"updated\": [], \"unresolved\": []}", "usage": {"input_tokens": 0, "output_tokens": 0}}'
git checkout main >/dev/null 2>&1
git checkout -b high-risk-branch >/dev/null 2>&1
echo "high" > file3.txt
git add file3.txt
git commit -m "high" >/dev/null 2>&1
git checkout main >/dev/null 2>&1
"$GREENLIGHT_BIN" run --branch high-risk-branch --repo "$TEST_REPO" --review >/dev/null 2>&1 || true
run_id=$(ls -t "$GREENLIGHT_STATE_ROOT" | head -n 1)
state=$(cat "$GREENLIGHT_STATE_ROOT/$run_id/state")
[ "$state" = "parked" ] || fail "(d) high risk state=$state, expected parked"

# (d2) SAME high-risk mock, but WITHOUT --review: the opt-in review never runs,
# so nothing gates the land. This is the contract change — deep LLM review is
# no longer a default gate.
git checkout main >/dev/null 2>&1
git checkout -b high-risk-noreview >/dev/null 2>&1
echo "high2" > file3b.txt
git add file3b.txt
git commit -m "high2" >/dev/null 2>&1
git checkout main >/dev/null 2>&1
"$GREENLIGHT_BIN" run --branch high-risk-noreview --repo "$TEST_REPO" >/dev/null 2>&1 || true
run_id=$(ls -t "$GREENLIGHT_STATE_ROOT" | head -n 1)
state=$(cat "$GREENLIGHT_STATE_ROOT/$run_id/state")
[ "$state" = "landed" ] || fail "(d2) high risk w/o --review state=$state, expected landed"

# (e) --no-land green
export MOCK_CLAUDE_RESPONSE='{"result": "{\"findings\": [], \"risk_level\": \"low\", \"passed\": true, \"tested\": [], \"evidence\": [], \"updated\": [], \"unresolved\": []}", "usage": {"input_tokens": 0, "output_tokens": 0}}'
git checkout main >/dev/null 2>&1
git checkout -b noland-branch >/dev/null 2>&1
echo "noland" > file4.txt
git add file4.txt
git commit -m "noland" >/dev/null 2>&1
git checkout main >/dev/null 2>&1
"$GREENLIGHT_BIN" run --branch noland-branch --repo "$TEST_REPO" --no-land >/dev/null 2>&1 || true
run_id=$(ls -t "$GREENLIGHT_STATE_ROOT" | head -n 1)
state=$(cat "$GREENLIGHT_STATE_ROOT/$run_id/state")
[ "$state" = "parked" ] || fail "(e) no-land state=$state, expected parked"
grep -q "\-\-no-land" "$GREENLIGHT_STATE_ROOT/$run_id/parked-reason" || fail "(e) parked reason not --no-land"

# (f) --verify command exits non-zero → parked (deterministic gate)
unset MOCK_CLAUDE_RESPONSE
git checkout main >/dev/null 2>&1
git checkout -b verify-fail-branch >/dev/null 2>&1
echo "vf" > file5.txt
git add file5.txt
git commit -m "vf" >/dev/null 2>&1
git checkout main >/dev/null 2>&1
"$GREENLIGHT_BIN" run --branch verify-fail-branch --repo "$TEST_REPO" --verify "exit 3" >/dev/null 2>&1 || true
run_id=$(ls -t "$GREENLIGHT_STATE_ROOT" | head -n 1)
state=$(cat "$GREENLIGHT_STATE_ROOT/$run_id/state")
[ "$state" = "parked" ] || fail "(f) verify-fail state=$state, expected parked"
grep -q "verify failed" "$GREENLIGHT_STATE_ROOT/$run_id/parked-reason" || fail "(f) parked reason not verify-failed"

# (g) --verify command exits zero → landed
git checkout main >/dev/null 2>&1
git checkout -b verify-pass-branch >/dev/null 2>&1
echo "vp" > file6.txt
git add file6.txt
git commit -m "vp" >/dev/null 2>&1
git checkout main >/dev/null 2>&1
"$GREENLIGHT_BIN" run --branch verify-pass-branch --repo "$TEST_REPO" --verify "true" >/dev/null 2>&1 || true
run_id=$(ls -t "$GREENLIGHT_STATE_ROOT" | head -n 1)
state=$(cat "$GREENLIGHT_STATE_ROOT/$run_id/state")
[ "$state" = "landed" ] || fail "(g) verify-pass state=$state, expected landed"

# (h) DIRTY top-level checkout still lands (2026-08-02). This is the whole point
# of landing from inside the worktree: an unrelated uncommitted file used to park
# EVERY merge as "main checkout busy", which cost an entire batch's wall-clock
# when a second session was editing the repo.
git checkout main >/dev/null 2>&1
git checkout -b dirty-main-branch >/dev/null 2>&1
echo "dm" > file7.txt
git add file7.txt
git commit -m "dm" >/dev/null 2>&1
git checkout main >/dev/null 2>&1
echo "uncommitted junk from another session" > tracked-dirty.txt
git add tracked-dirty.txt
git commit -m "add tracked file" >/dev/null 2>&1
git push -q origin main >/dev/null 2>&1 || true
echo "MODIFIED by a concurrent session" > tracked-dirty.txt   # now dirty + tracked
[ -n "$(git -C "$TEST_REPO" status --porcelain --untracked-files=no)" ] || fail "(h) setup: top-level should be dirty"
"$GREENLIGHT_BIN" run --branch dirty-main-branch --repo "$TEST_REPO" --verify "true" >/dev/null 2>&1 || true
run_id=$(ls -t "$GREENLIGHT_STATE_ROOT" | head -n 1)
state=$(cat "$GREENLIGHT_STATE_ROOT/$run_id/state")
reason=$(cat "$GREENLIGHT_STATE_ROOT/$run_id/parked-reason" 2>/dev/null || echo "")
[ "$state" = "landed" ] || fail "(h) dirty top-level state=$state reason='$reason', expected landed"
git -C "$ORIGIN_REPO" log --oneline main | grep -q "greenlight: land dirty-main-branch" \
  || fail "(h) merge commit not pushed to origin/main"
# The concurrent session's uncommitted edit must survive untouched.
grep -q "MODIFIED by a concurrent session" "$TEST_REPO/tracked-dirty.txt" \
  || fail "(h) landing clobbered the dirty working file"
git checkout -- tracked-dirty.txt >/dev/null 2>&1 || true

# (i) top-level checked out on a NON-main branch still lands.
git checkout main >/dev/null 2>&1
git checkout -b sidebranch-parked >/dev/null 2>&1
echo "sb" > file8.txt
git add file8.txt
git commit -m "sb" >/dev/null 2>&1
git checkout -b other-work >/dev/null 2>&1   # leave top-level OFF main
"$GREENLIGHT_BIN" run --branch sidebranch-parked --repo "$TEST_REPO" --verify "true" >/dev/null 2>&1 || true
run_id=$(ls -t "$GREENLIGHT_STATE_ROOT" | head -n 1)
state=$(cat "$GREENLIGHT_STATE_ROOT/$run_id/state")
reason=$(cat "$GREENLIGHT_STATE_ROOT/$run_id/parked-reason" 2>/dev/null || echo "")
[ "$state" = "landed" ] || fail "(i) off-main top-level state=$state reason='$reason', expected landed"
git -C "$ORIGIN_REPO" log --oneline main | grep -q "greenlight: land sidebranch-parked" \
  || fail "(i) merge commit not pushed to origin/main"
[ "$(git -C "$TEST_REPO" rev-parse --abbrev-ref HEAD)" = "other-work" ] \
  || fail "(i) landing switched the top-level checkout's branch"

echo "ALL TESTS PASSED"
