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
  mkdir -p "$HOME/kb-scratch/greenlight-test-wt"
  # Mock cloning repo
  cp -r "$3/"* "$HOME/kb-scratch/greenlight-test-wt/" 2>/dev/null || true
  cp -r "$3/.git" "$HOME/kb-scratch/greenlight-test-wt/"
  echo "$HOME/kb-scratch/greenlight-test-wt"
elif [ "$1" = "return" ]; then
  rm -rf "$HOME/kb-scratch/greenlight-test-wt"
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
if [[ "$*" == *"push origin main"* ]]; then
  touch "$HOME/kb-scratch/test-push.log"
  exit 0
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
run_id=$(ls -t "$HOME/kb-scratch/greenlight" | head -n 1)
state=$(cat "$HOME/kb-scratch/greenlight/$run_id/state")
[ "$state" = "landed" ] || fail "(a) empty-diff branch state=$state, expected landed"

# Add a commit for other tests
git checkout main >/dev/null 2>&1
git checkout -b feat-branch >/dev/null 2>&1
echo "test" > file.txt
git add file.txt
git commit -m "feat" >/dev/null 2>&1

# (b) canned review with an ask-user finding
export MOCK_CLAUDE_RESPONSE='{"result": "{\"findings\": [{\"id\": \"r1\", \"severity\": \"warning\", \"file\": \"file.txt\", \"line\": 1, \"description\": \"test\", \"action\": \"ask-user\"}], \"risk_level\": \"low\"}", "usage": {"input_tokens": 0, "output_tokens": 0}}'
rm -f "$HOME/kb-scratch/test-ntfy.log"
"$GREENLIGHT_BIN" run --branch feat-branch --repo "$TEST_REPO" >/dev/null 2>&1 || true
run_id=$(ls -t "$HOME/kb-scratch/greenlight" | head -n 1)
state=$(cat "$HOME/kb-scratch/greenlight/$run_id/state")
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
run_id=$(ls -t "$HOME/kb-scratch/greenlight" | head -n 1)
state=$(cat "$HOME/kb-scratch/greenlight/$run_id/state")
[ "$state" = "landed" ] || fail "(c) all-green state=$state, expected landed"
[ -f "$HOME/kb-scratch/test-push.log" ] || fail "(c) push not invoked"
# Check merge commit on stub main
git -C "$TEST_REPO" log --oneline | grep -q "greenlight: land green-branch" || fail "(c) merge commit not present on main"

# (d) canned risk_level: high all-green
export MOCK_CLAUDE_RESPONSE='{"result": "{\"findings\": [], \"risk_level\": \"high\", \"passed\": true, \"tested\": [], \"evidence\": [], \"updated\": [], \"unresolved\": []}", "usage": {"input_tokens": 0, "output_tokens": 0}}'
git checkout main >/dev/null 2>&1
git checkout -b high-risk-branch >/dev/null 2>&1
echo "high" > file3.txt
git add file3.txt
git commit -m "high" >/dev/null 2>&1
git checkout main >/dev/null 2>&1
"$GREENLIGHT_BIN" run --branch high-risk-branch --repo "$TEST_REPO" >/dev/null 2>&1 || true
run_id=$(ls -t "$HOME/kb-scratch/greenlight" | head -n 1)
state=$(cat "$HOME/kb-scratch/greenlight/$run_id/state")
[ "$state" = "parked" ] || fail "(d) high risk state=$state, expected parked"

# (e) --no-land green
export MOCK_CLAUDE_RESPONSE='{"result": "{\"findings\": [], \"risk_level\": \"low\", \"passed\": true, \"tested\": [], \"evidence\": [], \"updated\": [], \"unresolved\": []}", "usage": {"input_tokens": 0, "output_tokens": 0}}'
git checkout main >/dev/null 2>&1
git checkout -b noland-branch >/dev/null 2>&1
echo "noland" > file4.txt
git add file4.txt
git commit -m "noland" >/dev/null 2>&1
git checkout main >/dev/null 2>&1
"$GREENLIGHT_BIN" run --branch noland-branch --repo "$TEST_REPO" --no-land >/dev/null 2>&1 || true
run_id=$(ls -t "$HOME/kb-scratch/greenlight" | head -n 1)
state=$(cat "$HOME/kb-scratch/greenlight/$run_id/state")
[ "$state" = "parked" ] || fail "(e) no-land state=$state, expected parked"
grep -q "\-\-no-land" "$HOME/kb-scratch/greenlight/$run_id/parked-reason" || fail "(e) parked reason not --no-land"

echo "ALL TESTS PASSED"
