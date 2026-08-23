---
executor: agy
model:
test_cmd: cd apps/founders-tracker && npm install --no-audit --no-fund --silent && npm run typecheck && npm test
ui:
deploy:
needs: []
needs_prs: []
touches: [apps/founders-tracker/tsconfig.app.json, apps/founders-tracker/tsconfig.worker.json, apps/founders-tracker/src/habits.ts, apps/founders-tracker/src/shared.ts, apps/founders-tracker/src/worker/db.ts, apps/founders-tracker/src/worker/recurring.ts, apps/founders-tracker/src/worker/index.ts, apps/founders-tracker/src/worker/dates.ts, apps/founders-tracker/schema.sql, apps/founders-tracker/migrations/2026-08-23-habits.sql, apps/founders-tracker/test/habits.test.ts, apps/founders-tracker/README.md, apps/founders-tracker/CLAUDE.md]

mutation_apply: perl -0pi -e 's/if \(t\.cadence !== "monthly"\) continue;/\/\/ mutated/' apps/founders-tracker/src/worker/recurring.ts
mutation_command: cd apps/founders-tracker && npm install --no-audit --no-fund --silent && npm test
mutation_expect: HABIT_NEVER_GENERATES_TASKS
mutation_cwd:
mutation_timeout: 900
---

# Plan 236: founders-tracker — daily habits stop being tasks

## Summary

- **Problem statement**: `founders-tracker` stores a daily habit as a generated task. Two active daily templates ("Knowledge gain", "Video editing skill improvement") produced one task per day since 2026-07-21 and nobody ticks them, so Khushi's open list reached **73 items of which only 4 were real work**. A missed habit day is not a to-do; it is a broken streak.
- **Goals**:
  - Add a `habit_logs` table and make **daily + weekly** recurring templates *habits*: they log a tick per period and **never** insert a row into `tasks`.
  - Keep **monthly** templates behaving exactly as today (they still generate real tasks).
  - Ship pure, unit-tested streak maths (`current` + `best`) in one shared module used by both the worker and (later) the client.
  - Expose habits on `GET /api/bootstrap` plus a `POST /api/habits/:templateId/toggle` endpoint.
  - Migrate live data: fold already-done daily instances into `habit_logs`, delete every daily/weekly-generated task row.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — plan is fully inlined (schema, every snippet, exact commands), which is `tooling/boss/data/rules.md`'s default row.
- **Done criteria** (terse): `npm run typecheck && npm test` exit 0; `test/habits.test.ts` exists with ≥ 18 passing tests; the generator provably skips daily/weekly templates.
- **Stop conditions** (terse): a habit tick writes to `tasks`; a monthly template stops generating; an assertion is weakened to make a gate pass.
- **Test / verification for success**: Vitest unit tests over the pure habit module + a generator test proving daily/weekly templates insert zero task rows, backed by the mutation gate.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e2fa1815..HEAD -- apps/founders-tracker/`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (touches live data through a one-shot migration file; the migration itself is not run by the executor)
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `e2fa1815`, 2026-08-23

## Why this matters

The app's core mistake is one type doing two jobs. A **task** is a discrete piece of work with a deadline that should be tracked, scored, and cleared. A **habit** is a rhythm: you either kept it today or you did not, and yesterday's miss is history, not a backlog item. Modelling a habit as a task means every skipped day becomes a permanent, red, overdue card — so the list grows monotonically and the four items that matter get buried. The owner's words: *"Daily tasks keep on increasing and now it has become 72. This is a bad product."*

Fixing the data model is the whole fix. Once daily/weekly templates log ticks instead of minting tasks, the list cannot grow on its own again. The UI work (Plan 237) then has something honest to render.

Intent that should guide judgment calls: **habits never create work items, never appear in the task list, and never affect the on-time scoreboard.** If a detail in this plan is ambiguous, choose whatever preserves that sentence.

## Current state

### Files in play

| File | Role today |
|---|---|
| `apps/founders-tracker/schema.sql` | D1 schema: `tasks`, `recurring_templates`, two indexes |
| `apps/founders-tracker/src/shared.ts` | Types shared by the React client and the Worker (types only, no logic) |
| `apps/founders-tracker/src/worker/dates.ts` | `todayIST`, `nowIso`, `daysBetween` — date-only, Asia/Kolkata |
| `apps/founders-tracker/src/worker/recurring.ts` | `periodKey`, `isoWeek`, `resolveEta`, `runGenerator` — mints a task per active template per period |
| `apps/founders-tracker/src/worker/db.ts` | All D1 access: tasks, templates, `computeScoreboard` |
| `apps/founders-tracker/src/worker/index.ts` | Hono routes + the `scheduled` cron entry |
| `apps/founders-tracker/test/auth.test.ts` | The only existing test file — the style to imitate |

### The exact current schema (`apps/founders-tracker/schema.sql`)

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT NOT NULL,
  owner        TEXT NOT NULL,
  eta          TEXT,
  notes        TEXT,
  status       TEXT NOT NULL DEFAULT 'open',
  sort_order   INTEGER NOT NULL DEFAULT 0,
  template_id  INTEGER,
  period_key   TEXT,
  created_at   TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS recurring_templates (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  owner      TEXT NOT NULL,
  notes      TEXT,
  cadence    TEXT NOT NULL,
  due_day    INTEGER NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_tasks_template_period
  ON tasks(template_id, period_key) WHERE template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_tasks_owner_status ON tasks(owner, status);
```

### The generator as it stands (`src/worker/recurring.ts`, lines 51–81)

```ts
/** Insert any missing recurring instances for "today". Idempotent: the unique
 *  index on (template_id, period_key) makes a duplicate insert a no-op. */
export async function runGenerator(db: D1Database): Promise<number> {
  const today = todayIST();
  const templates = (await listTemplates(db)).filter((t) => t.active);
  let inserted = 0;
  for (const t of templates) {
    const pk = periodKey(t.cadence, today);
    const exists = await db
      .prepare("SELECT 1 FROM tasks WHERE template_id = ? AND period_key = ? LIMIT 1")
      .bind(t.id, pk)
      .first();
    if (exists) continue;
    const eta = resolveEta(t, today);
    const sort = etaSortKey(eta);
    try {
      await db
        .prepare(
          `INSERT INTO tasks (title, owner, eta, notes, status, sort_order, template_id, period_key, created_at)
           VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?)`,
        )
        .bind(t.title, t.owner, eta, t.notes ?? null, sort, t.id, pk, nowIso())
        .run();
      inserted += 1;
    } catch (err) {
      // Unique-index collision under a race is expected and fine; log others.
      console.error(`generator insert failed for template ${t.id}:`, err);
    }
  }
  return inserted;
}
```

`periodKey` and `isoWeek` also live in that file (lines 10–28). **They move to the new shared module in Step 1** — this plan's single source of truth for period arithmetic, because both the streak maths and the migration depend on agreeing about what a period is.

### Live production state (verified 2026-08-23 against the remote D1 `founders-db`)

```
recurring_templates:
  id 1  monthly  due_day 1   active  khushi  "Renenue and Cost Sheet"
  id 2  daily    due_day 1   active  khushi  "Knowledge gain"
  id 3  daily    due_day 1   active  khushi  "Video editing skill improvement"

tasks (after the owner-approved cleanup that already removed 66 stale open daily rows):
  khushi open   manual     4
  khushi open   recurring  3   (today's 2 daily + 1 monthly)
  khushi done   recurring  11
  kushal open   manual     4
  kushal done   manual     3
```

There are **no weekly templates**, so no weekly rows exist to migrate. The migration must still handle weekly correctly in code — a weekly habit can be created from the UI any time.

`period_key` for a daily instance is the plain `'YYYY-MM-DD'`; for weekly it is `'YYYY-Www'`; for monthly `'YYYY-MM'`.

### Conventions to follow

- **TypeScript style**: 2-space indent, double quotes, semicolons, named exports, `export function` over arrow consts. Comments explain *why*, sparingly. Match `src/worker/db.ts`.
- **Test style**: Vitest with `describe`/`it`/`expect`, imported explicitly — match `test/auth.test.ts` exactly:
  ```ts
  import { describe, it, expect } from 'vitest'
  import { signSession, verifySession } from '../src/worker/auth'
  ```
  Note: the test file uses **single quotes and no semicolons**. Keep that inside `test/`, and double-quotes-with-semicolons inside `src/`. Do not reformat existing files.
- **Dates**: never compare raw timestamps. Everything reduces to a `'YYYY-MM-DD'` string first, anchored at `T12:00:00Z` to dodge DST. See the header comment of `src/worker/dates.ts`.
- **D1 access**: only inside `src/worker/db.ts` (plus `runGenerator` in `recurring.ts`, which already does its own inserts). Pure logic goes in the new `src/habits.ts` and takes plain values — never a `D1Database`.
- **Exemplar file for new worker code**: `src/worker/db.ts`.
- **`tsc -b` uses three project references and each one lists its files explicitly.**
  `tsconfig.app.json` includes `["src/client", "src/shared.ts"]`; `tsconfig.worker.json`
  includes `["src/worker", "src/shared.ts"]`. A new file at `src/habits.ts` is in
  **neither**, so `npm run typecheck` fails with *"File 'src/habits.ts' is not listed
  within the file list of project"* until both `include` arrays name it. Step 1 does this.
- **`noUnusedLocals` and `noUnusedParameters` are on.** An import you stop using is a
  hard typecheck failure, not a warning. When you delete `periodKey` from
  `recurring.ts`, delete every import that goes with it.
- **`test/` is in no tsconfig**, so `npm run typecheck` never inspects test files.
  Type mistakes there surface only when `npm test` runs them. Do not add `test/` to a
  tsconfig — that is out of scope.

### Design decisions already made — do not re-litigate

1. **Cadence is the discriminator.** `daily` and `weekly` are habits. `monthly` is a task template. No new column on `recurring_templates`.
2. **`habit_logs` is keyed by `anchor_ymd`, not by a period-key string.** `anchor_ymd` is the first day of the period (`daily` → the day itself; `weekly` → the Monday of that ISO week). This makes every streak computation plain day arithmetic and removes the need to parse `'2026-W35'` back into a date.
3. **Habits are excluded from the scoreboard.** The migration deletes their historic done rows, so `computeScoreboard` needs no change. Habits earn streaks; tasks earn on-time percentage.
4. **`toggle` is idempotent per period.** Ticking twice in one day un-ticks (delete the row). No `status` column on `habit_logs`.
5. **The migration is a one-shot file, not part of `schema.sql`.** The executor writes it; it does **not** run it against remote D1.

## Commands you will need

All commands run from `apps/founders-tracker` unless stated otherwise.

| Purpose | Command | Expected |
|---|---|---|
| Install deps | `npm install` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0, no output |
| Unit tests | `npm test` | exit 0, `Tests  <N> passed` with N ≥ 22 |
| Build (asset + worker bundle) | `npm run build` | exit 0 |
| Apply schema to LOCAL D1 | `npm run db:local` | exit 0 |
| Merge gate (from repo root) | `cd apps/founders-tracker && npm run typecheck && npm test` | exit 0 |
| Drift check (from repo root) | `git diff --stat e2fa1815..HEAD -- apps/founders-tracker/` | empty or only your own commits |

**Do NOT run** `npm run db:remote`, `npm run deploy`, or any `wrangler ... --remote` command. Those touch production and are the owner's to run.

**Do NOT change** the versions of `wrangler` or `@cloudflare/vite-plugin` in `package.json`. They are an exact-pinned matched pair (`decisions.md` 2026-07-16); bumping either alone breaks the deploy.

## Scope

**In scope** (the only files you may create or edit):

- `apps/founders-tracker/schema.sql`
- `apps/founders-tracker/migrations/2026-08-23-habits.sql` (new)
- `apps/founders-tracker/src/habits.ts` (new)
- `apps/founders-tracker/tsconfig.app.json` (the `include` array only)
- `apps/founders-tracker/tsconfig.worker.json` (the `include` array only)
- `apps/founders-tracker/src/shared.ts`
- `apps/founders-tracker/src/worker/dates.ts`
- `apps/founders-tracker/src/worker/recurring.ts`
- `apps/founders-tracker/src/worker/db.ts`
- `apps/founders-tracker/src/worker/index.ts`
- `apps/founders-tracker/test/habits.test.ts` (new)
- `apps/founders-tracker/README.md`
- `apps/founders-tracker/CLAUDE.md`
- `plans/README.md` (your status row only)
- `plans/236-founders-habits-out-of-tasks.md` (`git add` this plan file itself)

**Out of scope — looks related, do not touch**:

- Every file under `apps/founders-tracker/src/client/` — the UI is **Plan 237**. Adding a `habits` field to the bootstrap payload is additive; the current client ignores unknown fields and keeps working. Changing a `.tsx` file here creates a merge collision with 237.
- `src/worker/auth.ts` and `test/auth.test.ts` — unrelated, and the auth token shape is explicitly frozen (`CLAUDE.md`: "do NOT rewrite/extend this unless explicitly asked").
- `computeScoreboard` in `db.ts` — decision 3 above makes a change unnecessary. Leave the function byte-identical.
- `package.json` dependency versions — see the pinning note above.
- Any other app under `apps/`.

## Git workflow

- Branch: `advisor/236-founders-habits-out-of-tasks`
- Commit per step (rollback granularity). Messages: `feat(founders-tracker): <what>` — no AI footers.
- Do **NOT** push.

## Steps

### Step 1: Extract period arithmetic into a shared pure module

Create `apps/founders-tracker/src/habits.ts` with **exactly** this content:

```ts
// Pure habit + period arithmetic, shared by the Worker and the React client.
// No D1, no fetch, no Date.now() beyond an injected 'today' — everything here
// is a function of plain 'YYYY-MM-DD' strings so it is trivially testable.

import type { Cadence } from "./shared";

/** Cadences that are habits (tick a streak) rather than task generators. */
export const HABIT_CADENCES = ["daily", "weekly"] as const;
export type HabitCadence = (typeof HABIT_CADENCES)[number];

export function isHabitCadence(c: Cadence): c is HabitCadence {
  return c === "daily" || c === "weekly";
}

function parseYmd(ymd: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split("-").map(Number);
  return { y, m, d };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** `ymd` shifted by `n` days (negative = backwards). Anchored at UTC noon so a
 *  DST-style hour shift can never bump the calendar day. */
export function addDaysYmd(ymd: string, n: number): string {
  const t = new Date(`${ymd}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/** Integer days from `fromYmd` to `toYmd`. Negative = `toYmd` is earlier. */
export function daysBetweenYmd(fromYmd: string, toYmd: string): number {
  const a = Date.parse(`${fromYmd}T12:00:00Z`);
  const b = Date.parse(`${toYmd}T12:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** ISO week number + ISO week-year for a 'YYYY-MM-DD'. */
export function isoWeek(ymd: string): { year: number; week: number } {
  const { y, m, d } = parseYmd(ymd);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = (date.getUTCDay() + 6) % 7; // 0=Mon … 6=Sun
  date.setUTCDate(date.getUTCDate() - day + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const fday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fday + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return { year: date.getUTCFullYear(), week };
}

/** Stable key for the period containing `ymd`. Used by the task generator and
 *  by the unique index on tasks(template_id, period_key). */
export function periodKey(cadence: Cadence, ymd: string): string {
  if (cadence === "daily") return ymd; // YYYY-MM-DD — one instance per day
  if (cadence === "monthly") return ymd.slice(0, 7); // YYYY-MM
  const { year, week } = isoWeek(ymd);
  return `${year}-W${pad2(week)}`;
}

/** First day of the habit period containing `ymd`. This — not the period key —
 *  is what `habit_logs.anchor_ymd` stores, so all streak maths is day
 *  arithmetic: daily periods step by 1 day, weekly ones by 7. */
export function periodStart(cadence: HabitCadence, ymd: string): string {
  if (cadence === "daily") return ymd;
  const dow = (new Date(`${ymd}T12:00:00Z`).getUTCDay() + 6) % 7; // 0=Mon … 6=Sun
  return addDaysYmd(ymd, -dow);
}

/** Days between consecutive periods of this cadence. */
export function periodStep(cadence: HabitCadence): number {
  return cadence === "weekly" ? 7 : 1;
}

/** Consecutive kept periods ending at or just before `todayYmd`.
 *
 *  Grace rule: the CURRENT period being unticked does not break the streak —
 *  the day (or week) is not over yet — so counting starts from the previous
 *  period in that case. The streak breaks the moment a completed period in the
 *  chain is missing. Returns 0 for an empty history. */
export function currentStreak(
  cadence: HabitCadence, anchors: ReadonlySet<string>, todayYmd: string,
): number {
  const step = periodStep(cadence);
  let cursor = periodStart(cadence, todayYmd);
  if (!anchors.has(cursor)) cursor = addDaysYmd(cursor, -step);
  let n = 0;
  while (anchors.has(cursor)) {
    n += 1;
    cursor = addDaysYmd(cursor, -step);
  }
  return n;
}

/** Longest run of consecutive kept periods anywhere in the history. */
export function bestStreak(cadence: HabitCadence, anchors: ReadonlySet<string>): number {
  const step = periodStep(cadence);
  const sorted = [...anchors].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const a of sorted) {
    run = prev !== null && addDaysYmd(prev, step) === a ? run + 1 : 1;
    if (run > best) best = run;
    prev = a;
  }
  return best;
}
```

Then delete `parseYmd`, `isoWeek` and `periodKey` from `src/worker/recurring.ts` and import them instead. The top of `recurring.ts` becomes:

```ts
import type { Template } from "../shared";
import { periodKey } from "../habits";
import { etaSortKey, listTemplates } from "./db";
import { nowIso, todayIST } from "./dates";

function parseYmd(ymd: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split("-").map(Number);
  return { y, m, d };
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1-based here
}

function pad2(n: number): string { return String(n).padStart(2, "0"); }
```

`resolveEta` keeps using its local `parseYmd`/`pad2`/`daysInMonth` and is otherwise unchanged. `periodKey` must no longer be exported from `recurring.ts` — `src/habits.ts` is now its only home.

Finally, add `src/habits.ts` to both project file lists so `tsc -b` can see it:

- `apps/founders-tracker/tsconfig.app.json` → `"include": ["src/client", "src/shared.ts", "src/habits.ts"]`
- `apps/founders-tracker/tsconfig.worker.json` → `"include": ["src/worker", "src/shared.ts", "src/habits.ts"]`

Change nothing else in either file.

**Verify**: `npm run typecheck` → exit 0.
**Verify**: `grep -c "src/habits.ts" tsconfig.app.json tsconfig.worker.json` → `1` for each.
**Verify**: `grep -c "export function periodKey" src/worker/recurring.ts` → `0`.

### Step 2: Add `habit_logs` to the schema

Append to `apps/founders-tracker/schema.sql`:

```sql
-- One row per kept habit period. `anchor_ymd` is the FIRST day of the period
-- (daily: the day; weekly: that ISO week's Monday), which makes streak maths
-- plain day arithmetic. Absence of a row means the period was not kept.
CREATE TABLE IF NOT EXISTS habit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL,
  anchor_ymd  TEXT NOT NULL,
  done_at     TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_habit_logs_template_anchor
  ON habit_logs(template_id, anchor_ymd);
CREATE INDEX IF NOT EXISTS ix_habit_logs_template ON habit_logs(template_id);
```

**Verify**: `npm run db:local` → exit 0.
**Verify**: `npx wrangler d1 execute founders-db --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name='habit_logs'"` → one row named `habit_logs`.

### Step 3: Add the shared habit types

In `apps/founders-tracker/src/shared.ts`, append (keep the existing content untouched):

```ts
/** One habit as the client renders it for the current period. */
export interface HabitToday {
  templateId: number;
  title: string;
  owner: Owner;
  cadence: "daily" | "weekly";
  /** First day of the current period ('YYYY-MM-DD', IST). */
  anchorYmd: string;
  /** True when the current period has been ticked. */
  keptNow: boolean;
  /** Consecutive kept periods (grace: an unticked current period does not break it). */
  streak: number;
  /** Longest streak ever recorded for this habit. */
  best: number;
  /** Total kept periods, all time. */
  total: number;
}
```

**Verify**: `npm run typecheck` → exit 0.

### Step 4: The generator skips habits

In `src/worker/recurring.ts`, inside `runGenerator`'s `for` loop, make the **first statement in the body**:

```ts
  for (const t of templates) {
    // HABIT_NEVER_GENERATES_TASKS — daily and weekly templates are habits: they
    // are ticked in habit_logs and must never mint a row in `tasks`. Only
    // monthly templates generate real, deadline-bearing work items.
    if (t.cadence !== "monthly") continue;
    const pk = periodKey(t.cadence, today);
```

Nothing else in the function changes.

**Verify**: `npm run typecheck` → exit 0.
**Verify**: `grep -c 'if (t.cadence !== "monthly") continue;' src/worker/recurring.ts` → `1`.

### Step 5: Habit data access in `db.ts`

Append to `apps/founders-tracker/src/worker/db.ts` (and extend the existing type import at the top of the file to include `HabitToday`, plus add `import { currentStreak, bestStreak, isHabitCadence, periodStart } from "../habits";`):

```ts
/** Every anchor day this habit was kept, newest-first order irrelevant. */
async function habitAnchors(db: D1Database, templateId: number): Promise<Set<string>> {
  const { results } = await db
    .prepare("SELECT anchor_ymd FROM habit_logs WHERE template_id = ?")
    .bind(templateId)
    .all();
  return new Set((results as Row[]).map((r) => String(r.anchor_ymd)));
}

/** Build the habit strip for the current period: every ACTIVE daily/weekly
 *  template, with its tick state and streaks. Paused habits are omitted —
 *  a paused rhythm is not something to nag about today. */
export async function listHabitsToday(db: D1Database, today = todayIST()): Promise<HabitToday[]> {
  const templates = (await listTemplates(db)).filter((t) => t.active && isHabitCadence(t.cadence));
  const out: HabitToday[] = [];
  for (const t of templates) {
    const cadence = t.cadence as "daily" | "weekly";
    const anchors = await habitAnchors(db, t.id);
    const anchorYmd = periodStart(cadence, today);
    out.push({
      templateId: t.id,
      title: t.title,
      owner: t.owner,
      cadence,
      anchorYmd,
      keptNow: anchors.has(anchorYmd),
      streak: currentStreak(cadence, anchors, today),
      best: bestStreak(cadence, anchors),
      total: anchors.size,
    });
  }
  return out;
}

/** Tick or un-tick the current period for one habit. Idempotent per period:
 *  calling it twice returns to the un-ticked state. Throws when the template
 *  is missing or is not a habit. */
export async function toggleHabit(
  db: D1Database, templateId: number, today = todayIST(),
): Promise<HabitToday> {
  const template = await getTemplate(db, templateId);
  if (!isHabitCadence(template.cadence)) {
    throw new Error(`template ${templateId} is ${template.cadence}, not a habit`);
  }
  const anchorYmd = periodStart(template.cadence, today);
  const existing = await db
    .prepare("SELECT id FROM habit_logs WHERE template_id = ? AND anchor_ymd = ?")
    .bind(templateId, anchorYmd)
    .first();
  if (existing) {
    await db
      .prepare("DELETE FROM habit_logs WHERE template_id = ? AND anchor_ymd = ?")
      .bind(templateId, anchorYmd)
      .run();
  } else {
    await db
      .prepare("INSERT OR IGNORE INTO habit_logs (template_id, anchor_ymd, done_at) VALUES (?, ?, ?)")
      .bind(templateId, anchorYmd, nowIso())
      .run();
  }
  const all = await listHabitsToday(db, today);
  const found = all.find((h) => h.templateId === templateId);
  if (!found) throw new Error(`habit ${templateId} vanished after toggle`);
  return found;
}
```

`getTemplate` is currently a module-private `async function` in `db.ts` — it stays private; `toggleHabit` lives in the same file so it can call it.

**Verify**: `npm run typecheck` → exit 0.

### Step 6: Wire the routes

In `src/worker/index.ts`:

1. Extend the `db` import to include `listHabitsToday` and `toggleHabit`.
2. Change the bootstrap handler to:

```ts
app.get("/api/bootstrap", async (c) => {
  // Backstop: also materialize recurring tasks on load.
  await runGenerator(c.env.DB).catch((e) => console.error("on-load generator:", e));
  const [tasks, templates, habits, scoreboard] = await Promise.all([
    listTasks(c.env.DB), listTemplates(c.env.DB), listHabitsToday(c.env.DB),
    computeScoreboard(c.env.DB),
  ]);
  return c.json({ tasks, templates, habits, scoreboard });
});
```

3. Add, immediately after the templates route block:

```ts
// ---- Habits ----------------------------------------------------------------
app.get("/api/habits", async (c) => c.json(await listHabitsToday(c.env.DB)));

app.post("/api/habits/:templateId/toggle", async (c) => {
  const id = Number(c.req.param("templateId"));
  if (!Number.isFinite(id)) return c.json({ error: "bad template id" }, 400);
  return c.json(await toggleHabit(c.env.DB, id));
});
```

**Verify**: `npm run typecheck` → exit 0.
**Verify**: `npm run build` → exit 0.

### Step 7: The one-shot data migration file

Create `apps/founders-tracker/migrations/2026-08-23-habits.sql`:

```sql
-- One-shot migration for Plan 236: habits stop being tasks.
--
-- Run ONCE per environment, AFTER `npm run db:local` / `npm run db:remote` has
-- created habit_logs:
--   npx wrangler d1 execute founders-db --local  --file=migrations/2026-08-23-habits.sql
--   npx wrangler d1 execute founders-db --remote --file=migrations/2026-08-23-habits.sql
--
-- Every statement is idempotent, so a second run is a no-op.
--
-- Step A: preserve history. A DONE daily instance means that day was kept, so
-- it becomes a habit_logs row. `period_key` for a daily template IS the day,
-- which is also the anchor. Weekly period keys ('2026-W35') cannot be turned
-- back into a Monday in SQL, and no weekly template exists yet (verified
-- 2026-08-23), so weekly done rows are intentionally NOT converted.
INSERT OR IGNORE INTO habit_logs (template_id, anchor_ymd, done_at)
SELECT t.template_id,
       t.period_key,
       COALESCE(t.completed_at, t.created_at)
FROM tasks t
JOIN recurring_templates r ON r.id = t.template_id
WHERE r.cadence = 'daily'
  AND t.status = 'done'
  AND t.period_key IS NOT NULL;

-- Step B: habits leave the task table entirely — open instances (noise) and
-- done ones (now streak history) alike. This also removes them from the
-- on-time scoreboard, which is correct: habits earn streaks, tasks earn
-- on-time percentage.
DELETE FROM tasks
WHERE template_id IN (SELECT id FROM recurring_templates WHERE cadence IN ('daily', 'weekly'));
```

**Do not execute this against `--remote`.** Apply it locally only, as the verify below does.

**Verify**:
```bash
npm run db:local
npx wrangler d1 execute founders-db --local --file=migrations/2026-08-23-habits.sql
```
→ both exit 0.

### Step 8: Tests

Create `apps/founders-tracker/test/habits.test.ts`. Single quotes, no semicolons — match `test/auth.test.ts`.

```ts
import { describe, it, expect } from 'vitest'
import {
  addDaysYmd, bestStreak, currentStreak, daysBetweenYmd, isHabitCadence,
  isoWeek, periodKey, periodStart, periodStep,
} from '../src/habits'
import { resolveEta } from '../src/worker/recurring'
import type { Template } from '../src/shared'

const tpl = (over: Partial<Template>): Template => ({
  id: 1, title: 'h', owner: 'khushi', notes: null, cadence: 'daily',
  dueDay: 1, active: true, createdAt: '2026-01-01T00:00:00.000Z', ...over,
})

describe('day arithmetic', () => {
  it('steps forward and backward across a month boundary', () => {
    expect(addDaysYmd('2026-08-31', 1)).toBe('2026-09-01')
    expect(addDaysYmd('2026-09-01', -1)).toBe('2026-08-31')
  })

  it('steps across a year boundary', () => {
    expect(addDaysYmd('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('measures signed distance between days', () => {
    expect(daysBetweenYmd('2026-08-23', '2026-08-25')).toBe(2)
    expect(daysBetweenYmd('2026-08-23', '2026-08-20')).toBe(-3)
    expect(daysBetweenYmd('2026-08-23', '2026-08-23')).toBe(0)
  })
})

describe('period keys', () => {
  it('keys a daily period by the day itself', () => {
    expect(periodKey('daily', '2026-08-23')).toBe('2026-08-23')
  })

  it('keys a monthly period by the month', () => {
    expect(periodKey('monthly', '2026-08-23')).toBe('2026-08')
  })

  it('keys a weekly period by the ISO week', () => {
    // 2026-08-23 is a Sunday; its ISO week is 2026-W34.
    expect(periodKey('weekly', '2026-08-23')).toBe('2026-W34')
    expect(periodKey('weekly', '2026-08-24')).toBe('2026-W35')
  })

  it('computes ISO weeks at a year boundary', () => {
    expect(isoWeek('2027-01-01').week).toBe(53)
  })
})

describe('period anchors', () => {
  it('anchors a daily period to the day', () => {
    expect(periodStart('daily', '2026-08-23')).toBe('2026-08-23')
  })

  it('anchors a weekly period to that ISO week Monday', () => {
    expect(periodStart('weekly', '2026-08-23')).toBe('2026-08-17') // Sunday -> prior Monday
    expect(periodStart('weekly', '2026-08-24')).toBe('2026-08-24') // Monday -> itself
  })

  it('steps 1 day for daily and 7 for weekly', () => {
    expect(periodStep('daily')).toBe(1)
    expect(periodStep('weekly')).toBe(7)
  })

  it('classifies which cadences are habits', () => {
    expect(isHabitCadence('daily')).toBe(true)
    expect(isHabitCadence('weekly')).toBe(true)
    expect(isHabitCadence('monthly')).toBe(false)
  })
})

describe('currentStreak', () => {
  it('is 0 with no history', () => {
    expect(currentStreak('daily', new Set(), '2026-08-23')).toBe(0)
  })

  it('counts today plus the unbroken run behind it', () => {
    const kept = new Set(['2026-08-21', '2026-08-22', '2026-08-23'])
    expect(currentStreak('daily', kept, '2026-08-23')).toBe(3)
  })

  it('survives an unticked today (grace: the day is not over)', () => {
    const kept = new Set(['2026-08-21', '2026-08-22'])
    expect(currentStreak('daily', kept, '2026-08-23')).toBe(2)
  })

  it('breaks when yesterday and today are both missing', () => {
    const kept = new Set(['2026-08-20', '2026-08-21'])
    expect(currentStreak('daily', kept, '2026-08-23')).toBe(0)
  })

  it('ignores an older run separated by a gap', () => {
    const kept = new Set(['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-23'])
    expect(currentStreak('daily', kept, '2026-08-23')).toBe(1)
  })

  it('counts weekly streaks in 7-day steps', () => {
    const kept = new Set(['2026-08-10', '2026-08-17'])
    expect(currentStreak('weekly', kept, '2026-08-23')).toBe(2)
  })
})

describe('bestStreak', () => {
  it('is 0 with no history', () => {
    expect(bestStreak('daily', new Set())).toBe(0)
  })

  it('finds the longest run, not the latest one', () => {
    const kept = new Set([
      '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04',
      '2026-08-22', '2026-08-23',
    ])
    expect(bestStreak('daily', kept)).toBe(4)
  })

  it('handles a single kept period', () => {
    expect(bestStreak('daily', new Set(['2026-08-23']))).toBe(1)
  })

  it('spans a month boundary', () => {
    const kept = new Set(['2026-07-30', '2026-07-31', '2026-08-01'])
    expect(bestStreak('daily', kept)).toBe(3)
  })
})

describe('the generator only serves monthly templates', () => {
  // HABIT_NEVER_GENERATES_TASKS — a habit cadence must produce zero task rows.
  // Fake D1: records every INSERT it is asked to run.
  function fakeDb(templates: Template[]) {
    const inserts: string[] = []
    const db = {
      prepare(sql: string) {
        const stmt = {
          _sql: sql,
          _args: [] as unknown[],
          bind(...args: unknown[]) { stmt._args = args; return stmt },
          async first() {
            if (sql.includes('FROM recurring_templates')) return null
            return null // no existing instance for any period
          },
          async all() {
            if (sql.includes('FROM recurring_templates')) {
              return {
                results: templates.map((t) => ({
                  id: t.id, title: t.title, owner: t.owner, notes: t.notes,
                  cadence: t.cadence, due_day: t.dueDay, active: t.active ? 1 : 0,
                  created_at: t.createdAt,
                })),
              }
            }
            return { results: [] }
          },
          async run() {
            if (sql.trim().toUpperCase().startsWith('INSERT')) inserts.push(String(stmt._args[0]))
            return { meta: { last_row_id: 1 } }
          },
        }
        return stmt
      },
    }
    return { db, inserts }
  }

  it('inserts nothing for a daily template', async () => {
    const { runGenerator } = await import('../src/worker/recurring')
    const { db, inserts } = fakeDb([tpl({ id: 2, cadence: 'daily', title: 'Knowledge gain' })])
    const n = await runGenerator(db as never)
    expect(inserts, 'HABIT_NEVER_GENERATES_TASKS: a daily habit must not mint a task').toEqual([])
    expect(n).toBe(0)
  })

  it('inserts nothing for a weekly template', async () => {
    const { runGenerator } = await import('../src/worker/recurring')
    const { db, inserts } = fakeDb([tpl({ id: 4, cadence: 'weekly', dueDay: 4, title: 'Weekly review' })])
    const n = await runGenerator(db as never)
    expect(inserts, 'HABIT_NEVER_GENERATES_TASKS: a weekly habit must not mint a task').toEqual([])
    expect(n).toBe(0)
  })

  it('still inserts exactly one task for a monthly template', async () => {
    const { runGenerator } = await import('../src/worker/recurring')
    const { db, inserts } = fakeDb([tpl({ id: 1, cadence: 'monthly', dueDay: 1, title: 'Revenue sheet' })])
    const n = await runGenerator(db as never)
    expect(inserts).toEqual(['Revenue sheet'])
    expect(n).toBe(1)
  })

  it('resolves a monthly eta clamped to the month length', () => {
    expect(resolveEta(tpl({ cadence: 'monthly', dueDay: 31 }), '2026-02-10')).toBe('2026-02-28')
    expect(resolveEta(tpl({ cadence: 'monthly', dueDay: 1 }), '2026-08-23')).toBe('2026-08-01')
  })
})
```

**Verify**: `npm test` → exit 0 and the summary line reports **at least 22 passing tests** across 2 files.
**Verify**: `test -f test/habits.test.ts && echo present` → `present`.

### Step 9: Prove the mutation gate fires

From the repo root, run the mutation recipe by hand exactly as boss will:

```bash
cd apps/founders-tracker && npm test                       # must PASS
cd /Users/kbtg/codebase/personal-stuff
perl -0pi -e 's/if \(t\.cadence !== "monthly"\) continue;/\/\/ mutated/' apps/founders-tracker/src/worker/recurring.ts
cd apps/founders-tracker && npm test                       # must FAIL, printing HABIT_NEVER_GENERATES_TASKS
cd /Users/kbtg/codebase/personal-stuff && git checkout -- apps/founders-tracker/src/worker/recurring.ts
cd apps/founders-tracker && npm test                       # must PASS again
```

**Verify**: the middle run exits non-zero and its output contains the string `HABIT_NEVER_GENERATES_TASKS`.
**Verify**: `git diff --stat -- apps/founders-tracker/src/worker/recurring.ts` after the revert → empty (relative to your own last commit).

If the mutated run **passes**, the gate is inert: STOP and report. Do not proceed and do not "fix" it by loosening the test.

### Step 10: Docs

In `apps/founders-tracker/README.md`, replace the `## Data` section with:

```markdown
## Data

- `tasks` — real, deadline-bearing action items (manual + generated by **monthly**
  templates only).
- `recurring_templates` — repeat definitions, CRUD'd from the Repeats screen.
  **Cadence decides what a template is**: `daily`/`weekly` are *habits* (ticked,
  streaked, never generate a task); `monthly` is a *task template* (generates a
  real task per month, deduped by the unique index on `(template_id, period_key)`,
  which is what makes the generator idempotent).
- `habit_logs` — one row per kept habit period. `anchor_ymd` is the first day of
  the period (daily: the day; weekly: that ISO week's Monday), so streak maths in
  `src/habits.ts` is plain day arithmetic. No row = the period was not kept.

Habits are deliberately excluded from the on-time scoreboard: habits earn
streaks, tasks earn on-time percentage.

### Migrations

`migrations/` holds one-shot SQL applied after a schema change:

```bash
npm run db:remote                                        # create/alter tables
npx wrangler d1 execute founders-db --remote --file=migrations/2026-08-23-habits.sql
```

Every statement is idempotent; re-running is a no-op.
```

In `apps/founders-tracker/CLAUDE.md`, replace the `**Auto-recurring tasks**` bullet under Guardrails with:

```markdown
- **Habits vs task templates**: cadence is the discriminator. `daily`/`weekly`
  templates are **habits** — ticked into `habit_logs`, streaked, and they NEVER
  insert a row into `tasks` (guarded by the `HABIT_NEVER_GENERATES_TASKS` test).
  Only `monthly` templates generate real tasks; a daily Cron Trigger materializes
  those and the app also catches up on load.
- **Period arithmetic lives in `src/habits.ts`** — a pure, D1-free module shared
  by the Worker and the client. `periodKey` has no other home; do not re-add a
  copy to `src/worker/recurring.ts`.
```

**Verify**: `grep -c "habit_logs" README.md` → at least `2`.
**Verify**: `grep -c "HABIT_NEVER_GENERATES_TASKS" CLAUDE.md` → `1`.

### Step 11: Land it

1. `git add` every in-scope file **including this plan file** (`plans/236-founders-habits-out-of-tasks.md`) and your `plans/README.md` row.
2. Flip this plan's row in `plans/README.md` to `DONE`.
3. Commit. Do not push.

**Verify**: `git status --short` → no untracked file under `apps/founders-tracker/` or `plans/`.
**Verify**: `git diff --stat e2fa1815..HEAD --name-only` → every path appears in this plan's In-scope list.

## Test plan

| What | Where | Following |
|---|---|---|
| Day/period arithmetic (`addDaysYmd`, `daysBetweenYmd`, `periodKey`, `isoWeek`, `periodStart`, `periodStep`) | `test/habits.test.ts` | `test/auth.test.ts` style |
| Streak maths (`currentStreak` grace + break cases, `bestStreak` longest-not-latest) | `test/habits.test.ts` | same |
| `runGenerator` inserts **zero** rows for daily and weekly templates, **one** for monthly — a fake D1 that records INSERT calls | `test/habits.test.ts` | same |
| Monthly eta clamping still correct | `test/habits.test.ts` | same |

Habit *persistence* (`listHabitsToday`, `toggleHabit`) is not unit-tested here: it is thin D1 glue over the already-tested pure functions, and Plan 237's Playwright pass exercises the toggle round-trip against a real local D1. That is a deliberate boundary, not an omission.

## Done criteria

- [ ] `cd apps/founders-tracker && npm run typecheck` → exit 0
- [ ] `cd apps/founders-tracker && npm test` → exit 0, summary reports ≥ 22 passing tests
- [ ] `test -f apps/founders-tracker/test/habits.test.ts` → exit 0
- [ ] `test -f apps/founders-tracker/src/habits.ts` → exit 0
- [ ] `test -f apps/founders-tracker/migrations/2026-08-23-habits.sql` → exit 0
- [ ] `cd apps/founders-tracker && npm run build` → exit 0
- [ ] `grep -c "src/habits.ts" apps/founders-tracker/tsconfig.app.json` → `1`
- [ ] `grep -c "src/habits.ts" apps/founders-tracker/tsconfig.worker.json` → `1`
- [ ] `grep -c "export function periodKey" apps/founders-tracker/src/worker/recurring.ts` → `0`
- [ ] `grep -c 'if (t.cadence !== "monthly") continue;' apps/founders-tracker/src/worker/recurring.ts` → `1`
- [ ] `grep -c "habits" apps/founders-tracker/src/worker/index.ts` → ≥ `3`
- [ ] The mutation recipe in Step 9 fails on the mutated tree printing `HABIT_NEVER_GENERATES_TASKS`, and passes again after revert
- [ ] `git diff --name-only e2fa1815..HEAD` contains no path under `apps/founders-tracker/src/client/`
- [ ] `git status --short` is clean for `apps/founders-tracker/` and `plans/`

## STOP conditions

- **A habit tick writes into `tasks`, or a monthly template stops generating one.** That inverts the whole point. Stop and report.
- **The mutated tree in Step 9 still passes `npm test`.** The gate is inert — worse than no gate, because it reads as coverage. Stop and report; do not weaken the test to make the numbers look right.
- **Gate integrity**: if any assertion fails, fix the code or the fixture. Weakening, swapping, skipping, or deleting an assertion is a STOP.
- **You need to touch a file under `src/client/`.** That is Plan 237's scope and would collide. Stop and report what you needed.
- **`npm run typecheck` fails in a way that seems to demand a dependency change.** Do not add, remove, or bump any dependency — especially `wrangler` / `@cloudflare/vite-plugin`, which are exact-pinned as a matched pair. Stop and report.
- **Any `--remote` D1 command or `npm run deploy` looks necessary.** It is not, for this plan. Production changes are the owner's. Stop and report.
- **`git status` shows unrelated dirty files from a concurrent session.** Leave them alone; stage only your in-scope paths. If your own scope is already dirty before you start, stop and report.

## Maintenance notes

- **Owner follow-up after this merges** (not the executor's job, not boss's):
  ```bash
  cd apps/founders-tracker
  npm run db:remote
  npx wrangler d1 execute founders-db --remote --file=migrations/2026-08-23-habits.sql
  npm run deploy
  ```
  Order matters: the table must exist before the migration, and the migration should land before the new Worker so `listHabitsToday` never queries a missing table.
- A backup of all 100 task rows as of 2026-08-23 sits **outside the repo** at `/Users/kbtg/kb-scratch/founders-tracker-backups/tasks-20260823.json`. Step B of the migration is destructive by design; that file is the undo. Do not copy it into the repo.
- **What a reviewer should scrutinise**: (1) that `periodKey` has exactly one definition in the repo — a second copy silently desynchronises the generator's dedupe index from the streak anchors; (2) that `computeScoreboard` is byte-identical, since habits leaving `tasks` is what keeps the scoreboard honest; (3) the grace rule in `currentStreak` — it must count from the *previous* period when the current one is unticked, otherwise every streak reads 0 until the tick lands.
- Plan 237 consumes `HabitToday` and `bucketOf`-style grouping. If the field names here change, 237's plan body needs the same edit.
