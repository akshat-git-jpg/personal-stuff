#!/bin/bash
# coffee-watchdog — enforces a bounded "keep awake with the lid shut" lease.
#
# Design: this loop NEVER reads the current pmset value. Every tick it decides
# what the value SHOULD be from the state file, then asserts it. That makes the
# resting state "sleep enabled": a missing state file, an expired deadline, a
# low battery, a crash, a reboot — all converge on sleep working normally.
#
# Turning sleep OFF requires this process to be alive AND a valid unexpired
# lease to exist. Nothing the owner forgets can leave the Mac awake.

set -u

COFFEE_PMSET="${COFFEE_PMSET:-/usr/bin/pmset}"
COFFEE_SUDO="${COFFEE_SUDO:-/usr/bin/sudo}"
COFFEE_NOTIFY="${COFFEE_NOTIFY:-/Users/kbtg/codebase/personal-stuff/tooling/cli/notify/notify}"
COFFEE_STATE_DIR="${COFFEE_STATE_DIR:-$HOME/.local/state/coffee}"
COFFEE_LOG="${COFFEE_LOG:-$HOME/Library/Logs/coffee.log}"
COFFEE_BATT_FLOOR="${COFFEE_BATT_FLOOR:-20}"
COFFEE_MAX_SECONDS="${COFFEE_MAX_SECONDS:-14400}"
COFFEE_TICK="${COFFEE_TICK:-20}"

DEADLINE_FILE="$COFFEE_STATE_DIR/deadline"
REASON_FILE="$COFFEE_STATE_DIR/last-reason"

mkdir -p "$COFFEE_STATE_DIR" 2>/dev/null
mkdir -p "$(dirname "$COFFEE_LOG")" 2>/dev/null

now() {
  if [ -n "${COFFEE_NOW:-}" ]; then echo "$COFFEE_NOW"; else date +%s; fi
}

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$COFFEE_LOG" 2>/dev/null
}

# Assert the power setting. $1 is 0 (sleep normally) or 1 (stay awake).
assert_sleep() {
  "$COFFEE_SUDO" "$COFFEE_PMSET" -a disablesleep "$1" >/dev/null 2>&1
}

# Echoes "<percent> <state>", e.g. "97 discharging".
# Falls back to "100 charged" when pmset output cannot be parsed, so an
# unreadable battery never forces an unwanted revoke mid-job; the deadline
# still bounds the lease either way.
battery() {
  local out pct state
  out="$("$COFFEE_PMSET" -g batt 2>/dev/null)"
  pct="$(echo "$out" | grep -o '[0-9][0-9]*%' | head -1 | tr -d '%')"
  # Substring order matters: "discharging" contains "charging".
  case "$out" in
    *discharging*)                     state="discharging" ;;
    *charging*|*charged*|*"AC Power"*) state="charging" ;;
    *)                                 state="" ;;
  esac
  if [ -z "$pct" ]; then pct=100; fi
  if [ -z "$state" ]; then state="charged"; fi
  echo "$pct $state"
}

# Clear the lease and tell the owner why.
revoke() {
  local reason="$1"
  assert_sleep 0
  rm -f "$DEADLINE_FILE"
  echo "$reason" > "$REASON_FILE"
  log "REVOKE ($reason) — sleep re-enabled"
  "$COFFEE_NOTIFY" send "coffee: sleep re-enabled ($reason). Your Mac will now sleep when you shut the lid." >/dev/null 2>&1
}

# One reconcile tick. Kept as a function so the test suite can call it directly
# without spinning the loop.
reconcile() {
  local n deadline batt batt_pct batt_state

  n="$(now)"

  # No lease file at all -> the resting state. Assert sleep, every tick.
  if [ ! -f "$DEADLINE_FILE" ]; then
    assert_sleep 0
    return 0
  fi

  deadline="$(cat "$DEADLINE_FILE" 2>/dev/null)"

  # A corrupt or non-numeric lease is not a lease.
  case "$deadline" in
    ''|*[!0-9]*) revoke "bad lease file"; return 0 ;;
  esac

  # A lease longer than the ceiling is refused outright, not clamped. Clamping
  # would silently grant most of a request that should have been denied.
  if [ "$((deadline - n))" -gt "$COFFEE_MAX_SECONDS" ]; then
    revoke "lease longer than the 4h ceiling"
    return 0
  fi

  if [ "$n" -ge "$deadline" ]; then
    revoke "time up"
    return 0
  fi

  batt="$(battery)"
  batt_pct="${batt%% *}"
  batt_state="${batt##* }"
  if [ "$batt_pct" -lt "$COFFEE_BATT_FLOOR" ] && [ "$batt_state" = "discharging" ]; then
    revoke "battery low ($batt_pct%)"
    return 0
  fi

  # Lease is valid. Hold it.
  assert_sleep 1
  return 0
}

main() {
  # Boot safety: whatever the machine was doing before this process existed,
  # start from sleep-enabled. A reboot therefore always clears a stuck setting.
  assert_sleep 0
  log "watchdog start (pid $$) — forced sleep on, now reconciling"
  while true; do
    reconcile
    sleep "$COFFEE_TICK"
  done
}

# Only run the loop when executed directly; sourcing with COFFEE_SOURCE_ONLY=1
# gives the test suite the functions without starting an infinite loop.
if [ "${COFFEE_SOURCE_ONLY:-0}" != "1" ]; then
  main
fi
