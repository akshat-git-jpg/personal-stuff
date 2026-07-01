# lists-app

A personal app for keeping plain-text lists grouped by category — "YouTube
channel ideas", "Skills to learn", and whatever else. Single user, one password.

Live at https://lists.agrolloo.com.

## Stack

Same shape as `tracker-app`, with less in it: a Vite + React 19 + Tailwind v4
SPA, served by a Hono Cloudflare Worker, with categories and items stored in D1.
Auth is one password behind a signed session cookie — no Google login, no KV.

## Run it locally

```bash
npm install
npm run db:local      # apply schema.sql to the local D1 (run once)
npm run seed:local    # optional: a few demo categories + items
npm run dev:local     # Vite on :5173, wrangler on :8787
```

Open http://localhost:5173. The local password lives in `.dev.vars`
(`APP_PASSWORD`, currently `lists-dev`). The `.dev.vars` file is gitignored —
copy `.dev.vars.example` if you need to recreate it.

`npm run dev:local` runs Vite and the Worker together. Vite serves the UI with
hot reload and proxies `/api` and `/auth` to the Worker. Do UI work against
:5173.

## Deploy

```bash
npm run deploy        # builds dist/ then wrangler deploy
```

Two secrets back the live app, set once with `wrangler secret put`:

- `APP_PASSWORD` — the password that unlocks it
- `SESSION_SECRET` — random string used to sign the cookie

To change the password later:

```bash
printf '%s' 'your-new-password' | npx wrangler secret put APP_PASSWORD
```

Schema changes go to the live DB with `npm run db:remote`.

## How it fits together

- `src/worker/` — the Worker. `index.ts` has the routes, `auth.ts` the password
  gate and cookie, `db.ts` the D1 queries.
- `src/client/` — the React app. `Board.tsx` holds the state and layout;
  `CategoryList`, `ItemList`, and `SearchResults` are the three panels.
- `schema.sql` — two tables, `categories` and `items`, both carrying a
  `position` column so drag-and-drop order survives a reload.

Search filters the items already loaded in the browser, so there's no search
endpoint. Category delete removes that category's items too.

The design choices (Soft Modern look, emerald accent, why the cookie auth) are
written up in `docs/superpowers/specs/2026-07-01-lists-app-design.md`.
