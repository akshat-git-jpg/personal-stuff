---
executor: agy
model:
test_cmd: cd apps/kushal-health && npm ci && npm run typecheck && npm test && npm run build && bash scripts/smoke.sh
ui: true
deploy: cd apps/kushal-health && npm run deploy
needs: []
needs_plans: []
needs_prs: []
touches: [apps/kushal-health/]
mutation_apply: sed -i.bak 's/^export const BORDER_FRACTION = 0.1;/export const BORDER_FRACTION = 0;/' apps/kushal-health/src/shared/status.ts && rm apps/kushal-health/src/shared/status.ts.bak
mutation_command: npx vitest run test/status.test.ts
mutation_expect: borderline
mutation_cwd: apps/kushal-health
mutation_timeout: 300
---

# Plan 269: kushal-health app with a Blood tests tab

## Summary

- **Problem statement**: The owner's blood test reports are loose PDFs in `~/Downloads`. There is no
  place to see one marker (TSH, HbA1c, LDL...) across years against its reference range, and no
  plain verdict on the latest report.
- **Goals**:
  - New app `apps/kushal-health/` at `kushal-health.agrolloo.com`: Worker (Hono) + D1 + R2 + Vite/React SPA, PIN-gated.
  - First tab **Blood tests**: latest verdict card, "Needs attention" list, every marker grouped by panel with status chip, trend and chart, reports list with "Open PDF".
  - Bearer-token ingest API + `scripts/push-report.mjs`, which plan 270's skill uses to add reports.
  - A pure, tested rule engine (`src/shared/status.ts`) for status (low / high / near edge / normal) and trend (better / worse / steady).
- **Decisions confirmed** (owner, 2026-10-06):
  - How reports get in -> Claude reads the PDF in a session, owner checks the numbers, Claude pushes them (no AI key in the app). The skill is plan 270; this plan ships the API and push script.
  - Verdict -> rule-based status/trend computed in the app + a short Claude-written verdict per report, stored in `reports.verdict`.
  - Access -> PIN gate (shared-password HMAC cookie, copied from `apps/kushal-income/src/worker/auth.ts`). The PIN is the `APP_PASSWORD` secret, set by the owner at deploy. It is NEVER written into any repo file.
  - Original PDFs -> stored in R2 bucket `kushal-health-reports`, opened from an "Open PDF" link.
- **Executor proposed**: agy (default model) — standard, fully inlined greenfield app.
- **Done criteria**: `test_cmd` exits 0; ≥ 47 vitest tests pass incl. `test/ui.test.tsx`; smoke passes all routes; two screenshots committed.
- **Stop conditions**: real health data appears anywhere in git; a gate assertion would need weakening; wrangler local cannot boot.
- **Test / verification for success**: vitest (rules, validation, auth, UI components) + `scripts/smoke.sh` against real `wrangler dev --local` D1/R2 + screenshots at 390px and 1280px.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7a4042ee..HEAD -- apps/kushal-health apps/closet-app/scripts/smoke.sh apps/closet-app/scripts/shoot.mjs apps/kushal-income/src/worker/auth.ts` (expect: empty; `apps/kushal-health` must not exist yet)

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `7a4042ee`, 2026-10-06

## Why this matters

The owner wants one place to see how each blood marker moves over time and a clear verdict on the
latest report. The app does the arithmetic (in range or not, getting better or worse) with fixed
rules, so the colours are always the same for the same numbers. The written verdict comes from
Claude at ingest time and is just stored text. Health data is private: the app is PIN-gated, PDFs
are served only to a logged-in session, and **no real report value may ever be committed** —
every fixture in this plan is synthetic.

## Current state

- `apps/kushal-health/` does not exist.
- **Exemplar app: `apps/closet-app/`** (Vite + React 19 + Hono Worker + D1 + R2 + vitest + jsdom UI tests + `scripts/smoke.sh` + `scripts/shoot.mjs`). Match its folder layout, `package.json` script shapes (every script sources `../../scripts/node22-path.sh`), `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json` / `tsconfig.worker.json` split, and `.npmrc`.
- **Auth to copy verbatim: `apps/kushal-income/src/worker/auth.ts`** (124 lines: `checkPassword`, `checkIngest`, `makeToken`, `verifyToken`, `setAuthCookie`, `clearAuthCookie`, `requireAuth`). Changes when copying: cookie name `const COOKIE = "khealth_auth";`, and `Env` becomes:
  ```ts
  export type Env = {
    ASSETS: Fetcher;
    DB: D1Database;
    REPORTS: R2Bucket;
    APP_PASSWORD: string;   // the owner's PIN, a wrangler secret
    SESSION_SECRET: string;
    INGEST_TOKEN: string;   // bearer for the skill's push script
  };
  ```
  Add one middleware to the same file:
  ```ts
  /** Cookie session OR the ingest bearer — the skill reads history to write trends. */
  export async function requireAuthOrIngest(c: Context<{ Bindings: Env }>, next: Next): Promise<Response | void> {
    if (checkIngest(c.env, c.req.header("Authorization"))) return next();
    return requireAuth(c, next);
  }
  ```
- **Smoke harness to copy: `apps/closet-app/scripts/smoke.sh`** — `mktemp` state dir, `--var` secrets, `SMOKE_PORT` default 8799, `cleanup` trap that kills wrangler. Keep that skeleton; replace the route checks (Step 7).
- **Screenshot script: copy `apps/closet-app/scripts/shoot.mjs` unchanged** (puppeteer-core + system Chrome; `--width`, `--height`, `--selector`, `--click` flags).
- Cloudflare account: same as every app here (`akshatpatidar17@gmail.com`, see `INFRA.md` line 11).
- Real reports from an Indian hospital lab are text PDFs (, `pdftotext -layout` works). Columns are `Investigation | Observed Value | Unit | Biological Ref. Interval | Specimen`; values can be censored (`<1.3`); ranges can be one-sided (`<4.00`). The app never parses PDFs — plan 270's skill does — but the data model below must hold these shapes.

## Commands you will need

| Purpose | Command (run in `apps/kushal-health`) | Expected |
|---|---|---|
| Install | `npm install` (first time, creates lockfile), later `npm ci` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Unit + UI tests | `npm test` | exit 0, `Tests  N passed` with N ≥ 47 |
| Build | `npm run build` | exit 0, `dist/index.html` exists |
| Smoke | `bash scripts/smoke.sh` | last line `SMOKE OK`, exit 0 |
| Local UI | `npm run dev:local` | API on :8787, web on :5173 |
| Screenshot | `node scripts/shoot.mjs <url> <out> --width=390 --height=844` | png written, exit 0 |

## Scope

**In scope** (create only these):
- `apps/kushal-health/**` — every file listed in the Steps.

**Out of scope**:
- `.claude/skills/kushal-health/` — plan 270.
- `INFRA.md`, `my-hosted-sites.md`, `plans/README.md`, `decisions.md` — shared registries, updated on main at landing.
- `apps/kushal-tools/src/hub.ts` — hub card is added after the first deploy, at the owner's call.
- Remote provisioning (`wrangler d1 create`, `r2 bucket create`, `secret put`) — owner-gated deploy, see Maintenance notes.
- Any PDF parsing, any LLM call, any upload button in the UI.

## Git workflow

- Branch: `advisor/269-kushal-health-blood-tab`
- Commit: `feat(kushal-health): blood tests tab` — no AI footers. Do NOT push.

## Steps

### Step 1: Scaffold

Create `apps/kushal-health/` with:

- `package.json`:
  ```json
  {
    "name": "kushal-health",
    "private": true,
    "version": "0.0.0",
    "type": "module",
    "scripts": {
      "dev:api": ". ../../scripts/node22-path.sh && wrangler dev --port ${API_PORT:-8787}",
      "dev:web": ". ../../scripts/node22-path.sh && vite",
      "dev:local": "concurrently -k -n api,web -c blue,magenta \"npm:dev:api\" \"npm:dev:web\"",
      "build": ". ../../scripts/node22-path.sh && tsc -b && vite build",
      "typecheck": ". ../../scripts/node22-path.sh && tsc -b",
      "test": ". ../../scripts/node22-path.sh && vitest run",
      "db:local": ". ../../scripts/node22-path.sh && wrangler d1 migrations apply kushal-health --local",
      "db:remote": ". ../../scripts/node22-path.sh && wrangler d1 migrations apply kushal-health --remote",
      "smoke": "bash scripts/smoke.sh",
      "shoot": "node scripts/shoot.mjs",
      "deploy": ". ../../scripts/node22-path.sh && npm run build && wrangler deploy"
    }
  }
  ```
  Dependencies: `hono`, `react`, `react-dom` (same majors as `apps/closet-app/package.json`). devDependencies: `@cloudflare/workers-types`, `@testing-library/dom`, `@testing-library/react`, `@types/node`, `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`, `concurrently`, `jsdom`, `puppeteer-core`, `typescript`, `vite`, `vitest`, `wrangler` — same versions as closet-app. No Tailwind (plain CSS).
- `.npmrc` — copy from closet-app (pins the public registry). Create it BEFORE `npm install`.
- `.gitignore`: `node_modules`, `dist`, `.wrangler`, `.dev.vars`, `.ingest.env`, `*.local`, `.DS_Store`, `.shots`, `node_modules/.tmp`.
- `.dev.vars.example`:
  ```
  # Copy to .dev.vars (gitignored) for local `wrangler dev`.
  APP_PASSWORD="1234"
  SESSION_SECRET="change me to a long random string"
  INGEST_TOKEN="change me to a long random string too"
  ```
- `.ingest.env.example`:
  ```
  # Copy to .ingest.env (gitignored). Read by scripts/push-report.mjs.
  KUSHAL_HEALTH_URL="https://kushal-health.agrolloo.com"
  KUSHAL_HEALTH_INGEST_TOKEN="same value as the INGEST_TOKEN wrangler secret"
  ```
- `wrangler.toml`:
  ```toml
  name = "kushal-health"
  main = "src/worker/index.ts"
  compatibility_date = "2026-05-01"
  compatibility_flags = ["nodejs_compat"]

  [assets]
  directory = "./dist"
  binding = "ASSETS"
  not_found_handling = "single-page-application"

  # Blood test reports, markers and results. Owner creates with
  # `npx wrangler d1 create kushal-health` and pastes the real id here at first deploy.
  [[d1_databases]]
  binding = "DB"
  database_name = "kushal-health"
  database_id = "00000000-0000-0000-0000-000000000000"
  migrations_dir = "migrations"

  # Original report PDFs. Owner creates with `npx wrangler r2 bucket create kushal-health-reports`.
  [[r2_buckets]]
  binding = "REPORTS"
  bucket_name = "kushal-health-reports"

  [[routes]]
  pattern = "kushal-health.agrolloo.com"
  custom_domain = true

  # Secrets (npx wrangler secret put <NAME>):
  #   APP_PASSWORD   - the owner's PIN
  #   SESSION_SECRET - signs the auth cookie
  #   INGEST_TOKEN   - bearer for scripts/push-report.mjs
  ```
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.worker.json` — copy from closet-app. `tsconfig.worker.json` must `include: ["src/worker", "src/shared"]`; `tsconfig.app.json` `include: ["src"]`, `exclude: ["src/worker"]`.
- `vite.config.ts` — closet-app's, minus Tailwind, proxying `/api` only.
- `index.html` with `<title>Kushal Health</title>` and `<meta name="viewport" content="width=device-width, initial-scale=1">`.

**Verify**: `cd apps/kushal-health && npm install && test -f package-lock.json && echo ok` -> `ok`

### Step 2: Schema

`migrations/0001_init.sql`:
```sql
CREATE TABLE reports (
  id TEXT PRIMARY KEY,               -- e.g. 2025-01-15-citylab-ab12345
  collected_on TEXT NOT NULL,        -- YYYY-MM-DD
  lab TEXT NOT NULL,
  source_file TEXT NOT NULL,         -- original file name, e.g. LABREPORT.pdf
  verdict TEXT NOT NULL DEFAULT '',  -- Claude's plain verdict, written at ingest
  pdf_key TEXT,                      -- R2 key once the PDF is uploaded
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE markers (
  key TEXT PRIMARY KEY,              -- canonical, e.g. tsh, hba1c, ldl
  name TEXT NOT NULL,                -- display name
  panel TEXT NOT NULL,               -- one of PANELS in src/shared/types.ts
  unit TEXT NOT NULL DEFAULT ''
);
CREATE TABLE results (
  report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  marker_key TEXT NOT NULL REFERENCES markers(key),
  name_on_report TEXT NOT NULL,
  value_text TEXT NOT NULL,          -- exactly as printed: "5.6", "<1.3", "Non Reactive"
  value_num REAL,                    -- null for qualitative values
  qualifier TEXT,                    -- "<", "<=", ">", ">=" or null
  unit TEXT NOT NULL DEFAULT '',
  ref_text TEXT NOT NULL DEFAULT '', -- exactly as printed: "0.4 - 4.0", "<4.00", "Non Reactive"
  ref_low REAL,
  ref_high REAL,
  PRIMARY KEY (report_id, marker_key)
);
CREATE INDEX results_marker ON results(marker_key);
```

**Verify**: `cd apps/kushal-health && npx wrangler d1 migrations apply kushal-health --local --persist-to "$(mktemp -d)" 2>&1 | tail -3` -> contains `0001_init.sql` and `✅`

### Step 3: Shared types + rule engine (the hard part — place exactly)

`src/shared/types.ts`:
```ts
export const PANELS = ["Diabetes", "Lipid", "Thyroid", "Liver", "Kidney", "CBC", "Vitamins", "Hormones", "Other"] as const;
export type Panel = (typeof PANELS)[number];
export type Qualifier = "<" | "<=" | ">" | ">=" | null;

export interface Point {
  value_num: number | null;
  value_text: string;
  qualifier: Qualifier;
  ref_low: number | null;
  ref_high: number | null;
  ref_text: string;
}
export interface MarkerPoint extends Point { report_id: string; collected_on: string; unit: string }
export interface MarkerSeries { key: string; name: string; panel: Panel; unit: string; points: MarkerPoint[] } // points oldest first
export interface ReportRow { id: string; collected_on: string; lab: string; source_file: string; verdict: string; has_pdf: boolean }
export interface BloodData { reports: ReportRow[]; markers: MarkerSeries[] } // reports newest first

export interface IngestResult {
  marker_key: string; name: string; panel: Panel; name_on_report: string;
  value_text: string; value_num: number | null; qualifier: Qualifier;
  unit: string; ref_text: string; ref_low: number | null; ref_high: number | null;
}
export interface IngestBody {
  report: { id: string; collected_on: string; lab: string; source_file: string; verdict: string };
  results: IngestResult[];
}
```

`src/shared/status.ts` — write exactly this:
```ts
import type { Point } from "./types";

export type Status = "low" | "high" | "abnormal" | "borderline" | "normal" | "unknown";
export type TrendWord = "better" | "worse" | "steady";

/** Share of the reference range treated as "near the edge". */
export const BORDER_FRACTION = 0.1;
/** A change smaller than this share of the range (or of the old value) is "steady". */
export const STEADY_FRACTION = 0.05;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function statusOf(p: Point): Status {
  if (p.value_num === null) {
    if (!p.ref_text.trim()) return "unknown";
    return norm(p.value_text) === norm(p.ref_text) ? "normal" : "abnormal";
  }
  const v = p.value_num;
  const lo = p.ref_low;
  const hi = p.ref_high;
  if (lo === null && hi === null) return "unknown";
  const atMost = p.qualifier === "<" || p.qualifier === "<=";   // "<1.3": real value is at most 1.3
  const atLeast = p.qualifier === ">" || p.qualifier === ">=";  // ">90": real value is at least 90

  if (lo !== null && v < lo) return atLeast ? "unknown" : "low";
  if (hi !== null && v > hi) return atMost ? "unknown" : "high";

  if (lo !== null && hi !== null) {
    const band = (hi - lo) * BORDER_FRACTION;
    if (!atLeast && v <= lo + band) return "borderline";
    if (!atMost && v >= hi - band) return "borderline";
    return "normal";
  }
  if (hi !== null) return !atMost && v >= hi * (1 - BORDER_FRACTION) ? "borderline" : "normal";
  return !atLeast && v <= (lo as number) * (1 + BORDER_FRACTION) ? "borderline" : "normal";
}

/** Distance from the healthy target: range midpoint, or "lower/higher is better" for one-sided ranges. */
function badness(p: Point): number | null {
  if (p.value_num === null) return null;
  const { ref_low: lo, ref_high: hi, value_num: v } = p;
  if (lo !== null && hi !== null) return Math.abs(v - (lo + hi) / 2);
  if (hi !== null) return v;
  if (lo !== null) return -v;
  return null;
}

export function trendOf(prev: Point | undefined, last: Point): TrendWord | null {
  if (!prev || prev.value_num === null || last.value_num === null) return null;
  if (prev.qualifier || last.qualifier) return null; // censored values do not trend
  const scale =
    last.ref_low !== null && last.ref_high !== null
      ? last.ref_high - last.ref_low
      : Math.abs(prev.value_num) || 1;
  if (Math.abs(last.value_num - prev.value_num) < scale * STEADY_FRACTION) return "steady";
  const a = badness(prev);
  const b = badness(last);
  if (a === null || b === null) return null;
  return b < a ? "better" : "worse";
}

export const SEVERITY: Record<Status, number> = { high: 0, low: 0, abnormal: 0, borderline: 1, normal: 2, unknown: 3 };
export const needsAttention = (s: Status) => SEVERITY[s] <= 1;
```

`test/status.test.ts` — table-driven, one `it` per row, test name = the `name` column. Helper `pt(over: Partial<Point>): Point` with defaults `{ value_num: null, value_text: "", qualifier: null, ref_low: null, ref_high: null, ref_text: "" }`.

| name | point | expected statusOf |
|---|---|---|
| normal in two-sided range | v=2.1, lo=0.4, hi=4.0 | normal |
| low below range | v=18, lo=30, hi=100 | low |
| high above range | v=162, hi=100 | high |
| borderline near upper edge | v=5.6, lo=4.0, hi=5.6 | borderline |
| borderline near lower edge | v=0.5, lo=0.4, hi=4.0 | borderline |
| borderline one-sided upper | v=95, hi=100 | borderline |
| normal one-sided upper | v=80, hi=100 | normal |
| borderline one-sided lower | v=42, lo=40 | borderline |
| censored below stays normal | v=1.3, q="<", hi=4.0 | normal |
| censored below above limit is unknown | v=5, q="<", hi=4.0 | unknown |
| censored above below limit is unknown | v=20, q=">", lo=30 | unknown |
| censored above in range is normal | v=90, q=">", lo=60 | normal |
| qualitative match is normal | text="Non Reactive", ref_text="Non-Reactive" | normal |
| qualitative mismatch is abnormal | text="Reactive", ref_text="Non Reactive" | abnormal |
| no range is unknown | v=10 | unknown |

Plus trend cases (`describe("trendOf")`):

| name | prev | last | expected |
|---|---|---|---|
| first reading has no trend | undefined | v=2 lo=0.4 hi=4 | null |
| rising LDL is worse | v=140 hi=100 | v=162 hi=100 | worse |
| falling LDL is better | v=162 hi=100 | v=120 hi=100 | better |
| small change is steady | v=2.0 lo=0.4 hi=4 | v=2.1 lo=0.4 hi=4 | steady |
| moving toward midpoint is better | v=3.9 lo=0.4 hi=4 | v=2.2 lo=0.4 hi=4 | better |
| censored values do not trend | v=1.3 q="<" hi=4 | v=1.0 hi=4 | null |

**Verify**: `cd apps/kushal-health && npx vitest run test/status.test.ts` -> `21 passed`

### Step 4: Worker

`src/worker/auth.ts` — copy per Current state (cookie `khealth_auth`, new `Env`, add `requireAuthOrIngest`).

`src/worker/validate.ts` — `export function validateIngest(body: unknown): IngestBody` that throws `Error(<reason>)` on the first failure. Rules, in this order:
- `report.id` matches `/^[a-z0-9-]{3,80}$/` else `"bad report.id"`
- `report.collected_on` matches `/^\d{4}-\d{2}-\d{2}$/` else `"bad report.collected_on"`
- `report.lab`, `report.source_file` non-empty strings; `report.verdict` a string (may be empty) else `"bad report.<field>"`
- `results` is a non-empty array, max 300 items, else `"results must be a non-empty array"`
- per result `i`: `marker_key` matches `/^[a-z0-9_]{1,40}$/`; `panel` in `PANELS`; `name`, `name_on_report`, `value_text` non-empty strings; `value_num` finite number or null; `qualifier` one of `"<","<=",">",">="` or null; `ref_low`/`ref_high` finite or null; `unit`, `ref_text` strings — else `"bad results[<i>].<field>"`
- duplicate `marker_key` within one body -> `"duplicate marker_key <key>"`

`src/worker/blood.ts`:
- `ingest(env, body: IngestBody)` — one `env.DB.batch([...])`: upsert `reports` (`INSERT ... ON CONFLICT(id) DO UPDATE SET collected_on, lab, source_file, verdict` — keep existing `pdf_key`); upsert each marker (`ON CONFLICT(key) DO UPDATE SET name=excluded.name, panel=excluded.panel, unit=excluded.unit`); `DELETE FROM results WHERE report_id=?`; insert each result. Returns `{ report_id, results: n }`. Re-sending the same id replaces that report's results.
- `read(env): Promise<BloodData>` — reports `ORDER BY collected_on DESC, id`, `has_pdf = pdf_key IS NOT NULL`; markers joined with results+reports, points `ORDER BY collected_on ASC, report_id`, markers sorted by `PANELS` index then name. Markers with zero results are omitted.
- `setPdf(env, id, key)`; `getReport(env, id)`.

`src/worker/index.ts` (Hono), routes:

| Method + path | Auth | Behaviour |
|---|---|---|
| `POST /api/login` | none | body `{password}`; wrong -> 401 `{error:"invalid PIN"}`; right -> set cookie, `{ok:true}` |
| `POST /api/logout` | none | clear cookie |
| `GET /api/blood` | `requireAuthOrIngest` | `BloodData` JSON |
| `POST /api/reports` | bearer (`checkIngest`) | `validateIngest` -> 400 `{error}` on throw; `ingest` -> `{ok:true, report_id, results}` |
| `PUT /api/reports/:id/pdf` | bearer | `content-type` must start `application/pdf` else 415; empty body 400; > 15 MB 413; unknown report 404; put R2 key `reports/<id>.pdf` with `httpMetadata.contentType = "application/pdf"`; `setPdf`; `{ok:true, key}` |
| `GET /api/reports/:id/pdf` | `requireAuth` (cookie only) | 404 when no report/pdf; stream with `Content-Type: application/pdf`, `Content-Disposition: inline; filename="<source_file>"`, `Cache-Control: private, no-store` |
| `GET *` | none | `c.env.ASSETS.fetch(c.req.raw)` |

`test/validate.test.ts` — one passing case (the fixture from Step 6) and one failing case per rule above (≥ 8 tests), asserting the exact error string.

`test/auth.test.ts` — via `app.request(...)` with a mock env (`DB`, `REPORTS`, `ASSETS` as `{} as unknown as ...`, `APP_PASSWORD: "1234"`, `SESSION_SECRET: "x".repeat(40)`, `INGEST_TOKEN: "tok"`), as in `apps/closet-app/test/auth.test.ts`:
1. `GET /api/blood` no cookie -> 401
2. `POST /api/reports` no header -> 401
3. `POST /api/reports` `Bearer wrong` -> 401
4. `GET /api/reports/x/pdf` with `Bearer tok` and no cookie -> 401 (PDFs are cookie-only)
5. `POST /api/login` `{password:"0000"}` -> 401
6. `POST /api/login` `{password:"1234"}` -> 200 and `set-cookie` contains `khealth_auth=`

**Verify**: `cd apps/kushal-health && npx vitest run test/validate.test.ts test/auth.test.ts` -> all pass, ≥ 14 tests

### Step 5: Push script

`scripts/push-report.mjs` (plain Node ≥ 20, no deps):
- Config: reads `apps/kushal-health/.ingest.env` (path resolved from the script's own dir, `KEY="value"` lines) if it exists; `process.env.KUSHAL_HEALTH_URL` / `KUSHAL_HEALTH_INGEST_TOKEN` override it. Missing either -> print `missing KUSHAL_HEALTH_URL or KUSHAL_HEALTH_INGEST_TOKEN (see .ingest.env.example)` and exit 2.
- `node scripts/push-report.mjs --history` -> `GET /api/blood` with the bearer, prints the JSON to stdout.
- `node scripts/push-report.mjs <report.json> [<report.pdf>]` -> `POST /api/reports` with the JSON file body; then, if a PDF path is given, `PUT /api/reports/<report.id>/pdf` with `content-type: application/pdf`. Prints `pushed <id>: <n> results` and `pdf stored` when done.
- Any non-2xx -> print `<METHOD> <path> -> <status>: <body>` to stderr and exit 1.

**Verify**: `cd apps/kushal-health && KUSHAL_HEALTH_URL= KUSHAL_HEALTH_INGEST_TOKEN= node scripts/push-report.mjs --history; echo "exit=$?"` -> prints the `missing ...` line and `exit=2` (run with no `.ingest.env` present)

### Step 6: Client

Files: `src/main.tsx`, `src/client/App.tsx`, `src/client/Login.tsx`, `src/client/api.ts`, `src/client/BloodTab.tsx`, `src/client/MarkerChart.tsx`, `src/client/format.ts`, `src/client/styles.css`.

- **App shell** (`App.tsx`): loads `GET /api/blood`. 401 -> `<Login>`. Otherwise header `Kushal Health` + a tab bar (`role="tablist"`) with ONE tab `Blood tests` (`role="tab"`, `aria-selected="true"`) and a `Log out` button. Tabs are an array `[{ id: "blood", label: "Blood tests" }]` so more tabs can be added later. Renders `<BloodTab data={...} />`.
- **Error state**: non-401 failure -> text `Could not load reports.` and a `Retry` button that re-runs the fetch.
- **Login** (`Login.tsx`): copy `apps/kushal-income/src/client/Login.tsx`; title `Kushal Health`, hint `Enter your PIN.`, input `type="password" inputMode="numeric" autoComplete="current-password" placeholder="PIN"`, button `Unlock`.
- **`BloodTab({ data }: { data: BloodData })`** — pure on its props (no fetch inside, so it is testable). Sections, top to bottom:
  1. **Empty**: `data.reports.length === 0` -> only a card with `No blood reports yet.` and `Ask Claude: add my blood report <path to PDF>`.
  2. **Verdict card** (`data-testid="verdict"`): heading `Latest report · <date>` where date = newest `collected_on` formatted `D MMM YYYY` (e.g. `15 Jan 2025`). Count line from the latest point of every marker whose latest point is on that date: `<a> out of range · <b> near edge · <c> normal` (a = high+low+abnormal, b = borderline, c = normal). Then each report on that date: lab name, and its `verdict` with `white-space: pre-line`. Empty verdict -> `No written verdict for this report.`
  3. **Needs attention** (`data-testid="attention"`): markers whose LATEST point has `needsAttention(statusOf(p))`, sorted by `SEVERITY` then name. Each row: name, latest `value_text` + unit, status chip. Hidden when the list is empty.
  4. **Panels**: one section per panel in `PANELS` order that has markers, heading = panel name. Each marker row (`button`, `data-testid="marker-<key>"`): name · latest `value_text` unit · status chip · trend text · small `MarkerChart`. Clicking toggles an expanded area with a large `MarkerChart` and a readings table (`Date | Value | Range | Status`, newest first, Range = `ref_text`).
  5. **Reports** (`data-testid="reports"`): newest first: date · lab · `source_file` · `Open PDF` link (`href="/api/reports/<id>/pdf" target="_blank" rel="noopener"`) ONLY when `has_pdf`.
- **Status chip** — exact labels and colours (`format.ts` exports `STATUS_LABEL` and `STATUS_CLASS`; CSS classes in `styles.css`):

  | Status | Label | CSS class | background | text |
  |---|---|---|---|---|
  | high | High | chip-bad | #fde2e1 | #b42318 |
  | low | Low | chip-bad | #fde2e1 | #b42318 |
  | abnormal | Abnormal | chip-bad | #fde2e1 | #b42318 |
  | borderline | Near edge | chip-warn | #fef0c7 | #b54708 |
  | normal | Normal | chip-ok | #dcfae6 | #067647 |
  | unknown | No range | chip-none | #f2f4f7 | #475467 |

- **Trend text** — `trendOf(secondLast, last)`: `better` -> `▲ better` / `▼ better` (arrow = direction of the raw value change) in class `trend-good` (#067647); `worse` -> arrow + ` worse` in `trend-bad` (#b42318); `steady` -> `steady` in `trend-flat` (#475467). `null` with one point -> `first reading`; `null` otherwise -> nothing.
- **`MarkerChart({ series, size })`**, `size: "small" | "large"`, inline SVG, no chart library:
  - small: `viewBox="0 0 96 28"`, line + dots, no labels. large: `viewBox="0 0 320 160"`, dots + line + date labels under each point (`MMM YY`) + `value_text` above each point.
  - Only points with `value_num !== null` are drawn. Fewer than 1 numeric point -> render nothing (`null`) — qualitative markers show only the readings table.
  - x: proportional to `collected_on` date between first and last; a single point sits at the centre.
  - y-domain: min/max over numeric values plus the latest point's `ref_low`/`ref_high`, padded 10% each side.
  - Reference band: a `rect` with class `ref-band` (fill #dcfae6, opacity .6) from the latest point's `ref_low` to `ref_high`; one-sided ranges extend to the domain edge.
  - Dot fill per that point's status: bad #b42318, warn #b54708, ok #067647, none #475467.
- Layout: single column, max-width 720px centred, 16px side padding; no horizontal scroll at 390px.

Fixture `test/fixtures/blood.ts` — SYNTHETIC values only; export `fixture: BloodData` with two reports:
- `2024-06-10-test-lab-a` (collected 2024-06-10, lab `Test Lab`, has_pdf false, verdict `Older report.`)
- `2025-01-15-test-lab-b` (collected 2025-01-15, lab `Test Lab`, has_pdf true, verdict `Mostly normal. LDL is high.`)

and markers (points oldest first):

| key | name | panel | unit | 2024-06-10 | 2025-01-15 | ref |
|---|---|---|---|---|---|---|
| hba1c | HbA1c | Diabetes | % | — | 5.6 | lo 4.0 hi 5.6 `4.0 - 5.6` |
| ldl | LDL Cholesterol | Lipid | mg/dL | 140 | 162 | hi 100 `<100` |
| tsh | TSH | Thyroid | µIU/mL | 3.2 | 2.1 | lo 0.4 hi 4.0 `0.4 - 4.0` |
| anti_tg | Anti Thyroglobulin | Thyroid | IU/mL | — | `<1.3` (num 1.3, q `<`) | hi 4.0 `<4.00` |
| vit_d | Vitamin D | Vitamins | ng/mL | — | 18 | lo 30 hi 100 `30 - 100` |
| hbsag | HBsAg | Other | | — | `Non Reactive` (num null) | `Non Reactive` |

Also export `fixtureIngest: IngestBody` = the `2025-01-15-test-lab-b` report with those 6 results, and write the same object to `test/fixtures/report.json` (used by the smoke).

`test/ui.test.tsx` (`// @vitest-environment jsdom`, `afterEach(cleanup)`), render `<BloodTab data=... />`:
1. empty data -> shows `No blood reports yet.`
2. verdict card shows `Latest report · 15 Jan 2025` and `2 out of range · 1 near edge · 3 normal` (LDL high, Vit D low; HbA1c near edge; TSH, anti_tg, HBsAg normal)
3. verdict text `Mostly normal. LDL is high.` visible
4. attention list order is LDL Cholesterol, Vitamin D, HbA1c (by severity, then name) — assert via `within(getByTestId("attention")).getAllByRole("listitem")` text order
5. `marker-ldl` row contains `High` and `▲ worse`
6. `marker-tsh` row contains `Normal` and `▼ better`
7. `marker-vit_d` row contains `first reading`
8. `marker-hbsag` row contains no `svg` element
9. `marker-hba1c` row contains `Near edge`
10. clicking `marker-ldl` shows a table with 2 body rows, first row date `15 Jan 2025`
11. reports section: exactly one `Open PDF` link, `href="/api/reports/2025-01-15-test-lab-b/pdf"`
12. panel headings appear in order Diabetes, Lipid, Thyroid, Vitamins, Other

**Verify**: `cd apps/kushal-health && npx vitest run test/ui.test.tsx` -> `12 passed`

### Step 7: Smoke

`scripts/smoke.sh` — copy the skeleton of `apps/closet-app/scripts/smoke.sh` (mktemp state, `--var` secrets, `SMOKE_PORT` default 8799, cleanup trap that always kills wrangler, wait-for-ready loop with a 60 s cap that fails loudly). Apply migrations into the same state dir first: `npx wrangler d1 migrations apply kushal-health --local --persist-to "$STATE"`. Start `npx wrangler dev --local --port "$PORT" --persist-to "$STATE" --var APP_PASSWORD:1111 --var SESSION_SECRET:smoke-secret-at-least-32-characters-long --var INGEST_TOKEN:smoke-token`. Then check in order, printing `PASS <name>` / `FAIL <name>` and exiting 1 on the first FAIL:
1. `GET /` -> 200 and body contains `Kushal Health`
2. `GET /api/blood` no cookie -> 401
3. `KUSHAL_HEALTH_URL=$BASE KUSHAL_HEALTH_INGEST_TOKEN=smoke-token node scripts/push-report.mjs test/fixtures/report.json "$PDF"` -> exit 0, where `$PDF` is a mktemp file containing `%PDF-1.4\n%smoke\n`
4. same push with token `wrong` -> exit 1
5. `POST /api/login` `{"password":"1111"}` with a cookie jar -> 200
6. `GET /api/blood` with the jar -> 200, body contains `"key":"ldl"` and `"has_pdf":true`
7. `GET /api/reports/2025-01-15-test-lab-b/pdf` with the jar -> 200, `content-type: application/pdf`, body starts `%PDF`
8. `GET /api/reports/2025-01-15-test-lab-b/pdf` with NO cookie -> 401
9. push the same report again -> exit 0, then `/api/blood` still has exactly one `2025-01-15-test-lab-b` in `reports` (idempotent; count with `node -e`)
Last line on success: `SMOKE OK`.

**Verify**: `cd apps/kushal-health && npm run build && bash scripts/smoke.sh; echo "exit=$?"` -> `SMOKE OK` then `exit=0`

### Step 8: Screenshots + docs

- Copy `apps/closet-app/scripts/shoot.mjs` to `scripts/shoot.mjs`.
- Start `npm run dev:local` with a local `.dev.vars` copied from `.dev.vars.example` (do not commit it), run `npm run db:local`, push `test/fixtures/report.json` plus a second synthetic report built from the `2024-06-10` column of the fixture table (save it as `test/fixtures/report-older.json`) with `KUSHAL_HEALTH_URL=http://localhost:8787 KUSHAL_HEALTH_INGEST_TOKEN=<from .dev.vars>`. Log in at `http://localhost:5173` with PIN `1234`. Then:
  - `node scripts/shoot.mjs http://localhost:5173 .shots/blood-phone.png --width=390 --height=844 --full --selector='[data-testid=verdict]' --click='[data-testid=marker-ldl]'`
  - `node scripts/shoot.mjs http://localhost:5173 .shots/blood-desktop.png --width=1280 --height=900 --full --selector='[data-testid=verdict]'`
  (`shoot.mjs` has no login flag: before shooting, either set the `khealth_auth` cookie in the script's page from a `/api/login` call, or add a `--login=<pin>` flag that POSTs `/api/login` in the page first. Use the `--login` flag approach and keep everything else in `shoot.mjs` unchanged.)
  - Copy both PNGs to `apps/kushal-health/docs/screenshots/` and commit them (`.shots/` is gitignored).
- Open both images and check: verdict card on top, LDL row expanded with a two-point chart and a green band, chips in the table colours, no horizontal scroll on the phone shot. Every button and input is styled (no browser-default grey buttons).
- `README.md` (human): what it is, URL, how reports get in (plan 270's skill `kushal-health`, `scripts/push-report.mjs`), commands table, first-deploy steps (Maintenance notes below).
- `CLAUDE.md` (operating): guardrails — (1) never commit real report values, JSON or PDFs; fixtures stay synthetic; (2) status and trend come only from `src/shared/status.ts` — the UI never re-derives them; (3) PDFs are cookie-only, never reachable with the ingest bearer; (4) re-pushing a report id replaces its results; (5) deploy with `npm run deploy`.

**Verify**: `ls apps/kushal-health/docs/screenshots/blood-phone.png apps/kushal-health/docs/screenshots/blood-desktop.png && test -f apps/kushal-health/CLAUDE.md && echo ok` -> `ok`

## Test plan

- `test/status.test.ts` (21): every status branch incl. censored and qualitative values; trend better/worse/steady/null.
- `test/validate.test.ts` (≥ 8): one accept, one reject per rule, exact messages.
- `test/auth.test.ts` (6): every gate, incl. PDF being cookie-only.
- `test/ui.test.tsx` (12): empty state, counts, ordering, chips, trend text, qualitative no-chart, expand, PDF link, panel order.
- `scripts/smoke.sh`: real wrangler + local D1 + R2 through the real push script, incl. idempotent re-push.
- Mutation (boss runs it): `BORDER_FRACTION = 0` must make `test/status.test.ts` fail on the `borderline ...` cases.

## Done criteria

- [ ] `cd apps/kushal-health && npm ci && npm run typecheck && npm test && npm run build && bash scripts/smoke.sh` exits 0
- [ ] `cd apps/kushal-health && npm test 2>&1 | grep -E "Tests +[0-9]+ passed" | grep -Eo "[0-9]+ passed" | awk '{exit !($1>=47)}'` exits 0
- [ ] `test -f apps/kushal-health/test/ui.test.tsx && test -f apps/kushal-health/test/status.test.ts && test -f apps/kushal-health/test/validate.test.ts && test -f apps/kushal-health/test/auth.test.ts`
- [ ] `git ls-files apps/kushal-health | grep -E "\.dev\.vars$|\.ingest\.env$|\.pdf$"` prints nothing
- [ ] both screenshots committed under `apps/kushal-health/docs/screenshots/`
- [ ] `grep -rhoE '"lab": *"[^"]+"' apps/kushal-health/test/fixtures | sort -u` prints only `"lab": "Test Lab"` (fixtures are synthetic)
- [ ] On a fresh checkout of the branch (`git clean -xfd apps/kushal-health` then the test_cmd) everything still passes

## STOP conditions

- Any real lab value, patient name, lab id or a real PDF would be committed — stop.
- A test or smoke assertion fails and the only way to pass is to weaken, skip or delete it — stop and report. Fix the code or the fixture instead.
- `wrangler dev --local` cannot boot or cannot bind D1/R2 locally — stop and report the error; do not swap the smoke for mocked fetches.
- `npm install` fails with a 401 — the `.npmrc` was not created first; fix that, and if it still fails, stop.
- Anything requires creating remote Cloudflare resources or setting secrets — stop; that is the owner's deploy step.

## Maintenance notes

- **First deploy (owner says "deploy"; boss or owner runs from `apps/kushal-health`)**:
  1. `npx wrangler d1 create kushal-health` -> paste the id into `wrangler.toml`, commit `chore(kushal-health): real d1 id`
  2. `npx wrangler r2 bucket create kushal-health-reports`
  3. `npm run db:remote`
  4. `npx wrangler secret put APP_PASSWORD` — the owner types the PIN themself (`! npx wrangler secret put APP_PASSWORD`)
  5. `openssl rand -hex 32 | npx wrangler secret put SESSION_SECRET`
  6. `T=$(openssl rand -hex 32); echo "$T" | npx wrangler secret put INGEST_TOKEN`, and write `.ingest.env` with that token and `KUSHAL_HEALTH_URL="https://kushal-health.agrolloo.com"`
  7. `npm run deploy`, then open the URL in a headless browser, log in, and assert the empty-state text renders (LESSONS 2026-08-23: curl 200 is not proof).
  8. Register in `my-hosted-sites.md` and `INFRA.md`; ask the owner about a kushal-tools hub card.
- Future tabs (weight, sleep, ...) add an entry to the tabs array in `App.tsx` and their own component; the Blood tests tab must not change.
- The status rules are the product. Change `BORDER_FRACTION` / `STEADY_FRACTION` only with the owner, and keep the table tests in step.
- Reviewer: check `GET /api/reports/:id/pdf` is behind `requireAuth`, not `requireAuthOrIngest`.
