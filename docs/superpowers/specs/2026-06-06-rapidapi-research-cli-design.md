# pp-rapidapi — RapidAPI Hub research CLI

Date: 2026-06-06
Status: BUILT. Replay path confirmed during the discovery spike (no browser,
no login, no Enterprise key needed) — Playwright fallback was NOT required and
is dropped from v1. CLI lives at `cli/rapidapi/`.

## Discovery spike result (what we actually found)

The Hub's public search is `POST https://rapidapi.com/gateway/graphql`,
operation `searchApis`. Auth is just a CSRF token from `GET /gateway/csrf`
(+ session cookie) and a `rapid-client: hub-service` header — **anonymous**,
replayable from plain Python `requests`. The response gives per-API:
name, slug, description, pricing tier, category, provider, updatedAt, and a
score block (popularityScore, avgLatency, avgServiceLevel, avgSuccessRate).
The sort enum `SearchApiSortingFieldName` only accepts `ByRelevance` and
`ByUpdatedAt`; popularity sort is done client-side. Exact $ plan prices and
endpoint lists are server-rendered only (not in the GraphQL) — deferred to v2.

## Goal

A personal CLI for **researching the RapidAPI Hub**: find market gaps, spot
patterns, and size up competition so I can decide which API to build and
monetize. Research/discovery is the daily driver. Analytics on my own APIs and
publishing are explicitly out of scope for v1 (they require Enterprise Hub).

## Key constraint (why the design looks the way it does)

The official RapidAPI **GraphQL Platform API is Enterprise-Hub-only** — a
personal account cannot use it for research, analytics, or publishing. The
research data we want (categories, popularity, subscriber/usage signal,
latency, pricing tiers, competitors per keyword) is all **publicly visible on
the Hub website**, which the `rapidapi.com/hub` UI loads from an internal
endpoint.

Probed facts (2026-06-06):
- `https://rapidapi.com/gateway/graphql` is a live GraphQL endpoint, but
  **introspection is disabled** and it **requires auth** (`401 "Introspection
  is not allowed"`). The exact search query + how the client token is minted
  must be captured from a real browser session.
- The Hub UI is client-rendered; the search request carries a session/client
  token that may be short-lived.

This is an **unofficial** integration. Accepted risks: breaks if Nokia
restructures the Hub; the token may be hostile to raw replay; mild ToS gray
area (reading public data programmatically).

## Approach

Chosen: **A — unofficial public-Hub CLI**, structured so other data sources
could be added later (option C) without rework. Not Enterprise (B).

## Architecture

Python CLI matching the existing `cli/youtube` convention:
- `cli/rapidapi/pp-rapidapi` — bash wrapper resolving the repo venv python
- `cli/rapidapi/pp_rapidapi.py` — argparse CLI, JSON output (`_dump` style)
- `cli/rapidapi/README.md`

### Swappable fetch layer (the crux)

All commands go through one `Fetcher` interface so command code never knows
which backend is live:

- **Primary — `ReplayFetcher`:** replays the captured GraphQL request against
  `rapidapi.com/gateway/graphql`. Used if the discovery spike shows the client
  token is anonymous/long-lived. Fast, clean.
- **Fallback — `PlaywrightFetcher`:** drives the real `rapidapi.com/hub` in a
  headless browser (Playwright is already used in the Pinterest skills),
  scrapes rendered results and/or intercepts the JSON network responses. Used
  if the token is per-session/short-lived. Slower, more brittle, but
  session-proof.

The backend is selected by config/env (e.g. `RAPIDAPI_FETCHER=replay|playwright`),
defaulting to whatever the discovery spike proves out.

## Commands (v1)

- `search <term> [--max N]` — ranked APIs for a keyword: name, slug, category,
  popularity score, subscriber/usage signal, avg latency, short description.
- `category <name> [--max N]` — browse/rank an entire category.
- `api <slug>` — one API's detail: pricing tiers, endpoint count, popularity,
  reviews/rating, provider.
- `gaps <category>` — aggregate a category and flag openings: thin
  (few APIs), poorly-rated, or expensive spots. Heuristic, not magic.
- `competition <term>` — side-by-side of who ranks for a term + their pricing,
  to decide what to undercut.

Output: JSON by default (agent-friendly), mirroring the other pp- CLIs.

## Implementation order

1. **Discovery spike (first, needs user logged into rapidapi.com):** capture a
   real Hub search via browser network capture (HAR). Determine the exact
   GraphQL query/operation, required headers, and how the client token is
   obtained + how long it lives. Decide replay vs. Playwright.
2. Build the `Fetcher` interface + the chosen backend.
3. Implement `search` and `api` (the two primitives the others build on).
4. Implement `category`, then `gaps` and `competition` as aggregations over
   `search`/`category`.
5. Wrapper script + README. Manual testing (no test suite — personal tooling).

## Out of scope (v1)

- MCP wrapper — deferred; trivial shim once the CLI is proven.
- Analytics on my own APIs, publishing/managing my own listings (Enterprise).
- Multi-source intel (option C) — the fetch layer leaves room for it later.
