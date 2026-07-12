---
name: personal-stuff-diagnostics-and-tooling
description: Use when picking the right tool, CLI, or health check for a task in personal-stuff — which command reads Gmail/Sheets/YouTube/Drive, how to check repo health, what rtk does to shell output, which script probes the live sites, how to interpret exit codes, or when a needed CLI doesn't exist yet. A router, not a manual — each tool's own skill/README stays authoritative.
---

# Diagnostics and tooling router

## Overview

Claude drives this repo through CLIs and scripts, each already documented by its own skill or README. **This is the routing table** — find the row, invoke that tool's own skill for usage. Never re-implement a capability that has a row here.

## Health checks (repo-level)

| Check | Command | Interpretation |
|---|---|---|
| Everything at once | `.claude/skills/personal-stuff-diagnostics-and-tooling/scripts/doctor.sh [--with-sites]` | wraps the three below; exit 1 = something failed |
| Skill symlinks + manifests | `./scripts/skills-status.sh` | markdown table; exit 1 on MISSING/DANGLING/UNRESOLVED/strays |
| App typecheck/lint/test | `./scripts/check-apps.sh` | exit 1 on failure; `KNOWN_FAILING` (analytics-app:lint, tutorial-tracker-app:lint) are skipped deliberately |
| Live URLs | `./scripts/probe-sites.sh [--include-localhost]` | parses `my-hosted-sites.md`; exit 1 + `DOWN_SITES:` line on any unreachable/5xx |
| Orchestrate run state | `runlog-status.sh` in `.claude/skills/orchestrate/scripts/` (moved from tooling/claude-skills 2026-07-05) | prints one status word (`done` / `blocked <reason>` / `dead <plan>` / `not-started`), **always exit 0** — do not gate on its exit code |
| Orchestrate run watcher | `watch-run.sh` (same folder) | exit 0=RUN DONE, 2=BLOCKED, 3=stale/dead, 4=never started |
| Skill-description budget — store | `./scripts/check-skill-descriptions.sh` | scans `tooling/claude-skills/` only; WARN >500 chars, FAIL >700 → exit 1; wired into `scripts/relink.sh` (plan 059) |
| Skill-description budget — `.claude/skills/` | `.claude/skills/personal-stuff-diagnostics-and-tooling/scripts/check-descriptions.sh` | same thresholds, prints a per-skill table; follows symlinks without double-counting; handles `description: \|` blocks. **NOT wired into relink.sh** (run on demand after any `.claude/skills` description edit; wiring it in is a candidate follow-up, not done) |

## rtk (Rust Token Killer)

A hook rewrites shell commands through `rtk` transparently (60–90% token savings). Meta commands: `rtk gain` (savings), `rtk discover`. **When filtered output is too aggressive** (e.g. "N matches in 0 files"), re-run as `rtk proxy <cmd>` for raw output. Reference: `~/.claude-work/RTK.md` / repo hook config.

## Task → tool router

| Task | Use | Notes |
|---|---|---|
| Gmail read/search/send | `gmail` skill → `pp-gmail --account <email>` | confirm before send; prefs files in `apps/telegram-email-assistant/` |
| Google Sheets | `google-sheets` skill → `pp-sheets` | |
| YouTube data/channels/comments | `youtube` skill → `pp-youtube` | |
| YouTube transcripts | `tooling/cli/youtube/pp-yt-transcript get <url>` | **Mac/residential IP only**; cache `~/.cache/pp-yt-transcript/` |
| Google Drive | `pp-drive --account <email>` or `google-drive` MCP | idempotent find-or-create; `--overwrite` to replace |
| Hostinger VPS/DNS/snapshots via API | `hostinger` skill → `pp-hostinger` | |
| Cloudflare D1/KV/DNS ad hoc | `cloudflare` MCP tools | Python pipelines use `common/cloudflare.py` instead |
| Push notification to phone | `tooling/cli/notify/` — Telegram-first, ntfy as fallback (used by greenlight/overnight) | `pp-ntfy send\|alarm\|test` still works standalone: exit 0 ack, 3 timeout, 2 config/HTTP; topic name IS the secret; server is plain HTTP |
| Isolated worktree for an agent run | `tooling/cli/wt/` (pool manager) | managed runs only — owner sessions, deploys, skill edits stay on the main checkout |
| Land a finished branch hands-free | `tooling/cli/greenlight/` | validation pipeline used by boss; parks merges if main is dirty |
| Capped autonomous improvement loop | `tooling/cli/overnight/` | one verifiable change per iteration; see its README for the contract |
| RapidAPI market research | `tooling/cli/rapidapi/pp-rapidapi search\|gaps\|competition` | unofficial, research only |
| Email routing for a new domain | `node tooling/cli/cf-email/setup-routing.mjs <domain>` | scoped token can't enable routing (error 10000) — one manual dashboard click, or global key |
| HeyGen avatar generation (web session) | `node tooling/cli/heygen-web/heygen-web.mjs` | ToS-risky; cookies rotate — see HANDOVER.md; usage ledger `infra/secrets/heygen-usage-last.json` |
| Local dev apps launcher | `node tooling/cli/local-apps-dashboard/dashboard.mjs` → localhost:4321 | apps die when the dashboard closes; add apps in `apps.json` |
| Claude usage dashboard | `ccu-dash` (zshrc alias → `tooling/cli/ccusage-dashboard/dashboard.mjs`) | localhost:4319 |
| YouTube-video → live Claude session | `tooling/cli/yt-claude/` relay + userscript | opens tmux windows with `--dangerously-skip-permissions` |
| PayPal income | `paypal-txns-pp-cli income\|history` | creds in `~/.config/`; auto-windows the 31-day API limit |
| impact.com affiliate income | `pp-impact` skill | token `infra/secrets/impact.env` |
| Gumroad / Skool | `gumroad`/`skool` CLIs (`~/printing-press/library/`), `pp-skool` skill | not yet wired into income-analysis — check its README first |
| Reddit thread blocked (403) | `reddit-fetcher` skill | |
| Single public tweet | `tweet-lookup` skill | the only safe free X read |
| **A CLI that doesn't exist yet** | `printing-press` skill (+ catalog/polish/publish variants) | generates ship-ready Go CLIs from an API |

## Rules of the router

1. Check this table (and the account's skill list) before writing a one-off script for anything API-shaped.
2. Google tools always take an explicit full-email `account` argument — never rely on a default.
3. New tool acquired? Add a row here AND follow **personal-stuff-change-control** (decisions.md entry if the choice was non-obvious).

## When NOT to use this skill

- Tool exists but misbehaves → **personal-stuff-debugging-playbook**
- Choosing whether to adopt an external tool at all → existing `scout` skill
- Secrets/creds for a tool → **personal-stuff-config-and-secrets**

## Provenance and maintenance

Router verified against `tooling/cli/*`, `scripts/*`, skill manifests, and owner-session records on 2026-07-05; re-verified 2026-07-12 (added notify/wt/greenlight/overnight rows from `ls tooling/cli/`; skills-status 43 skills 0 problems; doctor.sh still wraps skills-status + check-apps + opt-in probe-sites; shipped `scripts/check-descriptions.sh`). Re-verify:
- CLI inventory: `ls tooling/cli/`
- Skill inventory: `./scripts/skills-status.sh`
- doctor.sh still matches the scripts it wraps: read both before trusting after script changes
- Run `scripts/check-descriptions.sh` (this skill's folder) after any `.claude/skills` description edit; the store guard `./scripts/check-skill-descriptions.sh` covers `tooling/claude-skills/` via relink.sh
