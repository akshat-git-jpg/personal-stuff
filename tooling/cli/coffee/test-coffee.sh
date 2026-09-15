#!/bin/bash
# test-coffee.sh — exercises the reconcile decision table against fakes.
# Nothing here touches a real power setting, a real sudo, or a real Telegram.

set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
PASS=0
FAIL=0

ok()  { echo "  PASS: $1"; PASS=$((PASS + 1)); }
bad() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

# Build a throwaway sandbox: fake pmset/sudo/notify/launchctl + a temp state dir.
setup() {
  SANDBOX="$(mktemp -d)"
  mkdir -p "$SANDBOX/bin" "$SANDBOX/state"

  # Fake pmset: logs its args; answers `-g batt` from FAKE_BATT_*.
  # Note `${FAKE_BATT_PCT-97}` (no colon): an explicitly empty value stays empty,
  # which is how the "unreadable battery" case is simulated.
  cat > "$SANDBOX/bin/pmset" <<'FAKE'
#!/bin/bash
if [ "${1:-}" = "-g" ] && [ "${2:-}" = "batt" ]; then
  echo "Now drawing from 'Battery Power'"
  echo " -InternalBattery-0 (id=1)	${FAKE_BATT_PCT-97}%; ${FAKE_BATT_STATE-discharging}; 6:54 remaining present: true"
  exit 0
fi
echo "$*" >> "$PMSET_LOG"
FAKE
  chmod +x "$SANDBOX/bin/pmset"

  # Fake sudo: drop the sudo, run the rest.
  printf '#!/bin/bash\nexec "$@"\n' > "$SANDBOX/bin/sudo"
  chmod +x "$SANDBOX/bin/sudo"

  # Fake notify: log the message (arg 1 is the "send" verb).
  printf '#!/bin/bash\nshift\necho "$*" >> "$NOTIFY_LOG"\n' > "$SANDBOX/bin/notify"
  chmod +x "$SANDBOX/bin/notify"

  # Fake launchctl: reports the watchdog as loaded. Overridden per-test.
  printf '#!/bin/bash\necho "123 0 com.kbtg.coffee-watchdog"\n' > "$SANDBOX/bin/launchctl"
  chmod +x "$SANDBOX/bin/launchctl"

  export PMSET_LOG="$SANDBOX/pmset.log"
  export NOTIFY_LOG="$SANDBOX/notify.log"
  : > "$PMSET_LOG"
  : > "$NOTIFY_LOG"

  export COFFEE_PMSET="$SANDBOX/bin/pmset"
  export COFFEE_SUDO="$SANDBOX/bin/sudo"
  export COFFEE_NOTIFY="$SANDBOX/bin/notify"
  export COFFEE_LAUNCHCTL="$SANDBOX/bin/launchctl"
  export COFFEE_STATE_DIR="$SANDBOX/state"
  export COFFEE_LOG="$SANDBOX/coffee.log"
  export COFFEE_BATT_FLOOR=20
  export COFFEE_MAX_SECONDS=14400
  export FAKE_BATT_PCT=97
  export FAKE_BATT_STATE=discharging
  export COFFEE_NOW=1000

  export COFFEE_SOURCE_ONLY=1
  . "$HERE/coffee-watchdog.sh"
}

teardown() { rm -rf "$SANDBOX"; }

# Last thing pmset was told to do: "0", "1", or "" if never called.
last_assert() { tail -1 "$PMSET_LOG" 2>/dev/null | awk '{print $NF}'; }

# Run the CLI against the sandbox. Sets CLI_OUT (stdout+stderr) and CLI_RC.
# Assigning in the current shell — a command substitution would swallow the
# exit code in a subshell.
CLI_OUT=""
CLI_RC=0
cli_run() {
  CLI_OUT="$(bash "$HERE/coffee" "$@" 2>&1)"
  CLI_RC=$?
}

echo "coffee watchdog — reconcile decision table"

# 1. No lease file -> assert sleep ON (value 0). The resting state.
setup
reconcile
[ "$(last_assert)" = "0" ] && ok "no lease -> sleep enabled" || bad "no lease -> sleep enabled (got '$(last_assert)')"
teardown

# 2. Valid unexpired lease, healthy battery -> hold it awake (value 1).
setup
echo 2000 > "$COFFEE_STATE_DIR/deadline"
reconcile
[ "$(last_assert)" = "1" ] && ok "valid lease -> stays awake" || bad "valid lease -> stays awake (got '$(last_assert)')"
teardown

# 3. Deadline passed -> revoke, and the lease file is gone.
setup
echo 900 > "$COFFEE_STATE_DIR/deadline"
reconcile
if [ "$(last_assert)" = "0" ] && [ ! -f "$COFFEE_STATE_DIR/deadline" ]; then
  ok "deadline passed -> revoked"
else
  bad "deadline passed -> revoked"
fi
teardown

# 4. Deadline passed -> the owner gets a phone ping.
setup
echo 900 > "$COFFEE_STATE_DIR/deadline"
reconcile
grep -q "time up" "$NOTIFY_LOG" && ok "revoke sends a notification" || bad "revoke sends a notification"
teardown

# 5. THE BATTERY FLOOR. Valid lease, but battery under the floor while
#    discharging -> revoke anyway.
setup
echo 9999 > "$COFFEE_STATE_DIR/deadline"
export FAKE_BATT_PCT=11 FAKE_BATT_STATE=discharging
reconcile
if [ "$(last_assert)" = "0" ] && grep -q "battery low" "$NOTIFY_LOG"; then
  ok "battery floor -> revoked"
else
  bad "battery floor"
fi
teardown

# 6. Low battery but PLUGGED IN -> keep the lease. Charging is not a hazard.
setup
echo 9999 > "$COFFEE_STATE_DIR/deadline"
export FAKE_BATT_PCT=11 FAKE_BATT_STATE=charging
reconcile
[ "$(last_assert)" = "1" ] && ok "low battery on AC -> lease held" || bad "low battery on AC -> lease held (got '$(last_assert)')"
teardown

# 7. Lease beyond the 4h ceiling -> refused outright, not clamped.
setup
echo 99999 > "$COFFEE_STATE_DIR/deadline"
reconcile
if [ "$(last_assert)" = "0" ] && grep -q "ceiling" "$NOTIFY_LOG"; then
  ok "over-ceiling lease -> refused"
else
  bad "over-ceiling lease -> refused"
fi
teardown

# 8. Corrupt lease file -> treated as no lease, sleep comes back.
setup
echo "not-a-number" > "$COFFEE_STATE_DIR/deadline"
reconcile
if [ "$(last_assert)" = "0" ] && [ ! -f "$COFFEE_STATE_DIR/deadline" ]; then
  ok "corrupt lease -> revoked"
else
  bad "corrupt lease -> revoked"
fi
teardown

# 9. Unreadable battery must not crash the tick; the deadline still governs.
setup
echo 2000 > "$COFFEE_STATE_DIR/deadline"
export FAKE_BATT_PCT= FAKE_BATT_STATE=
reconcile
[ "$(last_assert)" = "1" ] && ok "unreadable battery -> deadline still governs" || bad "unreadable battery (got '$(last_assert)')"
teardown

echo ""
echo "coffee CLI — durations, refusals, status"

setup

cli_run 90m
if [ "$CLI_RC" = "0" ] && [ "$(cat "$COFFEE_STATE_DIR/deadline")" = "6400" ]; then
  ok "coffee 90m -> deadline is now+5400"
else
  bad "coffee 90m -> deadline (rc=$CLI_RC out=$CLI_OUT)"
fi

cli_run 2h
[ "$(cat "$COFFEE_STATE_DIR/deadline")" = "8200" ] && ok "coffee 2h parses" || bad "coffee 2h parses"

cli_run 1h30m
[ "$(cat "$COFFEE_STATE_DIR/deadline")" = "6400" ] && ok "coffee 1h30m parses" || bad "coffee 1h30m parses"

cli_run 45
[ "$(cat "$COFFEE_STATE_DIR/deadline")" = "3700" ] && ok "coffee 45 (bare minutes) parses" || bad "coffee 45 parses"

cli_run status
echo "$CLI_OUT" | grep -q "ON . lid can stay shut" && ok "status shows an active lease" || bad "status shows an active lease (out=$CLI_OUT)"

# Refusal: over the ceiling.
cli_run 9h
if [ "$CLI_RC" != "0" ] && echo "$CLI_OUT" | grep -q "ceiling"; then
  ok "coffee 9h -> refused (over ceiling)"
else
  bad "coffee 9h -> refused (rc=$CLI_RC out=$CLI_OUT)"
fi

# Refusal: garbage duration.
cli_run banana
if [ "$CLI_RC" != "0" ] && echo "$CLI_OUT" | grep -q "cannot read the time"; then
  ok "coffee banana -> refused"
else
  bad "coffee banana -> refused (rc=$CLI_RC out=$CLI_OUT)"
fi

# Refusal: zero.
cli_run 0
[ "$CLI_RC" != "0" ] && ok "coffee 0 -> refused" || bad "coffee 0 -> refused"

# An over-ceiling or garbage request must not have disturbed the live lease.
[ "$(cat "$COFFEE_STATE_DIR/deadline")" = "3700" ] && ok "a refused request leaves the existing lease alone" || bad "a refused request leaves the existing lease alone"

# coffee off clears the lease.
cli_run 30m
cli_run off
[ ! -f "$COFFEE_STATE_DIR/deadline" ] && ok "coffee off clears the lease" || bad "coffee off clears the lease"

cli_run status
echo "$CLI_OUT" | grep -q "OFF" && ok "status shows OFF after stopping" || bad "status shows OFF after stopping (out=$CLI_OUT)"

teardown

# Refusal: watchdog NOT loaded -> coffee must refuse, not pretend.
setup
printf '#!/bin/bash\nexit 0\n' > "$SANDBOX/bin/launchctl"   # lists nothing
chmod +x "$SANDBOX/bin/launchctl"
cli_run 30m
if [ "$CLI_RC" != "0" ] && [ ! -f "$COFFEE_STATE_DIR/deadline" ] && echo "$CLI_OUT" | grep -q "not loaded"; then
  ok "watchdog missing -> coffee refuses the lease"
else
  bad "watchdog missing -> coffee refuses (rc=$CLI_RC out=$CLI_OUT)"
fi
teardown

echo ""
echo "passed: $PASS   failed: $FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo "SOME TESTS FAILED"
  exit 1
fi
echo "ALL PASS"
exit 0
