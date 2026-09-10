---
name: pp-trip
description: Manage trip pins for apps/trip-planner (trips.agrolloo.com) - create a trip, add or remove pins, list, deploy. Use when the owner says "add X to my Varkala trip", "make a new trip for Bali", "research top places in Kyoto and pin them", "deploy my trip", "remove that pin", or names/edits any place on the trip map. Triggers on "pp-trip", "trip planner", "trip map", "add to trip", "trip pins".
---

# pp-trip - trip pin management

## What this skill drives

The `pp-trip` CLI at `tooling/cli/pp-trip/pp-trip`. It manages
`apps/trip-planner/trips/<slug>.json` and pushes updates to
`trips.agrolloo.com` via the Worker's write API.

## When to invoke it

The owner is telling you to change what shows on the map:

- "add Cafe X to varkala trip" -> `pp-trip add`
- "make a new trip called bali-dec-2026" -> `pp-trip new`
- "find the top 10 beaches near Goa and pin them" -> research, then a
  batch of `pp-trip add` calls, then one `pp-trip deploy`
- "remove the anjengo fort pin" -> `pp-trip remove`
- "these coords are wrong" -> `pp-trip update <slug> <pin-id> --lat --lon`
- "check my pins are right" -> `pp-trip audit <slug>`
- "what's on my varkala trip" -> `pp-trip list <slug>`
- "deploy my trip" -> `pp-trip deploy <slug>`

## The one flow that matters

1. Edit the trip JSON (`new` / `add` / `update` / `remove`) - git-tracked file only.
2. **Then** `pp-trip deploy <slug>` - mirrors the file into Cloudflare KV
   so the live PWA sees it.

Forget step 2 and the change never reaches the phone. Always end a batch
with a single `deploy`.

Tracked-file edits need a workspace. `pp-trip` refuses on branch `main`
and tells you to run `pp-work claim` first.

## HARD RULE - never guess coordinates

Pins placed at guessed coordinates ended up in the sea on 2026-09-10. Do
NOT invent a lat/lon from memory of a town, and do NOT hand-edit a pin's
`lat`/`lon`. Coordinates come from exactly one of these four sources:

1. **`pp-trip add --lat --lon`** - the owner long-pressed the spot in
   Google Maps and read you the numbers. Trust these fully. Stored as
   `source: owner`, and `audit` will not touch them.
2. **Nominatim / OpenStreetMap**, bounded to the trip's `viewbox`. The
   CLI does this automatically. Good for beaches, temples, roads, forts.
   Stored as `source: osm`.
3. **Google Places API (New)** - the CLI's last rung, and the only source
   that reliably has small businesses in India. OSM was missing Zostel
   Varkala, Hope Hostels and Coffee Temple entirely. Stored as
   `source: google`, with Google's `placeId`.
4. **Overture Maps** - a free open POI dataset (Meta/Microsoft/AWS), for
   the rare place even Google misses under the name the owner used. Query
   it yourself with DuckDB (recipe below) and pass
   `--lat --lon --source overture`.

If none of the four yields a coordinate you can defend, **do not add the
pin**. Say which name failed and ask the owner to long-press the spot.

## Google Places: it is free, and it cannot be billed

Key lives in `infra/secrets/google-places.env` (gitignored), on Google
Cloud project `n8n-workflows-454504`, restricted to `places.googleapis.com`.

**That project has no billing account attached, deliberately.** So the key
cannot be charged: past the free tier, calls fail instead of costing
money. There is nothing to budget and no cap to configure. India pricing
also gives Text Search Pro 35,000 free calls/month against a real need of
about 15.

Three further guards, in order of which trips first:

- The **cache** (`apps/trip-planner/geocache.json`, git-tracked) means a
  name resolved once is never queried again, on any machine.
- Google is the **last** rung, so most pins never reach it.
- A self-imposed **200 calls/month** ceiling in the CLI, counted from an
  append-only log. Raise it for one run with `PP_TRIP_GOOGLE_CAP=<n>`.
  This is a runaway-loop detector, not a spend control.

**No key is a normal state, not an error.** A fresh clone (the sister's
Windows checkout) just stops at rung 2. Never print Cloud Console setup
steps at her; if her machine genuinely needs work, write a prompt the
owner forwards to her Claude.

## audit: report first, apply almost never

`pp-trip audit <slug>` re-resolves every pin and prints the drift. It has
two outcomes, and the split is the whole point:

- **Agrees** (within `--tolerance`, default 150 m): adopts the `placeId`
  and `source` and **leaves the coordinates alone**. Agreement is
  confirmation, not a reason to nudge a good pin.
- **Disagrees**: prints the suggestion and changes nothing. Moving a
  coordinate needs `--apply --only <pin-id>`.

**Do not batch-accept disagreements.** The 2026-09-10 audit found six,
and only one was our pin being wrong. For the rest Google offered a
resort 357 m from the beach it was asked about, an unnamed plus-code in
place of North Cliff, and a boat club in place of a lake. Auto-applying
would have made the map worse. Read each one, decide, then `update` it.

`audit` also refuses to adopt a `placeId` when the returned name does not
plausibly match the pin's (`name_matches`). A pin for "Holy Rabbit Cafe"
sat 119 m from Google's "The White Rabbit Cafe" and would have picked up
that restaurant's id, sending Directions to the wrong door. On a cliff
packed with cafes, distance alone cannot catch this.

## Before you declare a place "not findable", try spelling variants

On 2026-09-10 "Sarva on the cliff" was reported missing. It is in OSM, as
**Cafe Sarwaa**. One letter cost a false negative. A name miss is not a
miss until you have tried:

- **Substring, not whole word.** Grep for `sarw`, `zost`, `moll` - four
  or five characters.
- **Transliteration swaps** for Indian names: v/w, aa/a, th/t, ee/i,
  collapsing double letters (Sarwaa/Sarva, Kurakanni/Kurakkanni).
- **Brand vs branch.** "Hope Hostels" is one brand with several Varkala
  properties. Ask which, or pin the one whose address fits and say which
  you picked in the `note`.
- **A web search for the plain name**, to learn its real spelling, then
  re-query with that.

Pull every named POI in the trip's bbox once, then grep it locally as
many times as you like:

```bash
pip3 install --quiet --target ./pylibs duckdb
```
```sql
INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';
SELECT names.primary, bbox.ymin AS lat, bbox.xmin AS lon, confidence
FROM read_parquet('s3://overturemaps-us-west-2/release/<YYYY-MM-DD.0>/theme=places/type=place/*.parquet')
WHERE bbox.xmin BETWEEN <west> AND <east>
  AND bbox.ymin BETWEEN <south> AND <north>;
```

List releases first - the newest is not guessable:
`curl -sS "https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/?list-type=2&delimiter=/&prefix=release/"`

**Overture's precision varies, and it has a tell.** Some entries are
dumped on a fake town-centre point: 52 unrelated POIs shared the
coordinate Overture gave for Hope Hostels, and 15 shared Molly's. Both
were wrong by over a kilometre. So before trusting an Overture
coordinate, count how many other POIs sit on the exact same point. More
than one means throw it out. `confidence` alone does not catch this (that
Hope Hostels row scored 0.755).

Overpass is still fine for OSM-only lookups. Note the axis order:
Overpass wants `(S,W,N,E)` while the trip's `viewbox` is `W,N,E,S`.

## Every trip needs a viewbox

The moment you `pp-trip new <slug>`, set `viewbox`: format `"W,N,E,S"` as
lon/lat pairs, sized to the destination town (20-30 km a side). Without
it "Kappil Beach" resolves to Kasaragod, 500 km away, and "Suprabhatham"
to a village 8 km outside Varkala. It is checked into git and read by
`add` and `audit`, and it is sent to Google as `locationRestriction` so
the search is bounded server-side rather than filtered afterwards.

## Every trip needs a locationHint

Right next to `viewbox`, format `"Town, Region, Country"` (e.g.
`"Varkala, Kerala, India"`), NOT just `"Varkala"`. Two jobs: the CLI
checks a returned address mentions at least one of those words before
accepting it, and the PWA appends it to the Google Maps handoff so
Google finds the right "Cafe del Mar".

A pin's `placeId` beats the hint outright when present - the map sends it
as `query_place_id`/`destination_place_id` and Google opens that exact
place. That is the real fix for the 2026-09-10 bug where the Sivagiri
Mutt pin arrived in Google Maps labelled "Nanma".

## Categories and provenance

Categories: `stay | transport | beach | sight | food | utility`. Each has
a default emoji; override with `--emoji`.

`source` on every pin is one of `owner | google | osm | overture |
unknown`. It shows on the info card, so the owner can see which pins rest
on weaker evidence without asking. Set it honestly: `--source` exists
precisely so an Overture coordinate is not mislabelled as owner-supplied.

## Tests

`python3 tooling/cli/pp-trip/test_pp_trip.py` - stdlib unittest, no
network, no deps, runs on Windows too. Extend it when you touch viewbox
parsing, distance, the address/hint match, name matching, cache keys or
the env-file parse. Those are the five places where a silent bug becomes
a wrong pin on a map.

## Escape hatches

Non-coordinate fields (name, note, emoji, category) are safe to hand-edit
in `trips/<slug>.json`. Do NOT hand-edit `lat`/`lon` - use `update`. If a
file gets mangled, the previous version is one `git checkout` away.
`pp-trip add --dry-run` prints the lookup it would run without calling
anything.

## Non-goals

- No login gate for reads. Do not add auth without a real reason.
- Do not write to KV outside the CLI's `deploy`; the JSON in git is truth.
- Do not switch tile provider without touching only `TILE_SOURCE` in
  `apps/trip-planner/src/app-html.ts` - that boundary is deliberate.
- Do not put the Places key anywhere near the Worker. `app-html.ts` is
  client-side; a key in a Worker secret is one refactor from page source.
