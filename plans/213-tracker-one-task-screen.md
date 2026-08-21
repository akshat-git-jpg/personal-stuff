---
executor: agy
model:
test_cmd: cd apps/tutorial-tracker-app && npm run seed:local && npm run e2e -- e2e/one-task.spec.ts
ui: true
deploy: cd apps/tutorial-tracker-app && npm run deploy
needs: Dispatch before 215 and 216 — those two also edit Board.tsx. This plan does not.
needs_prs: []
touches: [apps/tutorial-tracker-app/src/client/MyWork.tsx, apps/tutorial-tracker-app/src/client/Card.tsx, apps/tutorial-tracker-app/e2e/one-task.spec.ts]

mutation_apply: sed -i '' 's/const FOCUS_COUNT = 1;/const FOCUS_COUNT = 99;/' apps/tutorial-tracker-app/src/client/MyWork.tsx
mutation_command: cd apps/tutorial-tracker-app && npm run e2e -- e2e/one-task.spec.ts
mutation_expect: toHaveCount(expected) failed
mutation_cwd:
mutation_timeout: 900
---

# Plan 213: Tracker — one task on screen, not a list

## Summary

- **Problem statement**: A freelancer's board shows every stage they own at once. On the owner's live board that was **9 cards with exactly 1 actionable**, plus 8 "Up next" cards that cannot be acted on at all. The screen reports status instead of asking for work.
- **Goals**: Show exactly one task. Collapse everything behind it into a single expandable count. Drop the internal status vocabulary from the freelancer's view. Make it usable at phone width.
- **Executor proposed**: agy, executor default model — standard difficulty, single-file-plus-one UI change with a scripted gate.
- **Done criteria** (terse): one task card rendered, "N more after this" collapsed line, phone width has no horizontal scroll, new e2e spec green.
- **Stop conditions** (terse): any existing e2e spec fails, or `_upcoming` data is needed from the server.
- **Test / verification for success**: a new Playwright spec `e2e/one-task.spec.ts` that fails when more than one actionable card renders.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 4a9c75c6..HEAD -- apps/tutorial-tracker-app/src/client/MyWork.tsx apps/tutorial-tracker-app/src/client/Card.tsx`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `4a9c75c626e6`, 2026-08-21

## Why this matters

The owner's own screenshot of the live app is the evidence: **"NEEDS YOUR ACTION 1"** above one card whose only button was dead, then **"UP NEXT 8"** — eight cards, all `Upload · Standard`, all reading "opens after Thumbnail". A freelancer opening this has to read nine things to find the one thing that is theirs, and eight of the nine are not actionable by anyone.

The approved design (dark-mode canvas, artboard "Freelancer — one task") shows the target: one card, one verb, one button, and a single line reading "2 more after this".

## Current state

`apps/tutorial-tracker-app/src/client/MyWork.tsx` builds five sections from `rows`:

- `needsAction` — every stage in `row._stages` whose status is not `Done`/`In Review`
- `waitingOnReview` — status `In Review`
- `pendingUpNext` — every stage in `row._upcoming` (gate closed) whose row has no live stage
- `done` — collapsed already
- plus the reviewer queue at the top

All of `needsAction` renders as full `Card` components, and all of `pendingUpNext` renders as full cards too. Nothing limits the count.

`apps/tutorial-tracker-app/src/client/Card.tsx` already carries the inline ETA + work-link fields and one primary action (added in commit `516d233b`). The card itself is close to the design; the **list around it** is the problem.

Section headings currently read `Needs your action`, `Waiting on review`, `Up next`, `Done`. Two existing specs assert those strings:

- `e2e/board.spec.ts` asserts `Needs your action`, `Waiting on review`, `/With .+ · \d+d/`
- `e2e/my-work.spec.ts` asserts `Up next`, `Then yours: Thumbnail`, `/opens after Editing/`, and `getByText("Thumbnail", { exact: true })` inside the Up-next section

**Those specs must keep passing.** Keep the headings and those strings exactly as they are; this plan changes how many cards render under them, not their names.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `cd apps/tutorial-tracker-app && npm run typecheck` | exit 0 |
| Lint the two files | `cd apps/tutorial-tracker-app && ./node_modules/.bin/eslint src/client/MyWork.tsx src/client/Card.tsx` | exit 0, no output |
| Unit tests | `cd apps/tutorial-tracker-app && npm test` | `209 passed` (or more) |
| Seed local D1 | `cd apps/tutorial-tracker-app && npm run seed:local` | ends `-- applied to local D1` |
| Full e2e | `cd apps/tutorial-tracker-app && npm run e2e` | all specs pass |
| Screenshot | `cd apps/tutorial-tracker-app && npm run shot -- sam docs/flow/shots/213-one-task.png` | prints the path |

**Note**: `npm run e2e` starts the dev stack itself (`playwright.config.ts` `webServer`). Re-run `npm run seed:local` before each e2e run — `board.spec.ts`'s sendback test mutates data and only passes on a fresh seed.

## Scope

**In scope**:
- `src/client/MyWork.tsx` — limit the actionable list, collapse the rest
- `src/client/Card.tsx` — only if a prop is needed for the compact form
- `e2e/one-task.spec.ts` — new
- `docs/flow/shots/213-one-task.png` — new

**Out of scope**:
- `Board.tsx` (plans 214/215/216 own it)
- The reviewer queue at the top of `MyWork` (plan 216 territory)
- Server / worker / engine code — this is presentation only
- Renaming any section heading

## Git workflow

- Branch: `advisor/213-tracker-one-task-screen`
- Commit: `feat(tracker): one task at a time` — no AI footers. Do NOT push.

## Steps

### Step 1: Limit the actionable list to one card

In `src/client/MyWork.tsx`, after `needsAction` is sorted, introduce the named constant the mutation gate depends on and split the list:

```ts
// How many actionable cards a doer sees at once. One, so the screen asks for
// work instead of reporting status. The rest collapse into a count below.
const FOCUS_COUNT = 1;

const focus = needsAction.slice(0, FOCUS_COUNT);
const behind = needsAction.slice(FOCUS_COUNT);
```

Render `focus` with the existing `Card` component, unchanged.

**The constant name and value must be exactly `const FOCUS_COUNT = 1;`** — the mutation gate greps for it.

**Verify**: `cd apps/tutorial-tracker-app && npm run typecheck` -> exit 0

### Step 2: Collapse everything behind the focus card into one line

Under the focus card, render a single collapsed row for `behind` — closed by default, expanding to title-only lines. Reuse the pattern already in the file for the `Done` section (a `useState` toggle plus `ChevronDown` / `ChevronRight`).

Copy: `{n} more after this` (singular `1 more after this`). No status pills, no buttons on those rows — a title and its stage label only.

Keep the `Needs your action` heading and its count badge showing the **full** `needsAction.length`, not `1` — the count is honest, the rendering is focused.

**Verify**: `cd apps/tutorial-tracker-app && npm run e2e -- e2e/board.spec.ts` -> passes (heading + count still found)

### Step 3: Collapse "Up next" the same way

`pendingUpNext` renders one card per gated stage — 8 on the owner's live board. Render the **first** one as it renders today (the existing spec asserts a stage label and the wait text inside that section), and collapse the remainder into the same `{n} more` row shape.

Do not change `waitText`, the `StageChip`, or the section heading — `e2e/my-work.spec.ts` asserts all three.

**Verify**: `cd apps/tutorial-tracker-app && npm run seed:local && npm run e2e -- e2e/my-work.spec.ts` -> 4 passed

### Step 4: Phone width

The doer column is `mx-auto max-w-2xl px-2`. At 390px wide it must not scroll sideways. Check every child: the inline ETA + link row in `Card.tsx` is a `flex-wrap` row — confirm it wraps rather than overflowing, and that the primary button stays at least 44px tall on small screens (`h-9` = 36px today; bump to `h-11` below `sm`).

**Verify**: add to the new spec a 390x844 viewport check asserting `document.documentElement.scrollWidth <= clientWidth`.

### Step 5: Write the gate spec

Create `apps/tutorial-tracker-app/e2e/one-task.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { loginAs, PERSONAS } from "./helpers";

// Sam owns several script/recording stages in the seed. Exactly one may render
// as an actionable card; the rest must hide behind the collapsed count.
test("one-task: a doer sees exactly one actionable card", async ({ page }) => {
  await loginAs(page, PERSONAS.sam);
  const section = page.locator("section", { hasText: "Needs your action" }).first();
  await expect(section.locator("article")).toHaveCount(1);
  await expect(section.getByText(/more after this/)).toBeVisible();
});

test("one-task: no sideways scroll on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAs(page, PERSONAS.sam);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
```

**Verify**: `cd apps/tutorial-tracker-app && npm run seed:local && npm run e2e -- e2e/one-task.spec.ts` -> 2 passed

### Step 6: Prove the gate can fail

```bash
sed -i '' 's/const FOCUS_COUNT = 1;/const FOCUS_COUNT = 99;/' apps/tutorial-tracker-app/src/client/MyWork.tsx
cd apps/tutorial-tracker-app && npm run e2e -- e2e/one-task.spec.ts   # MUST fail
cd - && sed -i '' 's/const FOCUS_COUNT = 99;/const FOCUS_COUNT = 1;/' apps/tutorial-tracker-app/src/client/MyWork.tsx
cd apps/tutorial-tracker-app && npm run e2e -- e2e/one-task.spec.ts   # MUST pass
```

**Verify**: the middle run fails, the last run passes. If the middle run passes, the gate is not wired to the deliverable — STOP.

### Step 7: Commit the screenshot

```bash
cd apps/tutorial-tracker-app && npm run shot -- sam docs/flow/shots/213-one-task.png
```

`docs/flow/shots/` is not gitignored (`/docs/shots` and `/docs/redesign/*.png` are). Confirm with `git status --short` that the PNG shows as untracked, then stage it.

**Verify**: `git status --short docs/flow/shots/213-one-task.png` -> shows the file

## Test plan

1. `npm run typecheck` — exit 0
2. `./node_modules/.bin/eslint src/client/MyWork.tsx src/client/Card.tsx` — no output
3. `npm test` — 209+ passing
4. `npm run seed:local && npm run e2e` — every spec passes, including the 4 pre-existing ones
5. The Step 6 mutation loop behaves as described

## Done criteria

- [ ] Exactly one actionable card renders for a doer with several open stages
- [ ] `{n} more after this` collapsed row exists and expands
- [ ] `Up next` shows one card plus a collapsed count
- [ ] `Needs your action` badge still shows the true total
- [ ] No horizontal scroll at 390px
- [ ] Primary action is >= 44px tall below the `sm` breakpoint
- [ ] `e2e/one-task.spec.ts` passes, and fails under the Step 6 mutation
- [ ] All four pre-existing e2e specs still pass
- [ ] `docs/flow/shots/213-one-task.png` committed

## STOP conditions

- Any pre-existing e2e spec fails and the fix would need a spec edit — report instead
- The collapsed count needs data the server does not send in `_stages` / `_upcoming`
- `npm run seed:local` fails (local D1 or wrangler problem, not a code problem)
- The Step 6 mutation does not make the new spec fail

## Maintenance notes

- `FOCUS_COUNT` is deliberately a constant, not a prop: the mutation gate greps its literal text. Renaming it breaks the frontmatter's `mutation_apply`.
- The section headings are load-bearing for two existing specs. Renaming them is a separate, deliberate change with spec edits in the same commit.
