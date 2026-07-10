<!-- boss frontmatter -->
---
executor: agy            # claude-p | agy  — owner choice; plan is fully inlined (agy sweet spot)
model: Gemini 3.1 Pro (High)   # owner-selected agy model
test_cmd: cd apps/tutorial-tracker-app && npm test
ui: true                 # adds a review modal + tool-picker section — screenshot required on the PR
deploy: cd apps/tutorial-tracker-app && npm run build && npx wrangler deploy
needs: ["Owner must add a 'Slug' column to the affiliate Google Sheet BEFORE deploy (see STOP conditions); code tolerates its absence but stable identity depends on it."]
---

# Plan 056: Tracker — deterministic, LLM-free affiliate link generation

## Summary

- **Problem statement**: The tutorial-tracker's "Generate links & description" is a single atomic click that lets **Gemini** decide which affiliate links get minted, then writes short-links + overwrites the card in one shot with no review. Four failure modes are silent and invisible to the admin — the worst being a **money leak**: an approved affiliate link exists but Gemini's slug doesn't exactly match the sheet, so it silently falls back to the tool's homepage and the commission is lost. This decides money; it must be deterministic.
- **Goals**:
  - Remove the LLM entirely from the tracker. Zero Gemini calls in this feature.
  - Make the admin's **explicit selection of affiliate-catalog rows** the single source of truth for which links are minted. No name-matching step anywhere in the money path.
  - Split generation into **preview (zero side effects)** → **confirm (mint + write)**, gated by a dedicated **modal** review the admin must look at.
  - Description becomes a **code-assembled template** (no LLM), validated so every planned link appears exactly once.
  - Fix two live bugs: unapproved affiliate URLs can be published; video identity is keyed on the mutable title string.
  - Add a **drift report** so post-publish changes (affiliate URL changed, program deactivated) to already-minted links are visible and one-click re-syncable.
- **Executor proposed**: `agy` / **Gemini 3.1 Pro (High)** — owner's choice. Graded *tricky* (money-critical correctness + a new modal UI + a validation/idempotency path), but the plan is fully inlined (resolver/template/validator/endpoint code in-body), which recent runs show is agy's sweet spot for one-turn single-plan builds. Verify by committed diff + the `npm test` gate.
- **Done criteria** (terse — full list below): `npm test` green with new deterministic tests; `npm run build` + `tsc -b` clean; no `createGeminiClient` / `detectToolsPrompt` / `describePrompt` reachable from the link-gen path; preview endpoint performs zero writes; confirm is idempotent and hash-guarded; blocked tools never get a homepage URL.
- **Stop conditions** (terse — full list below): affiliate sheet lacks a usable catalog to select from; the `video_code`-on-card identity change would require rewriting already-minted prod links (it must not — reuse-by-title stays as a fallback); any step needs a schema change to the shared `clicks-db` `links`/`videos` tables (owned by `apps/redirector`).
- **Test / verification for success**: Vitest unit tests (pure functions: resolver, template renderer, link validator, plan-hash, drift diff) following the existing `test/linkgen.test.ts` style, plus a manual smoke against local D1 (seed script documented). Merge gate = `cd apps/tutorial-tracker-app && npm test`.
- **Open points for plan readiness**: none. (The affiliate-sheet `Slug` column is a human precondition, documented in STOP conditions + Maintenance; the code degrades gracefully without it.)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e5cc93a..HEAD -- apps/tutorial-tracker-app/src/worker/linkgen.ts apps/tutorial-tracker-app/src/worker/affiliate.ts apps/tutorial-tracker-app/src/worker/index.ts apps/tutorial-tracker-app/src/worker/clickstore.ts apps/tutorial-tracker-app/src/client/CardDetail.tsx apps/tutorial-tracker-app/src/client/api.ts`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED (money path; mitigated by determinism + preview-before-mint + tests)
- **Depends on**: none
- **Category**: feature (with two embedded bug fixes)
- **Difficulty**: tricky — money-critical; everything decision-heavy is inlined below, so the executor only places + wires + tests.
- **Planned at**: commit `e5cc93a`, 2026-07-10

## Why this matters

This feature decides which **affiliate** links go into published YouTube descriptions — i.e. it decides money. Today it delegates that decision to an LLM (`gemini-2.5-flash`) reading free-text notes, then mints links + overwrites the card in one un-reviewed click. The reviewed design (owner + a Fable architecture review) concluded: don't wrap a review UI around an LLM pipeline — **remove the LLM from the pipeline**. The admin already knows exactly which 3–8 tools a video features; selecting them from the catalog directly is seconds of work and makes the two catastrophic failure modes (slug-mismatch money leak, hallucinated tool) *structurally impossible* rather than merely "detected." The description carries no money risk once links are code-injected, so it becomes a deterministic template. Intent the executor must preserve: **nothing an LLM produces may ever become a minted URL or a link in the description.**

## Current state

### The feature today (files + roles)

- `src/worker/linkgen.ts` — `processVideo()` orchestrator + pure helpers. Calls Gemini to **detect** tools (`detectToolsPrompt`), resolves each via `resolveTools()` (exact-slug dictionary lookup with **homepage fallback**), mints short links, then calls Gemini again to **write the description** (`describePrompt`). This is the file being replaced.
- `src/worker/affiliate.ts` — `loadAffiliateRecords(token, sheetUrl)` reads the affiliate Google Sheet (`Sheet1!A1:Z999`) and keys each record by `normalizeToolName(displayName)`. Columns consumed: `Affiliate Program`, `My Affiliate Link`, `Approval Status`, `Coupon Status`, `Coupon Code`. **Bug**: keying on the normalized *display name* means renaming a program in the sheet silently changes its identity.
- `src/worker/prompts.ts` — the two Gemini prompts. Becomes dead code for this feature.
- `src/worker/gemini.ts` — Gemini REST client. Becomes unused by this feature (verify no other consumer — recon found none in `src/`).
- `src/worker/clickstore.ts` — D1 adapters for the shared `clicks-db` (tables `videos(video_code, video_title, created_at)`, `links(slug, video_code, tool, target_url, created_at)`; schema owned by `apps/redirector/migrations/0001_init.sql` — **do not alter it**). `videoCodeForTitle()` is the title-keyed lookup to be superseded.
- `src/worker/index.ts:732` — `POST /api/generate-links` handler (admin-only). Reads the card's `video_title`/`video_notes`, calls `loadAffiliateRecords` + `createGeminiClient` + `processVideo`, then `getStore(c.env).updateCells(rowId, {video_description, actual_links, short_links})` + `bustBoardCache`. Returns `{description, links, non_affiliate_tools}`.
- `src/client/CardDetail.tsx:578` — the admin-only "Generate links & description" button + inline result UI (`handleGenerate`, `genResult`, `genError`, `genLoading`).
- `src/client/api.ts:233` — `generateLinks(row_id)` fetch wrapper + `GenerateLinksResult` type.
- `test/linkgen.test.ts`, `test/affiliate.test.ts` — existing unit tests (pure functions, injected fakes — follow this style exactly).

### Load-bearing facts (verified by reading the code)

1. **Storage is normalized D1 `tracker-db`** (`cards` + `card_stages` + `pipelines` + `employees`). The app speaks a flat `Row` assembled by `src/shared/engine/card.ts`. Writes go through `DataStore.updateCells(rowId, values)` in `src/worker/datastore.ts`, which routes each flat col via `routeWrite(p, col)`:
   - Known card cols (`CARD_FIELDS`) → `cards` columns; stage cols → `card_stages`; **any unknown col → `card_extra`** (stored in `cards.extra_json`) — see `card.ts:140-145`. `video_description` routes to `card.description`; `actual_links`/`short_links` route to the publish stage.
   - **This means a new flat col `video_tools` automatically persists to `cards.extra_json` with no engine change** (same mechanism as `topic_date`), and round-trips back onto the flat `Row` on read. Values are strings, so store the tool list as a **JSON string**.
2. `updateCells` accepts `Record<string, string | undefined>` and an optional `expected` for optimistic concurrency. Preview must **not** call it (zero writes).
3. `clicks-db` is the shared money DB (also written by `apps/redirector` + `sync_clicks.py`). Its `videos` table has **no card_id column** — the only persisted link between a card and its `video_code` today is the title string. The fix stores the minted `video_code` **on the tracker card** (in `card_extra`), not by altering `clicks-db`.
4. Gemini config: `GEMINI_API_KEY` secret + `createGeminiClient`. After this plan it is unused by link-gen; leave the secret in place (harmless) but the code path must not call it.
5. `resolveTools` current homepage-fallback + unapproved bug (`linkgen.ts:44-65`):
   ```ts
   if (rec && rec.isApproved && rec.targetUrl.trim()) { /* affiliate */ }
   else {
     const fallback = (rec?.targetUrl.trim() || "") || entry.homepage_url; // <-- publishes rec.targetUrl even when NOT approved
     if (!fallback) continue;  // <-- silently drops
     out.push({ ...entry, targetUrl: fallback, couponCode: "", hasAffiliate: false });
   }
   ```

### Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Install deps | `cd apps/tutorial-tracker-app && npm install` | exit 0 (uses local `.npmrc` → public registry) |
| Unit tests (merge gate) | `cd apps/tutorial-tracker-app && npm test` | `vitest run` all pass |
| Typecheck | `cd apps/tutorial-tracker-app && npm run typecheck` | `tsc -b` exit 0 |
| Lint | `cd apps/tutorial-tracker-app && npm run lint` | exit 0 |
| Build (client+worker) | `cd apps/tutorial-tracker-app && npm run build` | `dist/` built, exit 0 |
| Seed local D1 for manual smoke | `cd apps/tutorial-tracker-app && npx wrangler d1 execute clicks-db --local --file=../redirector/migrations/0001_init.sql` | creates `videos`/`links`/`clicks` locally |
| Dev (UI at :5173, API at :8787) | `cd apps/tutorial-tracker-app && npm run dev:local` | both servers up |

## Scope

**In scope** (only these files may be created/modified):
- `src/worker/affiliate.ts` — add stable `slug` from a `Slug` column (fallback to normalized display name), keep the record shape backward-compatible.
- `src/worker/linkgen.ts` — replace LLM orchestration with the deterministic resolver + templated description + validator + plan-hash (pure functions). Keep `generateVideoCode`.
- `src/worker/clickstore.ts` — add card-keyed video-code helpers; keep title-keyed as fallback; add drift-diff read helpers.
- `src/worker/index.ts` — replace `POST /api/generate-links` with `POST /api/link-preview` + `POST /api/link-confirm`; add `GET /api/link-drift` + `POST /api/link-resync`. (Keep `/api/generate-links` as a thin 410 Gone stub returning a message pointing to the new flow, so any stale client fails loudly, not silently.)
- `src/worker/prompts.ts` — delete the file (or leave, but it must be unreferenced by link-gen).
- `src/client/api.ts` — new fetch wrappers + types for preview/confirm/drift/resync; remove `generateLinks`.
- `src/client/CardDetail.tsx` — add the "Video tools" picker section + the review **modal**; remove the old inline generate UI.
- `src/client/LinkReviewModal.tsx` (**new**) — the dedicated modal component.
- `src/client/LinkDrift.tsx` (**new**) — the admin drift panel (mount in the existing admin surface; see Step 9).
- `test/linkgen.test.ts` — expand (resolver, template, validator, plan-hash).
- `test/affiliate.test.ts` — add `Slug`-column behavior.
- `test/linkdrift.test.ts` (**new**) — drift-diff unit tests.
- `apps/tutorial-tracker-app/CLAUDE.md` — update the API section to describe the new endpoints (docs; keep terse).

**Out of scope** (looks related — do NOT touch, because…):
- `apps/redirector/**` and the `clicks-db` schema (`migrations/0001_init.sql`) — the redirector owns it; changing it risks the live money DB and the redirect service.
- `src/worker/gemini.ts` — leave as-is (may be reused later); just stop calling it. Do not delete (avoids churn + possible other refs).
- `src/shared/engine/**` — no engine change is needed (`video_tools` passes through `card_extra`). Do **not** modify routing.
- `pipelines/**`, `sync_clicks.py`, any cron — unaffected.
- The affiliate Google Sheet's data — the owner edits the sheet (adding the `Slug` column) manually; the executor never writes to it.

## Git workflow

- Branch: `advisor/056-tracker-deterministic-linkgen`
- Commit per step (rollback granularity). Messages: conventional, no AI footers. Do NOT push (boss/secretary handles the PR).

## Steps

### Step 1: Affiliate catalog gets a stable slug (no LLM matching)

In `src/worker/affiliate.ts`, add an optional stable-key column. Keep `normalizeToolName` and the record shape; add a `slug` derivation that prefers an explicit `Slug` column and falls back to the normalized display name (backward compatible with today's sheet).

```ts
// inside loadAffiliateRecords, replacing the slug derivation:
const explicit = cell(row, "Slug");            // new optional column
let slug: string;
try {
  slug = explicit ? normalizeToolName(explicit) : normalizeToolName(display);
} catch { continue; }
```

Add `slug` to `AffiliateRecord` (it already effectively is `tool`; keep `tool = slug`). No other column added — **the `Aliases`/fuzzy layer from the earlier design is intentionally cut**: with manual row selection there is no name→row matching step anywhere, so aliases would have no consumer.

**Verify**: `cd apps/tutorial-tracker-app && npm test -- affiliate` → new test (Step 8) passes; existing `normalizeToolName` tests still pass.

### Step 2: Deterministic resolver + templated description + validator + plan-hash (linkgen.ts)

Rewrite `src/worker/linkgen.ts` so **the admin's selected tools are the only input**. No Gemini import, no `prompts` import. Keep `generateVideoCode`. Author these exact pure functions:

```ts
import type { AffiliateRecord } from "./affiliate";

export type ToolStatus = "affiliate" | "external" | "blocked";

/** What the admin picked, stored on the card as JSON. */
export type VideoTool =
  | { kind: "catalog"; slug: string }
  | { kind: "external"; name: string; url: string };

export interface ResolvedTool {
  slug: string;              // URL path segment + link key
  displayName: string;
  status: ToolStatus;
  targetUrl: string;         // "" when blocked
  couponCode: string;        // "" unless affiliate w/ coupon
  reason?: string;           // human-readable, for blocked
}

const HTTP_RE = /^https?:\/\/\S+$/i;

/** Pure. Selection → resolved plan. NEVER invents a URL; blocked tools carry no URL. */
export function resolveSelection(
  tools: VideoTool[],
  affiliates: Record<string, AffiliateRecord>,
): ResolvedTool[] {
  const out: ResolvedTool[] = [];
  for (const t of tools) {
    if (t.kind === "catalog") {
      const rec = affiliates[t.slug];
      if (!rec) { out.push({ slug: t.slug, displayName: t.slug, status: "blocked", targetUrl: "", couponCode: "", reason: "not in affiliate catalog (deleted or renamed?)" }); continue; }
      if (!rec.isApproved) { out.push({ slug: rec.tool, displayName: rec.displayName, status: "blocked", targetUrl: "", couponCode: "", reason: `affiliate program not approved (status: ${rec.approvalStatus || "unknown"})` }); continue; }
      if (!rec.targetUrl.trim()) { out.push({ slug: rec.tool, displayName: rec.displayName, status: "blocked", targetUrl: "", couponCode: "", reason: "approved but no affiliate link set in the sheet" }); continue; }
      out.push({ slug: rec.tool, displayName: rec.displayName, status: "affiliate", targetUrl: rec.targetUrl.trim(), couponCode: rec.couponCode.trim() });
    } else {
      const url = (t.url || "").trim();
      const name = (t.name || "").trim();
      const slug = name ? safeSlug(name) : "";
      if (!name || !HTTP_RE.test(url)) { out.push({ slug: slug || "external", displayName: name || "(unnamed)", status: "blocked", targetUrl: "", couponCode: "", reason: "external tool needs a name and a valid https URL" }); continue; }
      out.push({ slug, displayName: name, status: "external", targetUrl: url, couponCode: "" });
    }
  }
  return out;
}

function safeSlug(name: string): string {
  const s = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s || "tool";
}

/** Advisory lint (deterministic, NO LLM): warn when an external entry's name
 *  collides with a catalog program the admin owns — the one spot homepage-vs-affiliate
 *  confusion can happen. Never auto-applied. */
export function externalCollisions(tools: VideoTool[], affiliates: Record<string, AffiliateRecord>): string[] {
  const warns: string[] = [];
  for (const t of tools) {
    if (t.kind !== "external" || !t.name?.trim()) continue;
    const norm = safeSlug(t.name);
    if (affiliates[norm]) warns.push(`"${t.name}" is entered as an external link, but you have an affiliate program for it — use the catalog entry to earn commission.`);
  }
  return warns;
}

export interface LinkPlanItem { slug: string; displayName: string; short_url: string; target_url: string; status: ToolStatus; coupon: string; reason?: string; }

/** Deterministic YouTube description. Only linkable (affiliate|external) tools appear. */
export function renderDescription(videoTitle: string, items: LinkPlanItem[]): string {
  const linkable = items.filter((i) => i.status !== "blocked");
  const lines: string[] = [];
  lines.push(`🎥 ${videoTitle.trim()}`, "", "Tools I used in this video:", "");
  for (const i of linkable) {
    lines.push(`▶ ${i.displayName} — ${i.short_url}`);
    if (i.coupon) lines.push(`   Code: ${i.coupon}`);
  }
  lines.push("", "Subscribe for more comparisons 👍");
  return lines.join("\n");
}

/** Belt-and-braces: every planned short_url appears exactly once; no OTHER go-domain URL leaked in. */
export function validateDescription(description: string, items: LinkPlanItem[], linkDomain: string): void {
  for (const i of items.filter((x) => x.status !== "blocked")) {
    const n = description.split(i.short_url).length - 1;
    if (n !== 1) throw new Error(`description integrity: ${i.short_url} appears ${n}× (expected 1)`);
  }
  const domainHits = [...description.matchAll(new RegExp(`https?://${linkDomain.replace(/\./g, "\\.")}/\\S+`, "g"))].map((m) => m[0]);
  const planned = new Set(items.filter((x) => x.status !== "blocked").map((x) => x.short_url));
  for (const h of domainHits) if (!planned.has(h.replace(/[).,]+$/, ""))) throw new Error(`description integrity: unexpected link ${h}`);
}

/** Stable hash of the resolved plan, so confirm can detect the sheet changing under preview. */
export async function planHash(videoCode: string, items: LinkPlanItem[]): Promise<string> {
  const canon = JSON.stringify({ videoCode, items: items.map((i) => [i.slug, i.status, i.target_url, i.coupon]).sort() });
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canon));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}
```

Also author `buildPlan()` — turns resolved tools + a video code into `LinkPlanItem[]` (computing `short_url = https://<linkDomain>/<videoCode>/<slug>` for linkable tools; blocked tools get `short_url: ""`). Keep it pure (no D1). The orchestration that actually mints lives in the endpoint (Step 4), not here — so preview can reuse `buildPlan` with zero writes.

Delete `resolveTools`, `formatShortLinks`, `formatActualLinks`, `processVideo`, `DetectedTool`, and the `LinkGenDeps`/Gemini wiring. `actual_links`/`short_links` text is now derived from the plan (see Step 4).

**Verify**: `cd apps/tutorial-tracker-app && npm test -- linkgen` → all new tests (Step 8) pass; `grep -n "gemini\|prompts\|Gemini" src/worker/linkgen.ts` → no matches.

### Step 3: Card-keyed video identity (clickstore.ts) — bug fix

The video's identity must be the **card**, not its title. Add helpers; keep title-keyed as a legacy fallback so existing prod videos still resolve.

```ts
// video_code is stored ON the card (card_extra "video_code"); these two just read clicks-db state.
export async function linksForVideo(db: D1Database, videoCode: string): Promise<{ slug: string; tool: string; target_url: string }[]> {
  const { results } = await db.prepare("SELECT slug, tool, target_url FROM links WHERE video_code = ?").bind(videoCode).all();
  return (results ?? []) as { slug: string; tool: string; target_url: string }[];
}
export async function updateLinkTarget(db: D1Database, slug: string, targetUrl: string): Promise<void> {
  await db.prepare("UPDATE links SET target_url = ? WHERE slug = ?").bind(targetUrl, slug).run();
}
// keep existingCodes, existingSlugs, insertVideo, insertLink as-is; keep videoCodeForTitle as fallback.
```

Identity resolution order at confirm time (Step 4): (1) `video_code` stored on the card → reuse; (2) else `videoCodeForTitle(title)` (legacy prod match) → reuse **and** backfill it onto the card; (3) else mint a fresh code + store it on the card. This guarantees a title edit never mints a duplicate set.

**Verify**: `cd apps/tutorial-tracker-app && npm run typecheck` → exit 0.

### Step 4: Preview + confirm endpoints (index.ts)

Replace the `POST /api/generate-links` handler. Both new handlers: admin-only (`isAdminRoles`, else 403), load the card by `row_id` from `cachedReadRows`, read `video_title` + `video_tools` (JSON string in the row; parse defensively → `[]`), and `loadAffiliateRecords(token, AFFILIATE_PROGRAMS_SHEET_URL)`.

**`POST /api/link-preview {row_id}` — ZERO writes:**
1. Parse `video_tools`; if empty → `422 {error:"no_tools", message:"Select at least one tool for this video, then preview."}`.
2. `resolved = resolveSelection(tools, affiliates)`.
3. Resolve the video code **read-only**: card's stored `video_code` → else `videoCodeForTitle` → else the literal string `"(new)"` (a placeholder; real mint happens on confirm). Do NOT insert.
4. `items = buildPlan(resolved, videoCode, LINK_DOMAIN)`.
5. `description = renderDescription(title, items)`; `validateDescription(...)`.
6. `warnings = externalCollisions(tools, affiliates)` + a blocked-count summary.
7. `hash = await planHash(videoCode, items)`.
8. Return `{ video_code: videoCode, items, description, warnings, blocked: items.filter(i=>i.status==="blocked"), plan_hash: hash }`. No `updateCells`, no `kvPut`, no `insertLink`.

**`POST /api/link-confirm {row_id, plan_hash}`:**
1. Recompute steps 1–7 above server-side (fresh catalog read).
2. If the recomputed hash ≠ `plan_hash` → `409 {error:"stale", message:"The affiliate sheet changed since you previewed. Re-open the review."}`.
3. Resolve/mint the real video code (Step 3 order); if minted or matched-by-title, store `video_code` onto the card via `updateCells(rowId, { video_code })`.
4. For each **linkable** item whose `slug` isn't already in `existingSlugs(videoCode)`: `insertLink` + `kvPut` (idempotent — skip existing). Blocked items are never minted.
5. Build `actual_links` / `short_links` text from the plan (linkable only) and write `updateCells(rowId, { video_description, actual_links, short_links })` + `bustBoardCache`.
6. Return `{ ok:true, video_code, items, description }`.

Leave a thin `POST /api/generate-links` → `410 {error:"gone", message:"Replaced by /api/link-preview + /api/link-confirm"}` so a stale cached client fails loudly.

**Verify**: `cd apps/tutorial-tracker-app && npm run build` → exit 0. Manual smoke (Step 10) confirms preview writes nothing.

### Step 5: Drift report endpoints (index.ts)

**`GET /api/link-drift`** (admin-only): read all rows, collect each card's stored `video_code`; for each, `linksForVideo(db, code)`; join each link to `affiliates[link.tool]`; emit a drift row when: (a) program missing from catalog now (deactivated/renamed), (b) `affiliates[tool].isApproved === false` now, or (c) `link.target_url !== affiliates[tool].targetUrl.trim()` (URL changed). Return `{ drift: [{ row_id, video_title, slug, tool, minted_url, current_url, kind: "url_changed"|"deactivated"|"missing" }] }`. Coupon drift is **not** detectable from `clicks-db` (coupons live only in the description text) — return a static note advising "re-preview to refresh coupons" rather than a false guarantee.

**`POST /api/link-resync {slug}`** (admin-only): look up the link's `tool`, read current `affiliates[tool]`; if approved with a URL → `updateLinkTarget(db, slug, url)` + `kvPut(slug, url)`; else `409` with the reason. Return `{ ok:true, slug, target_url }`.

Author `linkDriftDiff(links, affiliates)` as a **pure function** in `clickstore.ts` (or a new `src/worker/drift.ts`) so it's unit-testable without D1.

**Verify**: `cd apps/tutorial-tracker-app && npm test -- linkdrift` passes; `npm run typecheck` exit 0.

### Step 6: Client API wrappers (api.ts)

Remove `generateLinks` + `GenerateLinksResult`. Add typed wrappers mirroring `applyDefaults`/`postJSON` style: `linkPreview(row_id)`, `linkConfirm(row_id, plan_hash)`, `linkDrift()`, `linkResync(slug)`, plus the `LinkPlanItem`/`PreviewResult`/`DriftRow` types. Surface `422`/`409` bodies' `message` as thrown errors (same pattern as the old wrapper at `api.ts:233-241`).

**Verify**: `cd apps/tutorial-tracker-app && npm run typecheck` → exit 0.

### Step 7: Client — tool picker section + review modal (CardDetail.tsx + new components)

Remove the old inline generate block (`CardDetail.tsx:578-597`, the `handleGenerate`/`genResult`/`genError`/`genLoading` machinery).

Add, admin-only (`isAdmin && !readOnly`), a **"Video tools"** section that edits the card's `video_tools` (persist via the existing field-write path — it's a normal flat col; store `JSON.stringify(tools)` and read via the row value). The section:
- Lists selected tools as chips with status color (green affiliate / blue external / red blocked).
- "Add from catalog" → a searchable dropdown populated from a new `GET /api/affiliate-catalog` (admin-only; returns `[{slug, displayName, isApproved, hasCoupon}]` from `loadAffiliateRecords`) — the admin picks a **row**, not free text.
- "Add external link" → name + https URL inputs (the visually distinct path).
- A **"Preview links & description"** button → calls `linkPreview(row_id)` → opens `LinkReviewModal`.

`src/client/LinkReviewModal.tsx` (new) — a real modal (use the app's existing Radix dialog primitive; check `components.json`/`radix-ui` usage in the codebase for the house dialog). It must:
- Show a per-tool table with the status badge: ✅ affiliate (+ coupon), 🔵 external, 🔴 **blocked — will NOT be linked** (+ the `reason`).
- Show `warnings` prominently (amber) and a blocked-count banner if any.
- Show the templated `description` (read-only) with a Copy button, and the link list.
- **Confirm** button (calls `linkConfirm(row_id, plan_hash)`) and **Cancel**. On `409 stale`, show the message and a "Re-preview" action. Confirm is the only path that mutates anything.

Acceptance rubric for the modal (a tier-3 reviewer / screenshot scores against THIS, not general taste):
- [ ] Blocked tools are visually unmistakable (red + explicit "will not be linked" text) and cannot be confused with linked ones.
- [ ] No mutation happens until Confirm (verify: opening + cancelling preview leaves `actual_links` unchanged).
- [ ] Coupon shown next to its tool where present.
- [ ] Warnings (external-collision) are visible without scrolling past the table.
- [ ] Works in light + dark (the app is theme-aware — follow existing `dark:` class patterns).

**Verify**: `cd apps/tutorial-tracker-app && npm run build` → exit 0; `npm run lint` → exit 0. Screenshot attached to PR (see Step 10).

### Step 8: Unit tests (test/linkgen.test.ts + test/affiliate.test.ts)

Follow the existing injected-fake style. Add:
- `resolveSelection`: catalog+approved+url → `affiliate`; catalog+**unapproved** → `blocked` (reason mentions not approved) and **no URL** (this is the money-leak bug fix — assert `targetUrl===""`); catalog+approved+**blank url** → `blocked`; catalog+**missing** → `blocked`; external+valid → `external`; external+bad url → `blocked`.
- `renderDescription`: blocked tools excluded; coupon line present only when coupon; deterministic (same input → identical string).
- `validateDescription`: passes for a well-formed description; throws if a short_url is duplicated or a foreign go-domain URL is injected.
- `planHash`: stable across calls for identical input; changes when a target_url changes.
- `externalCollisions`: warns when an external name normalizes to a catalog slug.
- `affiliate.test.ts`: a `Slug` column value is used as the key when present; falls back to normalized display name when absent.

**Verify**: `cd apps/tutorial-tracker-app && npm test` → all pass (existing 49 + new; the two old `processVideo`/`resolveTools`/`formatters` describe-blocks in `linkgen.test.ts` are replaced, not left dangling against deleted exports).

### Step 9: Drift tests + mount the drift panel

- `test/linkdrift.test.ts`: `linkDriftDiff` emits `url_changed` when targets differ, `deactivated` when approval flipped, `missing` when the tool is gone; emits nothing when in sync.
- `src/client/LinkDrift.tsx`: an admin-only panel (mount it in the existing admin area — reuse where `AttentionPanel`/Team tab are surfaced; find the admin tab host in `Board.tsx`/`CardDetail`'s parent and add a tab or section). Lists drift rows with a per-row "Re-sync" button (`linkResync(slug)`), and the coupon note.

**Verify**: `cd apps/tutorial-tracker-app && npm test` all pass; `npm run build` exit 0.

### Step 10: Docs + manual smoke

- Update `apps/tutorial-tracker-app/CLAUDE.md` API section: replace the `/api/generate-links` line with `/api/link-preview`, `/api/link-confirm`, `/api/link-drift`, `/api/link-resync`, `/api/affiliate-catalog`; one line each; note "LLM-free, admin selects catalog rows".
- Manual smoke (document results in the PR): seed local D1 (`npx wrangler d1 execute clicks-db --local --file=../redirector/migrations/0001_init.sql`), `npm run dev:local`, dev-login as admin, add a catalog tool + an external link to a card, Preview (confirm DB unchanged — `wrangler d1 execute clicks-db --local --command "SELECT COUNT(*) FROM links"` before/after preview is equal), Confirm (row count increases; card shows description), re-Confirm (idempotent — count unchanged). Attach a modal screenshot.

**Verify**: counts before/after preview equal; after first confirm > preview; after second confirm unchanged.

## Test plan

Merge gate: `cd apps/tutorial-tracker-app && npm test` (Vitest, pure functions — no network/D1). New tests live beside the existing ones and follow the injected-fake pattern in `test/linkgen.test.ts`. UI verified by build + lint + a manual screenshot scored against Step 7's rubric. The manual D1 smoke (Step 10) is the end-to-end check that preview is side-effect-free and confirm is idempotent.

## Done criteria

- [ ] `cd apps/tutorial-tracker-app && npm test` — all pass (old LLM-path tests replaced; new deterministic tests present).
- [ ] `npm run typecheck` and `npm run build` and `npm run lint` — all exit 0.
- [ ] `grep -rn "createGeminiClient\|detectToolsPrompt\|describePrompt\|processVideo" src/worker src/client` returns **no** results in the link-gen path (gemini.ts itself may remain, unreferenced).
- [ ] `resolveSelection` returns `status:"blocked"` with `targetUrl:""` for an unapproved catalog tool (money-leak fix) — asserted by a test.
- [ ] `POST /api/link-preview` performs zero writes (Step 10 count check) and returns a `plan_hash`.
- [ ] `POST /api/link-confirm` is idempotent (re-confirm adds no rows) and returns `409` when `plan_hash` is stale.
- [ ] Blocked tools are never minted and never appear in the description (test + smoke).
- [ ] `video_code` persists on the card; editing the title then confirming reuses the same code (no duplicate mint).
- [ ] Drift panel lists URL/approval drift and re-sync updates both D1 and KV.
- [ ] Modal screenshot attached, meeting Step 7's rubric.

## STOP conditions

- **`clicks-db` schema would need changing.** If any step seems to require altering `videos`/`links`/`clicks` columns, STOP — identity is carried on the tracker card, not in `clicks-db`. Report.
- **Legacy prod links can't be reconciled.** If storing `video_code` on the card would require rewriting or deleting already-minted prod links, STOP — the reuse-by-title fallback (Step 3 order #2) must cover existing videos. Report before touching prod data.
- **No usable affiliate catalog.** If `loadAffiliateRecords` returns empty against the configured sheet in local testing, STOP and report (don't hardcode fixtures into the app).
- **Engine change appears necessary.** If `video_tools` does NOT round-trip through `card_extra` as documented (Step 1 of Current state), STOP — do not modify `src/shared/engine/**` without flagging; the routing is load-bearing and parity-tested.
- Any Done criterion still failing after 5 self-fix attempts → write `BLOCKED: <reason>` and stop.

## Maintenance notes

- **Human precondition (owner, before deploy):** add a **`Slug`** column to the affiliate Google Sheet (`1dl_nj9djJuXuwwE_5qTnZkS0Y9VW6MmkMxuYNL92tsQ`, `Sheet1`) and fill a stable slug per program so renaming a program's display name never changes its identity. The code tolerates the column being absent (falls back to the normalized display name), but stable identity depends on it. No other sheet change is required — the earlier `Aliases` idea was cut.
- `GEMINI_API_KEY` is now unused by link-gen; it can stay set. `GOOGLE_SA_JSON` is still required (affiliate-sheet read).
- A reviewer should scrutinize: (1) that preview truly performs no writes; (2) the confirm idempotency + `plan_hash` race handling; (3) that `resolveSelection` has **no** path that emits a non-empty `targetUrl` for a `blocked` tool; (4) that `validateDescription` runs on every confirm.
- Future: if a "suggest tools from notes" convenience is ever wanted back, it must ONLY pre-fill the picker (never persist, never mint) — keep it strictly off the money path.
- The redirector (`apps/redirector`) resolves the minted short links; re-sync updates KV, which the redirector reads — no redirector change needed.
