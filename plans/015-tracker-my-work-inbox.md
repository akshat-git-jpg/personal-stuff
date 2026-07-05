# Plan 015: Tracker — replace per-stage work tabs with a unified "My Work" inbox

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fe324e0..HEAD -- apps/tracker-app/src/client/ apps/tracker-app/src/shared/engine/rbac.ts apps/tracker-app/src/worker/index.ts apps/tracker-app/e2e/`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED (largest UI change; server visibility rule extended)
- **Depends on**: 014 (touches the same Board.tsx; run 014 first)
- **Category**: feature
- **Executor**: sonnet
- **Difficulty**: standard
- **Planned at**: commit `fe324e0`, 2026-07-05

## Why this matters

The tracker's freelancer UI is organized around **roles and stages**: the board
(`src/client/Board.tsx:104-122`) builds **one tab per (system, stage) the user
owns** plus a separate "Review queue" tab. The owner's core complaints, verbatim
requirements for this plan:

1. A person holding several roles (e.g. Sam: Scriptwriter + Recorder in
   Standard; Nina: Scriptwriter + Tutorial Maker in Tut 2) sees several tabs
   and must poll each to find what's actionable. **They should see everything
   they're expected to do in a single view.**
2. The review back-and-forth (submit → reviewer requests changes → fix →
   resubmit) happens *within* a stage, but nothing aggregates "things bounced
   back to me" — a Need-Changes card sits inside whichever stage tab it
   belongs to.
3. **A freelancer should never perceive the internal role/stage breakdown.**
   They should just see their expectations per video: "submit the outline →
   wait for approval → submit the screen recording → …". When a prior stage is
   approved and their next stage opens, the work should visibly arrive; today
   nothing announces it.
4. This must stay fully **derived from the `PipelineDef`** so any future
   system with any role breakdown gets the same UX with zero per-system UI
   work.

The fix: one **My Work** inbox grouped by *actionability* (Needs your review /
Needs your action / Waiting / Up next / Done), spanning all systems and roles,
plus a per-card "your deliverables" journey rail in the detail panel.

## Current state

Read `apps/tracker-app/CLAUDE.md` first (engine section at the top). Key facts:

- The server computes ALL authority: `/api/board` returns rows carrying
  `_stages` (status cols in the user's lanes), `_actions` (allowed transitions
  per stage), `_locks` (col → reason). The client is render-only.
  `src/worker/index.ts:336-348`:

```ts
function rowMeta(roles: string[], email: string, row: Row) {
  const p = pipeOf(row);
  const stages = cardStagesForUser(roles, email, row);   // statusCols in user's lanes
  const actions = transitionsForCard(roles, email, row); // allowed transitions, per stage
  const locks: Record<string, string> = {};
  ...
  return { _stages: stages, _actions: actions, _locks: locks };
}
```

- `cardStagesForUser` (`src/shared/engine/rbac.ts:269-278`) only includes
  stages whose **gate is open**; `canSeeRow` (`rbac.ts:299-307`) likewise hides
  a card entirely from a doer whose assigned stage isn't open yet:

```ts
export function canSeeRow(roles: string[], email: string, row: Row): boolean {
  if (isAdminRoles(roles)) return true;
  const p = pipeOf(row);
  for (const s of p.stages) {
    if (roles.includes(s.role) && norm(row[colOf(s, "assignee")]) === norm(email) && isGateOpen(p, s, row)) return true;
    if (roles.includes(REVIEWER_ROLE) && stageHasReviewerSlot(s) && norm(row[colOf(s, "reviewer")]) === norm(email)) return true;
  }
  return false;
}
```

  So "up next" work (assigned, gate still closed) is **invisible** to the
  freelancer today — requirement 3 needs a server change.

- Board tabs (`src/client/Board.tsx:104-122`): `review` tab first if the user
  holds Reviewer, then one tab per `activeWorkerStages` entry (a
  (pipelineId, statusCol) pair where the user has a card), then admin tabs
  `pipeline` + `team`. Each work tab renders `renderWork(ws)` →
  `renderLaneBoard` (`Board.tsx:236-281`): status-lane columns (To Do /
  In Progress / …) of `Card` components for ONE stage.
- `Card.tsx` renders title, status pill, Need-Changes banner (it already shows
  the stage's feedback text — see its `feedback` handling), dwell chip
  (`status_since`), ETA badge, and the server-issued action buttons.
- `ReviewQueue.tsx` (35 lines) renders `/api/review-queue` items; queue data
  is fetched in Board.tsx (`refreshQueue`, lines 139-147).
- `CardDetail.tsx:466-475` shows a flat chip row of every stage's status — no
  ordering emphasis, no "you" marking, no gate framing.
- `lanesFor`/`groupByLane` (`src/client/lanes.ts`) serve only `renderLaneBoard`.
- Personas for manual testing (`scripts/seed-local.ts:41-49`; dev-login buttons
  when `DEV_AUTH=1`): **Sean** (Admin + Reviewer both systems), **Sam**
  (standard: Scriptwriter+Recorder), **Nina** (tut-2: Scriptwriter+Tutorial
  Maker), **Riya** (Reviewer both systems), **John** (standard: Video Editor;
  tut-2: Processor+Video Editor).
- e2e: `e2e/board.spec.ts` (Playwright; `npm run e2e`) — asserts on the
  current tab layout; must be updated. Screenshots: `npm run shot -- <persona>`
  (writes `docs/shots/`).
- Styling: Tailwind + shadcn/ui, dark mode via `ThemeToggle`. Match the
  existing component idiom (see Board.tsx / Card.tsx for the class patterns).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck + unit tests | `cd apps/tracker-app && npm test` | all pass |
| Build SPA | `cd apps/tracker-app && npm run build` | exit 0 |
| Seed local D1 | `cd apps/tracker-app && npm run seed:local` | exit 0 |
| Dev servers (HMR) | `cd apps/tracker-app && npm run dev:local` | Vite :5173 + API :8787 |
| e2e smoke | `cd apps/tracker-app && npm run e2e` | all specs pass |
| Screenshot a persona | `cd apps/tracker-app && npm run shot -- sam` | PNG in `docs/shots/` |

## Scope

**In scope**:
- `src/shared/engine/rbac.ts` — `upcomingStagesForUser` helper + `canSeeRow` extension.
- `src/worker/index.ts` — `_upcoming` in `rowMeta`.
- `src/client/api.ts` — `_upcoming` on `BoardRow`.
- `src/client/Board.tsx` — tab restructure; extract the new-video modal to `src/client/NewVideoDialog.tsx` unchanged.
- New `src/client/MyWork.tsx` — the inbox.
- `src/client/Card.tsx` — stage + system chips on the item card.
- `src/client/CardDetail.tsx` — journey rail replacing the flat chip row.
- `src/client/lanes.ts` — delete if no longer imported.
- `src/client/guidance.ts` — repurpose stage guidance into the inbox item / detail context (keep the strings).
- `e2e/board.spec.ts`, `test/engine.test.ts`.

**Out of scope**:
- The admin Pipeline matrix (`PipelineBoard.tsx`), `Filters.tsx`, `TeamPanel.tsx`, `AssignmentDefaults.tsx` (plan 016 covers admin).
- `ReviewQueue.tsx` internals (reused as a section).
- Any RBAC *write* rule — `authorizeWrite`, transitions, gates all unchanged. Visibility (read) is the only server semantic that changes.
- Legacy `src/shared/{pipeline,control,rbac,policy,lifecycle}.ts` — never edit.
- Email notifications.

## Git workflow

- Branch: `advisor/014-tracker-revamp` (continue on it after plan 014).
- Commit: `feat(tracker-app): unified My Work inbox + card journey rail` — no AI footers. Do NOT push.

## Steps

### Step 1: Server — surface "up next" work

In `src/shared/engine/rbac.ts`:

1. Add next to `cardStagesForUser`:

```ts
/** Stages of this card assigned to the user whose gate is NOT open yet — their
 *  "up next" work. Mirrors cardStagesForUser with the gate check inverted. */
export function upcomingStagesForUser(roles: string[], email: string, row: Row): string[] {
  const p = pipeOf(row);
  const out = new Set<string>();
  for (const s of p.stages) {
    if (!roles.includes(s.role) || isGateOpen(p, s, row)) continue;
    if (stageKind(s) !== "brief" && norm(row[colOf(s, "assignee")]) !== norm(email)) continue;
    if (stageKind(s) === "brief") continue; // a brief stage with a closed gate can't exist (stage 0 has no gate)
    out.add(colOf(s, "status"));
  }
  return [...out];
}
```

2. In `canSeeRow`, drop the `isGateOpen` condition so an assigned doer can see
   the card before their gate opens (change `&& isGateOpen(p, s, row)` → nothing).
   Write access is untouched: `authorizeWrite` still refuses edits/transitions
   while the gate is closed ("The previous stage isn't approved yet."), and
   `cardStagesForUser` still gates lane membership. This is deliberate — it is
   what makes "up next" visible.

In `src/worker/index.ts` `rowMeta` (line 336): add
`_upcoming: upcomingStagesForUser(roles, email, row)` to the returned object
(import alongside `cardStagesForUser` at line 34). In `src/client/api.ts`, add
`_upcoming?: string[];` to `BoardRow` (line 24-28).

Add engine tests in `test/engine.test.ts`: for a standard-pipeline row where
Sam is `script_writer_email` AND `tutorial_maker_email` with
`script_status: "In Progress"` — `cardStagesForUser` returns
`["script_status"]`, `upcomingStagesForUser` returns `["tutorial_status"]`,
and `canSeeRow` is true for a Recorder assigned to a not-yet-open stage.

**Verify**: `npm test` → all pass including new tests. If an existing test
asserts the OLD canSeeRow gate-closed behavior, update that assertion (it is
the behavior this plan deliberately changes) and say so in your report.

### Step 2: Extract the new-video modal, then rebuild the tab set

1. Move the modal JSX + its state (`Board.tsx:211-233` and `283-328`, plus the
   `nv*` state) into `src/client/NewVideoDialog.tsx` with a props contract of
   `{ open, onOpenChange, pipelines, defaultPipeline, categoryOptions, subcategoryOptions, onCreated(pipelineId) }`.
   Behavior byte-identical (including the plan-014 per-pipeline fields if 014
   already landed).
2. New tab set in Board.tsx:
   - **My work** — shown to everyone who has any worker stage, any review
     membership, or any `_upcoming`; the only tab most freelancers see (when
     it's the sole tab, render no tab bar at all — the inbox IS the app).
     Label carries the actionable count: `My work (3)` = Need-Changes + To Do
     + In-Progress items + review-queue count.
   - **Board** (admins only — the current "Pipeline" matrix tab, renamed) and
     **Team** (admins only), unchanged content.
   - The `review` tab and all per-stage work tabs are REMOVED (their content
     moves into My Work). Default tab: freelancers → My work; admins → Board.
3. Keep `openDetail`, `doAction`, `handleDelete`, `refreshQueue` in Board.tsx
   and pass them down.

**Verify**: `npm run build` → exit 0.

### Step 3: Build the My Work inbox (`src/client/MyWork.tsx`)

Item model — one entry per (row, statusCol) from the user's meta:

```ts
interface WorkItem { row: BoardRow; statusCol: string; stage: StageDef; pipeline: PipelineDef; status: string; upcoming?: boolean }
// from: row._stages (active) and row._upcoming (upcoming), stage resolved via
// stageByStatusColIn(pipeOf(row), statusCol) from ./stages
```

Sections, in order (a section renders only when non-empty):

1. **Needs your review** — the existing review-queue items (reuse
   `<ReviewQueue items onOpen>`; fetch stays in Board.tsx). Header shows count.
2. **Needs your action** — items with status `Need Changes` (always first,
   with the stage's feedback text quoted inline on the card), then `To Do`,
   then `In Progress`. Sort within a status by ETA ascending (blank ETAs
   last). Each item: video title, stage label chip, system chip (ONLY when
   the user's items span >1 system — reuse the `multiSystem` logic from
   Board.tsx:112), status pill, ETA badge, dwell chip, and the server-issued
   doer action buttons (`_actions` filtered to `by === "doer"` and this
   statusCol — reuse `transitionsForStageCol`, Board.tsx:51-53).
3. **Waiting on review** — items In Review. No actions; subtitle "Submitted —
   waiting for review". Show the reviewer's name when the reviewer column is
   visible to this user (`displayName(row[reviewerColOf(stage)], names)`),
   else omit.
4. **Up next** — items from `_upcoming`. Card is dimmed, no actions; subtitle
   derives from the def: `Opens after <gate stage label> is approved` (gate
   stage via `stageByIdIn(pipeline, stage.gate)`). This is the "here's what's
   expected from you next" surface — requirement 3.
5. **Done** — items whose status equals their lifecycle's `done` status.
   Collapsed by default behind a `Done (N)` disclosure.

Rendering notes:
- Single-column list, `max-w-2xl` centered on desktop; MUST read well at
  390 px wide (the personas use phones). No horizontal lane grid anywhere.
- Section headers: small-caps label + count, matching the existing muted
  typography idiom (`text-xs font-semibold uppercase tracking-wider text-muted-foreground`).
- Clicking an item opens `openDetail(row, stage.id, "doer")` (review items:
  `"reviewer"`), exactly as today.
- Keep `STAGE_GUIDE` (guidance.ts) available as a one-line muted hint inside
  the opened detail, not as a banner per section (the per-stage HelpBanner
  dies with the per-stage tabs; REVIEWER_GUIDE stays above the review section).
- Empty inbox: one friendly empty state ("Nothing needs you right now 🎉"),
  not five empty sections.
- Delete `renderLaneBoard`/`renderWork` from Board.tsx; delete
  `src/client/lanes.ts` if nothing else imports it (`rg "from \"./lanes\"" src/`).

**Verify**: `npm run build` → exit 0; then seed + dev:local and check the four
personas (Step 6 script).

### Step 4: Card journey rail in `CardDetail.tsx`

Replace the flat stage-chip row (`CardDetail.tsx:466-475`) with an ordered
**journey rail** derived from `pipeline.stages`:

- One node per stage in definition order: ✓ + emerald for done (status ===
  its lifecycle's `done`), highlighted ring + status pill for the currently
  active stage(s), muted for not-yet-open stages (lock icon + tooltip
  "Opens after <gate label> is approved").
- Mark the viewer's own stages with a small "you" tag (stage's assignee ===
  `viewerEmail` — pass it into CardDetail from Board's `BoardData.viewerEmail`;
  add the prop). In doer perspective, title the rail "Your part in this video";
  in reviewer/all perspective, "Pipeline progress".
- Horizontally scrollable on small screens (`overflow-x-auto`), nodes joined
  by a thin connector line.

**Verify**: `npm run build` → exit 0; open any card as Sam — rail shows
Script (you) and Recording (you) among six stages, done ones checked.

### Step 5: Update e2e + unit tests

- `e2e/board.spec.ts`: update selectors/assertions for the new tab set and the
  inbox sections (at minimum: Sam logs in → sees "My work" tab; a Need-Changes
  card renders in "Needs your action" with its feedback text; Sean sees
  Board + Team tabs).
- `npm test` green.

**Verify**: `cd apps/tracker-app && npm run e2e` → all specs pass.

### Step 6: Persona walkthrough + screenshots

`npm run seed:local && npm run dev:local`, then for each persona check and
screenshot (`npm run shot -- <persona>`):

| Persona | Must see |
|---|---|
| sam | ONE My Work view; Script + Recording items mixed by actionability, stage chips distinguish them; no per-stage tabs |
| nina | Same for Tut 2 (Outline + Screen recording); an Up next item when her recording gate is closed |
| riya | Needs-your-review section on top with queue items from both systems |
| sean | Board (matrix) + Team tabs + My work with Topic approvals; New video button works |
| john | System chips visible (he spans standard + tut-2) |

**Verify**: all five checks pass; attach shot filenames in the run report.

## Test plan

- New engine tests (Step 1) for `upcomingStagesForUser` + relaxed `canSeeRow`.
- Updated e2e specs (Step 5).
- Persona walkthrough matrix (Step 6) — this is the acceptance test for the
  owner's requirements 1–3.

## Done criteria

- [ ] `npm test` and `npm run e2e` pass.
- [ ] `npm run build` exits 0.
- [ ] No per-stage work tabs remain; freelancers land on a single My Work view.
- [ ] A Need-Changes item shows its reviewer feedback inline in "Needs your action".
- [ ] An assigned-but-gate-closed stage shows as "Up next — opens after <stage> is approved".
- [ ] Persona matrix (Step 6) fully passes with screenshots.
- [ ] Zero references to pipeline/stage specifics hardcoded in MyWork.tsx — everything resolved via `./stages` helpers from the card's `PipelineDef`.

## STOP conditions

- `_stages`/`_actions` shapes differ from the excerpts (server drifted) — stop, report.
- Relaxing `canSeeRow` causes any WRITE-authorization test to fail (it must not — writes are independently gated); if one does, stop and report rather than loosening a write rule.
- The e2e harness can't drive the dev-login personas — stop, report (don't invent an auth bypass).

## Maintenance notes

- MyWork groups purely by lifecycle status + gate state, both derived from the
  def — a new system or a new lifecycle template flows through automatically;
  only a genuinely NEW status word needs a grouping decision here.
- The `canSeeRow` relaxation means doers see upcoming-card briefs earlier;
  column projection still hides other stages' fields per role. If that ever
  feels too open, gate the *fields* further, not the row visibility.
- Plan 017 adds an Activity thread inside CardDetail — keep its layout
  sectioned so the thread can slot in under the journey rail.
