# Tracker-app: in-app video creation + go.agrolloo link generation

**Date:** 2026-06-15
**Status:** Approved design — ready for implementation plan
**Scope:** App A of a two-app effort. (App B, a separate yt-analytics dashboard for clicks/views/rankings, is out of scope here and gets its own spec later.)

---

## Goal

Add two Admin-only powers to the already-deployed tracker-app (https://tutorials-tracker.agrolloo.com) so that creating a video and generating its short go.agrolloo affiliate links + YouTube description happen in the UI, never the terminal. The redirector Worker and click tracking stay as-is; they just get fed from a button instead of the CLI.

The app becomes the **only** entry point, so there is **one source of truth** for this logic (TypeScript in the Worker). `process_yt_tracker.py` is retired, not kept in parity.

---

## Background — how it works today

- `youtube/yt-analysis/process_yt_tracker.py` reads YT tracker rows with `topic_status="To Process"`, uses Gemini to detect tools, resolves affiliate URLs from the Affiliate Programs sheet, mints a 4-char video code + per-tool slugs, writes slug→URL into Cloudflare KV and rows into D1 (`videos`, `links`), generates a YouTube description, and writes `video_description` / `actual_links` / `short_links` back to the sheet.
- `workers/redirector/` serves `go.agrolloo.com/<code>/<tool>` by looking up the slug in KV → 302, logging a click row to D1.
- `youtube/yt-analysis/sync_clicks.py` reads D1 clicks back into the Analysis sheet (joins `links` to `videos` by `video_title`).
- The tracker-app today can only **edit existing cells** (`POST /api/update`, one cell at a time). It cannot create rows and has no Gemini/KV/D1 wiring.

---

## Architecture

Extend the existing tracker-app Worker to also write to the **same** Cloudflare KV + D1 the redirector already uses.

```
tracker-app Worker (Hono)
 ├─ existing: SESSIONS KV, Google Sheets (Master tab), OAuth, Gmail notify
 └─ NEW:
     ├─ CLICKS_KV  → bind to the EXISTING redirector KV namespace
     ├─ DB (D1)    → bind to the EXISTING clicks-db D1 database
     ├─ Gemini client (GEMINI_API_KEY)
     └─ Affiliate-sheet reader (AFFILIATE_PROGRAMS_SHEET_URL)
```

**Critical integration point:** the app must bind the *existing* KV namespace id and D1 database id (the ones in `workers/redirector/wrangler.toml`), not new ones. That way links the app creates are served by `go.agrolloo.com` and counted by `sync_clicks.py` with zero changes to either.

---

## New Worker modules

- **`src/worker/sheets.ts`** — add `appendRow(token, sheetId, valuesByHeader)`: appends a Master row via the Sheets `values:append` API, generating the next `row_id` (`r####`, same scheme as `ensureRowIds`). Reuses existing `getAccessToken` / service-account auth.
- **`src/worker/gemini.ts`** — small self-contained Gemini client: `generateText()` + `generateJSON()`, model config, retry/backoff, JSON-mode parsing, prompt loading. Written to be promotable to a shared TS lib later (see "Generic-ready Gemini").
- **`src/worker/affiliate.ts`** — port of `common/affiliate.py`: reads the Affiliate Programs sheet (`Sheet1`: `Affiliate Program`, `My Affiliate Link`, `Approval Status`, `Coupon Status`, `Coupon Code`), normalizes tool slugs (`normalizeToolName`), exposes `is_approved`.
- **`src/worker/linkgen.ts`** — port of `process_yt_tracker.py`'s `process_one_video`: detect tools (Gemini) → resolve target URL + coupon per tool → mint/reuse the BASE62 video code → write KV + D1 (`videos`, `links`) → generate the description (Gemini). Pure-ish core split out for unit testing.
- **Prompts** — `common/prompts/tracker/detect-tools.md` and `generate-description.md` move into the app as the canonical copies (bundled).

The D1 clients in the Worker use Cloudflare's **native bindings** (`env.DB.prepare(...).bind(...)`), not the REST `D1Client` from `common/cloudflare.py`.

---

## New endpoints (both Admin-only)

### `POST /api/video` — create a row
- Body: `{ video_title, video_notes?, category?, subcategory?, topic_status? }`
- Validation: `video_title` required; caller must hold `Admin`.
- Action: builds a row mapped by header order, sets `row_id`, `topic_date` (today), `last_updated` (now); `topic_status` defaults to `Draft`. (Admin flips it to `Ready` later to release to the Script Writer; `Ready` is the existing gate, unchanged.) Appends via `appendRow`. Busts board cache.
- Returns: `{ row_id }`.

### `POST /api/generate-links` — the Generate button
- Body: `{ row_id }`
- Validation: row must exist and have a non-empty `video_title`; caller must hold `Admin`.
- Action: reads title + notes, runs `linkgen`, then writes `video_description` / `actual_links` / `short_links` back to that row, busts board cache.
- Returns: `{ description, links: [{ tool, short_url, target_url, has_affiliate, coupon }], non_affiliate_tools, skipped }`.
- **Idempotent:** keys the D1 `videos` row by `video_title` (preserving `sync_clicks` join compatibility), reuses the existing `video_code`, and skips slugs already present on re-run. Does **not** change `topic_status` (link generation is decoupled from the topic handoff).

Note: `actual_links` / `short_links` write-back is three cells today via `updateCell` (which re-reads the sheet each call). A batched single write is an allowed optimization but not required for correctness.

---

## Client UI

- **"New Video" button** in the Admin board area opens a modal (title, notes, category, subcategory) → `POST /api/video` → the card appears on the board.
- **"Generate links & description"** action in the card detail panel (`CardDetail.tsx`), Admin-only, in the Publish section:
  - While running: spinner / disabled state.
  - On success: shows the YouTube description with a copy button, each short link with a copy button, and a "(no affiliate)" flag on tools that need a manual URL check.
  - Saved `video_description` / `short_links` / `actual_links` keep showing on the row afterward (already Admin-visible columns).

---

## RBAC

Both endpoints enforce `roles.includes("Admin")` server-side, matching the existing route pattern. Restricted columns never leave the Worker (existing `projectRowForRoles` boundary is unchanged).

---

## Error handling

- Gemini failure or zero detected tools → 4xx/5xx with a plain message, **no partial writes**, surfaced as a UI toast.
- A detected tool with no resolvable URL → skipped (not fatal) and reported in the `skipped` array of the response, so the admin sees what was dropped.
- Affiliate sheet not shared with the app's service account → clear error (see Prerequisites).
- KV/D1 write failures bubble up with context; re-running is safe because of idempotency.

---

## Testing

Vitest unit tests for `linkgen` pure logic — video-code generation, per-tool URL resolution (approved affiliate vs fallback vs skip), and link/description formatting — mirroring the existing Python tests, with Gemini and Sheets mocked. Fits the app's current vitest setup (129 tests today).

---

## What happens to the Python

- `process_yt_tracker.py` and the helpers only it uses (`common/llm.py`, `common/affiliate.py`, `common/prompts/tracker/`) get a deprecation note in their docstrings/headers.
- `docs/yt-tracker-workflow.md` trigger is retired (or marked superseded, pointing here).
- Files stay in place (harmless), but the app is the source of truth.
- `sync_clicks.py` / `sync_views.py` / `sync_rankings.py` / `sync_metadata.py` are **untouched** — those belong to the future analytics app (App B).

---

## Prerequisites to confirm before/while building

1. tracker-app Worker bound to the **existing** CLICKS_KV namespace + clicks-db D1 (reuse the ids from `workers/redirector/wrangler.toml`).
2. Affiliate Programs sheet **shared with the tracker-app service account** (`n8n-google-sa@n8n-workflows-454504.iam.gserviceaccount.com`). The Python side may have used a different service account, so this needs an explicit check.
3. `GEMINI_API_KEY` added as a Worker secret (`wrangler secret put`), plus `AFFILIATE_PROGRAMS_SHEET_URL` and `LINK_DOMAIN` config in `wrangler.toml`/vars.

---

## Generic-ready Gemini (future, not built now)

Gemini is currently hit from several places in two languages: Python (`common/gemini.py` + `common/llm.py`; `keyword-research/`), and TypeScript (`yt-research/steps/*.ts`), and now the tracker-app Worker.

We are **not** building a shared cross-project Gemini library in this work. Instead, `gemini.ts` is written self-contained and clean (model config, JSON mode, retries, prompt loading) so the **next** Gemini consumer can extract it into a shared TS module rather than copy-pasting. This intent is recorded here so it becomes a small, deliberate follow-up instead of accidental duplication.

---

## Out of scope (explicitly)

- App B (yt-analytics dashboard for clicks/views/rankings).
- Any change to the redirector Worker or the D1/KV schema.
- Migrating the existing Python sync scripts.
- A cross-project shared Gemini library (noted above as future).
