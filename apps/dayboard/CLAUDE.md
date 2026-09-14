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
- **Only two calendars reach the board** — `google.ts` -> `isBoardCalendar`: the primary
  and the holidays feed. The account has 13, and 11 of them hold a SECOND copy of the
  same day at different times (two Gyms, two Lunches, two Dinners), which is what made
  the first version unreadable. The owner keeps them unticked in Google and has said the
  selection is fixed, so this is a hard filter, not a preference. **Never filter on
  Google's `selected` flag**: a partial (`fields=`) response omits `selected: false`
  entirely, so `!== false` reads every unticked calendar as ticked.
- **Overlapping blocks get COLUMNS, never a shared edge** — `public/lanes.js`, tested by
  `test/lanes.test.ts`. It is a plain browser script (no build step) that also hands
  itself to `globalThis` so the page and the test load the same file. Drawing two
  overlapping blocks at the same left edge is the bug this app exists to avoid.
- **Context bands are SPINES, not rectangles.** A full-width band buried whatever sat
  inside it. Its name goes in the legend, the NOW card and its detail sheet.
- **Block fill mixes in OKLAB, never sRGB.** An sRGB mix toward near-black collapses the
  chroma, so the first version — `color-mix(in srgb, var(--c) 13%, var(--bg))` — rendered
  every category as the same dark grey with only a 3px bar carrying any hue. It is now
  `color-mix(in oklab, var(--c) 26%, #0d0f14)`. If the blocks ever look dull again, check
  the colour space before the percentage.
- **Hues are spread deliberately.** The first palette had three warm oranges within 20
  degrees (food / growth / holiday) and a single blue-to-violet ramp (sleep / routine /
  work). Adding a category means finding a free arc, not a nice colour.
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
- Two bands may coexist unless one swallows more than `BAND_MAX_CLASH_RATIO` (0.5) of the
  shorter. A plain "do they overlap at all" test demoted `Random` (9:00-1:30, the whole
  morning's backdrop) over a THIRTY MINUTE tail shared with the afternoon band.
- In `palette.ts`, `routine` is checked **before** `food`, because a routine block lists
  its contents: `(Return home),Logout routine, chores, Dinner` is a routine, not a meal.
  And `sleep` is checked **last**, so `Pre Sleep Routine + Timepass` lands on routine.

## LOOK AT IT BEFORE CLAIMING IT WORKS

```bash
npm run dev        # in one shell
npm run shots      # in another -> /tmp/dayboard-shots/{desktop,mobile,sheet}.png
```

`scripts/shot.mjs` drives real Chrome at 1440x900 and 390x844, logs in, and prints a
machine-checkable audit: **block collisions, ping labels covering a block, clipped
titles, horizontal overflow, console errors** — then saves the PNGs to read.

Six rounds of layout bugs shipped here on green unit tests, because the tests prove the
DATA is right and say nothing about whether two rectangles are drawn on top of each
other. Among them: the biggest block of the day rendered as a 10px sliver, the phone
layout put the timeline a full screen below the fold, the desktop columns swapped sides,
and nine ping labels sat on top of block titles. Every one of them was obvious in a
screenshot and invisible to `npm run check`.

**Any change to `public/index.html` runs `npm run shots` and the images get opened.**

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
