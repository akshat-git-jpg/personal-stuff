# Plan 004: A one-command verification baseline across all apps + tests on the auth code

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report — do not
> improvise. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 630ca99..HEAD -- apps/ scripts/`
> If an app's package.json changed since planning, re-read its scripts before
> editing; on structural drift (an app added/removed), STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (recommended before Plan 005's script edits land, but not required)
- **Category**: tests / dx
- **Planned at**: commit `630ca99`, 2026-07-04

## Why this matters

There is no repo-wide way to answer "is everything healthy?". Per-app scripts
are inconsistent: **zero** apps expose a standalone `typecheck` script, only 3
of 12 have `lint`, only tracker-app has tests. An agent (or the owner) changing
shared patterns — the copy-pasted HMAC auth code especially — has no gate to
catch a break in a sibling app. This plan (a) standardizes a minimal script
contract per app, (b) adds a root fan-out runner, and (c) adds characterization
tests to the security-critical token/cookie code in the two D1 apps, so future
auth edits (several are queued in the audit backlog) land against tests.

## Current state

Verified per-app scripts at commit `630ca99` (`apps/*/package.json`):

| App | scripts today | Stack |
|---|---|---|
| analytics-app | build, deploy, dev, lint, preview | Vite+React+Hono Worker, TS |
| founders-tracker | build, db:local, db:remote, deploy, dev, preview | Worker, TS, D1 |
| gym-app | build, deploy, dev, preview, shoot | Worker, TS |
| hyperframes-render | dev, start | Node/Express, plain JS |
| kushal-docs | build, deploy, dev, icons, preview | Worker, TS |
| kushal-tools | deploy, dev | Hono Worker, TS, no build step |
| lists-app | build, db:local, db:remote, deploy, dev, dev:api, dev:local, dev:web, lint, preview, seed:local | Worker, TS, D1 |
| personal-dashboard | dev, start | Node/Express, plain JS |
| tracker-app | build, dev, dev:api, dev:local, dev:web, e2e, e2e:report, lint, preview, seed:local, shot, test | Worker, TS — **the exemplar**: 49 vitest tests, `tsc -b` inside build |
| spending-tracker | (no package.json — design notes only, skip) | — |
| telegram-my-planner, telegram-email-assistant | (Python/shell, no package.json — out of scope here) | — |

Auth modules that get tests (read them before writing tests):

- `apps/lists-app/src/worker/auth.ts` — stateless signed-cookie gate: HMAC-SHA256
  over an expiry, `SESSION_SECRET`-keyed; login compares password by HMACing
  both sides (~lines 72-92). This scheme is a documented decision
  (`decisions.md` 2026-07-01) — tests characterize it, never change it.
- `apps/founders-tracker/src/worker/auth.ts` — token is `ok.<hmac(secret,"ok")>`
  (~lines 19-22), constant per secret, no expiry. **Known audit finding — do
  NOT fix it in this plan**; write the tests against *current* behavior
  (valid/tampered/malformed), avoiding assertions that would break when an
  expiry is later added (i.e. don't assert that an old token stays valid).

Conventions: tracker-app is the testing exemplar — vitest, tests under
`test/*.test.ts`. Match its style (`cd apps/tracker-app && cat package.json`
and look at `test/rbac.test.ts` structure before writing new suites).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Per-app install | `cd apps/<app> && npm install` | exit 0 |
| Typecheck (TS apps) | `npx tsc --noEmit` (or `-p tsconfig.json`) | exit 0 |
| JS syntax gate | `node --check src/*.js` | exit 0 |
| New tests | `cd apps/<app> && npm test` | all pass |
| Root runner | `./scripts/check-apps.sh` | per-app PASS/FAIL summary, exit 0 when all pass |

## Scope

**In scope**:
- `apps/{analytics-app,founders-tracker,gym-app,kushal-docs,kushal-tools,lists-app,tracker-app}/package.json` — add a `typecheck` script only (plus `test` + vitest devDep for lists-app and founders-tracker)
- `apps/{hyperframes-render,personal-dashboard}/package.json` — add `check` script (`node --check` over `src/`)
- Create `apps/lists-app/test/auth.test.ts`, `apps/founders-tracker/test/auth.test.ts` (+ minimal vitest config if needed)
- Create `scripts/check-apps.sh`
- `scripts/README.md` — document the runner
- `/decisions.md` — append one line

**Out of scope** (do NOT touch):
- Any `src/` behavior change — **especially the auth modules**; tests only.
- Adding eslint to apps that don't have it (config sprawl; lint stays where it exists).
- CI/GitHub Actions — this repo deploys manually; a runner script is the right weight.
- `ty/` projects, Python apps, `spending-tracker`.
- Fixing type errors beyond trivial annotations: if `tsc --noEmit` reveals >5 errors in an app, record them in the report and set that app to `typecheck:known-failing` in the runner (see Step 3) rather than fixing code.

## Git workflow

- Branch: `advisor/004-verification-baseline`
- Commits: `chore(dx): …` / `test(<app>): …`, conventional style, no AI footers. Do NOT push.

## Steps

### Step 1: Add `typecheck` to the 7 TS apps

For each TS app: confirm `tsconfig.json` exists, then add
`"typecheck": "tsc --noEmit"` (use `tsc -b` if the app has project references —
tracker-app does; mirror what its `build` script does minus emit). Run it.

**Verify**: `cd apps/<app> && npm run typecheck` — record exit code per app.
Apps that fail with >5 pre-existing errors: don't fix code; note them (Step 3
handles reporting).

### Step 2: Add `check` to the 2 JS apps

`"check": "find src -name '*.js' -exec node --check {} +"` in
hyperframes-render and personal-dashboard.

**Verify**: `npm run check` → exit 0 in both.

### Step 3: Write `scripts/check-apps.sh`

Bash, `set -uo pipefail` (NOT `-e` — it must visit every app and summarize).
For each dir in `apps/*/` with a `package.json`: run, in order, whichever of
`typecheck` / `check` / `lint` / `test` scripts exist (skip `e2e`), collecting
PASS/FAIL. Print a summary table and exit non-zero if anything failed. Support
a `SKIP="<app>:<script>"` env or a `KNOWN_FAILING` array at the top of the
script for the pre-existing-error apps from Step 1, printing them as `SKIP
(known-failing, see plans/004 report)` rather than FAIL. Match the style of
`scripts/relink.sh` (plain bash, comment header explaining purpose).

**Verify**: `./scripts/check-apps.sh` → table printed, exit 0 with all
non-known-failing apps passing.

### Step 4: Auth characterization tests — lists-app

Read `apps/lists-app/src/worker/auth.ts` fully. Identify the pure
token-mint/verify functions. Add vitest (`npm i -D vitest`, `"test": "vitest run"`)
and write `test/auth.test.ts`, table-driven, covering at minimum:

1. mint → verify round-trip succeeds with the right secret
2. verify fails: tampered payload, tampered signature, wrong secret
3. verify fails: malformed token (no separator, empty, garbage base64)
4. expired token fails (the scheme HMACs an expiry — craft one in the past)
5. login compare: correct password passes, wrong fails (both via the HMAC path)

Workers code uses WebCrypto (`crypto.subtle`) — available on Node ≥18 globals,
so plain `vitest run` should work. Model the file structure on
`apps/tracker-app/test/rbac.test.ts`.

**Verify**: `cd apps/lists-app && npm test` → all pass (≥ 8 assertions).

### Step 5: Auth characterization tests — founders-tracker

Same procedure for `apps/founders-tracker/src/worker/auth.ts`: round-trip,
tamper, malformed, wrong-secret. Do NOT assert anything about expiry (the
current scheme has none; asserting its absence would break the queued fix).

**Verify**: `cd apps/founders-tracker && npm test` → all pass.

### Step 6: Document

- `scripts/README.md`: add `check-apps.sh` to the "Scripts here" list (one bullet, match existing tone).
- `/decisions.md`: append
  `2026-07-04 — apps script contract: every TS app has typecheck (tsc --noEmit), JS apps have check (node --check); scripts/check-apps.sh fans out and summarizes — no CI, deploys stay manual, the runner is the pre-change gate.`

**Verify**: `./scripts/check-apps.sh` full run recorded in your report.

## Test plan

The new tests ARE the deliverable (Steps 4–5, ≥ 12 cases total across both
apps). Plus: run `cd apps/tracker-app && npm test` once to prove the exemplar
suite still passes untouched (49 tests).

## Done criteria

- [ ] 7 TS apps have `typecheck`; 2 JS apps have `check`; each runs
- [ ] `scripts/check-apps.sh` exists, summarizes all apps, exit codes correct
- [ ] lists-app + founders-tracker auth test suites pass
- [ ] tracker-app's existing 49 tests still pass (no regression from devDep churn)
- [ ] Zero changes under any `src/` directory (`git diff --stat` proves it) — package.json, tests, scripts, docs only
- [ ] decisions.md appended; `plans/README.md` row updated

## STOP conditions

- An auth module can't be imported in vitest without a Workers runtime (e.g. it
  reads Hono context or `env` at module top level) — report the import graph
  instead of refactoring `src/` to make it testable.
- `tsc --noEmit` in any app reveals >20 errors — that app's typecheck story
  needs its own plan; mark known-failing and report.
- tracker-app's suite breaks after your changes — you touched something you
  shouldn't have; revert and report.

## Maintenance notes

- Future apps must ship the contract from day one: `dev / build / deploy / typecheck (or check) / lint-if-configured / test-if-tests`.
  Plan 002 adds the placement rule to root CLAUDE.md; the script contract is documented in `scripts/README.md` by this plan.
- The known-failing list in `check-apps.sh` is debt with a name — burn it down
  app by app.
- When the queued security fixes (token expiry in founders-tracker etc., see
  plans/README.md backlog) land, Steps 4–5's tests are the safety net; extend
  them with expiry cases at that point.
