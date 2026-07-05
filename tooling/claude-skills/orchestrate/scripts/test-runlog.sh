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

# --- round-awareness: only the segment after the last ROUND N START counts ---
check "round2 in-flight not poisoned by round1 BLOCKED" "dead 013" "$("$DIR/runlog-status.sh" "$FIX/round2-inflight.md")"
check "round2 done reads done despite round1 BLOCKED"   "done"     "$("$DIR/runlog-status.sh" "$FIX/round2-done.md")"
check "round2 blocked reads round2's reason" "blocked 012: still failing after fix" \
                                    "$("$DIR/runlog-status.sh" "$FIX/round2-blocked.md")"
check "round2 marker w/o pickup reads not-started" "not-started"  "$("$DIR/runlog-status.sh" "$FIX/round2-notpickedup.md")"

# --- watch-run.sh exit codes (fast poll; terminal fixtures return immediately) ---
WATCH_POLL=1 "$DIR/watch-run.sh" "$FIX/clean.md" 10;   check "watcher exits 0 on RUN DONE" "0" "$?"
WATCH_POLL=1 "$DIR/watch-run.sh" "$FIX/blocked.md" 10; check "watcher exits 2 on BLOCKED"  "2" "$?"
WATCH_POLL=1 "$DIR/watch-run.sh" "$FIX/round2-done.md" 10;    check "watcher exits 0 on round2 RUN DONE"   "0" "$?"
WATCH_POLL=1 "$DIR/watch-run.sh" "$FIX/round2-blocked.md" 10; check "watcher exits 2 on round2 BLOCKED"    "2" "$?"
WATCH_POLL=1 WATCH_APPEAR_SEC=2 "$DIR/watch-run.sh" "$FIX/round2-notpickedup.md" 10; \
                                                       check "watcher exits 4 when round never picked up" "4" "$?"
# Stale detection: copy the half-dead fixture, backdate its mtime past the timeout.
tmpd="$(mktemp -d)"
cp "$FIX/halfdead.md" "$tmpd/stale.md"
touch -t 202601010000 "$tmpd/stale.md"
WATCH_POLL=1 "$DIR/watch-run.sh" "$tmpd/stale.md" 1;   check "watcher exits 3 on stale heartbeat" "3" "$?"
# Same for a stale round-2: round1 BLOCKED must not mask round2 death.
cp "$FIX/round2-inflight.md" "$tmpd/stale2.md"
touch -t 202601010000 "$tmpd/stale2.md"
WATCH_POLL=1 "$DIR/watch-run.sh" "$tmpd/stale2.md" 1;  check "watcher exits 3 on stale round2 (not 2)" "3" "$?"
rm -rf "$tmpd"

if [ "$fail" -eq 0 ]; then echo "ALL PASS"; else echo "FAILURES"; exit 1; fi
