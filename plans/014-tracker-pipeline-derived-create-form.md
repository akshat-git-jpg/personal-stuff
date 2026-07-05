# Plan 014: Tracker — derive the new-video form from the pipeline definition

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fe324e0..HEAD -- apps/tracker-app/src/shared/control.ts apps/tracker-app/src/shared/engine/ apps/tracker-app/src/client/Board.tsx apps/tracker-app/src/worker/index.ts`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (run FIRST in the 014–017 batch — smallest, and 015 moves the code this plan touches)
- **Category**: tech-debt
- **Executor**: sonnet
- **Difficulty**: standard
- **Planned at**: commit `fe324e0`, 2026-07-05

## Why this matters

The tracker app (`apps/tracker-app`) is a multi-system pipeline engine: each
video-production "system" is one typed `PipelineDef` in
`src/shared/engine/definitions/`, and the app's stated contract (see the app's
CLAUDE.md) is **"to add a system: write one PipelineDef + register it —
nothing else."**

One surface breaks that contract: the **new-video creation form**. Both the
client modal and the server validation use a global, hardcoded field list
(`NEW_VIDEO_FIELDS` in the *legacy, superseded* `src/shared/control.ts`),
identical for every system. Today both systems happen to want the same four
creation fields, so nothing is visibly broken — but the first future system
that needs a different brief (e.g. an Amazon-channel system that wants an ASIN
field) would silently get the wrong form, and the fix would be rediscovering
this coupling. This plan moves the creation-field list into the engine,
derived per pipeline, with the current four fields as the default.

## Current state

`src/shared/control.ts:119-135` (LEGACY module — the app's CLAUDE.md says
"do not edit the legacy modules for behavior"; we are *removing a dependency
on* it, not changing its behavior):

```ts
export interface NewVideoField {
  col: Column;
  label: string;
  type: "text" | "textarea" | "combo";
  options?: "category" | "subcategory"; // for combo
}
export const NEW_VIDEO_FIELDS: NewVideoField[] = [
  { col: "video_title", label: "Title", type: "text" },
  { col: "video_notes", label: "Notes / brief", type: "textarea" },
  { col: "category", label: "Category", type: "combo", options: "category" },
  { col: "subcategory", label: "Subcategory", type: "combo", options: "subcategory" },
];
```

Consumers (the only two):

1. **Client** — `src/client/Board.tsx:5` imports it; the new-video modal
   (`Board.tsx:211-233` state + `283-328` JSX) renders one input per field and
   validates all fields non-empty before POSTing, adding `pipeline: nvPipeline`
   (the system picked in the modal's "Video type" select).
2. **Worker** — `src/worker/index.ts:51` imports it; the `/api/video` route
   (~line 626) validates each field non-empty:

```ts
for (const f of NEW_VIDEO_FIELDS) {
  // ...requires (body[f.col] ?? "").trim(), else 400
```

The engine already has a per-system brief concept: the first stage of each
`PipelineDef` is `kind: "brief"` with `briefFields` (see
`src/shared/engine/definitions/standard.ts:19-22` and `tut-2.ts:27-28`; both
currently list `["video_title","video_notes","video_description","category","subcategory","topic_date"]`).
Note `briefFields` ≠ creation fields: `video_description` is generated later
and `topic_date` is set by the admin on the card — so creation fields need
their own (defaulted) declaration, not a derivation from `briefFields`.

Engine conventions to match: defaults resolved by exported helper functions in
`src/shared/engine/types.ts` (see `stageHasReviewerSlot`, `contextFieldsOf`,
`workField` at lines 90-120 for the exemplar pattern: `s.x ?? <default>`).
Pipeline lookup: `getPipeline(id)` in `src/shared/engine/registry.ts` (returns
the `standard` def for unknown/blank ids). The client accesses engine helpers
through the façade `src/client/stages.ts`, which re-exports from
`../shared/engine/*` — add new client-needed helpers there, matching its
existing re-export style.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Install (once) | `cd apps/tracker-app && npm install` | exit 0 (uses local `.npmrc` → public registry) |
| Typecheck + tests | `cd apps/tracker-app && npm test` | all tests pass (49+ at plan time) |
| Build | `cd apps/tracker-app && npm run build` | exit 0, SPA in `dist/` |
| Seed local D1 | `cd apps/tracker-app && npm run seed:local` | exit 0 |
| Dev servers | `cd apps/tracker-app && npm run dev:local` | Vite on :5173, wrangler API on :8787 |

## Scope

**In scope**:
- `src/shared/engine/types.ts` — optional `createFields` on the brief stage + a `CreateField` type.
- `src/shared/engine/registry.ts` OR a new small engine module — the `newVideoFieldsFor(pipelineId)` resolver.
- `src/shared/engine/labels.ts` / existing label helpers — reuse for field labels (do not duplicate label strings).
- `src/client/stages.ts` — re-export the new helper for the client.
- `src/client/Board.tsx` — the new-video modal reads fields from the helper, re-rendering when `nvPipeline` changes.
- `src/worker/index.ts` — `/api/video` validates using the helper for the posted `pipeline`.
- `test/engine.test.ts` — add coverage (see Test plan).

**Out of scope**:
- Any behavior change to `src/shared/control.ts` (leave `NEW_VIDEO_FIELDS` exported and untouched; only its two consumers stop importing it).
- The two existing pipeline definitions' creation fields (both keep the default four — zero user-visible change).
- Everything else in Board.tsx (tabs, lanes, detail panel).

## Git workflow

- Branch: `advisor/014-tracker-revamp` (shared by plans 014–017; create from `main`).
- Commit: `refactor(tracker-app): derive new-video form from pipeline def` — no AI footers. Do NOT push.

## Steps

### Step 1: Add the `CreateField` type + per-def override + resolver to the engine

In `src/shared/engine/types.ts`:

```ts
/** A field collected when creating a card (the "new video" form). */
export interface CreateField {
  col: string;                        // flat-Row column it writes
  label: string;
  type: "text" | "textarea" | "combo";
  options?: "category" | "subcategory"; // combo source
}
```

Add to `StageDef` (brief stages only, alongside `briefFields`):

```ts
  /** Brief-only: fields the new-video form collects. Default: title, notes,
   *  category, subcategory (the historical NEW_VIDEO_FIELDS). */
  createFields?: CreateField[];
```

Add a resolver following the existing default-helper pattern in the same file:

```ts
const DEFAULT_CREATE_FIELDS: CreateField[] = [
  { col: "video_title", label: "Title", type: "text" },
  { col: "video_notes", label: "Notes / brief", type: "textarea" },
  { col: "category", label: "Category", type: "combo", options: "category" },
  { col: "subcategory", label: "Subcategory", type: "combo", options: "subcategory" },
];

/** The new-video form fields for a pipeline (its brief stage's, or the default). */
export function createFieldsOf(p: PipelineDef): CreateField[] {
  return p.stages[0]?.createFields ?? DEFAULT_CREATE_FIELDS;
}
```

**Verify**: `cd apps/tracker-app && npx tsc -p tsconfig.app.json --noEmit` → exit 0.

### Step 2: Switch the worker's `/api/video` validation to the resolver

In `src/worker/index.ts`: remove the `NEW_VIDEO_FIELDS` import (line 51);
import `createFieldsOf` from `../shared/engine/types` and resolve the pipeline
FIRST (the route already reads `body.pipeline` — find where it calls
`getPipeline`/defaults it), then validate `createFieldsOf(p)` exactly as the
old loop did (each field non-empty, else the same 400 shape). Keep every other
behavior of the route byte-identical (row creation, defaults, emails).

**Verify**: `cd apps/tracker-app && npx tsc -p tsconfig.worker.json --noEmit` → exit 0.

### Step 3: Switch the client modal to the resolver

- In `src/client/stages.ts`, re-export: `export { createFieldsOf, type CreateField } from "../shared/engine/types";`
- In `src/client/Board.tsx`: remove the `NEW_VIDEO_FIELDS` import (line 5).
  Derive the field list from the currently selected system:
  `const nvFields = createFieldsOf(getPipeline(nvPipeline));` (`getPipeline` is
  already imported from `./stages` at line 4). Replace the three usages —
  `blankNv()` (line 212), the required-check in `submitNewVideo()` (line 220),
  the payload build (line 224), and the JSX loop (line 302) — with `nvFields`.
  When `nvPipeline` changes, reset the draft to `blankNv()` for the new field
  list (extend the existing `Select onValueChange`).
- NOTE: if plan 015 has already run, the modal lives in
  `src/client/NewVideoDialog.tsx` instead of Board.tsx — apply the same changes
  there.

**Verify**: `cd apps/tracker-app && npm run build` → exit 0.

### Step 4: Tests

In `test/engine.test.ts` (follow the file's existing describe/it style):

1. `createFieldsOf(standard)` and `createFieldsOf(tut2)` both return the
   4-field default with cols `["video_title","video_notes","category","subcategory"]`.
2. A synthetic def whose brief stage sets
   `createFields: [{ col: "video_title", label: "Title", type: "text" }, { col: "asin", label: "ASIN", type: "text" }]`
   returns exactly those two.

**Verify**: `cd apps/tracker-app && npm test` → all pass, including the 2 new tests.

### Step 5: Manual smoke

`npm run seed:local && npm run dev:local`, open http://localhost:5173, dev-login
as **Sean** (admin persona), click **New video**: the form must show exactly
Title / Notes / Category / Subcategory for both "Standard" and "Tut 2" video
types, and creating a video must still land it on the Topic board.

**Verify**: created card appears; no console errors.

## Test plan

- The two unit tests in Step 4 (default + override).
- Full existing suite (`npm test`) — guards the `/api/video` behavior via the
  existing engine round-trip tests.
- Manual smoke in Step 5.

## Done criteria

- [ ] `rg "NEW_VIDEO_FIELDS" apps/tracker-app/src/client apps/tracker-app/src/worker` → no matches (only `shared/control.ts` still defines it).
- [ ] `npm test` passes with the 2 new engine tests.
- [ ] `npm run build` exits 0.
- [ ] Manual smoke (Step 5) passes for both systems.

## STOP conditions

- The `/api/video` route validates fields somewhere other than the
  `NEW_VIDEO_FIELDS` loop described above (route has drifted) — stop, report.
- Removing the client import breaks other files (someone else imports
  `NEW_VIDEO_FIELDS` from control.ts beyond Board.tsx + worker/index.ts) —
  stop, report the importers.

## Maintenance notes

- Future systems declare `createFields` on their brief stage only when they
  need a non-default creation form; omitting it keeps the standard four.
- If a `createFields` entry writes a column that isn't a card-level field or
  brief extra, `routeWrite` in `engine/card.ts` will store it in
  `card.extra_json` — fine for display fields; check `assembleRow` exposure if
  a stage needs to *read* it.
