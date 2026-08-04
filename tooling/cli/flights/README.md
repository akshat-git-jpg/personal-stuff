# pp-flights

Flight search with live prices, over Skyscanner's public web API. No API key,
no login, no browser. It is the same JSON the skyscanner.co.in results page
loads, which turns out to answer plain HTTPS requests from anywhere.

Nothing to install beyond `requests` (already in the repo). Run
`./pp-flights <cmd>`.

## Commands

```
search ORIGIN DEST DATE [--return DATE] [--adults N] [--cabin C]
                        [--direct] [--sort best|cheapest|fastest] [--max N]
places QUERY            airports matching a name, with their entity ids
```

Global flags: `--table` for a human table (JSON is the default, since it is
cheap for agents to read), plus `--market IN`, `--currency INR`,
`--locale en-GB` if you ever search from another market.

`ORIGIN` and `DEST` take an IATA code or a plain name, so `BLR` and `bangalore`
both work. Resolved places are cached in `~/.cache/pp-flights/places.json`.
Dates take `2026-08-24`, `24-08-2026`, `24 aug`, or `aug 24`; a bare month and
day means the next time that date comes around.

`--cabin` is one of `economy`, `premium`, `business`, `first`.

## Examples

```bash
# The obvious one
./pp-flights --table search BLR IDR "24 aug"

# Nonstop only, cheapest first
./pp-flights --table search bangalore indore 2026-08-24 --direct --sort cheapest

# Round trip, two adults, business
./pp-flights --table search DEL BOM "12 sep" --return "16 sep" --adults 2 --cabin business

# Which Goa airport is which?
./pp-flights --table places goa

# Feed it to something else
./pp-flights search BLR IDR "24 aug" --max 3 | jq '.results[].price'
```

Table output looks like this:

```
BLR to IDR  Mon 24 Aug 2026  1 adult(s)  economy

    PRICE  AIRLINE            DEPART ARRIVE   TIME   STOPS      TAGS
   ₹7,385  IndiGo             20:50  22:45    1h55   direct     cheapest,shortest
   ₹8,577  Air India Express  14:25  16:25    2h00   direct     third_shortest
```

On a round trip each itinerary prints two lines, outbound then return, and the
price covers both.

## What comes back

Each result carries `price` (raw number) and `price_formatted`, the Skyscanner
`tags` (`cheapest`, `shortest` and their runners-up), and one entry in `legs`
per direction with `from`, `to`, `depart`, `arrive`, `duration_min`, `stops`,
`via`, `airlines`, and `day_offset` for arrivals that land the next day.

The top level also carries `search_status`. Skyscanner polls its providers, so
a search can come back `incomplete`; the tool retries up to six times and then
reports what it has. Prices from an incomplete search can still drop a little.

## Caveats

Prices are what Skyscanner quotes, so they are indicative until you actually
book. This reads an endpoint Skyscanner publishes for its own website rather
than a partner API, so treat it as personal-scale research and expect it to
break the day they change the contract. Endpoint details are in
[API-REFERENCE.md](API-REFERENCE.md).

Before this existed, the obvious-looking route was an MCP server wrapping
Skyscanner's *mobile* API. That one is walled off by PerimeterX and returns a
captcha to everything; it was tried and deleted. See `decisions.md` under
2026-08-04 if you are ever tempted to try it again.
