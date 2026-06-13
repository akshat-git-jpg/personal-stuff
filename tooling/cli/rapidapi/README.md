# pp-rapidapi

Agent-native CLI for researching the public RapidAPI Hub. Use it to find gaps,
spot patterns, and size up the competition before you decide which API to build
and monetize.

## How it works

It replays the same request the public `rapidapi.com/hub` website fires for
search: `POST https://rapidapi.com/gateway/graphql`, operation `searchApis`.
The only auth is a CSRF token minted from `GET /gateway/csrf` (handled
automatically) plus a session cookie. No RapidAPI account, no API key.

It's unofficial. It reads public catalog data only. RapidAPI's official
GraphQL Platform API is Enterprise-Hub-only, so this is the only path on a
personal account. It can break if Nokia/RapidAPI changes the Hub, and reading
public data programmatically is a mild ToS gray area, so keep it to research.

Nothing to install beyond `requests` (already in the repo). Run
`./pp-rapidapi <cmd>`.

## Commands

```
search TERM [--category C] [--max N] [--sort relevance|popularity|latest]
                                  ranked APIs for a keyword
category NAME [--max N] [--sort ...]
                                  every API in a category (use exact names)
categories                        saturation map: API count per category
api SLUG [--term T]               one API's detail (best-effort from catalog)
gaps CATEGORY [--max N]           flag openings: weak/stale/slow/unreliable incumbents
competition TERM [--max N]        head-to-head table of who ranks for a keyword
```

Global flag: `--table` renders a human table instead of JSON (JSON is the
default, since it's cheap for agents to read).

`--sort popularity` has no server equivalent, so the fetched window is sorted
client-side on `popularityScore`. `latest` maps to the server's `ByUpdatedAt`.

## What each API record contains

`name`, `slug`, `category`, `pricing` tier (FREE / FREEMIUM / PAID),
`popularity` (0–10), `latencyMs`, `serviceLevel` (%), `successRate` (%),
`updatedAt`, `provider`, `description`, and a direct `url`.

What the endpoint does *not* give: exact `$` plan prices and per-endpoint
lists. Those are server-rendered on the API page, not in the GraphQL response.
Scraping them is a possible v2. For now the pricing tier plus the quality
metrics already answer most gap and competition questions.

## Examples

```bash
# Where are the openings in a niche?
./pp-rapidapi gaps "Cybersecurity" --max 60

# Who would I be competing with, and where are they weak?
./pp-rapidapi --table competition "stock market" --max 10

# Which categories are crowded vs thin?
./pp-rapidapi categories

# Look up one API
./pp-rapidapi api open-weather13
```

## Reading the `gaps` output

- `saturation`: thin (<25 APIs) / moderate / crowded (80+). A thin category
  with weak leaders is the strongest build-and-monetize signal.
- `freemiumShare`: when it's high (~0.9), buyers expect free, so it's harder to
  charge.
- `openings`: incumbents you could beat on reliability (`successRate`), speed
  (`latencyMs`), or freshness (`ageMonths`).

## MCP

Not wrapped as an MCP yet (deferred by design). Once you want it inside Claude
conversations, it's a thin shim over these subcommands.
