# founders-tracker

Shared action-item tracker for Khushi & Kushal, live at `founders.agrolloo.com`.
Two owner tabs, drag-ordered tasks, hazard cards for tasks with no ETA, an
on-time scoreboard, and monthly/weekly auto-recurring tasks managed from the UI.

Vite + React + Hono on a Cloudflare Worker, backed by D1 (`founders-db`),
shared-PIN gate. A daily Cron Trigger (00:05 Asia/Kolkata) materializes
recurring tasks; the app also catches up on load.

## Surfaces

- **Tracker** — Khushi/Kushal tabs, scoreboard, drag-ordered tasks, add form.
- **Recurring** — list + CRUD of repeat jobs (monthly/weekly, due-day). Adding
  one is just a DB insert; the generic cron picks it up automatically.
- **Login** — shared-PIN page.

## Dev

- `npm install`
- `npm run db:local` — apply `schema.sql` to local D1
- create `.dev.vars` with `APP_PIN` and `SESSION_SECRET`
- `npm run dev`

## Deploy

- `npm run db:remote` — apply schema to the remote D1 (first time / schema changes)
- `npx wrangler secret put APP_PIN` / `npx wrangler secret put SESSION_SECRET`
- `npm run deploy` — builds and `wrangler deploy` (binds the `founders.agrolloo.com` custom domain + cron)

Rotating `SESSION_SECRET` logs everyone out (stateless signed cookie).

## Data

- `tasks` — every action item (manual + generated).
- `recurring_templates` — repeat-job definitions, CRUD'd from the Recurring screen.
- Recurring instances are deduped by a unique index on `(template_id, period_key)`,
  which is what makes the generator idempotent (safe to run daily + on load).
