---
name: pp-trip
description: Manage trip pins for apps/trip-planner (trips.agrolloo.com) — create a trip, add/remove pins by name or coordinates, list, deploy. Use when the owner says "add X to my Varkala trip", "make a new trip for Bali", "research top places in Kyoto and pin them", "deploy my trip", "remove that pin", or names/edits any place on the trip map. Triggers on "pp-trip", "trip planner", "trip map", "add to trip", "trip pins".
---

# pp-trip — trip pin management

## What this skill drives

The `pp-trip` CLI at `tooling/cli/pp-trip/pp-trip`. It manages
`apps/trip-planner/trips/<slug>.json` and pushes updates to
`trips.agrolloo.com` via the Worker's write API.

## When to invoke it

The owner is telling you to change what shows on the map:

- "add Cafe X to varkala trip" → `pp-trip add`
- "make a new trip called bali-dec-2026" → `pp-trip new`
- "find the top 10 beaches near Goa and pin them" → research (WebSearch), then a
  batch of `pp-trip add` calls, then one `pp-trip deploy`
- "remove the anjengo fort pin" → `pp-trip remove`
- "what's on my varkala trip" → `pp-trip list <slug>`
- "deploy my trip" → `pp-trip deploy <slug>`
- "push everything" → `pp-trip deploy all`

## The one flow that matters

1. Edit the trip JSON (via `new` / `add` / `remove`) — this changes the
   git-tracked file only.
2. **Then** `pp-trip deploy <slug>` — this mirrors the file into
   Cloudflare KV so the live PWA sees it.

Forget step 2 and the change never reaches the phone. Always end an
add/remove batch with a single `deploy`.

## Categories

`stay | transport | beach | sight | food | utility`. Each has a default
emoji; override with `--emoji`.

## Geocoding

`add` without `--lat/--lon` calls Nominatim (OSM). Works for well-known
places. For a hole-in-the-wall or duplicate name, pass explicit
`--lat`/`--lon` — right-click on Google Maps → click the coords → paste.
Do NOT guess coordinates; wrong pins waste the owner's on-the-ground time.

## Slugs

Trip slugs: `^[a-z0-9-]{1,64}$`. Pin ids are auto-generated from the pin
name; the CLI ensures uniqueness within the trip.

## Escape hatches

Anything on `trips/<slug>.json` you can also edit by hand in a normal editor;
the CLI just writes valid JSON. If Claude ever mangles a file, the previous
version is one `git checkout` away.

## Non-goals

- No login gate here. Do not add auth for reads without a real reason.
- Do not write to KV outside the CLI's `deploy`; the JSON in git is truth.
- Do not switch tile provider without touching only `TILE_SOURCE` in
  `apps/trip-planner/src/app-html.ts` — that boundary is deliberate.
