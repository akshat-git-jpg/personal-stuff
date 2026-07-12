---
name: personal-stuff-idea-to-shipped
description: Use when taking anything new from idea to live in personal-stuff — evaluating an idea, choosing where a new app/pipeline/tool/skill/cron lives, scaffolding it with the house stack and auth model, shipping it through the orchestrate → secretary → boss chain, first deploy, registering it in the inventories, or decommissioning something cleanly. Also use when an idea arrives mid-session and you need to park it in the right place.
---

# Idea → shipped (and cleanly retired)

## Overview

Everything live in this repo walked the same path: parked idea → pressure-tested → placed → scaffolded with docs → built → deployed → inventoried → logged. Skipping a station is how drift starts (founders-tracker skipped one inventory update and INFRA.md is still wrong).

## Station 1 — park and pressure-test

- Ideas live in `context/ideas.md` (high-potential only; daily tasks belong in `apps/telegram-my-planner/to-do/`, deliberately not in context/).
- Before building: run the existing `roast` skill (5-persona attack → GO/RESHAPE/KILL) and/or `scout` (evaluates external tools against THIS stack). Check **personal-stuff-failure-archaeology** — the idea may be a settled battle.
- Idea rides an unproven assumption (new engine, tool, migration)? De-risk it FIRST per **personal-stuff-research-methodology** — cheap falsifiable test on the one unproven assumption, verdict recorded in `decisions.md`, then adopt/defer — before any build plan is written.
- Becomes a real bet → update `context/bets.md` (its own update-cadence rule).

## Station 2 — placement (decided 2026-07-04)

| It is a… | It goes to… | Register in |
|---|---|---|
| Personal product (someone uses it) | `apps/<kebab-name>/` | inventories (station 5) |
| Money-making / business project | `pipelines/<name>/` | `pipelines/CLAUDE.md` folder map |
| Skill / CLI / MCP for driving work with Claude | `tooling/` | skill: manifest + `relink.sh`; CLI: **personal-stuff-diagnostics-and-tooling** router |
| Deployable Worker, even when a pipeline drives it | `apps/` (rule set by the redirector) | inventories |
| Scheduled job | code in `personal-stuff`, wrapper in `vps-crons` | `VPS-CRONS.md` lifecycle |
| Voice/avatar reference asset | asset hubs `pipelines/video/tts/` / `pipelines/video/heygen/` (decided 2026-07-12); generated media OUTSIDE the repo in `~/kb-scratch/video/{tts,heygen}/<pipeline>/` | hub manifest (`OUTPUTS.md` / `RENDERS.md`); policy home: **personal-stuff-change-control**; domain knowledge (engines, sync, costs): **video-and-tts-reference** |

Every new folder gets `README.md` + `CLAUDE.md` from day one (**personal-stuff-docs-and-writing**).

## Station 3 — scaffold with the house conventions

**New web app** (`apps/`):
- House stack: Vite + React + Hono on one Cloudflare Worker, `ASSETS` SPA binding, `nodejs_compat` (copy the shape from `apps/lists-app/` — the cleanest recent example). UI standard: Tailwind + shadcn/ui, light/neutral/amber accent (reference implementation: `apps/tracker-app`, per `docs/tracker-app-ui-migration-handover.md`); design with the `ui-craft` (+`ui-craft-dense-dashboard`) skills.
- Auth model by need (decided 2026-07-01): single-user → stateless HMAC signed-cookie password/PIN gate (no KV/DB — copy lists-app's); multi-user/roles → Google OAuth + role store (copy tutorial-tracker-app's); truly private-by-obscurity → none (gym-app precedent, owner-approved only).
- Local `.npmrc` pinning the public registry BEFORE first `npm install`.
- npm scripts contract: `dev`, `build`, `typecheck` (`tsc -b`), `deploy` (`npm run build && wrangler deploy`), plus `test` if it has logic worth guarding.
- **Generic/data-driven engine inside? Guard tests over ALL configs are mandatory** (**personal-stuff-validation-and-qa**).

**New pipeline** (`pipelines/`): shared venv + root `.env` ONLY (no per-folder env/venv/requirements — ever); Python subprojects copy the 2-levels-up `sys.path` prelude; add the folder-map row.

**New landing page**: assets-only Worker under `apps/pinterest-landing-pages/<niche>/` — copy keto-kitchen's `wrangler.jsonc`; `npx wrangler deploy` auto-creates DNS+SSL.

**New skill**: author in `tooling/claude-skills/<name>/` per `superpowers:writing-skills`, description within budget (rule + rationale: **personal-stuff-change-control**; `scripts/check-skill-descriptions.sh` — wired into `relink.sh` since plan 059 — warns >500 chars, fails >700), add to `manifest/work.txt` and/or `personal.txt`, `./scripts/relink.sh`, restart session. (Repo-operating skills like this library live in `.claude/skills/` instead.)

**New CLI**: generate with the `printing-press` skill rather than hand-writing.

## Station 4 — build and ship (the boss chain, current as of 2026-07-12)

Small single-session work you're doing yourself → inline, no plan. Multi-step work rides the PR-driven chain (root `CLAUDE.md` rule 5; gates/caps: **personal-stuff-change-control** Gate 1):

1. **orchestrate** — brainstorms when fuzzy, writes a self-contained plan into `plans/NNN-slug.md` from `_TEMPLATE.md` (frontmatter carries `executor`/`model`/`test_cmd`/`deploy` — boss reads ONLY this block), registers the row in `plans/README.md` on main. Read `plans/runs/LESSONS.md` first — the append-only executor-lesson ledger; recon there instead of re-buying known failure modes, and append after verification.
2. **secretary raise** — turns the finished plan into a `boss:ready` GitHub PR. Never hand-roll the branch/PR: secretary stages ONLY the plan file, never `plans/README.md` (the registry is boss-owned on main — a branch that edits it collides with every other in-flight branch), and gaps become `gap:*` labels instead of refusals.
3. **boss dispatch** — a session in `tooling/boss/` leases a `wt` worktree, runs the executor (`claude-p`/sonnet default, `agy` per `tooling/boss/data/rules.md`), verifies via the plan's `test_cmd`, lands via `greenlight`, closes the PR. A dirty main checkout blocks dispatch (enforced 2026-07-08; `--force` overrides).
4. **deploy** — the one hard per-item gate, always owner-triggered. Since 2026-07-11 boss holds STANDING permission to carry the owner-side deploy chain itself once the owner says "deploy": wrangler secret put/deploy, VPS SSH cron wiring (`timeout`, NOT `gtimeout` — the VPS is Linux), vps-crons repo commits, 3-copy VPS-CRONS.md sync. Exclusions: interactive OAuth consent, destructive credential deletion (decisions.md 2026-07-11).

**captain (`tooling/captain/`) is frozen/deprecated — never route new work to it**; boss is the successor and shares no code with it.

Ledger nuance: the `plans/README.md` status TABLE goes stale — executors don't reliably flip rows (011 looked unfinished until verified DONE 2026-07-12; the 043 and 056–059 rows still said TODO after all had landed via boss). Truth = the `## boss-landed` section at the bottom of `plans/README.md` + `git log`. Also: plan NUMBERS collide (two independent 044/045 batches exist, 2026-07-07) — disambiguate by slug, never by number.

Validate per **personal-stuff-validation-and-qa**; deploy mechanics per **personal-stuff-deploy-and-operate**.

## Station 5 — register (the part everyone forgets)

1. Triple-update: `my-hosted-sites.md` + `INFRA.md` + kushal-tools hub card (**personal-stuff-hosting-inventory**).
2. `context/inventory.md` row (product launches only).
3. `decisions.md` line for any non-obvious choice made along the way.
4. New cron → `VPS-CRONS.md` active-crons section + `vps-crons` README index.

## Station 6 — decommission cleanly

Retire steps live in **personal-stuff-hosting-inventory**; the extra discipline: export data before deleting stores, purge ALL references (grep for the name across docs — half-dead references are how the stale-path decoder in **personal-stuff-failure-archaeology** got its entries), log the decommission in `decisions.md`, add the archaeology row. The Hermes teardown (2026-06-14) is the model: containers, image, dirs, docs — all gone in one pass.

## When NOT to use this skill

- The thing already exists and needs changes → **personal-stuff-change-control**
- Validating a hunch/PoC before committing to build → **personal-stuff-research-methodology**
- Pure deploy mechanics → **personal-stuff-deploy-and-operate**
- Choosing what to build next → **personal-stuff-frontier**

## Provenance and maintenance

Placement rules, the boss chain (Station 4: dirty-main guard + `--force` in `bin/boss-dispatch.sh`, secretary stages only the plan file, greenlight land + boss closes the PR, `data/rules.md` exists, deploy standing-permission), asset-hub row, skill-budget guard, ledger nuance, and all sibling cross-refs (incl. **video-and-tts-reference**) verified against root CLAUDE.md rule 5, `tooling/boss/README.md` + `CLAUDE.md`, `tooling/claude-skills/secretary/SKILL.md`, `plans/README.md`, and decisions.md (2026-07-11 boss deploy permission, 2026-07-12 asset hubs) on 2026-07-12. House-stack/UI-standard reference apps verified 2026-07-12; auth model last verified 2026-07-05. Re-verify:
- Ship chain still boss-shaped: `head -35 tooling/boss/README.md`; captain still frozen: `grep -n frozen tooling/boss/README.md`
- Landed truth vs table: `grep -A20 "## boss-landed" plans/README.md` + `git log --oneline -10`
- House-stack reference app still current: `ls apps/lists-app/`
- Placement rules: root `CLAUDE.md` "Where does a new thing go?"
- UI standard: `grep -in "shadcn" docs/tracker-app-ui-migration-handover.md` (NOT decisions.md — it was never recorded there; the handover doc is the written home, tracker-app the reference implementation)
