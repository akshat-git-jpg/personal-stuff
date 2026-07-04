# founders-tracker — operating notes

Shared action-item tracker for Khushi & Kushal, live at `founders.agrolloo.com`. Full detail: `README.md`.

## Guardrails

- **Stack**: Vite + React + Hono on a Cloudflare Worker, backed by D1 (`founders-db`, binding `DB`), shared-PIN gate.
- **Auto-recurring tasks**: Monthly/weekly tasks managed from the UI. A daily Cron Trigger materializes recurring tasks; the app also catches up on load.
- **Secrets**: `.dev.vars` (local) and Wrangler secrets (remote) required: `APP_PIN` (shared PIN), `SESSION_SECRET` (used for signed cookies).

## Run / deploy

```bash
npm install               # setup dependencies
npm run db:local          # initialize local D1 database schema
npm run dev               # run Vite dev server + local wrangler proxy
npm run db:remote         # initialize remote D1 database schema
npm run deploy            # build assets and deploy Cloudflare Worker
```

## Gotchas

- **Token structure**: Token is `ok.<hmac(secret,"ok")>`, constant per secret, no expiry. (Note: do NOT rewrite/extend this unless explicitly asked).
- **Session invalidation**: Rotating `SESSION_SECRET` invalidates all client sessions immediately.
