# Handoff: execute Plan 020 (local-apps dashboard)

You are the **executor**. Implement exactly one plan with zero context beyond the
plan file and the repo. Do NOT redesign anything — the plan contains the complete
reference implementation to place verbatim.

## Your plan
`plans/020-local-apps-dashboard.md` — read the WHOLE file first, including its
executor-instructions header and STOP conditions.

## Run-log (append-only ledger)
Write to `plans/runs/20260705-1513-local-apps-dashboard.md`:
- `[HH:MM:SS] RUN START`
- `[HH:MM:SS] PLAN 020 START` before you begin
- a `[HH:MM:SS] PLAN 020 HEARTBEAT <note>` line at least every 3 minutes while working
- `[HH:MM:SS] PLAN 020 DONE  verify: <results>  files: <changed files>` on success
  (put the Step 4 assertion results — D/F/H codes — in the verify field), OR
  `[HH:MM:SS] PLAN 020 BLOCKED: <reason>` then STOP the whole run
- `[HH:MM:SS] RUN DONE` as the final line on success

## Rules (load-bearing — do not re-litigate)
1. **Drift check first**: `git diff --stat de6c321..HEAD -- tooling/cli/local-apps-dashboard apps/local-apps.md` (expect no output).
2. **Place the files verbatim** — `dashboard.mjs`, `apps.json`, `README.md`,
   `CLAUDE.md` are given in full in the plan. Do not abbreviate, "improve", or add
   dependencies / a package.json (house convention = Node built-ins only).
3. **Run every Verify** and confirm the expected result before continuing. The
   Step 4 lifecycle assertions (D=200, F=000, H=000) are mandatory — they prove
   Start, the process-group Stop, and dashboard teardown all work.
4. **Honor STOP conditions literally.** If the Step 4 assertions fail after placing
   files verbatim, or if staging would include any `apps/tracker-app/` /
   `apps/lists-app/` change, STOP and report — do not work around it.
5. **Git**: create branch `advisor/020-local-apps-dashboard`. Stage ONLY the
   in-scope paths explicitly — never `git add -A` / `git add .`:
   `git add tooling/cli/local-apps-dashboard/ apps/local-apps.md plans/README.md`
   Commit: `feat(tooling): local-apps dashboard — one-click start/stop/open`
   (no AI footers). **Do NOT push.** The repo has unrelated uncommitted
   `apps/tracker-app/` changes in the working tree — leave them untouched and
   unstaged.
6. **Cap self-fix attempts at 5.** If Done criteria still fail after 5 fix
   attempts, write `BLOCKED: done criteria unreachable after 5 attempts` and stop.
7. Update plan 020's row in `plans/README.md` to `DONE` at completion (Step 7).

Report back plainly: what you changed, the Step 4 assertion results, and the final
commit hash (do not push).
