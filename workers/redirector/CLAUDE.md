# workers/redirector — Cloudflare Worker for go.agrolloo.com/*

Short-link redirector. KV lookup → 302; click logged to D1 in the background via `ctx.waitUntil()` so the redirect itself stays fast.

## Layout

```
workers/redirector/
├── src/index.ts          # Worker handler (KV lookup, slug validation, D1 click insert)
├── migrations/
│   └── 0001_init.sql     # videos / links / clicks tables
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

## Related

- KV is populated by `yt-analysis/process_yt_tracker.py` (via `common.cloudflare.KVClient`)
- D1 is read by `yt-analysis/sync_clicks.py` (via `common.cloudflare.D1Client`)
- Schema is applied via `migrations/`
