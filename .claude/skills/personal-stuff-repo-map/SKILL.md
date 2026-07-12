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
- **Important, not critical:** VPS crons (daily digests, repo-sync), personal PWAs (gym, docs, lists, founders, timeblock, dashboard).
- **Archived / do not build on:** `pipelines/archive/hyperframes-vs-remotion/`; `pipelines/archive/rvc-flow/` (superseded by IndexTTS-2, 2026-07-12); anything listed as decommissioned in **personal-stuff-failure-archaeology**.

## Structural changes this week (2026-07-12)

- **Asset hubs + media-outside-repo:** reference assets live in `pipelines/video/tts/` (ref voices, REFERENCES.md, OUTPUTS.md) and `pipelines/video/heygen/` (characters/, registry.json, RENDERS.md); generated media lives OUTSIDE the repo at `~/kb-scratch/video/{tts,heygen}/<consuming-pipeline>/`. Browse it with the **media-board** skill (`pipelines/.claude/skills/media-board/`, symlinked into `.claude/skills/`).
- **boss supersedes captain:** orchestration is `tooling/boss/` (PR-driven); `tooling/captain/` is frozen/deprecated but still in the root routing table.
- **New app:** `apps/timeblock` (timeblock.agrolloo.com, KV-backed day planner).
- **Move:** Devsplainers now lives at `pipelines/youtube/competitor-styles/channels/devsplainers/`.

## Known weak spots (verified 2026-07-12 — read before trusting these files)

1. `INFRA.md` lags launches structurally (the triple-update rule slips); its 2026-06/07 drift was repaired 2026-07-12 — before trusting it for anything load-bearing, run the regression check in **personal-stuff-hosting-inventory** (`scripts/verify-inventory.sh`); on DRIFT, trust `apps/*/wrangler.*` + `VPS-CRONS.md` + `my-hosted-sites.md` over it.
2. `apps/redirector/CLAUDE.md` still references pre-restructure `workers/redirector` paths; several `pipelines/` docs (`archive/rvc-flow/CLAUDE.md`, pinterest/PLAN.md, cf-email README) still say `ty/` or `TY/` — the repo dissolved `ty/` into `pipelines/` on 2026-07-04.
3. `pipelines/.env.example` under-lists the real key set — never rebuild an env from the example alone; the authoritative key list (21 keys as of 2026-07-12) lives in **personal-stuff-config-and-secrets**.
4. `tooling/claude-skills/README.md` "Current split" section understates the work/personal manifest split (says 3 work-only / 1 personal-only; actual is 6 / 7 as of 2026-07-12) — trust `manifest/work.txt` + `manifest/personal.txt`, or run `./scripts/skills-status.sh`.
5. gym-app and kushal-docs deploy from a Vite-generated `dist/<name>/wrangler.json` that strips routes (and kushal-docs' R2 binding); each app's `scripts/patch-routes.mjs` re-injects them during `npm run deploy` — never bare `wrangler deploy` there (details: **cloudflare-and-vps-reference**).

## Moving or renaming anything: STOP first

External systems hardcode paths in this repo: the VPS clones (`/srv/projects/personal-stuff/`, pulled every 15 min), `vps-crons` run.sh wrappers, `~/.zshrc` git-identity + aliases, per-account skill symlinks, `.mcp.json`, the `github-router` skill. **Check `scripts/README.md`'s external-dependency list before any move**, then re-run `./scripts/relink.sh` and `./scripts/regen-mcp-json.sh` after.

## When NOT to use this skill

- Deciding whether a change needs a plan/decision entry → **personal-stuff-change-control**
- Invariants, load-bearing design rationale, or "could this break the money chain?" → **personal-stuff-architecture-contract**
- Validating a new tool/engine/approach before adopting it → **personal-stuff-research-methodology**
- Deploying or operating something → **personal-stuff-deploy-and-operate**
- A live URL question → **personal-stuff-hosting-inventory**
- Debugging a failure → **personal-stuff-debugging-playbook**

## Provenance and maintenance

Facts verified against the repo on 2026-07-12. Re-verify:
- Bucket layout: `ls` the repo root.
- Routing table: read root `CLAUDE.md`.
- Weak-spot #1 (INFRA drift): run `.claude/skills/personal-stuff-hosting-inventory/scripts/verify-inventory.sh` — the drift table itself lives in that skill, not here.
- Weak-spot #4 (manifest split): `./scripts/skills-status.sh`.
- External-toucher list before any move: `scripts/README.md` "External touchpoints" section.
- Load-bearing list: owner answers recorded 2026-07-05; re-confirm with owner if bets change (`context/bets.md`).
