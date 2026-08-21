---
executor: agy
model:
test_cmd: cd apps/tutorial-tracker-app && npm run seed:local && npm run e2e -- e2e/new-video-setup.spec.ts
ui: true
deploy: cd apps/tutorial-tracker-app && npm run deploy
needs: Dispatch AFTER 214 — both edit Board.tsx. Dispatch BEFORE 216, which also edits Board.tsx.
needs_prs: []
touches: [apps/tutorial-tracker-app/src/client/NewVideoDialog.tsx, apps/tutorial-tracker-app/src/client/Board.tsx, apps/tutorial-tracker-app/src/worker/index.ts, apps/tutorial-tracker-app/test/setup-gate.test.ts, apps/tutorial-tracker-app/e2e/new-video-setup.spec.ts]

mutation_apply: sed -i '' 's/if (missing.length) return jsonError(400/if (false) return jsonError(400/' apps/tutorial-tracker-app/src/worker/index.ts
mutation_command: cd apps/tutorial-tracker-app && npm test -- test/setup-gate.test.ts
mutation_expect: incomplete video was accepted
mutation_cwd:
mutation_timeout: 600
---

# Plan 215: Tracker — a video is set up before it reaches anyone's list

## Summary

- **Problem statement**: A video can be created with blanks, so it lands on someone's board carrying a dead button. The owner's live board showed exactly this: the single actionable card's `Submit for review` was disabled with *"Add the Description, Recorder, Video Editor, Thumbnail Maker, Uploader first."* — five missing things, none of them fixable from that card.
- **Goals**: Make a complete setup the price of admission. One guided screen collects the brief and every assignee, pre-filled from the category defaults that already exist. The server refuses an incomplete create, so the rule holds even if the UI is bypassed.
- **Executor proposed**: agy, executor default model — standard difficulty; touches the worker, so the unit-test gate matters more than the UI.
- **Done criteria** (terse): `/api/video` rejects incomplete payloads with the missing field names; the create screen pre-fills people from defaults and names what is missing; unit + e2e gates green.
- **Stop conditions** (terse): the reviewer field turns out to be required by RBAC, or `applyDefaults` cannot be reused.
- **Test / verification for success**: `test/setup-gate.test.ts` proves the server rejects an incomplete create; `e2e/new-video-setup.spec.ts` proves the screen blocks and explains.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 4a9c75c6..HEAD -- apps/tutorial-tracker-app/src/client/NewVideoDialog.tsx apps/tutorial-tracker-app/src/worker/index.ts`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: 214 (Board.tsx conflict only)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `4a9c75c626e6`, 2026-08-21

## Why this matters

Every other fix in this batch makes the board calmer. This one removes a whole **class** of confusing card: the one that looks like work but cannot be done. It is the owner's chosen answer to "that Topic card needs 5 things before you can submit" — *a setup step first*, so blocked cards stop existing rather than being made prettier.

## Current state

- `src/client/NewVideoDialog.tsx` (118 lines) is a modal driven by `createFieldsOf(pipeline)` (`src/shared/engine/types.ts:142`, defaulting to `DEFAULT_CREATE_FIELDS`). It collects the brief fields only — **no assignees**.
- `src/client/api.ts:196` `createVideo(input)` POSTs the column-keyed payload to **`/api/video`**. Find that handler in `src/worker/index.ts`.
- Assignees are filled in afterwards, either by hand in `CardDetail` or by the admin clicking **Apply assignment defaults**, which calls `applyDefaults(row_id)` (`src/client/api.ts`) and fills blank assignee/reviewer columns from the `assignment_defaults` table keyed by `pipeline_id` + category + subcategory.
- `src/client/AssignmentDefaults.tsx` (188 lines) is where those defaults are edited. **Plan 217 owns that screen — do not touch it here.**
- The approved design (dark-mode canvas, artboard "New video — set up first") is a single two-column screen: *The video* on the left, *The people* on the right, with a footer that names what is missing and a create button that only lights up when nothing is.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `cd apps/tutorial-tracker-app && npm run typecheck` | exit 0 |
| Unit tests | `cd apps/tutorial-tracker-app && npm test` | 209+ passed, plus the new file |
| Just the gate | `cd apps/tutorial-tracker-app && npm test -- test/setup-gate.test.ts` | passes |
| Seed | `cd apps/tutorial-tracker-app && npm run seed:local` | `-- applied to local D1` |
| e2e | `cd apps/tutorial-tracker-app && npm run e2e` | all pass |
| Screenshot | `cd apps/tutorial-tracker-app && npm run shot -- sean docs/flow/shots/215-setup.png` | prints the path |

## Scope

**In scope**:
- `src/worker/index.ts` — a completeness guard on the `/api/video` handler
- `src/client/NewVideoDialog.tsx` — becomes the two-column setup screen with assignees
- `src/client/Board.tsx` — wiring only (the New video entry point)
- `test/setup-gate.test.ts` — new
- `e2e/new-video-setup.spec.ts` — new
- `docs/flow/shots/215-setup.png` — new

**Out of scope**:
- `AssignmentDefaults.tsx` and `TeamPanel.tsx` (plan 217)
- `CardDetail.tsx` (plan 216)
- The engine (`src/shared/engine/**`) — read it, do not change it
- Migrating videos that are **already** incomplete. The guard applies to new creates only; existing rows keep working. Note this in the PR body.

## Git workflow

- Branch: `advisor/215-tracker-setup-before-list`
- Commit: `feat(tracker): set up a video before it lists` — no AI footers. Do NOT push.

## Steps

### Step 1: Define "complete" in one place

Add to `src/shared/engine/types.ts` (read-only elsewhere in this plan, but this is an additive export):

```ts
/** Columns a video must carry before it may enter anyone's board. The brief
 *  fields of stage 0, plus one assignee for every stage that has a doer.
 *  Reviewer columns are deliberately NOT required — blank reviewer means
 *  "auto-approve on submit", which is a real, supported setup. */
export function requiredToCreate(p: PipelineDef): string[] { /* … */ }
```

It must return the stage-0 brief fields **plus** `colOf(stage, "assignee")` for every stage after the first. Derive it from the pipeline definition — never hardcode column names, because `tut-2` has a different stage list.

**Verify**: `cd apps/tutorial-tracker-app && npm run typecheck` -> exit 0

### Step 2: Guard the server

In the `/api/video` handler in `src/worker/index.ts`, before writing anything:

```ts
const missing = requiredToCreate(pipeline).filter((c) => !String(body[c] ?? "").trim());
if (missing.length) return jsonError(400, `Missing: ${missing.map(fieldLabel).join(", ")}`);
```

Match the file's existing error helper and style — `jsonError` above is illustrative; use whatever `src/worker/index.ts` already uses for a 400. **Keep the literal substring `if (missing.length) return jsonError(400` intact** if you can, because `mutation_apply` greps it; if your file's helper differs, update `mutation_apply` in this frontmatter to match what you wrote.

**Verify**: `cd apps/tutorial-tracker-app && npm run typecheck` -> exit 0

### Step 3: The unit gate

Create `test/setup-gate.test.ts`. Follow the shape of the existing `test/engine.test.ts` (Vitest, no network). Assert, for **every** pipeline in `PIPELINES`:

- `requiredToCreate(p)` includes stage 0's brief fields
- it includes an assignee column for every stage after the first
- it includes **no** reviewer column
- a payload missing any one of them is reported as incomplete, with the message naming that field

Give the "accepted anyway" assertion the message `incomplete video was accepted` — `mutation_expect` greps it.

**Verify**: `cd apps/tutorial-tracker-app && npm test -- test/setup-gate.test.ts` -> passes

### Step 4: The setup screen

Rebuild `NewVideoDialog.tsx` as the two-column layout from the approved design:

- **Left, "The video"**: title, category, subcategory, brief, YouTube description. Category and subcategory stay `ComboSelect`-style (existing values plus "add new").
- **Right, "The people"**: one row per stage that has a doer, plus the reviewer, as native selects scoped to people who hold that role **in this pipeline** — reuse `holdsRoleInSystem(memberships[email], pipeline.id, role)`, exactly as `CardDetail.tsx` already does for its assignee selects.
- **Pre-fill**: on open, and again whenever category or subcategory changes, fill blank people from the assignment defaults for that pipeline + category + subcategory. Reuse the existing default-resolution path rather than re-deriving it. Show the small line `pre-filled from your <category> defaults`.
- **Footer**: a live line naming what is still missing (`2 things left: description, uploader`) and a create button that is inert until nothing is. Ring the empty required inputs in the accent colour, as `Card.tsx` already does for its blocking field.
- Empty reviewer is allowed; show the hint `Leaving the reviewer empty means that stage is approved the moment it is submitted.`

**Verify**: `cd apps/tutorial-tracker-app && ./node_modules/.bin/eslint src/client/NewVideoDialog.tsx src/client/Board.tsx` -> no output

### Step 5: The e2e gate

Create `e2e/new-video-setup.spec.ts`:

1. Log in as `PERSONAS.sean`, open **New video**.
2. Assert the people selects are pre-filled (at least one non-empty).
3. Clear one required person -> assert the create button is disabled **and** the footer names that role.
4. Fill everything -> assert the button enables, click it, assert the dialog closes.

**Verify**: `cd apps/tutorial-tracker-app && npm run seed:local && npm run e2e -- e2e/new-video-setup.spec.ts` -> passes

### Step 6: Prove the gate can fail

```bash
sed -i '' 's/if (missing.length) return jsonError(400/if (false) return jsonError(400/' apps/tutorial-tracker-app/src/worker/index.ts
cd apps/tutorial-tracker-app && npm test -- test/setup-gate.test.ts   # MUST fail printing "incomplete video was accepted"
```

Then revert and confirm it passes. If it does not fail, the test is asserting on source text or on the client — STOP and report.

### Step 7: Screenshot

```bash
cd apps/tutorial-tracker-app && npm run shot -- sean docs/flow/shots/215-setup.png
```

The shot script captures the board, not a modal. Either extend it with an optional selector to click first, or capture with a short throwaway Playwright script and commit the PNG. Either is fine; the PNG must be committed.

## Test plan

1. `npm run typecheck` — exit 0
2. `eslint` on the three changed source files — no output
3. `npm test` — all previous tests plus the new file
4. `npm run seed:local && npm run e2e` — every spec passes
5. Step 6's mutation loop behaves as described

## Done criteria

- [ ] `requiredToCreate(p)` derived from the pipeline def, no hardcoded columns, reviewer excluded
- [ ] `/api/video` rejects an incomplete payload with a 400 naming the missing fields
- [ ] The setup screen collects brief **and** people in one pass
- [ ] People pre-fill from the category defaults, and refill when the category changes
- [ ] The footer names what is missing; create is inert until complete
- [ ] Blank reviewer is still allowed
- [ ] `test/setup-gate.test.ts` passes and fails under mutation
- [ ] `e2e/new-video-setup.spec.ts` passes; all pre-existing specs pass
- [ ] `docs/flow/shots/215-setup.png` committed

## STOP conditions

- RBAC turns out to require a reviewer for some stage — report before making it mandatory
- The assignment-defaults lookup cannot be reached from the create path without touching `AssignmentDefaults.tsx`
- The mutation cannot be made to fail the unit gate
- Existing incomplete rows start throwing anywhere — the guard must apply to creates only

## Maintenance notes

- Videos created before this plan can still be incomplete. Anything that assumes completeness must keep tolerating blanks; the guard is a front door, not a migration.
- The completeness rule lives in `requiredToCreate` and is used by both the client and the worker. Add a stage to a `PipelineDef` and it is required automatically — that is the point.
