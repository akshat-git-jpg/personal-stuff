# timeblock — operating notes

Personal tap-to-block day planner at `timeblock.agrolloo.com`. Full detail: `README.md`.

## Guardrails

- **Stack**: Cloudflare Worker (Hono) + single static `public/index.html` (NO build
  step — do not add Vite/React/a bundler). Data in KV (`BLOCKS_KV`), one JSON blob
  per day keyed `day:YYYY-MM-DD`.
- **Auth guardrail**: stateless signed-cookie gate (HMAC-SHA256 over expiry,
  `SESSION_SECRET`). Ported from `lists-app`. **Do NOT replace with OAuth/KV-session/DB.**
- **Not a calendar client**: no Google Calendar sync, no recurring blocks,
  no drag-to-resize, no notifications, no multi-user. Speed over features — if a
  change adds taps to the create flow, it's wrong.
- **Secrets**: `.dev.vars` (local) + Wrangler secrets (remote): `APP_PASSWORD`,
  `SESSION_SECRET`.
- **Label sync**: labels live in two places (`public/index.html` `LABELS` +
  `src/worker/constants.ts` `LABEL_IDS`); edit both together.

## Run / deploy

```bash
npm install
npm run dev      # local (http://localhost:8787), needs .dev.vars
npm run check    # tsc + vitest (merge gate)
npm run deploy   # after one-time KV + secret setup (see README)
```
