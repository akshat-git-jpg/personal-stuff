# Plan 022: Make the pipeline-engine round-trip + routing guard test loop over ALL PipelineDefs

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 671741e..HEAD -- apps/tutorial-tracker-app/test/engine.test.ts apps/tutorial-tracker-app/src/shared/engine/`
> If any in-scope file changed since this plan was written, compare the
> excerpts below against the live code; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (test-only change; may legitimately surface a latent bug)
- **Depends on**: none
- **Category**: tests
- **Executor**: antigravity
- **Difficulty**: standard
- **Planned at**: commit `671741e`, 2026-07-05

## Why this matters

The tracker app (`apps/tutorial-tracker-app/`) is a generic multi-system
pipeline engine: each "system" is one typed `PipelineDef`, and the documented
way to add a system is "write one def + register it + deploy". The repo's own
testing rule (recorded in the owner's project conventions) is that
data-driven/generic layers get **invariant tests that loop over ALL configs**,
so a new config can't silently break behavior.

Today the storage round-trip test (flat `Row` ⇄ normalized cards/card_stages)
and the write-routing test run **only against the "standard" pipeline**. The
`tut-2` def gets a stage-order check only. `validatePipelines()` catches
structural mistakes (dangling gates, missing reviewer slots) but NOT a lossy
`decomposeRow`/`assembleRow` round-trip or a mis-routed column. A future third
def could pass every existing check while silently dropping data.

After this plan: a generic round-trip + routing invariant runs over every id
in `pipelineIds()`, deriving its synthetic row from each def's own stage
metadata — so any future def is covered automatically with zero test edits.

## Current state

- `apps/tutorial-tracker-app/test/engine.test.ts` — vitest suite; the app's
  `npm test` runs it (49 tests total pass at `671741e`).
- `apps/tutorial-tracker-app/src/shared/engine/registry.ts` — exports
  `PIPELINES`, `pipelineIds()`, `getPipeline(id)`, `validatePipelines()`.
- `apps/tutorial-tracker-app/src/shared/engine/card.ts` — `decomposeRow(P, row, isNew?)`,
  `assembleRow(P, card, stages)`, `routeWrite(P, col)`.
- `apps/tutorial-tracker-app/src/shared/engine/types.ts` — `colOf(stage, slot)`
  resolves a stage's flat-Row column key per slot; slot keys used by the
  validator are:
  `["status", "assignee", "reviewer", "work_link", "eta", "instruction", "feedback"]`
  (see `validatePipeline` in registry.ts, which calls `colOf(s, slot)` for
  exactly that list). `stageHasReviewerSlot(s)` says whether a stage has a
  reviewer column.

Existing test excerpt (`test/engine.test.ts`, the part this plan generalizes):

```ts
describe("storage round-trip (flat Row ⇄ normalized)", () => {
  const P = getPipeline("standard");
  const original: Record<string, string> = {
    pipeline: "standard", row_id: "r0007", last_updated: "2026-06-30T10:00:00Z", status_since: "2026-06-29T00:00:00Z",
    video_title: "How to SSO", /* ... ~30 more hardcoded standard-pipeline columns ... */
  };

  it("is lossless including status_since + passthrough of stray legacy cols", () => {
    const { card, stages } = decomposeRow(P, original);
    const rebuilt = assembleRow(P, card, stages) as Record<string, string>;
    for (const k of Object.keys(rebuilt)) {
      if (k.endsWith("_since") && k !== "status_since") continue;
      expect(`${k}=${rebuilt[k] ?? ""}`).toBe(`${k}=${original[k] ?? ""}`);
    }
    ...
  });
  it("routes writes to the right table/slot", () => {
    expect(routeWrite(P, "script_link")).toEqual({ kind: "stage", stageId: "script", slot: "work_link" });
    ...
  });
});

describe("tut-2 normalizes cleanly", () => {
  const P = getPipeline("tut-2");
  it("has the processing (task) stage with no reviewer slot", () => {
    const { stages } = decomposeRow(P, { row_id: "v1", pipeline: "tut-2", video_title: "V2 vid" }, true);
    expect(stages.map((s) => s.stage_id)).toEqual(["topic", "outline", "recording", "processing", "editing", "thumbnail", "upload"]);
  });
});
```

Imports already present at the top of the test file:

```ts
import { validatePipelines, getPipeline, allRoles, pipelineIds, rolesForSystem } from "../src/shared/engine/registry";
import { assembleRow, decomposeRow, routeWrite, type StageRecord } from "../src/shared/engine/card";
```

Repo conventions to match: vitest `describe`/`it`, no snapshot tests, terse
test names, TypeScript strict. Do NOT modify existing tests — add a new
`describe` block.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Install (if needed) | `cd apps/tutorial-tracker-app && npm install` | exit 0 |
| Typecheck | `cd apps/tutorial-tracker-app && npm run typecheck` | exit 0 |
| Tests | `cd apps/tutorial-tracker-app && npm test` | all pass (49 existing + new) |

## Scope

**In scope** (the only file you should modify):
- `apps/tutorial-tracker-app/test/engine.test.ts` (add one new `describe` block)

**Out of scope** (do NOT touch):
- `src/shared/engine/*` — if the new test FAILS against `tut-2`, that is a
  real latent bug: STOP and report, do not "fix" engine code.
- The existing `describe` blocks in engine.test.ts.
- Any other app file.

## Git workflow

- Branch: `advisor/022-engine-guard-all-defs`
- Commit: `test(tracker-app): round-trip + routing invariants over every PipelineDef` — no AI footers. Do NOT push.

## Steps

### Step 1: Read the helpers you'll use

Open `src/shared/engine/card.ts` and confirm `assembleRow` / `decomposeRow` /
`routeWrite` signatures match the excerpts above, and that `CardRecord` and
`StageRecord` are exported interfaces. If names differ, STOP.

**Verify**: `cd apps/tutorial-tracker-app && npm test` → all existing tests pass (baseline green).

### Step 2: Add the generic invariant block (ROUND-3 CORRECTED VERSION)

> **Round-3 note (2026-07-05):** the first version of this step synthesized a
> row by filling EVERY slot for EVERY stage. That was wrong: `card.ts` has a
> private `activeSlots(s)` filter — brief-kind stages (e.g. `topic`) have no
> `work_link`/`eta`/`instruction`, so cols like `topic_work_link` don't exist
> in the schema and `routeWrite` CORRECTLY passes them through as
> `card_extra`. The failure `col topic_work_link ... card_extra` was a
> false positive; the engine is correct. The corrected test below derives the
> schema from the engine itself: `assembleRow` from fully-populated
> StageRecords only emits columns that actually exist.
> **If the previous (failing) version of this block is already committed in
> `test/engine.test.ts`, REPLACE it with the block below.**

Imports needed (extend the existing import line from
`../src/shared/engine/card`): `assembleRow, decomposeRow, routeWrite,
type StageRecord, type CardRecord`.

```ts
describe("EVERY pipeline def: round-trip + routing invariants", () => {
  for (const pid of pipelineIds()) {
    const P = getPipeline(pid);

    // Ground-truth flat row: assemble from fully-populated normalized records.
    // assembleRow only emits the slots each stage actually exposes, so the
    // row IS the real schema — no slot-guessing. Slot values encode their
    // origin as "<stageId>|<slot>" so the routing test can verify each column
    // maps back to exactly the record it came from.
    const card: CardRecord = {
      id: `r-${pid}`, pipeline_id: pid, title: `T-${pid}`, notes: "n",
      description: "d", category: "c", subcategory: "s",
      updated_at: "2026-07-05T00:00:00Z", status_since: "2026-07-04T00:00:00Z",
    };
    const stages: StageRecord[] = P.stages.map((s) => ({
      card_id: `r-${pid}`, stage_id: s.id,
      status: `${s.id}|status`, assignee: `${s.id}|assignee`,
      reviewer: `${s.id}|reviewer`, work_link: `${s.id}|work_link`,
      instruction: `${s.id}|instruction`, eta: `${s.id}|eta`,
      feedback: `${s.id}|feedback`,
    }));
    const row = assembleRow(P, card, stages) as Record<string, string>;

    it(`[${pid}] decompose→assemble is lossless over the real schema`, () => {
      const d = decomposeRow(P, row);
      const rebuilt = assembleRow(P, d.card, d.stages) as Record<string, string>;
      for (const k of Object.keys(row)) {
        // *_status_since cols are store-stamped, one-way — same carve-out as
        // the existing "storage round-trip" test above.
        if (k.endsWith("_since") && k !== "status_since") continue;
        expect(`${k}=${rebuilt[k] ?? ""}`).toBe(`${k}=${row[k] ?? ""}`);
      }
    });

    it(`[${pid}] every stage-emitted column routes back to its stage+slot`, () => {
      let checked = 0;
      for (const [col, v] of Object.entries(row)) {
        if (!v || !v.includes("|")) continue;      // only stage-slot values
        const [stageId, slot] = v.split("|");
        expect(routeWrite(P, col), `col ${col}`).toEqual({ kind: "stage", stageId, slot });
        checked++;
      }
      // status + assignee are active on every stage — hard floor on coverage
      expect(checked).toBeGreaterThanOrEqual(P.stages.length * 2);
    });
  }
});
```

Notes, decided at plan time so you don't have to:
- Status values are opaque strings to `card.ts` (pure column mapping — no
  status-word validation happens there), so `"<stageId>|status"` is safe.
- Stage `extra` fields (e.g. upload's short_links) appear in the row as `""`
  (our records set no extra_json); they're skipped by the value check and
  round-trip as `""` ⇄ absent — covered by the lossless loop's `?? ""`.
- Do NOT import or replicate `activeSlots` — deriving the row via
  `assembleRow` is the point.

**Verify**: `cd apps/tutorial-tracker-app && npm run typecheck` → exit 0.

### Step 3: Run the suite

**Verify**: `cd apps/tutorial-tracker-app && npm test` → all tests pass,
count increased by 2 × (number of pipelines) = 4 new tests (standard + tut-2,
two `it`s each). If a `[tut-2]` test FAILS: that is a discovered latent bug —
STOP and report the exact failing assertion; do not modify engine code.

## Test plan

This plan IS a test plan. New tests: per-pipeline losslessness + per-pipeline
routing, driven from def metadata. Pattern to follow: the existing
`storage round-trip` describe in the same file.

## Done criteria

- [ ] `npm run typecheck` exits 0 (in apps/tutorial-tracker-app)
- [ ] `npm test` exits 0 with 4 new tests visible in output
- [ ] The new block contains `for (const pid of pipelineIds())` — no hardcoded pipeline list
- [ ] `git status` shows only `test/engine.test.ts` modified (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Step 1 finds different names/signatures for `colOf`, `stageHasReviewerSlot`,
  `decomposeRow`, `assembleRow`, or `routeWrite`.
- A new test fails against any pipeline — report the assertion verbatim
  (this is a real finding, not a test bug), do NOT edit `src/shared/engine/`.
- Baseline `npm test` is already red before your change.

## Maintenance notes

- Any future `PipelineDef` added to `PIPELINES` is covered automatically; the
  test count grows by 2 per def.
- If a def someday legitimately routes a stage column to `card_extra`, relax
  that assertion for that column explicitly with a comment — don't delete the
  invariant.
