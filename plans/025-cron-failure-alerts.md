# Plan 025: Shared failure-alert helper for every VPS cron (_shared/alert.sh)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md` (in personal-stuff).
>
> **⚠️ WORKING REPO**: almost all edits happen in `~/codebase/vps-crons`
> (a SEPARATE repo from personal-stuff). Confirm it exists and is clean first:
> `git -C ~/codebase/vps-crons status --short` → empty.
>
> **Drift check (run first)**: `git -C ~/codebase/vps-crons log --oneline -3`
> then compare the run.sh excerpts below against the live files
> (`_template/run.sh`, `my-planner/run.sh`, `gmail-digest/run.sh`,
> `repo-sync/run.sh`); mismatch = STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (additive helper; wrappers keep working if it's absent)
- **Depends on**: none
- **Category**: dx
- **Executor**: antigravity
- **Difficulty**: standard
- **Planned at**: personal-stuff commit `671741e`, 2026-07-05

## Why this matters

Every VPS cron is a `run.sh` wrapper (Pattern B — see personal-stuff
`VPS-CRONS.md`). They all run `set -euo pipefail`, so any unexpected error
kills the script — and the failure goes only to a log file nobody tails and
root's local mail. A dead cron (expired OAuth token, network outage, broken
dependency) is discovered by *noticing the digest didn't arrive*. The repo has
a Telegram helper (`_shared/telegram.sh`) that every job already sources, but
nothing turns "the wrapper died" into a message.

After this plan: one shared `_shared/alert.sh` provides a `trap`-based
failure hook; the template and all three existing wrappers source it, so any
non-zero exit fires a Telegram message naming the job, the exit code, and the
last log lines. Every FUTURE cron gets this for free via the template.

## Current state

Repo `~/codebase/vps-crons` (private, deployed to `/srv/crons/` on the VPS,
which is where these paths resolve at runtime):

```
_shared/telegram.sh    ← send_telegram()/send_telegram_file(); needs TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID from the job's .env
_shared/claude-env.sh
_template/run.sh       ← scaffold for new crons
my-planner/run.sh
gmail-digest/run.sh
repo-sync/run.sh
crontab.txt
```

All wrappers share this shape (excerpt from `my-planner/run.sh`):

```bash
set -euo pipefail
JOB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$JOB_DIR"
if [[ -f .env ]]; then
  set -a; source .env; set +a
else
  echo "FATAL: .env missing at $JOB_DIR/.env" >&2
  exit 1
fi
...
exec ./.venv/bin/python notifier.py
```

Key facts that shape the design (decided at plan time — do not re-decide):

- **`exec` replaces the shell**, so an EXIT trap set in the wrapper does NOT
  survive `exec`. The helper must therefore hook failures in two ways:
  (a) an ERR/EXIT trap for failures BEFORE the exec / in non-exec wrappers,
  and (b) for exec-style wrappers, the plan converts `exec CMD` to `CMD`
  followed by explicit exit-code handling (loses nothing — the wrapper is the
  last thing cron runs).
- `send_telegram` is the delivery channel (same bot/chat as the job's normal
  output — one place to look). ntfy is NOT used here (it's localhost-only on
  the VPS and not every job's .env has a topic).
- `repo-sync/run.sh` runs every 15 min; to avoid alert storms it must alert
  at most once per failure streak (a marker file suppresses repeats until a
  success clears it).
- `gmail-digest/run.sh` already has granular per-account soft-fail handling +
  its own send_telegram calls — the helper only covers the *unexpected* death
  (e.g. its `.env` sourcing or git operations blowing up), so it just gets the
  trap, nothing else changes.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Syntax check each edited file | `bash -n <file>` | exit 0 |
| Local dry-run of the trap | see Test plan | Telegram send attempted (curl fails offline → message printed) |

## Scope

**In scope** (all in `~/codebase/vps-crons`):
- `_shared/alert.sh` (create)
- `_template/run.sh`, `my-planner/run.sh`, `gmail-digest/run.sh`, `repo-sync/run.sh` (wire the trap)
- `README.md` (add one row/paragraph documenting alert.sh in the _shared list)

**In scope** (in personal-stuff):
- `plans/README.md` (status row only)

**Out of scope**:
- `crontab.txt` (no schedule changes).
- `_shared/telegram.sh`, `_shared/claude-env.sh` (do not modify).
- Anything on the VPS itself (owner applies — see Maintenance notes).
- personal-stuff `VPS-CRONS.md` (plan 031 owns doc updates; it runs after this).

## Git workflow

- Repo: `~/codebase/vps-crons`. Verify identity first:
  `git -C ~/codebase/vps-crons config user.email` must be the akshat-git-jpg
  identity (same as personal-stuff; if it prints a zluri address, STOP).
- Branch: `advisor/025-cron-failure-alerts`
- Commit: `feat(_shared): alert.sh failure trap; wire into all wrappers + template` — no AI footers. Do NOT push.

## Steps

### Step 1: Create `_shared/alert.sh`

```bash
# Shared failure-alert helper. Source AFTER .env and telegram.sh, then call
# enable_failure_alert "<job-name>" [log-file] as the LAST setup line.
#
# On any non-zero exit of the wrapper, sends one Telegram message with the
# job name, exit code, and last log lines. For */15-style high-frequency jobs,
# a marker file suppresses repeat alerts until a run succeeds.
#
#   source /srv/crons/_shared/telegram.sh
#   source /srv/crons/_shared/alert.sh
#   enable_failure_alert "my-planner" "$JOB_DIR/logs/cron.log"

_ALERT_JOB=""
_ALERT_LOG=""
_ALERT_MARKER=""

_alert_on_exit() {
  local code=$?
  if [[ $code -eq 0 ]]; then
    [[ -n "$_ALERT_MARKER" ]] && rm -f "$_ALERT_MARKER"
    return 0
  fi
  # suppress repeats within a failure streak
  if [[ -n "$_ALERT_MARKER" && -f "$_ALERT_MARKER" ]]; then
    echo "alert: still failing (exit $code); alert already sent this streak"
    return 0
  fi
  local tail_lines=""
  [[ -n "$_ALERT_LOG" && -f "$_ALERT_LOG" ]] && tail_lines="$(tail -n 8 "$_ALERT_LOG")"
  send_telegram "🚨 cron '${_ALERT_JOB}' FAILED (exit ${code}) on $(hostname)
last log lines:
${tail_lines:-<no log>}" || echo "alert: telegram send failed" >&2
  [[ -n "$_ALERT_MARKER" ]] && date > "$_ALERT_MARKER"
  return 0
}

enable_failure_alert() {
  _ALERT_JOB="${1:?job name required}"
  _ALERT_LOG="${2:-}"
  _ALERT_MARKER="/tmp/cron-alert-${_ALERT_JOB}.failing"
  trap _alert_on_exit EXIT
}
```

**Verify**: `bash -n ~/codebase/vps-crons/_shared/alert.sh` → exit 0.

### Step 2: Wire the template

In `_template/run.sh`, after the existing
`source /srv/crons/_shared/telegram.sh` line, add:

```bash
source /srv/crons/_shared/alert.sh
enable_failure_alert "$(basename "$JOB_DIR")" "$JOB_DIR/logs/cron.log"
```

**Verify**: `bash -n ~/codebase/vps-crons/_template/run.sh` → exit 0.

### Step 3: Wire my-planner (exec conversion)

In `my-planner/run.sh`:
1. It does NOT currently source telegram.sh — add
   `source /srv/crons/_shared/telegram.sh` after the .env block, then the two
   lines from Step 2 (job name `my-planner`).
2. Replace the final `exec ./.venv/bin/python notifier.py` with
   `./.venv/bin/python notifier.py` (drop the `exec` — the EXIT trap must
   survive; the wrapper ends right after, so behavior is identical, and
   `set -e` still propagates a non-zero exit into the trap).

**Verify**: `bash -n ~/codebase/vps-crons/my-planner/run.sh` → exit 0, AND
`grep -c '^exec ' ~/codebase/vps-crons/my-planner/run.sh` → 0.

### Step 4: Wire gmail-digest and repo-sync

- `gmail-digest/run.sh`: already sources telegram.sh — add the alert.sh source
  + `enable_failure_alert "gmail-digest" "$JOB_DIR/logs/cron.log"` right after
  it. No other changes (its per-account handling stays).
- `repo-sync/run.sh`: it currently `exec`s vps-sync.sh and sources nothing.
  Add after the `mkdir -p "$JOB_DIR/logs"` line:
  ```bash
  # .env optional for this job (Telegram vars); alert only fires if present
  [[ -f "$JOB_DIR/.env" ]] && { set -a; source "$JOB_DIR/.env"; set +a; }
  source /srv/crons/_shared/telegram.sh
  source /srv/crons/_shared/alert.sh
  enable_failure_alert "repo-sync" "$JOB_DIR/logs/cron.log"
  ```
  and convert its `exec /srv/projects/personal-stuff/scripts/vps-sync.sh` to a
  plain invocation (drop `exec`).

**Verify**: `bash -n` on both files → exit 0.

### Step 5: Document in vps-crons README.md

In the `_shared/` part of the repo's README (it lists telegram.sh +
claude-env.sh), add one line: `alert.sh — enable_failure_alert "<job>" [log]:
EXIT-trap that Telegrams job name + exit code + last log lines on failure;
streak-suppressed via /tmp marker. Wired into all wrappers + the template.`

**Verify**: `grep -c 'alert.sh' ~/codebase/vps-crons/README.md` → ≥ 1.

## Test plan

Local trap smoke test (Mac, no VPS, no real Telegram):

```bash
cd ~/codebase/vps-crons
TELEGRAM_BOT_TOKEN=x TELEGRAM_CHAT_ID=y bash -c '
  source _shared/telegram.sh
  source _shared/alert.sh
  enable_failure_alert plantest /dev/null
  false
'; echo "exit=$?"
```

Expected: curl fails against the fake token, the helper prints
`alert: telegram send failed` (proving the trap fired and attempted delivery),
exit is non-zero. Then run again with a success (`true` instead of `false`):
no alert output, exit 0, and `/tmp/cron-alert-plantest.failing` absent.
Remove `/tmp/cron-alert-plantest.failing` if left over.

## Done criteria

- [ ] `bash -n` exits 0 on alert.sh + all four wrappers
- [ ] No wrapper still uses `exec` for its final command
- [ ] Trap smoke test: failure attempts a send; success stays silent and clears the marker
- [ ] vps-crons README documents alert.sh
- [ ] `git -C ~/codebase/vps-crons status` shows only the six in-scope files
- [ ] `plans/README.md` (personal-stuff) status row updated

## STOP conditions

- `~/codebase/vps-crons` doesn't exist, is dirty, or `git config user.email`
  is a work identity.
- Any wrapper's live content diverges from the excerpts (e.g. someone already
  added error handling).
- The trap smoke test doesn't fire (bash version quirk) — report, don't hack.

## Maintenance notes

- **Owner follow-up (NOT the executor):** push the branch, merge, then on the
  VPS `cd /srv/crons && git pull` — the wrappers reference `/srv/crons/...`
  absolute paths, which only resolve there. repo-sync's `.env` may need
  TELEGRAM vars added on the VPS for its alerts to deliver.
- Alert-storm guard is per-job via `/tmp` marker — a VPS reboot clears
  markers, which is fine (first failure after reboot re-alerts).
- Plan 027 (site probe) builds its wrapper from the updated template and
  assumes this helper exists.
