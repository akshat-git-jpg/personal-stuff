#!/usr/bin/env bash
# Invariant tests for the run-log contract: the status parser and the watcher
# must agree on every fixture, so a new executor or format tweak can't silently
# break recovery. Run after any change to runlog-status.sh, watch-run.sh, or
# the run-log format in plans/WORKFLOW.md.
#
# Usage: test-runlog.sh   (no args; exits 0 on all-pass, 1 on any failure)
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
FIX="$DIR/fixtures"
fail=0

check() { # <desc> <expected> <actual>
  if [ "$2" = "$3" ]; then
    echo "PASS: $1"
  else
    echo "FAIL: $1 — expected '$2', got '$3'"
    fail=1
  fi
}

# --- runlog-status.sh ---
check "clean run reads done"        "done"                       "$("$DIR/runlog-status.sh" "$FIX/clean.md")"
check "half-death names dead plan"  "dead 002"                   "$("$DIR/runlog-status.sh" "$FIX/halfdead.md")"
check "blocked names plan+reason"   "blocked 002: drift check failed — src/api.ts diverged from planned-at SHA" \
                                    "$("$DIR/runlog-status.sh" "$FIX/blocked.md")"
check "header-only reads not-started" "not-started"              "$("$DIR/runlog-status.sh" "$FIX/notstarted.md")"
check "missing file reads empty"    "empty"                      "$("$DIR/runlog-status.sh" "$FIX/does-not-exist.md")"

# --- watch-run.sh exit codes (fast poll; terminal fixtures return immediately) ---
WATCH_POLL=1 "$DIR/watch-run.sh" "$FIX/clean.md" 10;   check "watcher exits 0 on RUN DONE" "0" "$?"
WATCH_POLL=1 "$DIR/watch-run.sh" "$FIX/blocked.md" 10; check "watcher exits 2 on BLOCKED"  "2" "$?"
# Stale detection: copy the half-dead fixture, backdate its mtime past the timeout.
tmp="$(mktemp -d)/stale.md"
cp "$FIX/halfdead.md" "$tmp"
touch -t 202601010000 "$tmp"
WATCH_POLL=1 "$DIR/watch-run.sh" "$tmp" 1;             check "watcher exits 3 on stale heartbeat" "3" "$?"

if [ "$fail" -eq 0 ]; then echo "ALL PASS"; else echo "FAILURES"; exit 1; fi
