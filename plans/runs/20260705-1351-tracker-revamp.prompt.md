# Executor handoff — tracker-app revamp batch (plans 014 → 015 → 016 → 017)

You are the EXECUTOR for four implementation plans in this repository
(`/Users/kbtg/codebase/personal-stuff`). Work alone, follow the plans exactly,
and report through the run-log. Do not re-litigate design decisions — they were
made deliberately and are recorded in the plans and `decisions.md`.

## The batch, in strict order

1. `plans/014-tracker-pipeline-derived-create-form.md`  (S)
2. `plans/015-tracker-my-work-inbox.md`                 (L — the centerpiece)
3. `plans/016-tracker-admin-attention-panel.md`         (M)
4. `plans/017-tracker-review-activity-thread.md`        (M)

All four target `apps/tracker-app/`. Read `apps/tracker-app/CLAUDE.md` (at
least the engine section at the top) before plan 014, and read EACH plan file
in full — including its executor-instructions header — before starting it.

## Git setup (overrides the "create from main" line in the plans)

The orchestrator's plan files are UNCOMMITTED in the working tree. Do this
first, before plan 014:

```bash
cd /Users/kbtg/codebase/personal-stuff
git checkout -b advisor/014-tracker-revamp        # branch from current HEAD (fe324e0 on advisor/012-competitor-styles), NOT from main
git add plans/ decisions.md
git commit -m "docs(plans): tracker revamp batch 014-017"
```

Then per plan: run its drift check, execute its steps in order, and finish with
ONE commit using the plan's specified commit message. **Never push.** No AI
footers or generator credits in any commit message.

## Load-bearing decisions (obey, don't revisit)

- Executor for all four plans is YOU (Antigravity) — the plans' `Executor: sonnet`
  field is superseded by the owner's routing for this batch.
- Plan order is a hard dependency chain: 015 restructures `Board.tsx`/`CardDetail.tsx`
  that 016/017 build on; 014 runs first because 015 moves the modal it touches.
- 015's server visibility change (canSeeRow drops the gate check; writes stay
  gated) is deliberate — do not "fix" it back.
- 016's thresholds and 017's schema are specified in the plans — use them as
  written.
- UI must match the existing Tailwind + shadcn idiom in the touched files; no
  new UI libraries, no redesign beyond what the plans specify.

## Environment notes

- `cd apps/tracker-app && npm install` once before plan 014 (local `.npmrc`
  already points at the public registry).
- Local dev: `npm run seed:local` then `npm run dev:local` (Vite :5173 +
  wrangler API :8787). Use :5173 for UI checks — `wrangler dev` serves a STALE
  `dist/` snapshot and needs rebuild+restart after SPA changes.
- Screenshots: `npm run shot -- <persona>`; e2e: `npm run e2e`.
- `.dev.vars` already exists with `DEV_AUTH=1` — dev-login personas work.
- Never touch the remote/production D1 or deploy anything (017's prod
  migration is the owner's step).

## Execution rules

- Run EVERY **Verify** command and confirm its expected result before moving on.
- Honor **STOP conditions** literally: stop the run and write `BLOCKED`, do not
  work around.
- Cap self-fix attempts at **5 per plan**. If a plan's Done criteria still fail
  after 5 fix attempts, append `PLAN NNN BLOCKED: done criteria unreachable
  after 5 attempts` and stop the whole run.
- Stay inside each plan's **In scope** file list. Out-of-scope files are
  untouchable even when a change there "would help".
- After each plan: flip its row in `plans/README.md` to `DONE` (or
  `BLOCKED: reason`) as part of that plan's commit.

## Run-log (append-only): `plans/runs/20260705-1351-tracker-revamp.md`

Append lines in exactly this format (the header line already exists):

```
[HH:MM:SS] RUN START
[HH:MM:SS] PLAN 014 START
[HH:MM:SS] PLAN 014 HEARTBEAT <short note>        ← at least every 3 minutes while working
[HH:MM:SS] PLAN 014 DONE  verify: <results>  files: <changed files>
...same for 015, 016, 017...
[HH:MM:SS] PLAN NNN BLOCKED: <reason>             ← then STOP the run
[HH:MM:SS] RUN DONE                                ← final line, only after all four plans
```

Heartbeats matter: a silent 10 minutes reads as a dead run.

## Final report

When done, summarize per plan: commit hash, verify results (test/e2e/build),
screenshots taken, and anything you had to interpret. Keep it short and factual.
