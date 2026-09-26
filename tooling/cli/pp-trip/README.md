# pp-trip

CLI for `apps/trip-planner`. Manages one JSON per trip under
`apps/trip-planner/trips/` and mirrors it into the Worker's KV on `deploy`.

## Config

- `PP_TRIP_URL` — Worker base URL (default `https://trips.agrolloo.com`)
- `PP_TRIP_TOKEN` — the `X-Admin-Token` value. If unset, falls back to the
  `ADMIN_TOKEN=` line in `apps/trip-planner/.dev.vars`.

## Commands

```bash
# create a new trip file
pp-trip new bali-dec-2026 --name "Bali Trip" --dates "5-12 Dec 2026"

# list every trip file / list pins in one trip
pp-trip trips
pp-trip list bali-dec-2026

# add a pin (geocodes via Nominatim if --lat/--lon not given)
pp-trip add bali-dec-2026 --name "Warung Biah Biah" --category food
pp-trip add bali-dec-2026 --name "Villa" --category stay --lat -8.5069 --lon 115.2625
pp-trip add bali-dec-2026 --name "Padang Padang Beach" --category beach --query "Padang Padang Beach Bali"

# remove one
pp-trip remove bali-dec-2026 food-warung-biah-biah

# push to Cloudflare (one trip, or every trip)
pp-trip deploy bali-dec-2026
pp-trip deploy all
```

## Categories & default emoji

| category | emoji |
|---|---|
| stay | 🏠 |
| transport | 🚌 |
| beach | 🏖️ |
| sight | 🌅 |
| food | ☕ |
| utility | 🏧 |

Override the emoji per-pin with `--emoji 🎡`.

## Geocoding note

`add` without `--lat/--lon` calls OpenStreetMap's Nominatim (free, no key,
1 req/sec cap). For touristy names in India it usually works; for a chai
shack in a bylane it will miss — pass `--lat/--lon` (right-click Google
Maps → click the coords to copy).
