---
name: personal-stuff-idea-to-shipped
description: Use when taking anything new from idea to live in personal-stuff — evaluating an idea, choosing where a new app/pipeline/tool/skill/cron lives, scaffolding it with the house stack and auth model, first deploy, registering it in the inventories, or decommissioning something cleanly. Also use when an idea arrives mid-session and you need to park it in the right place.
---

# Idea → shipped (and cleanly retired)

## Overview

Everything live in this repo walked the same path: parked idea → pressure-tested → placed → scaffolded with docs → built → deployed → inventoried → logged. Skipping a station is how drift starts (founders-tracker skipped one inventory update and INFRA.md is still wrong).

## Station 1 — park and pressure-test

- Ideas live in `context/ideas.md` (high-potential only; daily tasks belong in `apps/telegram-my-planner/to-do/`, deliberately not in context/).
- Before building: run the existing `roast` skill (5-persona attack → GO/RESHAPE/KILL) and/or `scout` (evaluates external tools against THIS stack). Check **personal-stuff-failure-archaeology** — the idea may be a settled battle.
- Becomes a real bet → update `context/bets.md` (its own update-cadence rule).

## Station 2 — placement (decided 2026-07-04)

| It is a… | It goes to… | Register in |
|---|---|---|
| Personal product (someone uses it) | `apps/<kebab-name>/` | inventories (station 5) |
| Money-making / business project | `pipelines/<name>/` | `pipelines/CLAUDE.md` folder map |
| Skill / CLI / MCP for driving work with Claude | `tooling/` | skill: manifest + `relink.sh`; CLI: **personal-stuff-diagnostics-and-tooling** router |
| Deployable Worker, even when a pipeline drives it | `apps/` (rule set by the redirector) | inventories |
| Scheduled job | code in `personal-stuff`, wrapper in `vps-crons` | `VPS-CRONS.md` lifecycle |

Every new folder gets `README.md` + `CLAUDE.md` from day one (**personal-stuff-docs-and-writing**).

## Station 3 — scaffold with the house conventions

**New web app** (`apps/`):
- House stack: Vite + React + Hono on one Cloudflare Worker, `ASSETS` SPA binding, `nodejs_compat` (copy the shape from `apps/lists-app/` — the cleanest recent example). UI standard: Tailwind + shadcn/ui, light/neutral/amber accent; design with the `ui-craft` (+`ui-craft-dense-dashboard`) skills.
- Auth model by need (decided 2026-07-01): single-user → stateless HMAC signed-cookie password/PIN gate (no KV/DB — copy lists-app's); multi-user/roles → Google OAuth + role store (copy tutorial-tracker-app's); truly private-by-obscurity → none (gym-app precedent, owner-approved only).
- Local `.npmrc` pinning the public registry BEFORE first `npm install`.
- npm scripts contract: `dev`, `build`, `typecheck` (`tsc -b`), `deploy` (`npm run build && wrangler deploy`), plus `test` if it has logic worth guarding.
- **Generic/data-driven engine inside? Guard tests over ALL configs are mandatory** (**personal-stuff-validation-and-qa**).

**New pipeline** (`pipelines/`): shared venv + root `.env` ONLY (no per-folder env/venv/requirements — ever); Python subprojects copy the 2-levels-up `sys.path` prelude; add the folder-map row.

**New landing page**: assets-only Worker under `apps/pinterest-landing-pages/<niche>/` — copy keto-kitchen's `wrangler.jsonc`; `npx wrangler deploy` auto-creates DNS+SSL.

**New skill**: author in `tooling/claude-skills/<name>/` per `superpowers:writing-skills`, description within budget (rule + rationale: **personal-stuff-change-control**), add to `manifest/work.txt` and/or `personal.txt`, `./scripts/relink.sh`, restart session. (Repo-operating skills like this library live in `.claude/skills/` instead.)

**New CLI**: generate with the `printing-press` skill rather than hand-writing.

## Station 4 — build and ship

Multi-step? Plan file + `orchestrate` loop (**personal-stuff-change-control** Gate 1). Validate per **personal-stuff-validation-and-qa**; deploy per **personal-stuff-deploy-and-operate**.

## Station 5 — register (the part everyone forgets)

1. Triple-update: `my-hosted-sites.md` + `INFRA.md` + kushal-tools hub card (**personal-stuff-hosting-inventory**).
2. `context/inventory.md` row (product launches only).
3. `decisions.md` line for any non-obvious choice made along the way.
4. New cron → `VPS-CRONS.md` active-crons section + `vps-crons` README index.

## Station 6 — decommission cleanly

Retire steps live in **personal-stuff-hosting-inventory**; the extra discipline: export data before deleting stores, purge ALL references (grep for the name across docs — half-dead references are how the stale-path decoder in **personal-stuff-failure-archaeology** got its entries), log the decommission in `decisions.md`, add the archaeology row. The Hermes teardown (2026-06-14) is the model: containers, image, dirs, docs — all gone in one pass.

## When NOT to use this skill

- The thing already exists and needs changes → **personal-stuff-change-control**
- Pure deploy mechanics → **personal-stuff-deploy-and-operate**
- Choosing what to build next → **personal-stuff-frontier**

## Provenance and maintenance

Verified against root CLAUDE.md placement rules, decisions.md (2026-07-01 auth, 2026-07-04 placement/media), `pipelines/CLAUDE.md`, `context/CLAUDE.md`, and app scaffolds on 2026-07-05. Re-verify:
- House-stack reference app still current: `ls apps/lists-app/`
- Placement rules: root `CLAUDE.md` "Where does a new thing go?"
- UI standard: project memory / decisions.md `grep -in "shadcn\|tailwind" decisions.md`
