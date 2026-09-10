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
- "find the top 10 beaches near Goa and pin them" -> research (WebSearch),
  then a batch of `pp-trip add` calls, then one `pp-trip deploy`
- "remove the anjengo fort pin" -> `pp-trip remove`
- "what's on my varkala trip" -> `pp-trip list <slug>`
- "deploy my trip" -> `pp-trip deploy <slug>`
- "push everything" -> `pp-trip deploy all`

## The one flow that matters

1. Edit the trip JSON (via `new` / `add` / `remove`) - this changes the
   git-tracked file only.
2. **Then** `pp-trip deploy <slug>` - this mirrors the file into
   Cloudflare KV so the live PWA sees it.

Forget step 2 and the change never reaches the phone. Always end an
add/remove batch with a single `deploy`.

## HARD RULE - never guess coordinates

Pins placed at guessed coordinates ended up in the sea on 2026-09-10.
Do NOT invent a lat/lon from memory of a town, and do NOT hand-edit a
pin's `lat`/`lon` in the JSON. Coordinates for a pin come from exactly
one of these three sources, in this order:

1. **`pp-trip add --lat <n> --lon <n>`** - the owner right-clicked in
   Google Maps and gave you the numbers. Trust these fully.
2. **`pp-trip add` with no lat/lon** - the CLI hits Nominatim
   (`bounded=1` inside the trip's `viewbox`), prints the returned
   `display_name`, and exits code 3 asking for `--yes`. **Read that
   `display_name` before re-running with `--yes`.** If it names a town,
   region or country the owner did not name, or a "Kappil in Kasaragod"
   500 km away, the geocode is wrong - stop and ask for `--lat/--lon`.
3. **Overpass API** for named POIs the owner mentioned that Nominatim
   misses (temples, homestays, specific cafes). Query bounded to the
   trip's `viewbox`. Then run `pp-trip add --lat --lon`.

There is no fourth source. If none of these three yields coordinates
you can defend, **do not add the pin**. Tell the owner which name failed
and ask them to long-press the spot in Google Maps and paste the coords.

## Every trip needs a viewbox

The moment you `pp-trip new <slug>`, put a `viewbox` on the trip JSON:
format `"W,N,E,S"` as lon/lat pairs, sized to the destination town
(roughly 20-30 km on a side). Without it, "Kappil Beach" resolves to a
beach in Kasaragod; "Suprabhatham" resolves to a village 8 km outside
Varkala. `viewbox` is checked into git and read by `pp-trip add` as the
default `bounded` box, so every future add on that trip is safe by
default.

## Every trip needs a locationHint

Right next to `viewbox`, add a `locationHint` on the trip JSON. Format:
`"Town, Region, Country"` (e.g. `"Varkala, Kerala, India"`), NOT just
`"Varkala"`. The PWA appends this to every pin's name when it hands
off to the Google Maps app, so Google searches for the right "Cafe del
Mar" (there is one in every beach town on earth) and the right
"Sivagiri Mutt" (there are several). Without it, Google reverse-
geocodes the pin's lat/lon to whatever road name is nearest -- 2026-
09-10 that showed the Sivagiri Mutt pin as "Nanma" in the directions
strip. Skip a hint only for trips whose pins are all unambiguously
named globally, and even then it costs you nothing to add.

## Categories

`stay | transport | beach | sight | food | utility`. Each has a default
emoji; override with `--emoji`.

## Slugs

Trip slugs: `^[a-z0-9-]{1,64}$`. Pin ids are auto-generated from the pin
name; the CLI ensures uniqueness within the trip.

## Escape hatches

Anything in `trips/<slug>.json` you can also edit by hand for
non-coordinate fields (name, note, emoji, category). Do NOT hand-edit
`lat`/`lon` - see the hard rule above. If Claude ever mangles a file,
the previous version is one `git checkout` away.

## Non-goals

- No login gate here. Do not add auth for reads without a real reason.
- Do not write to KV outside the CLI's `deploy`; the JSON in git is truth.
- Do not switch tile provider without touching only `TILE_SOURCE` in
  `apps/trip-planner/src/app-html.ts` - that boundary is deliberate.
