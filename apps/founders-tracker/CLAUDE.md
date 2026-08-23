# founders-tracker — operating notes

Shared action-item tracker for Khushi & Kushal, live at `founders.agrolloo.com`. Full detail: `README.md`.

## Guardrails

- **Stack**: Vite + React + Hono on a Cloudflare Worker, backed by D1 (`founders-db`, binding `DB`), shared-PIN gate.
- **Habits vs task templates**: cadence is the discriminator. `daily`/`weekly`
  templates are **habits** — ticked into `habit_logs`, streaked, and they NEVER
  insert a row into `tasks` (guarded by the `HABIT_NEVER_GENERATES_TASKS` test).
  Only `monthly` templates generate real tasks; a daily Cron Trigger materializes
  those and the app also catches up on load.
- **Period arithmetic lives in `src/habits.ts`** — a pure, D1-free module shared
  by the Worker and the client. `periodKey` has no other home; do not re-add a
  copy to `src/worker/recurring.ts`.
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
