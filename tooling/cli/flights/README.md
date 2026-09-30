# pp-flights

Flight search with live prices from Skyscanner's website JSON. No API key, no
login, no browser. Run `./pp-flights <cmd>`.

Skyscanner is the only source, on purpose: it includes travel-agent deals, so
its prices match what Cleartrip and the other booking sites charge. Google
Flights was tried as a second source on 2026-09-30 and removed the same day:
its fallback page showed ₹13,352 for an itinerary that cost ₹7,262.

The wrapper builds a venv at `~/.cache/pp-flights/venv` on first run (from
`requirements.txt`), shared by every checkout and workspace.

## Commands

```
search ORIGIN DEST DATE [--return DATE] [--direct] [--after HH:MM] [--before HH:MM]
                        [--sort best|cheapest|fastest] [--max N]
range  ORIGIN DEST START END [--after HH:MM] [--before HH:MM]
places QUERY            airports matching a name, with their entity ids
```

Shared flags: `--adults N`, `--cabin economy|premium|business|first`,
`--fresh` (skip the 30-minute result cache), `--table` for a human table
(JSON is the default).

**Every search fetches all itineraries first; `--direct`, `--after` and
`--before` only filter what came back.** `range` prints, for each date, the
cheapest itinerary next to the cheapest direct one, so a 1-stop fare can never
be filtered away by accident. Its JSON also carries every itinerary (`all`).

`ORIGIN` and `DEST` take an IATA code or a plain name; lookups are cached in
`~/.cache/pp-flights/places.json`. Dates take `2026-08-24`, `24-08-2026`,
`24 aug` or `aug 24`.

## Routes, in order

1. **Air Scraper on RapidAPI** (`sky-scrapper.p.rapidapi.com`). It returns
   Skyscanner's own itineraries, complete, with no IP limit. Verified 2026-09-30:
   same prices as the direct route (₹7,262, ₹11,065, ₹10,880). Each search costs
   2 requests (`searchFlights` + one `searchIncomplete`). The free Basic plan is
   **20 requests a month, a hard limit** (so about 10 searches); Pro is $9.99 for
   10,600. Key: `RAPIDAPI_KEY=` in `infra/secrets/rapidapi-air-scraper.env`
   (gitignored; found from any workspace via the main checkout) or
   `PP_FLIGHTS_RAPIDAPI_KEY`. The quota from each answer's headers is kept in
   `~/.cache/pp-flights/air-scraper-quota.json`, and the route is skipped until
   the reset once fewer than 2 requests are left.
2. **Skyscanner directly**, from this machine, then the VPS (below).

The table header says which route answered (`via air-scraper`, `via local`,
`via vps`), and notes say why an earlier route was skipped.

## Staying under Skyscanner's limit

Skyscanner blocks an IP for about 30 minutes after a short burst (403). On
2026-09-30 that came after 3 to 6 searches per IP. So:

- **Up to four requests per search.** Skyscanner has no cookie-free "are the
  prices ready" call, so waiting for prices means re-sending the search with the
  same view id. The tool re-sends at most 3 times, 8 s apart, and stops at
  `complete`. A flagged IP may never reach `complete` and only get the top 10;
  the output then warns that fares may be missing.
- **45 s between searches on one route**, across all processes.
- **Two routes: this machine and the VPS.** A search goes out on whichever route
  is free soonest; a 403 rests that route for 30 minutes and the next search uses
  the other. The VPS route is `ssh hostinger-vps curl ...` (`PP_FLIGHTS_VPS=<ssh
  host>` changes the host, `PP_FLIGHTS_VPS=` turns it off).
- **Every answer is cached for 30 minutes** (`~/.cache/pp-flights/results/`).
- **Run searches one after another, never in parallel.** The tool waits for you.

## Examples

```bash
# Cheapest day in a range, all stops, after-work departures only
./pp-flights --table range IDR BLR 2026-11-10 2026-11-18 --after 17:00

# One date, nonstop only
./pp-flights --table search IDR BLR 2026-11-18 --direct

# Round trip
./pp-flights --table search DEL BOM "12 sep" --return "16 sep"
```

## What comes back

Each result carries `price`, `price_formatted`, Skyscanner's `tags`
(`cheapest`, `shortest` and runners-up) and one entry in `legs` per direction
with `from`, `to`, `depart`, `arrive`, `duration_min`, `stops`, `via`,
`airlines`, `flights` (flight numbers, when Skyscanner includes them) and
`day_offset`. The top level carries `search_status` (`incomplete` means a few
fares may still be missing), `route` and `cached`.

## Caveats

This reads an endpoint Skyscanner publishes for its own website, not a partner
API, so it is personal-scale research and can break when they change it.
Prices are what Skyscanner quoted at that moment; the booking page before you
pay is final. Endpoint details are in [API-REFERENCE.md](API-REFERENCE.md).

Skyscanner's *mobile* API sits behind PerimeterX and returns a captcha to
everything; it was tried and deleted (`decisions.md`, 2026-08-04).

`python3 test_pp_flights.py` runs the offline tests.
