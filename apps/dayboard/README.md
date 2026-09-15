# dayboard

Read-only day view of Google Calendar, at `dayboard.agrolloo.com` (password-gated).
Built because Google Calendar's own day view is unreadable once a day has layers:
5-minute water reminders render as full-width bars, a wide "Random" block squashes
everything overlapping it into columns, and every description hides behind a click.

**Dayboard never writes.** You still create and edit events in Google Calendar. This
is a window onto them.

## What it does differently

Three shapes instead of one rectangle:

| Shape | Rule | Drawn as |
|---|---|---|
| **ping** | event ≤ 15 min | a hairline tick + label. Pings on the same minute merge into one tick. |
| **context** | event ≥ 2 h that ≥ 2 other timed events overlap | a faded dashed band *behind* everything |
| **block** | everything else | a card; indented when it sits inside a context band |

Overlapping blocks are packed into **side-by-side columns** (`public/lanes.js`), so an
overlap costs width and never legibility.

Only the **primary** calendar and the **holidays** feed are read (`isBoardCalendar`). The
account has 13 calendars and 11 hold a duplicate "plan" copy of the same day at different
times; reading them showed two Gyms, two Lunches and two Dinners.

Plus:

- **Descriptions render inline** — in the block when there is room, and always in full
  in the NOW card and the detail sheet. No clicking to find out what a block means.
- **Colour by event TYPE, not by calendar** (`src/worker/palette.ts`). The primary
  calendar alone holds Sleep, Gym, Lunch, Zluri Work and Random; one colour for all of
  them is useless. Nine categories, matched on title keywords first, calendar name
  second.
- **Tap anything** (block, band, ping, the NOW card) for a detail sheet: full
  description with live links, duration, calendar, and a link out to Google Calendar.
- **"N h unplanned"** ghost bands, derived from the gaps in the day.
- **NOW card** — what is live, how long is left, and what it sits inside.
- **Google-shaped date nav** — `Today`, `<`, `>` on one row, plus a mini month you can
  click. Keyboard: left/right (or `j`/`k`) change day, `t` jumps to today.

## Syncing

There is no polling. Two separate things update:

| What | When | Calls Google? |
|---|---|---|
| Events | page load, and when the tab becomes visible again, and the ↻ button | yes |
| NOW line, countdown | every 30 s | **no** — browser clock only |

Tab-focus is the mobile "reload": you do not refresh a phone tab, you swipe back to it.

## Stack

- Cloudflare Worker (Hono) serving one static `public/index.html` — **no build step**.
- Google Calendar v3 over plain `fetch`; no `googleapis` client.
- KV (`CACHE_KV`) holds **only** caches: the access token (~50 min) and the day payload
  (60 s). Purging it costs one extra round trip and nothing else.
- Auth: stateless signed-cookie password gate (HMAC over expiry) — same house pattern
  as `timeblock` and `lists-app`.

## Google credentials

Reuses the **shared** token at `tooling/mcp/google-shared/tokens/kushalbakliwal25@gmail.com.json`
— the same account `routine-ringer` reads. No new Google Cloud project, no new consent
screen. Three values go in as secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`GOOGLE_REFRESH_TOKEN`.

If that refresh token ever dies, `/api/day` returns `{"error":"google_auth"}` and the UI
shows a red banner. Re-mint the token and update the secret; nothing else breaks.

## Local dev

```bash
npm install
cp .dev.vars.example .dev.vars    # then paste the three Google values + a password
npm run dev                       # http://localhost:8787
```

**Gotcha:** `wrangler dev` does **not** hot-reload `.dev.vars`. Change a credential and
you must restart it, or you will keep reading the previous account's calendar.

## Test

```bash
npm run check    # tsc --noEmit + vitest (86 tests, offline, no Cloudflare account)
```

The tests cover the parts where a bug is invisible: the ping/context/block rules against
the owner's real Monday, the timezone clipping, the HTML-stripping, and every category
mapping.

## Deploy (one-time setup, then `npm run deploy`)

```bash
npx wrangler kv namespace create CACHE_KV   # paste the printed id into wrangler.toml
npx wrangler secret put APP_PASSWORD
npx wrangler secret put SESSION_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put GOOGLE_REFRESH_TOKEN
npm run deploy                              # custom_domain auto-provisions DNS + SSL
```

## Known limits

- Read-only by design. Editing happens in Google Calendar.
- No offline copy — no connection, no board.
- Dark theme only.
- One timezone for the whole grid (`TIMEZONE` var, `Asia/Kolkata`), not the viewer's.
