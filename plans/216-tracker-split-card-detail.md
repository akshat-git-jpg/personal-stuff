---
executor: agy
model:
test_cmd: cd apps/tutorial-tracker-app && npm run seed:local && npm run e2e -- e2e/card-detail.spec.ts
ui: true
deploy: cd apps/tutorial-tracker-app && npm run deploy
needs: Dispatch AFTER 214 and 215 — all three edit Board.tsx, and this one is the largest single-file change.
needs_prs: []
touches: [apps/tutorial-tracker-app/src/client/CardDetail.tsx, apps/tutorial-tracker-app/src/client/LinkDrift.tsx, apps/tutorial-tracker-app/src/client/Board.tsx, apps/tutorial-tracker-app/e2e/card-detail.spec.ts]

mutation_apply:
mutation_command:
mutation_expect:
mutation_cwd:
mutation_timeout:
---

# Plan 216: Tracker — split the card panel; affiliate links move to the Links tab

## Summary

- **Problem statement**: `src/client/CardDetail.tsx` is 844 lines doing four unrelated jobs: the stage form, the affiliate-link generator, the activity thread, and admin actions. The affiliate generator is a whole sub-app — catalog search, external links, link minting, description writing — living inside the panel you open to approve a script.
- **Goals**: Move the affiliate/link generator out to the **Links** tab that already exists. Leave `CardDetail` as the stage panel plus history. No behaviour lost.
- **Executor proposed**: agy, executor default model — mechanical-to-standard: it is a move, not a redesign, but the file is large and the write-queue around it is delicate.
- **Done criteria** (terse): `CardDetail.tsx` under ~500 lines, no affiliate code in it, the generator reachable and working from the Links tab, all pre-existing specs green.
- **Stop conditions** (terse): the link generator needs per-card state that only `CardDetail` holds, or the `persistField` write-queue would have to change.
- **Test / verification for success**: `e2e/card-detail.spec.ts` asserts the panel no longer offers link generation and that the Links tab does.
- **Open points for plan readiness**: none. (`mutation_apply` is blank on purpose — see Maintenance notes.)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 4a9c75c6..HEAD -- apps/tutorial-tracker-app/src/client/CardDetail.tsx apps/tutorial-tracker-app/src/client/LinkDrift.tsx`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: 214, 215 (Board.tsx conflict)
- **Category**: tech-debt
- **Difficulty**: standard
- **Planned at**: commit `4a9c75c626e6`, 2026-08-21

## Why this matters

Most visits to a card have nothing to do with affiliate links. The generator was already folded shut in commit `516d233b`; folding is a plaster. Moving it out halves the file, removes a class of accidental edit next to the approve buttons, and puts link work where link work already lives.

## Current state

`src/client/CardDetail.tsx`, 844 lines. The affiliate block is everything driven by this state, roughly lines 200-260 for the state and 640-760 for the markup:

- `toolsDraft`, `catalog`, `catalogLoading`, `previewData`, `previewLoading`, `previewError`, `addMode`, `extName`, `extUrl`, `catalogQuery`, `catalogOpen`, `catalogBoxRef`
- `handleGenerate()` — calls `linkPreview(row_id)` then `linkConfirm(row_id, plan_hash)`
- `saveTools(newTools)` — calls `saveVideoTools(row_id, newTools)`, optimistic with rollback
- the `showTools` disclosure and everything inside it
- `<LinkResultModal>` from `./LinkReviewModal`
- imports: `affiliateCatalog`, `saveVideoTools`, `linkPreview`, `linkConfirm`, `Sparkles`

What stays: the progress strip, the stage list, `renderField` and its widget tables, `persistField` / `autoSaveField` / `flushPending` (the serialised write queue — **do not restructure it**), `renderStageActions`, the feedback banners, the activity thread, apply-defaults, delete.

`src/client/LinkDrift.tsx` (112 lines) is the current **Links** tab, registered in `Board.tsx` as `tabs.push({ key: "links", label: "Links" })`. It reports drifted links; it does not create them.

Two existing specs constrain the panel and must keep passing:

- `e2e/my-work.spec.ts` asserts these labels are visible in the dialog: `Recording link`, `Notes / brief`, `Editing instructions`, `Editing ETA`, `Final video link`, `Thumbnail link`, and a raw URL. So **read-only empty fields must keep rendering their labels** — do not hide empty fields in this plan.
- `e2e/board.spec.ts` asserts the `Request changes` button, the placeholder `What needs to change?`, and `data-testid="activity-feed"` with `requested changes` inside it.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `cd apps/tutorial-tracker-app && npm run typecheck` | exit 0 |
| Line count | `wc -l apps/tutorial-tracker-app/src/client/CardDetail.tsx` | under 500 |
| No affiliate code left | `grep -c "linkPreview\|saveVideoTools\|affiliateCatalog" apps/tutorial-tracker-app/src/client/CardDetail.tsx` | `0` |
| Unit tests | `cd apps/tutorial-tracker-app && npm test` | 209+ passed |
| Seed | `cd apps/tutorial-tracker-app && npm run seed:local` | `-- applied to local D1` |
| e2e | `cd apps/tutorial-tracker-app && npm run e2e` | all pass |
| Screenshot | `cd apps/tutorial-tracker-app && npm run shot -- sean docs/flow/shots/216-links-tab.png` | prints the path |

## Scope

**In scope**:
- Extract the affiliate block out of `CardDetail.tsx` into a new `src/client/LinkStudio.tsx`
- Render `LinkStudio` inside the **Links** tab, next to the existing drift report
- `Board.tsx` — wiring only
- `e2e/card-detail.spec.ts` — new
- `docs/flow/shots/216-links-tab.png` — new

**Out of scope**:
- `persistField` / `autoSaveField` / `flushPending` and the `savedRef` write queue — **read the comment above `persistField` before touching anything near it**; the 409 bug it documents is real
- Hiding empty read-only fields (a spec depends on their labels)
- `renderStageActions`, the lifecycle, the engine
- The link *minting* worker routes — client-side move only

## Git workflow

- Branch: `advisor/216-tracker-split-card-detail`
- Commit: `refactor(tracker): move link studio to its own tab` — no AI footers. Do NOT push.

## Steps

### Step 1: Create `LinkStudio.tsx` by moving, not rewriting

Create `src/client/LinkStudio.tsx` exporting `LinkStudio({ rowId, videoTitle, initialTools, onSaved })`. Move the state, `handleGenerate`, `saveTools`, the catalog dropdown, the external-link form, the generate button and `LinkResultModal` across **verbatim** where possible. Resist tidying while moving — a move you can diff is a move you can trust.

The one real coupling to break: `saveTools` currently calls `setTouched(true)` so closing the card refreshes the board. Replace that with the `onSaved` callback.

**Verify**: `cd apps/tutorial-tracker-app && npm run typecheck` -> exit 0

### Step 2: Strip `CardDetail.tsx`

Delete the moved state, functions, markup and the now-unused imports. Keep everything listed under "What stays" above.

**Verify**: `wc -l src/client/CardDetail.tsx` -> under 500, and `grep -c "linkPreview\|saveVideoTools\|affiliateCatalog" src/client/CardDetail.tsx` -> `0`

### Step 3: Give the Links tab a video picker

`LinkStudio` needs a row. The Links tab has no card context, so add a picker: a search-and-select list of videos that have reached the **Upload** stage (links are written for videos about to publish). Selecting one mounts `LinkStudio` for it.

Rename the tab label from `Links` to `Links` — unchanged, so no spec moves. Inside the tab, render the picker plus `LinkStudio`, with the existing `LinkDriftPanel` below under its own heading.

**Verify**: `cd apps/tutorial-tracker-app && ./node_modules/.bin/eslint src/client/LinkStudio.tsx src/client/LinkDrift.tsx src/client/Board.tsx src/client/CardDetail.tsx` -> no output

### Step 4: Leave a signpost on the panel

At the bottom of `CardDetail`, one line: `Affiliate links and the YouTube description live in the Links tab.` — the design's exact copy. It stops the admin hunting for a control that moved.

### Step 5: Write the placement spec

Create `e2e/card-detail.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { loginAs, PERSONAS } from "./helpers";

test("card-detail: the panel no longer carries the link generator", async ({ page }) => {
  await loginAs(page, PERSONAS.sean);
  await page.getByText("Color matching multi-cam footage").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Generate links/)).toHaveCount(0);
  await expect(dialog.getByText(/Links tab/)).toBeVisible();
});

test("card-detail: the Links tab carries it instead", async ({ page }) => {
  await loginAs(page, PERSONAS.sean);
  await page.getByRole("button", { name: "Links", exact: true }).click();
  await expect(page.getByText(/Generate links/)).toBeVisible();
});
```

**Verify**: `cd apps/tutorial-tracker-app && npm run seed:local && npm run e2e -- e2e/card-detail.spec.ts` -> 2 passed

### Step 6: Full suite, then the screenshot

`npm run seed:local && npm run e2e` must be **all green**, including the four pre-existing specs that assert panel field labels and the activity feed. This suite is the gate for this plan — it is why `mutation_apply` is blank.

```bash
cd apps/tutorial-tracker-app && npm run shot -- sean docs/flow/shots/216-links-tab.png
```

## Test plan

1. `npm run typecheck` — exit 0
2. `eslint` on the four changed/new files — no output. `CardDetail.tsx` carries 8 pre-existing errors; it must not gain more.
3. `npm test` — 209+ passing
4. `npm run seed:local && npm run e2e` — every spec passes
5. `wc -l` and the two `grep` checks from the commands table

## Done criteria

- [ ] `src/client/LinkStudio.tsx` exists and owns all affiliate/link-generation code
- [ ] `CardDetail.tsx` under 500 lines, zero affiliate imports
- [ ] The Links tab can pick a video and generate links end to end
- [ ] `LinkDriftPanel` still renders in the Links tab
- [ ] The panel shows the one-line signpost
- [ ] The write queue (`persistField`, `savedRef`) is byte-identical
- [ ] `e2e/card-detail.spec.ts` passes; all pre-existing specs pass
- [ ] `docs/flow/shots/216-links-tab.png` committed

## STOP conditions

- The generator needs state only `CardDetail` can provide (e.g. unsaved draft fields)
- Any change to `persistField` / `flushPending` / `savedRef` looks necessary — stop and report; that queue exists to fix a real 409 bug documented in the file
- Any pre-existing e2e spec fails
- `CardDetail.tsx` gains a lint error

## Maintenance notes

- Empty read-only fields still render their labels on purpose: `e2e/my-work.spec.ts` asserts `Final video link` and `Thumbnail link` are visible on a not-yet-started stage. Hiding them is a separate plan with spec edits.
- This plan adds no mutation gate because it adds no gate logic. The pre-existing suite is the safety net, and it is a real one: it already catches the field labels, the send-back flow and the activity feed.
