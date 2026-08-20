# apps/gym-app — operating notes

Mobile gym PWA. Vite + React + Hono on a Cloudflare Worker. Full detail: `README.md`.

## Guardrails

- The plan lives in the `plan` table, `gym` is a column on `exercise`, and Sets/Reps is deliberately shared with the catalogue.

- **Writes hit a Cloudflare D1 database** (`gym-db`). The original Google Sheet is now a frozen rollback copy, plus `Mirror: *` tabs updated weekly by a cron. Use `DB` binding, `schema.sql`, and `npm run db:local`/`npm run seed:local` to test locally.
- **No auth** — single user, security is just the obscure URL. Don't add a login flow without asking.
- The client store (`src/client/store.tsx`) is the session source of truth: hydrate from localStorage, one batched `GET /api/bootstrap`, optimistic writes. **Don't add per-navigation refetch** — it breaks the snappy/consistent model on purpose.

## Run / deploy

```bash
npm run dev                 # vite (local UI + Worker in-process) on :5173, or WEB_PORT=<n> npm run dev
npm run deploy              # build + scripts/patch-routes.mjs + wrangler deploy
```

Always deploy via `npm run deploy`, **not** bare `wrangler deploy` — `patch-routes.mjs` re-injects the route config that the build strips. Deploys on the `akshatpatidar17@gmail.com` Cloudflare account. Secrets: `GOOGLE_CLIENT_ID/SECRET`, `GOOGLE_REFRESH_TOKEN` (Sheets scope), `SHEET_ID`.
