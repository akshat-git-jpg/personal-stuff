# dayboard — operating notes

Read-only Google Calendar day board at `dayboard.agrolloo.com`. Full detail: `README.md`.

## Guardrails

- **Read-only, permanently.** There is no write route and no event store. If a request
  arrives to "let me edit from here", that is a new app or a deliberate reversal — not a
  small change. Every Google call is a GET.
- **KV is a cache, never a source of truth.** `CACHE_KV` holds the access token (~50 min)
  and one day payload (60 s). Never persist events, never read the board from KV when
  Google is reachable.
- **Stack**: Cloudflare Worker (Hono) + a single static `public/index.html`. **No build
  step — do not add Vite/React/a bundler.** (The repo's browser-UI standard prescribes
  Vite+React for multi-view, saving, growing UIs; this is one view that never saves, so
  the template-string exception applies. If a second view or any write appears,
  re-open that decision rather than growing the file.)
- **Auth guardrail**: stateless signed-cookie gate (HMAC-SHA256 over expiry,
  `SESSION_SECRET`), ported from `timeblock`. **Do NOT replace with OAuth/KV-session/DB.**
- **No polling.** Events refetch on load, on `visibilitychange`, and on the ↻ button.
  The NOW line ticks on the browser clock every 30 s with no network. Re-adding a
  `setInterval` fetch is a regression the owner explicitly rejected.
- **Colour comes from `palette.ts`, not from Google.** `cal.backgroundColor` is
  deliberately unused for events (it is still shown on the calendar toggles). Changing a
  category's hue means changing `PALETTE` and its test, not hardcoding in the HTML.
- **Google creds are SHARED** with `routine-ringer` and the daily-digest
  (`tooling/mcp/google-shared/tokens/kushalbakliwal25@gmail.com.json`). A revoked token
  breaks all three at once. Do not mint a separate OAuth client to "isolate" dayboard —
  that doubles the consent surface for no gain.

## The three rules, and where they live

`src/worker/layout.ts` is the only file with real logic and it is fully tested:
`PING_MAX_MIN` (15), `CONTEXT_MIN_MIN` (120), `CONTEXT_MIN_OVERLAPS` (2). Touching
events do **not** overlap (`a.start < b.end && b.start < a.end`) — that half-open rule is
what stops Commute 10:30–11:00 and Zluri 11:00–16:00 from splitting into columns.

Two deliberate orderings, both regression-tested, both easy to "fix" wrongly:

- Only **duration** events count toward the context-overlap threshold. A stack of water
  pings inside Gym must never promote Gym to a background band.
- In `palette.ts`, `routine` is checked **before** `food`, because a routine block lists
  its contents: `(Return home),Logout routine, chores, Dinner` is a routine, not a meal.
  And `sleep` is checked **last**, so `Pre Sleep Routine + Timepass` lands on routine.

## Run / deploy

```bash
npm install
npm run dev      # local (http://localhost:8787), needs .dev.vars
npm run check    # tsc + vitest (merge gate)
npm run deploy   # after one-time KV + secret setup (see README)
```

**`wrangler dev` does not hot-reload `.dev.vars`.** Swapping `GOOGLE_REFRESH_TOKEN`
without restarting silently keeps serving the old account — this cost an hour on
2026-09-14. The token cache key is now credential-scoped so KV cannot repeat the trick,
but the dev server still can.

## Phase 2 (agreed, not built)

Integrate `routine-ringer` — the board and the phone alert read the same calendar, so
the ringer's fire state could surface on the board (what rang, what was missed). Discuss
before building.
