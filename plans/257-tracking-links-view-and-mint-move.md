<!-- boss frontmatter -->
---
executor: codex
model: gpt-5.6-terra
test_cmd: cd apps/tutorial-tracker-app && npm test
ui: true
deploy:
needs: ["255 and 256 must land first"]
needs_prs: [216, 217]
touches: [apps/tutorial-tracker-app/src/worker/index.ts, apps/tutorial-tracker-app/src/worker/catalog.ts, apps/tutorial-tracker-app/src/worker/clickstore.ts, apps/tutorial-tracker-app/src/client/LinksTab.tsx, apps/tutorial-tracker-app/src/client/TrackingLinks.tsx, apps/tutorial-tracker-app/src/client/MintLinks.tsx, apps/tutorial-tracker-app/src/client/CardDetail.tsx, apps/tutorial-tracker-app/wrangler.toml, apps/tutorial-tracker-app/test/catalog.test.ts, apps/tutorial-tracker-app/test/tracking-links-ui.test.tsx]

# --- Mutation gate. This plan adds the analytics-protection gate, so boss must prove it fires.
# The gate is BEHAVIOURAL (a fake D1 records every statement the code prepares), never a grep
# over source text — a source-text assertion makes its own mutation circular, which is how the
# 2026-08-02 pair of gates shipped unable to fire. The mutation turns clickCounts' SELECT into
# a DELETE, which is a real defect, and the recorder catches it.
mutation_apply: perl -pi -e 's/SELECT slug, COUNT\(\*\) AS n FROM clicks/DELETE FROM clicks WHERE 1=0 AND/' apps/tutorial-tracker-app/src/worker/clickstore.ts
mutation_command: npm test
mutation_expect: CLICKS_READONLY_GATE
mutation_cwd: apps/tutorial-tracker-app
mutation_timeout: 600
---

# Plan 257: Tracking links view, and minting moves out of the video card

## Summary

- **Problem statement**: Link minting lives inside a single video's card
  (`CardDetail.tsx` -> `LinkStudio`), so there is no place to see all 134 live
  `go.agrolloo.com` links at once, and no way to tell which of them still earn
  money. The catalogue also still reads the Google Sheet on the minting path,
  even though plan 255 built the table.
- **Goals**:
  - A **Tracking links** sub-view listing every live link, grouped by video, with
    real click counts and the last check result.
  - Move minting out of `CardDetail` into the Links tab as the third Add type.
  - Point the minting path at the `programs` table and flip
    `PROGRAMS_BACKEND = "d1"`, so the sheet is no longer read anywhere.
  - Store `kind` on every newly minted link (the column landed in `6349fa5b`).
- **Decisions confirmed** (owner, this session):
  - Link minting is removed from the tutorial tracker card and lives only in the
    new tab ("Remove all this ... adding the link logic from tutorial tracker")
  - Edit must exist for a tracking link too, not only for programs
  - Click counts are the owner's real analytics and must not be disturbed
  - `PROGRAMS_BACKEND` flips to `"d1"` here, once both readers use the table
  - No AI/LLM anywhere in this feature
- **Executor proposed**: `codex` / `gpt-5.6-terra` (owner instruction 2026-08-28:
  every plan in this batch runs on codex terra). Escalate to `gpt-5.6-sol` only
  if this plan fails a round on terra (`tooling/boss/data/rules.md` line 22).
- **Done criteria**: `npm test` green with both new suites present and executed;
  `LinkStudio` no longer imported by `CardDetail`; `PROGRAMS_BACKEND = "d1"`;
  no code path writes to the `clicks` table except the redirector; screenshot
  committed
- **Stop conditions**: anything would INSERT into or DELETE from `clicks`; a
  live short link's destination would change without an explicit confirm
- **Test / verification for success**: pure unit tests on the catalogue adapter,
  component tests on the grouped list and the mint flow, plus a grep gate proving
  no new writer to `clicks`
- **Open points for plan readiness**: none

## Executor instructions

**Drift check — run this FIRST:**

```bash
git diff --stat 3e730698..HEAD -- apps/tutorial-tracker-app/
```

`src/worker/programs.ts`, `src/client/LinksTab.tsx` and
`src/client/ProgramForm.tsx` MUST exist (plans 255, 256). If any is missing,
STOP — this plan cannot run before they land.

## Status

- **Priority**: high
- **Effort**: large
- **Risk**: medium-high (touches the money path and the analytics table)
- **Depends on**: plans 255, 256
- **Category**: feature
- **Planned-at SHA**: `3e730698`
- **Difficulty**: standard

## Why this matters

The 2026-08-28 audit could only be done by hand, with a script written for the
occasion, because nothing in the app can answer "show me every live link and
whether it still pays". It found 6 links returning a crash page and 2 more that
returned HTTP 200 while earning nothing. The owner had no way to see either.

This plan builds the view that makes that state visible, and finishes the sheet
retirement by pointing the minting path at the table.

**The click-count constraint is load-bearing.** The owner's words: *"I don't want
my count data to be unnecessarily impacted and give me the false counts. Those
are my real analytics."* The `clicks` table in `clicks-db` is written by exactly
one thing — the redirector Worker, when a human hits `go.agrolloo.com/...`. This
plan reads that table and must never write to it. A grep gate in Done criteria
enforces that.

## Current state

### Minting today lives in the card

```tsx
// src/client/CardDetail.tsx:19
import { LinkStudio } from "./LinkStudio";
// src/client/CardDetail.tsx:353
<LinkStudio rowId={row.row_id!} videoTitle={row.video_title || row.row_id!} initialTools={initialTools} onSaved={onSaved} /> </div>
```

`src/client/LinkStudio.tsx` already has the two-type add mode this plan
generalises:

```tsx
// src/client/LinkStudio.tsx:1-3, 29
import { affiliateCatalog, saveVideoTools, linkPreview, linkConfirm, updateCell,
         type AffiliateCatalogItem, type PreviewResult } from "./api";
const [addMode, setAddMode] = useState<null | "catalog" | "external">(null);
```

### The worker's minting path, and the sheet read it still does

`src/worker/index.ts` resolves the catalogue through `cachedAffiliates(c.env)`,
which reads the Google Sheet via `loadAffiliateRecords` in
`src/worker/affiliate.ts`. That is the last remaining sheet reader on the money
path.

```ts
// src/worker/index.ts — the confirm handler, as it stands after 6349fa5b
const affiliates = await cachedAffiliates(c.env);
const resolved = resolveSelection(tools, affiliates);
...
const existing = await clickstore.existingSlugs(db, finalVideoCode);
for (const i of finalItems.filter(x => x.status !== "blocked")) {
  const fullSlug = `${finalVideoCode}/${i.slug}`;
  if (!existing.has(fullSlug)) {
    await clickstore.insertLink(db, fullSlug, finalVideoCode, i.slug, i.target_url, i.status === "affiliate" ? "affiliate" : "external");
    await c.env.CLICKS_KV.put(fullSlug, i.target_url);
  }
}
```

`resolveSelection` consumes `Record<string, AffiliateRecord>`:

```ts
// src/worker/affiliate.ts:10-18
export interface AffiliateRecord {
  tool: string; displayName: string; targetUrl: string;
  approvalStatus: string; couponStatus: string; couponCode: string;
  isApproved: boolean;
}
```

That shape is the adapter seam: a `programs` row maps onto it exactly, so
`linkgen.ts` needs **no change at all**.

### The links + clicks tables (clicks-db, owned by the redirector)

```sql
-- links, after migration 0003 (landed 6349fa5b)
slug TEXT PRIMARY KEY, video_code TEXT NOT NULL, tool TEXT NOT NULL,
target_url TEXT NOT NULL, created_at INTEGER NOT NULL, kind TEXT

-- clicks — READ ONLY from this app, always
slug TEXT, clicked_at INTEGER, ip_hash TEXT, ua_hash TEXT, referer TEXT
```

`src/worker/clickstore.ts` is the access module. It currently has
`insertLink`, `existingSlugs`, `existingCodes`, `insertVideo`, `linksForVideo`,
`updateLinkTarget`, `linkDriftDiff`. It has **no** click-count query yet.

### Conventions to match

- **Exemplar worker data module**: `src/worker/clickstore.ts`.
- **Exemplar component**: `src/client/TeamPanel.tsx`; and `src/client/LinksTab.tsx`
  from plan 256 for the sub-view idiom.
- **`erasableSyntaxOnly` is ON**: no TS `enum`, no constructor parameter properties.
- Design reference (owner-approved 2026-08-28):
  `https://claude.ai/code/artifact/ef5c97da-f174-4dd6-8c51-a13a60d6d45d`
  Artboards `AllLinks` (this plan's list) and `MintLinks` (this plan's Add type 3).

## Commands you will need

```bash
cd apps/tutorial-tracker-app
npm install
npm test              # THE MERGE GATE
npm run typecheck     # exit 0
npm run build         # must succeed
npm run dev           # for the screenshot
```

Baseline after plan 256: `Test Files  14 passed`, `Tests >= 298`.

## Scope

**In scope:**

- `src/worker/catalog.ts` (new — the programs -> AffiliateRecord adapter + the flag)
- `src/worker/clickstore.ts` (add TWO read-only query functions)
- `src/worker/index.ts` (repoint `cachedAffiliates`; add `GET /api/links`)
- `src/client/TrackingLinks.tsx` (new — the grouped list)
- `src/client/MintLinks.tsx` (new — Add type 3)
- `src/client/LinksTab.tsx` (replace the Tracking-links shell)
- `src/client/CardDetail.tsx` (remove the LinkStudio import + mount ONLY)
- `wrangler.toml` (flip `PROGRAMS_BACKEND` to `"d1"`)
- `test/catalog.test.ts` (new)
- `test/tracking-links-ui.test.tsx` (new)

**Out of scope — do not touch:**

- `src/worker/linkgen.ts` — the adapter exists so this file needs no change. If
  you think it does, STOP and report.
- `src/worker/linkhealth.ts` — import only.
- `src/worker/affiliate.ts` — keep it; it is the `"sheets"` rollback path.
- `apps/redirector/**` — the only writer to `clicks`. Never touched here.
- Any migration file. This plan adds no schema.
- `src/client/LinkStudio.tsx` and `src/client/LinkDrift.tsx` — **leave the files
  on disk**, just stop importing them (see Step 6). Deleting them is a separate
  cleanup once the new view has run in production for a week.

## Steps

### Step 1 — the catalogue adapter

Create `src/worker/catalog.ts`. This is the only new intelligence in the plan:
one function that makes a `programs` row look like the `AffiliateRecord` that
`linkgen.ts` already consumes, so nothing downstream changes.

```ts
/**
 * catalog.ts
 * The single place the minting path gets its catalogue from.
 *
 * Honours PROGRAMS_BACKEND:
 *   "d1"     -> the programs table (plan 255). The real source of truth.
 *   "sheets" -> the legacy Google Sheet via affiliate.ts. The rollback.
 *
 * A programs row maps onto AffiliateRecord exactly, so linkgen.ts is untouched.
 */

import { loadAffiliateRecords, type AffiliateRecord } from "./affiliate";
import { listPrograms, type ProgramRow } from "./programs";

/** Pure. One catalogue row -> the shape linkgen already understands. */
export function programToAffiliateRecord(p: ProgramRow): AffiliateRecord {
  return {
    tool: p.slug,
    displayName: p.name,
    targetUrl: p.target_url,
    approvalStatus: p.approval_status,
    couponStatus: p.coupon_status,
    couponCode: p.coupon_code,
    // An EXTERNAL tool has no approval to grant, so it is always publishable.
    // An AFFILIATE tool must be explicitly approved. Getting this backwards
    // would either block every external link or publish unapproved programmes.
    isApproved: p.kind === "external" ? true : p.approval_status === "approved",
  };
}

/** Pure. The whole catalogue, keyed by slug, as linkgen expects. */
export function programsToCatalog(rows: ProgramRow[]): Record<string, AffiliateRecord> {
  const out: Record<string, AffiliateRecord> = {};
  for (const p of rows) out[p.slug] = programToAffiliateRecord(p);
  return out;
}

export interface CatalogEnv {
  PROGRAMS_BACKEND?: string;
  TRACKER_DB: D1Database;
  AFFILIATE_PROGRAMS_SHEET_URL: string;
}

/**
 * The I/O wrapper. `getToken` is injected so this stays testable and so the
 * sheet path is not even reached (no OAuth call) when the backend is "d1".
 */
export async function loadCatalog(
  env: CatalogEnv,
  getToken: () => Promise<string>,
): Promise<Record<string, AffiliateRecord>> {
  if ((env.PROGRAMS_BACKEND ?? "sheets") === "d1") {
    return programsToCatalog(await listPrograms(env.TRACKER_DB));
  }
  return loadAffiliateRecords(await getToken(), env.AFFILIATE_PROGRAMS_SHEET_URL);
}
```

**Verify:** create `test/catalog.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { programToAffiliateRecord, programsToCatalog } from "../src/worker/catalog";
import type { ProgramRow } from "../src/worker/programs";

const row = (over: Partial<ProgramRow> & { slug: string }): ProgramRow => ({
  name: over.slug, kind: "affiliate", target_url: "", network: "other",
  approval_status: "unknown", coupon_status: "unknown", coupon_code: "",
  coupon_url: "", coupon_terms: "", dashboard_url: "", dashboard_credentials: "",
  notes: "", probe_enabled: 1, last_checked_at: null, last_status: null,
  last_final_url: null, previous_final_url: null,
  created_at: 0, updated_at: 0, updated_by: "", ...over,
} as ProgramRow);

describe("programToAffiliateRecord", () => {
  it("an approved affiliate programme is publishable", () => {
    const r = programToAffiliateRecord(row({ slug: "openart", approval_status: "approved", target_url: "https://openart.ai/?via=seema" }));
    expect(r.isApproved).toBe(true);
    expect(r.tool).toBe("openart");
    expect(r.targetUrl).toBe("https://openart.ai/?via=seema");
  });
  it("an UNapproved affiliate programme is not publishable", () => {
    expect(programToAffiliateRecord(row({ slug: "x", approval_status: "rejected" })).isApproved).toBe(false);
    expect(programToAffiliateRecord(row({ slug: "y", approval_status: "unknown" })).isApproved).toBe(false);
  });
  it("an external tool is always publishable — it has no approval to grant", () => {
    expect(programToAffiliateRecord(row({ slug: "cursor", kind: "external", approval_status: "unknown" })).isApproved).toBe(true);
  });
  it("carries the coupon fields linkgen renders", () => {
    const r = programToAffiliateRecord(row({ slug: "z", coupon_code: "AGR25", coupon_status: "received" }));
    expect(r.couponCode).toBe("AGR25");
    expect(r.couponStatus).toBe("received");
  });
});

describe("programsToCatalog", () => {
  it("keys by slug", () => {
    const c = programsToCatalog([row({ slug: "a" }), row({ slug: "b" })]);
    expect(Object.keys(c).sort()).toEqual(["a", "b"]);
  });
});
```

Run `npm test`. Expect `Tests >= 303`.

### Step 2 — read-only click counts

Append to `src/worker/clickstore.ts`. **Both functions are SELECT only.**

```ts
/**
 * Click totals per slug. READ ONLY.
 *
 * The clicks table is the owner's real analytics and is written by exactly one
 * thing: the redirector Worker, on a genuine visit to go.agrolloo.com. Nothing
 * in this app may INSERT, UPDATE or DELETE here.
 */
export async function clickCounts(db: D1Database): Promise<Record<string, number>> {
  const { results } = await db
    .prepare("SELECT slug, COUNT(*) AS n FROM clicks GROUP BY slug")
    .all<{ slug: string; n: number }>();
  const out: Record<string, number> = {};
  for (const r of results ?? []) out[r.slug] = r.n;
  return out;
}

/** Every minted link with its video code. READ ONLY. */
export async function allLinks(
  db: D1Database,
): Promise<{ slug: string; video_code: string; tool: string; target_url: string; kind: string | null; created_at: number }[]> {
  const { results } = await db
    .prepare(`SELECT slug, video_code, tool, target_url, kind, created_at
              FROM links ORDER BY video_code, tool`)
    .all();
  return (results ?? []) as { slug: string; video_code: string; tool: string; target_url: string; kind: string | null; created_at: number }[];
}
```

**Verify:** `npm run typecheck` exits 0. The gate that proves these functions
never write to `clicks` is Step 2b.

### Step 2b — the analytics-protection gate (behavioural, not a grep)

The owner's click data is the one thing here that cannot be regenerated. A grep
over source text would be a weak gate AND its mutation would be circular — that
is exactly how the 2026-08-02 pair of gates shipped unable to fire. So this gate
records what the code actually asks the database to do.

Add this block to `test/catalog.test.ts`. **Every test name in it must contain
the token `CLICKS_READONLY_GATE`** — that is the string boss's mutation gate
greps for in the failure output.

```ts
import { clickCounts, allLinks } from "../src/worker/clickstore";

/** A fake D1 that records every SQL string the code prepares. */
function recordingDb() {
  const statements: string[] = [];
  const stmt: Record<string, unknown> = {};
  stmt.bind = () => stmt;
  stmt.all = async () => ({ results: [] });
  stmt.first = async () => null;
  stmt.run = async () => ({ success: true });
  const db = { prepare(sql: string) { statements.push(sql); return stmt; } };
  return { db: db as unknown as D1Database, statements };
}

const WRITE_VERB = /\b(insert|update|delete|drop|alter|replace)\b/i;

function assertNoWriteToClicks(statements: string[]) {
  for (const sql of statements) {
    if (/\bclicks\b/i.test(sql)) expect(sql).not.toMatch(WRITE_VERB);
  }
}

describe("the clicks table is read-only from this app", () => {
  it("CLICKS_READONLY_GATE clickCounts issues no write against clicks", async () => {
    const { db, statements } = recordingDb();
    await clickCounts(db);
    expect(statements.length).toBeGreaterThan(0);   // it really ran
    assertNoWriteToClicks(statements);
  });

  it("CLICKS_READONLY_GATE allLinks issues no write against clicks", async () => {
    const { db, statements } = recordingDb();
    await allLinks(db);
    expect(statements.length).toBeGreaterThan(0);
    assertNoWriteToClicks(statements);
  });

  it("CLICKS_READONLY_GATE the recorder is capable of catching a write", () => {
    // Without this, a green result could mean "no writes" OR "recorder broken".
    expect(() => assertNoWriteToClicks(["DELETE FROM clicks WHERE 1=0"])).toThrow();
  });
});
```

**Dry-run the frontmatter's mutation recipe NOW.** Plan 175's recipe was wrong
and nobody noticed because nothing executed it.

```bash
cd apps/tutorial-tracker-app
npm test                                    # clean: passes
perl -pi -e 's/SELECT slug, COUNT\(\*\) AS n FROM clicks/DELETE FROM clicks WHERE 1=0 AND/' src/worker/clickstore.ts
npm test 2>&1 | grep -q CLICKS_READONLY_GATE && echo MUTATION_DETECTED
git checkout -- src/worker/clickstore.ts
npm test                                    # passes again
```

If `MUTATION_DETECTED` does not print, fix the recipe or the test names BEFORE
continuing. A gate that cannot fire is worse than no gate: it reads as coverage.

### Step 3 — repoint the worker's catalogue read, and add GET /api/links

In `src/worker/index.ts`:

1. Import the adapter:
   ```ts
   import { loadCatalog } from "./catalog";
   ```
2. Change the body of `cachedAffiliates` so its ONE sheet call becomes the
   adapter call. Keep the existing KV cache wrapper and its TTL exactly as it is
   — only the inner load changes:
   ```ts
   // inside cachedAffiliates, replacing the loadAffiliateRecords(...) call
   const fresh = await loadCatalog(c.env as unknown as CatalogEnv, () => getAccessToken(c.env));
   ```
   If the existing function signature takes `env` rather than `c`, adapt
   accordingly — do not change its callers.
3. Add the list endpoint, next to `/api/programs`:

```ts
// GET /api/links -> every minted link, grouped client-side, with click totals.
// Read-only. Never writes to clicks.
app.get("/api/links", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);
  const db = c.env.DB;
  const [links, counts, rows] = await Promise.all([
    clickstore.allLinks(db),
    clickstore.clickCounts(db),
    cachedReadRows(c.env),
  ]);
  const titleByCode: Record<string, string> = {};
  for (const r of rows as Record<string, unknown>[]) {
    const code = ((r.video_code as string) ?? "").trim();
    if (code) titleByCode[code] = (r.video_title as string) ?? "";
  }
  const programs = await listPrograms(c.env.TRACKER_DB);
  const bySlug: Record<string, (typeof programs)[number]> = {};
  for (const p of programs) bySlug[p.slug] = p;

  return c.json({
    links: links.map((l) => ({
      ...l,
      clicks: counts[l.slug] ?? 0,
      video_title: titleByCode[l.video_code] ?? "",
      // The program's last check, so the list can show health without its own probe.
      last_status: bySlug[l.tool]?.last_status ?? null,
      last_final_url: bySlug[l.tool]?.last_final_url ?? null,
      last_checked_at: bySlug[l.tool]?.last_checked_at ?? null,
    })),
  });
});
```

**Verify:** `npm run typecheck` exits 0; `npm test` still green.

### Step 4 — the Tracking links view

Create `src/client/TrackingLinks.tsx`, exporting `TrackingLinks`.

1. Loads `GET /api/links` on mount.
2. A summary strip of five counts, computed from the payload:
   `Live links` (total) · `Earning` (`kind==="affiliate"` and `last_status` not in
   `{no_credit,dead}`) · `No programme` (`kind==="external"`) ·
   `Cannot check` (`last_status==="unverifiable"`) · `Broken`
   (`last_status==="dead"`). Before plan 258 runs, `last_status` is null
   everywhere, so `Cannot check` and `Broken` read 0 — that is correct.
3. Grouped by `video_code`, newest group first. Group header shows the code as a
   mono chip, the `video_title`, `N links`, and the group's click total.
4. Row columns, in this order: `Short link` (`/{slug}`, mono) · `Tool` ·
   `Type` · `Lands on` · `Clicks` (right-aligned, `tabular-nums`) · `Checked`.
5. Row tint: `last_status === "no_credit"` or `"dead"` -> `bg-destructive/5`;
   `"unverifiable"` -> `bg-warning/10`.
6. An **Edit** action per row that opens a small dialog to change that one link's
   destination, calling the existing `POST /api/link-resync` for a program-backed
   relink, or a new destination typed by hand. **A live link's destination must
   never change without an explicit confirm step naming the old and new values.**
7. A search input filtering on slug, tool or video title.
8. `Re-check all now` and `Export CSV` buttons may render **disabled** with a
   `title` of `Arrives with the link guard` — plan 258 wires them. Do not
   implement either here.

**Degraded/empty states** (required):

| Condition | Renders | Actions |
|---|---|---|
| 403 | `You need the Admin role to see links.` | none |
| 5xx | error text + `Retry` | Edit hidden |
| zero links | `No tracking links yet. Use Add -> Tracking links for a video.` | Add enabled |
| a link whose `tool` has no program row | row still renders; `Lands on` shows the stored `target_url`; `Checked` shows `program missing` | Edit enabled |

That last row matters: a link can outlive its program (the program was deleted).
It must not crash the list.

### Step 5 — Add type 3: MintLinks

Create `src/client/MintLinks.tsx`, exporting `MintLinks`. This is
`LinkStudio.tsx`'s behaviour, relocated and given a video picker.

Reuse the EXISTING endpoints — do not add new ones:
`affiliateCatalog`, `saveVideoTools`, `linkPreview`, `linkConfirm` from
`./api`.

Flow, four numbered sections as in the `MintLinks` artboard:

1. **Which video** — a `Select` over the board rows passed in as a prop
   (`rows: BoardRow[]`, already available to `LinksTab`). Show the video title and
   the existing `video_code` if any.
2. **Which tools** — chips, plus an add control. Chip colour by resolved status:
   affiliate = success tint, external = muted, blocked = destructive tint.
3. **What will be published** — the preview table from `linkPreview`, with a
   `Really lands on` column. Render each item's `warnings` (the field
   `linkgen.ts` added in `6349fa5b`) under its row. A `blocked` item shows its
   `reason` and is visibly excluded.
4. **The description** — the `renderDescription` output, read-only, mono, with a
   copy button.

The confirm button reads `Publish N links` where N counts non-blocked items, and
calls `linkConfirm`. Blocked items must never be silently dropped from the UI —
they show with their reason.

**Verify:** `npm run build` succeeds.

### Step 6 — remove minting from the card, wire the new views in

`src/client/CardDetail.tsx` — exactly two removals:

- delete line 19's `import { LinkStudio } from "./LinkStudio";`
- replace the `<LinkStudio ... />` mount on line 353 with:
  ```tsx
  <div className="text-sm text-muted-foreground">
    Affiliate links are managed in the <span className="font-medium">Links</span> tab.
  </div>
  ```

Do not otherwise change that file.

`src/client/LinksTab.tsx` — replace the plan-256 Tracking-links shell with
`<TrackingLinks />`, and add the third Add type opening `<MintLinks rows={rows} />`.

**Verify:**

```bash
grep -c "LinkStudio" src/client/CardDetail.tsx      # -> 0
grep -c "LinkStudio\|LinkDrift" src/client/LinksTab.tsx  # -> 0
test -f src/client/LinkStudio.tsx && test -f src/client/LinkDrift.tsx && echo FILES_KEPT
npm run build
```

### Step 7 — flip the flag

In `wrangler.toml`:

```toml
PROGRAMS_BACKEND = "d1"
```

Now both the Programs UI and the minting path read the table, so the flag is
truthful. `"sheets"` remains the rollback.

**Verify:** `grep -q 'PROGRAMS_BACKEND = "d1"' wrangler.toml && echo FLAG_ON`

### Step 8 — component tests

Create `test/tracking-links-ui.test.tsx`. Stub `fetch`; assert on rendered text.
At least these nine:

```
1  renders a grouped list: the video code chip, the title and two rows
2  shows the click count for a link, right-aligned and unmodified
3  tints a no_credit row and shows the lost-code note
4  labels an external row's type as External and expects no code
5  renders a link whose program was deleted, showing "program missing", no crash
6  the empty state names the Add path
7  a 403 shows the Admin-role line and no Edit buttons
8  editing a destination requires a confirm that names the old and new value
9  Re-check all / Export CSV render disabled with the "guard" title
```

Plus, in the same file, three for MintLinks:

```
10 a blocked item renders with its reason and is excluded from the publish count
11 the publish button counts only non-blocked items
12 a warning on an affiliate item renders under its row
```

**Verify:**

```bash
npm test
#   -> "Test Files  16 passed", Tests >= 318
test -s test/catalog.test.ts && test -s test/tracking-links-ui.test.tsx && echo SUITES_PRESENT
npm test 2>&1 | grep -q "tracking-links-ui.test.tsx" && echo UI_SUITE_RAN
```

### Step 9 — the screenshot (`ui: true` gate)

Capture the Tracking links view with at least two video groups, and a second
image of the MintLinks preview table. Commit as:

- `apps/tutorial-tracker-app/docs/screenshots/257-tracking-links.png`
- `apps/tutorial-tracker-app/docs/screenshots/257-mint-links.png`

## Test plan

| File | Follows | Covers |
|---|---|---|
| `test/catalog.test.ts` (new) | `test/linkgen.test.ts` | the adapter (especially `isApproved` for external vs unapproved affiliate) AND the `CLICKS_READONLY_GATE` block from Step 2b |
| `test/tracking-links-ui.test.tsx` (new) | `test/programs-ui.test.tsx` (plan 256) | the 12 cases in Step 8 |

## Done criteria

```bash
cd apps/tutorial-tracker-app

npm test                       # "Test Files  16 passed", Tests >= 318
test -s test/catalog.test.ts && test -s test/tracking-links-ui.test.tsx && echo SUITES_PRESENT
npm test 2>&1 | grep -q "tracking-links-ui.test.tsx" && echo UI_SUITE_RAN
npm run typecheck              # exit 0
npm run build                  # succeeds

# minting is out of the card
grep -c "LinkStudio" src/client/CardDetail.tsx        # -> 0
# but the old files still exist (deletion is a later cleanup)
test -f src/client/LinkStudio.tsx && test -f src/client/LinkDrift.tsx && echo FILES_KEPT

# the flag is truthful
grep -q 'PROGRAMS_BACKEND = "d1"' wrangler.toml && echo FLAG_ON

# THE ANALYTICS GATE — behavioural, and proven able to fail
npm test 2>&1 | grep -q "CLICKS_READONLY_GATE" && echo ANALYTICS_GATE_RAN
#   -> ANALYTICS_GATE_RAN
# a source read as a SECOND signal only, never as the gate itself
grep -rniE "(insert|update|delete)[^;]{0,40}\bclicks\b" src/worker/ src/client/ | grep -v "CLICKS_KV" | wc -l
#   -> 0

# linkgen was not modified (the adapter exists so it need not be)
git diff --stat HEAD -- src/worker/linkgen.ts | wc -l
#   -> 0

test -s docs/screenshots/257-tracking-links.png && test -s docs/screenshots/257-mint-links.png && echo SHOTS_OK
```

## STOP conditions

- **Anything would INSERT, UPDATE or DELETE in the `clicks` table.** STOP
  immediately. That table is the owner's real analytics and only the redirector
  writes it. This is the highest-priority stop condition in the plan.
- **A live short link's destination would change without an explicit confirm.**
  134 links are published in YouTube descriptions. STOP.
- **You believe `src/worker/linkgen.ts` must change.** The adapter was designed so
  it does not. STOP and report why.
- **A gate assertion fails.** Fix the code or the fixture. Weakening, swapping or
  deleting an assertion is a STOP.
- **You are about to delete `LinkStudio.tsx` or `LinkDrift.tsx`.** STOP — they
  stay on disk this round on purpose.
- **A test opens an HTTP server or an uncleared timer.** STOP; stub `fetch` and
  use fake timers (LESSONS 2026-07-31).
- **The existing tests would need changing.** They should not. STOP.

## Maintenance notes

- The `CLICKS_READONLY_GATE` block is the durable protection for the owner's
  analytics, and boss's mutation recipe proves it can actually fail. Keep both.
  Never soften the recorder, the write-verb regex, or the third test that proves
  the recorder itself works.
- `LinkStudio.tsx` and `LinkDrift.tsx` become dead code after this plan. Delete
  them in a follow-up once the new view has run in production for a week, so a
  rollback stays cheap.
- After merge the owner should confirm on production that the Programs view shows
  the imported catalogue AND that a fresh mint produces a working short link,
  before the sheet is archived.
- A reviewer should scrutinise: `isApproved` in the adapter (an inverted external
  case would block every external link), and that `cachedAffiliates`' KV cache
  TTL was not changed while its inner loader was swapped.
