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
