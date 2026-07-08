#!/bin/bash
# boss-state.sh [<pr#>] — status of one/all in-flight PRs. No model calls.
source "$(dirname "${BASH_SOURCE[0]}")/boss-lib.sh"
report() {
  local pr="$1"; [ -f "$STATE_DIR/$1.meta" ] || return
  local ex; ex=$(meta_get "$pr" executor)
  "$BOSS_HOME/executors/$ex.sh" alive "$pr"; local a=$?
  local live=working; [ $a -eq 1 ] && live=idle/done; [ $a -eq 2 ] && live=dead
  # A live PID only proves existence, not progress. When the executor says it's
  # working, fingerprint CPU/HEAD/output: no movement past the thresholds reports
  # STALLED and eventually kills the hung tree (→ dead → one-fix-up → blocked).
  [ "$live" = working ] && live=$(boss_stall_check "$pr")
  local c; c=$("$BOSS_HOME/executors/$ex.sh" collect "$pr" 2>/dev/null)
  echo "PR#$pr  $ex  alive=$live  collect=[$c]"
}
if [ -n "${1:-}" ]; then report "$1"; else
  for m in "$STATE_DIR"/*.meta; do [ -e "$m" ] || continue; report "$(basename "$m" .meta)"; done
fi
