# kushal-health (Kushal Health)

The owner's health tracker at https://kushal-health.agrolloo.com. PIN-gated.

First tab: **Blood tests**. Every marker from every lab report, over time, against its
reference range, with a verdict on the latest report.

![phone](docs/screenshots/blood-phone.png)

## How reports get in

There is no upload button. In a Claude session, say "add my blood report <path to PDF>".
The `kushal-health` skill (`.claude/skills/kushal-health/`) reads the PDF, shows you every
value to check, writes a short verdict, then runs `scripts/push-report.mjs`, which posts the
numbers to `POST /api/reports` and the PDF to R2.

## How the verdict works

- Colours and trends come from fixed rules in `src/shared/status.ts`: out of range, near the
  edge (within 10% of the range from a limit), normal, and better / worse / steady against
  the previous reading.
- The written verdict per report is Claude's, stored in `reports.verdict` at ingest time.

## Stack

Worker (Hono) + D1 `kushal-health` + R2 `kushal-health-reports`; Vite + React client in
`src/client`. Auth: shared-PIN HMAC cookie (copied from `apps/kushal-income`).

## Commands

| What | Command |
|---|---|
| Local app | `cp .dev.vars.example .dev.vars && npm run db:local && npm run dev:local` (PIN `1234`) |
| Typecheck | `npm run typecheck` |
| Tests | `npm test` |
| Smoke (real wrangler, local D1 + R2) | `npm run build && bash scripts/smoke.sh` |
| Screenshot | `node scripts/shoot.mjs <url> <out.png> --login=<pin>` |
| Deploy | `npm run deploy` |

## First deploy (one time)

From this folder:

1. `npx wrangler d1 create kushal-health`, paste the id into `wrangler.toml`.
2. `npx wrangler r2 bucket create kushal-health-reports`
3. `npm run db:remote`
4. `npx wrangler secret put APP_PASSWORD` (type the PIN)
5. `openssl rand -hex 32 | npx wrangler secret put SESSION_SECRET`
6. Make an ingest token, set it with `npx wrangler secret put INGEST_TOKEN`, and put the same
   value in `.ingest.env` (copy `.ingest.env.example`).
7. `npm run deploy`, then open the URL and log in.
