# Plan 016: Tracker — admin "needs attention" panel + title search

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fe324e0..HEAD -- apps/tracker-app/src/worker/datastore.ts apps/tracker-app/src/shared/engine/card.ts apps/tracker-app/src/client/PipelineBoard.tsx apps/tracker-app/src/client/Filters.tsx apps/tracker-app/src/client/Board.tsx`
> (Board.tsx WILL have drifted if plan 015 ran — that's expected; this plan
> assumes 015's tab names: the matrix lives in the admin **Board** tab.)

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW-MED (one datastore write-path tweak; rest is client-only)
- **Depends on**: 015 (Board.tsx restructure; run after it)
- **Category**: feature
- **Executor**: sonnet
- **Difficulty**: standard
- **Planned at**: commit `fe324e0`, 2026-07-05

## Why this matters

The admin's only overview is the Pipeline matrix (`PipelineBoard.tsx`): one row
per video, one column per stage, ✓ / status-pill / ✕ cells. It answers "where
is each video" but not the question the founder actually opens the app with:
**"what is stuck, and on whom?"** Finding overdue ETAs, submissions waiting
days for review, cards bounced back and untouched, or an approved stage whose
next stage has nobody assigned means scanning every row. There is also no
title search, so the matrix stops scaling with card count (already a roadmap
item in the app's CLAUDE.md).

This plan adds an **Attention** panel above the matrix — a grouped exception
list computed from data the admin already receives — plus a client-side title
search in the existing Filters row.

## Current state

- **Per-stage dwell data exists in D1 but is never surfaced.** The
  `card_stages` table has a `status_since` column (see
  `src/worker/datastore.ts:153` — insert lists it), but:
  1. On status writes, only the CARD-level `status_since` is stamped:
     `src/worker/index.ts:493` does
     `if (STATUS_COLS.has(typedCol)) writeValues.status_since = new Date().toISOString();`
     and `routeWrite` maps `status_since` → `{ kind: "system", field: "status_since" }`
     (`src/shared/engine/card.ts:124`) which lands on the `cards` table
     (`datastore.ts:108`). The stage row's own `status_since` is never updated.
  2. `assembleRow` (`src/shared/engine/card.ts:85-102`) only emits the
     card-level value (`status_since: card.status_since ?? ""`, line 89).
- The board route attaches `status_since` outside the column policy for every
  row (`src/worker/index.ts:391-398`), so precedent exists for attaching
  since-values outside role projection.
- ETA columns: every work stage has an `eta` slot (`colOf(s, "eta")`), a date
  string; badges via `etaBadge` in `src/client/labels.ts` (tones: over / late /
  soon / today / ok).
- Stage status helpers (client façade `src/client/stages.ts` re-exports from
  the engine): `statusOf(stage, row)`, `isGateOpen(p, stage, row)` — plus
  `stageStepState(pipeline, stage, r)` (done/active/pending) in
  `src/client/pipeline.ts`.
- `Filters.tsx` (96 lines) renders admin filter dropdowns with
  `AdminFilters` + `rowMatchesFilters(row, filters)`; `PipelineBoard.tsx:89`
  applies them. Matrix rows are already scoped to one selected system
  (`row.pipeline === pipeline.id`).
- Admin receives ALL columns of every row (`visibleColsForRoles` returns
  `allCols` for Admin), so the panel can compute everything client-side once
  per-stage since-values ride along.
- Layout context: after plan 015, the matrix + Filters render inside the admin
  **Board** tab of `src/client/Board.tsx`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck + unit tests | `cd apps/tracker-app && npm test` | all pass |
| Build | `cd apps/tracker-app && npm run build` | exit 0 |
| Seed + dev | `cd apps/tracker-app && npm run seed:local && npm run dev:local` | :5173 up |
| e2e | `cd apps/tracker-app && npm run e2e` | all pass |

## Scope

**In scope**:
- `src/worker/datastore.ts` — stamp stage-level `status_since` when a stage's `status` slot is written.
- `src/shared/engine/card.ts` — emit `<statusCol>_since` flat cols in `assembleRow`.
- `src/worker/index.ts` — attach the per-stage since cols outside role projection (same treatment as `status_since`, admin rows only is fine).
- New `src/client/AttentionPanel.tsx`; wired into the admin Board tab in `Board.tsx`.
- `src/client/Filters.tsx` — title search input + `rowMatchesFilters` extension.
- `test/engine.test.ts` — assembleRow since-col test.

**Out of scope**:
- Archive/pagination (backlog).
- Email/telegram digests of attention items (backlog).
- Any freelancer-facing surface (015 owns those).
- Legacy `src/shared/*` modules.

## Git workflow

- Branch: `advisor/014-tracker-revamp` (continue).
- Commit: `feat(tracker-app): admin attention panel + title search` — no AI footers. Do NOT push.

## Steps

### Step 1: Stamp + surface per-stage `status_since`

1. `src/worker/datastore.ts`, in `updateCells` where stage writes are routed
   (line 110: `else if (t.kind === "stage") su(t.stageId).fields[t.slot] = value;`):
   when `t.slot === "status"`, also set that stage's `status_since`:

```ts
else if (t.kind === "stage") {
  const u = su(t.stageId);
  u.fields[t.slot] = value;
  if (t.slot === "status") u.fields.status_since = new Date().toISOString();
}
```

   (`status_since` is a real `card_stages` column; the upsert at lines 125-129
   builds its column list from the fields map, so no other change is needed.)
2. `src/shared/engine/card.ts` `assembleRow` — inside the per-stage loop
   (lines 95-100), add:
   `row[`${colOf(s, "status")}_since`] = sr?.status_since ?? "";`
3. `src/worker/index.ts` board route — rows already spread
   `...projectRowForRoles(...)` then re-attach `status_since` (lines 391-398).
   For ADMIN viewers (`isAdminRoles(unionRoles(effMemberships))` — compute
   once), also re-attach every `<statusCol>_since` key present on the raw row
   (iterate `Object.keys(r)` for keys ending `"_since"`). Non-admin rows stay
   as-is.
4. Test in `test/engine.test.ts`: `assembleRow` of a card whose script stage
   record has `status_since: "2026-07-01T00:00:00Z"` yields
   `row.script_status_since === "2026-07-01T00:00:00Z"`.

NOTE: existing stage rows have NULL `status_since` until their next status
change — the panel must treat blank as "unknown dwell", falling back to the
card-level `status_since`.

**Verify**: `npm test` → pass incl. new test.

### Step 2: Build `AttentionPanel.tsx`

Props: `{ rows: BoardRow[]; pipelines: PipelineSummary[]; names: Record<string,string>; onOpen(row, stageId): void }`.
Scan ALL rows (across systems — the panel sits above the per-system matrix and
is cross-system on purpose). For each row's pipeline stages compute, with
`DAYS = (iso) => floor((now - iso)/86400e3)` and dwell = stage since-col
falling back to `row.status_since`:

| Group (in this order) | Condition (stage s, status st) | Item line |
|---|---|---|
| Overdue | `etaBadge(row[etaCol])` tone `over`/`late` and st not done | title · stage · assignee name · "ETA <date>" |
| Waiting for review | st === "In Review" and dwell ≥ 2 days | title · stage · reviewer name · "waiting Nd" |
| Bounced, untouched | st === "Need Changes" and dwell ≥ 2 days | title · stage · assignee name · "sent back Nd ago" |
| Ready, nobody assigned | gate open, st === "To Do", assignee blank | title · stage · "unassigned" |
| Ready, not started | gate open, st === "To Do", assignee set, dwell ≥ 3 days | title · stage · assignee name · "idle Nd" |

Thresholds as one exported const object at the top of the file
(`const THRESHOLDS = { review: 2, bounced: 2, idle: 3 };`).

Rendering:
- A compact strip of group cards; each group renders only when non-empty, with
  a count badge and a tone (red for Overdue/Bounced, amber for the rest —
  reuse the tone classes pattern from `CardDetail.tsx`'s `ETA_TONE`).
- Groups collapsed to header+count by default, expandable; each item is a
  clickable row calling `onOpen(row, stageId)` (opens the existing CardDetail
  at that stage, perspective "all").
- All quiet → a single slim "Nothing needs attention ✅" line (do NOT hide the
  panel entirely — the all-clear is information).
- Every label from the def (`stage.label`, `pipelines` name for a system chip
  when items span systems); nothing hardcoded per system.

Wire it into the admin Board tab in `Board.tsx`, above the system toggle +
Filters + matrix, admin-only (`isAdmin && !readOnly`).

**Verify**: `npm run build` exit 0; seeded data (personas seed spreads cards
across every status) shows at least Waiting-for-review and Ready-unassigned
groups as Sean.

### Step 3: Title search in Filters

- Extend `AdminFilters` with `q: string` (default `""` in `EMPTY_FILTERS`), a
  debounced text `Input` ("Search title…") first in the Filters row, and
  extend `rowMatchesFilters` with case-insensitive substring match on
  `video_title` (blank q matches all).
- `PipelineBoard` needs no change (it already applies `rowMatchesFilters`).

**Verify**: typing in the search box as Sean narrows matrix rows live; e2e +
`npm test` still green.

### Step 4: e2e touch-up

Add one spec: Sean's Board tab shows the Attention panel, and searching a
seeded title filters the matrix to it.

**Verify**: `npm run e2e` → all pass.

## Test plan

- Unit: assembleRow since-col (Step 1.4).
- e2e: attention panel presence + search behavior (Step 4).
- Manual: as Sean, confirm each attention group's items open the right card at
  the right stage; flip one card's status and confirm its dwell resets (stage
  `status_since` now stamped).

## Done criteria

- [ ] `npm test`, `npm run e2e`, `npm run build` all pass.
- [ ] Changing a stage status writes that stage's `status_since` in local D1
      (`npx wrangler d1 execute tracker-db --local --command "SELECT stage_id,status,status_since FROM card_stages WHERE card_id='<id>'"` shows a fresh timestamp on the changed stage only).
- [ ] Attention panel shows the five groups per the table, cross-system, with
      working click-through; all-clear line when empty.
- [ ] Title search filters the matrix; clearing it restores all rows.

## STOP conditions

- `updateCells` no longer routes stage writes through the `t.kind === "stage"`
  branch shown above (drift) — stop, report.
- Attaching `_since` cols breaks non-admin projection tests (they should be
  admin-only additions) — stop, report rather than widening projection.

## Maintenance notes

- Thresholds are deliberately constants, not settings — tune by editing
  `THRESHOLDS`. If the owner asks for per-system SLAs later, the right home is
  a `slaDays` field on `StageDef` (engine), feeding this same panel.
- The panel reads flat-row data only; a future "attention" email digest can
  reuse the same group logic server-side — keep the condition functions pure
  and exported.
