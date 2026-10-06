---
name: personal-stuff-diagnostics-and-tooling
description: Routes a task in personal-stuff to the right tool, CLI or health check — which command reads Gmail/Sheets/YouTube/Drive, how to check repo health, what rtk does to shell output, which script probes the live sites, how to read exit codes, and what to do when a needed CLI does not exist yet. A router, not a manual: each tool's own skill or README stays authoritative.
---

# Diagnostics and tooling router

## Overview

Claude drives this repo through CLIs and scripts, each already documented by its own skill or README. **This is the routing table** — find the row, invoke that tool's own skill for usage. Never re-implement a capability that has a row here.

## Health checks (repo-level)

| Check | Command | Interpretation |
|---|---|---|
| Everything at once | `.claude/skills/personal-stuff-diagnostics-and-tooling/scripts/doctor.sh [--with-sites]` | wraps the three below; exit 1 = something failed |
| Where skills load (repo / Codex mirror / private plugin) | `./scripts/skills-status.sh` | exit 1 on a dangling link or a shared-skill mismatch; warns on stale account symlinks left by the old store |
| App typecheck/lint/test | `./scripts/check-apps.sh` | exit 1 on failure; `KNOWN_FAILING` (analytics-app:lint, tutorial-tracker-app:lint) are skipped deliberately |
| Live URLs | `./scripts/probe-sites.sh [--include-localhost]` | parses `my-hosted-sites.md`; exit 1 + `DOWN_SITES:` line on any unreachable/5xx |
| Orchestrate run state | `runlog-status.sh` in `.claude/skills/orchestrate/scripts/` (moved from tooling/claude-skills 2026-07-05) | prints one status word (`done` / `blocked <reason>` / `dead <plan>` / `not-started`), **always exit 0** — do not gate on its exit code |
| Orchestrate run watcher | `watch-run.sh` (same folder) | exit 0=RUN DONE, 2=BLOCKED, 3=stale/dead, 4=never started |
| Shared-skill drift (repo vs private `work-skills` plugin) | `./scripts/sync-shared-skills.sh --check` | exit 1 if the five person-level skills differ; exit 0 when there is no plugin checkout; wired into `relink.sh` and the hygiene gate |
| Skill-description budget — `.claude/skills/` | `.claude/skills/personal-stuff-diagnostics-and-tooling/scripts/check-descriptions.sh` | same thresholds, prints a per-skill table; follows symlinks without double-counting; handles `description: \|` blocks. WARN over 500 chars, FAIL over 700 (exit 1). Wired into `scripts/relink.sh`, which aborts on a FAIL (`SKIP_DESC_GUARD=1` skips it); also run it after any description edit |

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
| Push notification to phone | `tooling/cli/notify/` — Telegram only (used by greenlight) | `notify send "<msg>"`: exit 0 sent, 3 undeliverable, 2 usage. The self-hosted ntfy server was retired 2026-08-30 (public `:8888`, read-write to anyone); do not reintroduce a fallback that is open by default. |
| Isolated worktree for an agent run | `tooling/cli/wt/` (pool manager) | managed agent runs (boss crews); an interactive session claims a `pp-work` workspace instead — main is read-only |
| Land a finished branch hands-free | `tooling/cli/greenlight/` | validation pipeline used by boss; parks merges if main is dirty |
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
- Choosing whether to adopt an external tool at all → **personal-stuff-research-methodology**
- Secrets/creds for a tool → **personal-stuff-config-and-secrets**
