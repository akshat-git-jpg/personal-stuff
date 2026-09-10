# trip-planner

A tiny PWA that shows all trip-relevant pins (stay, transport, food, beaches,
sights, utilities) on one map next to your live location. Navigation itself is
handed off to the Google Maps app so live traffic, turn-by-turn, and place
details all still work — the PWA only owns the pin canvas Google's API refuses
to write to.

Lives at **https://trips.agrolloo.com** — one URL, dropdown picks the trip.
Per-trip deep link: `https://trips.agrolloo.com/?trip=<slug>`.

## Add / edit / deploy a trip

Use the [`pp-trip`](../../tooling/cli/pp-trip/README.md) CLI (or ask Claude —
the [`pp-trip` skill](../../.claude/skills/pp-trip/SKILL.md) drives it):

```bash
pp-trip new bali-dec-2026 --name "Bali Trip" --dates "5-12 Dec 2026"
pp-trip add bali-dec-2026 --name "Warung Biah Biah" --category food
pp-trip list bali-dec-2026
pp-trip deploy bali-dec-2026
```

Trip JSONs are checked in under `trips/` for history + easy manual edits; the
CLI mirrors them into Cloudflare KV on `deploy`.

## Runtime layout

- **Worker** (`src/index.ts`) — Hono. Serves the PWA HTML, per-trip JSON, and
  the write API used by the CLI.
- **PWA** (`src/app-html.ts`) — one HTML string with MapLibre GL JS + inline
  CSS/JS. No build step. Tile source is a single constant `TILE_SOURCE` (swap
  OSM → Google/Mapbox later without touching the rest).
- **KV** binding `TRIPS_KV`. Key = trip slug, value = trip JSON. Reserved key
  `__index` is the dropdown data; the Worker rebuilds it on every trip write.
- **Types** in `src/types.ts` are shared by the Worker and the CLI (mirrored,
  not imported, since the CLI is Python).

## Auth model

Reads (dropdown, per-trip JSON, PWA HTML) are public: URLs are unlisted like
the other kushal-tools apps and pin data has no PII. Writes require
`X-Admin-Token: $ADMIN_TOKEN` — the CLI reads it from `.dev.vars` locally and
from `wrangler secret` in prod.

## Local dev

```bash
cd apps/trip-planner
npm install
# .dev.vars must contain ADMIN_TOKEN=<anything>
npm run dev  # http://localhost:8787
```

## Deploy

```bash
npm run deploy
```

DNS + SSL for `trips.agrolloo.com` are auto-provisioned via the Worker's
`custom_domain` route.

## Add it to the inventories

When first shipping (or when moving domains), remember:

- `my-hosted-sites.md`
- `INFRA.md`
- `apps/kushal-tools/src/hub.ts` (add a card, redeploy kushal-tools)
