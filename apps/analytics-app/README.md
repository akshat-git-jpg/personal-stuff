# YT Analytics

A small dashboard for the `go.agrolloo.com` link shortener. It shows, per video, how many times each affiliate/tool link was clicked. You open `yt-analytics.agrolloo.com`, type the shared password, and get a list of videos you can expand to see each link and its click counts.

## Where the data comes from

Everything is read straight from the redirector's `clicks-db` (Cloudflare D1), which already holds three tables: `videos`, `links`, and `clicks`. This app never writes to that database. It only reads.

The tracker sheet is not involved. The sheet's `short_links` / `actual_links` columns are just text generated for YouTube descriptions; the structured data lives in D1.

## How clicks are counted

Counts are de-duplicated the same way `sync_clicks.py` does it: a click is keyed by `(slug, ip_hash, ua_hash, hour-bucket)`, so the same person clicking the same link a few times within an hour counts once. For each link you get two numbers:

- 30d: de-duplicated clicks in the last 30 days
- All-time: de-duplicated clicks ever

A video's totals are the sum of its links' counts. Videos sort by all-time clicks, highest first. Hit Refresh to re-run the query.

## Auth

A single shared password gate. `POST /api/login` checks the password against the `APP_PASSWORD` secret and sets a signed, httpOnly cookie that lasts 30 days. The cookie is `<expiry>.<hmac>`, signed with `SESSION_SECRET` (HMAC-SHA256), so there is no session store to keep. Rotating `SESSION_SECRET` logs everyone out.

## Stack

Vite + React (client) and Hono on a Cloudflare Worker (server), same shape as the tutorials tracker and gym apps. The built SPA is served through the Worker's `ASSETS` binding.

## Routes

- `POST /api/login` — check password, set cookie
- `POST /api/logout` — clear cookie
- `GET /api/videos` — per-video / per-link click stats (requires the cookie)
- `GET *` — serve the SPA

## Local development

Secrets come from `.dev.vars` (gitignored). Copy the example first:

```sh
cp .dev.vars.example .dev.vars   # then edit the password + secret
npm install
```

The local D1 starts empty, so apply the schema and (optionally) some sample rows before running. The schema lives in the TY repo (a sibling checkout under `~/codebase/`):

```sh
npx wrangler d1 execute clicks-db --local \
  --file=../redirector/migrations/0001_init.sql
```

Then run the Worker (serves API + built assets):

```sh
npm run build
npx wrangler dev --local
```

Open http://localhost:8787 and log in with the password from `.dev.vars`.

For live numbers against the real (shared) database instead of the local one, add `--remote` to `wrangler dev`.

## Deploy

Set the two secrets once, then deploy:

```sh
npx wrangler secret put APP_PASSWORD
npx wrangler secret put SESSION_SECRET
npm run deploy
```

Cloudflare provisions DNS and SSL for `yt-analytics.agrolloo.com` automatically from the `[[routes]]` entry in `wrangler.toml`.

## Income tab

Affiliate income by month, source and program. Unlike the other tabs this data is
**not live** — it is a static aggregate bundled into the Worker at build time.

Half of the income arrives as a direct bank deposit that no API exposes, so the
numbers come from a bank passbook the owner exports by hand, merged with the
PayPal CLI. The pipeline lives in `pipelines/income-analysis/`; the `yt-income`
skill runs it end to end and redeploys this app.

- `GET /api/income` serves the bundled aggregate, behind the same password gate.
- `scripts/sync-income.mjs` copies `pipelines/income-analysis/summary.json` into
  `src/worker/income-summary.json`. It runs as part of `npm run build`, so a
  deploy can never ship stale figures.
- No raw transactions reach this app — only month totals per rail and PayPal
  program names. The passbook itself is gitignored in the pipeline folder.

The chart toggles between two views that are **not** interchangeable: *Landed in
bank* (by credit date, includes non-PayPal rails) and *PayPal earned* (PayPal's
own month attribution). The PayPal totals agree; the per-month split does not.

### Local dev

The local D1 starts empty, so `/api/videos` 500s and bounces you to the login
screen. Seed it once:

```bash
for f in ../redirector/migrations/*.sql; do npx wrangler d1 execute clicks-db --local --file="$f"; done
npx wrangler d1 migrations apply yt-rankings --local
```

`node scripts/shoot.mjs http://127.0.0.1:8792 .shots/income.png --tab=Income`
screenshots a tab and prints what actually rendered, exiting non-zero on a page
error.
