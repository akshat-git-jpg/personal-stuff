# apps/kushal-docs — operating notes

Personal document-vault PWA (upload/name/tag/filter PDFs + images). Vite + React + Hono on a Cloudflare Worker, files in R2. Full detail: `README.md`.

## Guardrails

- Stores **real personal files in the R2 bucket `kushal-docs`, unencrypted.** Don't delete or overwrite objects casually, and don't log file contents. (Client-side encryption is a noted future upgrade, not in place yet.)
- Sign-in is allow-listed to a single email via the `ALLOWED_EMAIL` secret (Google OAuth). Don't loosen this.

## Run / deploy

```bash
npm run dev                 # vite (local UI)
npm run deploy              # build + scripts/patch-routes.mjs + wrangler deploy
```

**Build gotcha:** `@cloudflare/vite-plugin` sanitizes the Worker name, so output lands in `dist/kushal_docs/` (underscore) and the plugin strips `routes` + the R2 binding from the generated config on every build. `scripts/patch-routes.mjs` re-injects both. Always deploy via `npm run deploy`, **never** bare `wrangler deploy`. Deploys on the `akshatpatidar17@gmail.com` Cloudflare account. Secrets: `GOOGLE_CLIENT_ID/SECRET`, `SESSION_SECRET`, `ALLOWED_EMAIL`.
