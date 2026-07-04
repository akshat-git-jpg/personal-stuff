# Handoff — `ty/` dissolution + repo restructure migration

Written 2026-07-04 to continue in a fresh session. Read this first, then
`plans/README.md`. Audience: the next agent (and the owner).

## What this is

An orchestrator (Claude) audited the whole `personal-stuff` repo and wrote
executor-ready plans under `plans/`; a cheaper executor (**Antigravity**) runs
them one at a time. Plans 001–007 (security, routing, hygiene, verification,
tooling, workflow, context layer) are DONE. Plans **008–010** are the `ty/`
dissolution migration and are **in progress**.

The decision driving 008–010: `ty/` was the one top-level folder grouped by
origin/theme instead of by kind, which made the repo "two-brained" (its own
`docs/`, `decisions.md`, routing map). We dissolve it. The money-making lens
moves to `context/bets.md` (a view), so the tree stays by-kind.

## Current state (as of this handoff — VERIFY before trusting)

- **Plan 008 is effectively DONE in the working tree** (Antigravity executed it):
  `ty/` is GONE, renamed to `pipelines/`; `common/env.py` + `.env` + `CLAUDE.md`
  intact at `pipelines/` root; `apps/redirector/` and `apps/pinterest-landing-pages/`
  exist; the two "brains" (decisions/docs/routing) are merged. Six stage commits
  present (`3da2c69`→`5ddb46d`).
  - **BUT `plans/README.md` still shows 008 as `TODO`** — the status row was not
    flipped. First action next session: verify 008, then set it to DONE.
- **Plan 009 (internal reorg) — NOT started.** TODO.
- **Plan 010 (VPS runbook) — NOT started.** TODO. Requires 008+009 pushed first.
- **Git**: on `main`, working tree clean, **7 commits ahead of `origin/main`,
  NOTHING PUSHED.**
- **Caveat**: `apps/hyperframes-render/CLAUDE.md` was hand-edited to point at
  `pipelines/yt-visuals-hyperframe/`. Plan 009 moves that folder to
  `pipelines/video/card-library/`, so 009 will update this reference again — expected.

## Decisions locked (do not re-litigate)

- **Dissolve `ty/`** → renamed to `pipelines/` (the shared-Python workspace,
  anchored by `pipelines/common/env.py` which resolves `.env`/`credentials.json`
  from `common/`'s parent — so the whole workspace moves as one safe unit).
- **Workspace name = `pipelines`** (chosen in 008 Step 0). Keeps the tree
  by-kind; a name like `ventures/` would drift back to theme-grouping.
- **Deployables live in `apps/`** with their domain, not their tech → redirector
  and pinterest landing-pages extracted there.
- **`sync_clicks.py` stays in the workspace** (`pipelines/youtube/yt-analysis/`,
  imports `common`) — it is NOT in the redirector (root README was wrong).
- **One brain**: single `decisions.md`, single `docs/`, single root "Find it
  fast" map; `pipelines/CLAUDE.md` is the workspace operating guide, not a router.
- **`ty/` self-governing-subtree was REJECTED** — an earlier audit note said keep
  it; the owner overrode that to prioritize a single by-kind structure and to
  migrate the VPS too. Recorded in `plans/README.md`.

## Key files for next session (read in this order)

- `plans/README.md` — the index + status table + the deferred security backlog + rejected findings. **Read first.**
- Plan file: `plans/008-dissolve-ty-into-by-kind-structure.md` — done-in-fact; use it to VERIFY + flip status.
- Plan file: `plans/009-workspace-internal-reorg.md` — NEXT to execute.
- Plan file: `plans/010-vps-migration-runbook.md` — after 009 is merged + pushed.
- `pipelines/CLAUDE.md` — the workspace guide (was `ty/CLAUDE.md`).
- `context/bets.md` — where the money-making lens now lives.
- This file: `/Users/kbtg/codebase/personal-stuff/docs/ty-migration-handoff.md`

## Running state

- Background processes: none.
- Dev servers / ports: none.
- Open worktrees / branches: none — all work is on `main` (Antigravity committed
  straight to `main`, not the `advisor/NNN` branches the plans suggested; owner
  accepted this pattern). Nothing pushed.

## Verification — confirm 008 landed cleanly before doing 009

Run from `/Users/kbtg/codebase/personal-stuff`:

- `ls -d ty 2>/dev/null || echo "ty gone"` → "ty gone"
- `ls pipelines/common/env.py pipelines/.env pipelines/CLAUDE.md` → all exist
- `cd pipelines && python3 -c "import sys; sys.path.insert(0,'.'); import common"` (activate `pipelines/venv` first if present) → no ImportError — **the load-bearing check**
- `ls apps/redirector/package.json apps/pinterest-landing-pages/` → exist
- `grep -rIn "codebase/personal-stuff/ty\b\|/ty/workers\|/ty/pinterest\|/ty/youtube" . | grep -v node_modules | grep -v '^\./plans/' | grep -v '\.git/'` → empty (only historical/dated `decisions.md` mentions allowed)
- `[ -f apps/redirector/migrations/0001_init.sql ]` and the seed-path refs in `apps/analytics-app` + `apps/tracker-app` point at `../redirector/migrations/…`

If all pass: set `plans/README.md` row 008 → `DONE`, commit that, then start 009.

## Deferred + open questions

- **Deferred**: the security backlog in `plans/README.md` (rate-limiting on PIN
  gates, hyperframes-render SSRF, tracker-app `DEV_AUTH` bypass, kushal-docs
  upload validation, silent cron failures) — real, promote to plans when wanted.
- **Deferred**: Plan 001 (dashboard auth) code is committed but the fix is only
  live once deployed on the VPS (`docker compose up -d --build` in the deploy
  dir) — confirm that happened, or it's still open.
- **Open (owner)**: push the 7 unpushed commits before Plan 010 (VPS pulls from
  GitHub). Also confirm the single git identity for the whole repo (currently
  YT account `akshatparty17@gmail.com` per github-router).
- **Open (owner, from 008/010)**: any `~/.zshrc`/Mac shell alias referencing `ty/`.

## Pick up here

Verify Plan 008 with the checklist above, flip its `plans/README.md` status to
DONE, then hand Plan 009 to Antigravity (prompt below). Push before 010.

---

## Antigravity prompt for the remaining plans (009 → 010)

```
Continue the ty/ dissolution migration in the personal-stuff repo. Plan 008 is
already executed (ty/ was renamed to pipelines/, Workers moved to apps/, the two
brains merged). Now run the remaining two plans STRICTLY IN ORDER, one at a time:

  1. plans/009-workspace-internal-reorg.md
  2. plans/010-vps-migration-runbook.md

For EACH plan:
- Read the whole plan file first, including its "Executor instructions" header.
- Run its "Drift check (run first)". If the tree is dirty or a "Current state"
  excerpt no longer matches live code, STOP and report — do not improvise.
- Work stages in order; COMMIT AFTER EACH STAGE (rollback = git reset --hard HEAD~1).
- Run every "Verify" command and confirm the expected result before continuing.
- Honor every "STOP condition" literally.
- When done, set the plan's row in plans/README.md to DONE. Do NOT push.

Already-decided parameters (do not re-litigate):
- Workspace name is `pipelines` (already applied by 008). Use it everywhere.
- Git identity is correct (akshat-git-jpg / akshatparty17@gmail.com) — keep it.
- Commit messages: conventional (refactor(...)/docs(...)); NEVER add any AI/Claude/
  Anthropic/"generated by" footer.
- Plan 010 runs on the VPS over SSH and REQUIRES 008+009 merged AND pushed to
  GitHub first (the VPS pulls from GitHub). If they aren't pushed when you reach
  010, STOP and tell me to push before continuing.

Most fragile steps: 009 Stage 3 (moving video-voice — respect its pre-move
ref-count gate and the ~/kb-scratch/ paths; roll back if the post-move `import
common` smoke fails), and 010 Step 3 (do not leave render2.agrolloo.com down —
restore the compose .bak if the container fails to start).

Report after each plan: what changed, Verify results, any STOP hit, and the owner
follow-ups the plan flagged. Wait for my go-ahead between plans.
```
