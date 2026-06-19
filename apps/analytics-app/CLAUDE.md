# apps/analytics-app — YT Analytics dashboard

Per-video analytics dashboard for the `@AgrolloReviews` channel + the `go.agrolloo.com` shortener. **YouTube is the source of truth for the video list** — the dashboard shows the channel's public long-form uploads (Shorts excluded), and each one is enriched with click data from D1 where it exists. A video with no shortener link still shows (0 clicks). Two tabs (`App.tsx`, client-side state): **Clicks** — per video, its **live YouTube view count**, de-duplicated click counts (30d + all-time), and each affiliate/tool link with its own counts (one dense card per video, all rendered upfront, no expand/collapse); **Uploads** (`UploadsView.tsx`) — upload-frequency bar chart (week/month toggle) over each video's real YouTube publish date, with preset + custom date ranges and a list of videos uploaded in the selected window. Live at `yt-analytics.agrolloo.com`. Worker name `yt-analytics`.

Same stack as the sibling `gym-app/` / `kushal-docs/` / `tracker-app/`: Vite + React (client) + Hono on a Cloudflare Worker, SPA served via the `ASSETS` binding. The `clicks-db` D1 it reads is written by the sibling `tracker-app/` (link generation) and by the redirector Worker, which still lives in the **TY** repo (`../../../TY/`, a sibling checkout under `~/codebase/`).

## Layout

```
apps/analytics-app/
├── src/worker/
│   ├── index.ts       # Hono routes: /api/login, /api/logout, /api/videos, SPA fallback
│   ├── auth.ts        # shared-password gate + stateless signed cookie
│   └── analytics.ts   # YouTube uploads = video list (Shorts filtered) + D1 click/link join
├── src/client/        # React SPA (App = dense no-expand cards, Login, api)
├── src/index.css      # dark theme
├── wrangler.toml      # DB binding clicks-db, route yt-analytics.agrolloo.com
└── .dev.vars(.example)
```

## Source of truth — YouTube drives the list, D1 enriches

The **video list comes from YouTube**, not D1. `getVideoStats` (in `analytics.ts`):
1. Resolves the uploads playlist as `"UU" + CHANNEL_ID.slice(2)` (channel `UCXuXNNuyhtdsiw9bZr0pUxw` = `@AgrolloReviews`), pages `playlistItems.list` for every video id, then batches `videos.list` (`part=snippet,statistics,contentDetails`, 50/req) for title, `publishedAt`, `viewCount`, and **duration**.
2. **Drops Shorts** — `duration ≤ SHORTS_MAX_SECONDS` (60s) is excluded; unparseable durations are kept as long-form.
3. Joins D1 link/click data **keyed by `yt_video_id`**. A YouTube video with no D1 match still shows (empty `links`, 0 clicks, `video_code: null`). The **YouTube title wins** over any stale D1 title.

If `YT_API_KEY`/`CHANNEL_ID` are missing or YouTube errors, the response is `{ videos: [], youtube_ok: false, youtube_error }` and the UI shows an explicit banner — public-only, no OAuth (unlisted/private videos won't appear, by design). Quota is trivial (~5 units/load for 65 videos).

### D1 — DO NOT WRITE

Binds the redirector's `clicks-db` D1 (id `3415a408-…`, schema owned by the TY repo at `TY/workers/redirector/migrations/`). This app ONLY reads `videos`/`links`/`clicks` and ONLY for click data — never INSERT/UPDATE/migrate here. D1 is account-level, so the binding works even though the schema source is in another repo. The join hinges on the additive `videos.yt_video_id` column (redirector migration `0002`); treat new columns as additive. The tracker sheet is NOT used.

## Click counting

Dedup matches `yt-analysis/sync_clicks.py` exactly: a click is keyed by `(slug, ip_hash, ua_hash, clicked_at/3600)`, so one person/hour = 1 click. `analytics.ts` computes all-time + last-30d per slug in one query, then folds links into a per-video tree (video totals = sum of link counts, sorted by all-time desc). If you change the dedup here, change it in `sync_clicks.py` too, or the dashboard and the sheet will disagree.

## Auth

Shared-password gate (NOT Google OAuth like tracker-app). `POST /api/login` checks `APP_PASSWORD`; sets a stateless signed cookie `<exp>.<hmac>` (HMAC-SHA256 with `SESSION_SECRET`, 30-day TTL, no KV). Rotating `SESSION_SECRET` logs everyone out.

Three secrets: `APP_PASSWORD`, `SESSION_SECRET`, `YT_API_KEY` (`wrangler secret put`, mirror in `.dev.vars` for local). `YT_API_KEY` is now **required** — it's what lists the channel's uploads (the video list), not just views. Without it the dashboard shows the "couldn't load from YouTube" banner. The key is a YouTube Data API v3 key from GCP project `n8n-workflows-454504` (display name `yt-analytics-views`). `CHANNEL_ID` is a plain `[vars]` entry in `wrangler.toml` (not a secret).

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
