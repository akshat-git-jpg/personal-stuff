# Plan 017: Tracker — per-card activity thread (review history survives)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fe324e0..HEAD -- apps/tracker-app/src/worker/ apps/tracker-app/src/client/CardDetail.tsx apps/tracker-app/src/client/api.ts`
> (CardDetail/worker WILL have drifted if plans 015–016 ran — expected; this
> plan builds on 015's CardDetail with the journey rail.)

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (first D1 schema addition since the engine migration; prod migration is owner-run)
- **Depends on**: 015 (CardDetail layout)
- **Category**: feature
- **Executor**: sonnet
- **Difficulty**: standard
- **Planned at**: commit `fe324e0`, 2026-07-05

## Why this matters

Review back-and-forth is the tracker's core loop (submit → request changes →
fix → resubmit → approve), but the app keeps **only the latest feedback per
stage**: each stage has a single `feedback` slot (`src/shared/engine/types.ts:27`,
`SlotKey`), overwritten atomically on every send-back. After a second
send-back, the first reason is gone; nobody can answer "how many rounds did
this go through, and what was asked each time?" The freelancer loses context
mid-rework, and the admin has no audit trail of the cycle. This plan adds an
append-only `card_events` table, writes an event on every status transition
and review action, and renders a chronological **Activity** thread in the card
detail panel.

## Current state

- **Storage** (Cloudflare D1, binding `TRACKER_DB`, database `tracker-db`):
  tables `pipelines`, `cards`, `card_stages`, `employees` (+
  `assignment_defaults`). All access via the single `D1Store` class in
  `src/worker/datastore.ts` (`getStore(env)`); statements built with
  `this.db.prepare(...)`, batched via `this.db.batch(stmts)`.
- **Where transitions happen** (the only two write paths for status):
  1. `/api/update` (`src/worker/index.ts`, around lines 480-510): doer status
     writes; after `authorizeWrite` passes it builds `writeValues` (stamping
     card-level `status_since` at line 493 when the col is a status col) and
     calls `store.updateCells(...)`. The stage id for a status col:
     `statusStageId(p, col)` from `src/shared/engine/card.ts:147-150`.
  2. `/api/review` (around lines 560-600): reviewer approve/send-back;
     already knows `stage` (a `StageDef`), the actor, and the feedback text;
     writes status + feedback + `status_since` in one `updateCells` call
     (line 582-585).
- Both routes already fire best-effort emails after the write (`notify.ts`
  senders wrapped so failures never block) — copy that pattern for event
  writes.
- **Sessions/user**: `getUser(c)` gives `{ email, roles, memberships }`.
- **Client**: `CardDetail.tsx` (after plan 015) has a sectioned scroll body:
  journey rail → feedback banners → admin blocks → field sections → actions
  footer. `api.ts` holds all fetch wrappers; names map available in
  CardDetail props for `displayName`.
- **Schema management precedent**: one-time TS scripts in `scripts/`
  (`migrate-to-engine.ts`, `migrate-system-scoping.ts`) run with `npx tsx`,
  plus local D1 seeding via `scripts/seed-local.ts` which (re)creates tables
  with `CREATE TABLE IF NOT EXISTS` / DROP+CREATE (see its lines 170-190).
  Local dev DB: `npx wrangler d1 execute tracker-db --local --command "..."`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Tests / build | `cd apps/tracker-app && npm test && npm run build` | pass / exit 0 |
| Create table locally | `cd apps/tracker-app && npx wrangler d1 execute tracker-db --local --file=migrations/0002_card_events.sql` | exit 0 |
| Inspect local events | `npx wrangler d1 execute tracker-db --local --command "SELECT * FROM card_events ORDER BY id DESC LIMIT 10"` | rows after actions |
| Seed + dev | `npm run seed:local && npm run dev:local` | :5173 up |
| e2e | `npm run e2e` | pass |

## Scope

**In scope**:
- New `apps/tracker-app/migrations/0002_card_events.sql` (new folder is fine; also add the CREATE to `scripts/seed-local.ts` so a fresh local DB has it).
- `src/worker/datastore.ts` — `logEvent` + `listEvents` methods.
- `src/worker/index.ts` — event writes in `/api/update` (status cols only) + `/api/review`; new `GET /api/card-events`.
- `src/client/api.ts` — `getCardEvents(row_id)` wrapper + types.
- `src/client/CardDetail.tsx` — Activity section.

**Out of scope**:
- Backfilling history for existing cards (starts empty — that's fine).
- Events for content edits, assignments, or team changes (status + review only; keep the table generic enough via `type`).
- Running anything against the PRODUCTION database (STOP condition below).
- Freelancer inbox (015) and attention panel (016).

## Git workflow

- Branch: `advisor/014-tracker-revamp` (continue).
- Commit: `feat(tracker-app): card activity thread (card_events)` — no AI footers. Do NOT push.

## Steps

### Step 1: Schema

`migrations/0002_card_events.sql`:

```sql
CREATE TABLE IF NOT EXISTS card_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id TEXT NOT NULL,
  stage_id TEXT NOT NULL,
  type TEXT NOT NULL,          -- start | submit | approve | sendback | reopen | complete
  actor TEXT NOT NULL,         -- email
  detail TEXT,                 -- feedback text for sendback/reopen; else NULL
  created_at TEXT NOT NULL     -- ISO
);
CREATE INDEX IF NOT EXISTS idx_card_events_card ON card_events (card_id, id);
```

Apply locally (command table). Add the same `CREATE TABLE IF NOT EXISTS` +
index to `scripts/seed-local.ts` beside the other table DDL so
`npm run seed:local` provisions it.

**Verify**: the inspect command returns an empty result set (no error).

### Step 2: Datastore methods

In `D1Store` (`src/worker/datastore.ts`), following the class's existing
prepare/bind style:

```ts
async logEvent(e: { card_id: string; stage_id: string; type: string; actor: string; detail?: string }) {
  await this.db.prepare(
    `INSERT INTO card_events (card_id, stage_id, type, actor, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(e.card_id, e.stage_id, e.type, e.actor, e.detail ?? null, new Date().toISOString()).run();
}
async listEvents(cardId: string): Promise<CardEventRecord[]> {
  return ((await this.db.prepare(`SELECT * FROM card_events WHERE card_id = ? ORDER BY id ASC`)
    .bind(cardId).all<CardEventRecord>()).results ?? []);
}
```

with `CardEventRecord` typed in the same file (id, card_id, stage_id, type,
actor, detail, created_at — all strings, id number).

**Verify**: `npx tsc -p tsconfig.worker.json --noEmit` → exit 0.

### Step 3: Write events on the two transition paths

Both writes are **best-effort**: wrap in `try/catch {}` after the main
`updateCells` succeeds (mirror how the routes treat email sends — an event
failure must never fail the action).

1. `/api/update`: only when the written col is a status col
   (`STATUS_COLS.has(typedCol)`, same check as the `status_since` stamp at
   line 493). Derive `stage_id = statusStageId(p, typedCol)` and the type from
   the transition the client applied — the server knows the target value:
   map target status → type via the stage's lifecycle transitions
   (`lifecycle(stage.lifecycle).transitions.find(t => t.to === value && t.from === <previous status>)?.kind`),
   falling back to `"submit"`-style naming: use the transition `kind` directly
   as the event `type` (`start`, `submit`, `advance` → store as `complete`).
   Actor = session email.
2. `/api/review`: after the batched write — `type: action === "approve" ? "approve" : (currentStatus === "Done" ? "reopen" : "sendback")`,
   `detail: feedback` for sendback/reopen, actor = session email,
   `stage_id = stage.id`.

**Verify**: run dev:local; as Sam start + submit Script, as Riya send back
with a note, as Sam resubmit, as Riya approve → the inspect command shows 5
events in order (`start`, `submit`, `sendback`(detail), `submit`, `approve`).

### Step 4: Read API

`GET /api/card-events?row_id=...` in `src/worker/index.ts` (behind the session
like every `/api/*` route): load the row set (`cachedReadRows`), find the row,
authorize with the same visibility the board uses —
`filterRowsForMemberships(memberships, email, [row]).length === 1` — else 403.
Return `{ events: [...] }` with `actorName` resolved via the team names map
(same helpers the review-queue route uses at lines 418-439).

**Verify**: `curl` (or browser fetch as a dev persona) returns the Step 3
events; a persona with no stake in the card gets 403.

### Step 5: Activity section in CardDetail

- `api.ts`: `CardEvent` type + `getCardEvents(row_id)` wrapper (follow
  `getReviewQueue`'s error-tolerant shape: on !ok return `{ events: [] }`).
- `CardDetail.tsx`: an **Activity** disclosure section at the bottom of the
  scroll body (below field sections, above the delete block), lazy-fetched on
  first expand. Chronological list; each entry: stage label chip (resolve
  `stage_id` via `stageByIdIn(pipeline, ...)`; fall back to the raw id), a
  short verb line ("Sam submitted for review", "Riya requested changes",
  "Riya approved") via `displayName(actor, names)`, relative date, and for
  sendback/reopen the `detail` text in a quoted block (reuse the red feedback
  styling already in the file). Empty state: "No activity yet."
- The existing latest-feedback banners stay — the thread is history, the
  banner is the current call to action.

**Verify**: `npm run build` exit 0; the Step 3 sequence renders as a readable
thread on the card for Sam, Riya, and Sean.

### Step 6: e2e touch-up

One spec: after a scripted sendback via the UI, the card's Activity section
shows a "requested changes" entry containing the feedback text.

**Verify**: `npm run e2e` → all pass.

## Test plan

- Manual event-sequence walkthrough (Step 3/5) — the acceptance test.
- e2e spec (Step 6).
- `npm test` (no engine changes expected; suite must stay green).

## Done criteria

- [ ] `npm test`, `npm run e2e`, `npm run build` pass.
- [ ] Two full review cycles on one card produce a complete, ordered thread — the first cycle's feedback is still readable after the second send-back.
- [ ] Event write failure cannot fail a transition (verified by code shape: try/catch, after the main write).
- [ ] `/api/card-events` 403s for a user who can't see the card.
- [ ] `migrations/0002_card_events.sql` committed; seed-local provisions the table.

## STOP conditions

- **Never run any migration or wrangler command against the remote/production
  D1.** The prod `CREATE TABLE` is the owner's step (one command, noted below)
  — if a step seems to require prod access, stop and report.
- `/api/update` / `/api/review` shapes differ materially from the excerpts
  (drifted) — stop, report.

## Maintenance notes

- **Owner's prod step after merge+deploy**:
  `npx wrangler d1 execute tracker-db --remote --file=migrations/0002_card_events.sql` (idempotent).
- The table is generic (`type` is free text): assignment changes or content
  edits can log events later without schema change — just more `logEvent`
  calls.
- Delete-video (`/api/delete`) leaves orphan events; harmless (queries are by
  card_id). If it ever matters, delete them in the same route.
