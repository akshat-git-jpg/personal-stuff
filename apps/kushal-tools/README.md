# kushal-tools

KushalTools — a single launcher page for everything I've shipped, live at
**https://kushal-tools.agrolloo.com**. A grid of cards; tap one and the app
opens in a new tab. Behind a shared-password gate.

## What it is

One small Hono Worker. There is **no** React, no Vite, and **no static-assets
binding** — the Worker renders both pages (the hub and the login screen) as HTML
strings. That's deliberate: a static asset would be served *before* the Worker
could check the password, so the page itself wouldn't be protected. Rendering in
the Worker lets the gate wrap the whole thing.

To add an app to the hub, add one line to the `APPS` array in `src/hub.ts`.
Nothing else changes.

## Layout

- `src/auth.ts` — shared-password gate via a stateless, signed cookie
  (`expiry.HMAC-SHA256(SESSION_SECRET, expiry)`, no KV/DB). Copied from the
  yt-analytics app.
- `src/hub.ts` — `renderHub()` (the card grid) and `renderLogin()` (the gate),
  plus the `APPS` list.
- `src/index.ts` — Hono routes: `POST /api/login`, `POST /api/logout`, and a
  catch-all that serves the hub when the cookie is valid, else the login page.

## Secrets

Set in production with `wrangler secret put`, mirrored in `.dev.vars` for local:

- `APP_PASSWORD` — the passphrase typed at the gate.
- `SESSION_SECRET` — random string used to sign the auth cookie. Rotating it
  logs everyone out.

## Develop & deploy

```bash
cp .dev.vars.example .dev.vars   # then edit values
npm install
npm run dev                      # wrangler dev (local)
npm run deploy                   # build-free; wrangler deploy
```

Deploy provisions DNS + SSL for the custom domain automatically on the
agrolloo.com zone.
