# Affiliate Link Tracking System — Design

**Status:** approved (pending user review of this written spec)
**Date:** 2026-05-09
**Domain:** `agrolloo.com` (tracker at `go.agrolloo.com`)

---

## Overview

Build a self-hosted affiliate link tracker that:
1. Generates short branded URLs of the form `https://go.agrolloo.com/<video-code>/<tool>` to use in YouTube descriptions and other channels.
2. Logs every click to a database with a timestamp.
3. Fills a Google Sheet automatically with per-link click counts (last 30 days + all time) on demand.

The system replaces having to use Bitly / Pretty Links / YOURLS for the same job.

## Goals (in priority order)

1. **Customer-facing reliability.** Redirects must not delay or fail — a broken affiliate link is direct revenue loss. Edge-served, decoupled from analytics writes so an analytics outage cannot break the redirect path.
2. **Cost-efficient long term.** Free Cloudflare tiers handle this at any solo-creator scale. Total marginal cost: $0/month.
3. **Automated reporting.** A single command (`python3 yt-analysis/sync_clicks.py`) refreshes the Analysis sheet with current click counts, no manual work.

## Non-goals (v1)

- Editing/deleting existing links (do via direct SQL or wrangler for now)
- Refreshing target URLs after sheet updates (separate v2 script)
- Vanity / custom-named slugs (v2)
- Click data purging / retention policy (v2 — D1 free tier holds years of data)
- Real-time dashboard UI (Google Sheet IS the UI)
- A/B link testing, geo-routing, link rotation, or other advanced features

---

## Architecture

```
┌──────────────── go.agrolloo.com ─────────────────┐
│                                                   │
│  ┌─────────────────┐   reads   ┌──────────────┐  │
│  │  Cloudflare     │  ───────► │ KV namespace │  │
│  │  Worker         │           │ slug → url   │  │
│  │  (redirector)   │  ◄──────  └──────────────┘  │
│  │                 │   target                     │
│  │                 │                              │
│  │                 │   fire-and-forget INSERT     │
│  │                 │  ───────────────────────────►│  ┌──────────────┐
│  └─────────────────┘                              │  │  D1 database │
│         │                                         │  │  videos      │
│         │ 302 redirect                            │  │  links       │
│         ▼                                         │  │  clicks      │
│   actual affiliate URL                            │  └──────────────┘
│                                                   │         ▲
└───────────────────────────────────────────────────┘         │
                                                              │ SQL queries
                                                              │
                                          ┌───────────────────┴────────────────┐
                                          │                                    │
                            ┌──────────────────────┐         ┌─────────────────────┐
                            │ yt-analysis/         │         │ yt-analysis/        │
                            │   add_links.py       │         │   sync_clicks.py    │
                            │ (registers new       │         │ (fills click counts │
                            │  video + tool URLs)  │         │  in Analysis sheet) │
                            └──────────────────────┘         └─────────────────────┘
                                       │                                │
                                       ▼                                ▼
                              Affiliate Programs                  Analysis sheet
                              sheet (for target URLs)             (writes 2 columns)
```

### Why this architecture

- **Worker on the edge** keeps redirects fast (<50ms globally) and reliable.
- **KV separates the redirect path from the analytics path.** KV is a globally-replicated key-value store designed for ultra-high-availability reads. Even if D1 has issues, the redirect still works because it only touches KV.
- **D1 stores authoritative link metadata + every click event.** It's the source of truth, queryable by SQL.
- **Python scripts run from `myproj/yt-analysis/`** — consistent with the existing monorepo conventions.

---

## Data model (Cloudflare D1)

```sql
-- One row per video you publish
CREATE TABLE videos (
  video_code   TEXT PRIMARY KEY,        -- "acha" — random 4-char base62, never changes
  video_title  TEXT NOT NULL,            -- "Heygen vs Synthesia review"
  created_at   INTEGER NOT NULL          -- unix timestamp
);

-- One row per (video, tool) combination
CREATE TABLE links (
  slug         TEXT PRIMARY KEY,         -- "acha/heygen" (the URL path under go.agrolloo.com/)
  video_code   TEXT NOT NULL,            -- "acha" (FK)
  tool         TEXT NOT NULL,            -- "heygen" (kebab-case slug derived from sheet)
  target_url   TEXT NOT NULL,            -- "https://heygen.sjv.io/abc123" (snapshot from sheet at creation)
  created_at   INTEGER NOT NULL,
  FOREIGN KEY (video_code) REFERENCES videos(video_code)
);
CREATE INDEX idx_links_video_code ON links(video_code);

-- One row per click event
CREATE TABLE clicks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT NOT NULL,            -- "acha/heygen"
  clicked_at   INTEGER NOT NULL,         -- unix timestamp
  ip_hash      TEXT,                     -- SHA256(ip)[:16] — for dedup, not PII
  ua_hash      TEXT,                     -- SHA256(user-agent)[:16] — for bot detection
  referer      TEXT                      -- e.g., "https://www.youtube.com/..." — useful for filtering
);
CREATE INDEX idx_clicks_slug_ts ON clicks(slug, clicked_at);
```

### KV namespace (separate from D1)

A single KV namespace holds the hot-path mapping for redirects:
- Key: `<slug>` (e.g., `acha/heygen`)
- Value: `<target_url>` (e.g., `https://heygen.sjv.io/abc123`)

Written by `add_links.py` at link creation. Read by the Worker on every redirect.

---

## Components

### 1. Cloudflare Worker — `workers/redirector/`

A small TypeScript Worker deployed at `go.agrolloo.com/*`. Responsibilities:

```
GET /<slug>:
  1. Look up <slug> in KV.
  2. If not found → return 404 plain text "Link not found".
  3. Hash IP + User-Agent (SHA-256, truncate to 16 chars).
  4. Queue a fire-and-forget INSERT into D1 clicks via ctx.waitUntil()
     (slug, clicked_at, ip_hash, ua_hash, referer).
  5. Return 302 redirect to the target URL immediately.

GET /:
  Return the same 404 as unknown slug.
```

**Key reliability decision: dedup is done at query time, not insert time.** The Worker writes every click; deduplication is implemented in `sync_clicks.py` via SQL when counting. This means the Worker has *zero* D1 read dependency on the redirect path — even a D1 outage cannot delay a redirect. The trade-off: D1 stores raw click rows (fine — bytes are cheap and the dedup query is straightforward).

### 2. KV namespace

Created via `wrangler kv:namespace create CLICKS_KV`. Wrangler returns an ID; that goes into `wrangler.toml`. Keys are slugs; values are target URLs.

### 3. D1 database

Created via `wrangler d1 create clicks-db`. Schema applied via `wrangler d1 migrations apply` from a SQL file in the repo (`workers/redirector/migrations/0000_init.sql`).

### 4. `yt-analysis/add_links.py` — registration script

**Invocation:**
```bash
python3 yt-analysis/add_links.py "Heygen vs Synthesia review" heygen synthesia
```

**Logic:**
1. Read CLI args: video title (positional), then tool slugs (variadic).
2. Open Affiliate Programs sheet via `common/sheets.py` helper.
3. For each tool slug:
   - Find matching row by normalizing the sheet's `Affiliate Program` name (lowercase, spaces → hyphens).
   - **Error and exit** if not found.
   - **Error and exit** if `Approval Status` ≠ `Approved`.
   - Capture `My Affiliate Link` and `Coupon Code` (if any).
4. Look up existing video by title in D1 `videos` table:
   - If exists → reuse `video_code`. New tools get appended; existing (video_code, tool) pairs are skipped (idempotent).
   - If not exists → generate a new 4-char base62 code, retry on collision (vanishingly unlikely).
5. INSERT into `videos` (if new) and `links` (one row per new tool).
6. Write each new (slug, target_url) pair into KV.
7. Print to stdout:

```
✓ Created video acha — "Heygen vs Synthesia review"

YouTube description block:
  Heygen → https://go.agrolloo.com/acha/heygen
  Synthesia → https://go.agrolloo.com/acha/synthesia

Coupon codes (FYI):
  Heygen: (no code)
  Synthesia: SYN30 — code received
```

### 5. `yt-analysis/sync_clicks.py` — sheet filler

**Invocation:**
```bash
python3 yt-analysis/sync_clicks.py
```

**Logic:**
1. Open the Analysis sheet (the `Per video cost,views and clicks` tab — same one `sync_analysis.py` writes to).
2. For each non-header row:
   - Read the `affiliate_links` column (new dedicated column, see below).
   - Regex-extract slugs from `https://go\.agrolloo\.com/([\w/-]+)` patterns.
3. Batch all unique slugs across all rows.
4. Per slug, run two D1 queries that **dedupe by (ip_hash, ua_hash) within 1-hour windows** at query time:
   ```sql
   -- Last 30 days, deduplicated
   SELECT COUNT(*) FROM (
     SELECT 1 FROM clicks
     WHERE slug = ? AND clicked_at >= ?
     GROUP BY ip_hash, ua_hash, (clicked_at / 3600)
   );
   -- All time, deduplicated
   SELECT COUNT(*) FROM (
     SELECT 1 FROM clicks
     WHERE slug = ?
     GROUP BY ip_hash, ua_hash, (clicked_at / 3600)
   );
   ```
   Each click row is bucketed into a 1-hour window keyed by (ip_hash, ua_hash); same person re-clicking within the hour counts once. (D1 supports parameterized queries via the REST API.)
5. For each row, build per-tool newline-joined strings:
   ```
   heygen: 24
   synthesia: 7
   ```
6. Batch-write the two columns: `clicks_last_30d` and `clicks_all_time`.

### 6. Sheet structure changes (Analysis sheet)

New columns added to the `Per video cost,views and clicks` tab:

| Existing | New |
|---|---|
| video_title | |
| video_description | |
| category | |
| sub_category | |
| yt_upload_date | |
| yt_link | |
| ... | |
| | **affiliate_links** (you write the short URLs here, one per line) |
| | **clicks_last_30d** (filled by sync_clicks.py) |
| | **clicks_all_time** (filled by sync_clicks.py) |

The existing `affiliate_link_clicks` column is left unchanged (kept for backward compatibility / your own use).

---

## Workflows end-to-end

### A. Creating a new video's links

1. You finish editing a YouTube video and decide on the tools mentioned.
2. Run: `python3 yt-analysis/add_links.py "Video title" tool1 tool2 ...`
3. Script validates each tool against Affiliate Programs sheet, errors out clearly if a tool is missing or not approved.
4. Script generates the 4-char video code (or reuses one if the video title already exists), inserts D1 + KV rows, prints the YouTube description block.
5. You paste the printed URLs into the YouTube description.
6. You add a row in the Analysis sheet for this video, paste the same URLs into the new `affiliate_links` column.

### B. A viewer clicks a link

1. Viewer reads the YouTube description, clicks `https://go.agrolloo.com/acha/heygen`.
2. DNS routes to Cloudflare's edge.
3. Worker at the nearest edge location:
   - Looks up `acha/heygen` in KV → gets `https://heygen.sjv.io/abc123`.
   - Hashes IP and UA, queues a fire-and-forget INSERT into D1 (does not block).
   - Returns `302 https://heygen.sjv.io/abc123` immediately.
4. Viewer's browser follows the redirect, lands on Heygen.
5. (Background) D1 row inserted with timestamp, hashes, and referer.
6. (Later, at query time) `sync_clicks.py` deduplicates by (ip_hash, ua_hash, hour_bucket) when counting.

### C. Filling click counts in the sheet

1. You run `python3 yt-analysis/sync_clicks.py`.
2. Script extracts slugs from each row's `affiliate_links` cell.
3. For each unique slug, queries D1 for last_30d count and all_time count.
4. Writes per-tool, newline-separated counts into `clicks_last_30d` and `clicks_all_time`.

Re-runnable anytime. Always overwrites with current numbers.

---

## Configuration

Add to `myproj/.env`:

```bash
# Cloudflare API access (for sync_clicks.py and add_links.py to read/write D1 and KV)
CF_API_TOKEN=<token with D1:Edit + Workers KV Storage:Edit scopes>
CF_ACCOUNT_ID=<your CF account ID>
CF_D1_DATABASE_ID=<from `wrangler d1 create` output>
CF_KV_NAMESPACE_ID=<from `wrangler kv:namespace create` output>

# The tracker domain (used by both Worker config and Python scripts)
LINK_DOMAIN=go.agrolloo.com

# Affiliate Programs sheet (already exists in .env as AFFILIATE_PROGRAMS_SHEET_URL)
```

The Worker's own config lives in `workers/redirector/wrangler.toml`. The KV namespace and D1 binding are declared there.

---

## Reliability & failure modes

| Failure | Customer impact | Recovery |
|---|---|---|
| D1 write fails (click insert) | None — log row lost, redirect still works | Self-healing |
| KV read fails | Redirect fails → 404 to viewer (rare; KV is ~100% available) | Cloudflare-side issue; out of our control |
| Worker outage | All redirects fail | Cloudflare-side; ~99.99% historical SLA |
| `sync_clicks.py` fails | Sheet not refreshed; click data still safe in D1 | Re-run later |
| `add_links.py` fails partway | Possible drift between D1 and KV | Re-run is idempotent (UPSERT-style) |

The redirect path **never reads or writes D1 synchronously**. The only synchronous dependency is KV (which is designed for ~100% read availability). This is the key reliability decision.

---

## Privacy & data handling

- **No raw PII stored.** Both IP and User-Agent are SHA-256 hashed and truncated to 16 chars before insert. Used only for dedup and bot detection — cannot be reversed.
- **Referer is stored as-is** (it's already public info — the viewer's browser sent it).
- **Storage:** Cloudflare D1 in their default region (auto-selected). No cross-region replication needed at this scale.
- **GDPR posture:** Hashed identifiers + counts; no name/email/address. Below the threshold of "personal data" for almost all jurisdictions. If ever needed, a `DELETE FROM clicks WHERE clicked_at < ?` purge is a one-liner.

---

## Cost analysis

Free tier limits (Cloudflare, as of 2026-05):
- **Workers:** 100,000 requests/day (3M/month) — far above any creator-scale traffic
- **KV:** 100,000 reads/day, 1,000 writes/day, 1 GB storage
- **D1:** 5 GB storage, 25M row reads/month, 50K row writes/day

**Projected usage (year 1):**
- Reasonable creator volume: ~5,000 affiliate clicks/month → ~165/day. Well under all caps.
- D1 storage: ~200 bytes/click × 60K clicks/year ≈ 12 MB. Indistinguishable from zero.

**When you'd cross into paid tiers:** roughly 100K+ clicks/month for a sustained period. At that point Workers Paid plan = $5/mo for 10M requests. Still trivial.

---

## Setup steps (one-time)

User-side (~30 min including DNS propagation wait):
1. Sign up at https://dash.cloudflare.com (free)
2. Add `agrolloo.com` to CF (it auto-imports DNS records from current registrar/Hostinger).
3. Update nameservers at the registrar where `agrolloo.com` is registered. WP site keeps working throughout.
4. `npm install -g wrangler && wrangler login`

Build-side (covered in implementation plan):
5. `wrangler kv:namespace create CLICKS_KV` → save ID
6. `wrangler d1 create clicks-db` → save ID
7. `wrangler d1 migrations apply clicks-db --file workers/redirector/migrations/0000_init.sql`
8. `wrangler deploy` — deploys Worker
9. Add CNAME in CF dashboard: `go.agrolloo.com` → Worker route
10. Generate CF API token, add IDs/token to `myproj/.env`

Verify with one test slug end-to-end before going live with real affiliate URLs.

---

## File structure (after implementation)

```
myproj/
├── .env                          # add CF_* vars + LINK_DOMAIN
├── workers/
│   └── redirector/
│       ├── wrangler.toml         # Worker config (KV + D1 bindings, route)
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   └── index.ts          # ~80 lines: redirect + dedup + log
│       └── migrations/
│           └── 0000_init.sql     # the schema above
├── yt-analysis/
│   ├── add_links.py              # NEW: register video + tools
│   ├── sync_clicks.py            # NEW: fill sheet from D1
│   ├── sync_analysis.py          # existing
│   ├── sync_views.py             # existing
│   └── sync_rankings.py          # existing
└── common/
    ├── sheets.py                 # existing — add affiliate-program reader
    ├── cloudflare.py             # NEW: D1 + KV API client helpers
    └── env.py                    # existing
```

---

## v2 / future work (explicitly out of v1)

- `refresh_links.py` — re-snapshot target URLs from Affiliate Programs sheet to D1+KV when you change a URL upstream.
- Edit/delete operations — CLI helpers; for now, edit via direct `wrangler d1 execute`.
- Vanity slugs — override the random 4-char code (e.g., `featured/heygen`).
- Click data retention/purge policy.
- Cron-driven auto-refresh of the sheet (e.g., daily at 9am).
- Bot UA filter list.
- Per-video click attribution dashboards beyond what the sheet offers.
