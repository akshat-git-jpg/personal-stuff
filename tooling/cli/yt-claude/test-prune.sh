#!/usr/bin/env bash
#
# Tests for prune.sh. The whole point of these is the REFUSAL cases: prune.sh
# runs unattended and deletes directories, so what it must NOT touch matters far
# more than what it does.
#
#   bash tooling/cli/yt-claude/test-prune.sh
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRUNE="$HERE/prune.sh"
fails=0

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; fails=$((fails + 1)); }

sandbox() {
  local t
  t="$(mktemp -d)"
  mkdir -p "$t/-C67yNY9bsM" "$t/zgo4gHqqVY8" "$t/w21XAsgoQ5o" \
           "$t/pinterest-mcp/bin" "$t/pending"
  printf 'transcript\n' > "$t/-C67yNY9bsM/transcript.txt"
  printf 'binary\n'     > "$t/pinterest-mcp/bin/binary"
  printf 'job\n'        > "$t/pending/job.json"
  printf 'log\n'        > "$t/extension.log"
  # Age everything except one video folder well past the default 30 days.
  touch -t 202606201200 "$t/-C67yNY9bsM" "$t/zgo4gHqqVY8" \
                        "$t/pinterest-mcp" "$t/pending" "$t/extension.log"
  printf '%s' "$t"
}

# --- (1) a dry run deletes nothing -------------------------------------------
T="$(sandbox)"
YT_CLAUDE_DIR="$T" bash "$PRUNE" --dry-run >/dev/null 2>&1
[ -d "$T/-C67yNY9bsM" ] && pass "dry run leaves stale folders alone" \
                        || fail "dry run deleted something"

# --- (2) stale video folders go ----------------------------------------------
T="$(sandbox)"
YT_CLAUDE_DIR="$T" bash "$PRUNE" >/dev/null 2>&1
[ ! -d "$T/-C67yNY9bsM" ] && [ ! -d "$T/zgo4gHqqVY8" ] \
  && pass "stale video folders are removed" \
  || fail "stale video folders survived"

# --- (3) a fresh video folder stays ------------------------------------------
[ -d "$T/w21XAsgoQ5o" ] && pass "a fresh video folder is kept" \
                        || fail "a fresh video folder was deleted"

# --- (4) THE IMPORTANT ONE: non-video dirs are never touched -----------------
if [ -f "$T/pinterest-mcp/bin/binary" ] && [ -f "$T/pending/job.json" ]; then
  pass "pinterest-mcp/ and pending/ are untouched even when old"
else
  fail "prune ate a non-video directory"
fi

# --- (5) loose files are never touched ---------------------------------------
[ -f "$T/extension.log" ] && pass "loose files are untouched" \
                          || fail "prune deleted a loose file"

# --- (6) a name that is not exactly 11 chars is ignored ----------------------
T="$(sandbox)"
mkdir -p "$T/short" "$T/waytoolongforavideoid"
touch -t 202606201200 "$T/short" "$T/waytoolongforavideoid"
YT_CLAUDE_DIR="$T" bash "$PRUNE" >/dev/null 2>&1
[ -d "$T/short" ] && [ -d "$T/waytoolongforavideoid" ] \
  && pass "wrong-length directory names are ignored" \
  || fail "prune matched a non-video-id name"

# --- (7) YT_PRUNE_DAYS is honoured -------------------------------------------
T="$(sandbox)"
out="$(YT_CLAUDE_DIR="$T" YT_PRUNE_DAYS=9999 bash "$PRUNE" 2>&1)"
case "$out" in
  *"nothing older than 9999d"*) pass "YT_PRUNE_DAYS widens the window" ;;
  *) fail "YT_PRUNE_DAYS ignored: $out" ;;
esac

# --- (8) a non-numeric window is refused, not guessed ------------------------
T="$(sandbox)"
YT_CLAUDE_DIR="$T" YT_PRUNE_DAYS=abc bash "$PRUNE" >/dev/null 2>&1
rc=$?
[ "$rc" -ne 0 ] && [ -d "$T/-C67yNY9bsM" ] \
  && pass "a non-numeric YT_PRUNE_DAYS exits non-zero and deletes nothing" \
  || fail "a bad YT_PRUNE_DAYS was tolerated (rc=$rc)"

# --- (9) a missing root is not an error --------------------------------------
YT_CLAUDE_DIR="/nonexistent/yt-claude-$$" bash "$PRUNE" >/dev/null 2>&1
[ $? -eq 0 ] && pass "a missing root exits 0" || fail "a missing root errored"

echo
if [ "$fails" -eq 0 ]; then
  echo "ALL TESTS PASSED"
  exit 0
fi
echo "$fails TEST(S) FAILED"
exit 1
