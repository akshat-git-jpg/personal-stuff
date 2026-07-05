# Round 2 — tracker-revamp closeout + owner change requests

Repo `/Users/kbtg/codebase/personal-stuff`, branch `advisor/014-tracker-revamp`
(already checked out; plans 016+017 work is UNCOMMITTED in the working tree —
keep it, you'll commit it below). Do these in order. Do not push anything.

## Part A — verification fixes (close out plans 016/017)

1. **`apps/tracker-app/scripts/seed-local.ts` — reseed must wipe `card_events`.**
   You added `CREATE TABLE IF NOT EXISTS card_events` but no drop, so events
   survive reseeding and the activity-thread e2e spec fails on every second
   run (strict-mode: 2 × "requested changes"). Add `DROP TABLE IF EXISTS
   card_events;` before the CREATE, matching the file's employees-table
   recreate pattern.

2. **Add plan 016's missing e2e spec** in `apps/tracker-app/e2e/board.spec.ts`:
   Sean → Board tab → Attention panel heading visible; typing a seeded
   `test-` title into the Filters search narrows the matrix (assert another
   title disappears). Follow the existing specs' style.

3. **Delete the stale comment** at `apps/tracker-app/src/client/api.ts:194`
   (mentions NEW_VIDEO_FIELDS) — replace with: fields come from
   `createFieldsOf` per pipeline. `grep -rn NEW_VIDEO_FIELDS src/client
   src/worker` must return nothing.

## Part B — soften the light theme (owner: "too bright")

In `apps/tracker-app/src/client/globals.css` `:root` ONLY (leave `.dark`
untouched), replace these token values exactly:

```css
--background: oklch(0.975 0.005 80);   /* was oklch(1 0 0) — warm paper, not pure white */
--card: oklch(0.995 0.002 80);         /* cards lift slightly off the page */
--popover: oklch(0.995 0.002 80);
--secondary: oklch(0.945 0.006 80);
--muted: oklch(0.945 0.006 80);
--accent: oklch(0.945 0.006 80);
--border: oklch(0.905 0.006 80);
--input: oklch(0.905 0.006 80);
```

Foregrounds, primary, destructive, success, warning, ring, charts: unchanged.
Sanity-check in the browser that text contrast still reads clearly on cards
and muted chips.

## Part C — exhaustive `test-` seed data (local preview only)

Rework the demo cards in `apps/tracker-app/scripts/seed-local.ts`:

- **Generate programmatically, don't hand-write**: loop over every pipeline in
  `PIPELINES`, every stage, and every status of that stage's lifecycle
  (`lifecycle(s.lifecycle).statuses`), emitting one card per (pipeline, stage,
  status) via the file's existing `CardSpec`/`specToRow` machinery.
- Card shape per combination: all stages BEFORE the target stage set to their
  lifecycle's done status (gates open); the target stage at the target status;
  later stages untouched. For `Need Changes`, include a feedback line
  ("test feedback: tighten the intro"). For `In Review` and later, fill the
  stage's work link with `https://example.com/test`.
- Assignees/reviewers: reuse the existing personas by role exactly as the
  current specs do (Sam scripts/records Standard, Nina Tut 2, John edits,
  Tara thumbnails, Uma uploads, Riya reviews, Sean admin).
- **Every generated title**: `test-<pipeline>-<stage>-<status-slug>`, e.g.
  `test-standard-editing-need-changes` (lowercase, spaces → hyphens).
- Keep 3–4 of the current realistic-title cards (the e2e specs reference
  "Color matching multi-cam footage" and "How to color grade in DaVinci
  Resolve" — keep those two at their current stages, or update the specs).
- Local only — this script never touches prod.

**Verify**: `npm run seed:local` exits 0 and prints the new (larger) counts;
as Sean the Board matrix shows every stage column populated across statuses.

## Part D — execute plan 018

Read and execute `plans/018-tracker-any-role-multi-system.md` (small: remove
the /api/team same-role-in-two-systems guard, delete unused `homeSystem()`,
update TeamPanel + CLAUDE.md copy, add the engine test). Its own commit.

## Part E — execute plan 019

Read and execute `plans/019-tracker-stage-time-visibility.md` (per-stage
time + holder visibility for everyone: send `*_since` to all viewers, dwell
chip per item stage, "With <reviewer> · Nd" on waiting items, journey-rail
timestamps + holders, review-queue "submitted Nd ago"). Its drift check says
STOP if 016/017 are uncommitted — in this run that means: do Part A's commit
FIRST, then 019's precondition is satisfied. Its own commit.

## Verification gate (before the commits)

```bash
cd apps/tracker-app
grep -rn "NEW_VIDEO_FIELDS" src/client src/worker    # no matches
npm test                                              # all pass
npm run build                                         # exit 0
npm run seed:local && npm run e2e                     # all specs pass
npm run seed:local && npm run e2e                     # AGAIN — proves reseed determinism
```

## Commits (in this order, no AI footers, do NOT push)

1. `feat(tracker-app): admin attention panel + card activity thread (plans 016+017)`
   — everything currently uncommitted plus Part A fixes; flip plan 017's row
   to DONE in `plans/README.md` in this commit.
2. `style(tracker-app): soften light theme + exhaustive test- seed data`
   — Parts B + C.
3. `feat(tracker-app): allow any role across multiple systems`
   — Part D; flip plan 018's row to DONE.
4. `feat(tracker-app): per-stage time + holder visibility everywhere`
   — Part E; flip plan 019's row to DONE.

## Run-log: `plans/runs/20260705-1351-tracker-revamp.md`

A `ROUND 2 START` marker is already appended. After it, append (with real
timestamps): `PLAN 016 START` / `PLAN 016 DONE  verify: … files: …`,
`PLAN 017 START` / `PLAN 017 DONE …`, `PLAN 018 START` / `PLAN 018 DONE …`,
`PLAN 019 START` / `PLAN 019 DONE …`, then `RUN DONE` as the final line.
Emit a HEARTBEAT line at least every 3 minutes while working — last round the
silent stretches tripped the dead-run watcher.
