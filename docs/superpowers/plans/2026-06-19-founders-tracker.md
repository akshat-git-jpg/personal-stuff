# Founders Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A shared two-tab (Khushi / Kushal) action-item tracker with hard-to-ignore missing-deadline cards, an on-time scoreboard, and UI-managed monthly/weekly auto-recurring tasks.

**Architecture:** Single Cloudflare Worker serving a React SPA (Vite) and a Hono JSON API, backed by a D1 (SQLite) database. A signed-cookie PIN gate fronts everything. Recurring tasks are stored as templates in D1 and materialized into normal tasks by an idempotent generator that runs both on a daily Cron Trigger and as an on-load catch-up.

**Tech Stack:** Vite + React 18 + TypeScript, Hono on Cloudflare Workers, Cloudflare D1, `@dnd-kit` for drag-reorder. Mirrors the existing `apps/gym-app` structure.

## Global Constraints

- **No TDD / no test suites.** Repo convention for personal tooling: implement directly, verify manually. Every task ends with a build + manual verification step, not automated tests.
- **Stack parity with `apps/gym-app`:** same `src/worker` + `src/client` + `src/shared.ts` layout, same wrangler `assets` binding with `not_found_handling: "single-page-application"`, same `tsc -b && vite build` build.
- **Timezone:** all date math is date-only in **Asia/Kolkata**. Never compare raw timestamps for on-time/late or countdowns — reduce to `YYYY-MM-DD` in Asia/Kolkata first.
- **Owners** are exactly the string literals `'khushi'` and `'kushal'`. No other values.
- **Auth:** every `/api/*` route and the SPA shell sit behind a signed-cookie PIN gate. Secrets: `APP_PIN`, `SESSION_SECRET`.
- **No AI/Claude/Anthropic markers** in any committed file, comment, or commit message.
- **Commits:** frequent, one per task, conventional-commit style (`feat(founders): ...`). Do not push (the user pushes).
- **App lives at** `apps/founders-tracker/`; worker name `founders-tracker`; domain `founders.agrolloo.com`.

---

## File Structure

```
apps/founders-tracker/
  package.json
  tsconfig.json  tsconfig.app.json  tsconfig.node.json  tsconfig.worker.json
  vite.config.ts
  wrangler.jsonc
  index.html
  .dev.vars                 (gitignored — local secrets)
  .gitignore
  schema.sql                (D1 schema, source of truth)
  README.md
  src/
    shared.ts               domain types shared client<->worker
    worker/
      index.ts              Hono app: auth gate, routes, scheduled handler
      auth.ts               PIN cookie sign/verify + middleware + login page HTML
      db.ts                 D1 query layer (tasks + templates + scoreboard)
      recurring.ts          period keys, due-day resolution, idempotent generator
      dates.ts              Asia/Kolkata date-only helpers (worker side)
    client/
      main.tsx              React entry
      App.tsx               shell: tabs, screen routing, data load
      api.ts                typed fetch client
      dates.ts              client date helpers (days-left, formatting)
      Scoreboard.tsx        per-person on-time stats
      TaskList.tsx          dnd-kit sortable list + Done section
      TaskCard.tsx          normal + hazard variants, countdown
      AddTaskForm.tsx       manual task creation
      RecurringScreen.tsx   template list + CRUD form
      index.css             all styles incl. hazard stripes + countdown colors
```

---

## Task 1: Scaffold the app + D1 schema

**Files:**
- Create: `apps/founders-tracker/package.json`, `vite.config.ts`, `index.html`, `tsconfig*.json`, `.gitignore`, `.dev.vars`, `wrangler.jsonc`, `schema.sql`
- Create: `apps/founders-tracker/src/worker/index.ts` (stub), `src/client/main.tsx` (stub), `src/client/App.tsx` (stub), `src/client/index.css` (empty), `src/shared.ts` (stub)

**Interfaces:**
- Produces: a deployable empty SPA + Worker with a bound D1 database `founders-db` (binding name `DB`), and a `schema.sql` applied to the local D1.

- [ ] **Step 1: Copy config scaffolding from gym-app**

Create `package.json`:

```json
{
  "name": "founders-tracker",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "deploy": "npm run build && wrangler deploy",
    "db:local": "wrangler d1 execute founders-db --local --file=schema.sql",
    "db:remote": "wrangler d1 execute founders-db --remote --file=schema.sql"
  },
  "dependencies": {
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/modifiers": "^7.0.0",
    "@dnd-kit/sortable": "^8.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "hono": "^4.6.14",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@cloudflare/vite-plugin": "^1.0.12",
    "@cloudflare/workers-types": "^4.20250109.0",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.7.3",
    "vite": "^6.0.7",
    "wrangler": "^3.99.0"
  }
}
```

Create `vite.config.ts` (identical to gym-app):

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), cloudflare()],
});
```

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta name="theme-color" content="#0b0d12" />
    <title>Founders Tracker</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/client/main.tsx"></script>
  </body>
</html>
```

Copy `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.worker.json` verbatim from `apps/gym-app/`.

Create `.gitignore`:

```
node_modules
dist
.wrangler
.dev.vars
*.tsbuildinfo
```

Create `.dev.vars` (local only, gitignored):

```
APP_PIN=changeme
SESSION_SECRET=local-dev-secret-change-me
```

- [ ] **Step 2: Write wrangler.jsonc with D1 + cron binding**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "founders-tracker",
  "main": "src/worker/index.ts",
  "compatibility_date": "2025-01-01",
  "compatibility_flags": ["nodejs_compat"],
  "routes": [{ "pattern": "founders.agrolloo.com", "custom_domain": true }],
  "assets": {
    "directory": "./dist/client",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application"
  },
  "d1_databases": [
    { "binding": "DB", "database_name": "founders-db", "database_id": "PLACEHOLDER_SET_IN_TASK_12" }
  ],
  "triggers": { "crons": ["35 18 * * *"] },
  "observability": { "enabled": true }
  // Secrets (wrangler secret put / .dev.vars): APP_PIN, SESSION_SECRET
}
```

Note: cron `35 18 * * *` is 18:35 UTC = 00:05 Asia/Kolkata. `database_id` stays a placeholder until Task 12 creates the remote DB; local dev does not need it.

- [ ] **Step 3: Write schema.sql**

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

- [ ] **Step 4: Write stub source files so the build compiles**

`src/shared.ts`:

```ts
export {};
```

`src/worker/index.ts`:

```ts
import { Hono } from "hono";

export interface Env {
  DB: D1Database;
  APP_PIN: string;
  SESSION_SECRET: string;
  ASSETS: { fetch: typeof fetch };
}

const app = new Hono<{ Bindings: Env }>();
app.get("/api/ping", (c) => c.json({ ok: true }));

export default app;
```

`src/client/main.tsx`:

```tsx
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
```

`src/client/App.tsx`:

```tsx
export function App() {
  return <div>Founders Tracker</div>;
}
```

`src/client/index.css`: empty file.

- [ ] **Step 5: Install, apply local schema, build**

```bash
cd apps/founders-tracker
npm install
npm run db:local
npm run build
```

Expected: `npm run db:local` prints rows-written for the two `CREATE TABLE` statements; `npm run build` completes with no TS errors and writes `dist/client`.

- [ ] **Step 6: Manual verification — dev server boots**

```bash
npm run dev
```

Expected: Vite serves; visiting the printed localhost URL shows "Founders Tracker"; `curl localhost:5173/api/ping` (or the printed port) returns `{"ok":true}`. Stop the server (Ctrl-C).

- [ ] **Step 7: Commit**

```bash
git add apps/founders-tracker
git commit -m "feat(founders): scaffold worker + spa + d1 schema"
```

---

## Task 2: Shared domain types

**Files:**
- Modify: `apps/founders-tracker/src/shared.ts`

**Interfaces:**
- Produces: `Owner`, `Task`, `TaskInput`, `TaskPatch`, `Template`, `TemplateInput`, `OwnerScore`, `Scoreboard`, and the `OWNERS` constant — imported by every later task.

- [ ] **Step 1: Write the full shared types**

Replace `src/shared.ts` with:

```ts
// Domain types shared between the React client and the Cloudflare Worker.

export type Owner = "khushi" | "kushal";
export const OWNERS: Owner[] = ["khushi", "kushal"];

export type TaskStatus = "open" | "done";
export type Cadence = "monthly" | "weekly";

/** A tracked action item. */
export interface Task {
  id: number;
  title: string;
  owner: Owner;
  /** 'YYYY-MM-DD' (Asia/Kolkata) or null when no deadline is set. */
  eta: string | null;
  notes: string | null;
  status: TaskStatus;
  /** Manual ordering within (owner, status). Ascending = top of list. */
  sortOrder: number;
  /** Source recurring template, or null for manual tasks. */
  templateId: number | null;
  /** Period this was generated for, e.g. '2026-06' or '2026-W25'; null if manual. */
  periodKey: string | null;
  createdAt: string;
  /** ISO timestamp set when marked done; null while open. */
  completedAt: string | null;
}

export interface TaskInput {
  title: string;
  owner: Owner;
  eta?: string | null; // 'YYYY-MM-DD' or null
  notes?: string | null;
}

export interface TaskPatch {
  title?: string;
  owner?: Owner;
  eta?: string | null;
  notes?: string | null;
  status?: TaskStatus;
}

/** A recurring-task definition managed entirely from the UI. */
export interface Template {
  id: number;
  title: string;
  owner: Owner;
  notes: string | null;
  cadence: Cadence;
  /** monthly: 1-31 (clamped to month length). weekly: 0-6 (0=Mon … 6=Sun). */
  dueDay: number;
  active: boolean;
  createdAt: string;
}

export interface TemplateInput {
  title: string;
  owner: Owner;
  notes?: string | null;
  cadence: Cadence;
  dueDay: number;
  active?: boolean;
}

/** Per-person score over their completed tasks. */
export interface OwnerScore {
  owner: Owner;
  /** done tasks that had an ETA at completion. */
  scored: number;
  onTime: number;
  late: number;
  /** mean days late over the `late` tasks; 0 when none. */
  avgDaysLate: number;
  /** done tasks completed with no ETA — untracked, earns nothing. */
  noEta: number;
  /** onTime / scored * 100, rounded; null when scored === 0. */
  onTimePct: number | null;
}

export interface Scoreboard {
  khushi: OwnerScore;
  kushal: OwnerScore;
}
```

- [ ] **Step 2: Build**

```bash
cd apps/founders-tracker && npm run build
```

Expected: compiles clean.

- [ ] **Step 3: Commit**

```bash
git add src/shared.ts
git commit -m "feat(founders): shared domain types"
```

---

## Task 3: Worker date helpers (Asia/Kolkata, date-only)

**Files:**
- Create: `apps/founders-tracker/src/worker/dates.ts`

**Interfaces:**
- Produces:
  - `todayIST(): string` → `'YYYY-MM-DD'` for "now" in Asia/Kolkata.
  - `nowIso(): string` → full ISO timestamp.
  - `daysBetween(fromYmd: string, toYmd: string): number` → integer day difference `to - from` (both `'YYYY-MM-DD'`).

- [ ] **Step 1: Implement**

```ts
// Date-only helpers in Asia/Kolkata. We never compare raw timestamps for
// deadline math — everything reduces to a 'YYYY-MM-DD' string first.

const IST = "en-CA"; // en-CA formats as YYYY-MM-DD
const TZ = "Asia/Kolkata";

/** 'YYYY-MM-DD' for the current moment in Asia/Kolkata. */
export function todayIST(d: Date = new Date()): string {
  return new Intl.DateTimeFormat(IST, {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Integer days from `fromYmd` to `toYmd` (UTC-noon anchored to avoid DST drift). */
export function daysBetween(fromYmd: string, toYmd: string): number {
  const a = Date.parse(`${fromYmd}T12:00:00Z`);
  const b = Date.parse(`${toYmd}T12:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}
```

- [ ] **Step 2: Build + sanity check**

```bash
cd apps/founders-tracker && npm run build
```

Expected: compiles. (Logic is exercised by later tasks; no standalone test per repo convention.)

- [ ] **Step 3: Commit**

```bash
git add src/worker/dates.ts
git commit -m "feat(founders): worker date helpers"
```

---

## Task 4: D1 query layer

**Files:**
- Create: `apps/founders-tracker/src/worker/db.ts`

**Interfaces:**
- Consumes: types from `../shared`; `todayIST`, `nowIso`, `daysBetween` from `./dates`.
- Produces:
  - `listTasks(db): Promise<Task[]>`
  - `createTask(db, input: TaskInput): Promise<Task>`
  - `patchTask(db, id: number, patch: TaskPatch): Promise<Task>`
  - `deleteTask(db, id: number): Promise<void>`
  - `reorderTasks(db, owner: Owner, status: TaskStatus, orderedIds: number[]): Promise<void>`
  - `listTemplates(db): Promise<Template[]>`
  - `createTemplate(db, input: TemplateInput): Promise<Template>`
  - `patchTemplate(db, id: number, patch: Partial<TemplateInput>): Promise<Template>`
  - `deleteTemplate(db, id: number): Promise<void>`
  - `computeScoreboard(db): Promise<Scoreboard>`
  - Row mappers `rowToTask`, `rowToTemplate` (exported for reuse by `recurring.ts`).

- [ ] **Step 1: Implement row mappers + task CRUD**

```ts
import type {
  Owner, Scoreboard, OwnerScore, Task, TaskInput, TaskPatch,
  TaskStatus, Template, TemplateInput,
} from "../shared";
import { OWNERS } from "../shared";
import { daysBetween, nowIso, todayIST } from "./dates";

type Row = Record<string, unknown>;

export function rowToTask(r: Row): Task {
  return {
    id: Number(r.id),
    title: String(r.title),
    owner: r.owner as Owner,
    eta: (r.eta as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    status: r.status as TaskStatus,
    sortOrder: Number(r.sort_order),
    templateId: r.template_id == null ? null : Number(r.template_id),
    periodKey: (r.period_key as string | null) ?? null,
    createdAt: String(r.created_at),
    completedAt: (r.completed_at as string | null) ?? null,
  };
}

export function rowToTemplate(r: Row): Template {
  return {
    id: Number(r.id),
    title: String(r.title),
    owner: r.owner as Owner,
    notes: (r.notes as string | null) ?? null,
    cadence: r.cadence as Template["cadence"],
    dueDay: Number(r.due_day),
    active: Number(r.active) === 1,
    createdAt: String(r.created_at),
  };
}

export async function listTasks(db: D1Database): Promise<Task[]> {
  const { results } = await db
    .prepare("SELECT * FROM tasks ORDER BY sort_order ASC, id ASC")
    .all();
  return (results as Row[]).map(rowToTask);
}

async function getTask(db: D1Database, id: number): Promise<Task> {
  const row = await db.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first();
  if (!row) throw new Error(`task ${id} not found`);
  return rowToTask(row as Row);
}

async function nextSortOrder(db: D1Database, owner: Owner, status: TaskStatus): Promise<number> {
  const row = await db
    .prepare("SELECT COALESCE(MAX(sort_order), 0) AS m FROM tasks WHERE owner = ? AND status = ?")
    .bind(owner, status)
    .first<{ m: number }>();
  return (row?.m ?? 0) + 1;
}

export async function createTask(db: D1Database, input: TaskInput): Promise<Task> {
  const sortOrder = await nextSortOrder(db, input.owner, "open");
  const res = await db
    .prepare(
      `INSERT INTO tasks (title, owner, eta, notes, status, sort_order, created_at)
       VALUES (?, ?, ?, ?, 'open', ?, ?)`,
    )
    .bind(input.title, input.owner, input.eta ?? null, input.notes ?? null, sortOrder, nowIso())
    .run();
  return getTask(db, Number(res.meta.last_row_id));
}
```

- [ ] **Step 2: Implement patchTask (handles status→completed_at) + delete + reorder**

Append:

```ts
export async function patchTask(db: D1Database, id: number, patch: TaskPatch): Promise<Task> {
  const cur = await getTask(db, id);
  const sets: string[] = [];
  const vals: unknown[] = [];

  if (patch.title !== undefined) { sets.push("title = ?"); vals.push(patch.title); }
  if (patch.owner !== undefined) { sets.push("owner = ?"); vals.push(patch.owner); }
  if (patch.eta !== undefined) { sets.push("eta = ?"); vals.push(patch.eta); }
  if (patch.notes !== undefined) { sets.push("notes = ?"); vals.push(patch.notes); }
  if (patch.status !== undefined && patch.status !== cur.status) {
    sets.push("status = ?"); vals.push(patch.status);
    if (patch.status === "done") { sets.push("completed_at = ?"); vals.push(nowIso()); }
    else { sets.push("completed_at = NULL"); }
  }
  if (sets.length === 0) return cur;

  vals.push(id);
  await db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).bind(...vals).run();
  return getTask(db, id);
}

export async function deleteTask(db: D1Database, id: number): Promise<void> {
  await db.prepare("DELETE FROM tasks WHERE id = ?").bind(id).run();
}

/** Persist a new top-to-bottom order for one (owner, status) lane. */
export async function reorderTasks(
  db: D1Database, owner: Owner, status: TaskStatus, orderedIds: number[],
): Promise<void> {
  const stmts = orderedIds.map((id, i) =>
    db.prepare("UPDATE tasks SET sort_order = ? WHERE id = ? AND owner = ? AND status = ?")
      .bind(i + 1, id, owner, status),
  );
  if (stmts.length) await db.batch(stmts);
}
```

- [ ] **Step 3: Implement template CRUD**

Append:

```ts
export async function listTemplates(db: D1Database): Promise<Template[]> {
  const { results } = await db
    .prepare("SELECT * FROM recurring_templates ORDER BY id ASC")
    .all();
  return (results as Row[]).map(rowToTemplate);
}

async function getTemplate(db: D1Database, id: number): Promise<Template> {
  const row = await db.prepare("SELECT * FROM recurring_templates WHERE id = ?").bind(id).first();
  if (!row) throw new Error(`template ${id} not found`);
  return rowToTemplate(row as Row);
}

export async function createTemplate(db: D1Database, input: TemplateInput): Promise<Template> {
  const res = await db
    .prepare(
      `INSERT INTO recurring_templates (title, owner, notes, cadence, due_day, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.title, input.owner, input.notes ?? null, input.cadence, input.dueDay,
      input.active === false ? 0 : 1, nowIso(),
    )
    .run();
  return getTemplate(db, Number(res.meta.last_row_id));
}

export async function patchTemplate(
  db: D1Database, id: number, patch: Partial<TemplateInput>,
): Promise<Template> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (patch.title !== undefined) { sets.push("title = ?"); vals.push(patch.title); }
  if (patch.owner !== undefined) { sets.push("owner = ?"); vals.push(patch.owner); }
  if (patch.notes !== undefined) { sets.push("notes = ?"); vals.push(patch.notes); }
  if (patch.cadence !== undefined) { sets.push("cadence = ?"); vals.push(patch.cadence); }
  if (patch.dueDay !== undefined) { sets.push("due_day = ?"); vals.push(patch.dueDay); }
  if (patch.active !== undefined) { sets.push("active = ?"); vals.push(patch.active ? 1 : 0); }
  if (sets.length) {
    vals.push(id);
    await db.prepare(`UPDATE recurring_templates SET ${sets.join(", ")} WHERE id = ?`).bind(...vals).run();
  }
  return getTemplate(db, id);
}

export async function deleteTemplate(db: D1Database, id: number): Promise<void> {
  await db.prepare("DELETE FROM recurring_templates WHERE id = ?").bind(id).run();
}
```

- [ ] **Step 4: Implement computeScoreboard**

Append:

```ts
function emptyScore(owner: Owner): OwnerScore {
  return { owner, scored: 0, onTime: 0, late: 0, avgDaysLate: 0, noEta: 0, onTimePct: null };
}

/** Score over done tasks. A done task with no eta is "noEta" (untracked). */
export async function computeScoreboard(db: D1Database): Promise<Scoreboard> {
  const { results } = await db
    .prepare("SELECT owner, eta, completed_at FROM tasks WHERE status = 'done'")
    .all();
  const acc: Record<Owner, OwnerScore & { _lateSum: number }> = {
    khushi: { ...emptyScore("khushi"), _lateSum: 0 },
    kushal: { ...emptyScore("kushal"), _lateSum: 0 },
  };
  for (const r of results as Row[]) {
    const owner = r.owner as Owner;
    if (owner !== "khushi" && owner !== "kushal") continue;
    const a = acc[owner];
    const eta = r.eta as string | null;
    const completedAt = r.completed_at as string | null;
    if (!eta || !completedAt) { a.noEta += 1; continue; }
    const completedYmd = todayIST(new Date(completedAt));
    const lateBy = daysBetween(eta, completedYmd); // >0 means late
    a.scored += 1;
    if (lateBy <= 0) a.onTime += 1;
    else { a.late += 1; a._lateSum += lateBy; }
  }
  for (const owner of OWNERS) {
    const a = acc[owner];
    a.avgDaysLate = a.late ? Math.round((a._lateSum / a.late) * 10) / 10 : 0;
    a.onTimePct = a.scored ? Math.round((a.onTime / a.scored) * 100) : null;
  }
  return {
    khushi: stripPrivate(acc.khushi),
    kushal: stripPrivate(acc.kushal),
  };
}

function stripPrivate(s: OwnerScore & { _lateSum: number }): OwnerScore {
  const { _lateSum, ...rest } = s;
  return rest;
}
```

- [ ] **Step 5: Build**

```bash
cd apps/founders-tracker && npm run build
```

Expected: compiles clean.

- [ ] **Step 6: Commit**

```bash
git add src/worker/db.ts
git commit -m "feat(founders): d1 query layer + scoreboard"
```

---

## Task 5: Recurring generator

**Files:**
- Create: `apps/founders-tracker/src/worker/recurring.ts`

**Interfaces:**
- Consumes: `listTemplates`, `rowToTask` from `./db`; `todayIST` from `./dates`; types from `../shared`.
- Produces:
  - `periodKey(cadence: Cadence, ymd: string): string` — `'YYYY-MM'` (monthly) or `'YYYY-Www'` (weekly, ISO week).
  - `resolveEta(template: Template, ymd: string): string` — the `'YYYY-MM-DD'` due date for the period containing `ymd`.
  - `runGenerator(db: D1Database): Promise<number>` — idempotently inserts missing instances for today; returns count inserted.

- [ ] **Step 1: Implement period keys + ISO week**

```ts
import type { Cadence, Owner, Template } from "../shared";
import { listTemplates } from "./db";
import { nowIso, todayIST } from "./dates";

function parseYmd(ymd: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split("-").map(Number);
  return { y, m, d };
}

/** ISO week number + ISO week-year for a 'YYYY-MM-DD'. */
function isoWeek(ymd: string): { year: number; week: number } {
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

export function periodKey(cadence: Cadence, ymd: string): string {
  if (cadence === "monthly") return ymd.slice(0, 7); // YYYY-MM
  const { year, week } = isoWeek(ymd);
  return `${year}-W${String(week).padStart(2, "0")}`;
}
```

- [ ] **Step 2: Implement resolveEta (due-day → concrete date)**

Append:

```ts
function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1-based here
}

function pad2(n: number): string { return String(n).padStart(2, "0"); }

/** The 'YYYY-MM-DD' due date for the period that contains `ymd`. */
export function resolveEta(template: Template, ymd: string): string {
  const { y, m, d } = parseYmd(ymd);
  if (template.cadence === "monthly") {
    const day = Math.min(template.dueDay, daysInMonth(y, m));
    return `${y}-${pad2(m)}-${pad2(day)}`;
  }
  // weekly: dueDay 0=Mon … 6=Sun. Find that weekday within the current ISO week.
  const date = new Date(Date.UTC(y, m - 1, d));
  const cur = (date.getUTCDay() + 6) % 7; // 0=Mon … 6=Sun for today
  date.setUTCDate(date.getUTCDate() + (template.dueDay - cur));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}
```

- [ ] **Step 3: Implement runGenerator (idempotent insert)**

Append:

```ts
async function ownerOpenMaxSort(db: D1Database, owner: Owner): Promise<number> {
  const row = await db
    .prepare("SELECT COALESCE(MAX(sort_order), 0) AS m FROM tasks WHERE owner = ? AND status = 'open'")
    .bind(owner)
    .first<{ m: number }>();
  return (row?.m ?? 0) + 1;
}

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
    const sort = await ownerOpenMaxSort(db, t.owner);
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

- [ ] **Step 4: Build**

```bash
cd apps/founders-tracker && npm run build
```

Expected: compiles clean. Note the unused `rowToTask` import was avoided; `Owner` and `nowIso`/`todayIST` are used. Remove any genuinely unused import if `tsc` flags it.

- [ ] **Step 5: Commit**

```bash
git add src/worker/recurring.ts
git commit -m "feat(founders): recurring task generator"
```

---

## Task 6: Auth gate (PIN cookie + login page)

**Files:**
- Create: `apps/founders-tracker/src/worker/auth.ts`

**Interfaces:**
- Consumes: `Env` (from `index.ts`, redefined here as `AuthEnv` to avoid a cycle — see note).
- Produces:
  - `signSession(secret: string): Promise<string>` — HMAC token value for the cookie.
  - `verifySession(token: string | undefined, secret: string): Promise<boolean>`
  - `loginPage(error?: boolean): string` — full HTML login page.
  - `requireAuth` — Hono middleware that 401s API calls and redirects shell requests to `/login` when the cookie is missing/invalid.

- [ ] **Step 1: Implement HMAC sign/verify (Web Crypto)**

```ts
import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";

interface AuthEnv {
  Bindings: { APP_PIN: string; SESSION_SECRET: string };
}

const COOKIE = "founders_session";

async function hmac(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Token = "ok.<hmac(secret,'ok')>". Stateless; rotating SESSION_SECRET logs everyone out. */
export async function signSession(secret: string): Promise<string> {
  return `ok.${await hmac(secret, "ok")}`;
}

export async function verifySession(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false;
  const expected = await signSession(secret);
  // constant-time-ish compare
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export { COOKIE };
```

- [ ] **Step 2: Implement the login page HTML**

Append:

```ts
export function loginPage(error = false): string {
  return `<!doctype html><html lang="en"><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<title>Founders Tracker</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0d12;
    font-family:system-ui,sans-serif;color:#e7e9ee}
  form{display:grid;gap:14px;width:260px;padding:28px;border:1px solid #232838;
    border-radius:16px;background:#11141c}
  h1{font-size:18px;margin:0 0 4px;text-align:center}
  input{padding:12px;border-radius:10px;border:1px solid #2a3146;background:#0b0d12;
    color:#fff;font-size:16px;text-align:center;letter-spacing:4px}
  button{padding:12px;border:0;border-radius:10px;background:#3b82f6;color:#fff;
    font-size:15px;font-weight:600}
  .err{color:#f87171;font-size:13px;text-align:center;min-height:16px}
</style></head><body>
<form method="POST" action="/login">
  <h1>🚀 Founders Tracker</h1>
  <input name="pin" type="password" inputmode="numeric" placeholder="PIN" autofocus/>
  <div class="err">${error ? "Wrong PIN" : ""}</div>
  <button type="submit">Enter</button>
</form></body></html>`;
}
```

- [ ] **Step 3: Implement requireAuth middleware**

Append:

```ts
export async function requireAuth(c: Context<AuthEnv>, next: Next): Promise<Response | void> {
  const ok = await verifySession(getCookie(c, COOKIE), c.env.SESSION_SECRET);
  if (ok) return next();
  if (c.req.path.startsWith("/api/")) return c.json({ error: "unauthorized" }, 401);
  return c.redirect("/login", 302);
}
```

- [ ] **Step 4: Build**

```bash
cd apps/founders-tracker && npm run build
```

Expected: compiles clean.

- [ ] **Step 5: Commit**

```bash
git add src/worker/auth.ts
git commit -m "feat(founders): pin cookie auth + login page"
```

---

## Task 7: Wire the Hono app (routes + auth + scheduled handler)

**Files:**
- Modify: `apps/founders-tracker/src/worker/index.ts`

**Interfaces:**
- Consumes: everything from `./db`, `./recurring`, `./auth`; types from `../shared`.
- Produces: the default export — a Worker with `fetch` (Hono) and `scheduled` (cron → generator) handlers, all data routes behind `requireAuth`.

- [ ] **Step 1: Replace index.ts with the full app**

```ts
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { COOKIE, loginPage, requireAuth, signSession, verifySession } from "./auth";
import {
  computeScoreboard, createTask, createTemplate, deleteTask, deleteTemplate,
  listTasks, listTemplates, patchTask, patchTemplate, reorderTasks,
} from "./db";
import { runGenerator } from "./recurring";
import type { Owner, TaskInput, TaskPatch, TaskStatus, TemplateInput } from "../shared";

export interface Env {
  DB: D1Database;
  APP_PIN: string;
  SESSION_SECRET: string;
  ASSETS: { fetch: typeof fetch };
}

const app = new Hono<{ Bindings: Env }>();

// ---- Auth ------------------------------------------------------------------
app.get("/login", (c) => c.html(loginPage()));

app.post("/login", async (c) => {
  const body = await c.req.parseBody();
  const pin = String(body.pin ?? "");
  if (pin && pin === c.env.APP_PIN) {
    setCookie(c, COOKIE, await signSession(c.env.SESSION_SECRET), {
      httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: 60 * 60 * 24 * 365,
    });
    return c.redirect("/", 302);
  }
  return c.html(loginPage(true), 401);
});

// ---- Gate everything below -------------------------------------------------
app.use("/api/*", requireAuth);

// ---- Tasks -----------------------------------------------------------------
app.get("/api/bootstrap", async (c) => {
  // Backstop: also materialize recurring tasks on load.
  await runGenerator(c.env.DB).catch((e) => console.error("on-load generator:", e));
  const [tasks, templates, scoreboard] = await Promise.all([
    listTasks(c.env.DB), listTemplates(c.env.DB), computeScoreboard(c.env.DB),
  ]);
  return c.json({ tasks, templates, scoreboard });
});

app.post("/api/tasks", async (c) => {
  const input = await c.req.json<TaskInput>();
  if (!input.title?.trim()) return c.json({ error: "Title required" }, 400);
  return c.json(await createTask(c.env.DB, input));
});

app.patch("/api/tasks/reorder", async (c) => {
  const { owner, status, orderedIds } =
    await c.req.json<{ owner: Owner; status: TaskStatus; orderedIds: number[] }>();
  await reorderTasks(c.env.DB, owner, status, orderedIds);
  return c.json({ ok: true });
});

app.patch("/api/tasks/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const patch = await c.req.json<TaskPatch>();
  return c.json(await patchTask(c.env.DB, id, patch));
});

app.delete("/api/tasks/:id", async (c) => {
  await deleteTask(c.env.DB, Number(c.req.param("id")));
  return c.json({ ok: true });
});

// ---- Templates -------------------------------------------------------------
app.get("/api/templates", async (c) => c.json(await listTemplates(c.env.DB)));

app.post("/api/templates", async (c) => {
  const input = await c.req.json<TemplateInput>();
  if (!input.title?.trim()) return c.json({ error: "Title required" }, 400);
  return c.json(await createTemplate(c.env.DB, input));
});

app.patch("/api/templates/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const patch = await c.req.json<Partial<TemplateInput>>();
  return c.json(await patchTemplate(c.env.DB, id, patch));
});

app.delete("/api/templates/:id", async (c) => {
  await deleteTemplate(c.env.DB, Number(c.req.param("id")));
  return c.json({ ok: true });
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: String(err?.message ?? err) }, 500);
});

// ---- Worker entry: fetch (Hono) + scheduled (cron generator) ---------------
export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    const n = await runGenerator(env.DB);
    console.log(`generator inserted ${n} task(s)`);
  },
};
```

- [ ] **Step 2: Build**

```bash
cd apps/founders-tracker && npm run build
```

Expected: compiles clean.

- [ ] **Step 3: Manual verification — API end-to-end locally**

```bash
npm run dev
```

In another shell (use the port Vite prints, assume 5173):

```bash
# unauthenticated API call is rejected
curl -s -o /dev/null -w "%{http_code}\n" localhost:5173/api/bootstrap   # expect 401
# login, capture cookie
curl -s -c /tmp/fc.txt -d "pin=changeme" localhost:5173/login -o /dev/null -w "%{http_code}\n" # expect 302
# authed bootstrap
curl -s -b /tmp/fc.txt localhost:5173/api/bootstrap                     # expect JSON with tasks/templates/scoreboard
# create a task
curl -s -b /tmp/fc.txt -H 'content-type: application/json' \
  -d '{"title":"Test task","owner":"kushal","eta":null}' localhost:5173/api/tasks
```

Expected: 401 then 302 then a JSON bootstrap with empty arrays + empty scoreboard, then a created task with `"eta":null`. Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/worker/index.ts
git commit -m "feat(founders): wire hono routes + auth gate + cron handler"
```

---

## Task 8: Client API + date helpers

**Files:**
- Create: `apps/founders-tracker/src/client/api.ts`, `apps/founders-tracker/src/client/dates.ts`

**Interfaces:**
- Produces:
  - `api` object: `bootstrap()`, `createTask(input)`, `patchTask(id, patch)`, `deleteTask(id)`, `reorder(owner, status, orderedIds)`, `listTemplates()`, `createTemplate(input)`, `patchTemplate(id, patch)`, `deleteTemplate(id)`.
  - `BootstrapData { tasks: Task[]; templates: Template[]; scoreboard: Scoreboard }`.
  - dates: `todayIST(): string`, `daysLeft(eta: string): number`, `etaUrgency(daysLeft): 'green'|'amber'|'red'|'overdue'`, `fmtEta(eta: string): string`.

- [ ] **Step 1: Write client dates.ts**

```ts
const TZ = "Asia/Kolkata";

export function todayIST(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

/** Whole days from today (IST) to the eta date. Negative = overdue. */
export function daysLeft(eta: string): number {
  const a = Date.parse(`${todayIST()}T12:00:00Z`);
  const b = Date.parse(`${eta}T12:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export type Urgency = "green" | "amber" | "red" | "overdue";

export function etaUrgency(d: number): Urgency {
  if (d < 0) return "overdue";
  if (d <= 2) return "red";
  if (d <= 7) return "amber";
  return "green";
}

export function fmtEta(eta: string): string {
  const d = new Date(`${eta}T12:00:00Z`);
  return d.toLocaleDateString("en-GB", {
    timeZone: TZ, day: "numeric", month: "short", year: "numeric",
  });
}
```

- [ ] **Step 2: Write client api.ts**

```ts
import type {
  Scoreboard, Task, TaskInput, TaskPatch, TaskStatus, Template, TemplateInput, Owner,
} from "../shared";

export interface BootstrapData {
  tasks: Task[];
  templates: Template[];
  scoreboard: Scoreboard;
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { window.location.href = "/login"; throw new Error("unauthorized"); }
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error ?? msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  bootstrap: () => req<BootstrapData>("GET", "/bootstrap"),
  createTask: (input: TaskInput) => req<Task>("POST", "/tasks", input),
  patchTask: (id: number, patch: TaskPatch) => req<Task>("PATCH", `/tasks/${id}`, patch),
  deleteTask: (id: number) => req<{ ok: true }>("DELETE", `/tasks/${id}`),
  reorder: (owner: Owner, status: TaskStatus, orderedIds: number[]) =>
    req<{ ok: true }>("PATCH", "/tasks/reorder", { owner, status, orderedIds }),
  listTemplates: () => req<Template[]>("GET", "/templates"),
  createTemplate: (input: TemplateInput) => req<Template>("POST", "/templates", input),
  patchTemplate: (id: number, patch: Partial<TemplateInput>) =>
    req<Template>("PATCH", `/templates/${id}`, patch),
  deleteTemplate: (id: number) => req<{ ok: true }>("DELETE", `/templates/${id}`),
};
```

- [ ] **Step 3: Build**

```bash
cd apps/founders-tracker && npm run build
```

Expected: compiles clean.

- [ ] **Step 4: Commit**

```bash
git add src/client/api.ts src/client/dates.ts
git commit -m "feat(founders): client api + date helpers"
```

---

## Task 9: Styles (theme, hazard stripes, countdown colors)

**Files:**
- Modify: `apps/founders-tracker/src/client/index.css`

**Interfaces:**
- Produces: CSS classes used by later components: `.app`, `.tabbar`, `.tab`, `.tab.active`, `.alarm`, `.scoreboard`, `.scorecard`, `.leading`, `.card`, `.card.hazard`, `.handle`, `.countdown`, `.bar`, `.bar.green/.amber/.red/.overdue`, `.done-section`, `.btn`, `.btn-primary`, `.field`, `.pill`.

- [ ] **Step 1: Write the stylesheet**

```css
:root {
  --bg: #0b0d12; --panel: #11141c; --line: #232838; --ink: #e7e9ee;
  --muted: #9aa3b2; --blue: #3b82f6;
  --green: #22c55e; --amber: #f59e0b; --red: #ef4444; --overdue: #7f1d1d;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink);
  font-family: system-ui, -apple-system, sans-serif; }
.app { max-width: 680px; margin: 0 auto; padding: 16px 14px 80px; }

.topbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.topbar h1 { font-size: 18px; margin: 0; }
.alarm { background: #2a1212; color: #fca5a5; border: 1px solid #7f1d1d;
  padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 600;
  animation: pulse 1.4s ease-in-out infinite; }
.alarm.hidden { display: none; }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .45; } }

.btn { border: 1px solid var(--line); background: var(--panel); color: var(--ink);
  padding: 9px 12px; border-radius: 10px; font-size: 14px; cursor: pointer; }
.btn-primary { background: var(--blue); border-color: var(--blue); color: #fff; font-weight: 600; }

.tabbar { display: flex; gap: 6px; margin: 14px 0; }
.tab { flex: 1; text-align: center; padding: 10px; border-radius: 10px;
  background: var(--panel); border: 1px solid var(--line); color: var(--muted);
  font-weight: 600; cursor: pointer; }
.tab.active { color: #fff; border-color: var(--blue); }

.scoreboard { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
.scorecard { background: var(--panel); border: 1px solid var(--line); border-radius: 14px;
  padding: 14px; text-align: center; position: relative; }
.scorecard .pct { font-size: 30px; font-weight: 800; }
.scorecard .who { font-size: 12px; color: var(--muted); text-transform: uppercase;
  letter-spacing: 1px; }
.scorecard .stats { margin-top: 8px; font-size: 12px; color: var(--muted); line-height: 1.7; }
.scorecard.leading { border-color: var(--green); }
.scorecard .crown { position: absolute; top: -10px; right: 10px; font-size: 16px; }

.card { background: var(--panel); border: 1px solid var(--line); border-radius: 12px;
  padding: 12px; margin-bottom: 10px; display: flex; gap: 10px; align-items: flex-start; }
.card .handle { cursor: grab; color: var(--muted); font-size: 18px; line-height: 1;
  padding-top: 2px; touch-action: none; }
.card .body { flex: 1; min-width: 0; }
.card .title { font-weight: 600; }
.card .notes { font-size: 13px; color: var(--muted); margin-top: 2px; white-space: pre-wrap; }
.card.done .title { text-decoration: line-through; color: var(--muted); }

.countdown { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 12px; }
.countdown .date { color: var(--muted); }
.bar { flex: 1; height: 6px; border-radius: 999px; background: #1b2030; overflow: hidden; }
.bar > span { display: block; height: 100%; }
.bar.green > span { background: var(--green); }
.bar.amber > span { background: var(--amber); }
.bar.red > span { background: var(--red); }
.bar.overdue > span { background: var(--overdue); width: 100% !important; }
.days { font-weight: 700; white-space: nowrap; }
.days.green { color: var(--green); } .days.amber { color: var(--amber); }
.days.red { color: var(--red); } .days.overdue { color: #fca5a5; }

/* Hazard card: missing ETA */
.card.hazard {
  border: 2px solid transparent;
  background:
    linear-gradient(var(--panel), var(--panel)) padding-box,
    repeating-linear-gradient(45deg, #ef4444 0 10px, #111 10px 20px) border-box;
}
.card.hazard .banner { color: #fca5a5; font-weight: 800; font-size: 12px;
  letter-spacing: .5px; animation: pulse 1.4s ease-in-out infinite; }
.card.hazard .body { opacity: .85; }

.done-section { margin-top: 18px; border-top: 1px solid var(--line); padding-top: 12px; }
.done-head { color: var(--muted); font-size: 13px; cursor: pointer; user-select: none; }

.field { display: grid; gap: 4px; margin-bottom: 10px; }
.field label { font-size: 12px; color: var(--muted); }
.field input, .field textarea, .field select {
  padding: 10px; border-radius: 9px; border: 1px solid var(--line);
  background: var(--bg); color: var(--ink); font-size: 15px; }
.row { display: flex; gap: 8px; }
.pill { padding: 6px 10px; border-radius: 999px; border: 1px solid var(--line);
  background: var(--bg); color: var(--muted); cursor: pointer; font-size: 13px; }
.pill.on { border-color: var(--blue); color: #fff; }

.modal-back { position: fixed; inset: 0; background: rgba(0,0,0,.55);
  display: grid; place-items: end center; }
.modal { background: var(--panel); width: 100%; max-width: 680px; border-radius: 16px 16px 0 0;
  padding: 18px 16px 28px; border: 1px solid var(--line); }
```

- [ ] **Step 2: Build + eyeball**

```bash
cd apps/founders-tracker && npm run build
```

Expected: compiles. Visual correctness is verified in later component tasks.

- [ ] **Step 3: Commit**

```bash
git add src/client/index.css
git commit -m "feat(founders): styles incl hazard + countdown"
```

---

## Task 10: TaskCard + Scoreboard components

**Files:**
- Create: `apps/founders-tracker/src/client/TaskCard.tsx`, `apps/founders-tracker/src/client/Scoreboard.tsx`

**Interfaces:**
- Consumes: `Task`, `Scoreboard`, `OwnerScore` from `../shared`; `daysLeft`, `etaUrgency`, `fmtEta` from `./dates`.
- Produces:
  - `<TaskCard task onToggleDone onSetEta onDelete dragHandle? />` — renders normal/hazard/done variants.
  - `<Scoreboard data: Scoreboard />`.

- [ ] **Step 1: Write TaskCard.tsx**

```tsx
import type { Task } from "../shared";
import { daysLeft, etaUrgency, fmtEta } from "./dates";

interface Props {
  task: Task;
  onToggleDone: (t: Task) => void;
  onSetEta: (t: Task) => void;
  onDelete: (t: Task) => void;
  /** dnd-kit listeners for the drag handle; omitted for done cards. */
  handleProps?: Record<string, unknown>;
}

export function TaskCard({ task, onToggleDone, onSetEta, onDelete, handleProps }: Props) {
  const hazard = task.status === "open" && !task.eta;

  return (
    <div className={`card ${hazard ? "hazard" : ""} ${task.status === "done" ? "done" : ""}`}>
      {task.status === "open" && (
        <div className="handle" {...handleProps} aria-label="drag">⠿</div>
      )}
      <input
        type="checkbox"
        checked={task.status === "done"}
        onChange={() => onToggleDone(task)}
        aria-label="done"
      />
      <div className="body">
        {hazard && <div className="banner">⚠ NO DEADLINE SET</div>}
        <div className="title">{task.title}</div>
        {task.notes && <div className="notes">{task.notes}</div>}
        {hazard ? (
          <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => onSetEta(task)}>
            SET AN ETA
          </button>
        ) : task.eta ? (
          <Countdown eta={task.eta} />
        ) : null}
      </div>
      <button className="btn" onClick={() => onDelete(task)} aria-label="delete">✕</button>
    </div>
  );
}

function Countdown({ eta }: { eta: string }) {
  const d = daysLeft(eta);
  const u = etaUrgency(d);
  // fill: 100% at >=14 days out, shrinking toward the deadline.
  const fill = u === "overdue" ? 100 : Math.max(8, Math.min(100, Math.round((d / 14) * 100)));
  const label = d < 0 ? "OVERDUE" : d === 0 ? "DUE TODAY" : `${d} DAY${d === 1 ? "" : "S"} LEFT`;
  return (
    <div className="countdown">
      <span className="date">📅 {fmtEta(eta)}</span>
      <span className={`bar ${u}`}><span style={{ width: `${fill}%` }} /></span>
      <span className={`days ${u}`}>{label}</span>
    </div>
  );
}
```

- [ ] **Step 2: Write Scoreboard.tsx**

```tsx
import type { OwnerScore, Scoreboard as ScoreboardData } from "../shared";

export function Scoreboard({ data }: { data: ScoreboardData }) {
  const lead =
    (data.khushi.onTimePct ?? -1) === (data.kushal.onTimePct ?? -1)
      ? null
      : (data.khushi.onTimePct ?? -1) > (data.kushal.onTimePct ?? -1)
        ? "khushi"
        : "kushal";
  return (
    <div className="scoreboard">
      <ScoreCard score={data.khushi} label="Khushi" leading={lead === "khushi"} />
      <ScoreCard score={data.kushal} label="Kushal" leading={lead === "kushal"} />
    </div>
  );
}

function ScoreCard({ score, label, leading }: { score: OwnerScore; label: string; leading: boolean }) {
  return (
    <div className={`scorecard ${leading ? "leading" : ""}`}>
      {leading && <div className="crown">👑</div>}
      <div className="pct">{score.onTimePct === null ? "—" : `${score.onTimePct}%`}</div>
      <div className="who">{label} · on time</div>
      <div className="stats">
        ✅ {score.onTime} on time · ⏰ {score.late} late<br />
        avg {score.avgDaysLate}d late<br />
        ⚠ {score.noEta} done w/o ETA
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build**

```bash
cd apps/founders-tracker && npm run build
```

Expected: compiles clean.

- [ ] **Step 4: Commit**

```bash
git add src/client/TaskCard.tsx src/client/Scoreboard.tsx
git commit -m "feat(founders): task card + scoreboard components"
```

---

## Task 11: TaskList (dnd-kit sortable + Done section)

**Files:**
- Create: `apps/founders-tracker/src/client/TaskList.tsx`

**Interfaces:**
- Consumes: `Task`, `Owner` from `../shared`; `TaskCard` from `./TaskCard`; `@dnd-kit/*`.
- Produces: `<TaskList owner tasks onReorder onToggleDone onSetEta onDelete />` where `tasks` is that owner's full list (open + done); the component splits them, renders open ones sortable, done ones in a collapsible section.

- [ ] **Step 1: Write TaskList.tsx**

```tsx
import { useState } from "react";
import {
  DndContext, PointerSensor, closestCenter, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Owner, Task } from "../shared";
import { TaskCard } from "./TaskCard";

interface Props {
  owner: Owner;
  tasks: Task[];
  onReorder: (owner: Owner, orderedIds: number[]) => void;
  onToggleDone: (t: Task) => void;
  onSetEta: (t: Task) => void;
  onDelete: (t: Task) => void;
}

export function TaskList({ owner, tasks, onReorder, onToggleDone, onSetEta, onDelete }: Props) {
  const open = tasks.filter((t) => t.status === "open").sort((a, b) => a.sortOrder - b.sortOrder);
  const done = tasks.filter((t) => t.status === "done")
    .sort((a, b) => (a.completedAt ?? "") < (b.completedAt ?? "") ? 1 : -1);
  const [showDone, setShowDone] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const ids = open.map((t) => t.id);

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(Number(active.id));
    const to = ids.indexOf(Number(over.id));
    if (from < 0 || to < 0) return;
    onReorder(owner, arrayMove(ids, from, to));
  }

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {open.map((t) => (
            <SortableRow key={t.id} task={t}
              onToggleDone={onToggleDone} onSetEta={onSetEta} onDelete={onDelete} />
          ))}
        </SortableContext>
      </DndContext>
      {open.length === 0 && <p style={{ color: "var(--muted)" }}>No open tasks.</p>}

      {done.length > 0 && (
        <div className="done-section">
          <div className="done-head" onClick={() => setShowDone((v) => !v)}>
            {showDone ? "▾" : "▸"} Done ({done.length})
          </div>
          {showDone && done.map((t) => (
            <TaskCard key={t.id} task={t}
              onToggleDone={onToggleDone} onSetEta={onSetEta} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function SortableRow({ task, onToggleDone, onSetEta, onDelete }: {
  task: Task;
  onToggleDone: (t: Task) => void;
  onSetEta: (t: Task) => void;
  onDelete: (t: Task) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  return (
    <div ref={setNodeRef} style={style}>
      <TaskCard task={task} handleProps={{ ...attributes, ...listeners }}
        onToggleDone={onToggleDone} onSetEta={onSetEta} onDelete={onDelete} />
    </div>
  );
}
```

- [ ] **Step 2: Build**

```bash
cd apps/founders-tracker && npm run build
```

Expected: compiles clean.

- [ ] **Step 3: Commit**

```bash
git add src/client/TaskList.tsx
git commit -m "feat(founders): sortable task list + done section"
```

---

## Task 12: AddTaskForm + RecurringScreen

**Files:**
- Create: `apps/founders-tracker/src/client/AddTaskForm.tsx`, `apps/founders-tracker/src/client/RecurringScreen.tsx`

**Interfaces:**
- Consumes: types from `../shared`; `api` from `./api`.
- Produces:
  - `<AddTaskForm onClose onCreated />` — modal; creates a manual task.
  - `<RecurringScreen templates onChanged />` — lists templates + CRUD via `api`.

- [ ] **Step 1: Write AddTaskForm.tsx**

```tsx
import { useState } from "react";
import type { Owner, Task } from "../shared";
import { api } from "./api";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function AddTaskForm({ onClose, onCreated }: {
  onClose: () => void; onCreated: (t: Task) => void;
}) {
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState<Owner>("kushal");
  const [eta, setEta] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      const t = await api.createTask({ title: title.trim(), owner, eta: eta || null, notes: notes || null });
      onCreated(t);
      onClose();
    } catch (e) { alert(String(e)); setBusy(false); }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="field">
          <label>Title</label>
          <input value={title} autoFocus onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>Owner</label>
          <div className="row">
            {(["khushi", "kushal"] as Owner[]).map((o) => (
              <button key={o} className={`pill ${owner === o ? "on" : ""}`} onClick={() => setOwner(o)}>
                {o[0].toUpperCase() + o.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>ETA (optional — leave blank for none)</label>
          <input type="date" value={eta} onChange={(e) => setEta(e.target.value)} />
        </div>
        <div className="field">
          <label>Notes</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="row">
          <button className="btn" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 2 }} disabled={busy} onClick={submit}>
            Add task
          </button>
        </div>
      </div>
    </div>
  );
}

export { DOW };
```

- [ ] **Step 2: Write RecurringScreen.tsx**

```tsx
import { useState } from "react";
import type { Cadence, Owner, Template, TemplateInput } from "../shared";
import { api } from "./api";
import { DOW } from "./AddTaskForm";

function dueLabel(t: Template): string {
  if (t.cadence === "weekly") return `every ${DOW[t.dueDay] ?? "?"}`;
  const n = t.dueDay;
  const suff = n === 1 || n === 21 || n === 31 ? "st" : n === 2 || n === 22 ? "nd" : n === 3 || n === 23 ? "rd" : "th";
  return `the ${n}${suff}`;
}

export function RecurringScreen({ templates, onChanged }: {
  templates: Template[]; onChanged: () => void;
}) {
  const [editing, setEditing] = useState<Template | "new" | null>(null);

  async function toggleActive(t: Template) {
    await api.patchTemplate(t.id, { active: !t.active });
    onChanged();
  }
  async function remove(t: Template) {
    if (!confirm(`Delete repeat job "${t.title}"? Already-generated tasks stay.`)) return;
    await api.deleteTemplate(t.id);
    onChanged();
  }

  return (
    <div>
      <div className="topbar" style={{ marginBottom: 12 }}>
        <h1>Repeat jobs</h1>
        <button className="btn btn-primary" onClick={() => setEditing("new")}>+ New</button>
      </div>
      {templates.length === 0 && <p style={{ color: "var(--muted)" }}>No repeat jobs yet.</p>}
      {templates.map((t) => (
        <div className="card" key={t.id}>
          <div className="body">
            <div className="title">{t.title} {!t.active && <span style={{ color: "var(--muted)" }}>(paused)</span>}</div>
            <div className="notes">
              {t.owner[0].toUpperCase() + t.owner.slice(1)} · {t.cadence} · due {dueLabel(t)}
            </div>
          </div>
          <button className="btn" onClick={() => toggleActive(t)}>{t.active ? "Pause" : "Resume"}</button>
          <button className="btn" onClick={() => setEditing(t)}>Edit</button>
          <button className="btn" onClick={() => remove(t)}>✕</button>
        </div>
      ))}
      {editing && (
        <TemplateForm
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChanged(); }}
        />
      )}
    </div>
  );
}

function TemplateForm({ initial, onClose, onSaved }: {
  initial: Template | null; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [owner, setOwner] = useState<Owner>(initial?.owner ?? "kushal");
  const [cadence, setCadence] = useState<Cadence>(initial?.cadence ?? "monthly");
  const [dueDay, setDueDay] = useState<number>(initial?.dueDay ?? (initial?.cadence === "weekly" ? 4 : 1));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!title.trim() || busy) return;
    setBusy(true);
    const input: TemplateInput = { title: title.trim(), owner, cadence, dueDay, notes: notes || null };
    try {
      if (initial) await api.patchTemplate(initial.id, input);
      else await api.createTemplate(input);
      onSaved();
    } catch (e) { alert(String(e)); setBusy(false); }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="field">
          <label>Title</label>
          <input value={title} autoFocus onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>Owner</label>
          <div className="row">
            {(["khushi", "kushal"] as Owner[]).map((o) => (
              <button key={o} className={`pill ${owner === o ? "on" : ""}`} onClick={() => setOwner(o)}>
                {o[0].toUpperCase() + o.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Cadence</label>
          <div className="row">
            {(["monthly", "weekly"] as Cadence[]).map((cd) => (
              <button key={cd} className={`pill ${cadence === cd ? "on" : ""}`}
                onClick={() => { setCadence(cd); setDueDay(cd === "weekly" ? 4 : 1); }}>
                {cd}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>{cadence === "weekly" ? "Due weekday" : "Due day of month (1–31)"}</label>
          {cadence === "weekly" ? (
            <select value={dueDay} onChange={(e) => setDueDay(Number(e.target.value))}>
              {DOW.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          ) : (
            <input type="number" min={1} max={31} value={dueDay}
              onChange={(e) => setDueDay(Math.max(1, Math.min(31, Number(e.target.value) || 1)))} />
          )}
        </div>
        <div className="field">
          <label>Notes</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="row">
          <button className="btn" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 2 }} disabled={busy} onClick={save}>
            {initial ? "Save" : "Create repeat job"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build**

```bash
cd apps/founders-tracker && npm run build
```

Expected: compiles clean.

- [ ] **Step 4: Commit**

```bash
git add src/client/AddTaskForm.tsx src/client/RecurringScreen.tsx
git commit -m "feat(founders): add-task form + recurring screen"
```

---

## Task 13: App shell (tabs, screens, data flow, set-ETA)

**Files:**
- Modify: `apps/founders-tracker/src/client/App.tsx`

**Interfaces:**
- Consumes: all client components, `api`, `BootstrapData`, types.
- Produces: the assembled SPA — Tracker screen (alarm badge, scoreboard, two tabs, list, add button) and Recurring screen, with optimistic done/reorder and an inline set-ETA prompt.

- [ ] **Step 1: Write App.tsx**

```tsx
import { useEffect, useMemo, useState } from "react";
import type { Owner, Task } from "../shared";
import { api, type BootstrapData } from "./api";
import { Scoreboard } from "./Scoreboard";
import { TaskList } from "./TaskList";
import { AddTaskForm } from "./AddTaskForm";
import { RecurringScreen } from "./RecurringScreen";

type Screen = "tracker" | "recurring";

export function App() {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("tracker");
  const [tab, setTab] = useState<Owner>("kushal");
  const [adding, setAdding] = useState(false);

  async function reload() {
    try { setData(await api.bootstrap()); } catch (e) { setErr(String(e)); }
  }
  useEffect(() => { reload(); }, []);

  const noEtaCount = useMemo(
    () => data?.tasks.filter((t) => t.status === "open" && !t.eta).length ?? 0,
    [data],
  );

  if (err) return <div className="app"><p style={{ color: "#f87171" }}>{err}</p></div>;
  if (!data) return <div className="app"><p style={{ color: "var(--muted)" }}>Loading…</p></div>;

  const ownTasks = data.tasks.filter((t) => t.owner === tab);

  async function patchAndReload(id: number, patch: Parameters<typeof api.patchTask>[1]) {
    await api.patchTask(id, patch);
    await reload();
  }
  function toggleDone(t: Task) {
    patchAndReload(t.id, { status: t.status === "done" ? "open" : "done" });
  }
  function setEta(t: Task) {
    const v = prompt("Set ETA (YYYY-MM-DD), blank to clear:", t.eta ?? "");
    if (v === null) return;
    patchAndReload(t.id, { eta: v.trim() || null });
  }
  async function del(t: Task) {
    if (!confirm(`Delete "${t.title}"?`)) return;
    await api.deleteTask(t.id);
    await reload();
  }
  async function reorder(owner: Owner, orderedIds: number[]) {
    // optimistic: apply locally, then persist
    setData((d) => {
      if (!d) return d;
      const order = new Map(orderedIds.map((id, i) => [id, i + 1]));
      return { ...d, tasks: d.tasks.map((t) => order.has(t.id) ? { ...t, sortOrder: order.get(t.id)! } : t) };
    });
    try { await api.reorder(owner, "open", orderedIds); } catch (e) { setErr(String(e)); }
  }

  return (
    <div className="app">
      <div className="topbar">
        <h1>🚀 Founders Tracker</h1>
        <div className="row">
          <span className={`alarm ${noEtaCount === 0 ? "hidden" : ""}`}>⚠ {noEtaCount} no ETA</span>
          <button className="btn" onClick={() => setScreen(screen === "tracker" ? "recurring" : "tracker")}>
            {screen === "tracker" ? "↻ Repeat jobs" : "← Tracker"}
          </button>
        </div>
      </div>

      {screen === "recurring" ? (
        <RecurringScreen templates={data.templates} onChanged={reload} />
      ) : (
        <>
          <Scoreboard data={data.scoreboard} />
          <div className="tabbar">
            {(["khushi", "kushal"] as Owner[]).map((o) => {
              const openCount = data.tasks.filter((t) => t.owner === o && t.status === "open").length;
              return (
                <div key={o} className={`tab ${tab === o ? "active" : ""}`} onClick={() => setTab(o)}>
                  {o[0].toUpperCase() + o.slice(1)} ({openCount})
                </div>
              );
            })}
          </div>
          <TaskList owner={tab} tasks={ownTasks}
            onReorder={reorder} onToggleDone={toggleDone} onSetEta={setEta} onDelete={del} />
          <button className="btn btn-primary" style={{ position: "fixed", right: 18, bottom: 18, borderRadius: 999, padding: "14px 18px" }}
            onClick={() => setAdding(true)}>+ Add</button>
        </>
      )}

      {adding && <AddTaskForm onClose={() => setAdding(false)} onCreated={reload} />}
    </div>
  );
}
```

- [ ] **Step 2: Build**

```bash
cd apps/founders-tracker && npm run build
```

Expected: compiles clean.

- [ ] **Step 3: Manual verification — full flow in the browser**

```bash
npm run dev
```

Open the printed localhost URL. Verify:
- Redirected to `/login`; entering PIN `changeme` lands on the tracker.
- `+ Add` → create a task **with no ETA** for Kushal → it shows the **hazard card** and the header shows `⚠ 1 no ETA`.
- `SET AN ETA` on that card (enter a date ~5 days out) → hazard turns into an amber countdown; header alarm hides.
- Add another task with an ETA 1 day out → red; 20 days out → green; a past date → OVERDUE.
- Drag to reorder two open tasks → order persists after refresh.
- Check a task done → moves into `Done (N)`; scoreboard updates (on-time if completed ≤ eta).
- Switch to **Khushi** tab → independent list.
- `↻ Repeat jobs` → create a monthly (due day 1) and a weekly (due Fri) job for each owner → reload tracker; confirm a generated task appears under the right owner with the right ETA, exactly once even after another refresh.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/client/App.tsx
git commit -m "feat(founders): app shell + screens + data flow"
```

---

## Task 14: Deploy (D1 remote, secrets, domain, cron) + README

**Files:**
- Modify: `apps/founders-tracker/wrangler.jsonc` (real `database_id`)
- Create: `apps/founders-tracker/README.md`
- Reference: `INFRA.md`, `my-hosted-sites.md` (add the new site)

**Interfaces:**
- Produces: the live app at `https://founders.agrolloo.com`.

- [ ] **Step 1: Create the remote D1 database and apply schema**

```bash
cd apps/founders-tracker
wrangler d1 create founders-db
```

Copy the printed `database_id` into `wrangler.jsonc` (replace `PLACEHOLDER_SET_IN_TASK_12`). Then:

```bash
npm run db:remote
```

Expected: schema applied to the remote DB.

- [ ] **Step 2: Set secrets**

```bash
wrangler secret put APP_PIN        # enter the shared PIN
wrangler secret put SESSION_SECRET # enter a long random string
```

- [ ] **Step 3: Add the DNS record for the custom domain**

`founders.agrolloo.com` must resolve to the Worker. Use the existing pattern (custom_domain route in wrangler handles binding on deploy; ensure the `agrolloo.com` zone has the hostname). If a proxied CNAME/A record is required, add it via the Cloudflare DNS tooling for the `agrolloo.com` zone, matching how `kushal-gym.agrolloo.com` is set up.

- [ ] **Step 4: Deploy**

```bash
npm run deploy
```

Expected: `wrangler deploy` succeeds, prints the `founders.agrolloo.com` route and the `35 18 * * *` cron trigger.

- [ ] **Step 5: Smoke-test production**

- Visit `https://founders.agrolloo.com` → login page → PIN → tracker.
- Repeat the create-no-ETA / set-ETA / done / recurring checks from Task 13, Step 3 against production.

- [ ] **Step 6: Write README.md**

```markdown
# founders-tracker

Shared action-item tracker for Khushi & Kushal, live at `founders.agrolloo.com`.
Two owner tabs, drag-ordered tasks, hazard cards for tasks with no ETA, an
on-time scoreboard, and monthly/weekly auto-recurring tasks managed from the UI.

Vite + React + Hono on a Cloudflare Worker, backed by D1 (`founders-db`),
shared-PIN gate. A daily Cron Trigger (00:05 Asia/Kolkata) materializes
recurring tasks; the app also catches up on load.

## Dev
- `npm install`
- `npm run db:local` — apply schema to local D1
- copy secrets into `.dev.vars` (`APP_PIN`, `SESSION_SECRET`)
- `npm run dev`

## Deploy
- `npm run db:remote` (first time / schema changes)
- `wrangler secret put APP_PIN` / `SESSION_SECRET`
- `npm run deploy`

## Data
- `tasks` — every action item (manual + generated).
- `recurring_templates` — repeat-job definitions, CRUD'd from the Repeat jobs screen.
- Recurring instances are deduped by a unique index on `(template_id, period_key)`.
```

- [ ] **Step 7: Register the site in repo inventory**

Add `founders.agrolloo.com` to `my-hosted-sites.md` and the Cloudflare inventory in `INFRA.md`, matching the existing entries' format.

- [ ] **Step 8: Commit**

```bash
git add apps/founders-tracker/wrangler.jsonc apps/founders-tracker/README.md my-hosted-sites.md INFRA.md
git commit -m "feat(founders): deploy config + readme + inventory"
```

---

## Self-Review Notes

- **Spec coverage:** two-tab shared view (T13), shared-PIN gate (T6/T7), D1 storage (T1/T4), task fields incl. owner/eta/notes/status/completedAt (T2/T4), manual drag-order (T11), hazard no-ETA card + global counter (T9/T10/T13), countdown color thresholds (T8/T10), Done collapse (T11), on-time % scoreboard with on-time/late/avg/no-ETA (T4/T10), monthly+weekly recurring via UI CRUD + idempotent daily cron + on-load catch-up (T5/T7/T12), Asia/Kolkata date-only math (T3/T8). All covered.
- **Deferred from spec, decided here:** scoreboard computed server-side (T4, single query); subdomain `founders.agrolloo.com` (T1/T14).
- **Type consistency:** `Task`/`Template`/`Scoreboard` shapes defined once in T2 and consumed unchanged; `runGenerator`, `computeScoreboard`, `reorderTasks`, `api.*` signatures match across worker and client tasks.
- **Note for implementer:** the set-ETA interaction in T13 uses `prompt()` for speed; a date-picker modal is a fine optional upgrade but not required for the deliverable.
```
