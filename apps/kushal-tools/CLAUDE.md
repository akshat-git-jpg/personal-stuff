# kushal-tools — operating notes for Claude

A launcher hub for the other agrolloo.com apps. One Hono Worker, no build step.

## Adding / editing a card

Edit the `APPS` array in `src/hub.ts` — one object per app
(`{ name, host, url, kind }`). `kind` only drives the colored dot
(`app` / `infra` / `page`). That's the whole change; there is no data store.

When you add an app here, also add it to the repo-level `my-hosted-sites.md`
and `INFRA.md` so the inventory stays accurate.

## Why no assets binding

The PIN gate must run before any HTML is served. A static asset would be
returned before the Worker's auth check, so both pages are rendered in
`src/hub.ts` and served from `src/index.ts`. Don't add an `[assets]` binding
without moving the gate accordingly.

## Auth

`src/auth.ts` is the same stateless signed-cookie scheme as the yt-analytics
app. Secrets: `APP_PASSWORD`, `SESSION_SECRET` (set via `wrangler secret put`;
mirror in `.dev.vars` for local). No KV, no sessions table.

## Local & deploy

`npm run dev` (wrangler dev), `npm run deploy` (no build — just `wrangler
deploy`). The custom domain `kushal-tools.agrolloo.com` is auto-provisioned.
