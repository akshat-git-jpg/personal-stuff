# Local apps — quick run notes

> `npm run *` is per-app. There is NO package.json at the repo root — always `cd` into the app dir first.

## ccusage dashboard
```bash
node /Users/kbtg/codebase/personal-stuff/tooling/cli/ccusage-dashboard/dashboard.mjs
```
→ http://localhost:4319

## tutorials-tracker (apps/tracker-app)

### Fast design/dev loop (recommended) — Vite HMR :5173 + wrangler API :8787
```bash
cd /Users/kbtg/codebase/personal-stuff/apps/tracker-app
npm install              # once (uses local .npmrc → public registry)
npm run seed:local       # wipe + reseed local D1: dev personas + demo cards (both pipelines, every status)
npm run dev:local        # Vite :5173 (instant reload) + wrangler :8787 (proxied /api,/auth,/dev-login)
```
Use **:5173** for UI work. Dev login (no Google), gated by `DEV_AUTH=1` in `.dev.vars`:

- Admin (Sean): http://localhost:5173/dev-login?email=seankerman25@gmail.com
- Tut 2 Scriptwriter + Tutorial Maker (Nina): http://localhost:5173/dev-login?email=nina@dev.local
- Reviewer, cross-system (Riya): http://localhost:5173/dev-login?email=riya@dev.local
- Tut 2 Processor + Video Editor (John): http://localhost:5173/dev-login?email=akshatpatidar17@gmail.com

`&roles=Admin,Reviewer` can be appended to override roles for a quick view.

### Bare-worker check — real Worker serving built dist/ on :8787
```bash
cd /Users/kbtg/codebase/personal-stuff/apps/tracker-app
npm run build            # builds the SPA into dist/ — MUST run before wrangler (and after ANY client change)
npx wrangler dev --port 8787   # leave running
```
→ http://localhost:8787/dev-login?email=seankerman25@gmail.com&roles=Admin,Reviewer

GOTCHA: `wrangler dev` serves a STALE dist/ — after any SPA rebuild, restart it (`pkill -f "wrangler dev"`, rebuild, restart). Worker-only changes hot-reload. This is why design work uses the :5173 loop.
