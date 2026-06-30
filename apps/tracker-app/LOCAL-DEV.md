# Local dev & design loop — tracker-app

Fast loop for building UI and checking it (by eye or via Playwright) against
realistic seeded data. No Google sign-in, no password.

## One-time

```bash
cd apps/tracker-app
npm install
npx playwright install chromium   # only if you'll use the screenshot/e2e tooling
```

`.dev.vars` must have `DEV_AUTH=1` (it does) — that turns on the dev-login backdoor.

## Seed the local database

Wipes & repopulates the **local** D1 with dev personas + demo cards across both
pipelines and every status (incl. In Review and Need Changes):

```bash
npm run seed:local
```

Re-run any time to reset to a known state. Local-only — never touches remote.

## Run it

```bash
npm run dev:local
```

Runs two servers together:
- **Vite (HMR) on http://localhost:5173** — the app. Edit any `.tsx`/CSS → instant reload.
- **wrangler (API) on :8787** — proxied at `/api`, `/auth`, `/dev-login`.

Open **http://localhost:5173** and click a **Preview (dev only)** persona, or jump
straight in:

```
http://localhost:5173/dev-login?email=kushalbakliwal25@gmail.com   # Sam — Script board
http://localhost:5173/dev-login?email=seankerman25@gmail.com       # Sean — Admin (Pipeline, Team)
http://localhost:5173/dev-login?email=riya@dev.local               # Riya — Reviewer
```

Personas (all seeded): Sean=Admin+Reviewer, Sam=Scriptwriter+Recorder,
Anusha=Recorder, John=Video Editor, Tara=Thumbnail Maker, Uma=Uploader, Riya=Reviewer.

> The HMR server reflects source instantly. The **separate** `npm run dev:api`
> serves the built `dist/` SPA at :8787 (full-worker check) — that one needs a
> `npm run build` + restart after UI changes. Use :5173 for design iteration.

## Screenshots (Playwright)

Ad-hoc screenshot of any persona's board (server must be running):

```bash
npm run shot -- sam                       # → docs/shots/board-sam-<ts>.png
npm run shot -- sean docs/shots/admin.png
```

Persona keys: `sean sam anusha john tara uma riya` (or pass a full email).

## E2E smoke tests

```bash
npm run seed:local      # ensure known data
npm run e2e             # Playwright (auto-starts dev:local; reuses if already up)
npm run e2e:report      # open last HTML report
```

Specs live in `e2e/`; `e2e/helpers.ts` has `loginAs(page, email)` + `PERSONAS`.
