# lists-app — operating notes

Personal app for keeping plain-text lists grouped by category, live at `lists.agrolloo.com`. Full detail: `README.md`.

## Guardrails

- **Stack**: Vite + React 19 + Tailwind v4 SPA, served by Hono on a Cloudflare Worker. Categories and items stored in D1 (`lists-db`, binding `DB`).
- **Auth Guardrail**: Auth is a stateless signed cookie gate (HMAC-SHA256 over expiry, `SESSION_SECRET`). **Do NOT replace this with OAuth/KV/database check.** It is a deliberate design decision (`decisions.md` 2026-07-01).
- **Secrets**: `.dev.vars` (local) and Wrangler secrets (remote) required: `APP_PASSWORD`, `SESSION_SECRET`.

## Run / deploy

```bash
npm install               # setup dependencies
npm run db:local          # initialize local D1 database schema
npm run seed:local        # seed local database with demo items
npm run dev:local         # run Vite dev server + local wrangler proxy
npm run db:remote         # initialize remote D1 database schema
npm run deploy            # build assets and deploy Cloudflare Worker
```

## Gotchas

- **Search behavior**: Search filters items already loaded in the browser. There is no backend search endpoint.
- **Cascading deletion**: Category delete cascade-deletes all its items.
