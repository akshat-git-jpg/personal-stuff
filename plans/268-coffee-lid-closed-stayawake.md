---
executor: agy
model:
test_cmd: bash tooling/cli/coffee/test-coffee.sh
ui:
deploy:
needs: []
needs_plans: []
needs_prs: []
touches: [tooling/cli/coffee/coffee, tooling/cli/coffee/coffee-watchdog.sh, tooling/cli/coffee/com.kbtg.coffee-watchdog.plist, tooling/cli/coffee/test-coffee.sh, tooling/cli/coffee/README.md, tooling/cli/coffee/sudoers.d-coffee.example, MAC-LAUNCHD.md, tooling/cli/README.md]
mutation_apply: |
  perl -0pi -e 's/^(\s*)if \[ "\$batt_pct" -lt "\$COFFEE_BATT_FLOOR" \] && \[ "\$batt_state" = "discharging" \]; then$/$1if false; then/m' tooling/cli/coffee/coffee-watchdog.sh
mutation_command: bash tooling/cli/coffee/test-coffee.sh
mutation_expect: "FAIL: battery floor"
---

# Plan 268 — `coffee`: keep the Mac awake with the lid shut, and make it impossible to leave on

> **Executor instructions**
> 1. Read this whole file before touching anything.
> 2. **Drift check** — run this first:
>    `git diff --stat b53b518b..HEAD -- tooling/cli/ MAC-LAUNCHD.md`
>    If it reports changes to `tooling/cli/coffee/` or to the `MAC-LAUNCHD.md`
>    job table, STOP and report. Any other output is fine.
> 3. Work the steps in order. Run every **Verify** before moving on.
> 4. Honor the STOP conditions literally.
> 5. Do **not** push. Do **not** run `sudo` anywhere. Do **not** install the
>    launchd agent or the sudoers file — those are owner-only steps listed at
>    the bottom.

## Summary

**Problem statement.** Closing the MacBook lid puts it to sleep, which kills any
long-running Claude Code job. The blunt fix (`sudo pmset -a disablesleep 1`) is
a persistent system setting with no expiry: forget it once and the Mac cooks in
a bag, flattens its battery, and never sleeps again.

**Goals.**
- One command, `coffee 90m`, keeps the Mac awake with the lid shut for a bounded time.
- The "on" state can only be held by a live watchdog. Every failure path lands on
  "sleep works normally" — reboot, crash, kill, missing state file, all of it.
- Three independent auto-off triggers: deadline passed, battery below floor, no
  valid session.
- A Telegram ping whenever it auto-offs, so the owner learns the job is unprotected.
- A hard 4-hour ceiling. There is no "forever" option to forget.

**Decisions confirmed** (owner, 2026-09-15):
- Safety nets -> all four: deadline, battery floor, watchdog-dies, phone ping.
- Admin password -> a single scoped `/etc/sudoers.d/` rule for `pmset` only.
- Switch on -> explicit command, named **`coffee`** (owner's pick): `coffee 90m`,
  `coffee off`, `coffee` for status.
- Auto-detecting "is a Claude job running" -> **rejected**, too easy to guess wrong.

**Executor proposed.** `agy` / Gemini 3.1 Pro (High). Fully inlined shell work with
a real test suite; matches `tooling/boss/data/rules.md` default.

**Done criteria.** `bash tooling/cli/coffee/test-coffee.sh` exits 0 with every case
passing, against a fake `pmset` — no real power setting is touched by the tests.

**Stop conditions.** Any need to run `sudo`, install a launchd agent, or edit
`/etc/sudoers.d/` -> STOP, that is owner-only.

**Test / verification for success.** A bash test suite that injects a fake `pmset`,
a fake `sudo`, a fake `notify` and a fake battery reading, then asserts the
watchdog's reconcile decision in each state. Refusal cases are the point.

**Open points for plan readiness.** None.

---

- **Priority**: P2
- **Effort**: M
- **Risk**: MED — the tool changes a system power setting. Mitigated by making
  the tests run entirely against fakes and keeping every privileged install step
  owner-only.
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `b53b518b`, 2026-09-15

## Why this matters

The owner runs long Claude Code jobs and wants to shut the lid and walk away.
macOS has exactly one switch for this (`pmset -a disablesleep`), and it is a
persistent global with no timeout — the same property that makes it work is what
makes it dangerous. The owner's stated fear is not "will it work", it is "what if
I forget to turn it off".

So the design inverts the default. `disablesleep = 0` is the resting state, and
it is **re-asserted every 20 seconds** by a watchdog. Staying awake is not a
setting you flip; it is a lease a live process holds, with an expiry it cannot
exceed. Nothing the owner forgets to do can leave the Mac awake, because leaving
it awake requires something to keep actively saying so.

That intent is what should guide any judgment call in this plan: **when in doubt,
fail toward sleep.**

## Current state

### Nothing exists yet

`grep -rniE "disablesleep|caffeinate|clamshell" --include="*.md" --include="*.sh" .`
returns nothing outside `node_modules`. This is greenfield.

### Machine facts (verified on the owner's Mac, 2026-09-15)

| Fact | Value |
|---|---|
| Model | `Mac14,9` (MacBook Pro 14", Apple M2 Pro) |
| Username | `kbtg` |
| `pmset` | `/usr/bin/pmset` |
| `sudo` | `/usr/bin/sudo` |
| `jq` | `/usr/bin/jq` (present, but this plan does not need it) |
| `/bin/bash` | **GNU bash 3.2.57** — macOS system bash |
| Current `disablesleep` | unset (normal sleep) |

**Bash 3.2 is a hard constraint.** No associative arrays (`declare -A`), no
`${var,,}` case conversion, no `mapfile`, no `&>>`. Scripts must run under
`/bin/bash` 3.2. Write `#!/bin/bash` shebangs, not `#!/usr/bin/env bash`.

### Real `pmset -g batt` output on this machine

```
Now drawing from 'Battery Power'
 -InternalBattery-0 (id=23265379)	97%; discharging; 6:54 remaining present: true
```

On AC the first line reads `Now drawing from 'AC Power'` and the state word is
`charging` or `charged`.

### Exemplar to match: `tooling/cli/bt-audio-guard/`

The closest existing tool — a persistent launchd watcher with a shell CLI. It
holds three files, exactly the shape this plan uses:

```
tooling/cli/bt-audio-guard/
  README.md
  bt-audio-guard.sh
  com.kbtg.bt-audio-guard.plist
```

Its plist, reproduced in full, is the template for this plan's plist:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.kbtg.bt-audio-guard</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/kbtg/.local/bin/bt-audio-guard.sh</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>ProcessType</key>
    <string>Background</string>
    <key>LowPriorityIO</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/dev/null</string>
    <key>StandardErrorPath</key>
    <string>/tmp/bt-audio-guard.err</string>
</dict>
</plist>
```

Note the pattern: the plist points at a **symlink in `~/.local/bin/`**, not at the
repo path. `MAC-LAUNCHD.md` explains why (three consumers share one path while the
real file stays in git). This plan follows the same pattern.

### The notify CLI

`tooling/cli/notify/notify` — executable, already in the repo. Contract from its
README:

```
notify send "<message>"   # exit 0 sent, 3 undeliverable, 2 usage error
```

It never crashes its caller: a Telegram failure prints a `WARN` to stderr and
exits 3. **It is not on `PATH` in a launchd environment**, so the watchdog must
call it by absolute path, with an env override for tests.

### Testability convention this plan introduces

Every privileged or environment-dependent call goes through an overridable
variable, so the test suite can inject fakes and never touch the real system:

| Variable | Default | What the tests inject |
|---|---|---|
| `COFFEE_PMSET` | `/usr/bin/pmset` | a fake that logs its args to a file |
| `COFFEE_SUDO` | `/usr/bin/sudo` | a fake that just `exec "$@"` |
| `COFFEE_NOTIFY` | `/Users/kbtg/codebase/personal-stuff/tooling/cli/notify/notify` | a fake that logs the message |
| `COFFEE_STATE_DIR` | `$HOME/.local/state/coffee` | a temp dir |
| `COFFEE_LOG` | `$HOME/Library/Logs/coffee.log` | a temp file |
| `COFFEE_BATT_FLOOR` | `20` | varied per test case |
| `COFFEE_MAX_SECONDS` | `14400` (4h) | varied per test case |
| `COFFEE_NOW` | unset (means "use `date +%s`") | a fixed epoch, to test the deadline |

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Drift check | `git diff --stat b53b518b..HEAD -- tooling/cli/ MAC-LAUNCHD.md` | no `tooling/cli/coffee/` lines |
| Run the test suite | `bash tooling/cli/coffee/test-coffee.sh` | exit 0, prints `ALL PASS` |
| Shell syntax check | `bash -n tooling/cli/coffee/coffee && bash -n tooling/cli/coffee/coffee-watchdog.sh && bash -n tooling/cli/coffee/test-coffee.sh` | exit 0, no output |
| Validate the plist | `plutil -lint tooling/cli/coffee/com.kbtg.coffee-watchdog.plist` | `OK` |
| Check exec bits | `test -x tooling/cli/coffee/coffee && test -x tooling/cli/coffee/coffee-watchdog.sh && echo ok` | `ok` |

## Scope

**In scope** — the only files you may create or edit:
- `tooling/cli/coffee/coffee` (new)
- `tooling/cli/coffee/coffee-watchdog.sh` (new)
- `tooling/cli/coffee/com.kbtg.coffee-watchdog.plist` (new)
- `tooling/cli/coffee/sudoers.d-coffee.example` (new)
- `tooling/cli/coffee/test-coffee.sh` (new)
- `tooling/cli/coffee/README.md` (new)
- `MAC-LAUNCHD.md` (edit: add rows to the two tables and an install block line)
- `tooling/cli/README.md` (edit: add one row for `coffee`)
- `plans/README.md` (edit: flip this plan's status row)

**Out of scope** — looks related, do not touch:
- `tooling/cli/bt-audio-guard/` — the exemplar only. Copy its shape, change nothing in it.
- `tooling/cli/notify/` — called, never modified.
- `~/.zshrc`, `~/Library/LaunchAgents/`, `/etc/sudoers.d/` — machine-local, owner-only.
- `decisions.md` — the owner appends this after review, not the executor.
- `INFRA.md`, `my-hosted-sites.md`, `apps/kushal-tools/` — nothing here becomes reachable at a URL.

## Git workflow

- Branch: `advisor/268-coffee-lid-closed-stayawake`
- Commit: `feat(coffee): bounded lid-closed stayawake` — one line, no body, no AI footers.
- Do **not** push.

## Steps

### Step 1: Create the watchdog — `tooling/cli/coffee/coffee-watchdog.sh`

This is the heart of the plan. **Write it exactly as given.** The reconcile logic
below is the intelligence-heavy part; do not restructure it.

The design in one sentence: *the watchdog never reads the current power setting —
it re-asserts the correct one every 20 seconds, so the resting state is always
"sleep works".*

```bash
#!/bin/bash
# coffee-watchdog — enforces a bounded "keep awake with the lid shut" lease.
#
# Design: this loop NEVER reads the current pmset value. Every tick it decides
# what the value SHOULD be from the state file, then asserts it. That makes the
# resting state "sleep enabled": a missing state file, an expired deadline, a
# low battery, a crash, a reboot — all converge on sleep working normally.
#
# Turning sleep OFF requires this process to be alive and a valid unexpired
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

# Echoes "<percent> <state>", e.g. "97 discharging". Falls back to "100 charged"
# if pmset output cannot be parsed, so an unreadable battery never forces an
# unwanted wake-off mid-job; the deadline still bounds the lease.
battery() {
  local out pct state
  out="$("$COFFEE_PMSET" -g batt 2>/dev/null)"
  pct="$(echo "$out" | grep -o '[0-9][0-9]*%' | head -1 | tr -d '%')"
  state="$(echo "$out" | grep -o 'discharging\|charging\|charged\|finishing charge' | head -1)"
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

# --- One reconcile tick. Exported as a function so the test suite can call it
# --- directly without spinning the loop.
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
  # would silently grant most of a request the owner should not have made.
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

# Only run the loop when executed directly; sourcing gives the test suite the
# functions without starting an infinite loop.
if [ "${COFFEE_SOURCE_ONLY:-0}" != "1" ]; then
  main
fi
```

**Verify**: `bash -n tooling/cli/coffee/coffee-watchdog.sh` -> exit 0, no output.

### Step 2: Create the CLI — `tooling/cli/coffee/coffee`

```bash
#!/bin/bash
# coffee — ask for a bounded "stay awake with the lid shut" lease.
#
# The CLI only writes a deadline file. It never changes a power setting itself.
# The watchdog (com.kbtg.coffee-watchdog) is what acts on it, and what takes it
# away again. If the watchdog is not running, coffee refuses to pretend.

set -u

COFFEE_STATE_DIR="${COFFEE_STATE_DIR:-$HOME/.local/state/coffee}"
COFFEE_MAX_SECONDS="${COFFEE_MAX_SECONDS:-14400}"
COFFEE_LABEL="${COFFEE_LABEL:-com.kbtg.coffee-watchdog}"
COFFEE_LAUNCHCTL="${COFFEE_LAUNCHCTL:-/bin/launchctl}"

DEADLINE_FILE="$COFFEE_STATE_DIR/deadline"
REASON_FILE="$COFFEE_STATE_DIR/last-reason"

mkdir -p "$COFFEE_STATE_DIR" 2>/dev/null

now() {
  if [ -n "${COFFEE_NOW:-}" ]; then echo "$COFFEE_NOW"; else date +%s; fi
}

die() { echo "coffee: $*" >&2; exit 2; }

usage() {
  cat <<'USAGE'
coffee — keep the Mac awake with the lid shut, for a bounded time.

  coffee <duration>   start or extend a lease   (90m, 2h, 1h30m, or bare minutes)
  coffee off          end the lease now
  coffee              show status
  coffee -h           this help

Max lease is 4 hours. There is no "forever". The lease also ends by itself if
the battery drops below 20% while unplugged, or if the watchdog stops.
USAGE
}

# "90m" | "2h" | "1h30m" | "45" -> seconds on stdout. Non-zero exit if unparseable.
parse_duration() {
  local s="$1" total=0 h=0 m=0
  case "$s" in
    *[!0-9hm]*) return 1 ;;
    '')         return 1 ;;
  esac
  if echo "$s" | grep -qE '^[0-9]+$'; then
    total=$((s * 60))
  elif echo "$s" | grep -qE '^[0-9]+m$'; then
    m="${s%m}"; total=$((m * 60))
  elif echo "$s" | grep -qE '^[0-9]+h$'; then
    h="${s%h}"; total=$((h * 3600))
  elif echo "$s" | grep -qE '^[0-9]+h[0-9]+m$'; then
    h="${s%%h*}"; m="${s##*h}"; m="${m%m}"; total=$((h * 3600 + m * 60))
  else
    return 1
  fi
  [ "$total" -gt 0 ] || return 1
  echo "$total"
}

watchdog_running() {
  "$COFFEE_LAUNCHCTL" list 2>/dev/null | grep -q "$COFFEE_LABEL"
}

human() {
  local s="$1"
  if [ "$s" -ge 3600 ]; then
    echo "$((s / 3600))h $(((s % 3600) / 60))m"
  else
    echo "$((s / 60))m"
  fi
}

cmd_status() {
  local n deadline left
  n="$(now)"
  if [ ! -f "$DEADLINE_FILE" ]; then
    echo "coffee: OFF — the Mac sleeps normally when you shut the lid."
    if [ -f "$REASON_FILE" ]; then
      echo "        last lease ended: $(cat "$REASON_FILE")"
    fi
    watchdog_running || echo "        note: watchdog is NOT loaded (see README install)."
    return 0
  fi
  deadline="$(cat "$DEADLINE_FILE" 2>/dev/null)"
  left=$((deadline - n))
  if [ "$left" -le 0 ]; then
    echo "coffee: expiring — the watchdog will re-enable sleep within 20s."
    return 0
  fi
  echo "coffee: ON — lid can stay shut for another $(human "$left")."
  watchdog_running || echo "        WARNING: watchdog is NOT loaded; this lease is not being enforced."
}

cmd_off() {
  rm -f "$DEADLINE_FILE"
  echo "stopped" > "$REASON_FILE"
  echo "coffee: OFF — sleep comes back within 20s."
}

main() {
  case "${1:-}" in
    ''|status)  cmd_status ;;
    off|stop)   cmd_off ;;
    -h|--help|help) usage ;;
    *)
      local secs n
      secs="$(parse_duration "$1")" || die "cannot read the time '$1'. Try 90m, 2h, 1h30m, or a plain number of minutes."
      if [ "$secs" -gt "$COFFEE_MAX_SECONDS" ]; then
        die "$1 is over the $((COFFEE_MAX_SECONDS / 3600))h ceiling. Ask for less."
      fi
      # Refuse rather than mislead: a lease nobody enforces is worse than none.
      if ! watchdog_running; then
        die "the watchdog is not loaded, so a lease would not be enforced. See tooling/cli/coffee/README.md."
      fi
      n="$(now)"
      echo "$((n + secs))" > "$DEADLINE_FILE"
      rm -f "$REASON_FILE"
      echo "coffee: ON for $(human "$secs"). Shut the lid whenever you like."
      echo "        It turns itself off at the deadline, under ${COFFEE_BATT_FLOOR:-20}% battery, or if the watchdog stops."
      ;;
  esac
}

main "$@"
```

**Verify**: `bash -n tooling/cli/coffee/coffee` -> exit 0, no output.

### Step 3: Create the launchd agent — `tooling/cli/coffee/com.kbtg.coffee-watchdog.plist`

Match the `bt-audio-guard` plist quoted in Current state. `KeepAlive` is what
makes the watchdog resurrect within seconds of being killed — that is the
"watchdog dies" safety net.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.kbtg.coffee-watchdog</string>

    <key>ProgramArguments</key>
    <array>
        <string>/Users/kbtg/.local/bin/coffee-watchdog.sh</string>
    </array>

    <!-- Persistent reconciler: it polls internally every 20s. KeepAlive is the
         "watchdog dies" safety net — launchd restarts it within seconds, and its
         first act on start is to force sleep back on. -->
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>

    <key>ProcessType</key>
    <string>Background</string>
    <key>LowPriorityIO</key>
    <true/>

    <key>StandardOutPath</key>
    <string>/dev/null</string>
    <key>StandardErrorPath</key>
    <string>/tmp/coffee-watchdog.err</string>
</dict>
</plist>
```

**Verify**: `plutil -lint tooling/cli/coffee/com.kbtg.coffee-watchdog.plist` -> `OK`

### Step 4: Create the sudoers template — `tooling/cli/coffee/sudoers.d-coffee.example`

Exact-argument matching. This rule permits two specific command lines and
nothing else — it cannot be used to run any other `pmset` subcommand.

```
# /etc/sudoers.d/coffee — install with:
#   sudo install -m 0440 -o root -g wheel \
#     tooling/cli/coffee/sudoers.d-coffee.example /etc/sudoers.d/coffee
#   sudo visudo -c        # must print "parsed OK"
#
# Grants exactly two command lines, no others. The coffee watchdog needs these
# to re-enable sleep while the owner is away from the keyboard.
kbtg ALL=(root) NOPASSWD: /usr/bin/pmset -a disablesleep 0
kbtg ALL=(root) NOPASSWD: /usr/bin/pmset -a disablesleep 1
```

**Verify**: `test -f tooling/cli/coffee/sudoers.d-coffee.example && echo ok` -> `ok`
(Do **not** run `visudo`. That is an owner step.)

### Step 5: Create the test suite — `tooling/cli/coffee/test-coffee.sh`

Following `tooling/cli/yt-claude/test-prune.sh`, whose point is the refusal
cases, not the happy path. The suite sources the watchdog with
`COFFEE_SOURCE_ONLY=1` and calls `reconcile` directly against fakes. **No test
may invoke the real `pmset`, the real `sudo`, or the real `notify`.**

```bash
#!/bin/bash
# test-coffee.sh — exercises the reconcile decision table against fakes.
# Nothing here touches a real power setting, a real sudo, or a real Telegram.

set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
PASS=0
FAIL=0

ok()   { echo "  PASS: $1"; PASS=$((PASS + 1)); }
bad()  { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

# Build a throwaway sandbox: fake pmset/sudo/notify + a temp state dir.
setup() {
  SANDBOX="$(mktemp -d)"
  mkdir -p "$SANDBOX/bin" "$SANDBOX/state"

  # Fake pmset: logs its args; answers `-g batt` from FAKE_BATT.
  cat > "$SANDBOX/bin/pmset" <<'FAKE'
#!/bin/bash
if [ "${1:-}" = "-g" ] && [ "${2:-}" = "batt" ]; then
  echo "Now drawing from 'Battery Power'"
  echo " -InternalBattery-0 (id=1)	${FAKE_BATT_PCT:-97}%; ${FAKE_BATT_STATE:-discharging}; 6:54 remaining present: true"
  exit 0
fi
echo "$*" >> "$PMSET_LOG"
FAKE
  chmod +x "$SANDBOX/bin/pmset"

  # Fake sudo: drop the sudo, run the rest.
  printf '#!/bin/bash\nexec "$@"\n' > "$SANDBOX/bin/sudo"
  chmod +x "$SANDBOX/bin/sudo"

  # Fake notify: log the message.
  printf '#!/bin/bash\nshift\necho "$*" >> "$NOTIFY_LOG"\n' > "$SANDBOX/bin/notify"
  chmod +x "$SANDBOX/bin/notify"

  export PMSET_LOG="$SANDBOX/pmset.log"
  export NOTIFY_LOG="$SANDBOX/notify.log"
  : > "$PMSET_LOG"
  : > "$NOTIFY_LOG"

  export COFFEE_PMSET="$SANDBOX/bin/pmset"
  export COFFEE_SUDO="$SANDBOX/bin/sudo"
  export COFFEE_NOTIFY="$SANDBOX/bin/notify"
  export COFFEE_STATE_DIR="$SANDBOX/state"
  export COFFEE_LOG="$SANDBOX/coffee.log"
  export COFFEE_BATT_FLOOR=20
  export COFFEE_MAX_SECONDS=14400
  export FAKE_BATT_PCT=97
  export FAKE_BATT_STATE=discharging

  COFFEE_SOURCE_ONLY=1 . "$HERE/coffee-watchdog.sh"
}

teardown() { rm -rf "$SANDBOX"; }

# Last thing pmset was told to do: "0" or "1" or "" if never called.
last_assert() { tail -1 "$PMSET_LOG" 2>/dev/null | awk '{print $NF}'; }

# ---------------------------------------------------------------- test cases

echo "coffee watchdog — reconcile decision table"

# 1. No lease file -> assert sleep ON (value 0). The resting state.
setup
COFFEE_NOW=1000 reconcile
[ "$(last_assert)" = "0" ] && ok "no lease -> sleep enabled" || bad "no lease -> sleep enabled (got '$(last_assert)')"
teardown

# 2. Valid unexpired lease, healthy battery -> hold it awake (value 1).
setup
echo 2000 > "$COFFEE_STATE_DIR/deadline"
COFFEE_NOW=1000 reconcile
[ "$(last_assert)" = "1" ] && ok "valid lease -> stays awake" || bad "valid lease -> stays awake (got '$(last_assert)')"
teardown

# 3. Deadline passed -> revoke, and the lease file is gone.
setup
echo 900 > "$COFFEE_STATE_DIR/deadline"
COFFEE_NOW=1000 reconcile
if [ "$(last_assert)" = "0" ] && [ ! -f "$COFFEE_STATE_DIR/deadline" ]; then
  ok "deadline passed -> revoked"
else
  bad "deadline passed -> revoked"
fi
teardown

# 4. Deadline passed -> the owner gets a phone ping.
setup
echo 900 > "$COFFEE_STATE_DIR/deadline"
COFFEE_NOW=1000 reconcile
grep -q "time up" "$NOTIFY_LOG" && ok "revoke sends a notification" || bad "revoke sends a notification"
teardown

# 5. THE BATTERY FLOOR. Valid lease, but battery under the floor while
#    discharging -> revoke anyway.
setup
echo 9999 > "$COFFEE_STATE_DIR/deadline"
FAKE_BATT_PCT=11 FAKE_BATT_STATE=discharging COFFEE_NOW=1000 reconcile
if [ "$(last_assert)" = "0" ] && grep -q "battery low" "$NOTIFY_LOG"; then
  ok "battery floor -> revoked"
else
  bad "battery floor"
fi
teardown

# 6. Low battery but PLUGGED IN -> keep the lease. Charging is not a hazard.
setup
echo 9999 > "$COFFEE_STATE_DIR/deadline"
FAKE_BATT_PCT=11 FAKE_BATT_STATE=charging COFFEE_NOW=1000 reconcile
[ "$(last_assert)" = "1" ] && ok "low battery on AC -> lease held" || bad "low battery on AC -> lease held (got '$(last_assert)')"
teardown

# 7. Lease beyond the 4h ceiling -> refused outright, not clamped.
setup
echo 99999 > "$COFFEE_STATE_DIR/deadline"
COFFEE_NOW=1000 reconcile
if [ "$(last_assert)" = "0" ] && grep -q "ceiling" "$NOTIFY_LOG"; then
  ok "over-ceiling lease -> refused"
else
  bad "over-ceiling lease -> refused"
fi
teardown

# 8. Corrupt lease file -> treated as no lease, sleep comes back.
setup
echo "not-a-number" > "$COFFEE_STATE_DIR/deadline"
COFFEE_NOW=1000 reconcile
if [ "$(last_assert)" = "0" ] && [ ! -f "$COFFEE_STATE_DIR/deadline" ]; then
  ok "corrupt lease -> revoked"
else
  bad "corrupt lease -> revoked"
fi
teardown

# 9. Unreadable battery must not crash the tick; the deadline still governs.
setup
echo 2000 > "$COFFEE_STATE_DIR/deadline"
FAKE_BATT_PCT="" FAKE_BATT_STATE="" COFFEE_NOW=1000 reconcile
[ "$(last_assert)" = "1" ] && ok "unreadable battery -> deadline still governs" || bad "unreadable battery (got '$(last_assert)')"
teardown

echo ""
echo "coffee CLI — duration parsing and refusals"

# 10-13. parse_duration accepts the four documented shapes.
setup
[ "$(parse_duration_probe() { :; }; COFFEE_STATE_DIR="$COFFEE_STATE_DIR" bash -c '
  set -u
  COFFEE_LAUNCHCTL=/usr/bin/true
  . '"$HERE"'/coffee 2>/dev/null
  true' >/dev/null 2>&1; echo skip)" = "skip" ] && true
teardown

# The CLI is exercised end-to-end instead, with launchctl faked "loaded".
cli_run() {
  # $1.. = args. Echoes stdout+stderr, returns the exit code.
  COFFEE_STATE_DIR="$SANDBOX/state" \
  COFFEE_MAX_SECONDS=14400 \
  COFFEE_LAUNCHCTL="$SANDBOX/bin/launchctl" \
  COFFEE_NOW=1000 \
  bash "$HERE/coffee" "$@" 2>&1
}

setup
# Fake launchctl reporting the watchdog as loaded.
printf '#!/bin/bash\necho "123 0 com.kbtg.coffee-watchdog"\n' > "$SANDBOX/bin/launchctl"
chmod +x "$SANDBOX/bin/launchctl"

out="$(cli_run 90m)"; rc=$?
if [ "$rc" = "0" ] && [ "$(cat "$SANDBOX/state/deadline")" = "6400" ]; then
  ok "coffee 90m -> deadline is now+5400"
else
  bad "coffee 90m -> deadline (rc=$rc out=$out)"
fi

out="$(cli_run 2h)"; rc=$?
[ "$(cat "$SANDBOX/state/deadline")" = "8200" ] && ok "coffee 2h parses" || bad "coffee 2h parses"

out="$(cli_run 1h30m)"; rc=$?
[ "$(cat "$SANDBOX/state/deadline")" = "6400" ] && ok "coffee 1h30m parses" || bad "coffee 1h30m parses"

out="$(cli_run 45)"; rc=$?
[ "$(cat "$SANDBOX/state/deadline")" = "3700" ] && ok "coffee 45 (bare minutes) parses" || bad "coffee 45 parses"

# Refusal: over the ceiling.
out="$(cli_run 9h)"; rc=$?
if [ "$rc" != "0" ] && echo "$out" | grep -q "ceiling"; then
  ok "coffee 9h -> refused (over ceiling)"
else
  bad "coffee 9h -> refused (rc=$rc out=$out)"
fi

# Refusal: garbage duration.
out="$(cli_run banana)"; rc=$?
if [ "$rc" != "0" ] && echo "$out" | grep -q "cannot read the time"; then
  ok "coffee banana -> refused"
else
  bad "coffee banana -> refused (rc=$rc out=$out)"
fi

# coffee off clears the lease.
cli_run 30m >/dev/null
out="$(cli_run off)"
[ ! -f "$SANDBOX/state/deadline" ] && ok "coffee off clears the lease" || bad "coffee off clears the lease"
teardown

# Refusal: watchdog NOT loaded -> coffee must refuse, not pretend.
setup
printf '#!/bin/bash\nexit 0\n' > "$SANDBOX/bin/launchctl"   # lists nothing
chmod +x "$SANDBOX/bin/launchctl"
out="$(cli_run 30m)"; rc=$?
if [ "$rc" != "0" ] && [ ! -f "$SANDBOX/state/deadline" ] && echo "$out" | grep -q "not loaded"; then
  ok "watchdog missing -> coffee refuses the lease"
else
  bad "watchdog missing -> coffee refuses (rc=$rc out=$out)"
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
```

**Note on test 10-13's placeholder block**: delete the odd `parse_duration_probe`
stanza entirely — it is a no-op left in the draft. The CLI parsing is covered by
the `cli_run` cases that follow. If you leave it in and it causes a syntax error,
that is a bug, not a feature.

**Verify**: `bash tooling/cli/coffee/test-coffee.sh` -> exit 0, last line `ALL PASS`

### Step 6: Make the two scripts executable

```bash
chmod +x tooling/cli/coffee/coffee tooling/cli/coffee/coffee-watchdog.sh tooling/cli/coffee/test-coffee.sh
```

**Verify**: `test -x tooling/cli/coffee/coffee && test -x tooling/cli/coffee/coffee-watchdog.sh && echo ok` -> `ok`

### Step 7: Write `tooling/cli/coffee/README.md`

Must contain, in this order, with these exact headings:

1. `# coffee` — one-line purpose.
2. `## Why this exists` — the inverted-default design: sleep-enabled is the
   resting state, re-asserted every 20s; "awake" is a lease, never a setting.
   Name the owner's actual worry ("what if I forget to turn it off") and say how
   each of the four safety nets answers it.
3. `## Contract` — a fenced block with `coffee <duration>`, `coffee off`,
   `coffee` (status), exit codes (0 ok, 2 usage/refusal).
4. `## The four safety nets` — a table: net / what triggers it / what happens.
5. `## Install (owner, once)` — the three privileged steps, copy-pasteable:
   the `~/.local/bin` symlink, the sudoers install + `visudo -c`, the plist
   copy + `launchctl load`, and the verify line
   `launchctl list | grep coffee-watchdog`.
6. `## Logs` — `~/Library/Logs/coffee.log` and `/tmp/coffee-watchdog.err`.
7. `## Testing` — `bash tooling/cli/coffee/test-coffee.sh`, and the statement
   that the suite never touches real power settings.
8. `## Gotchas` — bash 3.2 only; `notify` is not on `PATH` under launchd so it is
   called by absolute path; the watchdog deliberately never reads the current
   `pmset` value.

**Verify**: `grep -c '^## ' tooling/cli/coffee/README.md` -> `7`

### Step 8: Register in `MAC-LAUNCHD.md`

Three edits to the existing file, matching the surrounding formatting exactly.

1. In the **"The jobs"** table, add this row after the `com.kbtg.bt-audio-guard` row:

```
| `com.kbtg.coffee-watchdog` | Enforces the `coffee` lease: keeps the Mac awake with the lid shut while an unexpired lease exists, and re-enables sleep the moment it expires, the battery drops under 20% on mains-off, or the lease file goes away. Re-asserts every 20s, so sleep-enabled is the resting state. | always on (`KeepAlive`) | `tooling/cli/coffee/` |
```

2. In the **Logs** table, add:

```
| coffee-watchdog | `~/Library/Logs/coffee.log` (and `/tmp/coffee-watchdog.err`) |
```

3. In the **"Install on a fresh machine"** fenced block, add the symlink line
   next to the existing `bt-audio-guard` one, add the plist copy to the `cp`
   group, and add `com.kbtg.coffee-watchdog` to the `for j in ...` loop and to
   the final `grep -E` verify. Also add, as a numbered comment inside that block:

```sh
# 5. coffee needs a scoped sudoers rule for pmset — see tooling/cli/coffee/README.md.
#    sudo install -m 0440 -o root -g wheel \
#      tooling/cli/coffee/sudoers.d-coffee.example /etc/sudoers.d/coffee
```

**Verify**: `grep -c 'coffee' MAC-LAUNCHD.md` -> a number `>= 6`

### Step 9: Add one row to `tooling/cli/README.md`

Match the existing row format in that file exactly (read it first). The row
describes `coffee` in one line and points at `tooling/cli/coffee/`.

**Verify**: `grep -q 'coffee' tooling/cli/README.md && echo ok` -> `ok`

### Step 10: Flip the plan's status row

In `plans/README.md`, set plan 268's Status cell to `DONE`.

**Verify**: `grep '| 268 |' plans/README.md` -> the row shows `DONE`

## Test plan

The suite in Step 5 is the whole verification story, and it is deliberately
structured as a **decision table** over `reconcile`, because that function is the
only thing standing between the owner and a Mac that never sleeps.

Nine watchdog cases (no lease / valid lease / deadline passed / notification sent
/ battery floor / low battery on AC / over-ceiling / corrupt file / unreadable
battery) plus eight CLI cases (four duration shapes, two refusals, `off`, and the
watchdog-missing refusal).

The suite injects fakes for `pmset`, `sudo`, `notify` and `launchctl`, so it runs
safely on any machine and in CI with no privileges.

**Not covered by automated tests, and honestly so:** whether macOS actually keeps
the machine awake with the lid physically shut. That needs a human, a lid, and a
bag. It is the owner's smoke test, written up in Step 7's README install section.

## Done criteria

- [ ] `bash tooling/cli/coffee/test-coffee.sh` exits 0 and prints `ALL PASS`
- [ ] `bash -n tooling/cli/coffee/coffee && bash -n tooling/cli/coffee/coffee-watchdog.sh && bash -n tooling/cli/coffee/test-coffee.sh` exits 0
- [ ] `plutil -lint tooling/cli/coffee/com.kbtg.coffee-watchdog.plist` prints `OK`
- [ ] `test -x tooling/cli/coffee/coffee && test -x tooling/cli/coffee/coffee-watchdog.sh` exits 0
- [ ] `grep -c '^## ' tooling/cli/coffee/README.md` is `7`
- [ ] `grep -c 'coffee' MAC-LAUNCHD.md` is `>= 6`
- [ ] `git status --porcelain` lists only files from the In-scope list
- [ ] `grep -rn 'sudo ' tooling/cli/coffee/test-coffee.sh` finds no call to a real `/usr/bin/sudo`

## STOP conditions

- **Any need to run `sudo`.** You never have permission. If a step seems to need
  it, you have misread the step — STOP and report.
- **Any need to write to `/etc/`, `~/Library/LaunchAgents/`, or `~/.local/bin/`.**
  All three are owner-only. The repo files are templates, not installs.
- **Gate integrity.** If a test in Step 5 fails, fix the script under test or the
  fixture. Weakening, skipping, or deleting an assertion is a STOP — especially
  the battery-floor and over-ceiling cases, which are the plan's whole point.
- **If `reconcile` ever needs to read the current `pmset` value** to make a
  decision, STOP. That would reintroduce the failure mode this design removes
  (a parse failure leaving the Mac awake). Re-asserting blindly is deliberate.
- **If you are tempted to clamp an over-ceiling lease** instead of refusing it,
  STOP. Clamping silently grants most of a request that should have been denied.
- If the drift check shows `tooling/cli/coffee/` already exists, STOP — someone
  else built this.

## Maintenance notes

- **`pmset -a disablesleep` is the only lever macOS gives here.** `caffeinate` is
  not a substitute: it holds a wake assertion but does not survive a clamshell
  close on battery. If a future macOS removes `disablesleep`, this tool has no
  fallback and should be retired rather than patched.
- **A reviewer should scrutinise exactly one thing: every path out of
  `reconcile` when the lease is not clearly valid.** All of them must reach
  `assert_sleep 0`. A missed `return` that skips the final assert is the one bug
  class that could strand the Mac awake.
- The 20-second tick is a deliberate trade: fast enough that a revoked lease
  takes effect before the Mac gets hot, slow enough to be free. Do not lower it
  below 10s (launchd's `ThrottleInterval` floor, noted in `MAC-LAUNCHD.md`).
- The sudoers rule is exact-argument matched. If the `pmset` path or the flag
  order ever changes, the rule silently stops matching and the watchdog can no
  longer revoke — which fails toward "stuck awake". A future hardening pass
  should make the watchdog verify its own sudo access at startup and notify if
  it has lost it.
- This tool is macOS-only. The repo's other operator is on Windows
  (root `CLAUDE.md`, "TWO operators on TWO platforms"); `coffee` is a deliberate
  exception and the README should not pretend otherwise.
