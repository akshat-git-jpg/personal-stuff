---
name: personal-stuff-repo-map
description: Use when orienting in the personal-stuff repo — unsure where something lives, which folder owns a task, what apps/ vs pipelines/ vs tooling/ vs infra/ means, which doc is authoritative for a question, or why README.md and CLAUDE.md coexist in the same folder. Also use before moving/renaming any folder.
---

# personal-stuff repo map

## Overview

`personal-stuff` is a personal monorepo operated largely BY Claude: independent Cloudflare Worker apps, VPS Docker apps, VPS crons, a shared-Python business workspace, Claude skills/CLIs/MCP servers, and a governance layer (decisions log + plans workflow + context "second brain"). **Route by the question, not by browsing** — the root `CLAUDE.md` "Find it fast" table is the map; grepping the whole repo to orient is the anti-pattern.

## The four top-level buckets (placement rule, decided 2026-07-04)

| Bucket | What belongs | Examples |
|---|---|---|
| `apps/` | Personal products — anything a person uses, including every deployable Worker | tracker-app, gym-app, redirector, landing pages |
| `pipelines/` | Money-making / business projects; shared-Python workspace with its own operating guide | youtube/, pinterest/, income-analysis/, video/ |
| `tooling/` | The agent surface — Claude skills, CLIs Claude drives, MCP servers | claude-skills/, cli/, mcp/ |
| `infra/` | Docker compose, VPS watchdog, secrets | infra/secrets/ |

Plus: `scripts/` (repo-wide orchestration scripts + the external-path-dependency list), `docs/` (cross-project research/specs/handoffs), `plans/` (executor plans + runs ledger), `context/` (owner profile, active bets, product inventory, idea backlog), `learning/` (DSA practice).

Full placement decision tree: see **personal-stuff-idea-to-shipped**.

## README vs CLAUDE.md convention

- `README.md` orients a **human**; `CLAUDE.md` tells **Claude how to operate there**.
- Sub-folder CLAUDE.md files are NOT auto-loaded — the root map only links them. **Before working in any sub-folder, open its CLAUDE.md (or README) first.**
- `pipelines/` runs on its own CLAUDE.md (Python workspace operating guide) — read it before touching anything under `pipelines/`.

## Docs of record (one home per fact)

| Question | Authoritative file |
|---|---|
| Why is X done this way? | `decisions.md` (append-only, newest first) |
| What runs where (Cloudflare/VPS/DNS)? | `INFRA.md` |
| Cron architecture | `VPS-CRONS.md` (runbook, not auto-loaded) |
| Every live URL | `my-hosted-sites.md` |
| Who the owner is / active bets / inventory / ideas | `context/` (start at `context/CLAUDE.md`) |
| Plan lifecycle + runs ledger | `plans/README.md` + `plans/WORKFLOW.md` |
| External things that hardcode this repo's paths | `scripts/README.md` |

## Load-bearing vs. not (owner-confirmed 2026-07-05)

- **Must not break:** tracker-app (`apps/tutorial-tracker-app/` — real freelancers work in it daily) and the money-attribution chain: `apps/redirector/` → D1 `clicks-db` → `apps/analytics-app/` + `pipelines/youtube/yt-analysis/sync_clicks.py`.
- **Important, not critical:** VPS crons (daily digests, repo-sync), personal PWAs (gym, docs, lists, founders, dashboard).
- **Archived / do not build on:** `pipelines/archive/hyperframes-vs-remotion/`; anything listed as decommissioned in **personal-stuff-failure-archaeology**.

## Known weak spots (verified 2026-07-05 — read before trusting these files)

1. `INFRA.md` is stale: missing the `founders-tracker` Worker (`founders.agrolloo.com`, D1 `founders-db`, cron `35 18 * * *`), says "2 D1 databases" when at least 5 exist (`clicks-db`, `lists-db`, `founders-db`, `tracker-db`, `yt-rankings`), and under-lists bindings for yt-analytics (`RANKINGS_DB`) and yt-tutorials-tracker (`TRACKER_DB`).
2. `apps/redirector/CLAUDE.md` still references pre-restructure `workers/redirector` paths; several `pipelines/` docs (RVC-flow CLAUDE.md, pinterest/PLAN.md, cf-email README) still say `ty/` or `TY/` — the repo dissolved `ty/` into `pipelines/` on 2026-07-04.
3. `pipelines/.env.example` lists ~10 keys; the real `.env` has ~21. Do not rebuild an env from the example alone — see **personal-stuff-config-and-secrets**.
4. `tooling/claude-skills/README.md` "Current split" section understates the work/personal manifest split — trust `manifest/work.txt` + `manifest/personal.txt`, or run `./scripts/skills-status.sh`.
5. `docs/voice-pipeline-test/` contains a tracked `.venv/` — violates the media/artifact policy; don't copy that pattern.
6. gym-app and kushal-docs deploy from a Vite-generated `dist/<name>/wrangler.json` that strips routes (and kushal-docs' R2 binding); each app's `patch-routes.mjs` re-injects them during `npm run deploy` — never bare `wrangler deploy` there (details: **cloudflare-and-vps-reference**).

## Moving or renaming anything: STOP first

External systems hardcode paths in this repo: the VPS clones (`/srv/projects/personal-stuff/`, pulled every 15 min), `vps-crons` run.sh wrappers, `~/.zshrc` git-identity + aliases, per-account skill symlinks, `.mcp.json`, the `github-router` skill. **Check `scripts/README.md`'s external-dependency list before any move**, then re-run `./scripts/relink.sh` and `./scripts/regen-mcp-json.sh` after.

## When NOT to use this skill

- Deciding whether a change needs a plan/decision entry → **personal-stuff-change-control**
- Deploying or operating something → **personal-stuff-deploy-and-operate**
- A live URL question → **personal-stuff-hosting-inventory**
- Debugging a failure → **personal-stuff-debugging-playbook**

## Provenance and maintenance

Facts verified against the repo on 2026-07-05. Re-verify:
- Bucket layout: `ls` the repo root.
- Routing table: read root `CLAUDE.md`.
- Weak-spot #1 (INFRA drift): compare `INFRA.md` Worker list against `grep -r "custom_domain\|zone_name" apps/*/wrangler.*`.
- Weak-spot #4 (manifest split): `./scripts/skills-status.sh`.
- Load-bearing list: owner answers recorded 2026-07-05; re-confirm with owner if bets change (`context/bets.md`).
