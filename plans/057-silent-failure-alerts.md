---
executor: agy
model:
test_cmd: python3 infra/cred-probe/cred_probe.py --self-test && node --check infra/vps-watchdog/src/index.js && bash -n apps/telegram-email-assistant/digest.sh
ui: false
deploy:
needs: []
---

# Plan 057: Silent-failure alerts — credential-health probe, watchdog reboot notify, digest shape check

## Summary

- **Problem statement**: Three automations can fail (or act) without the owner ever hearing about it: Google OAuth tokens die silently (my-planner's token failed daily for 5+ weeks before being noticed), the vps-watchdog reboots the VPS writing only to KV, and the gmail digest ships any non-empty `claude -p` output unvalidated.
- **Goals**:
  - New `infra/cred-probe/` — stdlib-only Python probe that verifies every Google OAuth refresh token still refreshes, plus a Pattern-B cron wrapper example for the VPS.
  - `infra/vps-watchdog` sends a Telegram message whenever it reboots the VPS (or fails to).
  - `apps/telegram-email-assistant/digest.sh` asserts the digest output has the expected two-part shape before printing it.
- **Executor proposed**: agy, executor-default model (Gemini 3.1 Pro (High)).
- **Done criteria** (terse): test_cmd green; probe self-test passes offline; watchdog notifies on `rebooted`/`reboot_failed`; digest.sh rejects malformed output with an `ERROR:` line.
- **Stop conditions** (terse): file drift vs excerpts below; any live network call to Google/Telegram/HeyGen during implementation or tests.
- **Test / verification for success**: offline self-test + `node --check` + `bash -n` (the test_cmd).
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report.
> Do NOT edit `plans/README.md` (it is boss-owned on main).
>
> **Drift check (run first)**: `git diff --stat 855cdf9..HEAD -- infra/vps-watchdog/src/index.js apps/telegram-email-assistant/digest.sh infra/cred-probe/`
> Expect: no changes (infra/cred-probe/ must not exist yet). If it shows changes, STOP.

## Status

- **Priority**: P1
- **Effort**: S-M
- **Risk**: LOW (new code + additive guard; the only behavior change to an existing path is digest.sh's output capture)
- **Depends on**: none
- **Category**: bug / reliability
- **Difficulty**: standard
- **Planned at**: commit `855cdf9`, 2026-07-11

## Why this matters

The repo's automation architecture alerts on *process* failure (`vps-crons/_shared/alert.sh` traps non-zero exits) but not on these three classes:

1. **Credential death** is the #1 observed silent killer: `decisions.md` 2026-07-06 records my-planner's vendored OAuth token failing with `invalid_grant` every day since 2026-06-01 — five weeks unnoticed, because the failure produced no owner-visible signal. Five Google accounts' tokens live in `tooling/mcp/google-shared/tokens/` and nothing verifies they still refresh.
2. **The watchdog acts silently**: `infra/vps-watchdog/src/index.js` reboots the VPS (the machine every cron runs on) and records the event only in KV. A reboot loop looks identical to a healthy day unless the owner manually curls the status endpoint.
3. **The gmail digest ships garbage**: `vps-crons/gmail-digest/run.sh` (separate repo, lines 73–77) catches *empty* output, but any non-empty malformed text (a refusal, a half-answer, an error dump that exits 0) goes straight to Telegram as if it were the digest.

## Current state

### `infra/vps-watchdog/src/index.js` (122 lines) — the reboot path writes KV only

Lines 85–94 today:

```js
  const reboot = await rebootVps(env.HOSTINGER_API_TOKEN, env.VPS_ID);
  result.action = reboot.ok ? 'rebooted' : 'reboot_failed';
  result.reboot = reboot;
  if (reboot.ok) await env.WATCHDOG_KV.put('last_reboot', String(now));
  await env.WATCHDOG_KV.put('last_status', JSON.stringify(result));
  await env.WATCHDOG_KV.put(`event:${now}`, JSON.stringify(result), {
    expirationTtl: 60 * 60 * 24 * 30,
  });
  return result;
```

`wrangler.jsonc` documents two secrets (`HOSTINGER_API_TOKEN`, `STATUS_SECRET`) in a trailing comment; vars include `TARGET_URL` and `FAIL_THRESHOLD`.

### `apps/telegram-email-assistant/digest.sh` (117 lines) — output is exec'd, never validated

Lines 108–117 today:

```bash
# Resolve claude binary — works on Mac (homebrew) and VPS (~/.local/bin/claude).
CLAUDE_BIN="${CLAUDE_BIN:-$(command -v claude || echo /root/.local/bin/claude)}"

# Run Claude non-interactively. No --mcp-config, no --allowed-tools for MCP.
# acceptEdits handles any incidental file writes but Claude isn't expected
# to need any tools — just produce the digest text.
exec "$CLAUDE_BIN" -p \
  --output-format text \
  --permission-mode acceptEdits \
  <<< "$FULL_PROMPT"
```

The expected output format (from `apps/telegram-email-assistant/digest-prompt.md`) always contains the literal substrings `Part 1: Overall summary` and `Part 2: Per your preferences`.

### Token layout (what the probe reads)

`tooling/mcp/google-shared/tokens/` holds one `<email>@gmail.com.json` per account (5 today) in Google "authorized user" format — JSON objects carrying `client_id`, `client_secret`, and `refresh_token` keys — plus `akshatpatidar17@gmail.com.filters.json`, which is NOT a token (no `refresh_token` key) and must be skipped. On the VPS the same dir is `/srv/projects/personal-stuff/tooling/mcp/google-shared/tokens/`, and there is one extra vendored copy at `/srv/projects/personal-stuff/apps/telegram-my-planner/tools/daily-digest/token.json` (the file that died in the 2026-06 incident).

A Google refresh probe is `POST https://oauth2.googleapis.com/token` with form fields `client_id`, `client_secret`, `refresh_token`, `grant_type=refresh_token`. HTTP 200 with an `access_token` in the body = healthy. HTTP 4xx with `"invalid_grant"` in the body = dead token. Anything else = transient error. Probing does not rotate or invalidate anything.

### `infra/cred-probe/` — does not exist yet.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Probe self-test (offline) | `python3 infra/cred-probe/cred_probe.py --self-test` | prints `self-test ok`, exit 0 |
| Worker syntax check | `node --check infra/vps-watchdog/src/index.js` | exit 0, no output |
| digest.sh syntax check | `bash -n apps/telegram-email-assistant/digest.sh` | exit 0 |
| Wrapper syntax check | `bash -n infra/cred-probe/run.sh.example` | exit 0 |

## Scope

**In scope**:
- `infra/cred-probe/cred_probe.py` (new)
- `infra/cred-probe/run.sh.example` (new)
- `infra/cred-probe/README.md` (new)
- `infra/vps-watchdog/src/index.js` (edit)
- `infra/vps-watchdog/wrangler.jsonc` (comment-only edit)
- `apps/telegram-email-assistant/digest.sh` (edit)

**Out of scope** (do NOT touch):
- Anything under `tooling/mcp/google-shared/` (especially `tokens/` — never read real token contents into output)
- `~/codebase/vps-crons` (separate repo — VPS wiring is a post-merge manual step)
- `VPS-CRONS.md` (plan 058 owns that refresh)
- `plans/README.md`, `decisions.md`

## Git workflow

- Branch: `advisor/057-silent-failure-alerts`
- Commits: one per step, conventional style (e.g. `feat(cred-probe): stdlib oauth refresh prober`) — no AI footers. Do NOT push.

## Steps

### Step 1: `infra/cred-probe/cred_probe.py`

Create the probe, stdlib only (`argparse`, `json`, `pathlib`, `sys`, `urllib.request`, `urllib.parse`, `urllib.error`). Structure:

```python
#!/usr/bin/env python3
"""Verify every Google OAuth refresh token still refreshes.

Silent token death is this repo's #1 automation killer (a vendored token
failed daily for 5+ weeks, decisions.md 2026-07-06). This probe POSTs a
refresh_token grant for each token file and reports OK / DEAD / ERROR.
It never writes anything: refreshing does not rotate the refresh token.

Usage:
  cred_probe.py                       # probe default dir (repo tokens/)
  cred_probe.py --extra /path/t.json  # also probe an extra token file
  cred_probe.py --self-test           # offline logic check, no network
Exit: 0 all OK, 1 any DEAD/ERROR, 2 usage/self-test failure.
"""
```

Required functions (keep the network isolated so the self-test needs none):

- `find_tokens(dirs, extras) -> list[Path]` — glob `*.json` in each dir, add extras; a file qualifies only if its JSON has a `refresh_token` key (else it's reported as `SKIP <name>`; e.g. the `.filters.json` file).
- `build_refresh_body(tok: dict) -> bytes` — urlencoded `client_id`, `client_secret`, `refresh_token`, `grant_type=refresh_token`.
- `classify(status: int, body: str) -> str` — pure: `200` + `"access_token"` in body → `"OK"`; 4xx + `"invalid_grant"` in body → `"DEAD"`; everything else → `"ERROR"`.
- `probe(path: Path) -> tuple[str, str]` — loads the file, POSTs to `https://oauth2.googleapis.com/token` (timeout 30s, catch `urllib.error.HTTPError` to read its status/body, catch other exceptions → `("ERROR", str(e))`), returns `(classify(...), detail)`. **Never include token values in any output — name and status only.**
- `main()` — default token dir is `<repo_root>/tooling/mcp/google-shared/tokens` where `repo_root = Path(__file__).resolve().parents[2]`. Print one line per file: `OK <name>` / `DEAD <name> <short reason>` / `ERROR <name> <short reason>` / `SKIP <name>` (name = filename without `.json`). Exit 0 iff no DEAD and no ERROR.
- `self_test()` — no network: assert `classify(200, '{"access_token":"x"}') == "OK"`, `classify(400, '{"error":"invalid_grant"}') == "DEAD"`, `classify(500, '') == "ERROR"`, `classify(200, '{}') == "ERROR"`; assert `build_refresh_body({"client_id":"a","client_secret":"b","refresh_token":"c"})` contains `grant_type=refresh_token` and all three values; assert a dict without `refresh_token` is skipped by the qualify check. Print `self-test ok`.

**Verify**: `python3 infra/cred-probe/cred_probe.py --self-test` → `self-test ok`, exit 0. Do NOT run the probe without `--self-test` (it would hit Google live — works, but keep live calls out of this run).

### Step 2: `infra/cred-probe/run.sh.example` + `README.md`

`run.sh.example` — the Pattern-B wrapper the owner will copy into `vps-crons/cred-probe/run.sh` (see `VPS-CRONS.md` "The Pattern B contract"; model it on that file's template shape):

```bash
#!/usr/bin/env bash
# cred-probe: daily credential-health check → Telegram on failure only.
set -euo pipefail
JOB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$JOB_DIR"
[[ -f .env ]] && set -a && source .env && set +a
source /srv/crons/_shared/telegram.sh
source /srv/crons/_shared/alert.sh
enable_failure_alert "cred-probe" "$JOB_DIR/logs/cron.log"
source /srv/crons/_shared/claude-env.sh

PROJECT_REPO="/srv/projects/personal-stuff"
git -C "$PROJECT_REPO" pull --quiet 2>>"$JOB_DIR/logs/git.log" \
  && echo "git pull: ok" || echo "git pull: failed; using existing checkout"

FAILS=""

# 1. Google OAuth tokens: shared dir + the my-planner vendored copy.
if ! OUT=$(python3 "$PROJECT_REPO/infra/cred-probe/cred_probe.py" \
      --extra "$PROJECT_REPO/apps/telegram-my-planner/tools/daily-digest/token.json"); then
  FAILS+="$OUT"$'\n'
fi
echo "$OUT"

# 2. Claude Code auth on the VPS (the LLM crons ride it).
if ! "$CLAUDE_BIN" auth status >/dev/null 2>&1; then
  FAILS+="DEAD claude-auth (claude auth status failed)"$'\n'
fi

if [[ -n "$FAILS" ]]; then
  send_telegram "🔑 cred-probe failures:
$FAILS
Rotate per VPS-CRONS.md §'Rotate a Google OAuth token'."
  exit 1
fi
echo "all credentials healthy"
```

`README.md` — short: what it probes, why (the 2026-06 silent token death), the crontab line `30 23 * * * /srv/crons/cred-probe/run.sh >> /srv/crons/cred-probe/logs/cron.log 2>&1` (05:00 IST daily — before the 06:00 IST digests, so a dead token alerts before the digests fail), and the post-merge wiring steps (copy `run.sh.example` → `vps-crons/cred-probe/run.sh`, create `.env` with Telegram creds, add crontab line, smoke-test once).

**Verify**: `bash -n infra/cred-probe/run.sh.example` → exit 0.

### Step 3: watchdog Telegram notify

In `infra/vps-watchdog/src/index.js`, add above `runCheck`:

```js
// Fire-and-forget Telegram alert. A reboot the owner never hears about is
// indistinguishable from a healthy day — this closes that gap.
async function sendTelegram(env, text) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    // alerting must never break the watchdog itself
  }
}
```

Then in `runCheck`, immediately after `result.reboot = reboot;` (before the KV puts), insert:

```js
  await sendTelegram(
    env,
    `🐕 vps-watchdog: ${reboot.ok ? 'REBOOTED the VPS' : `reboot FAILED (Hostinger API ${reboot.status})`} — ${env.TARGET_URL} failed ${threshold} consecutive probes.`
  );
```

Update the trailing comment in `wrangler.jsonc` to list the two new **optional** secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (same bot as the VPS crons; values live in `infra/secrets/telegram.env` on the Mac). No other wrangler changes; do not deploy.

**Verify**: `node --check infra/vps-watchdog/src/index.js` → exit 0.

### Step 4: digest.sh shape check

In `apps/telegram-email-assistant/digest.sh`, replace the final `exec … <<< "$FULL_PROMPT"` block (current lines 111–117, excerpted above) with:

```bash
# Run Claude non-interactively and validate the output SHAPE before shipping.
# run.sh (vps-crons) only catches empty output; a non-empty refusal or error
# dump that exits 0 would otherwise go to Telegram as if it were the digest.
DIGEST_OUTPUT=$("$CLAUDE_BIN" -p \
  --output-format text \
  --permission-mode acceptEdits \
  <<< "$FULL_PROMPT")

if [[ ${#DIGEST_OUTPUT} -lt 200 \
      || "$DIGEST_OUTPUT" != *"Part 1: Overall summary"* \
      || "$DIGEST_OUTPUT" != *"Part 2: Per your preferences"* ]]; then
  echo "ERROR: digest output failed shape check (${#DIGEST_OUTPUT} chars, expected Part 1/Part 2 sections) for $EMAIL"
  exit 1
fi

printf '%s\n' "$DIGEST_OUTPUT"
```

Keep the comment above `CLAUDE_BIN` resolution unchanged. The `ERROR:` line + exit 1 is exactly the contract `vps-crons/gmail-digest/run.sh` already alerts on — no change needed in the other repo.

**Verify**: `bash -n apps/telegram-email-assistant/digest.sh` → exit 0.

## Test plan

The full offline gate is the frontmatter `test_cmd`:

```
python3 infra/cred-probe/cred_probe.py --self-test && node --check infra/vps-watchdog/src/index.js && bash -n apps/telegram-email-assistant/digest.sh
```

All three components are exercised without any network call. Live verification (owner, post-merge): one manual `run.sh` execution on the VPS for cred-probe; `curl 'https://<watchdog>/?secret=…&dry=1'` still returns JSON; one morning's digest arrives normally.

## Done criteria

- [ ] test_cmd exits 0.
- [ ] `infra/cred-probe/` contains `cred_probe.py`, `run.sh.example`, `README.md`; the probe's non-self-test path was never executed in this run.
- [ ] Watchdog calls `sendTelegram` on both `rebooted` and `reboot_failed`, and never throws from the alert path.
- [ ] digest.sh prints an `ERROR:` line and exits 1 on malformed output; passes the two-substring check on well-formed output.
- [ ] No file outside the in-scope list changed (`git diff --stat` vs base shows only in-scope paths).

## STOP conditions

- The drift check shows any of the three target files changed since `855cdf9`.
- Implementing any step would require a live call to Google, Telegram, Hostinger, or `claude -p` — everything here must verify offline.
- `tooling/mcp/google-shared/tokens/` contents would end up quoted in code, tests, or output — token *values* must never appear anywhere.

## Post-merge (owner / SSH-holding session — not the executor)

1. Watchdog: `cd infra/vps-watchdog && npx wrangler secret put TELEGRAM_BOT_TOKEN && npx wrangler secret put TELEGRAM_CHAT_ID && npx wrangler deploy` (values from `infra/secrets/telegram.env`).
2. VPS: create `vps-crons/cred-probe/` from `run.sh.example` per its README, `.env` with Telegram creds, add the crontab line, `crontab /srv/crons/crontab.txt`, smoke-test `/srv/crons/cred-probe/run.sh` once.
3. Plan 058 documents both new crons in `VPS-CRONS.md` — land 057 first.

## Maintenance notes

- cred-probe is silent-on-success (matches d1-backup). If a "still alive" heartbeat is ever wanted, add a weekly summary send in the wrapper — not the Python.
- If Google ever starts rotating refresh tokens on use for these clients, the probe's "no side effects" assumption breaks — revisit before increasing frequency beyond daily.
- New Google accounts drop a token into `tokens/` and are picked up automatically; new *non-Google* credentials (HeyGen cookies, gh) are NOT covered here by design (HeyGen is manual/ToS-grey; gh is asserted by boss).
