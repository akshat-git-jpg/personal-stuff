# Plan 027: Hourly uptime probe over every hosted site, alerting via Telegram

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md` (in personal-stuff).
>
> **⚠️ TWO REPOS**: the probe script lives in `~/codebase/personal-stuff`
> (Pattern B "project code"); the cron wrapper lives in `~/codebase/vps-crons`
> (Pattern B "wiring"). Both must be clean before starting.
>
> **Drift check (run first)**:
> `git diff --stat 671741e..HEAD -- my-hosted-sites.md scripts/` (personal-stuff)
> and confirm `~/codebase/vps-crons/_shared/alert.sh` exists (created by plan
> 025 — hard dependency).

## Status

- **Priority**: P3
- **Effort**: S-M
- **Risk**: LOW (read-only probes; new cron)
- **Depends on**: plans/025-cron-failure-alerts.md (uses `_shared/alert.sh` + the updated `_template/run.sh`)
- **Category**: feature
- **Executor**: antigravity
- **Difficulty**: standard
- **Planned at**: personal-stuff commit `671741e`, 2026-07-05

## Why this matters

~12 sites are live (see `my-hosted-sites.md`) — mostly Cloudflare Workers,
independent of the VPS. The only automated liveness check anywhere is the
vps-watchdog Worker probing ONE URL (the personal dashboard) to decide VPS
reboots. A broken `wrangler deploy`, an expired custom-domain route, or a dead
container behind render2 goes unnoticed until a human opens the page.

After this plan: an hourly VPS cron GETs every URL in `my-hosted-sites.md`
and Telegrams a single message listing any site that isn't answering. The
site list stays in the markdown file — adding a site to the doc adds it to
monitoring, no second registry.

## Current state

`my-hosted-sites.md` (personal-stuff root, 15 lines) — one site per `- ` line,
format: `- <Name> — <url> (<notes>)`. Exact current URLs:

```
https://kushal-tools.agrolloo.com    https://kushal-gym.agrolloo.com
https://kushal-docs.agrolloo.com     https://my-dashboard.agrolloo.com
https://tutorials-tracker.agrolloo.com  https://yt-analytics.agrolloo.com
https://founders.agrolloo.com        https://lists.agrolloo.com
https://go.agrolloo.com              https://keto-kitchen.ag
https://bridebestie.com              https://render2.agrolloo.com
```

plus one `http://localhost:4319/` line (ccu-dash) that must be EXCLUDED
(non-public). Note `go.agrolloo.com`'s root URL may return a 404/redirect by
design (it's a shortener) — the probe must treat ANY HTTP response as "up"
and only network-level failure/timeout/5xx as "down".

Pattern B contract (from `VPS-CRONS.md`): project code in personal-stuff
(runnable on the Mac), thin wrapper + schedule + secrets in vps-crons. The
wrapper shape to copy is `~/codebase/vps-crons/_template/run.sh` (as updated
by plan 025). Auth model: the job's `.env` provides `TELEGRAM_BOT_TOKEN` +
`TELEGRAM_CHAT_ID`; `_shared/telegram.sh` provides `send_telegram`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Probe locally (Mac) | `./scripts/probe-sites.sh` | exit 0, per-site OK lines |
| Probe failure path | `./scripts/probe-sites.sh --include-localhost` | exit 1 (localhost:4319 down unless dashboard running) |
| Syntax | `bash -n scripts/probe-sites.sh` and on the wrapper | exit 0 |

## Scope

**In scope** (personal-stuff):
- `scripts/probe-sites.sh` (create)
- `scripts/README.md` (add one line to the "Scripts here" list)

**In scope** (vps-crons):
- `site-probe/run.sh`, `site-probe/README.md`, `site-probe/.env.example` (create, from `_template/`)
- `crontab.txt` (add one line)
- root `README.md` (add index row for the new cron)

**Out of scope**:
- `infra/vps-watchdog/` (different job: VPS reboot; untouched).
- `my-hosted-sites.md` (the probe READS it; never writes).
- Any VPS-side activation (owner follow-up).

## Git workflow

- personal-stuff branch: `advisor/027-site-uptime-probe`; commit
  `feat(scripts): probe-sites.sh — parse my-hosted-sites.md, curl each, report down sites`
- vps-crons branch: `advisor/027-site-probe-cron`; commit
  `feat(site-probe): hourly uptime cron over my-hosted-sites.md`
- No AI footers. Do NOT push either repo.

## Steps

### Step 1: Write `scripts/probe-sites.sh` (personal-stuff)

Requirements (write clean bash, `set -uo pipefail` but NOT `-e` — a down site
must not abort the loop):

- Locate the sites file relative to the script:
  `SITES_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/my-hosted-sites.md"`.
- Extract URLs: every `https?://[^ )]*` match on `- ` lines; skip
  `localhost` URLs unless `--include-localhost` is passed.
- Probe each: `curl -sS -o /dev/null -m 15 -L -w '%{http_code}' <url>` with
  `--retry 1`. Classify: curl non-zero exit OR http_code ≥ 500 OR
  http_code == 000 → DOWN; anything else (2xx/3xx/4xx) → UP (4xx is "up" —
  password gates return 401/403 and the shortener root may 404).
- Print one line per site: `OK  200 https://...` / `DOWN 503 https://...`.
- If any DOWN: print a final `DOWN_SITES:` line listing them space-separated,
  exit 1. Else print `all N sites up`, exit 0.
- No secrets, no Telegram in this script — delivery is the wrapper's job
  (Pattern B invariant 3: "Wrapper owns delivery").

**Verify**: `bash -n scripts/probe-sites.sh` → exit 0, then
`./scripts/probe-sites.sh; echo "exit=$?"` → per-site lines for 12 sites,
`exit=0` (all currently-live sites should answer; if one is genuinely down,
the exit is 1 — note which and continue, that's the tool working).

### Step 2: Scaffold the cron wrapper (vps-crons)

`cp -r ~/codebase/vps-crons/_template ~/codebase/vps-crons/site-probe`, then
edit `site-probe/run.sh`: keep the .env + telegram + alert.sh + logs plumbing
from the template (incl. `enable_failure_alert "site-probe" ...` from plan
025), git-pull personal-stuff per the Pattern B contract, then:

```bash
PROBE="$PROJECT_REPO/scripts/probe-sites.sh"
if OUT="$("$PROBE" 2>&1)"; then
  echo "$OUT"
  echo "all up"
else
  echo "$OUT"
  DOWN_LINE="$(printf '%s\n' "$OUT" | grep '^DOWN_SITES:' || true)"
  send_telegram "🔴 site-probe: ${DOWN_LINE:-probe failed entirely}
$(printf '%s\n' "$OUT" | grep '^DOWN ' || true)"
fi
```

(`PROJECT_REPO=/srv/projects/personal-stuff` as in the template.) The wrapper
exits 0 even when sites are down — a down SITE is a delivered alert, not a
failed CRON; `enable_failure_alert` covers the cron itself dying.

Write `site-probe/README.md` (what/when/where-code-lives, following
`my-planner/README.md`'s shape) and `.env.example` (Telegram vars only).

**Verify**: `bash -n ~/codebase/vps-crons/site-probe/run.sh` → exit 0.

### Step 3: Schedule it

Append to `~/codebase/vps-crons/crontab.txt` (hourly, on the half-hour to
avoid the 00:30 digest pile-up):

```
# site-probe: GET every URL in my-hosted-sites.md; Telegram on any down site. Hourly.
15 * * * * /srv/crons/site-probe/run.sh >> /srv/crons/site-probe/logs/cron.log 2>&1
```

Add the index row to the vps-crons root `README.md` cron table.

**Verify**: `grep -c 'site-probe' ~/codebase/vps-crons/crontab.txt` → 1.

### Step 4: Register the script in scripts/README.md (personal-stuff)

Add one line to the "Scripts here" list:
`probe-sites.sh — parses my-hosted-sites.md and curls every public URL; exit 1 + DOWN_SITES: line if any site is unreachable/5xx. Run by the site-probe VPS cron hourly; safe to run by hand.`

**Verify**: `grep -c 'probe-sites' scripts/README.md` → ≥ 1.

## Test plan

1. Live probe run (Step 1 verify) — real result against real sites.
2. Down-site path: `echo '- Fake — https://definitely-not-real-12345.agrolloo.com' >> /tmp/fake-sites.md`
   is NOT possible since the file path is fixed — instead verify the DOWN path
   by running with `--include-localhost` while the local dashboard is NOT
   running: expect a `DOWN` line for `http://localhost:4319/` and exit 1.
3. Wrapper logic can't run on the Mac (absolute `/srv/` paths) — `bash -n`
   plus review is the gate; live smoke happens at owner activation.

## Done criteria

- [ ] `./scripts/probe-sites.sh` exit 0 with 12 OK lines (or documented real DOWNs)
- [ ] `--include-localhost` with dashboard stopped → DOWN + exit 1
- [ ] vps-crons: site-probe/{run.sh,README.md,.env.example} exist; crontab.txt + README.md rows added
- [ ] `bash -n` green on both new shell files
- [ ] Both repos: `git status` clean outside in-scope files (plus plans/README.md)
- [ ] `plans/README.md` status row updated

## STOP conditions

- `~/codebase/vps-crons/_shared/alert.sh` does not exist (plan 025 not merged
  — this plan depends on it).
- `my-hosted-sites.md` format differs from the excerpt (URLs not extractable
  by the stated pattern).
- More than 2 sites probe DOWN on the first live run (either the network is
  bad or the classifier is wrong — report, don't ship).

## Maintenance notes

- **Owner follow-up:** push+merge both repos; on the VPS: `cd /srv/crons &&
  git pull`, `cp site-probe/.env.example site-probe/.env` + fill Telegram
  vars, `crontab /srv/crons/crontab.txt`, then one manual
  `/srv/crons/site-probe/run.sh` smoke run.
- Adding a site = adding its line to `my-hosted-sites.md` (which plan 002
  already made a routing-audit target) — monitoring follows automatically.
- If agrolloo.com ever moves behind Cloudflare Access, 403s stay "up" by
  design here; revisit the classifier then.
