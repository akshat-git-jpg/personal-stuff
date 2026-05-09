# Affiliate Link Tracking System — Design

**Status:** v2 — pending user review
**Date:** 2026-05-09
**Domain:** `agrolloo.com` (tracker at `go.agrolloo.com`)

> **v2 changes from v1:** unified `process_videos.py` (replacing `add_links.py` + manual sheet population) driven by `topic_status = To Process` in YT tracker; LLM (Gemini) infers which tools to promote and generates the YouTube description; existing `affiliate_link_clicks` column in Analysis sheet is enriched with rich per-tool blocks (tool, target_url, short_url, 30d_count, all_time_count) instead of adding three new columns.

---

## Overview

A self-hosted affiliate link tracker built on Cloudflare's edge plus two Python scripts that automate the link-creation and click-reporting workflow end-to-end from a Google Sheet.

What it does:
1. **Generates short branded URLs** of the form `https://go.agrolloo.com/<video-code>/<tool>` for each (video, tool) pair you want to promote.
2. **Logs every click** to a database with timestamp, hashed IP, hashed UA, referer.
3. **Generates the YouTube description** for each video using an LLM, weaving the new short URLs into it.
4. **Fills the YT tracker sheet** with the generated short URLs + description.
5. **Fills the Analysis sheet's existing `affiliate_link_clicks` column** with per-tool data including click counts, on demand.

Replaces Bitly / Pretty Links / YOURLS for this workflow.

## Goals (priority order)

1. **Customer-facing reliability.** Redirects must not delay or fail — broken affiliate links = direct revenue loss. Edge-served, decoupled from analytics writes.
2. **Cost-efficient long term.** Free Cloudflare tiers cover this at any solo-creator scale. Total marginal cost: $0/month. Gemini calls are cheap (cents/month).
3. **Automated reporting + content generation.** A single command (`process_videos.py`) reads pending rows from the YT tracker and runs the full pipeline: tool detection → URL creation → description generation → sheet population. A second command (`update_clicks.py`) refreshes click counts in the Analysis sheet.

## Non-goals (v1)

- Editing/deleting links post-creation (do via direct SQL or wrangler)
- Refreshing target URLs after Affiliate Programs sheet updates (separate v2 script)
- Vanity / custom-named slugs (v2)
- Click data purging / retention policy (v2)
- Real-time dashboards (the sheet is the UI)
- Manual one-video-at-a-time CLI (replaced by tracker-driven batch processing)
- A/B link testing, geo-routing, link rotation

---

## Architecture

```
┌──────── go.agrolloo.com ────────┐
│                                  │
│   Worker  ──► reads ──► KV       │  redirect path:
│      │                  slug→url │  ONE synchronous dependency (KV)
│      │                           │
│      │  fire-and-forget ──► D1   │  analytics path:
│      ▼                  clicks   │  decoupled, never blocks redirect
│   302 redirect                   │
│                                  │
└──────────────────────────────────┘
                                            ▲
                                            │ SQL via CF REST API
                                            │
              ┌──────── Python scripts ─────┴──────────────────┐
              │                                                │
              │  process_videos.py            update_clicks.py │
              │  (the unified core script)    (clicks reporter)│
              │                                                │
              │  reads: YT tracker sheet      reads: Analysis  │
              │         Affiliate Programs           sheet     │
              │  uses:  Gemini (LLM)          queries: D1      │
              │  writes:D1 + KV               writes: Analysis │
              │         YT tracker                    sheet    │
              │         Analysis sheet                         │
              └────────────────────────────────────────────────┘
```

### Why this architecture

- **Worker on the edge** keeps redirects fast (<50ms globally) and reliable.
- **KV holds slug→target_url for redirects.** Designed for ultra-high-availability reads, ~100% uptime in practice.
- **D1 stores authoritative link metadata + every click event.** Source of truth, queryable by SQL.
- **The Worker has zero synchronous D1 dependency.** Every click is fire-and-forget; dedup happens in `update_clicks.py` at query time via `GROUP BY ip_hash, ua_hash, (clicked_at / 3600)`.
- **The YT tracker is the user-facing control surface.** You fill in `video_title` and `video_notes` per row, set `topic_status = "To Process"`, run the script, and the rest is automated.
- **LLM (Gemini) handles two distinct cognitive tasks:** (a) tool detection from natural-language notes, (b) polished YouTube description generation. Prompts live as editable markdown files.

---

## Data model (Cloudflare D1)

```sql
-- One row per video you publish
CREATE TABLE videos (
  video_code   TEXT PRIMARY KEY,        -- "acha" — random 4-char base62, never changes
  video_title  TEXT NOT NULL,            -- "Heygen vs Synthesia review" (matches YT tracker)
  created_at   INTEGER NOT NULL          -- unix timestamp
);

-- One row per (video, tool) combination
CREATE TABLE links (
  slug         TEXT PRIMARY KEY,         -- "acha/heygen" (the URL path under go.agrolloo.com/)
  video_code   TEXT NOT NULL,            -- "acha" (FK)
  tool         TEXT NOT NULL,            -- "heygen" (kebab-case slug)
  target_url   TEXT NOT NULL,            -- "https://heygen.sjv.io/abc123" (snapshot from sheet at creation)
  created_at   INTEGER NOT NULL,
  FOREIGN KEY (video_code) REFERENCES videos(video_code)
);
CREATE INDEX idx_links_video_code ON links(video_code);

-- One row per click event
CREATE TABLE clicks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT NOT NULL,
  clicked_at   INTEGER NOT NULL,
  ip_hash      TEXT,                     -- SHA256(ip)[:16] — not PII
  ua_hash      TEXT,                     -- SHA256(user-agent)[:16]
  referer      TEXT
);
CREATE INDEX idx_clicks_slug_ts ON clicks(slug, clicked_at);
```

### KV namespace

Single namespace `CLICKS_KV`:
- Key: `<slug>` (e.g., `acha/heygen`)
- Value: `<target_url>`

Written by `process_videos.py`. Read by Worker on every redirect.

---

## Sheet structure

### YT tracker sheet (`Master` tab — the control surface)

User-edited columns (you fill these in before running):
- `video_title` (existing) — title of the YouTube video
- `video_notes` (NEW — add this column) — your free-form brief: tools mentioned, talking points, etc.
- `topic_status` (existing dropdown) — set to `"To Process"` when ready

Script-written columns:
- `video_description` (existing) — overwritten with LLM-generated polished YouTube description
- `affiliate_links` (NEW — add this column) — newline-separated list of generated short URLs
- `topic_status` — script transitions to `"To Review"` after success

Existing columns (cost, status, email, etc.) untouched.

### Analysis sheet (`Per video cost,views and clicks` tab — click reporting)

The existing **`affiliate_link_clicks`** column is enriched with the per-tool format (no new columns added). Updated by `update_clicks.py`.

Format per cell — one block per tool, newline-separated:
```
heygen, https://heygen.sjv.io/abc123, https://go.agrolloo.com/acha/heygen, 12, 142
synthesia, https://synthesia.io/?aff=xyz, https://go.agrolloo.com/acha/synthesia, 5, 38
```

Fields per block (comma-separated):
1. `tool` — kebab-case tool slug
2. `target_url` — actual affiliate URL
3. `short_url` — generated `go.agrolloo.com/...` URL
4. `count_last_30d` — deduplicated click count, last 30 days
5. `count_all_time` — deduplicated click count, lifetime

A new row is added to the Analysis sheet (matching by video_title) when `process_videos.py` registers a video; click counts are filled later by `update_clicks.py`.

### Affiliate Programs sheet (existing — no changes)

Used as read-only source of truth for `My Affiliate Link`, `Approval Status`, and `Coupon Code`. Already populated with 87 tools.

---

## Components

### 1. Cloudflare Worker — `workers/redirector/`

TypeScript Worker at `go.agrolloo.com/*`.

```
GET /<slug>:
  1. Look up <slug> in KV.
  2. If not found → 404 plain text "Link not found".
  3. Hash IP + User-Agent (SHA-256, truncate to 16 chars).
  4. ctx.waitUntil() → INSERT into D1 clicks (slug, ts, ip_hash, ua_hash, referer).
  5. Return 302 redirect to target_url immediately.

GET /:
  Return same 404 as unknown slug.
```

Dedup is done at query time in `update_clicks.py`, NOT in the Worker — the redirect path has zero synchronous D1 dependency.

### 2. KV namespace + D1 database

Created via `wrangler kv namespace create CLICKS_KV` and `wrangler d1 create clicks-db`. IDs go in `wrangler.toml` and `.env`.

### 3. `prompts/` directory (NEW — at repo root)

Editable markdown prompt templates. Two files:

- `prompts/detect-tools.md` — system prompt for the tool-detection LLM call. Inputs: video_title, video_notes, list of (tool_slug, display_name) from Affiliate Programs sheet. Output: structured JSON `{"tools": ["heygen", "synthesia"]}`.

- `prompts/generate-description.md` — system prompt for the YouTube-description-generation call. Inputs: video_title, video_notes, list of (tool, short_url, coupon_code). Output: free-form polished description text with short URLs embedded naturally.

You edit these any time to tune behavior. Scripts read them at runtime.

### 4. `common/llm.py` (NEW — small wrapper around `common/gemini.py`)

Adds two helpers on top of the existing `common/gemini.py`:
- `detect_tools(video_title, video_notes, candidate_tools) -> list[str]` — runs the tool-detection prompt, parses structured JSON, validates each returned tool is in the candidate list.
- `generate_description(video_title, video_notes, link_specs) -> str` — runs the description-generation prompt, returns text.

Both load their prompt template from `prompts/` and substitute variables.

### 5. `yt-analysis/process_videos.py` (NEW — the unified core script)

**Replaces the prior plan's `add_links.py`.**

**Invocation:**
```bash
python3 yt-analysis/process_videos.py
```

No CLI args. Operates on the YT tracker sheet.

**Logic:**
1. Open YT tracker sheet (`Master` tab).
2. Find rows where `topic_status = "To Process"`.
3. For each such row:
   a. Read `video_title`, `video_notes`.
   b. Load Affiliate Programs sheet → candidate tool list.
   c. Call `detect_tools(title, notes, candidates)` → list of tool slugs the video promotes.
   d. Validate every returned tool is approved. If any missing/unapproved, mark this row's status back to `"To Process"` (or annotate elsewhere) and skip with a clear stderr message.
   e. Look up existing video by title in D1. Reuse `video_code` if found, else generate new 4-char base62 code.
   f. For each tool: insert into D1 `links` (skip if (slug) already exists), push to KV.
   g. Call `generate_description(title, notes, link_specs)` → polished description text.
   h. Write back to YT tracker:
      - `video_description` ← polished description
      - `affiliate_links` ← `\n`-joined short URLs
      - `topic_status` ← `"To Review"`
   i. Add (or update) row in Analysis sheet's `Per video cost,views and clicks` tab matching by `video_title`. Leave `affiliate_link_clicks` column blank for now (filled by `update_clicks.py`).
4. Print per-video summary at the end.

**Idempotency:** running on a row that's already been processed once (status pulled back to `To Process` after edits) reuses the existing `video_code`, only inserts new tools, and overwrites the description.

### 6. `yt-analysis/update_clicks.py` (NEW — click reporter)

**Replaces the prior plan's `sync_clicks.py`.**

**Invocation:**
```bash
python3 yt-analysis/update_clicks.py
```

**Logic:**
1. Open Analysis sheet (`Per video cost,views and clicks` tab).
2. For each non-header row with non-empty `video_title`:
   a. Look up the video's links via D1 (join `videos` and `links` by `video_title`).
   b. For each link, query D1 for last_30d count and all_time count (deduped at query time):
      ```sql
      SELECT COUNT(*) FROM (
        SELECT 1 FROM clicks
        WHERE slug = ? AND clicked_at >= ?
        GROUP BY ip_hash, ua_hash, (clicked_at / 3600)
      );
      ```
   c. Build the rich-format string:
      ```
      <tool>, <target_url>, <short_url>, <count_30d>, <count_all_time>
      ```
      one block per line.
   d. Write to `affiliate_link_clicks` column for that row.
3. Print summary (rows updated, total slugs queried).

Re-runnable anytime; always overwrites `affiliate_link_clicks` with current counts.

---

## Workflow end-to-end

### Steady state (per new video)

1. You fill in a row in YT tracker:
   - `video_title`: "Heygen vs Synthesia review"
   - `video_notes`: "Comparing Heygen and Synthesia for AI avatars. Talk about pricing, voice cloning, ease of use."
   - `topic_status`: `"To Process"`
2. You run `python3 yt-analysis/process_videos.py`.
3. Script processes the row:
   - LLM detects: `[heygen, synthesia]`
   - Validates against Affiliate Programs sheet (both Approved ✓)
   - Generates code `acha`, inserts D1 + KV rows
   - LLM generates a YouTube description that includes `https://go.agrolloo.com/acha/heygen` and `https://go.agrolloo.com/acha/synthesia` woven into the text
   - Writes back to YT tracker (description, affiliate_links, status → To Review)
   - Adds a row to Analysis sheet
4. You review the generated description. Edit if needed. Mark `topic_status` → `"Done"`.
5. Copy the description into your YouTube video.
6. Publish, viewers click links, D1 logs each click.
7. Anytime: `python3 yt-analysis/update_clicks.py` refreshes the Analysis sheet's `affiliate_link_clicks` column with current counts.

### A viewer clicks a link (unchanged from v1)

1. Viewer clicks `https://go.agrolloo.com/acha/heygen`.
2. DNS routes to Cloudflare's edge.
3. Worker:
   - KV: `acha/heygen → https://heygen.sjv.io/abc123`
   - Hashes IP/UA, queues fire-and-forget INSERT into D1
   - Returns 302 → `https://heygen.sjv.io/abc123`
4. Viewer lands on Heygen.

---

## Configuration (`myproj/.env`)

```bash
# Cloudflare API access
CF_API_TOKEN=<token with D1:Edit + KV:Edit scopes>
CF_ACCOUNT_ID=<from CF dashboard>
CF_D1_DATABASE_ID=<from `wrangler d1 create`>
CF_KV_NAMESPACE_ID=<from `wrangler kv namespace create`>

# Tracker domain
LINK_DOMAIN=go.agrolloo.com

# Existing (already in .env): YT_TRACKER_SHEET_URL, ANALYSIS_INCOME_SHEET_URL,
# AFFILIATE_PROGRAMS_SHEET_URL, GEMINI_API_KEY, CREDENTIALS_FILE, etc.
```

Worker config in `workers/redirector/wrangler.toml`. KV + D1 bindings declared there.

---

## Reliability & failure modes

| Failure | Customer impact | Recovery |
|---|---|---|
| D1 write fails (click insert) | None — log row lost, redirect still works | Self-healing |
| KV read fails | Redirect fails → 404 (rare; KV ≈100% uptime) | Cloudflare-side; out of our control |
| Worker outage | All redirects fail | Cloudflare-side; ~99.99% historical SLA |
| Gemini API fails | `process_videos.py` fails for that row → row left as `To Process` | Re-run |
| `process_videos.py` fails partway | Possible drift between D1 and KV | Re-run is idempotent |
| `update_clicks.py` fails | Sheet stale; click data still safe in D1 | Re-run |
| LLM picks an unapproved tool | Row left as `To Process` with stderr message | Edit notes or sheet, re-run |

The redirect path **never reads or writes D1 synchronously**. Only KV is on the synchronous redirect path.

---

## Privacy & data handling

- **No raw PII stored.** IP and UA are SHA-256 hashed and truncated to 16 chars before insert. Used only for dedup and bot detection.
- **Referer is stored as-is** (already public; sent by viewer's browser).
- **Storage:** Cloudflare D1 in default region. No replication.
- **GDPR posture:** Hashed identifiers + counts. Below "personal data" threshold for almost all jurisdictions. Purge: `DELETE FROM clicks WHERE clicked_at < ?` is one-liner.

---

## Cost analysis

Free tier limits:
- **Workers:** 100k requests/day (3M/month)
- **KV:** 100k reads/day, 1k writes/day, 1 GB
- **D1:** 5 GB, 25M row reads/month, 50k row writes/day
- **Gemini API:** Generous free tier; even at full price, ~10 LLM calls/video × $0.001/call = pennies/month

Projected year 1: ~5k clicks/month, ~2 LLM calls × ~10 videos/month = $0/month total.

---

## Setup steps (one-time, user-side)

1. Sign up at https://dash.cloudflare.com (free)
2. Add `agrolloo.com` to Cloudflare; verify DNS records imported
3. Update nameservers at registrar (24–48h propagation; WP site keeps working)
4. `npm install -g wrangler@3 && wrangler login`
5. `wrangler kv namespace create CLICKS_KV` → grab ID
6. `wrangler d1 create clicks-db` → grab ID
7. Apply migration: `wrangler d1 migrations apply clicks-db --remote`
8. `wrangler deploy` (Worker code)
9. Add `go.agrolloo.com` AAAA record (proxied) in CF dashboard
10. Generate CF API token with D1:Edit + KV:Edit scopes
11. Add IDs/token + `LINK_DOMAIN` to `myproj/.env`
12. In YT tracker sheet, add `video_notes` and `affiliate_links` columns

---

## File structure (after implementation)

```
myproj/
├── .env                              # MODIFIED: add CF_* + LINK_DOMAIN
├── prompts/                          # NEW
│   ├── detect-tools.md               # LLM prompt for tool detection
│   └── generate-description.md       # LLM prompt for YT description
├── workers/
│   └── redirector/
│       ├── wrangler.toml             # Worker + KV + D1 + route config
│       ├── package.json
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       ├── .gitignore
│       ├── src/
│       │   └── index.ts              # ~80 lines: redirect + log
│       ├── test/
│       │   └── slug.test.ts
│       └── migrations/
│           └── 0001_init.sql
├── common/
│   ├── cloudflare.py                 # NEW: D1 + KV REST API client
│   ├── affiliate.py                  # NEW: Affiliate Programs sheet reader
│   ├── llm.py                        # NEW: detect_tools + generate_description on top of common.gemini
│   ├── gemini.py                     # existing
│   ├── sheets.py                     # existing
│   └── env.py                        # existing
├── yt-analysis/
│   ├── process_videos.py             # NEW: unified core workflow
│   ├── update_clicks.py              # NEW: click reporter
│   ├── sync_analysis.py              # existing
│   ├── sync_views.py                 # existing
│   ├── sync_rankings.py              # existing
│   └── tests/
│       ├── __init__.py
│       ├── conftest.py
│       ├── test_cloudflare.py
│       ├── test_affiliate.py
│       ├── test_llm.py
│       ├── test_process_videos.py
│       └── test_update_clicks.py
└── requirements.txt                  # MODIFIED: pytest, pytest-mock, requests
```

---

## v2 / future work (explicitly out of v1)

- `refresh_links.py` — re-snapshot target URLs from Affiliate Programs sheet to D1+KV when you change a URL upstream.
- Edit/delete operations — CLI helpers; for now, edit via direct `wrangler d1 execute`.
- Vanity slugs — override the random 4-char code (e.g., `featured/heygen`).
- Click data retention/purge policy.
- Cron-driven auto-refresh.
- Bot UA filter list.
- LLM "suggest tools" mode where you confirm before commit (vs current pure-LLM detection).
