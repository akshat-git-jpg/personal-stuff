#!/bin/bash
# Self-test for the captain toolkit. Stubs wt/tmux/claude/greenlight on PATH
# and CAP_LAUNCH_CMD=echo — the real `claude` binary is NEVER launched here.
set -uo pipefail

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

CAPDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

STUB_DIR="$TMP/stub"
mkdir -p "$STUB_DIR"

WT_DIR="$TMP/wt-pool"
mkdir -p "$WT_DIR"

TMUX_STATE="$TMP/tmux-state"
mkdir -p "$TMUX_STATE"

# --- stub: wt ---------------------------------------------------------
cat > "$STUB_DIR/wt" <<'EOF'
#!/bin/bash
LOG="$CAP_TEST_WT_LOG"
echo "$*" >> "$LOG"
if [ "$1" = "get" ]; then
  # --holder <label> --repo <path>
  holder=""
  args=("$@")
  for ((i = 0; i < ${#args[@]}; i++)); do
    if [ "${args[$i]}" = "--holder" ]; then holder="${args[$((i + 1))]}"; fi
  done
  d="$CAP_TEST_WT_DIR/$holder"
  mkdir -p "$d"
  git init -q "$d" 2>/dev/null || true
  git -C "$d" commit -q --allow-empty -m init 2>/dev/null || true
  echo "$d"
elif [ "$1" = "return" ]; then
  echo "returned:$2" >> "$CAP_TEST_WT_RETURN_LOG"
fi
EOF
chmod +x "$STUB_DIR/wt"

# --- stub: tmux ---------------------------------------------------------
# State-file driven: window-<name> marks a window as existing,
# pane-<name>.txt holds the "pane content" alive() greps for.
cat > "$STUB_DIR/tmux" <<'EOF'
#!/bin/bash
STATE="$CAP_TEST_TMUX_STATE"
mkdir -p "$STATE"
find_flag() {
  local flag="$1"; shift
  local args=("$@")
  for ((i = 0; i < ${#args[@]}; i++)); do
    if [ "${args[$i]}" = "$flag" ]; then echo "${args[$((i + 1))]}"; return 0; fi
  done
}
case "$1" in
  has-session) [ -f "$STATE/session" ] && exit 0 || exit 1 ;;
  new-session) touch "$STATE/session"; exit 0 ;;
  new-window)
    shift
    name=$(find_flag -n "$@")
    touch "$STATE/window-$name"
    exit 0 ;;
  send-keys)
    shift
    echo "$*" >> "$STATE/send-keys.log"
    exit 0 ;;
  capture-pane)
    shift
    target=$(find_flag -t "$@")
    win="${target#*:}"
    [ -f "$STATE/window-$win" ] || exit 1
    cat "$STATE/pane-$win.txt" 2>/dev/null
    exit 0 ;;
  kill-window)
    shift
    target=$(find_flag -t "$@")
    win="${target#*:}"
    rm -f "$STATE/window-$win"
    exit 0 ;;
  list-windows)
    shift
    for w in "$STATE"/window-*; do
      [ -e "$w" ] || continue
      basename "$w" | sed 's/^window-//'
    done
    exit 0 ;;
  *) exit 0 ;;
esac
EOF
chmod +x "$STUB_DIR/tmux"

# --- stub: claude (never the real binary) ------------------------------
cat > "$STUB_DIR/claude" <<'EOF'
#!/bin/bash
echo '{"result": "stubbed claude output"}'
EOF
chmod +x "$STUB_DIR/claude"

# --- stub: greenlight (not exercised by this test, present so PATH is complete)
cat > "$STUB_DIR/greenlight" <<'EOF'
#!/bin/bash
echo "stub greenlight: $*"
EOF
chmod +x "$STUB_DIR/greenlight"

export PATH="$STUB_DIR:$PATH"
export CAP_LAUNCH_CMD="echo"
export CAP_TEST_WT_DIR="$WT_DIR"
export CAP_TEST_WT_LOG="$TMP/wt.log"
export CAP_TEST_WT_RETURN_LOG="$TMP/wt-return.log"
: > "$CAP_TEST_WT_LOG"
: > "$CAP_TEST_WT_RETURN_LOG"
export CAP_TEST_TMUX_STATE="$TMUX_STATE"

CAPTAIN_HOME="$TMP/home"
mkdir -p "$CAPTAIN_HOME/state/archive"
export CAPTAIN_HOME

BIN="$CAPDIR/bin"
LANES="$CAPDIR/lanes.d"

mk_brief() {
  mkdir -p "$CAPTAIN_HOME/data/$1"
  echo "test brief for $1" > "$CAPTAIN_HOME/data/$1/brief.md"
}

# ------------------------------------------------------------------
# (a) spawn writes meta + calls lane dispatch with the brief
# ------------------------------------------------------------------
mk_brief "ta"
out=$("$BIN/cap-spawn.sh" ta /fake/project --lane claude-tmux 2>&1) || fail "(a) spawn failed: $out"
[ -f "$CAPTAIN_HOME/state/ta.meta" ] || fail "(a) no meta file written"
grep -q "^lane=claude-tmux" "$CAPTAIN_HOME/state/ta.meta" || fail "(a) meta missing lane"
grep -q "^worktree=" "$CAPTAIN_HOME/state/ta.meta" || fail "(a) meta missing worktree"
[ -f "$TMUX_STATE/window-cap-ta" ] || fail "(a) lane dispatch did not create tmux window"
grep -q "cap-ta" "$CAP_TEST_WT_LOG" || fail "(a) wt get was not called with holder cap-ta"

# ------------------------------------------------------------------
# (b) duplicate id refused
# ------------------------------------------------------------------
set +e
"$BIN/cap-spawn.sh" ta /fake/project --lane claude-tmux >/dev/null 2>&1
rc=$?
set -e
[ "$rc" -ne 0 ] || fail "(b) duplicate id was not refused"

# ------------------------------------------------------------------
# (c) spawn without a brief fails loudly
# ------------------------------------------------------------------
set +e
err=$("$BIN/cap-spawn.sh" tc /fake/project --lane claude-tmux 2>&1)
rc=$?
set -e
[ "$rc" -ne 0 ] || fail "(c) spawn without brief did not fail"
echo "$err" | grep -qi "brief" || fail "(c) failure message did not mention brief: $err"
[ ! -f "$CAPTAIN_HOME/state/tc.meta" ] || fail "(c) meta file written despite missing brief"

# ------------------------------------------------------------------
# (d) cap-state reports done when the stub marks turn-ended and not-busy
# ------------------------------------------------------------------
echo "" > "$TMUX_STATE/pane-cap-ta.txt"          # idle pane
marker=$(grep "^marker=" "$CAPTAIN_HOME/state/ta.meta" | cut -d= -f2)
touch "$marker"                                   # turn ended after dispatch
state_line=$("$BIN/cap-state.sh" ta)
echo "$state_line" | grep -q " done " || fail "(d) expected done, got: $state_line"

# ------------------------------------------------------------------
# (e) teardown refuses while busy, succeeds with --force, returns the lease
# ------------------------------------------------------------------
echo "Working..." > "$TMUX_STATE/pane-cap-ta.txt"  # busy pane
set +e
"$BIN/cap-teardown.sh" ta >/dev/null 2>&1
rc=$?
set -e
[ "$rc" -ne 0 ] || fail "(e) teardown while busy was not refused"

out=$("$BIN/cap-teardown.sh" ta --force 2>&1) || fail "(e) teardown --force failed: $out"
[ -f "$CAPTAIN_HOME/state/archive/ta.meta" ] || fail "(e) meta not archived after teardown"
[ ! -f "$CAPTAIN_HOME/state/ta.meta" ] || fail "(e) meta still present after teardown"
grep -q "returned:" "$CAP_TEST_WT_RETURN_LOG" || fail "(e) wt return was not called"

# ------------------------------------------------------------------
# (f) wake-queue gets exactly one line per state change (absorb rule)
# ------------------------------------------------------------------
mk_brief "tf"
"$BIN/cap-spawn.sh" tf /fake/project --lane claude-tmux >/dev/null 2>&1 || fail "(f) spawn tf failed"
echo "Working..." > "$TMUX_STATE/pane-cap-tf.txt"

CAP_WATCH_ONCE=1 "$BIN/cap-watch.sh"
[ ! -s "$CAPTAIN_HOME/state/.wake-queue" ] || fail "(f) wake-queue got a line while busy"

CAP_WATCH_ONCE=1 "$BIN/cap-watch.sh"   # no change, still busy
[ ! -s "$CAPTAIN_HOME/state/.wake-queue" ] || fail "(f) wake-queue got a line on unchanged busy state"

echo "" > "$TMUX_STATE/pane-cap-tf.txt"
marker_tf=$(grep "^marker=" "$CAPTAIN_HOME/state/tf.meta" | cut -d= -f2)
touch "$marker_tf"
CAP_WATCH_ONCE=1 "$BIN/cap-watch.sh"
lines=$(wc -l < "$CAPTAIN_HOME/state/.wake-queue" | tr -d ' ')
[ "$lines" -eq 1 ] || fail "(f) expected exactly 1 wake-queue line after the state change, got $lines"

CAP_WATCH_ONCE=1 "$BIN/cap-watch.sh"   # no further change
lines=$(wc -l < "$CAPTAIN_HOME/state/.wake-queue" | tr -d ' ')
[ "$lines" -eq 1 ] || fail "(f) wake-queue grew on an unchanged done state, got $lines lines"

"$BIN/cap-teardown.sh" tf --force >/dev/null 2>&1 || fail "(f) cleanup teardown of tf failed"

# ------------------------------------------------------------------
# (g) antigravity lane's alive check uses mtime/git fallback
#     (stale run-log + fresh file mtime -> alive)
# ------------------------------------------------------------------
ag_worktree="$TMP/ag-worktree"
mkdir -p "$ag_worktree"
git init -q "$ag_worktree"
GIT_AUTHOR_DATE="2026-01-01T00:00:00" GIT_COMMITTER_DATE="2026-01-01T00:00:00" \
  git -C "$ag_worktree" commit -q --allow-empty -m init

ag_runlog="$TMP/ag-runlog.md"
echo "## RUN tg" > "$ag_runlog"
touch -t 202601010000 "$ag_runlog"          # stale run-log mtime

cat > "$CAPTAIN_HOME/state/tg.meta" <<EOF
id=tg
lane=antigravity
project=/fake/project
worktree=$ag_worktree
model=sonnet
created=2026-07-06T00:00:00Z
runlog=$ag_runlog
dispatched_at=$(($(date +%s) - 3600))
EOF

touch "$ag_worktree/fresh-file.txt"          # fresh file mtime -> alive

"$LANES/antigravity.sh" alive tg
rc=$?
[ "$rc" -eq 0 ] || fail "(g) antigravity alive should be 0 (mtime fallback), got $rc"

# Now go genuinely stale (old file mtimes, old commit, stale run-log) -> not alive.
touch -t 202601010000 "$ag_worktree/fresh-file.txt"
set +e
"$LANES/antigravity.sh" alive tg
rc=$?
set -e
[ "$rc" -ne 0 ] || fail "(g) antigravity alive should NOT be 0 once all signals are stale"

rm -f "$CAPTAIN_HOME/state/tg.meta"

echo "ALL TESTS PASSED"

# ------------------------------------------------------------------
# Live smoke (optional): a real tmux window driven end-to-end with
# CAP_LAUNCH_CMD=echo. Only runs if tmux is actually installed; never
# installs tmux itself. Uses a dedicated tmux session name so it can't
# collide with (or disturb) a real captain session.
# ------------------------------------------------------------------
REAL_TMUX="$(PATH="${PATH#"$STUB_DIR:"}" command -v tmux 2>/dev/null || true)"
if [ -z "$REAL_TMUX" ]; then
  echo "SKIP: tmux not installed"
  exit 0
fi

LIVE_HOME="$TMP/live-home"
mkdir -p "$LIVE_HOME/state/archive" "$LIVE_HOME/data/live1"
echo "echo live smoke brief" > "$LIVE_HOME/data/live1/brief.md"
live_wt="$TMP/live-worktree"
mkdir -p "$live_wt"

live_path="$TMP/live-path"
mkdir -p "$live_path"
ln -sf "$REAL_TMUX" "$live_path/tmux"
ln -sf "$(command -v echo)" "$live_path/wt-unused" 2>/dev/null || true

cat > "$live_path/wt" <<EOF
#!/bin/bash
if [ "\$1" = "get" ]; then echo "$live_wt"; fi
EOF
chmod +x "$live_path/wt"

CAP_TMUX_SESSION="captain-test-$$"
export CAP_TMUX_SESSION
trap '"$REAL_TMUX" kill-session -t "$CAP_TMUX_SESSION" 2>/dev/null || true; rm -rf "$TMP"' EXIT

(
  export PATH="$live_path:$PATH"
  export CAPTAIN_HOME="$LIVE_HOME"
  export CAP_LAUNCH_CMD="echo"
  "$BIN/cap-spawn.sh" live1 /fake/project --lane claude-tmux
)

sleep 1
if "$REAL_TMUX" has-session -t "$CAP_TMUX_SESSION" 2>/dev/null; then
  echo "LIVE SMOKE OK: tmux session '$CAP_TMUX_SESSION' window 'cap-live1' created"
else
  echo "LIVE SMOKE FAILED: tmux session was not created" >&2
  exit 1
fi
