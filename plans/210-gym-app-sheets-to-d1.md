---
executor: agy
model:
test_cmd: cd apps/gym-app && npm run typecheck && npm test
ui: false
deploy:
needs: []
needs_prs: []
touches: [pipelines/backups/d1_export.py, apps/gym-app/src/worker/repo.ts, apps/gym-app/src/worker/google.ts, apps/gym-app/src/worker/index.ts, apps/gym-app/wrangler.jsonc, apps/gym-app/package.json, apps/gym-app/schema.sql, apps/gym-app/scripts/export-sheet-to-sql.mjs, apps/gym-app/test/repo.test.ts, apps/gym-app/CLAUDE.md, apps/gym-app/README.md]
mutation_apply: |
  perl -0777 -i -pe 's/WHERE id = \(SELECT id FROM log WHERE ts = \? ORDER BY id LIMIT 1\)/WHERE ts = ?/' apps/gym-app/src/worker/repo.ts
mutation_command: npm test
mutation_expect: duplicate timestamp
mutation_cwd: apps/gym-app
mutation_timeout: 600
---

# Plan 210: gym-app — move the backend from Google Sheets to Cloudflare D1

## Summary

- **Problem statement**: `apps/gym-app` stores every exercise and every logged set in a Google
  Sheet. Each mutation reads a whole tab and writes the whole tab back, so a single set edit
  rewrites the entire `Workout Log` (keyed only by an ISO timestamp string), every write costs a
  Sheets round-trip, and the app is one expired OAuth refresh token away from total failure.
- **Goals**:
  - Stand up a Cloudflare D1 database (`gym-db`) with a `tab` / `exercise` / `log` schema.
  - Rewrite `src/worker/repo.ts` against D1 with the **`/api/*` surface byte-identical**, so
    zero client files change.
  - Provide a one-shot, re-runnable export of the live sheet into `seed.sql`.
  - Add the first automated tests this app has ever had, over the new repo layer.
  - Keep the Google Sheet as an untouched rollback copy, plus a weekly one-way mirror from D1
    into separate `Mirror: *` tabs so the data stays human-readable in a spreadsheet.
- **Executor proposed**: `agy` (Gemini 3.1 Pro High) — every schema, SQL statement and function
  body is inlined below, so this is placement and wiring, not design.
- **Done criteria** (terse): `npm run typecheck` and `npm test` exit 0; D1 row counts match the
  exported sheet counts; the seven `/api` routes answer correctly against local D1; no
  `google.ts` import survives in `repo.ts`.
- **Stop conditions** (terse): any write to the original sheet tabs; any change to a
  `src/client/**` file; row counts that disagree after import.
- **Test / verification for success**: new `test/repo.test.ts` (vitest, `@cloudflare/vitest-pool-workers`-free — plain unit tests over a `better-sqlite3`-backed fake, see Step 6) plus a
  documented manual curl smoke against `wrangler dev` on local D1.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e57aea85..HEAD -- apps/gym-app/src/worker apps/gym-app/wrangler.jsonc apps/gym-app/package.json`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Difficulty**: standard
- **Planned at**: commit `e57aea85`, 2026-08-20

## Why this matters

The sheet is not a database and this app has outgrown pretending it is. Three concrete
consequences, all live today:

1. **A set edit rewrites all history.** `updateLog` / `deleteLog` read the whole `Workout Log`
   tab, map over every row, and write the whole thing back — keyed on the ISO timestamp string,
   which is not unique by construction. One bug there destroys years of workout data. There is
   no test sheet.
2. **Every write is a whole-tab rewrite.** `writeExercises` does `valuesUpdate` over the full
   range then `valuesClear` on the tail. Reordering five exercises rewrites the tab.
3. **A single credential is the whole app.** `GOOGLE_REFRESH_TOKEN` expiring, being revoked, or
   the Google project being touched takes the app to zero.

D1 is SQLite in the same Cloudflare account the Worker already runs in, costs nothing at this
volume, and replaces all three with one indexed SQL statement per write. The owner approved this
migration on 2026-08-20 explicitly ahead of new feature work (the week plan, plan 211), so the
feature is built once on a real schema instead of twice.

The `/api` surface is deliberately frozen in this plan. The client (`src/client/store.tsx`,
`api.ts`, every view) is the app's whole behaviour and is out of scope — if the routes answer
identically, the migration is invisible and reversible by redeploying the previous Worker.

## Current state

### Files in scope

| File | Role today |
|---|---|
| `apps/gym-app/src/worker/index.ts` | Hono app, 82 lines. Declares the 8 routes. Stays as-is except its imports. |
| `apps/gym-app/src/worker/repo.ts` | 310 lines. ALL sheet domain logic. Fully rewritten by this plan. |
| `apps/gym-app/src/worker/google.ts` | Sheets REST client + `Env`. Kept — the mirror (Step 8) still uses it. |
| `apps/gym-app/wrangler.jsonc` | Worker config. Gains the D1 binding. |
| `apps/gym-app/package.json` | Gains `test`, `db:local`, `db:remote`, `seed:local`, `seed:remote` scripts + 2 devDeps. |
| `apps/gym-app/src/shared.ts` | Domain types shared with the client. **Do not change any exported type.** |

### The exact API contract that must not change

From `src/worker/index.ts` (verbatim route list):

```
GET    /api/bootstrap
POST   /api/groups/:tab/exercises        body ExerciseInput            -> Exercise
PUT    /api/groups/:tab/exercises/:id    body ExerciseInput            -> Exercise
DELETE /api/groups/:tab/exercises/:id                                  -> { ok: true }
POST   /api/groups/:tab/reorder          body { orderedIds: string[] } -> Exercise[]
GET    /api/log[?exerciseId=]                                          -> LogEntry[]
POST   /api/log                          body LogInput                 -> LogEntry
PUT    /api/log/:date                    body LogPatch                 -> { ok: true }
DELETE /api/log/:date                                                  -> { ok: true }
```

`:tab` is URL-decoded by `index.ts` before reaching the repo. `:date` is the ISO timestamp
string that identifies a logged set. `Bootstrap` is:

```ts
export interface Bootstrap {
  groups: Group[];                        // Group = { tab, label, count, isMixed }
  exercises: Record<string, Exercise[]>;  // keyed by tab, ordered by position
  log: LogEntry[];                        // recent only (>= logCutoff), newest first
  logCutoff: string;                      // ISO
}
```

`RECENT_LOG_DAYS = 120` and `WORKOUT_LOG_TAB = "Workout Log"` live in `src/shared.ts`.

### The domain rules encoded in today's repo.ts (preserve all of them)

- **Two tab shapes.** Standard tabs are `ID, Name, Setting, Sets/Reps, Notes` and hold ONE muscle
  group (the tab name IS the muscle group). The `Anu Gym` tab is "mixed": `ID, Muscle Group,
  Name, Setting, Sets/Reps, Notes` — one tab, many muscle groups, `Exercise.muscleGroup` set
  per row. `isMixed(tab)` is the discriminator and `Exercise.muscleGroup` is `undefined` for
  non-mixed tabs.
- **Row order IS exercise order.** `Exercise.order` is the zero-based position within the tab and
  drives drag-reorder. Every write re-indexes from 0.
- **ID generation** (`nextId`), verbatim from today's code — reproduce this behaviour exactly:

```ts
/** Next ID for a tab: reuse the alpha prefix of existing IDs, bump the max number. */
function nextId(tab: string, existing: Exercise[]): string {
  let prefix = "";
  let maxNum = 0;
  for (const ex of existing) {
    const m = /^([A-Za-z]+)(\d+)$/.exec(ex.id.trim());
    if (m) {
      prefix = m[1];
      const n = parseInt(m[2], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  if (!prefix) {
    prefix = isMixed(tab) ? "ANU" : tab.replace(/[^A-Za-z]/g, "").slice(0, 1).toUpperCase() || "X";
  }
  return `${prefix}${String(maxNum + 1).padStart(2, "0")}`;
}
```

- **`updateExercise` patches only provided fields.** `input.name ?? ex.name` etc. `muscleGroup`
  is only written when the tab is mixed AND `input.muscleGroup !== undefined`.
- **`reorderExercises`** takes the full ordered id list; ids present in the tab but absent from
  the list keep their relative order and go to the end.
- **`readLog`** returns newest-first, optionally filtered by `exerciseId`.
- **Empty-row filter.** Rows where both `id` and `name` are blank are dropped on read. In D1
  this is moot (no blank rows get imported — the export script drops them).

### Conventions to match

- TypeScript, ESM, 2-space indent, double quotes, semicolons. Comments explain *why*.
- Exemplar for a D1-backed Worker in this repo: **`apps/lists-app`** — `schema.sql` at the app
  root, `db:local` / `db:remote` / `seed:local` npm scripts wrapping
  `wrangler d1 execute <db> --local|--remote --file=...`. Match that layout exactly.
- `apps/closet-app` is the exemplar for an API smoke script (`scripts/smoke.sh`).

### Anti-pattern to avoid (from plans/runs/LESSONS.md)

- 2026-08-17: a plan listed a test file in scope and the crew shipped none, while `npm test`
  still exited 0 because vitest passes when a specified file is simply absent. This plan's Done
  criteria therefore assert the test FILE exists and a minimum passing count.
- 2026-07-21: `test_cmd` must be able to fail on this plan's own deliverable. `npm test` here
  runs the new repo tests, which are the deliverable.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Install | `cd apps/gym-app && npm install` | exit 0 |
| Typecheck | `cd apps/gym-app && npm run typecheck` | exit 0, no output |
| Tests | `cd apps/gym-app && npm test` | exit 0, `Tests  1[0-9]+ passed` |
| Build | `cd apps/gym-app && npm run build` | exit 0, `✓ built in` |
| Create D1 | `cd apps/gym-app && npx wrangler d1 create gym-db` | prints the `database_id` |
| Apply schema locally | `cd apps/gym-app && npm run db:local` | exit 0 |
| Seed locally | `cd apps/gym-app && npm run seed:local` | exit 0 |
| Query local D1 | `cd apps/gym-app && npx wrangler d1 execute gym-db --local --command "SELECT COUNT(*) FROM exercise"` | a count |
| Run the Worker | `cd apps/gym-app && npx wrangler dev --port 8791` | serves on 8791 |

`.dev.vars` already holds `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`,
`SHEET_ID`. Do not print their values into any log, commit, or test fixture.

## Scope

**In scope**:
- `apps/gym-app/schema.sql` (new)
- `apps/gym-app/scripts/export-sheet-to-sql.mjs` (new)
- `apps/gym-app/src/worker/repo.ts` (rewritten)
- `apps/gym-app/src/worker/index.ts` (imports + the `DB` binding only)
- `apps/gym-app/src/worker/google.ts` (`Env` gains `DB`; nothing removed)
- `apps/gym-app/src/worker/mirror.ts` (new, Step 8)
- `apps/gym-app/wrangler.jsonc`, `apps/gym-app/package.json`
- `apps/gym-app/test/repo.test.ts` (new)
- `apps/gym-app/CLAUDE.md`, `apps/gym-app/README.md` (doc the new backend)
- `pipelines/backups/d1_export.py`, `pipelines/backups/README.md` (register `gym-db`, Step 9)

**Out of scope — do not touch**:
- **Every file under `apps/gym-app/src/client/`.** The whole point is that the client cannot
  tell. If you find yourself editing `store.tsx` or `api.ts`, the API contract has been broken —
  that is a STOP.
- `apps/gym-app/src/shared.ts` exported types. (You may add nothing; you may remove nothing.)
- The `Anu Gym` / `Home Gym` gym model and the week plan — that is plan 211.
- `scripts/patch-routes.mjs`, the PWA manifest, `public/sw.js`.
- Deleting anything from the Google Sheet. The sheet is the rollback copy.

## Git workflow

- Branch: `advisor/210-gym-app-sheets-to-d1`
- Commit per step: `feat(gym-app): <step>` — no AI footers. Do NOT push.

## Steps

### Step 1: Create the D1 database and bind it

Run `npx wrangler d1 create gym-db` and copy the returned `database_id`. Add to
`apps/gym-app/wrangler.jsonc`, after the `assets` block:

```jsonc
  "d1_databases": [
    { "binding": "DB", "database_name": "gym-db", "database_id": "<paste-the-id>" }
  ],
```

Add `DB: D1Database;` to the `Env` interface in `src/worker/google.ts` (keep every Google field —
Step 8 still needs them).

**Verify**: `cd apps/gym-app && npx wrangler d1 list` -> a row for `gym-db`. And
`npm run typecheck` -> exit 0.

### Step 2: Write the schema

Create `apps/gym-app/schema.sql`:

```sql
-- gym-app D1 schema. Replaces the "Exercises - AppSheet" Google Sheet.
--
-- `tab` exists so a group keeps its display order and can be EMPTY (deriving
-- groups from the exercise table would make an emptied group vanish).
-- `exercise.tab` is kept as the group key so the /api surface is unchanged.

CREATE TABLE IF NOT EXISTS tab (
  name     TEXT PRIMARY KEY,
  position INTEGER NOT NULL DEFAULT 0,
  is_mixed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS exercise (
  id           TEXT PRIMARY KEY,
  tab          TEXT NOT NULL REFERENCES tab(name),
  name         TEXT NOT NULL DEFAULT '',
  setting      TEXT NOT NULL DEFAULT '',
  sets_reps    TEXT NOT NULL DEFAULT '',
  notes        TEXT NOT NULL DEFAULT '',
  muscle_group TEXT,
  position     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_exercise_tab_pos ON exercise(tab, position);

-- One row per logged set. `id` is the real key: editing one set no longer
-- rewrites the whole history, which is what the sheet had to do.
CREATE TABLE IF NOT EXISTS log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ts           TEXT NOT NULL,
  exercise_id  TEXT NOT NULL,
  exercise     TEXT NOT NULL DEFAULT '',
  muscle_group TEXT NOT NULL DEFAULT '',
  set_no       INTEGER NOT NULL DEFAULT 0,
  weight       REAL NOT NULL DEFAULT 0,
  reps         INTEGER NOT NULL DEFAULT 0,
  notes        TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_log_ts ON log(ts DESC);
CREATE INDEX IF NOT EXISTS idx_log_exercise ON log(exercise_id, ts DESC);
```

Add to `package.json` scripts (match `apps/lists-app` wording):

```json
    "test": "vitest run",
    "db:local": "wrangler d1 execute gym-db --local --file=./schema.sql",
    "db:remote": "wrangler d1 execute gym-db --remote --file=./schema.sql",
    "seed:local": "wrangler d1 execute gym-db --local --file=./seed.sql",
    "seed:remote": "wrangler d1 execute gym-db --remote --file=./seed.sql",
    "export:sheet": "node scripts/export-sheet-to-sql.mjs"
```

Add devDependencies `"vitest": "^2.1.8"` and `"better-sqlite3": "^11.7.0"`, then `npm install`.

Add `seed.sql` to `apps/gym-app/.gitignore` (it contains the owner's whole workout history and
is regenerable).

**Verify**: `npm run db:local` -> exit 0, then
`npx wrangler d1 execute gym-db --local --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"`
-> rows including `exercise`, `log`, `tab`.

### Step 3: Export the live sheet into seed.sql

Create `apps/gym-app/scripts/export-sheet-to-sql.mjs`. It is a Node script (not the Worker): it
reads `.dev.vars` itself, exchanges the refresh token for an access token, reads every tab, and
writes `seed.sql`. It is **read-only against the sheet** — it must never issue a write request.

```js
// scripts/export-sheet-to-sql.mjs
//
// One-shot (re-runnable) export of the "Exercises - AppSheet" Google Sheet into
// seed.sql for D1. READ-ONLY against the sheet: only GET requests are issued.
//
//   node scripts/export-sheet-to-sql.mjs           -> writes ./seed.sql
//
// Credentials come from .dev.vars (same values as the Worker secrets).

import { readFileSync, writeFileSync } from "node:fs";

const WORKOUT_LOG_TAB = "Workout Log";
const MIXED_TABS = new Set(["Anu Gym", "Home Gym"]);

function devVars() {
  const out = {};
  for (const line of readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").split("\n")) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const env = devVars();
for (const k of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN", "SHEET_ID"]) {
  if (!env[k]) throw new Error(`missing ${k} in .dev.vars`);
}

async function token() {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
    }).toString(),
  });
  if (!r.ok) throw new Error(`token refresh failed: ${r.status} ${await r.text()}`);
  return (await r.json()).access_token;
}

const BASE = `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEET_ID}`;
const T = await token();
const get = async (path) => {
  const r = await fetch(BASE + path, { headers: { Authorization: `Bearer ${T}` } });
  if (!r.ok) throw new Error(`GET ${path} -> ${r.status} ${await r.text()}`);
  return r.json();
};

const q = (s) => `'${String(s ?? "").replace(/'/g, "''")}'`;
const num = (s) => {
  const n = Number(String(s ?? "").trim());
  return Number.isFinite(n) ? n : 0;
};

const meta = await get("?fields=sheets.properties");
const tabs = meta.sheets.map((s) => s.properties.title);
const libTabs = tabs.filter((t) => t !== WORKOUT_LOG_TAB);

const lines = ["-- generated by scripts/export-sheet-to-sql.mjs — do not edit", "BEGIN;"];
let exCount = 0;
let logCount = 0;

for (const [i, tab] of libTabs.entries()) {
  const mixed = MIXED_TABS.has(tab);
  lines.push(
    `INSERT INTO tab (name, position, is_mixed) VALUES (${q(tab)}, ${i}, ${mixed ? 1 : 0});`,
  );
  const range = `'${tab.replace(/'/g, "''")}'!${mixed ? "A2:F" : "A2:E"}`;
  const rows = (await get(`/values/${encodeURIComponent(range)}`)).values ?? [];
  let pos = 0;
  for (const r of rows) {
    // ID, [Muscle Group,] Name, Setting, Sets/Reps, Notes
    const [id, mg, name, setting, setsReps, notes] = mixed
      ? [r[0], r[1], r[2], r[3], r[4], r[5]]
      : [r[0], null, r[1], r[2], r[3], r[4]];
    if (!String(id ?? "").trim() && !String(name ?? "").trim()) continue; // blank row
    lines.push(
      `INSERT INTO exercise (id, tab, name, setting, sets_reps, notes, muscle_group, position) ` +
        `VALUES (${q(id)}, ${q(tab)}, ${q(name)}, ${q(setting)}, ${q(setsReps)}, ${q(notes)}, ` +
        `${mixed ? q(mg) : "NULL"}, ${pos});`,
    );
    pos++;
    exCount++;
  }
}

if (tabs.includes(WORKOUT_LOG_TAB)) {
  const rows =
    (await get(`/values/${encodeURIComponent(`'${WORKOUT_LOG_TAB}'!A2:H`)}`)).values ?? [];
  for (const r of rows) {
    if (!String(r[0] ?? "").trim()) continue;
    lines.push(
      `INSERT INTO log (ts, exercise_id, exercise, muscle_group, set_no, weight, reps, notes) ` +
        `VALUES (${q(r[0])}, ${q(r[1])}, ${q(r[2])}, ${q(r[3])}, ${num(r[4])}, ${num(r[5])}, ` +
        `${num(r[6])}, ${q(r[7])});`,
    );
    logCount++;
  }
}

lines.push("COMMIT;", "");
writeFileSync(new URL("../seed.sql", import.meta.url), lines.join("\n"));
console.log(`tabs=${libTabs.length} exercises=${exCount} log_rows=${logCount} -> seed.sql`);
```

Run it, then load it into local D1.

**Verify**: `npm run export:sheet` -> prints `tabs=N exercises=N log_rows=N -> seed.sql`.
Then `npm run seed:local` -> exit 0. Then
`npx wrangler d1 execute gym-db --local --command "SELECT (SELECT COUNT(*) FROM exercise) ex, (SELECT COUNT(*) FROM log) lg, (SELECT COUNT(*) FROM tab) tb"`
-> `ex` and `lg` and `tb` **equal the numbers the export printed**. If any differs, STOP.

### Step 4: Rewrite repo.ts against D1

Replace the whole file. This is the intelligence-heavy part of the plan, so the full
implementation is given — place it, do not redesign it.

```ts
// Domain operations over the D1 database (replaces the Google Sheet backend).
//
// The /api surface this serves is FROZEN — it must stay byte-identical to the
// sheet-backed version, so `tab` remains the group key and Exercise.order
// remains the zero-based position inside a tab.

import type { Env } from "./google";
import type { Exercise, ExerciseInput, Group, LogEntry, LogInput } from "../shared";
import { RECENT_LOG_DAYS } from "../shared";

/** Tabs that carry a per-row Muscle Group column (one tab, many muscle groups). */
const MIXED_TABS = new Set(["Anu Gym", "Home Gym"]);

function isMixed(tab: string): boolean {
  return MIXED_TABS.has(tab);
}

interface ExRow {
  id: string;
  tab: string;
  name: string;
  setting: string;
  sets_reps: string;
  notes: string;
  muscle_group: string | null;
  position: number;
}

function toExercise(r: ExRow): Exercise {
  const ex: Exercise = {
    id: r.id,
    name: r.name,
    setting: r.setting,
    setsReps: r.sets_reps,
    notes: r.notes,
    tab: r.tab,
    order: r.position,
  };
  // muscleGroup stays undefined for single-group tabs — the client relies on it.
  if (isMixed(r.tab)) ex.muscleGroup = r.muscle_group ?? "";
  return ex;
}

interface LogRow {
  ts: string;
  exercise_id: string;
  exercise: string;
  muscle_group: string;
  set_no: number;
  weight: number;
  reps: number;
  notes: string;
}

const toLogEntry = (r: LogRow): LogEntry => ({
  date: r.ts,
  exerciseId: r.exercise_id,
  exercise: r.exercise,
  muscleGroup: r.muscle_group,
  setNo: r.set_no,
  weight: r.weight,
  reps: r.reps,
  notes: r.notes,
});

// ---- Bootstrap -------------------------------------------------------------

export interface Bootstrap {
  groups: Group[];
  exercises: Record<string, Exercise[]>;
  log: LogEntry[];
  logCutoff: string;
}

export async function bootstrap(env: Env): Promise<Bootstrap> {
  const cutoff = new Date(Date.now() - RECENT_LOG_DAYS * 86400000).toISOString();
  const [tabs, exs, logs] = await env.DB.batch<any>([
    env.DB.prepare("SELECT name, is_mixed FROM tab ORDER BY position, name"),
    env.DB.prepare("SELECT * FROM exercise ORDER BY tab, position"),
    env.DB.prepare("SELECT * FROM log WHERE ts >= ? ORDER BY ts DESC").bind(cutoff),
  ]);

  const exercises: Record<string, Exercise[]> = {};
  const groups: Group[] = [];
  for (const t of tabs.results as { name: string; is_mixed: number }[]) {
    exercises[t.name] = [];
    groups.push({ tab: t.name, label: t.name, count: 0, isMixed: !!t.is_mixed });
  }
  for (const r of exs.results as ExRow[]) {
    (exercises[r.tab] ??= []).push(toExercise(r));
  }
  for (const g of groups) g.count = (exercises[g.tab] ?? []).length;

  return {
    groups,
    exercises,
    log: (logs.results as LogRow[]).map(toLogEntry),
    logCutoff: cutoff,
  };
}

// ---- Library ---------------------------------------------------------------

export async function readExercises(env: Env, tab: string): Promise<Exercise[]> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM exercise WHERE tab = ? ORDER BY position",
  )
    .bind(tab)
    .all<ExRow>();
  return results.map(toExercise);
}

/** Next ID for a tab: reuse the alpha prefix of existing IDs, bump the max number.
 *  Behaviour preserved verbatim from the sheet implementation. */
function nextId(tab: string, existing: Exercise[]): string {
  let prefix = "";
  let maxNum = 0;
  for (const ex of existing) {
    const m = /^([A-Za-z]+)(\d+)$/.exec(ex.id.trim());
    if (m) {
      prefix = m[1];
      const n = parseInt(m[2], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  if (!prefix) {
    prefix = isMixed(tab)
      ? tab === "Home Gym"
        ? "HOME"
        : "ANU"
      : tab.replace(/[^A-Za-z]/g, "").slice(0, 1).toUpperCase() || "X";
  }
  return `${prefix}${String(maxNum + 1).padStart(2, "0")}`;
}

export async function addExercise(
  env: Env,
  tab: string,
  input: ExerciseInput,
): Promise<Exercise> {
  const list = await readExercises(env, tab);
  const ex: Exercise = {
    id: nextId(tab, list),
    name: input.name.trim(),
    setting: input.setting?.trim() ?? "",
    setsReps: input.setsReps?.trim() ?? "",
    notes: input.notes?.trim() ?? "",
    muscleGroup: isMixed(tab) ? input.muscleGroup?.trim() ?? "" : undefined,
    tab,
    order: list.length,
  };
  await env.DB.prepare(
    "INSERT INTO exercise (id, tab, name, setting, sets_reps, notes, muscle_group, position)" +
      " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      ex.id,
      tab,
      ex.name,
      ex.setting,
      ex.setsReps,
      ex.notes,
      ex.muscleGroup ?? null,
      ex.order,
    )
    .run();
  return ex;
}

export async function updateExercise(
  env: Env,
  tab: string,
  id: string,
  input: ExerciseInput,
): Promise<Exercise> {
  const row = await env.DB.prepare("SELECT * FROM exercise WHERE id = ? AND tab = ?")
    .bind(id, tab)
    .first<ExRow>();
  if (!row) throw new Error(`exercise ${id} not found in ${tab}`);
  const ex = toExercise(row);
  // Only provided fields are patched — same as the sheet implementation.
  ex.name = input.name?.trim() ?? ex.name;
  ex.setting = input.setting?.trim() ?? ex.setting;
  ex.setsReps = input.setsReps?.trim() ?? ex.setsReps;
  ex.notes = input.notes?.trim() ?? ex.notes;
  if (isMixed(tab) && input.muscleGroup !== undefined) {
    ex.muscleGroup = input.muscleGroup.trim();
  }
  await env.DB.prepare(
    "UPDATE exercise SET name = ?, setting = ?, sets_reps = ?, notes = ?, muscle_group = ?" +
      " WHERE id = ? AND tab = ?",
  )
    .bind(ex.name, ex.setting, ex.setsReps, ex.notes, ex.muscleGroup ?? null, id, tab)
    .run();
  return ex;
}

export async function deleteExercise(env: Env, tab: string, id: string): Promise<void> {
  await env.DB.prepare("DELETE FROM exercise WHERE id = ? AND tab = ?").bind(id, tab).run();
  // Close the gap so positions stay 0..n-1.
  const list = await readExercises(env, tab);
  await reindex(env, tab, list.map((e) => e.id));
}

async function reindex(env: Env, tab: string, orderedIds: string[]): Promise<void> {
  if (orderedIds.length === 0) return;
  await env.DB.batch(
    orderedIds.map((id, i) =>
      env.DB.prepare("UPDATE exercise SET position = ? WHERE id = ? AND tab = ?").bind(i, id, tab),
    ),
  );
}

/** Reorder by supplying the full list of ids in their new order. Ids not
 *  mentioned keep their relative order at the end. */
export async function reorderExercises(
  env: Env,
  tab: string,
  orderedIds: string[],
): Promise<Exercise[]> {
  const list = await readExercises(env, tab);
  const known = new Set(list.map((e) => e.id));
  const next = orderedIds.filter((id) => known.has(id));
  const seen = new Set(next);
  for (const e of list) if (!seen.has(e.id)) next.push(e.id);
  await reindex(env, tab, next);
  return readExercises(env, tab);
}

// ---- Workout log -----------------------------------------------------------

export async function appendLog(env: Env, input: LogInput, dateIso: string): Promise<LogEntry> {
  const entry: LogEntry = {
    date: input.date || dateIso,
    exerciseId: input.exerciseId,
    exercise: input.exercise,
    muscleGroup: input.muscleGroup,
    setNo: input.setNo,
    weight: input.weight,
    reps: input.reps,
    notes: input.notes?.trim() ?? "",
  };
  await env.DB.prepare(
    "INSERT INTO log (ts, exercise_id, exercise, muscle_group, set_no, weight, reps, notes)" +
      " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      entry.date,
      entry.exerciseId,
      entry.exercise,
      entry.muscleGroup,
      entry.setNo,
      entry.weight,
      entry.reps,
      entry.notes,
    )
    .run();
  return entry;
}

export async function readLog(env: Env, exerciseId?: string): Promise<LogEntry[]> {
  const stmt = exerciseId
    ? env.DB.prepare("SELECT * FROM log WHERE exercise_id = ? ORDER BY ts DESC").bind(exerciseId)
    : env.DB.prepare("SELECT * FROM log ORDER BY ts DESC");
  const { results } = await stmt.all<LogRow>();
  return results.map(toLogEntry);
}

/** Edit a logged set, keyed by its ISO timestamp (the client's row key).
 *  Scoped through `id` so a duplicate timestamp can only ever touch ONE row —
 *  the sheet version rewrote every matching row. */
export async function updateLog(
  env: Env,
  date: string,
  patch: { weight?: number; reps?: number; notes?: string },
): Promise<void> {
  await env.DB.prepare(
    "UPDATE log SET weight = COALESCE(?, weight), reps = COALESCE(?, reps)," +
      " notes = COALESCE(?, notes)" +
      " WHERE id = (SELECT id FROM log WHERE ts = ? ORDER BY id LIMIT 1)",
  )
    .bind(patch.weight ?? null, patch.reps ?? null, patch.notes ?? null, date)
    .run();
}

export async function deleteLog(env: Env, date: string): Promise<void> {
  await env.DB.prepare(
    "DELETE FROM log WHERE id = (SELECT id FROM log WHERE ts = ? ORDER BY id LIMIT 1)",
  )
    .bind(date)
    .run();
}
```

`src/worker/index.ts` needs **no logic change** — only confirm its import list still resolves
(`bootstrap, addExercise, updateExercise, deleteExercise, reorderExercises, appendLog, readLog,
updateLog, deleteLog` are all still exported).

**Verify**: `npm run typecheck` -> exit 0. Then
`grep -c "from \"./google\"" src/worker/repo.ts` -> `1` (the `Env` type import only), and
`grep -c "valuesGet\|valuesUpdate\|valuesAppend\|valuesClear\|getTabs\|addTab" src/worker/repo.ts`
-> `0`.

### Step 5: Smoke the routes against local D1

Start `npx wrangler dev --port 8791` and exercise every route. Record the output in the run log.

```bash
BASE=http://127.0.0.1:8791/api
curl -s $BASE/bootstrap | head -c 400                       # groups + exercises + log
curl -s "$BASE/log?exerciseId=C01" | head -c 200            # filtered history
curl -s -X POST $BASE/groups/Chest/exercises \
  -H 'content-type: application/json' -d '{"name":"SMOKE TEST"}'
curl -s -X PUT $BASE/groups/Chest/exercises/<returned-id> \
  -H 'content-type: application/json' -d '{"name":"SMOKE TEST","setsReps":"4 x 8"}'
curl -s -X DELETE $BASE/groups/Chest/exercises/<returned-id>
```

**Verify**: `/bootstrap` returns a JSON object whose `groups` length equals the `tb` count from
Step 3 and whose `exercises` keys are the tab names; the POST returns a new `Exercise` with a
generated id; the DELETE returns `{"ok":true}`; a second `/bootstrap` no longer contains
`SMOKE TEST`.

### Step 6: Tests over the repo layer

Create `apps/gym-app/test/repo.test.ts`. D1's `env.DB` is API-compatible enough with
`better-sqlite3` for unit purposes via a small adapter — write the adapter in the test file so
the repo functions are exercised for real, against a real SQLite database created from
`schema.sql`.

Cover at least these 12 cases:

1. `bootstrap` returns one group per `tab` row, in `position` order, with correct `count`.
2. `bootstrap` sets `isMixed` true for `Anu Gym` and false for `Chest`.
3. `bootstrap` omits `muscleGroup` for a non-mixed tab exercise and sets it for a mixed one.
4. `bootstrap` excludes a log row older than `RECENT_LOG_DAYS` and includes a recent one.
5. `readExercises` returns exercises ordered by `position`.
6. `addExercise` on a tab whose ids are `C01, C02` returns id `C03`.
7. `addExercise` on an EMPTY non-mixed tab named `Chest` returns id `C01`.
8. `addExercise` on the empty `Home Gym` tab returns id `HOME01`.
9. `updateExercise` with only `setsReps` leaves `name`, `setting` and `notes` untouched.
10. `reorderExercises` with a partial id list puts the unmentioned ids last, preserving their
    relative order, and re-indexes positions to `0..n-1`.
11. `deleteExercise` closes the position gap (remaining positions are `0..n-2`).
12. `updateLog` with two log rows sharing the SAME `ts` modifies exactly one of them.
    **Name this test exactly** `updateLog with a duplicate timestamp touches exactly one row` —
    boss's mutation gate greps the failure output for `duplicate timestamp`, so that string must
    appear in the test name.

Case 12 is the regression test for the defect this migration exists to kill — do not omit it.
The mutation gate in this plan's frontmatter proves the test can fail: it rewrites `updateLog`'s
`WHERE id = (SELECT ... LIMIT 1)` back to the sheet-era `WHERE ts = ?` and requires `npm test` to
go red. If the suite still passes with that mutation applied, the test asserts nothing — fix the
test, never the mutation.

**Verify**: `npm test` -> exit 0 and the summary line matches `Tests  1[2-9] passed` or higher.

### Step 7: Point production at D1

Apply the schema and seed remotely, then deploy.

```bash
npm run db:remote
npm run seed:remote
npm run deploy
```

**Verify**: `npx wrangler d1 execute gym-db --remote --command "SELECT COUNT(*) FROM exercise"`
-> the same count as local. Then `curl -s https://kushal-gym.agrolloo.com/api/bootstrap | head -c 200`
-> a JSON object with `groups`.

**Note**: `npm run deploy` is a DEPLOY. Per `tooling/boss/CLAUDE.md` the deploy chain runs only
when the owner has said "deploy" for this item. If you are an executor and no such instruction
is in your brief, complete Steps 1–6 and 8, leave Step 7 undone, and report that production is
still on the sheet-backed Worker.

### Step 8: Weekly one-way mirror from D1 into the sheet

So the data stays viewable in a spreadsheet without the sheet being load-bearing.

Create `apps/gym-app/src/worker/mirror.ts` exporting `mirrorToSheet(env: Env): Promise<void>`.
It reads every `exercise` and `log` row from D1 and writes them into tabs named
`Mirror: <tab>` and `Mirror: Workout Log`, creating each via the existing `addTab` helper when
absent, then `valuesUpdate` + `valuesClear` on the tail — reuse `google.ts` as-is.

**It must never write to a tab whose name does not start with `Mirror: `.** Guard it:

```ts
const MIRROR_PREFIX = "Mirror: ";

function mirrorTab(name: string): string {
  const t = `${MIRROR_PREFIX}${name}`;
  // Belt and braces: the original tabs are the rollback copy and must stay frozen.
  if (!t.startsWith(MIRROR_PREFIX)) throw new Error("refusing to write a non-mirror tab");
  return t;
}
```

Wire a cron trigger in `wrangler.jsonc`:

```jsonc
  "triggers": { "crons": ["0 4 * * 1"] },
```

and add to `src/worker/index.ts`:

```ts
export default {
  fetch: app.fetch,
  scheduled: async (_c: ScheduledController, env: Env) => {
    await mirrorToSheet(env);
  },
};
```

(Replacing the bare `export default app;` — keep `app.fetch` so route behaviour is unchanged.)

**Verify**: `npm run typecheck` -> exit 0.
`grep -n "MIRROR_PREFIX" src/worker/mirror.ts` -> the guard is present.
`npx wrangler dev --port 8791 --test-scheduled` then
`curl -s "http://127.0.0.1:8791/__scheduled?cron=0+4+*+*+1"` -> exit 0, and the spreadsheet
gains `Mirror: *` tabs while every original tab keeps its original row count.

### Step 9: Register gym-db with the nightly D1 backup

Every other D1 in this repo is backed up nightly to MinIO by `pipelines/backups/d1_export.py`
(cron `vps-crons/d1-backup/`; decisions.md 2026-07-06). Cloudflare's own time travel reaches only
about 30 days, so an unregistered database is the one database with no owned backup — and this one
now holds the owner's entire workout history.

Add a row to the `DATABASES` dict in `pipelines/backups/d1_export.py`, matching the existing
comment style:

    "gym-db": "<the database_id from Step 1>",              # gym: exercises + workout log

and add `gym-db` to the database list in `pipelines/backups/README.md`.

**Verify**: `grep -c gym-db pipelines/backups/d1_export.py` -> `1`, and
`python3 -m py_compile pipelines/backups/d1_export.py` -> exit 0.

### Step 10: Update the docs

- `apps/gym-app/CLAUDE.md`: replace the "Writes hit a LIVE production Google Sheet" guardrail
  with the D1 reality (binding `DB`, `schema.sql`, `db:local`/`seed:local`, sheet is now a
  frozen rollback copy plus `Mirror: *` tabs). Keep the "no auth" bullet.
- `apps/gym-app/README.md`: same, in the Data-model and Deploy sections.
- `apps/local-apps.md`: the gym section's live-sheet warning is obsolete — local dev now runs on
  local D1. Note `npm run db:local && npm run seed:local` before `npm run dev`.

**Verify**: `grep -c "LIVE production Google Sheet" apps/gym-app/CLAUDE.md` -> `0`.

## Test plan

- **Unit**: `test/repo.test.ts`, 12+ cases listed in Step 6, run by `npm test` (vitest), against
  a real SQLite database built from `schema.sql`. This is the merge gate.
- **Contract**: the Step 5 curl smoke over all 8 routes against `wrangler dev` + local D1.
- **Data integrity**: Step 3's count comparison (sheet rows exported == D1 rows), repeated
  remotely in Step 7.
- **No client drift**: `git diff --name-only <base>..HEAD -- apps/gym-app/src/client` must be
  empty. This is the plan's core claim.

## Done criteria

- [ ] `cd apps/gym-app && npm run typecheck` exits 0.
- [ ] `cd apps/gym-app && npm test` exits 0, and `test -f test/repo.test.ts` succeeds, and the
      vitest summary reports **12 or more** passing tests.
- [ ] `cd apps/gym-app && npm run build` exits 0.
- [ ] `grep -c "valuesGet\|valuesUpdate\|valuesAppend\|valuesClear\|getTabs" src/worker/repo.ts`
      prints `0`.
- [ ] `git diff --name-only e57aea85..HEAD -- apps/gym-app/src/client` prints nothing.
- [ ] Local D1 `exercise` / `log` / `tab` counts equal the numbers `npm run export:sheet` printed.
- [ ] The Step 5 curl smoke shows every route answering, including a POST/PUT/DELETE round trip.
- [ ] `grep -n "MIRROR_PREFIX" src/worker/mirror.ts` shows the non-mirror-tab guard.
- [ ] `apps/gym-app/CLAUDE.md` no longer claims writes hit a live Google Sheet.
- [ ] `seed.sql` is gitignored and NOT committed.
- [ ] `grep -c gym-db pipelines/backups/d1_export.py` prints `1`.
- [ ] With the frontmatter mutation applied, `npm test` FAILS printing `duplicate timestamp`;
      reverted, it passes again.

## STOP conditions

- **Any write request to an original sheet tab.** Only `Mirror: *` tabs may be written, and only
  by Step 8. If the export script or a test ever issues a Sheets write, stop and report.
- **Any change to a file under `src/client/`.** That means the API contract broke; stop rather
  than "fixing" the client to match.
- **Row counts disagree** between the export summary and D1 after seeding. Do not "adjust" the
  export to make the numbers line up — stop and report both numbers.
- **A test assertion fails and the fix is to weaken the assertion.** Fix the code or the fixture;
  weakening, swapping or deleting an assertion is a STOP. (Case 12 especially — it is the whole
  reason for this migration.)
- **`wrangler d1 create` reports an existing `gym-db`** you did not create: stop, do not seed
  into an unknown database.
- **Step 7 (deploy) without an explicit owner deploy instruction** in your brief: skip it and say
  so; do not deploy on your own initiative.

## Maintenance notes

- `MIXED_TABS` in `repo.ts` is now the single place that knows which tabs carry a per-row muscle
  group. Plan 211 replaces the whole `tab`-as-gym model with an explicit `gym` column — expect
  this constant to disappear there.
- `updateLog` / `deleteLog` still address a set by ISO timestamp because that is the client's row
  key. Whoever next touches the client should switch to the numeric `log.id`; until then the
  `LIMIT 1` subquery is what keeps a duplicate timestamp from being destructive.
- `seed.sql` is a full dump of the owner's workout history. It is gitignored on purpose. Never
  paste its contents into a plan, PR, or run log.
- A reviewer should scrutinise: the `nextId` port (ID collisions are silent and permanent), the
  `COALESCE` patch semantics in `updateLog` (a genuine `0` weight must still be storable — note
  `patch.weight ?? null` means an explicit `0` IS written, which is correct), and the mirror's
  tab-name guard.
