---
name: debug-from-backendlib
description: Use when a dashboard-api endpoint misbehaves (500, empty/wrong rows, zero matches, wrong SQL) and its code path calls @zluri/backend-libs — query-builder, rule engine, or other shared libs — or when endpoint debugging is drifting into code-reading and hypothesis instead of running locally. Triggers - "debug from backendlib", "query builder returns 0 rows", "preview-matching-entities 500", "trigger simulate empty", "wrong SQL generated", "debug this endpoint locally".
user-invocable: true
metadata:
  author: kbtg
  version: 1.0.0
---

# Debug from backend-libs

## Overview

For bugs at the dashboard-api ↔ `@zluri/backend-libs` boundary, the root cause is on exactly one side: bad **args going in** (fix dashboard-api) or bad **result coming out** (fix backend-libs). Reading code cannot tell you which. Logging both sides of one real local request can — usually in one run.

**Core principle: no root-cause conclusion until you have read a boundary log from a real local run.** Code reading is for choosing *where to instrument*, never for concluding *what is wrong*.

All instrumentation is local-only and reverted by script before any commit. Scripts live in this skill's `scripts/` dir (`bash <skill-dir>/scripts/<name>.sh`) — nothing is added to either repo.

## The loop

Work through these as todos, in order:

1. **Capture the repro.** Ask the user for the exact curl (they supply the JWT). Record endpoint, orgId, body, expected vs actual in the scratch dir (`~/.cache/debug-from-backendlib/`). If the trigger config lives in Mongo (policy/rule doc), fetch the real document via the mongo-app-dev MCP — never assume its shape.
2. **Map the boundary.** Grep controller → service to list which `@zluri/backend-libs` functions this endpoint calls (imports from `@zluri/backend-libs`). Output: a short list of function names + call sites. No fix theories yet.
3. **`preflight.sh`** — checks gh account, dev PG, Mongo Atlas (classifies IP-block and self-heals if atlas CLI is set up), AWS SSO, node_modules state. Fix FAILs before proceeding; if truly blocked (e.g. IP allowlist needs the user), say so with `needs input:`.
4. **Instrument.** For each boundary function: `instrument.sh add <file>` FIRST, then edit. Prefer the compiled JS inside `node_modules/@zluri/backend-libs/` (untracked by construction — snapshot/restored). Touch tracked `src/` files only when you need dashboard-api-side context; there, every injected line is ONE line containing `/*BLDBG*/`, guarded by `process.env.BL_DEBUG`:
   ```js
   /*BLDBG*/ if (process.env.BL_DEBUG) require('fs').appendFileSync(process.env.BL_DEBUG_LOG || '/tmp/bl-debug.log', '[bl] label ' + JSON.stringify({ argsIn }) + '\n');
   ```
   Log: args in, result out, and for the query-builder the final SQL + params + row count.
   Inject with the Edit tool, never with shell `echo`/`printf` redirection — zsh's `echo` expands `\n` and splits your "one line" into two, breaking marker-strip on revert.
5. **`up.sh`** → curl the repro → **read `~/.cache/debug-from-backendlib/bl-debug.log`**. Localize from evidence: wrong values *entering* the lib = dashboard-api bug; correct values in, wrong result out = backend-libs bug. Iterate instrumentation deeper (inside the lib) until the exact wrong value/branch is visible.
6. **SQL bugs: replay before fixing.** Run the captured SQL against dev PG via the postgres-app-dev MCP (`execute_sql` / `explain_query`). Confirm it returns the wrong rows, then hand-correct the SQL until it returns the right rows. Only then map the correction back to code.
7. **Fix in the owning repo.** dashboard-api fixes: edit `postgres/src/` directly (nodemon hot-reloads). backend-libs fixes: edit the backend-libs repo source, then `lib-sync.sh push` + `down.sh && up.sh`.
8. **Validate.** Re-run the identical curl; diff the `[bl]` log before/after. The bug is fixed when the *log* shows correct values end-to-end, not when the code looks right.
9. **Lock + clean.** Write a unit/DAL test capturing the bug. Then `instrument.sh revert` → `verify-clean.sh` (must PASS before any commit) → `down.sh`. `lib-sync.sh pop` when done validating (needs AWS SSO).

## Scripts

| Script | Purpose |
|---|---|
| `preflight.sh` | env sanity: gh / dev PG / Mongo Atlas IP-block / AWS SSO / node_modules drift |
| `up.sh` / `down.sh` | boot dev server bg with `BL_DEBUG=1` + health-wait / clean kill |
| `instrument.sh add\|list\|revert` | register-before-edit; snapshot (node_modules) or marker-strip (src) restore |
| `lib-sync.sh push\|pop\|status` | backend-libs build → yalc link into dashboard-api; clean restore to git-HEAD pin |
| `verify-clean.sh` | commit gate: no instrumentation, no markers, no yalc/.bak residue |

## Environment facts (verified 2026-07-22)

- No unauthenticated health route locally (`/:param/status-instance` is gated behind `FF_TRAFFIC_MIRROR_CAPTURE`); up.sh detects readiness via the "ready to listen" log line + any HTTP response. Port comes from `.env` `PORT` (currently 3005), not the code default 3000.
- Mongo connect failure calls `process.exit(1)` — an Atlas IP block kills boot entirely; preflight catches it first.
- nodemon watches `src/` only: **edits under node_modules need `down.sh && up.sh`**; dashboard-api src edits hot-reload.
- backend-libs `prepare` runs `co:login` (needs AWS SSO) — lib-sync publishes with `--no-scripts` after an explicit build.
- `yalc remove --all` restores a possibly-stale pin from yalc.lock — `lib-sync.sh pop` re-pins from git HEAD instead.
- QB DAL tests: `EMBEDDED_PG_PORT=5455 bash test-qb.sh <case>` (native PG 15 owns 5432).

## Red flags — STOP, you are guessing

- Proposing a root cause before the first `[bl]` log line has been read.
- Reading a 3rd+ file "to understand the flow" instead of instrumenting the boundary you already found.
- Reasoning about what SQL the query-builder "would" generate instead of logging what it did.
- Editing compiled JS in node_modules without `instrument.sh add` first.
- Assuming the Mongo rule/policy doc's shape instead of fetching it.
- Committing anything before `verify-clean.sh` passes.

| Excuse | Reality |
|---|---|
| "The bug is obvious from the code" | Every bug in the QB saga looked obvious and was localized elsewhere (entity guess, dash format, uuid cast). Log it. |
| "Booting locally is too much setup" | That is what preflight.sh is for. One command. |
| "I can't run it, Mongo/SSO is broken" | preflight diagnoses and often fixes; otherwise `needs input:` with the exact manual step — don't fall back to guessing. |
| "I'll add logs after exploring a bit more" | Exploration without a log to anchor it generates theories, not facts. Instrument first. |
| "It works, cleanup later" | Un-reverted instrumentation is a commit hazard. verify-clean before commit, always. |
