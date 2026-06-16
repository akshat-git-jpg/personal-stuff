# apps/analytics-app — YT Analytics dashboard

Click dashboard for the `go.agrolloo.com` shortener. Shows, per video, its **live YouTube view count**, de-duplicated click counts (30d + all-time), and each affiliate/tool link with its own counts. One dense card per video — everything is rendered upfront, no expand/collapse. Live at `yt-analytics.agrolloo.com`. Worker name `yt-analytics`.

Same stack as the sibling `gym-app/` / `kushal-docs/` / `tracker-app/`: Vite + React (client) + Hono on a Cloudflare Worker, SPA served via the `ASSETS` binding. The `clicks-db` D1 it reads is written by the sibling `tracker-app/` (link generation) and by the redirector Worker, which still lives in the **TY** repo (`../../../TY/`, a sibling checkout under `~/codebase/`).

## Layout

```
apps/analytics-app/
├── src/worker/
│   ├── index.ts       # Hono routes: /api/login, /api/logout, /api/videos, SPA fallback
│   ├── auth.ts        # shared-password gate + stateless signed cookie
│   └── analytics.ts   # D1 aggregation (dedup + per-video tree) + live YouTube view-count fetch
├── src/client/        # React SPA (App = dense no-expand cards, Login, api)
├── src/index.css      # dark theme
├── wrangler.toml      # DB binding clicks-db, route yt-analytics.agrolloo.com
└── .dev.vars(.example)
```

## Data — DO NOT WRITE

Binds the redirector's `clicks-db` D1 (id `3415a408-…`, schema owned by the TY repo at `TY/workers/redirector/migrations/`). This app ONLY reads `videos`/`links`/`clicks`. Never INSERT/UPDATE/migrate here — the redirector owns the schema. D1 is account-level, so the binding works fine even though the schema source is in another repo. It reads the additive `videos.yt_video_id` column (redirector migration `0002`) to map each video to its YouTube id for view lookups; treat new columns as additive.

The tracker sheet is NOT used. Link data is already structured in D1.

## Views (live YouTube)

`analytics.ts` batch-fetches `statistics.viewCount` from the YouTube Data API v3 for every video that has a `yt_video_id` (50 ids/request) and folds it into each `VideoStat.views`. Best-effort: if `YT_API_KEY` is unset or the API call fails, `views` is left `null` and the UI shows `—` — it never blocks the dashboard. The key is a YouTube Data API v3 key from GCP project `n8n-workflows-454504` (display name `yt-analytics-views`).

## Click counting

Dedup matches `yt-analysis/sync_clicks.py` exactly: a click is keyed by `(slug, ip_hash, ua_hash, clicked_at/3600)`, so one person/hour = 1 click. `analytics.ts` computes all-time + last-30d per slug in one query, then folds links into a per-video tree (video totals = sum of link counts, sorted by all-time desc). If you change the dedup here, change it in `sync_clicks.py` too, or the dashboard and the sheet will disagree.

## Auth

Shared-password gate (NOT Google OAuth like tracker-app). `POST /api/login` checks `APP_PASSWORD`; sets a stateless signed cookie `<exp>.<hmac>` (HMAC-SHA256 with `SESSION_SECRET`, 30-day TTL, no KV). Rotating `SESSION_SECRET` logs everyone out.

Three secrets: `APP_PASSWORD`, `SESSION_SECRET`, `YT_API_KEY` (`wrangler secret put`, mirror in `.dev.vars` for local). `YT_API_KEY` is optional — without it the dashboard still works, just without view counts.

## Run / deploy

```bash
cd apps/analytics-app
npm install
# local D1 starts EMPTY — seed schema from the TY repo, or use --remote for live data:
npx wrangler d1 execute clicks-db --local --file=../../../TY/workers/redirector/migrations/0001_init.sql
npm run build && npx wrangler dev --local   # http://localhost:8787
npm run deploy                              # build + wrangler deploy
```

Deploys on the `akshatpatidar17@gmail.com` Cloudflare account (same as the other agrolloo apps); CF auto-provisions DNS + SSL for the custom domain.
