---
executor: agy
model:
test_cmd: cd apps/gym-app && npm run typecheck && npm test
ui: true
deploy:
needs: ["PR #169 = plan 210, the D1 migration", "PR #170 = the approved week-plan UI this plan rewires"]
needs_prs: [169, 170]
touches: [apps/gym-app/schema.sql, apps/gym-app/src/worker/repo.ts, apps/gym-app/src/worker/index.ts, apps/gym-app/src/shared.ts, apps/gym-app/src/client/api.ts, apps/gym-app/src/client/store.tsx, apps/gym-app/src/client/plan.ts, apps/gym-app/src/client/gym.ts, apps/gym-app/src/client/Home.tsx, apps/gym-app/src/client/DayPlan.tsx, apps/gym-app/src/client/ExercisePicker.tsx, apps/gym-app/src/client/WeekStrip.tsx, apps/gym-app/test/repo.test.ts, apps/gym-app/CLAUDE.md, apps/local-apps.md]
mutation_apply: |
  perl -0777 -i -pe 's/ ON CONFLICT \(day, exercise_id\) DO NOTHING//' apps/gym-app/src/worker/repo.ts
mutation_command: npm test
mutation_expect: idempotent
mutation_cwd: apps/gym-app
mutation_timeout: 600
---

# Plan 211: gym-app — put the week plan on D1 and retire the review scaffolding

## Summary

- **Problem statement**: The week-plan UI (This Week strip, Day screen, exercise picker, today's
  tick list) is built, reviewed and approved by the owner, but its data lives in `localStorage`
  and the third gym ("Home") is 10 hardcoded demo rows. Nothing persists across devices, and a
  `REVIEW_MODE` flag in the client store swallows every write in dev.
- **Goals**:
  - Add a `plan` table to D1 and three `/api/plan/*` routes.
  - Rewrite `src/client/plan.ts` so the same exported functions hit the API through the store,
    with no change to any component that consumes them.
  - Make "home" a real gym: a `gym` column on `exercise`, replacing the `MIXED_TABS`
    tab-name-as-gym guesswork and the `HOME_DEMO` fixture.
  - Delete `REVIEW_MODE`, the localStorage override map, and the review banner.
- **Executor proposed**: `agy` (Gemini 3.1 Pro High) — the UI already exists and is approved; the
  schema, routes, and the full replacement `plan.ts` are inlined below.
- **Done criteria** (terse): `npm run typecheck` + `npm test` exit 0 with 6+ new plan tests;
  no `REVIEW_MODE` / `localStorage` plan writes / `HOME_DEMO` left in the tree; a plan row
  survives a hard reload and a second browser; one committed screenshot of the Day screen.
- **Stop conditions** (terse): a component under `src/client/` needing a signature change to
  accommodate the API; a plan row surviving deletion of its exercise; weakening a test assertion.
- **Test / verification for success**: 6 new vitest cases over the plan repo functions in the
  existing `test/repo.test.ts`, plus a scripted puppeteer round trip that adds an exercise to a
  day, reloads, and asserts it is still there.
- **Open points for plan readiness**: none. Both preconditions are encoded structurally as
  `needs_prs: [169, 170]` — boss will not dispatch this plan until the D1 migration (#169) and
  the approved week-plan UI (#170) have both landed.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e57aea85..HEAD -- apps/gym-app/src/client apps/gym-app/src/worker`
> This plan REQUIRES that drift: plan 210's D1 rewrite and the approved week-plan UI must both
> already be in `HEAD`. If `src/client/plan.ts` does not exist, STOP — see Current state.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plan 210 (D1 migration) merged; the week-plan review UI committed
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `e57aea85`, 2026-08-20

## Why this matters

The owner reviewed this feature as a running prototype and approved the design on 2026-08-20.
What was approved:

- A **This Week** strip on Home: seven columns, Monday first, each showing the exercise count and
  up to three muscle-group dots, today ringed in lime, an empty day showing a dim `–`.
- A **Day screen**: rows with exercise name, muscle-group tag, gym tag, and the `Sets/Reps` value
  editable inline; drag to reorder; swipe left to remove from the day.
- An **exercise picker** over the whole catalogue, grouped by muscle group, searchable, with
  already-added exercises greyed out.
- **Today's tick list** on the TODAY card, ticks derived from the workout log, gym named once in
  the header unless the day mixes gyms.
- `IN PLAN [MON]` on the exercise detail screen.

Three explicit product decisions from that review, which this plan must not re-litigate:

1. **Sets/Reps is shared with the catalogue, not per-day.** Editing it in a day plan writes the
   exercise's `sets_reps`, so the same number shows everywhere. There is deliberately no
   per-plan-row sets/reps column.
2. **One shared weekly plan across all gyms**, not one plan per gym. A day may mix gyms, which is
   why every row carries a gym tag.
3. **Three gyms: main, anu, home.** "Home" is a real third place with its own exercises.

What is missing is only persistence. Today the plan lives in `localStorage` under `gym.plan.v1`,
so it is per-device and dies with a cache clear, and the Home gym's exercises are a `HOME_DEMO`
fixture inside `store.tsx`. This plan makes all of it real.

It also removes `REVIEW_MODE`, which existed solely because local dev wrote to the owner's live
Google Sheet. After plan 210 local dev runs on local D1, so the scaffolding is not just
unnecessary — leaving it in means dev silently discards writes.

## Current state

### PRECONDITION — read this first

This plan builds on work that must already be committed:

1. **Plan 210** (`plans/210-gym-app-sheets-to-d1.md`, PR #169) must be merged: `env.DB` bound,
   `schema.sql` present, `src/worker/repo.ts` D1-backed, `test/repo.test.ts` existing with 12+
   cases.
2. **The approved week-plan UI** (PR #170) must be on `main`. These files must exist:
   - `apps/gym-app/src/client/plan.ts` — localStorage plan store (this plan replaces its guts)
   - `apps/gym-app/src/client/WeekStrip.tsx` — the This Week section
   - `apps/gym-app/src/client/DayPlan.tsx` — the day screen
   - `apps/gym-app/src/client/ExercisePicker.tsx` — the picker sheet
   - plus the `planday` view in `App.tsx`, the tick list in `Home.tsx`, the `.inplan` block in
     `ExerciseDetail.tsx`, and the `.week*` / `.plan-*` / `.tag*` rules in `index.css`.

If any is absent, **STOP and report** — do not rebuild the UI from this plan's description. The
approved implementation is the source of truth for look and behaviour; this plan only changes
where its data comes from.

### What `plan.ts` exports today (the seam)

Every component imports from here. **These signatures must not change** — that is what keeps the
approved UI untouched:

```ts
export type DayIdx = 0 | 1 | 2 | 3 | 4 | 5 | 6;   // Sunday-based, matches Date.getDay()
export const WEEK: DayIdx[]                        // [1,2,3,4,5,6,0] — display order, Monday first
export const DAY_SHORT: string[]                   // ["SUN","MON",…]
export const DAY_LONG: string[]
export type Plan = Record<string, string[]>        // day index -> ordered exercise ids
export const muscleOf: (ex: Exercise) => string
export const todayIdx: () => DayIdx
export const dayIds: (day: DayIdx) => string[]
export function addToDay(day: DayIdx, exerciseId: string): void
export function removeFromDay(day: DayIdx, exerciseId: string): void
export function setDayOrder(day: DayIdx, orderedIds: string[]): void
export function daysFor(exerciseId: string): DayIdx[]
export function seedOnce(all: Exercise[]): void    // DELETED by this plan
export function usePlan(): Plan
```

The three mutators are called fire-and-forget (`void`), from `DayPlan.tsx` and
`ExercisePicker.tsx`. Keeping them `void` and optimistic is required — the components do not
await them.

### The gym model today (to be replaced)

`src/client/gym.ts`:

```ts
export type Gym = "main" | "anu" | "home";
export const ANU_TAB = "Anu Gym";
export const HOME_TAB = "Home Gym";
/** Tabs that carry their own per-row Muscle Group column. */
export const MIXED_TABS: Record<string, Gym> = { [ANU_TAB]: "anu", [HOME_TAB]: "home" };
export const gymOfTab = (tab: string): Gym => MIXED_TABS[tab] ?? "main";
export const gymOfId = (id: string): Gym => { /* ANU* -> anu, HOME* -> home, else main */ };
```

So "which gym" is currently inferred twice, from a tab NAME and from an ID PREFIX. Both are
guesses. After this plan the server states it: `Exercise.gym` and `LogEntry.gym`.

`store.tsx` currently fabricates the Home gym because the sheet had no Home tab:

```ts
const HOME_DEMO: Array<[string, string, string, string]> = [
  ["HOME01", "Chest", "Push-up", "3 x 15"], /* …10 rows… */
];
function withHomeDemo(snapshot: Snapshot): Snapshot { /* injects a synthetic tab */ }
```

All of it is deleted by this plan.

### REVIEW_MODE (to be deleted)

In `src/client/store.tsx`: `export const REVIEW_MODE = import.meta.env.DEV;`, an
`OVERRIDE_KEY = "gym.review.overrides"` localStorage map applied inside `exercisesFor`, a
`saveOverride` helper, and `if (REVIEW_MODE) return;` guards before each `api.*` call. Plus the
`.review-banner` block rendered at the top of `Home.tsx` and its CSS.

### Conventions to match

- Worker: `src/worker/repo.ts` after plan 210 — one exported async function per operation,
  `env.DB.prepare(...).bind(...).run()/all()/first()`, snake_case columns mapped to camelCase
  domain types at the boundary.
- Client store: `src/client/store.tsx` — optimistic mutation, capture `before`, `setSnap`
  immediately, call `api.*`, on rejection `toast(message, true)` and restore `before`. Copy that
  shape exactly for the plan mutators.
- `src/client/api.ts` — one thin arrow per route on the `api` object.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `cd apps/gym-app && npm run typecheck` | exit 0 |
| Tests | `cd apps/gym-app && npm test` | exit 0, `Tests  1[8-9]\|[2-9][0-9] passed` |
| Build | `cd apps/gym-app && npm run build` | exit 0 |
| Migrate local D1 | `cd apps/gym-app && npm run db:local` | exit 0 |
| Migrate remote D1 | `cd apps/gym-app && npm run db:remote` | exit 0 |
| Dev server | `cd apps/gym-app && WEB_PORT=5473 npm run dev` | serves on 5473 |
| Screenshot | `cd apps/gym-app && node scripts/shoot.mjs http://localhost:5473 .shots/plan-day.png --wait=4500` | writes the png, prints `clean render` |

## Scope

**In scope**:
- `apps/gym-app/schema.sql` — `plan` table, `exercise.gym` column
- `apps/gym-app/src/worker/repo.ts` — plan CRUD + `gym` in the exercise mapping
- `apps/gym-app/src/worker/index.ts` — three `/api/plan` routes
- `apps/gym-app/src/shared.ts` — `PlanRow`, `Gym`, `Exercise.gym`, `Bootstrap.plan`
- `apps/gym-app/src/client/api.ts` — three plan calls
- `apps/gym-app/src/client/store.tsx` — plan state + mutators; DELETE `REVIEW_MODE` and `HOME_DEMO`
- `apps/gym-app/src/client/plan.ts` — same exports, API-backed
- `apps/gym-app/src/client/gym.ts` — `gym` from data, not from tab names
- `apps/gym-app/src/client/Home.tsx` — drop the review banner and the `seedOnce` call
- `apps/gym-app/src/client/index.css` — drop `.review-banner`
- `apps/gym-app/test/repo.test.ts` — 6 new cases
- `apps/gym-app/CLAUDE.md`, `apps/local-apps.md` — drop the review-mode and prototype notes

**Out of scope — do not touch**:
- **The visual design.** No layout, spacing, colour, copy, or component-structure change in
  `WeekStrip.tsx`, `DayPlan.tsx`, `ExercisePicker.tsx`, or the `.week*` / `.plan-*` / `.tag*` CSS.
  The owner reviewed and approved exactly what is there. The only edits allowed in those files are
  import-path or type changes forced by the new data source.
- Per-day sets/reps. Decision 1 above says the value is shared with the catalogue. Do not add a
  column, a field, or a per-row override.
- Per-gym plans. Decision 2. One plan, seven days, gym tags on rows.
- The workout log, history, session, and progression screens.
- `src/worker/mirror.ts` beyond adding the `plan` table to what it mirrors.

## Git workflow

- Branch: `advisor/211-gym-app-week-plan-backend`
- Commit per step: `feat(gym-app): <step>` — no AI footers. Do NOT push.

## Steps

### Step 1: Schema — the plan table and a real gym column

Append to `apps/gym-app/schema.sql`:

```sql
-- Which gym an exercise belongs to. Previously inferred from the tab NAME and
-- the ID prefix in two different client helpers; now stated by the data.
ALTER TABLE exercise ADD COLUMN gym TEXT NOT NULL DEFAULT 'main';

-- The week plan. One row per (day, exercise). `day` is Sunday-based to match
-- JS Date.getDay(); the UI displays Monday first.
-- No sets/reps column on purpose: the value is shared with the catalogue
-- (exercise.sets_reps), which is the behaviour the owner approved.
CREATE TABLE IF NOT EXISTS plan (
  day         INTEGER NOT NULL CHECK (day BETWEEN 0 AND 6),
  exercise_id TEXT NOT NULL REFERENCES exercise(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, exercise_id)
);
CREATE INDEX IF NOT EXISTS idx_plan_day_pos ON plan(day, position);
```

Then a one-off backfill (put it in `apps/gym-app/migrations/211-gym-column.sql` and run it
against local and remote):

```sql
UPDATE exercise SET gym = 'anu'  WHERE tab = 'Anu Gym';
UPDATE exercise SET gym = 'home' WHERE tab = 'Home Gym';
UPDATE exercise SET gym = 'main' WHERE tab NOT IN ('Anu Gym', 'Home Gym');
```

`ON DELETE CASCADE` is why a deleted exercise cannot leave an orphan plan row. D1 enforces
foreign keys, but confirm: the Step 6 test asserts it.

**Verify**: `npm run db:local` then
`npx wrangler d1 execute gym-db --local --command "SELECT gym, COUNT(*) FROM exercise GROUP BY gym"`
-> rows for `main`, and for `anu`/`home` if those tabs hold exercises. And
`npx wrangler d1 execute gym-db --local --command "PRAGMA foreign_keys"` -> `1`.

### Step 2: Shared types

In `src/shared.ts` add — and change nothing else:

```ts
/** Which physical place an exercise is done at. */
export type Gym = "main" | "anu" | "home";

/** One row of the week plan: this exercise, on this day, at this position. */
export interface PlanRow {
  day: number;        // 0-6, Sunday-based (matches Date.getDay())
  exerciseId: string;
  position: number;
}
```

Add `gym: Gym;` to `Exercise`, and `plan: PlanRow[];` to the bootstrap payload type.

**Verify**: `npm run typecheck` -> fails ONLY with "gym is missing" style errors in `repo.ts` and
the client (that is the compiler listing the sites Steps 3–5 fix). Record the list.

### Step 3: Worker — plan CRUD

In `src/worker/repo.ts`: add `gym` to `ExRow`, to `toExercise`, and to the INSERT in
`addExercise` (derive it from the tab for now: `MIXED_TABS.get(tab) ?? "main"`, where
`MIXED_TABS` becomes `new Map([["Anu Gym","anu"],["Home Gym","home"]])`). Include
`plan` in `bootstrap`'s batch:

```ts
env.DB.prepare("SELECT day, exercise_id, position FROM plan ORDER BY day, position"),
```

mapped to `PlanRow[]` as `{ day, exerciseId: exercise_id, position }`.

Then the three operations:

```ts
// ---- Week plan -------------------------------------------------------------

/** Append an exercise to a day. Idempotent: a day holds an exercise at most
 *  once, which is the constraint the UI assumes when it greys out a picker row. */
export async function addPlanRow(env: Env, day: number, exerciseId: string): Promise<PlanRow> {
  const next = await env.DB.prepare(
    "SELECT COALESCE(MAX(position) + 1, 0) AS pos FROM plan WHERE day = ?",
  )
    .bind(day)
    .first<{ pos: number }>();
  const position = next?.pos ?? 0;
  await env.DB.prepare(
    "INSERT INTO plan (day, exercise_id, position) VALUES (?, ?, ?)" +
      " ON CONFLICT (day, exercise_id) DO NOTHING",
  )
    .bind(day, exerciseId, position)
    .run();
  const row = await env.DB.prepare(
    "SELECT day, exercise_id, position FROM plan WHERE day = ? AND exercise_id = ?",
  )
    .bind(day, exerciseId)
    .first<{ day: number; exercise_id: string; position: number }>();
  if (!row) throw new Error(`plan row ${day}/${exerciseId} not found after insert`);
  return { day: row.day, exerciseId: row.exercise_id, position: row.position };
}

export async function deletePlanRow(env: Env, day: number, exerciseId: string): Promise<void> {
  await env.DB.prepare("DELETE FROM plan WHERE day = ? AND exercise_id = ?")
    .bind(day, exerciseId)
    .run();
  await reindexDay(env, day);
}

/** Reorder one day. Ids not mentioned keep their relative order at the end —
 *  same contract as reorderExercises. */
export async function reorderPlanDay(
  env: Env,
  day: number,
  orderedIds: string[],
): Promise<PlanRow[]> {
  const { results } = await env.DB.prepare(
    "SELECT exercise_id FROM plan WHERE day = ? ORDER BY position",
  )
    .bind(day)
    .all<{ exercise_id: string }>();
  const known = new Set(results.map((r) => r.exercise_id));
  const next = orderedIds.filter((id) => known.has(id));
  const seen = new Set(next);
  for (const r of results) if (!seen.has(r.exercise_id)) next.push(r.exercise_id);
  if (next.length > 0) {
    await env.DB.batch(
      next.map((id, i) =>
        env.DB.prepare("UPDATE plan SET position = ? WHERE day = ? AND exercise_id = ?").bind(
          i,
          day,
          id,
        ),
      ),
    );
  }
  return next.map((exerciseId, position) => ({ day, exerciseId, position }));
}

async function reindexDay(env: Env, day: number): Promise<void> {
  const { results } = await env.DB.prepare(
    "SELECT exercise_id FROM plan WHERE day = ? ORDER BY position",
  )
    .bind(day)
    .all<{ exercise_id: string }>();
  if (results.length === 0) return;
  await env.DB.batch(
    results.map((r, i) =>
      env.DB.prepare("UPDATE plan SET position = ? WHERE day = ? AND exercise_id = ?").bind(
        i,
        day,
        r.exercise_id,
      ),
    ),
  );
}
```

Routes in `src/worker/index.ts`, following the existing style:

```ts
// ---- Week plan -------------------------------------------------------------

app.post("/api/plan/:day", async (c) => {
  const day = Number(c.req.param("day"));
  if (!Number.isInteger(day) || day < 0 || day > 6) return c.json({ error: "bad day" }, 400);
  const { exerciseId } = await c.req.json<{ exerciseId: string }>();
  if (!exerciseId) return c.json({ error: "exerciseId required" }, 400);
  return c.json(await addPlanRow(c.env, day, exerciseId));
});

app.delete("/api/plan/:day/:exerciseId", async (c) => {
  const day = Number(c.req.param("day"));
  if (!Number.isInteger(day) || day < 0 || day > 6) return c.json({ error: "bad day" }, 400);
  await deletePlanRow(c.env, day, decodeURIComponent(c.req.param("exerciseId")));
  return c.json({ ok: true });
});

app.post("/api/plan/:day/reorder", async (c) => {
  const day = Number(c.req.param("day"));
  if (!Number.isInteger(day) || day < 0 || day > 6) return c.json({ error: "bad day" }, 400);
  const { orderedIds } = await c.req.json<{ orderedIds: string[] }>();
  return c.json(await reorderPlanDay(c.env, day, orderedIds));
});
```

Note the route-order hazard: register `/api/plan/:day/reorder` **before** any
`/api/plan/:day/:exerciseId` GET you might be tempted to add, or Hono will match the wrong one.
(LESSONS 2026-07-23: `c.req.param()` is also undefined inside `app.use("/api/*")` middleware —
do not move this parsing into middleware.)

**Verify**: `npm run typecheck` -> exit 0 for the worker. Then with `npx wrangler dev --port 8791`:

```bash
curl -s -X POST http://127.0.0.1:8791/api/plan/1 -H 'content-type: application/json' -d '{"exerciseId":"C01"}'
curl -s http://127.0.0.1:8791/api/bootstrap | grep -o '"plan":\[[^]]*\]' | head -c 200
curl -s -X POST http://127.0.0.1:8791/api/plan/1/reorder -H 'content-type: application/json' -d '{"orderedIds":["C01"]}'
curl -s -X DELETE http://127.0.0.1:8791/api/plan/1/C01
curl -s -X POST http://127.0.0.1:8791/api/plan/9 -H 'content-type: application/json' -d '{"exerciseId":"C01"}'
```

-> the POST returns `{"day":1,"exerciseId":"C01","position":0}`; bootstrap's `plan` array contains
it; the DELETE returns `{"ok":true}`; the `day=9` POST returns HTTP 400 `{"error":"bad day"}`.

### Step 4: Client store — plan state and optimistic mutators

In `src/client/api.ts` add:

```ts
  addPlanRow: (day: number, exerciseId: string) =>
    req<PlanRow>("POST", `/plan/${day}`, { exerciseId }),
  deletePlanRow: (day: number, exerciseId: string) =>
    req<{ ok: true }>("DELETE", `/plan/${day}/${E(exerciseId)}`),
  reorderPlanDay: (day: number, orderedIds: string[]) =>
    req<PlanRow[]>("POST", `/plan/${day}/reorder`, { orderedIds }),
```

and `plan: PlanRow[]` to `BootstrapData`.

In `src/client/store.tsx`:

1. Add `plan: PlanRow[]` to `Snapshot` and `EMPTY`, and carry it through `refresh()` from
   `data.plan`. **Bump `CACHE_KEY` to `"gym.cache.v4"`** — a v3 cache has no `plan` key and
   would hydrate `undefined`.
2. Expose on the context: `plan: PlanRow[]`, plus three mutators shaped exactly like the existing
   optimistic ones:

```ts
  const addToPlan = useCallback(
    (day: number, exerciseId: string) => {
      const before = snapRef.current.plan;
      if (before.some((r) => r.day === day && r.exerciseId === exerciseId)) return;
      const position = before.filter((r) => r.day === day).length;
      setSnap((s) => ({ ...s, plan: [...s.plan, { day, exerciseId, position }] }));
      api.addPlanRow(day, exerciseId).catch((e) => {
        toast(String((e as Error).message), true);
        setSnap((s) => ({ ...s, plan: before }));
      });
    },
    [toast],
  );
```

`removeFromPlan` and `reorderPlanDay` follow the same capture/optimistic/rollback shape.

3. **Delete** `REVIEW_MODE`, `OVERRIDE_KEY`, `loadOverrides`, `saveOverride`, `HOME_DEMO`,
   `withHomeDemo`, and every `if (REVIEW_MODE)` guard. `exercisesFor` becomes the one-liner it
   was: `snap.byTab[tab] ?? []`.

**Verify**: `grep -rn "REVIEW_MODE\|HOME_DEMO\|gym.review.overrides" src/` -> no matches.
`grep -n "gym.cache.v4" src/client/store.tsx` -> 1 match.

### Step 5: Rewrite plan.ts against the store

Replace the storage half of `src/client/plan.ts`, keeping every export. The module keeps its
`dayIds` / `daysFor` helpers but reads them from the store's plan array. Because `dayIds` and
`daysFor` are called from component bodies today as plain functions, they need the current plan —
route them through a module-level snapshot that the provider keeps fresh:

```ts
// The plan now lives in D1 and reaches components through the store. This
// module keeps its old surface so no component changed: `usePlan` subscribes,
// and the plain helpers read the latest snapshot the provider published.

let current: PlanRow[] = [];
let mutators: {
  add: (day: number, id: string) => void;
  remove: (day: number, id: string) => void;
  reorder: (day: number, ids: string[]) => void;
} | null = null;

/** Called once by GymProvider on every render with the live plan + mutators. */
export function publishPlan(rows: PlanRow[], m: NonNullable<typeof mutators>): void {
  current = rows;
  mutators = m;
}

export const dayIds = (day: DayIdx): string[] =>
  current
    .filter((r) => r.day === day)
    .sort((a, b) => a.position - b.position)
    .map((r) => r.exerciseId);

export function daysFor(exerciseId: string): DayIdx[] {
  return WEEK.filter((d) => current.some((r) => r.day === d && r.exerciseId === exerciseId));
}

export const addToDay = (day: DayIdx, exerciseId: string): void =>
  mutators?.add(day, exerciseId);
export const removeFromDay = (day: DayIdx, exerciseId: string): void =>
  mutators?.remove(day, exerciseId);
export const setDayOrder = (day: DayIdx, orderedIds: string[]): void =>
  mutators?.reorder(day, orderedIds);

/** Subscribe to plan changes. Backed by the store, so this is just a selector. */
export function usePlan(): Plan {
  const { plan } = useGym();
  const out: Plan = {};
  for (const d of WEEK) out[String(d)] = [];
  for (const r of [...plan].sort((a, b) => a.position - b.position)) {
    (out[String(r.day)] ??= []).push(r.exerciseId);
  }
  return out;
}
```

Delete `seedOnce`, the `KEY`/`SEEDED` constants, `read`, `write`, and the listener set. Remove the
`seedOnce` call and its `useEffect` from `Home.tsx`.

Call `publishPlan(snap.plan, { add: addToPlan, remove: removeFromPlan, reorder: reorderPlanDay })`
from inside `GymProvider`'s body, before the `return`.

`muscleOf` changes from a tab-name test to the data: `ex.gym === "main" ? ex.tab : ex.muscleGroup || "Other"`.

In `src/client/gym.ts`: `gymOfTab` and `gymOfId` are now guesses over data that states the truth.
Replace both call sites with `ex.gym` / a lookup by id, delete `MIXED_TABS`, and keep
`GYMS`, `gymLabel`, `gymBadge`, `tabOfGym`, `mixedMuscles` as they are. `LogEntry` has no `gym`,
so `Home.tsx`'s logged-extras row keeps using an id lookup through `exerciseById`.

**Verify**: `npm run typecheck` -> exit 0. `grep -rn "localStorage" src/client/plan.ts` -> no
matches. `grep -rn "seedOnce" src/` -> no matches.

### Step 6: Tests

Append 6 cases to `apps/gym-app/test/repo.test.ts` (same harness plan 210 built):

1. `addPlanRow` on an empty day returns `position: 0`; a second call for a different exercise
   returns `position: 1`.
2. `addPlanRow` twice with the SAME `(day, exerciseId)` leaves exactly one row and does not
   shift `position`. **Name this test exactly** `addPlanRow is idempotent for the same day and
   exercise` — boss's mutation gate greps the failure for `idempotent`. The mutation strips the
   `ON CONFLICT ... DO NOTHING` clause; if the suite still passes without it, this test asserts
   nothing.
3. `deletePlanRow` re-indexes the day so remaining positions are `0..n-2` with order preserved.
4. `reorderPlanDay` with a partial id list puts the unmentioned ids last in their previous
   relative order.
5. `bootstrap` returns `plan` sorted by `day` then `position`, and `exercise.gym` reflects the
   `gym` column.
6. Deleting an exercise via `deleteExercise` removes its plan rows (the `ON DELETE CASCADE`
   claim). Assert `SELECT COUNT(*) FROM plan WHERE exercise_id = ?` is 0 afterwards.

Case 6 is the orphan-row regression test — a plan row pointing at a deleted exercise renders as a
silently missing day entry, which is exactly the class of bug the UI cannot show you.

**Verify**: `npm test` -> exit 0, summary reports **18 or more** passing tests
(12 from plan 210 + 6 here), and `test -f test/repo.test.ts` succeeds.

### Step 7: Round-trip the UI and commit a screenshot

`ui: true` in this plan's frontmatter means boss REJECTS the branch unless an image is committed.

```bash
npm run db:local && npm run seed:local
WEB_PORT=5473 npm run dev            # leave running
```

Write a throwaway puppeteer driver (do not commit it) that:
1. opens `http://localhost:5473`, waits for the tiles,
2. opens Monday from the week strip, adds an exercise via the picker,
3. **reloads the page**, opens Monday again, and asserts the exercise is still listed,
4. screenshots the Day screen to `apps/gym-app/.shots/211-day-plan.png`.

Step 3 is the whole point: it is what localStorage could never survive across devices, and a
reload proves the row came back from D1.

Then confirm the banner is gone: `node scripts/shoot.mjs http://localhost:5473 .shots/211-home.png --wait=4500`
and check the image has no orange REVIEW MODE strip.

Commit both PNGs.

**Verify**: the driver prints the exercise name after the reload; `ls apps/gym-app/.shots/211-*.png`
-> 2 files; `git status --short apps/gym-app/.shots` -> both staged/committed.

### Step 8: Docs

- `apps/gym-app/CLAUDE.md`: delete the REVIEW MODE bullet and the "week plan is a REVIEW
  PROTOTYPE" bullet. Add one line: the plan lives in the `plan` table, `gym` is a column on
  `exercise`, and Sets/Reps is deliberately shared with the catalogue.
- `apps/local-apps.md`: replace the gym section's review-mode paragraph with
  `npm run db:local && npm run seed:local` then `npm run dev`.
- `decisions.md`: append one dated line recording the three product decisions (shared sets/reps,
  one plan across gyms, three gyms) so they are not re-litigated.

**Verify**: `grep -c "REVIEW PROTOTYPE\|REVIEW MODE" apps/gym-app/CLAUDE.md` -> `0`.
`grep -c "2026-08-20" decisions.md` -> at least 1.

## Test plan

- **Unit**: 6 new cases in `test/repo.test.ts` (Step 6), run by `npm test` — the merge gate.
- **Route contract**: the Step 3 curl sequence, including the `day=9` rejection.
- **Persistence**: the Step 7 add → reload → still-there round trip. This is the claim the whole
  plan exists to make.
- **No visual regression**: the two committed screenshots, compared by eye against the approved
  `.shots/v2-home.png` and `.shots/v2-day-mixed.png` already in the repo. Layout, colours and
  copy must match; only the review banner may be absent.
- **Scaffolding gone**: `grep -rn "REVIEW_MODE\|HOME_DEMO\|seedOnce\|gym.plan.v1" src/` empty.

## Done criteria

- [ ] `cd apps/gym-app && npm run typecheck` exits 0.
- [ ] `cd apps/gym-app && npm test` exits 0 with **18 or more** passing tests.
- [ ] `cd apps/gym-app && npm run build` exits 0.
- [ ] `grep -rn "REVIEW_MODE\|HOME_DEMO\|seedOnce\|gym.plan.v1\|gym.review.overrides" apps/gym-app/src` prints nothing.
- [ ] `grep -rn "localStorage" apps/gym-app/src/client/plan.ts` prints nothing.
- [ ] `POST /api/plan/9` returns HTTP 400.
- [ ] The Step 7 driver finds the added exercise **after a page reload**.
- [ ] `apps/gym-app/.shots/211-day-plan.png` and `211-home.png` are committed, and `211-home.png`
      shows no REVIEW MODE banner.
- [ ] `SELECT COUNT(*) FROM plan WHERE exercise_id NOT IN (SELECT id FROM exercise)` returns 0.
- [ ] `decisions.md` carries the dated line for the three product decisions.
- [ ] With the frontmatter mutation applied, `npm test` FAILS printing `idempotent`; reverted, it
      passes again.
- [ ] **Fresh-checkout gate** (this is the batch's last plan): in a clean tree of this branch
      (`git clean -xdf apps/gym-app`, then `npm install`), each of `npm run db:local`,
      `npm run seed:local`, `npm run typecheck`, `npm test` and `npm run build` exits 0. Crews
      verify in trees carrying their own build artifacts, so build-order gaps surface only here
      (LESSONS 2026-07-31).

## STOP conditions

- **A component in `WeekStrip.tsx` / `DayPlan.tsx` / `ExercisePicker.tsx` needs a prop or
  signature change** to work against the API. The `plan.ts` surface was designed as the seam
  precisely so they would not — if one does, the seam is wrong: stop and report rather than
  editing approved UI.
- **Any visual change** to the approved screens beyond removing the review banner.
- **A plan row survives deletion of its exercise.** That means foreign keys are off; stop rather
  than adding manual cleanup, and report the `PRAGMA foreign_keys` value.
- **A test assertion fails and the fix is to weaken it.** Fix the code or the fixture; weakening,
  swapping or deleting an assertion is a STOP.
- **Any temptation to add per-day sets/reps or per-gym plans.** Both were explicitly decided
  against on 2026-08-20. If something seems impossible without them, stop and report.
- **`npm test` passing while `test/repo.test.ts` is missing the 6 new cases.** Vitest exits 0 for
  absent tests (LESSONS 2026-08-17) — count them.

## Maintenance notes

- `plan.ts`'s module-level `current` snapshot is a pragmatic seam that let the approved UI stay
  untouched. It is only correct because `publishPlan` runs on every provider render. If a future
  change makes plan mutations happen outside React's render cycle, move the components to
  `useGym().plan` directly and delete the module state.
- `exercise.gym` is now the single source of gym truth. `gymOfId`'s ID-prefix guessing was
  deleted — do not reintroduce it for `LogEntry`; join through `exerciseById` instead.
- The `plan` table has no per-day sets/reps by design (decision 2026-08-20). Adding one is a
  product change, not a refactor.
- A reviewer should scrutinise: the `ON CONFLICT DO NOTHING` in `addPlanRow` (it makes the route
  idempotent, which the picker's greyed-out state assumes), the `CACHE_KEY` bump (a stale v3 cache
  hydrating `plan: undefined` crashes `usePlan`), and that no approved pixel moved.
