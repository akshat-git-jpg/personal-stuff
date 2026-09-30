# pp-flights

Flight search with live prices from two sources: Google Flights and
Skyscanner. No API key, no login, no browser. Run `./pp-flights <cmd>`.

The wrapper builds its own venv at `~/.cache/pp-flights/venv` on first run
(from `requirements.txt`), so every checkout and workspace shares one install.

## Commands

```
search ORIGIN DEST DATE [--return DATE] [--direct] [--after HH:MM] [--before HH:MM]
                        [--sort best|cheapest|fastest] [--max N] [--source S]
range  ORIGIN DEST START END [--after HH:MM] [--before HH:MM] [--source S]
places QUERY            airports matching a name, with their entity ids
```

Shared flags: `--adults N`, `--cabin economy|premium|business|first`,
`--fresh` (skip the 15-minute result cache), `--table` for a human table
(JSON is the default).

`range` is the one to use for "which day is cheapest". For every date it runs
one **all-stops** search and prints both the cheapest itinerary and the cheapest
direct one, so a 1-stop fare can never be filtered away by accident.

`ORIGIN` and `DEST` take an IATA code (resolved offline) or a plain name
(looked up on Skyscanner and cached). Dates take `2026-08-24`, `24-08-2026`,
`24 aug` or `aug 24`.

## Sources

| `--source` | What it does |
|---|---|
| `auto` (default) | Google Flights. If Google's fast call fails and only its first screen comes back, Skyscanner is added and the two are merged |
| `google` | Google only |
| `skyscanner` | Skyscanner only |
| `both` | Both, merged: one row per itinerary with a GOOGLE and a SKYSCAN price column |

How they compare (tested 2026-09-30, same routes and dates):

- **Prices agree within about 1-3%.** Skyscanner is often slightly lower,
  because it also lists travel-agent deals. Google is the airline's own fare.
- **Google gives flight numbers**; Skyscanner does not.
- **Google is fast** (under 2 s). Skyscanner takes 10-30 s and re-sends the
  search while it collects prices.
- **Both throttle.** Skyscanner answers 403 after a quick burst and stays shut
  for about 30 minutes. Google's fast call can answer "error 13" for a while
  after a few searches; its results page keeps working, but only carries the
  first screen (top ~10), which can miss the cheapest fare. That is why `auto`
  tops a partial Google answer up from Skyscanner.

## Staying unblocked

- Skyscanner searches are spaced **20 s apart across all processes**
  (`~/.cache/pp-flights/skyscanner-last`). Run searches through this tool, one
  after another, and it waits for you.
- A 403 is recorded (`skyscanner-blocked`) and Skyscanner is skipped for 30
  minutes instead of being hammered.
- Every answer is cached for 15 minutes under `~/.cache/pp-flights/results/`,
  so repeating a search costs nothing.

## Examples

```bash
# Cheapest day in a range, all stops, after-work departures only
./pp-flights --table range IDR BLR 2026-11-09 2026-11-15 --after 17:00

# One date, both sources side by side
./pp-flights --table search IDR BLR 2026-11-09 --source both

# Nonstop only
./pp-flights --table search bangalore indore 2026-08-24 --direct

# Round trip: two one-way searches, priced separately
./pp-flights --table search BLR IDR 2026-11-20 --return 2026-11-25
```

```
IDR to BLR  Mon 09 Nov 2026  1 adult(s)  economy  source: google+skyscanner

    PRICE    GOOGLE  SKYSCAN  AIRLINE   FLIGHT         DEPART ARRIVE  TIME   STOPS      TAGS
   ₹7,164    ₹7,255   ₹7,164  IndiGo    6E6916+6E6783  17:05  20:50   3h45   1 via HYD
   ₹9,017    ₹9,190   ₹9,017  IndiGo    6E6744         21:45  23:50   2h05   direct
```

## What comes back

Each result carries `price`, `price_formatted`, `source`, `prices` (per source,
when merged), `tags` and one entry in `legs` with `from`, `to`, `depart`,
`arrive`, `duration_min`, `stops`, `via`, `airlines`, `flights` (flight
numbers, Google only) and `day_offset`.

## Caveats

Both sources are unofficial endpoints of public websites, so this is
personal-scale research. Prices are what the site quoted at that moment; the
booking page before you pay is the final price. Endpoint details are in
[API-REFERENCE.md](API-REFERENCE.md).

Skyscanner's *mobile* API sits behind PerimeterX and returns a captcha to
everything; it was tried and deleted (`decisions.md`, 2026-08-04).

`python3 test_pp_flights.py` runs the offline tests.
