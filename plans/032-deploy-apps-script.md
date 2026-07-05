# Plan 032: deploy-apps.sh — gated one-command deploy across all Worker apps

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **⚠️ NEVER RUN A REAL DEPLOY.** All verification of this script happens in
> `--dry-run` mode. Executing `wrangler deploy` against production is a hard
> STOP violation.
>
> **Drift check (run first)**: `git diff --stat 671741e..HEAD -- scripts/ apps/*/package.json`
> On drift in any `package.json` deploy script vs the inventory below, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW as executed (dry-run only); the script's real runs are owner-triggered
- **Depends on**: plans/021-check-apps-coverage.md (soft — uses check-apps.sh as the gate; works with the pre-021 version too)
- **Category**: dx
- **Executor**: antigravity
- **Difficulty**: standard
- **Planned at**: commit `671741e`, 2026-07-05

## Why this matters

Deploying the Cloudflare Worker apps is N manual `cd apps/X && npm run deploy`
invocations. Two apps (gym-app, kushal-docs) require a `patch-routes.mjs` step
between build and deploy — already encoded in their own `deploy` scripts, but
anyone deploying "by hand the fast way" (`npm run build && npx wrangler
deploy`) skips it. After a shared change (dependency bump, cross-app auth fix)
there is no single command to ship everything, and nothing gates a deploy on
the verification baseline.

After this plan: `./scripts/deploy-apps.sh` runs `check-apps.sh` first, then
loops every app that declares a `deploy` script and runs it (each app keeps
owning its own quirks), with `--only app1,app2`, `--skip-checks`, and
`--dry-run`. Also: `tutorial-tracker-app` gains the `deploy` script its
CLAUDE.md already documents as its manual deploy sequence.

## Current state

Deploy-script inventory (verified 2026-07-05; `apps/*/package.json`):

```
analytics-app     :: npm run build && wrangler deploy
founders-tracker  :: npm run build && wrangler deploy
gym-app           :: npm run build && node scripts/patch-routes.mjs && wrangler deploy
kushal-docs       :: npm run build && node scripts/patch-routes.mjs && wrangler deploy
kushal-tools      :: wrangler deploy          (no build step — renders HTML in-worker)
lists-app         :: npm run build && wrangler deploy
redirector        :: wrangler deploy
```

- `apps/tutorial-tracker-app/package.json` has NO `deploy` script; its
  CLAUDE.md "Deploy" section documents `npm run build` then
  `npx wrangler deploy`.
- Apps with no `deploy` script and none wanted (do NOT add one):
  `personal-dashboard` (VPS Docker container), `hyperframes-render` (VPS
  container), `telegram-*` (VPS crons), `pinterest-landing-pages` (per-niche
  nested workers, no root package.json), `spending-tracker` (not built).
- The pattern to reuse: `scripts/check-apps.sh` — its `has_script()` node
  probe reads a package.json and exits 0 if a named script exists. Copy that
  helper's approach.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Syntax | `bash -n scripts/deploy-apps.sh` | exit 0 |
| Dry-run all | `./scripts/deploy-apps.sh --dry-run` | lists 8 apps' deploy commands, deploys nothing |
| Dry-run subset | `./scripts/deploy-apps.sh --dry-run --only gym-app,redirector` | exactly 2 apps listed |
| Gate wiring | `./scripts/deploy-apps.sh --dry-run` (without --skip-checks) | check-apps.sh runs first |

## Scope

**In scope**:
- `scripts/deploy-apps.sh` (create)
- `apps/tutorial-tracker-app/package.json` (add ONE line: the `deploy` script)
- `scripts/README.md` (one line in the "Scripts here" list)

**Out of scope**:
- Every other `package.json` (no deploy scripts added or edited elsewhere).
- Any wrangler.toml / wrangler.jsonc.
- Running any real deploy (see the banner).
- CI of any kind (deliberately rejected for this repo).

## Git workflow

- Branch: `advisor/032-deploy-apps`
- Commit: `feat(scripts): deploy-apps.sh — check-gated loop over each app's own deploy script` — no AI footers. Do NOT push.

## Steps

### Step 1: Add the missing deploy script to tutorial-tracker-app

In `apps/tutorial-tracker-app/package.json`, add to `"scripts"`:
`"deploy": "npm run build && wrangler deploy"`
(matches its CLAUDE.md deploy steps and the analytics-app pattern).

**Verify**: `node -e 'const p=require("./apps/tutorial-tracker-app/package.json"); process.exit(p.scripts.deploy ? 0 : 1)'` → exit 0.

### Step 2: Write `scripts/deploy-apps.sh`

Requirements (`set -uo pipefail`; NOT `-e` — one failed deploy must not strand
the summary):

- Flags: `--dry-run` (print each app's deploy command, execute nothing),
  `--only a,b,c` (comma-separated app dir names; error on an unknown name),
  `--skip-checks` (skip the gate — for emergency single-app pushes).
- Gate: unless `--skip-checks`, run `scripts/check-apps.sh` first; on non-zero
  exit, print `gate FAILED — no deploys` and exit 1 before touching anything.
  The gate runs even with `--only` (a broken shared lib ships through a
  "targeted" deploy just as easily).
- Loop `apps/*/` dirs that have a package.json with a `deploy` script (reuse
  the `has_script` node-probe pattern from check-apps.sh). For each selected
  app: print `==> <app>`, then run `npm run deploy` inside the app dir
  (`--dry-run`: print `DRY: <app> :: <the deploy script text>` instead).
- Collect per-app PASS/FAIL, print a summary table at the end, exit 1 if any
  failed, 0 otherwise.
- Top-of-file comment stating: this DEPLOYS TO PRODUCTION; dry-run first; the
  per-app quirks (patch-routes etc.) live in each app's own `deploy` script
  on purpose — never inline app-specific logic here.

**Verify**: `bash -n scripts/deploy-apps.sh` → exit 0.

### Step 3: Dry-run verification (the only execution mode you may use)

**Verify**:
- `./scripts/deploy-apps.sh --dry-run` → check-apps.sh output first, then 8
  `DRY:` lines (the 7 inventory apps + tutorial-tracker-app), exit 0.
- `./scripts/deploy-apps.sh --dry-run --only gym-app,kushal-docs` → exactly 2
  `DRY:` lines, both containing `patch-routes.mjs`.
- `./scripts/deploy-apps.sh --dry-run --only nonexistent-app` → error naming
  the unknown app, exit 1.
- `git status` → confirms no `dist/` or wrangler artifacts appeared (nothing
  was built or deployed).

### Step 4: Register in scripts/README.md

Add one line: `deploy-apps.sh — check-apps-gated deploy loop: runs each
app's own \`deploy\` script (apps own their quirks, e.g. patch-routes).
\`--only a,b\`, \`--dry-run\`, \`--skip-checks\`. DEPLOYS TO PROD — dry-run
first.`

**Verify**: `grep -c 'deploy-apps' scripts/README.md` → ≥ 1.

## Test plan

Steps 3's four dry-run assertions are the test. Real-deploy smoke is the
OWNER's follow-up (suggested first live use: `./scripts/deploy-apps.sh --only
redirector` — smallest blast radius, no build step), explicitly not the
executor's.

## Done criteria

- [ ] `bash -n` exit 0; all four dry-run assertions hold
- [ ] tutorial-tracker-app has the deploy script; no other package.json touched
- [ ] scripts/README.md row added
- [ ] Zero real deploys occurred (no wrangler output anywhere in your logs)
- [ ] `git status` clean outside the three in-scope files (plus plans/README.md)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Any deploy-script inventory line differs from the excerpt (an app's deploy
  changed since planning).
- `check-apps.sh` fails on current main (gate can't be demonstrated green) —
  report; don't `--skip-checks` your way past it.
- Anything you run produces wrangler deploy output — abort immediately and
  report exactly what executed.

## Maintenance notes

- New Worker app → give it a `deploy` script and it's covered automatically.
- Pairs with plan 027: after a real `deploy-apps.sh` run, `probe-sites.sh`
  confirms everything still answers.
- If wrangler ever needs an account/env flag repo-wide, thread it through the
  apps' own deploy scripts, not this loop.
