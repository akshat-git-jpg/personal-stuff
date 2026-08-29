# workers/redirector — Cloudflare Worker for go.agrolloo.com/*

Short-link redirector. KV lookup → 302; click logged to D1 in the background via `ctx.waitUntil()` so the redirect itself stays fast.

## Layout

```
workers/redirector/
├── src/index.ts          # Worker handler (KV lookup, slug validation, D1 click insert)
├── migrations/
│   ├── 0001_init.sql     # videos / links / clicks tables
│   └── 0002_video_yt_id.sql  # adds videos.yt_video_id (nullable; for yt-analytics view lookups)
├── wrangler.toml         # KV binding CLICKS_KV, D1 binding DB, route go.agrolloo.com/*
├── package.json
└── tsconfig.json
```

## Slug format

`^[a-zA-Z0-9]+/[a-zA-Z0-9-]+$` — e.g. `aB3x/railway`. Anything else returns 404.

## Run / deploy

```bash
cd workers/redirector
npx wrangler dev          # local dev
npx wrangler deploy       # deploy to production
npx wrangler d1 migrations apply clicks-db --remote   # apply schema
```

## Click row shape

```sql
INSERT INTO clicks (slug, clicked_at, ip_hash, ua_hash, referer)
```

`ip_hash` and `ua_hash` are 8-char SHA-256 prefixes (not raw values). Dedup happens at query time in `yt-analysis/sync_clicks.py`, not here.

## ⚠️ What counts as a click (do not loosen this)

The `clicks` table is the one dataset here that **cannot be regenerated**. Two
filters protect it, both in `src/index.ts`, both learned the hard way on
2026-08-28. A robot is still **redirected** in every case — only the logging is
skipped, because a redirect that fails costs real commission.

1. **GET only.** A HEAD is never a person. Link-preview fetchers (WhatsApp,
   Slack, Twitter, Google) and security scanners all HEAD the URLs in a YouTube
   description. Found when six HEAD requests used to verify a deploy each wrote a
   click row. This is also why every verification probe in this repo uses
   `curl -I` against `go.agrolloo.com` — HEAD is the safe way to check a live
   link without touching the owner's analytics.

2. **`isRobot(ua)` — self-identifying robots are not logged.** When 65 YouTube
   descriptions were rewritten to point here, crawlers harvested every new URL:
   **269 GETs in 622 seconds from 143 distinct IPs but only 9 User-Agents**,
   hitting slugs in exactly the order the descriptions were saved, 195 carrying a
   spoofed `referer: https://www.google.com/` and **not one** from youtube.com.
   Real clicks went 57 → 326. The GET rule missed them (they were GETs) and the
   `(slug, ip_hash, ua_hash, hour)` dedup missed them (every IP differed).

**Two rules about `isRobot` that exist to stop a plausible "improvement":**

- **It matches on User-Agent ONLY, never on the referer.** A real viewer can
  arrive from a Google search, so a referer filter would silently drop real
  clicks. A test pins a real browser UA with a `google.com` referer as countable.
- **An absent User-Agent is COUNTED**, not treated as a robot — privacy browsers
  and some in-app webviews send none. A false positive silently loses a real
  click; an inflated count can always be deleted. Err toward counting.

25 tests in `test/click-logging.test.ts` cover this, including 7 real browser
UAs that must still count. If a new bot class appears, add it to the regex and
add it to the ROBOTS list in that test.

## Related

- KV is populated by the `tutorial-tracker-app/` UI (now in the **personal-stuff** repo at `apps/tutorial-tracker-app/`) (or legacy `yt-analysis/process_yt_tracker.py` via `common.cloudflare.KVClient`)
- D1 is read by `yt-analysis/sync_clicks.py` (via `common.cloudflare.D1Client`) and, read-only, by the `analytics-app` dashboard (binds the same `clicks-db`) for yt-analytics.agrolloo.com — that app lives in the **personal-stuff** repo at `apps/analytics-app/`, not in this repo
- Schema is applied via `migrations/` — `analytics-app` does NOT own or migrate this schema; it only reads it
- This Worker owns the schema; any reader (analytics-app) must treat new columns as additive
