---
executor: agy
model:
test_cmd: bash -n infra/route-audit/run-audit.sh && grep -q "REPORT-ONLY" infra/route-audit/prompt.md && grep -q "site-probe" VPS-CRONS.md
ui: false
deploy:
needs: [057 lands first — this plan's VPS-CRONS.md refresh documents 057's cred-probe cron]
---

# Plan 058: Autonomy pilot — weekly self-triggered, read-only repo-drift audit → Telegram

## Summary

- **Problem statement**: Nothing in this repo self-triggers — every orchestrate/boss run is owner-initiated and babysat. That's the owner's stated priority 2 (frontier skill), consciously deferred at orchestrate v2.3 pending an autonomy policy. Separately, the routing docs drift (root `VPS-CRONS.md` is dated 2026-07-05 and its "Active crons" section is missing `site-probe`).
- **Goals**:
  - `infra/route-audit/` — a self-contained REPORT-ONLY drift-audit prompt + runner script for a weekly `claude -p` cron on the VPS, reporting to Telegram. First scheduled self-triggering agent run, scoped to the safest possible class: read-only.
  - Refresh the root `VPS-CRONS.md` (date, `site-probe` + `cred-probe` + `route-audit` entries in Active crons).
  - Carry the autonomy-policy text for the owner to append to `decisions.md` at landing (the executor does NOT touch that file).
- **Executor proposed**: agy, executor-default model (Gemini 3.1 Pro (High)).
- **Done criteria** (terse): test_cmd green; prompt is self-contained and forbids edits; VPS-CRONS.md lists all crons including the two new ones.
- **Stop conditions** (terse): file drift; any step that would edit `decisions.md` or run `claude -p` live.
- **Test / verification for success**: `bash -n` + grep gates (the test_cmd); one manual VPS run post-merge.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report.
> Do NOT edit `plans/README.md` or `decisions.md`.
>
> **Drift check (run first)**: `git diff --stat 855cdf9..HEAD -- VPS-CRONS.md infra/route-audit/`
> Expect: no changes and `infra/route-audit/` absent. (If plan 057 landed, `infra/cred-probe/` existing is EXPECTED and fine.)

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (first unattended LLM run against the repo — mitigated by read-only design: report-only prompt, disallowed write tools, and a read-only VPS clone that cannot push)
- **Depends on**: 057 (soft — only for the VPS-CRONS.md rows being truthful)
- **Category**: feature / autonomy
- **Difficulty**: standard
- **Planned at**: commit `855cdf9`, 2026-07-11

## Why this matters

Frontier priority 2 ("more autonomous orchestration") has a written first step: *"write the autonomy policy as a decisions.md entry; pilot ONE scheduled self-triggering run on the lowest-risk plan class (mechanical docs-drift fixes, e.g. what audit-repo-route finds)"*. This plan is that pilot, made even safer than the frontier suggested: the VPS clone of personal-stuff is read-only by design (deploy key cannot push), so the pilot **reports** drift instead of fixing it. The owner reviews the Telegram report and applies fixes in a Mac session (where `/audit-repo-route` auto-fixes mechanically).

The concrete drift it would have caught already: root `VPS-CRONS.md` says "Last updated: 2026-07-05" and its Active crons section lists only 4 crons, while `vps-crons/crontab.txt` runs 5 (`site-probe`, hourly since plan 027, is missing).

## Current state

- `infra/route-audit/` does not exist.
- The interactive skill this adapts lives at `.claude/skills/audit-repo-route/SKILL.md` (v1.1.0). Its four checks: (1) unmapped folder vs the root `CLAUDE.md` "Find it fast" table, (2) dead links / false structural claims in the map, (3) project sub-folders missing both `CLAUDE.md` and `README.md`, (4) stale `decisions.md` entries (flag-only). Exemptions: `plans/runs/`, `fixtures/`, `venv/`, `node_modules/`, `archive/`, dot-folders. **Do not invoke that skill; re-state the checks inside the new prompt so the cron run is self-contained** (a `claude -p` cron must not depend on skill discovery).
- VPS facts (from `VPS-CRONS.md`): repo clone at `/srv/projects/personal-stuff` (read-only key), crons in `/srv/crons/<job>/`, `_shared/telegram.sh` provides `send_telegram`, `_shared/alert.sh` provides `enable_failure_alert`, `_shared/claude-env.sh` provides `CLAUDE_BIN` (`/root/.local/bin/claude`, personal Pro plan — a weekly single `-p` call is quota-noise).
- Root `VPS-CRONS.md` "Active crons" section (lines ~430–471) documents: my-planner, gmail-digest, repo-sync, d1-backup. Missing: site-probe. After 057: also cred-probe. After this plan: also route-audit.
- The current `vps-crons/crontab.txt` site-probe line (for the doc refresh): `15 * * * * /srv/crons/site-probe/run.sh >> /srv/crons/site-probe/logs/cron.log 2>&1` — "GET every URL in my-hosted-sites.md; Telegram on any down site. Hourly."

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Runner syntax | `bash -n infra/route-audit/run-audit.sh` | exit 0 |
| Prompt gate | `grep -q "REPORT-ONLY" infra/route-audit/prompt.md` | exit 0 |
| Doc gate | `grep -q "site-probe" VPS-CRONS.md && grep -q "cred-probe" VPS-CRONS.md && grep -q "route-audit" VPS-CRONS.md` | exit 0 |

## Scope

**In scope**:
- `infra/route-audit/prompt.md` (new)
- `infra/route-audit/run-audit.sh` (new)
- `infra/route-audit/run.sh.example` (new — vps-crons wrapper)
- `infra/route-audit/README.md` (new)
- `VPS-CRONS.md` (edit — root copy only)

**Out of scope** (do NOT touch):
- `decisions.md` (policy line is appended by the owner at landing — see Post-merge)
- `.claude/skills/audit-repo-route/SKILL.md` (the interactive skill stays as-is)
- `~/codebase/vps-crons` (separate repo — post-merge wiring)
- `plans/README.md`

## Git workflow

- Branch: `advisor/058-autonomy-pilot-route-audit`
- Commits: one per step, conventional style — no AI footers. Do NOT push.

## Steps

### Step 1: `infra/route-audit/prompt.md`

Write the self-contained audit prompt. Required content, in this order:

1. Header stating the contract, verbatim including the capitalized token:
   > You are an automated, unattended weekly auditor. This is a **REPORT-ONLY** run: you MUST NOT edit, create, or delete any file, run any git write command, or attempt any fix. Your only output is a plain-text drift report printed to stdout. There is no user to ask; never wait for input.
2. The audit target: the repo at the current working directory (the wrapper `cd`s to the repo root). The navigation surface = root `CLAUDE.md` "Find it fast" intent table + the map in `README.md`; the decision log = `decisions.md`; sub-folders are expected to carry `CLAUDE.md` and/or `README.md`.
3. The four checks, restated from the skill (unmapped folder / dead link or false structural claim / missing operate-doc / stale `decisions.md` entry), including the exemption list (`plans/runs/`, `fixtures/`, `venv/`, `node_modules/`, `archive/`, dot-folders) and the "superseded ≠ stale" rule for check 4 (an entry overridden by a LATER entry is settled history, not drift).
4. Output format — compact for Telegram, hard cap ~3,000 characters; truncate long lists to the first 5 items + a count:

   ```
   ✅ personal-stuff routing: no drift.
   ```
   or
   ```
   ⚠️ personal-stuff routing drift — N items
   FIX-CANDIDATES (run /audit-repo-route on the Mac to apply):
   • [unmapped] apps/foo — no intent-table row
   • [dead-link] CLAUDE.md → tooling/bar (target gone)
   FLAGS (judgment calls):
   • [decisions.md:120] references pipelines/x which moved
   ```
5. A closing rule: if the repo looks unreadable/empty (e.g. a broken checkout), print `AUDIT-ERROR: <one line>` instead of an empty report.

**Verify**: `grep -c "REPORT-ONLY" infra/route-audit/prompt.md` → ≥1.

### Step 2: `infra/route-audit/run-audit.sh`

```bash
#!/usr/bin/env bash
# route-audit runner: one read-only claude -p pass over the repo, report to stdout.
# Callable on the Mac for a dry run; the VPS cron wrapper pipes stdout to Telegram.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CLAUDE_BIN="${CLAUDE_BIN:-$(command -v claude || echo /root/.local/bin/claude)}"

cd "$REPO_ROOT"
# Belt AND suspenders: the prompt forbids writes; the flags disallow the tools;
# on the VPS the clone additionally cannot push (read-only deploy key).
exec "$CLAUDE_BIN" -p \
  --output-format text \
  --disallowedTools "Edit,Write,NotebookEdit,Bash(git commit:*),Bash(git push:*),Bash(rm:*)" \
  <<< "$(cat "$SCRIPT_DIR/prompt.md")"
```

**Verify**: `bash -n infra/route-audit/run-audit.sh` → exit 0.

### Step 3: `infra/route-audit/run.sh.example` + `README.md`

`run.sh.example` — Pattern-B wrapper for `vps-crons/route-audit/run.sh`: source `.env`, `_shared/telegram.sh`, `_shared/alert.sh` (`enable_failure_alert "route-audit" …`), `_shared/claude-env.sh`; `git -C /srv/projects/personal-stuff pull --quiet` soft-fail like the other wrappers; then:

```bash
REPORT=$(/srv/projects/personal-stuff/infra/route-audit/run-audit.sh) || {
  send_telegram "route-audit: runner failed — check /srv/crons/route-audit/logs/cron.log"
  exit 1
}
send_telegram "$REPORT"
```

`README.md` — what it is (the autonomy pilot, report-only by policy), the crontab line `30 2 * * 0 /srv/crons/route-audit/run.sh >> /srv/crons/route-audit/logs/cron.log 2>&1` (Sunday 08:00 IST), the wiring steps, and the policy pointer ("autonomy policy: decisions.md entry of the landing date — self-triggered runs are read-only").

**Verify**: `bash -n infra/route-audit/run.sh.example` → exit 0.

### Step 4: refresh root `VPS-CRONS.md`

Minimal targeted edits to the root copy only:

1. Change `Last updated: 2026-07-05` to the current date.
2. In "## Active crons", after the `d1-backup` section, add three sections in the same format (What / When / Wrapper / Project code / Alerting):
   - **site-probe** — GET every URL in `my-hosted-sites.md`; Telegram on any down site. Hourly (`15 * * * *` UTC). Wrapper `/srv/crons/site-probe/run.sh`.
   - **cred-probe** — daily Google-token + claude-auth health check (plan 057); silent on success, Telegram on failure. 05:00 IST (`30 23 * * *` UTC). Wrapper `/srv/crons/cred-probe/run.sh`, project code `/srv/projects/personal-stuff/infra/cred-probe/`.
   - **route-audit** — weekly read-only routing-drift audit via `claude -p` → Telegram report (the autonomy pilot). Sunday 08:00 IST (`30 2 * * 0` UTC). Wrapper `/srv/crons/route-audit/run.sh`, project code `/srv/projects/personal-stuff/infra/route-audit/`.
3. Do NOT restructure anything else in the file.

Note for the record (put this in the README, not VPS-CRONS.md): the file is mirrored to `vps-crons/VPS-CRONS.md` and `/root/VPS-CRONS.md`; the owner syncs those two copies during post-merge wiring.

**Verify**: the test_cmd's grep gate → exit 0.

## Test plan

Frontmatter test_cmd (all offline):

```
bash -n infra/route-audit/run-audit.sh && grep -q "REPORT-ONLY" infra/route-audit/prompt.md && grep -q "site-probe" VPS-CRONS.md
```

Post-merge live check (owner): run `infra/route-audit/run-audit.sh` once on the Mac and read the report; then wire the VPS cron and manually fire it once.

## Done criteria

- [ ] test_cmd exits 0.
- [ ] `prompt.md` is fully self-contained (an executor reading ONLY it could run the audit) and contains the REPORT-ONLY contract + the 4 checks + exemptions + output format + char cap.
- [ ] `run-audit.sh` never invokes any write-capable tool path and works from any cwd.
- [ ] Root `VPS-CRONS.md` documents all 7 crons (4 existing + site-probe + cred-probe + route-audit) and carries the new date.
- [ ] `decisions.md` untouched; `git diff --stat` vs base shows only in-scope paths.

## STOP conditions

- The drift check shows `VPS-CRONS.md` changed since `855cdf9` (another session may be editing it — report instead of merging by hand).
- Any step would require actually executing `claude -p` (even the runner) — this build verifies offline only.
- Any step would require editing `decisions.md` — that's owner-at-landing, not the crew.

## Post-merge (owner)

1. Append the autonomy policy to `decisions.md` on main (exact text, adjust date):
   > 2026-07-XX — autonomy policy v1 + first self-triggered run: scheduled/unattended agent runs are READ-ONLY — they may read the repo and send reports/alerts (Telegram), never edit, commit, push, or deploy; anything that writes stays owner-initiated. Pilot: weekly `route-audit` cron (VPS, claude -p, report-only adaptation of audit-repo-route). Widen only after ≥4 clean weeks, one class at a time. (plans/058, infra/route-audit/)
2. Wire the VPS cron per `infra/route-audit/README.md`; sync the two mirrored `VPS-CRONS.md` copies (`vps-crons` repo + `/root/VPS-CRONS.md`).
3. After 4 clean weekly reports, revisit: the natural next step is letting the Mac-side `/audit-repo-route` apply the mechanical fixes the report lists.

## Maintenance notes

- The prompt duplicates the four checks from `.claude/skills/audit-repo-route/SKILL.md` **by design** (a cron can't rely on skill discovery). If the skill's checks change, update `infra/route-audit/prompt.md` in the same commit — add that cross-reference note at the top of both files? No: only in `infra/route-audit/prompt.md` (a one-line "adapted from .claude/skills/audit-repo-route v1.1.0; keep in sync").
- Telegram hard-caps messages at 4,096 chars — the prompt's 3,000-char report cap leaves headroom; if reports start truncating, tighten the list caps, don't raise the limit.
- Pro-plan quota: one `claude -p` weekly is negligible; if this ever moves sub-daily, re-check `VPS-CRONS.md` gotcha #5.
