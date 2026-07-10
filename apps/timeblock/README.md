# timeblock

Fast personal day-planner: block time in **two taps**. Live at
`timeblock.agrolloo.com` (password-gated). Built because Google Calendar is too
slow to block time on mobile — too many taps and dragging to set the range.

## What it does

- Single-day grid, 6:00 AM–midnight, 30-min slots, with a live "now" line and
  `‹ ›` day nav.
- Pick a label chip (Deep work / Meeting / Gym / Break / Personal — it stays
  active), then **tap a start time and an end time** → a colored block appears.
  Tap the same cell twice for a 30-min block. Tap a block to relabel or delete it.
- No dragging, no save button, no dialogs. Not a Google Calendar client — it has
  its own store and does not sync anywhere.

## Stack

- Cloudflare Worker (Hono) serving a single static `public/index.html` (no build step).
- Data in **KV** (`BLOCKS_KV`), one JSON blob per day (`day:YYYY-MM-DD`).
- Auth: stateless signed-cookie password gate (HMAC over expiry, `SESSION_SECRET`) —
  the same house pattern as `lists-app`. Secrets: `APP_PASSWORD`, `SESSION_SECRET`.

## Local dev

```bash
npm install
cp .dev.vars.example .dev.vars   # then set a real APP_PASSWORD + SESSION_SECRET
npm run dev                      # http://localhost:8787 (local KV is simulated)
```

## Test

```bash
npm run check    # tsc --noEmit + vitest (offline, no Cloudflare account needed)
```

## Deploy (one-time setup, then `npm run deploy`)

```bash
npx wrangler kv namespace create BLOCKS_KV   # paste the printed id into wrangler.toml
npx wrangler secret put APP_PASSWORD
npx wrangler secret put SESSION_SECRET
npm run deploy                               # custom_domain auto-provisions DNS+SSL
```

## Notes

- The label set is duplicated in `public/index.html` (`LABELS`) and
  `src/worker/constants.ts` (`LABEL_IDS`) — keep them in sync (no build shares them).
- `src/worker/validate.ts` (`normalizeDay`) is the storage guard: it drops malformed,
  out-of-range, unknown-label, and overlapping blocks server-side.
