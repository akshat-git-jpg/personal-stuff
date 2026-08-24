---
executor: codex
model:
test_cmd: bash tooling/maintainer/test-maintainer.sh
ui:
deploy:
needs: ["242 (PR#203) must land first — these add two job folders to its frame"]
needs_prs: [203]
touches: [tooling/maintainer/jobs/uptime/README.md, tooling/maintainer/jobs/uptime/check.sh, tooling/maintainer/jobs/crons/README.md, tooling/maintainer/jobs/crons/check.sh, tooling/maintainer/CLAUDE.md, tooling/maintainer/test-maintainer.sh]

mutation_apply: python3 -c "import io;p='tooling/maintainer/jobs/crons/check.sh';s=io.open(p,encoding='utf-8').read();s=s.replace('NO-LOG','NO-LOGG',1);io.open(p,'w',encoding='utf-8').write(s)"
mutation_command: bash tooling/maintainer/test-maintainer.sh
mutation_expect: crons check did not report the launchd job with no log
mutation_timeout: 300
---

# Plan 247: the uptime and crons jobs

## Summary

- **Problem statement**: `scripts/probe-sites.sh` and `scripts/check-apps.sh` both exist and
  nothing runs them regularly. Separately, six launchd agents and a set of VPS crons are
  documented as things that *should* run, and nothing ever confirms they *did*. A cron that
  silently died is invisible.
- **Goals**: add `jobs/uptime/` (are the deployed surfaces up, do the inventories match) and
  `jobs/crons/` (did the scheduled work actually happen).
- **Executor proposed**: `codex` / gpt-5.6-sol — both jobs wrap scripts and files that already
  exist; verification is exit codes.
- **Done criteria** (terse): `test-maintainer.sh` exit 0; `discover_jobs` finds both jobs;
  the crons check reports a launchd job whose log is missing.
- **Stop conditions** (terse): never SSH without an explicit flag; never restart or repair a
  cron; never edit an inventory doc automatically.
- **Test / verification for success**: both checks run against **fixture** inventory files in
  `mktemp -d`; no network call and no SSH in any test.
- **Open points for plan readiness**: none. Design open point 2 (cron success evidence) is
  resolved below — `MAC-LAUNCHD.md` already documents a log path per job.

> **Executor instructions**: Follow this plan step by step. Run every verification command
> and confirm the expected result before moving on. If anything in the "STOP conditions"
> section occurs, stop and report. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 36b2519..HEAD -- tooling/maintainer/`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 242
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `36b2519`, 2026-08-25

## Why this matters

Both jobs answer "is the thing I set up still working", which nothing currently asks. A dead
cron produces no error — it produces silence, and silence reads as success.

## Current state

### What exists for uptime

`scripts/probe-sites.sh` — header, verbatim:

```
# probe-sites.sh — parses my-hosted-sites.md and curls every public URL;
# exit 1 + DOWN_SITES: line if any site is unreachable/5xx.
```

It takes `--include-localhost`. It reads `my-hosted-sites.md` from the repo root and fails
loudly with a parseable `DOWN_SITES:` line.

`scripts/check-apps.sh` — *"Uniform verification runner across all apps. Runs
typecheck/check, lint, and test scripts per app. Exit code: 0 if all pass, 1 if any fails."*

`my-hosted-sites.md` is the flat index of every live URL; `INFRA.md` is the canonical
Cloudflare + VPS + DNS inventory. They can disagree, and nothing checks that they do not.

### What exists for crons — the design's open point, now resolved

`MAC-LAUNCHD.md` has a **Logs** table giving a log path for every one of its six jobs:

| Job | Log |
|---|---|
| yt-claude-relay | `/tmp/yt-claude-relay.log` |
| yt-claude-prune | `~/Library/Logs/yt-claude-prune.log` |
| pp-work-snapshot | `~/.local/state/pp-work/snapshot-timer.log` |
| pp-claude-tags | `~/.cache/pp-claude-tags.log` |
| bt-audio-guard | `~/Library/Logs/bt-audio-guard.log` |
| skills-sync | `~/Library/Logs/skills-sync.log` |

So the Mac side is **fully checkable locally**: parse the table, confirm each job is loaded
via `launchctl list`, and confirm its log exists and was written recently.

The VPS side is different. `VPS-CRONS.md` says the canonical crontab is
`/srv/crons/crontab.txt` **on the VPS**, in a separate `vps-crons` repo. Confirming a VPS
cron ran therefore needs SSH to `root@72.61.241.170`. That is a network action with a real
side effect on someone's expectations, so it is **gated behind an explicit flag** and skipped
by default, with the check saying so rather than staying silent.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Test suite (merge gate) | `bash tooling/maintainer/test-maintainer.sh` | exit 0, `ALL PASS` |
| Run uptime | `bash tooling/maintainer/bin/run-job.sh uptime` | exit 0 or 1, never 2 |
| Run crons | `bash tooling/maintainer/bin/run-job.sh crons` | exit 0 or 1, never 2 |
| Site probe | `bash scripts/probe-sites.sh` | exit 1 + `DOWN_SITES:` if any is down |
| Loaded launchd agents | `launchctl list` | one line per loaded job |

## Scope

**In scope**:
- `tooling/maintainer/jobs/uptime/{README.md,runbook.md,check.sh}` (new)
- `tooling/maintainer/jobs/crons/{README.md,runbook.md,check.sh}` (new)
- `tooling/maintainer/CLAUDE.md` — flip both rows to live
- `tooling/maintainer/test-maintainer.sh` — assertions for both

**Out of scope**:
- `scripts/probe-sites.sh`, `scripts/check-apps.sh` — these jobs **call** them unchanged.
- `my-hosted-sites.md`, `INFRA.md`, `VPS-CRONS.md`, `MAC-LAUNCHD.md` — read-only here.
  Reconciling them is a session action after approval.
- **Restarting, reloading, repairing or installing any cron or launchd agent.** Reporting
  only.
- The `vps-crons` repo. Different repo, not cloned here.
- Neither job gets a `fix.sh` — there is no zero-judgement repair.

## Git workflow

- Branch: `advisor/247-maintainer-uptime-and-crons-jobs`
- Commit: `feat(maintainer): the uptime and crons jobs` — no AI footers. Do NOT push.

## Steps

### Step 1: `jobs/uptime/check.sh`

```bash
#!/bin/bash
# uptime — are the deployed surfaces up, and do the inventories agree.
# Exit 0 = nothing found, 1 = findings, 2 = a check itself broke.
#
# UPTIME_SITES / UPTIME_INFRA point at fixtures. UPTIME_PROBE=1 makes real requests.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../bin" && pwd)/lib.sh"

SITES="${UPTIME_SITES:-$REPO_ROOT/my-hosted-sites.md}"
INFRA="${UPTIME_INFRA:-$REPO_ROOT/INFRA.md}"

found=0
note() { echo "- $1"; found=1; }

echo "# uptime findings — $(today)"
echo

[ -f "$SITES" ] || die "no site index at $SITES"

echo "## 1. inventory drift — a URL in one doc and not the other"
urls_s="$("$GREP" -oE 'https?://[a-zA-Z0-9./_-]+' "$SITES" | "$SED" 's|/*$||' | sort -u)"
urls_i=""
[ -f "$INFRA" ] && urls_i="$("$GREP" -oE 'https?://[a-zA-Z0-9./_-]+' "$INFRA" | "$SED" 's|/*$||' | sort -u)"
for u in $urls_i; do
  echo "$urls_s" | "$GREP" -qxF "$u" || note "IN-INFRA-NOT-SITES $u"
done
echo
echo "  (the reverse direction is NOT a defect: my-hosted-sites.md is the flat index of"
echo "   every live URL, so it legitimately holds more than INFRA.md.)"
echo

echo "## 2. reachability"
if [ "${UPTIME_PROBE:-0}" = "1" ]; then
  if out="$(bash "$REPO_ROOT/scripts/probe-sites.sh" 2>&1)"; then
    echo "- all probed sites reachable"
  else
    echo "$out" | "$GREP" 'DOWN_SITES:' | while read -r l; do echo "- $l"; done
    found=1
  fi
else
  echo "- skipped (set UPTIME_PROBE=1 — it makes real network requests)"
fi
echo

echo "## 3. app checks"
if [ "${UPTIME_APPS:-0}" = "1" ]; then
  bash "$REPO_ROOT/scripts/check-apps.sh" >/dev/null 2>&1 || note "check-apps.sh reported a failing app"
else
  echo "- skipped (set UPTIME_APPS=1 — it installs and runs every app's test suite)"
fi

exit $found
```

Both expensive halves are opt-in. A hygiene check that takes ten minutes and hits the network
by default will not get run.

### Step 2: `jobs/crons/check.sh`

```bash
#!/bin/bash
# crons — did the scheduled work actually happen.
# Exit 0 = nothing found, 1 = findings, 2 = a check itself broke.
#
# CRONS_LAUNCHD points at a fixture MAC-LAUNCHD.md. CRONS_SSH=1 probes the VPS.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../bin" && pwd)/lib.sh"

LAUNCHD_DOC="${CRONS_LAUNCHD:-$REPO_ROOT/MAC-LAUNCHD.md}"
STALE_DAYS="${CRONS_STALE_DAYS:-14}"

found=0
note() { echo "- $1"; found=1; }

echo "# crons findings — $(today)"
echo

[ -f "$LAUNCHD_DOC" ] || die "no launchd inventory at $LAUNCHD_DOC"

echo "## 1. launchd jobs — loaded, and writing a log"
# The Logs table gives one row per job: | <job> | `<path>` |
"$GREP" -oE '^\| *[a-z0-9.-]+ *\| *`[^`]+` *\|' "$LAUNCHD_DOC" | while IFS='|' read -r _ job logp _; do
  job="$(echo "$job" | tr -d ' ')"
  logp="$(echo "$logp" | tr -d ' `')"
  [ -n "$job" ] || continue
  case "$logp" in
    '~'*) logp="$HOME${logp#\~}" ;;
  esac
  if [ ! -f "$logp" ]; then
    echo "- NO-LOG $job (expected $logp, not there — the job may never have run)"
  elif [ -n "$("$FIND" "$logp" -mtime +"$STALE_DAYS" 2>/dev/null)" ]; then
    echo "- STALE-LOG $job (last written over $STALE_DAYS days ago: $logp)"
  fi
done
echo

echo "## 2. launchd jobs documented but not loaded"
if command -v launchctl >/dev/null 2>&1; then
  loaded="$(launchctl list 2>/dev/null | "$AWK" '{print $3}')"
  "$GREP" -oE '`com\.[a-z0-9.-]+`' "$LAUNCHD_DOC" | tr -d '`' | sort -u | while read -r lbl; do
    echo "$loaded" | "$GREP" -qxF "$lbl" || echo "- NOT-LOADED $lbl (documented, not in launchctl list)"
  done
else
  echo "- launchctl not available on this machine; skipped"
fi
echo

echo "## 3. VPS crons"
if [ "${CRONS_SSH:-0}" = "1" ]; then
  echo "- (SSH probe requested — see runbook.md for the exact command and what to read)"
else
  echo "- NOT CHECKED. The canonical crontab lives at /srv/crons/crontab.txt on the VPS,"
  echo "  in the separate vps-crons repo, so confirming a run needs SSH. Set CRONS_SSH=1"
  echo "  to probe deliberately. Silence here is 'not checked', never 'fine'."
fi

exit $found
```

Section 3 saying "NOT CHECKED" out loud is the point. An unchecked thing that prints nothing
is indistinguishable from a healthy one — the failure shape LESSONS 2026-08-02 records.

### Step 3: READMEs, runbooks, CLAUDE.md rows

Each job gets a one-screen `README.md` and a `runbook.md`. The crons runbook carries the exact
SSH command for the VPS half (`ssh root@72.61.241.170 'crontab -l'` and where each cron's log
lives per `VPS-CRONS.md`), and the standing rule: **this job reports; it never restarts,
reloads or repairs anything.**

Flip both rows in `tooling/maintainer/CLAUDE.md` to live.

**Verify**:
```bash
bash tooling/maintainer/bin/session-start.sh | grep -q '^uptime'
bash tooling/maintainer/bin/session-start.sh | grep -q '^crons'
```

### Step 4: Tests, against fixtures — no network, no SSH

```bash
# --- crons job: fixture launchd inventory -----------------------------------
CFIX="$TMP/cronfix"; mkdir -p "$CFIX"
cat > "$CFIX/MAC-LAUNCHD.md" <<EOF
## Logs
| Job | Log |
|---|---|
| present-job | \`$CFIX/present.log\` |
| missing-job | \`$CFIX/definitely-missing.log\` |
EOF
printf 'ran\n' > "$CFIX/present.log"

out="$(CRONS_LAUNCHD="$CFIX/MAC-LAUNCHD.md" bash "$MAINTDIR/jobs/crons/check.sh" 2>&1)"
echo "$out" | grep -q 'NO-LOG missing-job'  || fail "crons check did not report the launchd job with no log"
echo "$out" | grep -q 'NO-LOG present-job'  && fail "crons check flagged a job whose log exists"
echo "$out" | grep -q 'NOT CHECKED'         || fail "crons check must say the VPS half was not checked"

# --- uptime job: fixture inventories, probing disabled ----------------------
UFIX="$TMP/upfix"; mkdir -p "$UFIX"
printf '# sites\n- https://a.example\n' > "$UFIX/sites.md"
printf '# infra\n- https://a.example\n- https://only-in-infra.example\n' > "$UFIX/infra.md"
out="$(UPTIME_SITES="$UFIX/sites.md" UPTIME_INFRA="$UFIX/infra.md" bash "$MAINTDIR/jobs/uptime/check.sh" 2>&1)"
echo "$out" | grep -q 'IN-INFRA-NOT-SITES https://only-in-infra.example' || fail "uptime check did not report inventory drift"
echo "$out" | grep -q 'skipped'  || fail "uptime check must skip the network probe by default"
```

The `crons check did not report the launchd job with no log` string is what the mutation gate
asserts on. Do not reword it.

**Verify**: `bash tooling/maintainer/test-maintainer.sh` -> exit 0, `ALL PASS`.

### Step 5: Commit

```bash
git add tooling/maintainer/jobs/uptime tooling/maintainer/jobs/crons \
        tooling/maintainer/CLAUDE.md tooling/maintainer/test-maintainer.sh
git commit -m "feat(maintainer): the uptime and crons jobs"
```

Do not push.

## Test plan

Both checks run against **fixture** inventory files, and every expensive or networked path is
opt-in and off by default — so the suite makes no request and opens no SSH connection.

Assertions run in both directions: the missing log is flagged, the present one is not.

One assertion protects the honesty property: the crons check must print `NOT CHECKED` for the
VPS half rather than staying silent.

## Done criteria

- [ ] `bash tooling/maintainer/test-maintainer.sh` -> exit 0, `ALL PASS`
- [ ] `discover_jobs` includes both `crons` and `uptime`
- [ ] `bash tooling/maintainer/bin/run-job.sh uptime` -> exit 0 or 1, never 2
- [ ] `bash tooling/maintainer/bin/run-job.sh crons` -> exit 0 or 1, never 2
- [ ] `grep -c 'UPTIME_PROBE' tooling/maintainer/jobs/uptime/check.sh` -> at least `1`
      (network is opt-in)
- [ ] `grep -c 'CRONS_SSH' tooling/maintainer/jobs/crons/check.sh` -> at least `1`
      (SSH is opt-in)
- [ ] `grep -rcE '\b(ssh|curl|launchctl (load|unload|bootstrap|kickstart))\b' tooling/maintainer/jobs/crons/check.sh`
      -> `0` outside the `CRONS_SSH` branch and the read-only `launchctl list`
- [ ] Neither job has a `fix.sh`
- [ ] Running both jobs modifies nothing: `git status --porcelain` clean afterwards

## STOP conditions

- **You are about to SSH anywhere without `CRONS_SSH=1` being explicitly set.** A hygiene
  check must not open a connection to production by default.
- **You are about to restart, reload, install or repair a cron or launchd agent.** Reporting
  only. Repairing a scheduled job unattended is how you get two copies running.
- **You are about to edit `my-hosted-sites.md`, `INFRA.md`, `VPS-CRONS.md` or
  `MAC-LAUNCHD.md`.** Reconciling them is the session's action after approval.
- **You are about to make the network probe or the app suite run by default.** Both are slow;
  a slow check does not get run, and a check that does not get run is worse than none.
- **You are about to let the VPS half print nothing when it is skipped.** Silence reads as
  healthy. It must say `NOT CHECKED`.
- **A gate assertion fails and you want to change it.** Fix the code (LESSONS 2026-07-31).
- **`check.sh` exits 2.** The check broke. Never report it clean.

## Maintenance notes

- The Mac half works because `MAC-LAUNCHD.md` documents a log path per job. If a new launchd
  job is added without a Logs-table row, this check cannot see it — so adding the row is part
  of adding the job.
- The VPS half stays SSH-gated on purpose. If a later plan wants it automatic, the right move
  is for each VPS cron to write a heartbeat the Mac can read, not for this check to hold
  credentials.
- The `IN-INFRA-NOT-SITES` direction is asymmetric on purpose: `my-hosted-sites.md` is the
  superset. Flagging the reverse would be noise.
