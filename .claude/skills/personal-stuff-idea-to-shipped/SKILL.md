---
name: personal-stuff-idea-to-shipped
description: Walks anything new in personal-stuff from idea to live and back out: parking and pressure-testing an idea, placing it, scaffolding with the house stack and auth model, shipping through orchestrate → secretary → boss, first deploy, registering in the inventories, and clean decommissioning. Use when starting something new or when an idea arrives mid-session and needs parking.
---

# Idea → shipped (and cleanly retired)

## Overview

Everything live in this repo walked the same path: parked idea → pressure-tested → placed → scaffolded with docs → built → deployed → inventoried → logged. Skipping a station is how drift starts (founders-tracker skipped one inventory update and INFRA.md is still wrong).

## Station 1 — park and pressure-test

- Ideas live in `context/ideas.md` (high-potential only; daily tasks belong in `apps/telegram-my-planner/to-do/`, deliberately not in context/).
- Before building: check **personal-stuff-failure-archaeology** — the idea may be a settled battle. An external tool or service is evaluated against THIS stack per **personal-stuff-research-methodology**.
- Idea rides an unproven assumption (new engine, tool, migration)? De-risk it FIRST per **personal-stuff-research-methodology** — cheap falsifiable test on the one unproven assumption, verdict recorded in `decisions.md`, then adopt/defer — before any build plan is written.
- Becomes a real bet → update `context/bets.md` (its own update-cadence rule).

## Station 2 — placement

Use the placement table in **personal-stuff-architecture-contract** (it carries the "register in" column too). Every new folder gets `README.md` + `CLAUDE.md` from day one (**personal-stuff-docs-and-writing**).

## Station 3 — scaffold with the house conventions

**New web app** (`apps/`):
- House stack: Vite + React + Hono on one Cloudflare Worker, `ASSETS` SPA binding, `nodejs_compat` (copy the shape from `apps/lists-app/` — the cleanest recent example). UI standard: Tailwind + shadcn/ui, light/neutral/amber accent (reference implementation: `apps/tracker-app`, per `docs/tracker-app-ui-migration-handover.md`); design with the `ui-craft` (+`ui-craft-dense-dashboard`) skills.
- Auth model by need (decided 2026-07-01): single-user → stateless HMAC signed-cookie password/PIN gate (no KV/DB — copy lists-app's); multi-user/roles → Google OAuth + role store (copy tutorial-tracker-app's); truly private-by-obscurity → none (gym-app precedent, owner-approved only).
- Local `.npmrc` pinning the public registry BEFORE first `npm install`.
- npm scripts contract: `dev`, `build`, `typecheck` (`tsc -b`), `deploy` (`npm run build && wrangler deploy`), plus `test` if it has logic worth guarding.
- **Generic/data-driven engine inside? Guard tests over ALL configs are mandatory** (**personal-stuff-validation-and-qa**).

**New pipeline** (`pipelines/`): shared venv + root `.env` ONLY (no per-folder env/venv/requirements — ever); Python subprojects copy the 2-levels-up `sys.path` prelude; add the folder-map row.

**New landing page**: assets-only Worker under `apps/pinterest-landing-pages/<niche>/` — copy bridebestie's `wrangler.jsonc`; `npx wrangler deploy` auto-creates DNS+SSL.

**New skill**: author in `.claude/skills/<name>/` — or `pipelines/.claude/skills/<name>/` if it is pipelines-only — per `superpowers:writing-skills`, description within budget (rule + rationale: **personal-stuff-change-control**; `.claude/skills/personal-stuff-diagnostics-and-tooling/scripts/check-descriptions.sh` warns over 500 chars, fails over 700). Then restart the session; that is the whole flow. There is no manifest to update and no relink needed — skills are repo-scoped, so the folder IS the registration. Two exceptions: add the name to `.claude/codex-skills.txt` only if Codex should carry it globally, and run `./scripts/sync-shared-skills.sh` only if it is one of the five person-level skills duplicated into the private `work-skills` plugin.

**New CLI**: generate with the `printing-press` skill rather than hand-writing.

## Station 4 — build and ship (the boss chain, current as of 2026-07-12)

Small single-session work you're doing yourself → inline, no plan. Multi-step work rides the PR-driven chain (root `CLAUDE.md` rule 5; gates/caps: **personal-stuff-change-control** Gate 1):

1. **orchestrate** — brainstorms when fuzzy, writes a self-contained plan into `plans/NNN-slug.md` from `_TEMPLATE.md` (frontmatter carries `executor`/`model`/`test_cmd`/`deploy` — boss reads ONLY this block), registers the row in `plans/README.md` on main. Read `plans/runs/LESSONS.md` first — the append-only executor-lesson ledger; recon there instead of re-buying known failure modes, and append after verification.
2. **secretary raise** — turns the finished plan into a `boss:ready` GitHub PR. Never hand-roll the branch/PR: secretary stages ONLY the plan file, never `plans/README.md` (the registry is boss-owned on main — a branch that edits it collides with every other in-flight branch), and gaps become `gap:*` labels instead of refusals.
3. **boss dispatch** — a session in `tooling/boss/` leases a `wt` worktree, runs the executor stamped in the plan (default `agy`; `claude-p` and `codex` for the scenarios in `tooling/boss/data/rules.md`), verifies via the plan's `test_cmd`, lands via `greenlight`, closes the PR. A dirty main checkout blocks dispatch (enforced 2026-07-08; `--force` overrides).
4. **deploy** — the one hard per-item gate, always owner-triggered. Since 2026-07-11 boss holds STANDING permission to carry the owner-side deploy chain itself once the owner says "deploy": wrangler secret put/deploy, VPS SSH cron wiring (`timeout`, NOT `gtimeout` — the VPS is Linux), vps-crons repo commits, 3-copy VPS-CRONS.md sync. Exclusions: interactive OAuth consent, destructive credential deletion (decisions.md 2026-07-11).

**captain (`tooling/captain/`) was DELETED 2026-08-23** (deprecated 2026-07-07); boss is the successor and shares no code with it. Do not look for `tooling/captain/` — it is gone.

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
