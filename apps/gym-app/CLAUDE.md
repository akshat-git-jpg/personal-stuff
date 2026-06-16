# apps/gym-app — operating notes

Mobile gym PWA. Vite + React + Hono on a Cloudflare Worker. Full detail: `README.md`.

## Guardrails

- **Writes hit a LIVE production Google Sheet** ("Exercises - AppSheet") that the user's real AppSheet app also reads/writes. There is no test sheet. Be deliberate with any write/delete path — a bug corrupts real workout data.
- **No auth** — single user, security is just the obscure URL. Don't add a login flow without asking.
- The client store (`src/client/store.tsx`) is the session source of truth: hydrate from localStorage, one batched `GET /api/bootstrap`, optimistic writes. **Don't add per-navigation refetch** — it breaks the snappy/consistent model on purpose.

## Run / deploy

```bash
npm run dev                 # vite (local UI)
npm run deploy              # build + scripts/patch-routes.mjs + wrangler deploy
```

Always deploy via `npm run deploy`, **not** bare `wrangler deploy` — `patch-routes.mjs` re-injects the route config that the build strips. Deploys on the `akshatpatidar17@gmail.com` Cloudflare account. Secrets: `GOOGLE_CLIENT_ID/SECRET`, `GOOGLE_REFRESH_TOKEN` (Sheets scope), `SHEET_ID`.
