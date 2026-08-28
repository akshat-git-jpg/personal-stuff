<!-- boss frontmatter -->
---
executor: codex
model: gpt-5.6-terra
test_cmd: cd apps/tutorial-tracker-app && npm test
ui:
deploy:
needs: []
needs_prs: []
touches: [apps/tutorial-tracker-app/migrations/0005_programs.sql, apps/tutorial-tracker-app/src/worker/programs.ts, apps/tutorial-tracker-app/src/worker/programs-import.ts, apps/tutorial-tracker-app/src/worker/index.ts, apps/tutorial-tracker-app/test/programs.test.ts, apps/tutorial-tracker-app/test/programs-import.test.ts]

mutation_apply:
mutation_command:
mutation_expect:
mutation_cwd:
mutation_timeout:
---

# Plan 255: programs table + full Google Sheet migration

## Summary

- **Problem statement**: The affiliate catalogue lives in a Google Sheet
  (`Affiliate Programs`, 89 rows). A free-text cell with no validation put
  `openart.ai/home/?via=seema` (no scheme) into KV, and the redirector threw on it
  — Cloudflare Error 1101 on 5 live affiliate links for an unknown period. The
  sheet also stores an invisible second value per cell (Google's auto-hyperlink):
  19 rows have a hidden link pointing somewhere different from the visible text,
  including a Skool row whose hidden link is `affiliate.gohighlevel.com`.
- **Goals**:
  - A `programs` table in `TRACKER_DB` that holds every field the sheet holds, so
    the sheet can be retired completely.
  - A tested, idempotent, re-runnable importer that moves all 89 rows in.
  - Harvest the distinct `kind: "external"` tools currently buried in per-card
    `video_tools` JSON into the same table, so one catalogue covers both types.
  - A read/write API for programs, behind the existing Admin role.
  - `PROGRAMS_BACKEND` flag (`"d1" | "sheets"`) copying this app's proven
    `DATA_BACKEND` pattern, so the cutover has a one-line rollback.
- **Decisions confirmed** (owner, this session):
  - Where program rows live -> `TRACKER_DB` (`tracker-db`), NOT `clicks-db`
  - Sheet cutover style -> copy the existing `DATA_BACKEND` flag pattern
  - Dashboard credentials -> ONE plain text field, **no masking** ("keep that as
    it is, it's fine")
  - Coupons -> three fields: `coupon_code`, `coupon_url`, `coupon_terms`
  - Dashboard -> two explicit columns: `dashboard_url`, `dashboard_credentials`
  - Column J (empty in every row) -> the only sheet column deliberately dropped
  - No AI/LLM anywhere in this feature
- **Executor proposed**: `codex` / `gpt-5.6-terra` (owner instruction 2026-08-28: all
  plans in this batch run on codex terra). Fully inlined schema, mapping tables and code
  skeletons, so no judgment calls are left. Escalate to `gpt-5.6-sol` only if this plan
  fails a round on terra (`tooling/boss/data/rules.md` line 22).
- **Done criteria**: migration applies clean; 89 program rows imported;
  every non-empty sheet cell mapped or on the dropped list; `npm test` green with
  the new suites present
- **Stop conditions**: importer would overwrite a non-empty field with an empty
  one; a sheet row maps to a slug that already exists with a different name
- **Test / verification for success**: pure unit tests over the mapping functions
  (`test/programs-import.test.ts`), plus a local D1 apply and row count
- **Open points for plan readiness**: none

## Executor instructions

**Drift check — run this FIRST:**

```bash
git diff --stat 3e730698..HEAD -- apps/tutorial-tracker-app/ apps/redirector/
```

If it shows changes to `src/worker/linkhealth.ts`, `src/worker/linkgen.ts`,
`src/worker/clickstore.ts` or `migrations/`, STOP and report — this plan's
Current state excerpts are quoted from `3e730698` and may be stale.

## Status

- **Priority**: high (the money path)
- **Effort**: medium
- **Risk**: medium (data migration; the sheet stays intact as the fallback)
- **Depends on**: nothing. Builds on commit `6349fa5b`, already landed.
- **Category**: feature
- **Planned-at SHA**: `3e730698`
- **Difficulty**: standard

## Why this matters

The 2026-08-28 incident was not really a missing `https://`. It was that three
layers each trusted the layer above and none of them validated: a spreadsheet
cell that accepts anything, a resolver that only checked the cell was non-empty,
and a redirector that called a throwing API on the result. Phase 0 (commit
`6349fa5b`) fixed layers 2 and 3. This plan fixes layer 1 by replacing the
spreadsheet with a typed table the app owns.

An audit of all 134 live links on 2026-08-28 found, beyond the 6 crashed links,
two silent failures that cost money with no error at all: `bookbolt` resolving to
a bare `bookbolt.io/` (dropping the affiliate id `6671`) and a Skool row whose
hidden hyperlink pointed at a different company's dashboard. Neither is
detectable while the data lives in free-text cells with invisible second values.

## Current state

### The sheet (read 2026-08-28, 89 data rows)

`AFFILIATE_PROGRAMS_SHEET_URL` in `apps/tutorial-tracker-app/wrangler.toml`:
`https://docs.google.com/spreadsheets/d/1dl_nj9djJuXuwwE_5qTnZkS0Y9VW6MmkMxuYNL92tsQ/edit`

Header row, exactly as it is (note TWO columns named `Notes`, one blank column,
and a 14th column with no header at all):

| Col | Index | Header | Non-empty rows | Goes to |
|---|---|---|---|---|
| A | 0 | `Affiliate Program` | 89 | `name` |
| B | 1 | `Slug` | most | `slug` |
| C | 2 | `Where` | 86 | `network` |
| D | 3 | `Notes` | 1 | `notes` (merged) |
| E | 4 | `Approval Status` | 87 | `approval_status` |
| F | 5 | `My Affiliate Link` | 61 | `target_url` |
| G | 6 | `Coupon Status` | 63 | `coupon_status` |
| H | 7 | `Coupon Code` | some | `coupon_code` / `coupon_terms` |
| I | 8 | `Notes` | 15 | `notes` (merged) |
| J | 9 | *(blank header)* | **0** | **DROPPED — the only dropped column** |
| K | 10 | `Dashboard` | 64 | `dashboard_url` |
| L | 11 | `Registered Email` | 68 | `dashboard_credentials` (merged) |
| M | 12 | `Password` | 77 | `dashboard_credentials` (merged) |
| N | 13 | *(no header; rows are 14 wide)* | 7 | `notes` (merged) |

Distinct values actually present (use these EXACTLY; do not invent others):

```
Approval Status : "Approved" (67) | "Rejected" (8) | "To Apply" (6)
                  | "Applied. Waiting for Response" (5) | "" (2)
Coupon Status   : "" (26) | "code received" (19) | "no code" (13)
                  | "Occassional Code" (12) | "need code" (9)
                  | "applied, waiting for response" (9)
Where           : "Website" (52) | "Impact.com" (20) | "partnerstack" (7)
                  | "network" (4) | "" (3) | "PayKickstart" (2)
```

Note `"Occassional Code"` is misspelled in the sheet. Match the sheet's spelling
in the mapping input; the stored token is `occasional`.

Column N holds credential fragments, not notes proper, e.g.
`'payment ( paypal) : khushibakliwal251@gmail.com'`, `'mob number : 9516782062'`,
`'address: Royal Residency, barnagar'`. They still merge into `notes`.

One `Coupon Code` cell crams a code, terms, and a second code together
(`helium 10`): `"AGROLLO10 - 10% discount forever    AGROLLO20 -20% for 6 months discount."`
This is why `coupon_terms` exists. The importer does NOT try to split it —
see Step 4.

### Existing code you build on

`apps/tutorial-tracker-app/src/worker/affiliate.ts` reads the sheet today and
keeps only 7 fields. Read it but do NOT delete it — plan 256 retires its callers,
and the `PROGRAMS_BACKEND="sheets"` fallback still uses it.

```ts
// src/worker/affiliate.ts:26-31 — the existing reader, for reference
export async function loadAffiliateRecords(
  token: string,
  sheetUrl: string,
): Promise<Record<string, AffiliateRecord>> {
  const sheetId = extractSheetId(sheetUrl);
  const rows = await sheetsGet(token, sheetId, "Sheet1!A1:Z999");
```

`src/worker/linkhealth.ts` (landed in `6349fa5b`) already exports everything you
need for URL validation. **Do not write a second URL validator.**

```ts
// src/worker/linkhealth.ts — exported API, use as-is
export function normalizeTargetUrl(raw: string | null | undefined): NormalizedUrl | null
export function creditWarnings(url: string, kind: LinkKind, repaired?: boolean): LinkWarning[]
export type LinkKind = "affiliate" | "external";
```

`src/worker/sheet-id.ts` exports `extractSheetId`. `src/worker/sheets.ts` exports
`sheetsGet(token, sheetId, range)` and `getAccessToken(env)`.

Existing tracker migrations, for naming and style:
`migrations/0002_card_events.sql`, `0003_card_slug.sql`, `0004_backfill_card_slugs.sql`.

The `DATA_BACKEND` flag to copy — `wrangler.toml` `[vars]`:

```toml
DATA_BACKEND = "d1"   # "d1" (Cloudflare D1) or "sheets" (Google Sheets fallback)
```

Admin gating helper already used across the worker:

```ts
// src/worker/index.ts — the existing pattern for an admin-only route
const { roles } = getUser(c);
if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);
```

### Conventions to match

- **Exemplar file for a worker data module**: `src/worker/clickstore.ts` — small
  exported async functions taking `db: D1Database` first, prepared statements
  with `.bind()`, no classes, no ORM.
- **Exemplar for pure logic + tests**: `src/worker/linkgen.ts` with
  `test/linkgen.test.ts`. Pure functions, no I/O, table-driven tests.
- Errors: `return c.json({ error: "<code>", message: "<human sentence>" }, <status>)`.
- No `any` unless the file already uses it.

## Commands you will need

```bash
# from repo root
cd apps/tutorial-tracker-app

npm install                 # first time in a fresh tree
npm test                    # vitest — THE MERGE GATE. Expect "Tests  NNN passed"
npm run typecheck           # tsc -b, must print nothing and exit 0

# apply the new migration to a LOCAL d1 (no network, safe to repeat)
npx wrangler d1 execute tracker-db --local --file=migrations/0005_programs.sql

# inspect the local table afterwards
npx wrangler d1 execute tracker-db --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name='programs'"
```

Baseline before you start: `npm test` prints `Tests  262 passed` and
`Test Files  11 passed`. Your new suites must ADD to that, never reduce it.

## Scope

**In scope — the only files you may create or modify:**

- `apps/tutorial-tracker-app/migrations/0005_programs.sql` (new)
- `apps/tutorial-tracker-app/src/worker/programs.ts` (new)
- `apps/tutorial-tracker-app/src/worker/programs-import.ts` (new)
- `apps/tutorial-tracker-app/src/worker/index.ts` (add routes only)
- `apps/tutorial-tracker-app/wrangler.toml` (add ONE var)
- `apps/tutorial-tracker-app/test/programs.test.ts` (new)
- `apps/tutorial-tracker-app/test/programs-import.test.ts` (new)

**Out of scope — do not touch, even though it looks related:**

- `src/worker/linkhealth.ts` — landed in `6349fa5b`, already correct. Import it.
- `src/worker/linkgen.ts`, `src/worker/clickstore.ts` — plan 257 changes these.
- `src/worker/affiliate.ts` — still needed for the `"sheets"` fallback.
- Any file under `src/client/` — plan 256 owns all UI.
- `apps/redirector/` — finished in `6349fa5b`.
- The Google Sheet itself — read-only from here. Never write to it.

## Steps

### Step 1 — the migration

Create `apps/tutorial-tracker-app/migrations/0005_programs.sql` exactly:

```sql
-- The affiliate/external catalogue, replacing the "Affiliate Programs" Google
-- Sheet. One row per tool. Lives in tracker-db (NOT clicks-db: the redirector
-- owns that schema, per apps/redirector/CLAUDE.md, and programs are not its
-- concern).
--
-- Every column the sheet had is represented. The sheet's blank column J is the
-- only one deliberately dropped.

CREATE TABLE IF NOT EXISTS programs (
  slug                  TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,

  -- 'affiliate' = pays commission, must carry an affiliate code.
  -- 'external'  = no programme exists; a plain homepage is CORRECT for these
  --               and must never be reported as a missing-code fault.
  kind                  TEXT NOT NULL DEFAULT 'affiliate',

  target_url            TEXT NOT NULL DEFAULT '',
  network               TEXT NOT NULL DEFAULT 'other',
  approval_status       TEXT NOT NULL DEFAULT 'unknown',

  coupon_status         TEXT NOT NULL DEFAULT 'unknown',
  coupon_code           TEXT NOT NULL DEFAULT '',
  coupon_url            TEXT NOT NULL DEFAULT '',
  coupon_terms          TEXT NOT NULL DEFAULT '',

  dashboard_url         TEXT NOT NULL DEFAULT '',
  -- Plain text, deliberately not masked (owner decision 2026-08-28).
  dashboard_credentials TEXT NOT NULL DEFAULT '',

  notes                 TEXT NOT NULL DEFAULT '',

  -- Guard fields, written by plan 258's cron. Nullable = never checked yet.
  probe_enabled         INTEGER NOT NULL DEFAULT 1,
  last_checked_at       INTEGER,
  last_status           TEXT,
  last_final_url        TEXT,
  previous_final_url    TEXT,

  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL,
  updated_by            TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_programs_kind     ON programs(kind);
CREATE INDEX IF NOT EXISTS idx_programs_approval ON programs(approval_status);
CREATE INDEX IF NOT EXISTS idx_programs_checked  ON programs(last_checked_at);
```

**Verify:**

```bash
cd apps/tutorial-tracker-app
npx wrangler d1 execute tracker-db --local --file=migrations/0005_programs.sql
npx wrangler d1 execute tracker-db --local --command "SELECT COUNT(*) AS n FROM programs"
```

Expect the second command to print `n` = `0`. Re-running the first must succeed
again (that is what `IF NOT EXISTS` is for).

### Step 2 — the enum vocabularies and mappers (pure, tested)

Create `apps/tutorial-tracker-app/src/worker/programs.ts`. Start with the
vocabularies. These are closed sets — the UI renders exactly these and nothing
else.

```ts
/**
 * programs.ts
 * The affiliate/external catalogue: vocabularies, row type, and D1 access.
 *
 * Replaces the "Affiliate Programs" Google Sheet. The sheet's free-text cells
 * are what let `openart.ai/home/?via=seema` (no scheme) reach KV and crash the
 * redirector on 2026-08-28; every field here is either a closed vocabulary or
 * runs through linkhealth's validator.
 */

import { normalizeTargetUrl } from "./linkhealth";

export const NETWORKS = [
  "website", "impact", "partnerstack", "paykickstart", "network", "other",
] as const;
export type Network = (typeof NETWORKS)[number];

export const APPROVAL_STATUSES = [
  "approved", "applied", "to_apply", "rejected", "unknown",
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const COUPON_STATUSES = [
  "received", "occasional", "none", "needed", "applied", "unknown",
] as const;
export type CouponStatus = (typeof COUPON_STATUSES)[number];

export const KINDS = ["affiliate", "external"] as const;
export type Kind = (typeof KINDS)[number];

/** Labels the UI shows. Keys must stay in sync with the arrays above. */
export const NETWORK_LABELS: Record<Network, string> = {
  website: "Website", impact: "Impact.com", partnerstack: "PartnerStack",
  paykickstart: "PayKickstart", network: "Network", other: "Other",
};
export const APPROVAL_LABELS: Record<ApprovalStatus, string> = {
  approved: "Approved", applied: "Applied, waiting", to_apply: "To apply",
  rejected: "Rejected", unknown: "Not set",
};
export const COUPON_LABELS: Record<CouponStatus, string> = {
  received: "Code received", occasional: "Occasional code", none: "No code",
  needed: "Need code", applied: "Applied, waiting", unknown: "Not set",
};

export interface ProgramRow {
  slug: string;
  name: string;
  kind: Kind;
  target_url: string;
  network: Network;
  approval_status: ApprovalStatus;
  coupon_status: CouponStatus;
  coupon_code: string;
  coupon_url: string;
  coupon_terms: string;
  dashboard_url: string;
  dashboard_credentials: string;
  notes: string;
  probe_enabled: number;
  last_checked_at: number | null;
  last_status: string | null;
  last_final_url: string | null;
  previous_final_url: string | null;
  created_at: number;
  updated_at: number;
  updated_by: string;
}

/** Slug rule, identical to affiliate.ts normalizeToolName so slugs don't shift. */
export function toSlug(name: string): string {
  const s = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return s.replace(/^-+|-+$/g, "");
}
```

Now the validation used by both the API and the importer:

```ts
export interface ProgramValidation {
  ok: boolean;
  /** Present only when ok. The normalized value to store. */
  value?: string;
  /** Blocking reason, shown to the admin. */
  error?: string;
}

/**
 * A program's target URL. `kind` is NOT consulted here: well-formedness is the
 * same question for both kinds. Credit warnings are advisory and come from
 * linkhealth.creditWarnings, which the caller runs separately.
 *
 * An EMPTY target is allowed (an approved programme with no link yet is a real
 * state - 4 rows in the sheet are like this). It simply cannot be published.
 */
export function validateTargetUrl(raw: string, kind: Kind): ProgramValidation {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { ok: true, value: "" };
  const norm = normalizeTargetUrl(trimmed);
  if (!norm) {
    return {
      ok: false,
      error: `Not a usable web address: ${JSON.stringify(trimmed.slice(0, 60))}. Paste the link your affiliate dashboard gives you.`,
    };
  }
  // Our own WordPress hop is refused outright: nothing here can see inside it,
  // and it silently dropped the affiliate code on filmora and bookbolt.
  if (/(^|\.)agrolloo\.com$/i.test(new URL(norm.url).hostname)) {
    return {
      ok: false,
      error: "That is the agrolloo.com redirect, not the real affiliate link. Paste the destination itself.",
    };
  }
  if (kind === "affiliate") {
    const host = new URL(norm.url).hostname;
    const path = new URL(norm.url).pathname;
    if (/^(affiliate|affiliates|partners?|dash|dashboard|console)\./i.test(host) &&
        /^\/(home|dashboard|account|login|performance|analytics|payout|profile)(\/|$|\.)/i.test(path)) {
      return {
        ok: false,
        error: "That looks like your own affiliate dashboard, not a referral link. It would earn nothing.",
      };
    }
  }
  return { ok: true, value: norm.url };
}
```

**Verify:** create `test/programs.test.ts` covering, at minimum, these exact
cases, then run `npm test`:

```ts
import { describe, it, expect } from "vitest";
import { toSlug, validateTargetUrl } from "../src/worker/programs";

describe("toSlug", () => {
  it("matches the sheet's slug shape", () => {
    expect(toSlug("Jungle Scout")).toBe("jungle-scout");
    expect(toSlug("veed.io")).toBe("veed-io");
    expect(toSlug("  Openart  ")).toBe("openart");
  });
});

describe("validateTargetUrl", () => {
  it("repairs the scheme-less value that caused the 1101 incident", () => {
    const r = validateTargetUrl("openart.ai/home/?via=seema", "affiliate");
    expect(r.ok).toBe(true);
    expect(r.value).toBe("https://openart.ai/home/?via=seema");
  });
  it("allows an approved programme with no link yet", () => {
    expect(validateTargetUrl("", "affiliate")).toEqual({ ok: true, value: "" });
  });
  it("refuses prose typed into the link field", () => {
    const r = validateTargetUrl('have multile campaign to choose named as "x"', "affiliate");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Not a usable web address");
  });
  it("refuses the agrolloo.com hop", () => {
    const r = validateTargetUrl("https://agrolloo.com/filmora", "affiliate");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("agrolloo.com redirect");
  });
  it("refuses our own affiliate dashboard", () => {
    const r = validateTargetUrl("https://affiliate.bookbolt.io/account.php", "affiliate");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("dashboard");
  });
  it("does not apply the dashboard rule to external tools", () => {
    expect(validateTargetUrl("https://app.example.com/home", "external").ok).toBe(true);
  });
});
```

Expect `npm test` to print at least `Tests  268 passed`.

### Step 3 — D1 access functions

Append to `src/worker/programs.ts`, matching `clickstore.ts` style:

```ts
const COLS = `slug, name, kind, target_url, network, approval_status,
  coupon_status, coupon_code, coupon_url, coupon_terms, dashboard_url,
  dashboard_credentials, notes, probe_enabled, last_checked_at, last_status,
  last_final_url, previous_final_url, created_at, updated_at, updated_by`;

export async function listPrograms(db: D1Database): Promise<ProgramRow[]> {
  const { results } = await db
    .prepare(`SELECT ${COLS} FROM programs ORDER BY name COLLATE NOCASE`)
    .all();
  return (results ?? []) as unknown as ProgramRow[];
}

export async function getProgram(db: D1Database, slug: string): Promise<ProgramRow | null> {
  return (await db.prepare(`SELECT ${COLS} FROM programs WHERE slug = ?`)
    .bind(slug).first()) as ProgramRow | null;
}

export interface ProgramInput {
  slug: string; name: string; kind: Kind; target_url: string; network: Network;
  approval_status: ApprovalStatus; coupon_status: CouponStatus;
  coupon_code: string; coupon_url: string; coupon_terms: string;
  dashboard_url: string; dashboard_credentials: string; notes: string;
  probe_enabled: number;
}

/**
 * Insert or update by slug. Guard fields are NEVER touched here — only plan
 * 258's cron writes them, and an admin edit must not erase the last check.
 */
export async function upsertProgram(
  db: D1Database, p: ProgramInput, updatedBy: string,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.prepare(
    `INSERT INTO programs (slug, name, kind, target_url, network, approval_status,
       coupon_status, coupon_code, coupon_url, coupon_terms, dashboard_url,
       dashboard_credentials, notes, probe_enabled, created_at, updated_at, updated_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(slug) DO UPDATE SET
       name=excluded.name, kind=excluded.kind, target_url=excluded.target_url,
       network=excluded.network, approval_status=excluded.approval_status,
       coupon_status=excluded.coupon_status, coupon_code=excluded.coupon_code,
       coupon_url=excluded.coupon_url, coupon_terms=excluded.coupon_terms,
       dashboard_url=excluded.dashboard_url,
       dashboard_credentials=excluded.dashboard_credentials,
       notes=excluded.notes, probe_enabled=excluded.probe_enabled,
       updated_at=excluded.updated_at, updated_by=excluded.updated_by`,
  ).bind(
    p.slug, p.name, p.kind, p.target_url, p.network, p.approval_status,
    p.coupon_status, p.coupon_code, p.coupon_url, p.coupon_terms,
    p.dashboard_url, p.dashboard_credentials, p.notes, p.probe_enabled,
    now, now, updatedBy,
  ).run();
}

export async function deleteProgram(db: D1Database, slug: string): Promise<void> {
  await db.prepare("DELETE FROM programs WHERE slug = ?").bind(slug).run();
}
```

**Verify:** `npm run typecheck` exits 0.

### Step 4 — the sheet importer (pure mapping + a thin runner)

Create `apps/tutorial-tracker-app/src/worker/programs-import.ts`.

The mapping tables are the whole point of this step. Use them EXACTLY — every
key is a value observed in the live sheet on 2026-08-28.

```ts
/**
 * programs-import.ts
 * One-time (but idempotent) import of the "Affiliate Programs" sheet into the
 * programs table. Kept separate from programs.ts so it can be deleted once the
 * sheet is retired, without touching the live catalogue code.
 *
 * The mapping tables below are keyed on values ACTUALLY PRESENT in the sheet on
 * 2026-08-28, misspellings included ("Occassional Code"). An unknown value maps
 * to the 'unknown'/'other' fallback and is reported, never silently dropped.
 */

import { sheetsGet } from "./sheets";
import { extractSheetId } from "./sheet-id";
import {
  toSlug, validateTargetUrl,
  type ApprovalStatus, type CouponStatus, type Network, type ProgramInput,
} from "./programs";

const NETWORK_MAP: Record<string, Network> = {
  "website": "website",
  "impact.com": "impact",
  "partnerstack": "partnerstack",
  "paykickstart": "paykickstart",
  "network": "network",
  "": "other",
};

const APPROVAL_MAP: Record<string, ApprovalStatus> = {
  "approved": "approved",
  "rejected": "rejected",
  "to apply": "to_apply",
  "applied. waiting for response": "applied",
  "": "unknown",
};

const COUPON_MAP: Record<string, CouponStatus> = {
  "code received": "received",
  "no code": "none",
  "occassional code": "occasional",   // sheet's spelling
  "occasional code": "occasional",    // in case it is ever corrected
  "need code": "needed",
  "applied, waiting for response": "applied",
  "": "unknown",
};

export interface ImportIssue {
  row: number;
  slug: string;
  field: string;
  detail: string;
}

export interface ImportResult {
  programs: ProgramInput[];
  issues: ImportIssue[];
  /** Every non-empty cell we did NOT carry across, so nothing is lost silently. */
  droppedCells: { row: number; column: string; value: string }[];
}

const COL = {
  name: 0, slug: 1, network: 2, notesD: 3, approval: 4, target: 5,
  couponStatus: 6, couponCode: 7, notesI: 8, blankJ: 9, dashboard: 10,
  email: 11, password: 12, extraN: 13,
} as const;

/**
 * Pure. Sheet rows (as returned by sheetsGet) -> program inputs + a report.
 * No I/O, no D1, so it is fully unit-testable.
 */
export function mapSheetRows(rows: string[][]): ImportResult {
  const programs: ProgramInput[] = [];
  const issues: ImportIssue[] = [];
  const droppedCells: ImportResult["droppedCells"] = [];
  const cell = (r: string[], i: number) => (i < r.length ? (r[i] ?? "").trim() : "");

  for (let n = 1; n < rows.length; n++) {
    const r = rows[n];
    const rowNo = n + 1;                  // 1-based sheet row, header is row 1
    const name = cell(r, COL.name);
    if (!name) continue;                  // trailing blank rows

    const slug = toSlug(cell(r, COL.slug) || name);
    if (!slug) {
      issues.push({ row: rowNo, slug: "", field: "slug", detail: `cannot derive a slug from ${JSON.stringify(name)}` });
      continue;
    }

    const rawNetwork = cell(r, COL.network).toLowerCase();
    const network = NETWORK_MAP[rawNetwork];
    if (network === undefined) {
      issues.push({ row: rowNo, slug, field: "network", detail: `unmapped value ${JSON.stringify(cell(r, COL.network))} -> other` });
    }

    const rawApproval = cell(r, COL.approval).toLowerCase();
    const approval = APPROVAL_MAP[rawApproval];
    if (approval === undefined) {
      issues.push({ row: rowNo, slug, field: "approval_status", detail: `unmapped value ${JSON.stringify(cell(r, COL.approval))} -> unknown` });
    }

    const rawCoupon = cell(r, COL.couponStatus).toLowerCase();
    const coupon = COUPON_MAP[rawCoupon];
    if (coupon === undefined) {
      issues.push({ row: rowNo, slug, field: "coupon_status", detail: `unmapped value ${JSON.stringify(cell(r, COL.couponStatus))} -> unknown` });
    }

    // The link. A bad one is imported as EMPTY plus an issue: we must never
    // carry a value the redirector would choke on, and must never silently
    // drop the fact that the sheet had something there.
    const rawTarget = cell(r, COL.target);
    const checked = validateTargetUrl(rawTarget, "affiliate");
    let target = "";
    if (checked.ok) {
      target = checked.value ?? "";
    } else {
      issues.push({ row: rowNo, slug, field: "target_url", detail: `${checked.error} (raw: ${JSON.stringify(rawTarget.slice(0, 80))})` });
    }

    // Coupon code vs terms: the sheet crams both into one cell for `helium 10`.
    // A short token-only value is a code; anything longer keeps the whole string
    // in coupon_terms as well, so no information is lost. We do NOT try to parse
    // it apart - a wrong split is worse than showing the raw text.
    const rawCode = cell(r, COL.couponCode);
    const looksLikeCodeOnly = rawCode.length > 0 && rawCode.length <= 20 && !/\s{2,}|[-–]\s*\d|%/.test(rawCode);
    const couponCode = looksLikeCodeOnly ? rawCode : rawCode.split(/\s{2,}|\s-\s/)[0]?.trim() ?? "";
    const couponTerms = looksLikeCodeOnly ? "" : rawCode;

    // Credentials: L + M + N, labelled so the merge stays readable.
    const credParts: string[] = [];
    if (cell(r, COL.email)) credParts.push(`email: ${cell(r, COL.email)}`);
    if (cell(r, COL.password)) credParts.push(`password: ${cell(r, COL.password)}`);
    if (cell(r, COL.extraN)) credParts.push(cell(r, COL.extraN));

    // Notes: both "Notes" columns, labelled by origin so a reader can tell them apart.
    const noteParts: string[] = [];
    if (cell(r, COL.notesD)) noteParts.push(cell(r, COL.notesD));
    if (cell(r, COL.notesI)) noteParts.push(cell(r, COL.notesI));

    // Column J is blank in every row. If a value ever appears there, report it
    // rather than dropping it on the floor.
    if (cell(r, COL.blankJ)) {
      droppedCells.push({ row: rowNo, column: "J", value: cell(r, COL.blankJ) });
    }

    programs.push({
      slug,
      name,
      kind: "affiliate",             // the sheet only ever held commission programmes
      target_url: target,
      network: network ?? "other",
      approval_status: approval ?? "unknown",
      coupon_status: coupon ?? "unknown",
      coupon_code: couponCode,
      coupon_url: "",                // no such column in the sheet; new field
      coupon_terms: couponTerms,
      dashboard_url: cell(r, COL.dashboard),
      dashboard_credentials: credParts.join("\n"),
      notes: noteParts.join("\n\n"),
      probe_enabled: 1,
    });
  }
  return { programs, issues, droppedCells };
}

/** Thin I/O wrapper. Reads the sheet, returns the mapped result. */
export async function readSheetForImport(
  token: string, sheetUrl: string,
): Promise<ImportResult> {
  const rows = await sheetsGet(token, extractSheetId(sheetUrl), "Sheet1!A1:Z999");
  return mapSheetRows(rows);
}
```

**Verify:** create `test/programs-import.test.ts` with a fixture built from REAL
sheet rows (copy these verbatim — they are the rows that caused the incident):

```ts
import { describe, it, expect } from "vitest";
import { mapSheetRows } from "../src/worker/programs-import";

const HEADER = ["Affiliate Program","Slug","Where","Notes","Approval Status",
  "My Affiliate Link","Coupon Status","Coupon Code","Notes","","Dashboard",
  "Registered Email","Password"];

describe("mapSheetRows", () => {
  it("repairs the scheme-less OpenArt link", () => {
    const r = mapSheetRows([HEADER, ["Openart","openart","Website","","Approved",
      "openart.ai/home/?via=seema","code received","AGROLLO","","",
      "https://affiliate.openart.ai/","khushibakliwal@agrolloo.com","Solarsystem@123"]]);
    expect(r.programs[0].slug).toBe("openart");
    expect(r.programs[0].target_url).toBe("https://openart.ai/home/?via=seema");
    expect(r.issues).toHaveLength(0);
  });

  it("imports a prose link field as empty and reports it", () => {
    const r = mapSheetRows([HEADER, ["clickfunnels","clickfunnels","Website","","Approved",
      'have multile campaign to choose named as "Manage Affiliate Codes"',"","","","","","",""]]);
    expect(r.programs[0].target_url).toBe("");
    expect(r.issues.some(i => i.field === "target_url")).toBe(true);
  });

  it("refuses the agrolloo.com hop and reports it", () => {
    const r = mapSheetRows([HEADER, ["filmora ","filmora","Impact.com","","Approved",
      "https://agrolloo.com/filmora","Occassional Code","","","","","",""]]);
    expect(r.programs[0].target_url).toBe("");
    expect(r.issues.some(i => i.detail.includes("agrolloo.com"))).toBe(true);
    expect(r.programs[0].coupon_status).toBe("occasional");
  });

  it("merges both Notes columns and the unnamed 14th column into credentials/notes", () => {
    const r = mapSheetRows([HEADER, ["alidropship","alidropship","Website","","Approved",
      " https://alidropship.com/?via=21184 ","Occassional Code","","needs a wise account","",
      "https://affiliates.alidropship.com/","khushibakliwal@agrolloo.com","Solarsystem@123",
      "mob number : 9516782062"]]);
    const p = r.programs[0];
    expect(p.target_url).toBe("https://alidropship.com/?via=21184");
    expect(p.notes).toContain("needs a wise account");
    expect(p.dashboard_credentials).toContain("email: khushibakliwal@agrolloo.com");
    expect(p.dashboard_credentials).toContain("password: Solarsystem@123");
    expect(p.dashboard_credentials).toContain("mob number : 9516782062");
  });

  it("splits a crammed coupon cell without losing the original", () => {
    const r = mapSheetRows([HEADER, ["helium 10","helium-10","Impact.com","","Approved",
      "https://helium10.sjv.io/abc","code received",
      "AGROLLO10 - 10% discount forever    AGROLLO20 -20% for 6 months discount.","","","","",""]]);
    expect(r.programs[0].coupon_code).toBe("AGROLLO10");
    expect(r.programs[0].coupon_terms).toContain("AGROLLO20");
  });

  it("maps every approval and coupon value present in the live sheet", () => {
    const approvals = ["Approved","Rejected","To Apply","Applied. Waiting for Response",""];
    const expected = ["approved","rejected","to_apply","applied","unknown"];
    approvals.forEach((a, i) => {
      const r = mapSheetRows([HEADER, ["x","x","Website","",a,"","","","","","","",""]]);
      expect(r.programs[0].approval_status).toBe(expected[i]);
      expect(r.issues.filter(x => x.field === "approval_status")).toHaveLength(0);
    });
  });

  it("skips trailing blank rows", () => {
    expect(mapSheetRows([HEADER, ["","","","","","","","","","","","",""]]).programs).toHaveLength(0);
  });
});
```

Run `npm test`. Expect at least `Tests  275 passed`.

### Step 5 — harvest the external tools out of card JSON

External tools are not in the sheet — they live per-card as
`{"kind":"external","name":"Cursor","url":"https://cursor.com"}` inside the
`video_tools` JSON column. Without them the catalogue is incomplete and the
Programs view cannot show Cursor or Zapier.

Append to `programs-import.ts`:

```ts
/**
 * Distinct external tools embedded in per-card video_tools JSON, as program
 * inputs. Cards keep their JSON; this only seeds the catalogue so external
 * tools become reusable and checkable.
 *
 * Later duplicates lose to earlier ones: first URL seen for a slug wins, and a
 * conflicting URL is reported rather than silently overwritten.
 */
export function harvestExternalTools(
  cards: { row_id?: string; video_tools?: unknown }[],
): { programs: ProgramInput[]; issues: ImportIssue[] } {
  const bySlug = new Map<string, ProgramInput>();
  const issues: ImportIssue[] = [];
  for (const card of cards) {
    let tools: unknown[] = [];
    try { tools = JSON.parse((card.video_tools as string) || "[]"); } catch { continue; }
    if (!Array.isArray(tools)) continue;
    for (const t of tools) {
      const tool = t as { kind?: string; name?: string; url?: string };
      if (tool?.kind !== "external") continue;
      const name = (tool.name ?? "").trim();
      const rawUrl = (tool.url ?? "").trim();
      if (!name) continue;
      const slug = toSlug(name);
      if (!slug) continue;
      const checked = validateTargetUrl(rawUrl, "external");
      const url = checked.ok ? (checked.value ?? "") : "";
      if (!checked.ok) {
        issues.push({ row: 0, slug, field: "target_url", detail: `${checked.error} (card ${card.row_id ?? "?"})` });
      }
      const existing = bySlug.get(slug);
      if (existing) {
        if (url && existing.target_url && url !== existing.target_url) {
          issues.push({ row: 0, slug, field: "target_url", detail: `card ${card.row_id ?? "?"} has a different URL (${url}) than the first seen (${existing.target_url}); kept the first` });
        }
        continue;
      }
      bySlug.set(slug, {
        slug, name, kind: "external", target_url: url, network: "other",
        approval_status: "unknown", coupon_status: "unknown",
        coupon_code: "", coupon_url: "", coupon_terms: "",
        dashboard_url: "", dashboard_credentials: "", notes: "",
        probe_enabled: 1,
      });
    }
  }
  return { programs: [...bySlug.values()], issues };
}
```

**Verify:** add to `test/programs-import.test.ts`:

```ts
import { harvestExternalTools } from "../src/worker/programs-import";

describe("harvestExternalTools", () => {
  it("collects distinct external tools and ignores catalog picks", () => {
    const { programs } = harvestExternalTools([
      { row_id: "r1", video_tools: JSON.stringify([
          { kind: "external", name: "Cursor", url: "https://cursor.com" },
          { kind: "catalog", slug: "openart" }]) },
      { row_id: "r2", video_tools: JSON.stringify([
          { kind: "external", name: "Zapier", url: "zapier.com" }]) },
    ]);
    expect(programs.map(p => p.slug).sort()).toEqual(["cursor", "zapier"]);
    expect(programs.find(p => p.slug === "zapier")!.target_url).toBe("https://zapier.com");
    expect(programs.every(p => p.kind === "external")).toBe(true);
  });

  it("keeps the first URL and reports a conflicting one", () => {
    const { programs, issues } = harvestExternalTools([
      { row_id: "r1", video_tools: JSON.stringify([{ kind: "external", name: "Bolt", url: "https://bolt.new" }]) },
      { row_id: "r2", video_tools: JSON.stringify([{ kind: "external", name: "Bolt", url: "https://bolt.example" }]) },
    ]);
    expect(programs).toHaveLength(1);
    expect(programs[0].target_url).toBe("https://bolt.new");
    expect(issues.some(i => i.detail.includes("different URL"))).toBe(true);
  });

  it("survives malformed video_tools JSON", () => {
    expect(harvestExternalTools([{ row_id: "r1", video_tools: "not json" }]).programs).toHaveLength(0);
  });
});
```

### Step 6 — the API routes

Add to `src/worker/index.ts`. Place them next to the existing `/api/link-drift`
route. Import at the top with the other worker imports:

```ts
import {
  listPrograms, getProgram, upsertProgram, deleteProgram, validateTargetUrl,
  toSlug, NETWORKS, APPROVAL_STATUSES, COUPON_STATUSES, KINDS,
  type ProgramInput,
} from "./programs";
import { readSheetForImport, harvestExternalTools } from "./programs-import";
import { creditWarnings } from "./linkhealth";
```

Routes — every one admin-gated with the existing pattern:

```ts
// GET /api/programs -> the whole catalogue plus the vocabularies the UI renders
app.get("/api/programs", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);
  const programs = await listPrograms(c.env.TRACKER_DB);
  return c.json({
    programs,
    vocab: {
      kinds: KINDS, networks: NETWORKS,
      approvalStatuses: APPROVAL_STATUSES, couponStatuses: COUPON_STATUSES,
    },
  });
});

// POST /api/programs/validate -> what the Add/Edit form calls as you type.
// Deliberately separate from the save so the form can show the verdict first.
app.post("/api/programs/validate", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);
  let body: { target_url?: string; kind?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "invalid JSON body" }, 400); }
  const kind = body.kind === "external" ? "external" : "affiliate";
  const v = validateTargetUrl(body.target_url ?? "", kind);
  return c.json({
    ok: v.ok,
    value: v.value ?? "",
    error: v.error ?? null,
    warnings: v.ok && v.value ? creditWarnings(v.value, kind) : [],
  });
});

// POST /api/programs -> create or update (the Edit path uses the same route)
app.post("/api/programs", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);
  let body: Partial<ProgramInput> & { name?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "invalid JSON body" }, 400); }

  const name = (body.name ?? "").trim();
  if (!name) return c.json({ error: "invalid", message: "Name is required." }, 400);
  const slug = toSlug(body.slug ?? name);
  if (!slug) return c.json({ error: "invalid", message: "Could not build a slug from that name." }, 400);

  const kind = body.kind === "external" ? "external" : "affiliate";
  const v = validateTargetUrl(body.target_url ?? "", kind);
  if (!v.ok) return c.json({ error: "invalid", message: v.error }, 400);

  const pick = <T extends readonly string[]>(vals: T, x: unknown, fallback: T[number]) =>
    (typeof x === "string" && (vals as readonly string[]).includes(x)) ? (x as T[number]) : fallback;

  await upsertProgram(c.env.TRACKER_DB, {
    slug, name, kind,
    target_url: v.value ?? "",
    network: pick(NETWORKS, body.network, "other"),
    approval_status: pick(APPROVAL_STATUSES, body.approval_status, "unknown"),
    coupon_status: pick(COUPON_STATUSES, body.coupon_status, "unknown"),
    coupon_code: (body.coupon_code ?? "").trim(),
    coupon_url: (body.coupon_url ?? "").trim(),
    coupon_terms: (body.coupon_terms ?? "").trim(),
    dashboard_url: (body.dashboard_url ?? "").trim(),
    dashboard_credentials: (body.dashboard_credentials ?? "").trim(),
    notes: (body.notes ?? "").trim(),
    probe_enabled: body.probe_enabled === 0 ? 0 : 1,
  }, getUser(c).email ?? "");

  const saved = await getProgram(c.env.TRACKER_DB, slug);
  return c.json({
    ok: true, program: saved,
    warnings: saved?.target_url ? creditWarnings(saved.target_url, kind) : [],
  });
});

// DELETE /api/programs/:slug
app.delete("/api/programs/:slug", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);
  await deleteProgram(c.env.TRACKER_DB, c.req.param("slug"));
  return c.json({ ok: true });
});

// POST /api/programs/import-from-sheet -> the one-time migration, re-runnable.
// Returns the full report so nothing is lost silently.
app.post("/api/programs/import-from-sheet", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);
  const token = await getAccessToken(c.env);
  const sheet = await readSheetForImport(token, c.env.AFFILIATE_PROGRAMS_SHEET_URL);
  const allRows = await cachedReadRows(c.env);
  const external = harvestExternalTools(allRows as { row_id?: string; video_tools?: unknown }[]);

  const by = getUser(c).email ?? "import";
  for (const p of sheet.programs) await upsertProgram(c.env.TRACKER_DB, p, by);
  for (const p of external.programs) {
    // Never let a harvested external tool clobber a real affiliate programme.
    const existing = await getProgram(c.env.TRACKER_DB, p.slug);
    if (existing) continue;
    await upsertProgram(c.env.TRACKER_DB, p, by);
  }
  return c.json({
    ok: true,
    imported: { affiliate: sheet.programs.length, external: external.programs.length },
    issues: [...sheet.issues, ...external.issues],
    droppedCells: sheet.droppedCells,
  });
});
```

**Note (LESSONS 2026-07-23):** `c.req.param()` returns `undefined` inside
`app.use("/api/*")` wildcard middleware. These are concrete `app.get`/`app.delete`
routes, so `c.req.param("slug")` is fine here. Do not move them into middleware.

**Verify:** `npm run typecheck` exits 0 and `npm test` still passes.

### Step 7 — the backend flag

Add ONE line to `wrangler.toml` `[vars]`, directly under `DATA_BACKEND`:

```toml
# Affiliate catalogue source: "d1" (the programs table) or "sheets" (the legacy
# Google Sheet, via affiliate.ts). Flip + redeploy to switch. Plan 256 reads it.
PROGRAMS_BACKEND = "sheets"
```

It ships as `"sheets"` so this plan changes no runtime behaviour. Plan 256 flips
it to `"d1"` once the UI can manage the table.

**Verify:**

```bash
grep -n 'PROGRAMS_BACKEND = "sheets"' apps/tutorial-tracker-app/wrangler.toml
```

## Test plan

| File | Follows | Covers |
|---|---|---|
| `test/programs.test.ts` (new) | `test/linkgen.test.ts` | `toSlug`, `validateTargetUrl` — incident value, empty target, prose, agrolloo hop, dashboard link, external exemption |
| `test/programs-import.test.ts` (new) | `test/linkgen.test.ts` | `mapSheetRows` on real sheet rows; every approval/coupon value in the live sheet; note + credential merging; crammed coupon cell; `harvestExternalTools` incl. conflict and malformed JSON |

Both are pure-logic vitest files. No D1, no network, no fixtures on disk.

## Done criteria

Run each; all must hold.

```bash
cd apps/tutorial-tracker-app

# 1. the gate
npm test
#    -> "Test Files  13 passed", "Tests" count >= 285

# 2. the new suites actually exist and are not empty
#    (LESSONS 2026-08-17: vitest exits 0 when a specified test file is simply absent)
test -s test/programs.test.ts && test -s test/programs-import.test.ts && echo BOTH_PRESENT
#    -> BOTH_PRESENT

# 3. types
npm run typecheck            # exit 0, no output

# 4. migration applies, twice, clean
npx wrangler d1 execute tracker-db --local --file=migrations/0005_programs.sql
npx wrangler d1 execute tracker-db --local --file=migrations/0005_programs.sql
npx wrangler d1 execute tracker-db --local --command \
  "SELECT COUNT(*) AS cols FROM pragma_table_info('programs')"
#    -> cols = 21

# 5. the flag is present and OFF
grep -q 'PROGRAMS_BACKEND = "sheets"' wrangler.toml && echo FLAG_OFF
#    -> FLAG_OFF

# 6. no second URL validator was introduced
#    (linkhealth.ts is the only one; this must print exactly 0)
grep -rn "https\?://" src/worker/programs.ts | grep -c "RegExp\|new RegExp" 
#    -> 0
```

The **remote** migration and the import are NOT run by this plan — they are an
owner-run step recorded in Maintenance notes, because they touch production data.

## STOP conditions

- **The importer would write a non-empty field to empty.** `upsertProgram` uses
  `excluded.*` for every column, so a re-run with a worse sheet would overwrite.
  If you find a case where re-running the import degrades an admin's later edit,
  STOP and report — do not invent a merge policy.
- **Two sheet rows map to the same slug.** The sheet has near-duplicates
  (`submaigc` / `submagic`, `nameheap` / namecheap). If `mapSheetRows` produces a
  duplicate slug, STOP and report the pairs. Do not auto-rename.
- **A gate assertion fails.** Fix the code or the fixture. Weakening, swapping or
  deleting an assertion is a STOP.
- **You are about to modify `src/worker/linkhealth.ts`.** STOP. It is out of
  scope and already correct; import from it instead.
- **You are about to write to the Google Sheet.** STOP. This plan is read-only
  against the sheet, always.
- **A test opens an HTTP server or process.** These suites must stay pure. If you
  find yourself needing one, STOP — the design is wrong (LESSONS 2026-07-31: such
  tests hang the runner forever and the failure is invisible).

## Maintenance notes

- **Owner-run, after this merges** (not part of the plan's gate):
  ```bash
  cd apps/tutorial-tracker-app
  npx wrangler d1 migrations apply tracker-db --remote
  # then, signed in as an Admin on tutorials-tracker.agrolloo.com:
  curl -X POST https://tutorials-tracker.agrolloo.com/api/programs/import-from-sheet \
       -H 'cookie: <your session cookie>'
  ```
  Read the `issues` array in the response before trusting the import. Expect
  entries for `clickfunnels` (prose in the link field), `filmora`, `bookbolt` and
  the other `agrolloo.com` rows — those are the real defects the audit found, not
  importer bugs.
- The sheet stays untouched and `PROGRAMS_BACKEND="sheets"` remains the live
  path until plan 256 flips it. That is the rollback.
- A reviewer should scrutinise: the coupon code/terms split heuristic (it is a
  heuristic on purpose and keeps the original text either way), and that
  `upsertProgram` never writes the five guard columns.
- Plan 258's cron owns `probe_enabled`, `last_checked_at`, `last_status`,
  `last_final_url`, `previous_final_url`. Nothing else may write them.
