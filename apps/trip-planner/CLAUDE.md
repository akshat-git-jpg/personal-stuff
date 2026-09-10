# trip-planner — operating notes for Claude

Owner-facing README lives in `README.md`. Notes here are things easy to get
wrong the second time.

## The pin canvas / navigation split

The PWA owns showing pins + the user's blue dot. Everything else —
turn-by-turn, live traffic, place hours/reviews/photos, Street View, "food
near me" search — is a **handoff to the Google Maps app** via
`https://www.google.com/maps/dir/?api=1&...` and
`https://www.google.com/maps/search/?api=1&...`. Do not reinvent any of that
inside the PWA; if Google exposes it, use the URL.

## Swapping tile providers

`TILE_SOURCE` in `src/app-html.ts` is the *only* place tiles are defined.
Moving from OSM to Google/Mapbox is a one-object change — new `tiles` URL,
attribution, and an API key. Nothing else in the file needs to move.

## Trip data: two homes on purpose

- `trips/*.json` — canonical, git-tracked, easy to read and edit by hand.
- Cloudflare KV — what the Worker serves. Populated by `pp-trip deploy`.

If they drift, the JSON in git wins. Re-running `pp-trip deploy <slug>`
overwrites KV from the file. Do **not** edit KV directly for anything you
want to keep past the next deploy.

## The `__index` KV key

The dropdown reads `GET /api/trips`, which returns the value stored at KV
key `__index`. The Worker rebuilds it on every PUT/DELETE by listing every
other key. That's fine at ~dozens of trips; if this ever grows past a few
hundred, switch to an incremental update instead of a full rebuild.

## Auth

- Reads: none — private-by-obscurity URL like other kushal-tools apps.
- Writes: `X-Admin-Token` must match the `ADMIN_TOKEN` secret. The `pp-trip`
  CLI is the only writer.

Do not add a login gate here without a real reason — pins carry no PII and
the extra friction defeats the "open the app, see the map" goal.

## Do NOT add an assets binding

Everything is rendered by the Worker (HTML, manifest, SW) so there is no
build step. Adding `[assets]` here would break the "no build, just deploy"
promise this repo prefers.

## Mobile layout: measure it, do not eyeball it

`python3 apps/trip-planner/check-layout.py` renders the LIVE page inside
fixed-width iframes (320/360/390/430) in headless Chrome and fails on any
control that sits off-screen, any two HUD rows that overlap, a HUD taller than
35% of the screen, or a sheet that scrolls sideways. It runs twice per width:
map-only, and with the Places list, route panel and a pin card all open at
once. Exit code is non-zero when anything is wrong.

Run it after ANY change to `app-html.ts`. Two mobile bugs shipped without it:

1. The filter strip was positioned at a hard-coded `top + 60px`, which assumed
   the top bar was one row tall. On a phone the bar wrapped and the chips
   landed on top of it. **No absolutely-positioned element may take an offset
   derived from another element's assumed height** - that is why all top
   controls now live in one `#hud` flex column and all bottom sheets in one
   `#sheets` flex column.
2. The chip row was a horizontal scroller. It needed 500px; a 390px phone
   gives it 374px, so Food and Utility were simply off-screen with no visual
   hint. **Controls wrap, they never scroll sideways.** A seventh category adds
   a row rather than silently disappearing.

Two notes on the harness: headless Chrome ignores `--window-size` for the
layout viewport here (hence the iframe), and localhost is blocked in the
sandbox, so it stubs `fetch` from a downloaded copy of the real trip JSON
instead of proxying. Override the target with `TRIP_PLANNER_URL`.
