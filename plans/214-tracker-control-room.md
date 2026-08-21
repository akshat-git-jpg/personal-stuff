---
executor: agy
model:
test_cmd: cd apps/tutorial-tracker-app && npm run seed:local && npm run e2e -- e2e/control-room.spec.ts
ui: true
deploy: cd apps/tutorial-tracker-app && npm run deploy
needs: Dispatch before 215 and 216 — all three edit Board.tsx and this one restructures its admin tab.
needs_prs: []
touches: [apps/tutorial-tracker-app/src/client/Board.tsx, apps/tutorial-tracker-app/src/client/AttentionPanel.tsx, apps/tutorial-tracker-app/src/client/Filters.tsx, apps/tutorial-tracker-app/src/client/filterModel.ts, apps/tutorial-tracker-app/e2e/control-room.spec.ts]

mutation_apply: sed -i '' 's/return "idle";/return "";/' apps/tutorial-tracker-app/src/client/filterModel.ts
mutation_command: cd apps/tutorial-tracker-app && npm run e2e -- e2e/control-room.spec.ts
mutation_expect: buckets must sum
mutation_cwd:
mutation_timeout: 900
---

# Plan 214: Tracker — one control room, one set of attention rules

## Summary

- **Problem statement**: The admin tab answers "what needs attention?" **twice, with different numbers**. On the owner's live board `AttentionPanel` said `Overdue or Late 5 / Ready, Idle 4` while the filter chips right underneath said `Needs a nudge 5 / With reviewers 0`. Both are on screen at once. Neither can be trusted. Separately, the table shows all 74 videos by default when 65 are already published — 88% of the scroll is finished work.
- **Goals**: One mutually-exclusive bucket set, so the numbers always sum to the unfinished total. Replace the five stacked `AttentionPanel` accordions with four tiles that each state their rule. Hide published work by default.
- **Executor proposed**: agy, executor default model — standard difficulty; the rule set is the hard part and it is fully specified below.
- **Done criteria** (terse): four tiles, mutually exclusive, summing to the unfinished count; published hidden by default; `AttentionPanel` deleted; new e2e spec green.
- **Stop conditions** (terse): `board.spec.ts`'s `Needs your attention` assertion cannot be satisfied, or bucket rules need server data.
- **Test / verification for success**: `e2e/control-room.spec.ts` asserts the four tile counts sum exactly to the unfinished total — so any overlapping or gapped rule fails it.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 4a9c75c6..HEAD -- apps/tutorial-tracker-app/src/client/Board.tsx apps/tutorial-tracker-app/src/client/filterModel.ts apps/tutorial-tracker-app/src/client/AttentionPanel.tsx`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `4a9c75c626e6`, 2026-08-21

## Why this matters

Two systems disagreeing about urgency is worse than one imperfect system: the owner stops reading both. The fix is not prettier tiles, it is **one rule set with no overlap and no gaps**, provable by arithmetic.

## Current state

Two independent classifiers exist today.

**One** — `src/client/AttentionPanel.tsx` (152 lines). Loops every stage of every row and pushes into five groups with `continue` after the first match, so a *stage* lands in one group but a *video* can appear in several. Thresholds are local: `THRESHOLDS = { review: 2, bounced: 2, idle: 3 }`. Renders five coloured accordions, all collapsed, above the table. Also carries a `react-hooks/purity` lint error (`Date.now()` during render).

**Two** — `src/client/filterModel.ts` `bucketOf(row)` (added in `516d233b`). Classifies a whole *video* into exactly one of `nudge | review | moving | published` using its **active stage only**, with `NUDGE_AFTER_DAYS = { "Need Changes": 2, "In Review": 2, "To Do": 3 }`. Already mutually exclusive. `Filters.tsx` renders it as five chips.

`src/client/Board.tsx` renders `AttentionPanel`, then the video-type switch, then `Filters`, then `PipelineBoard`, in the `pipeline` tab.

`e2e/board.spec.ts:30` asserts the text **`Needs your attention`** is visible for the admin, and that typing `test-` in `Search title…` hides a specific title. Both must keep working.

## The rule set (specify exactly this — do not invent variants)

Applies to **unpublished** videos only. Evaluate in order; first match wins; every unpublished video matches exactly one.

| Bucket | Label | Rule | Colour |
|---|---|---|---|
| `needsyou` | Waiting on you | active stage status is `In Review` **and** the viewer is that stage's reviewer | accent |
| `late` | Late | active stage's ETA column is set and is in the past | red |
| `idle` | Not moving | nothing matched above **and** the active stage has sat in its status >= 3 days | amber |
| `moving` | Moving fine | everything else unpublished | emerald |

`published` (no active stage) is **excluded from the four tiles** and from the default table view.

Because the rules are ordered and the last is a catch-all, `needsyou + late + idle + moving === unpublished.length`. That identity is what the gate asserts.

Reuse the existing helpers: `activeStage`, `statusOf`, `statusColOf`, `sinceOf`, `daysSince`, `reviewerColOf`, `etaColOf` (all already exported through `src/client/stages.ts` / `src/client/pipeline.ts`). Late-ness uses `etaBadge()` from `src/client/labels.ts`, whose `eta-late` tone already means "past due".

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `cd apps/tutorial-tracker-app && npm run typecheck` | exit 0 |
| Lint changed files | `cd apps/tutorial-tracker-app && ./node_modules/.bin/eslint src/client/Board.tsx src/client/filterModel.ts src/client/Filters.tsx` | exit 0 |
| Unit tests | `cd apps/tutorial-tracker-app && npm test` | 209+ passed |
| Seed | `cd apps/tutorial-tracker-app && npm run seed:local` | `-- applied to local D1` |
| e2e | `cd apps/tutorial-tracker-app && npm run e2e` | all pass |
| Screenshot | `cd apps/tutorial-tracker-app && npm run shot -- sean docs/flow/shots/214-control-room.png` | prints the path |

## Scope

**In scope**:
- `src/client/filterModel.ts` — rewrite `bucketOf` to the four-bucket rule set above; export the bucket list
- `src/client/Filters.tsx` — chips become the four tiles plus a `Show published` toggle
- `src/client/Board.tsx` — drop `AttentionPanel`, render the tiles
- Delete `src/client/AttentionPanel.tsx`
- `e2e/control-room.spec.ts` — new
- `docs/flow/shots/214-control-room.png` — new

**Out of scope**:
- `PipelineBoard.tsx` — its rows, progress strips and column sorting stay exactly as they are
- `CardDetail.tsx`, `MyWork.tsx`, `NewVideoDialog.tsx`
- Server / engine code

## Git workflow

- Branch: `advisor/214-tracker-control-room`
- Commit: `feat(tracker): control room` — no AI footers. Do NOT push.

## Steps

### Step 1: Rewrite `bucketOf` to the four-bucket rule set

In `src/client/filterModel.ts`, replace `bucketOf` with the ordered rules in the table above. It needs the viewer's email to decide `needsyou`, so change the signature to `bucketOf(row: Row, viewerEmail?: string)` and thread `viewerEmail` from `Board.tsx` (it already receives `viewerEmail` as a prop).

Export the ordered bucket definitions so the tiles and the arithmetic gate share one source:

```ts
export const BUCKETS: { key: Bucket; label: string; rule: string }[] = [
  { key: "needsyou", label: "Waiting on you", rule: "Submitted and needs your approval" },
  { key: "late",     label: "Late",           rule: "Past the date the doer promised" },
  { key: "idle",     label: "Not moving",     rule: "Nobody has touched it for 3+ days" },
  { key: "moving",   label: "Moving fine",    rule: "On time and being worked on" },
];
```

**Verify**: `cd apps/tutorial-tracker-app && npm run typecheck` -> exit 0

### Step 2: Tiles replace the chips

In `Filters.tsx`, render the four buckets as tiles (design: big tabular count, label, and the rule as one small line underneath). Clicking a tile filters; clicking the active tile clears. Keep:

- the search input with placeholder **exactly** `Search title…` (`board.spec.ts` asserts it)
- the `More filters` disclosure with assignee / category / stage
- the `Clear` button

Add a `Show published` / `Hide published` toggle. Default: **hidden**. `rowMatchesFilters` must exclude `published` rows unless the toggle is on.

**Verify**: `cd apps/tutorial-tracker-app && npm run seed:local && npm run e2e -- e2e/board.spec.ts` -> 5 passed

### Step 3: Retire `AttentionPanel`

Remove the `AttentionPanel` import and render from `Board.tsx` and delete `src/client/AttentionPanel.tsx`.

`board.spec.ts:30` asserts `Needs your attention` is visible. Keep that string as the **heading above the four tiles** — the phrase survives, the five accordions do not.

`THRESHOLDS` was exported from `AttentionPanel.tsx`; grep for other importers first (`grep -rn "AttentionPanel\|THRESHOLDS" src/`) and move the constant into `filterModel.ts` if anything else uses it.

**Verify**: `cd apps/tutorial-tracker-app && ./node_modules/.bin/eslint src/client/Board.tsx` -> no output, and `grep -rn AttentionPanel src/` -> no matches

### Step 4: Write the arithmetic gate

Create `apps/tutorial-tracker-app/e2e/control-room.spec.ts`. The load-bearing assertion is that the tile counts **sum** to the unfinished total — that is what catches an overlapping or gapped rule.

```ts
import { test, expect } from "@playwright/test";
import { loginAs, PERSONAS } from "./helpers";

const LABELS = ["Waiting on you", "Late", "Not moving", "Moving fine"];

async function tileCount(page, label: string): Promise<number> {
  const tile = page.getByRole("button", { name: new RegExp(label) });
  const text = await tile.innerText();
  return Number((text.match(/\d+/) ?? ["0"])[0]);
}

test("control-room: buckets must sum to the unfinished total", async ({ page }) => {
  await loginAs(page, PERSONAS.sean);
  await expect(page.getByText("Needs your attention")).toBeVisible();
  const counts = await Promise.all(LABELS.map((l) => tileCount(page, l)));
  const sum = counts.reduce((a, b) => a + b, 0);
  const shown = Number((await page.getByTestId("row-count").innerText()).match(/\d+/)![0]);
  expect(sum, "buckets must sum to the unfinished total").toBe(shown);
});

test("control-room: published work is hidden until asked for", async ({ page }) => {
  await loginAs(page, PERSONAS.sean);
  const before = Number((await page.getByTestId("row-count").innerText()).match(/\d+/)![0]);
  await page.getByRole("button", { name: /Show published/ }).click();
  const after = Number((await page.getByTestId("row-count").innerText()).match(/\d+/)![0]);
  expect(after).toBeGreaterThan(before);
});
```

This needs a `data-testid="row-count"` on the "N shown" element in `Filters.tsx`. Add it.

**Verify**: `cd apps/tutorial-tracker-app && npm run seed:local && npm run e2e -- e2e/control-room.spec.ts` -> 2 passed

### Step 5: Prove the gate can fail

The frontmatter mutation removes the `In Review` age check, which makes `review`-ish rows escape `idle` and breaks the sum.

```bash
sed -i '' 's/if (status === "In Review") return age >= limit ? "nudge" : "review";/if (status === "In Review") return "review";/' apps/tutorial-tracker-app/src/client/filterModel.ts
cd apps/tutorial-tracker-app && npm run e2e -- e2e/control-room.spec.ts   # MUST fail with "buckets must sum"
```

If the rewritten `bucketOf` no longer contains that exact line, **update `mutation_apply` in this plan's frontmatter to a one-liner that does reintroduce a real overlap or gap**, and prove that one fails instead. A mutation that cannot fire is a STOP condition.

**Verify**: mutated run fails printing `buckets must sum`; reverted run passes

### Step 6: Screenshot

```bash
cd apps/tutorial-tracker-app && npm run shot -- sean docs/flow/shots/214-control-room.png
```

**Verify**: `git status --short docs/flow/shots/214-control-room.png` -> shows the file

## Test plan

1. `npm run typecheck` — exit 0
2. `eslint` on the three changed files — no output (the deleted file also removes 9 pre-existing lint errors)
3. `npm test` — 209+ passing
4. `npm run seed:local && npm run e2e` — every spec passes
5. Step 5's mutation loop behaves as described

## Done criteria

- [ ] Exactly four tiles, each showing its rule in words
- [ ] Tile counts sum to the unfinished total, asserted by the spec
- [ ] Published videos hidden by default; one toggle reveals them
- [ ] `src/client/AttentionPanel.tsx` deleted, no importers left
- [ ] `Needs your attention` still visible to the admin
- [ ] `Search title…` placeholder unchanged; `More filters` still works
- [ ] `e2e/control-room.spec.ts` passes and fails under mutation
- [ ] All five pre-existing e2e specs pass
- [ ] `docs/flow/shots/214-control-room.png` committed

## STOP conditions

- A bucket rule needs data the board API does not send
- `board.spec.ts`'s `Needs your attention` or `Search title…` assertions cannot be kept
- The mutation cannot be made to fail the new spec
- Deleting `AttentionPanel.tsx` breaks an importer outside this plan's scope

## Maintenance notes

- The four rules are ordered and the last is a catch-all **on purpose**. Any future bucket must be inserted into the order, never bolted on beside it, or the sum identity breaks and the gate will say so.
- `bucketOf` now takes `viewerEmail`. "Waiting on you" is viewer-relative, so the tile counts legitimately differ between two admins.
