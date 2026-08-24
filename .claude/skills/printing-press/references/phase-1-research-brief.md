## Phase 1: Research Brief

**When `BROWSER_SNIFF_TARGET_URL` is set:** Skip the catalog check, spec/docs search, and SDK wrapper search — none of these exist for an undocumented website feature. Focus research on understanding what the site/feature does, who uses it, what workflows it supports, and what competitors offer similar functionality. The spec will come from browser-sniffing in Phase 1.7.

Before reading documentation, read [references/fetch-docs.md](references/fetch-docs.md). Use `fetch-docs.sh` for the API's primary docs, OpenAPI/Postman links, auth guides, error handling, rate limits, pagination, webhooks, and any per-endpoint reference page. Preserve exact status codes and inspect the returned local file directly so enum values, field constraints, casing, examples, and nav/link variants are not lost through summarization.

Before starting research, check if the API has a built-in catalog entry:

```bash
cli-printing-press catalog show <api> --json 2>/dev/null
```

If the catalog has an entry for this API, branch on the entry type:

**Spec-based entry** (`spec_url` populated) — present the user with a choice:

> "<API> is in the built-in catalog (spec: <spec_url>). Use the catalog config to skip discovery, or run full discovery?"

- If catalog config: use the spec_url from the catalog entry, skip the research/discovery phase
- If full discovery: proceed with the normal research workflow

**Wrapper-only entry** (no `spec_url`, `wrapper_libraries` populated) — this is a reverse-engineered API that has no official spec but has known community libraries. The catalog entry is a **discovery aid only**: `cli-printing-press generate` requires `--spec` and does not consume wrapper-library metadata, so there is no direct generation path from a wrapper-only entry today. Tell the user this up front via `AskUserQuestion`:

> "<API> has no official spec. The catalog knows about these community-maintained wrappers, but the Printing Press cannot generate a CLI directly from a wrapper. The next step has to be browser-sniffing the upstream to author an internal YAML spec, browser-sniffing or HAR-capturing the dominant source first and then using the multi-source aggregator pattern for secondary hand-authored sources, or hand-writing a Go module that imports the wrapper. Which path do you want?"

Present each `wrapper_libraries` entry alongside the question with language, integration mode, and notes so the user can see what implementation backing exists. Example for `google-flights`:
- **krisukox/google-flights-api** (Go, native, MIT) — Pure Go, importable; single-binary CLI with no runtime deps.

Record the user's choice (and the selected wrapper, when relevant) in `$API_RUN_DIR/state.json` under an `implementation` field so later phases can read it. For wrapper or hand-written-module paths, use `{ "kind": "wrapper", "library": "<name>", "url": "<url>", "integration_mode": "native|subprocess|html-scrape", "next_step": "browser-sniff|hand-written-module" }`. For the aggregator path, use `{ "kind": "aggregator-pattern", "dominant_source": "<source>", "spec_source": "browser-sniff|har|provided-spec", "spec_path": "<path-to-generated-spec>", "secondary_sources": ["<source>"], "next_step": "aggregator-pattern" }`; do not populate `library` or `integration_mode` unless a specific secondary source is backed by a wrapper. This field is for skill bookkeeping; the generator does not currently read it. If the user picks browser-sniff, route into the Phase 1.7 browser-sniff path to produce a spec, then run `generate --spec` against it. If the user picks the aggregator path, first route the dominant source through Phase 1.7 browser-sniff or HAR capture to produce the primary spec, then read and apply [references/aggregator-pattern.md](references/aggregator-pattern.md): generate from that spec, then hand-author the secondary source clients and `sources` command tree. If the user picks a hand-written module, stop the press here and hand off — there is no generator path to drop them into.

**No catalog hit** — proceed normally without mentioning the catalog.

**Adding new wrapper-only APIs:** drop a YAML file in `catalog/` with `wrapper_libraries` populated and rebuild the binary. No skill changes needed.

Write one build-driving brief, not a stack of phase essays.

The brief must answer:

1. What is this API actually used for?
2. What are the top 3-5 power-user workflows?
3. What are the top table-stakes competitor features?
4. What data deserves a local store?
5. Why would someone install this CLI instead of the incumbent?
6. What is the product name and thesis?

Research checklist:
- Find the spec or docs source. For docs pages whose details affect generation, fetch the raw page with `fetch-docs.sh`, then read/grep the returned path directly.
- Find the top 1-2 competitors
- **Check GitHub issues on the top wrapper/SDK repo for "403", "blocked", "broken", "deprecated", "rate limit".** If multiple issues report the API is inaccessible or broken, flag this in the research brief as a reachability risk. This is critical for unofficial/reverse-engineered APIs.
- Find official and popular SDK wrappers on npm (`site:npmjs.com`) and PyPI (`site:pypi.org`)
- Find 2-3 concrete user pain points
- Identify the highest-gravity entities
- Pick the top 3-5 commands that matter most

Do not produce separate mandatory documents for:
- workflow ideation
- parity audit
- data-layer prediction
- product thesis

Put them in the one brief.

Write:

`$RESEARCH_DIR/<stamp>-feat-<api>-pp-cli-brief.md`

Suggested shape:

```markdown
# <API> CLI Brief

## API Identity
- Domain:
- Users:
- Data profile:

## Reachability Risk
- [None / Low / High] [evidence: e.g., "6 open issues on reteps/redfin about 403 errors since 2025"]
- Tier/permission hints from 4xx body: [omit when absent; otherwise quote the matched bounded line(s) from Phase 1.9]
- Probe-safe endpoint used: [omit when absent; otherwise "<METHOD> <path>" from `x-pp-safe-probe`]

## Top Workflows
1. ...

## Table Stakes
- ...

## Data Layer
- Primary entities:
- Sync cursor:
- FTS/search:

## Codebase Intelligence
- [DeepWiki findings if available, otherwise omit this section]
- Source: DeepWiki analysis of {owner}/{repo}
- Auth: [token type, header, env var pattern]
- Data model: [primary entities and relationships]
- Rate limiting: [limits and behavior]
- Architecture: [key insight about internal design]

## User Vision
- [USER_BRIEFING_CONTEXT if provided, otherwise omit this section]

## Source Priority
- [Only present for combo CLIs. Copy the confirmed ordering from `source-priority.json`.]
- Primary: <Source A> — [spec state: official / community-wrapper / no-spec-browser-sniff-required] — [auth: free / paid]
- Secondary: <Source B> — [...]
- Tertiary: <Source C> — [...]
- **Economics:** [e.g., "Primary is free; paid key for <Source B> is scoped to its own commands only."]
- **Inversion risk:** [e.g., "Primary has no OpenAPI; secondary has 53-endpoint spec. Do NOT let spec completeness invert the ordering."]

## Product Thesis
- Name:
- Why it should exist:

## Build Priorities
1. ...
2. ...
3. ...
```

**MANDATORY: Before proceeding to Phase 1.5 (Absorb Gate), you MUST evaluate Phase 1.6 (Pre-Browser-Sniff Auth Intelligence), Phase 1.7 (Browser-Sniff Gate), and Phase 1.8 (Crowd-Sniff Gate) below.** If no spec source has been resolved yet (no `--spec`, no `--har`, no catalog spec URL), the browser-sniff gate decision matrix MUST be evaluated. Do not skip to Phase 1.5.

**Phase 1.5 will refuse to proceed without a `browser-browser-sniff-gate.json` marker file.** Phase 1.7 writes this file with one entry per source (one entry for single-source CLIs, one entry per named source for combo CLIs). Missing marker = HARD STOP back to Phase 1.7. See Phase 1.7 "Enforcement" below for the contract.

## Phase 1.6: Pre-Browser-Sniff Auth Intelligence

After Phase 1 research completes, analyze findings to proactively assess what auth context the user could provide. This step uses research intelligence to ask the right question before browser-sniffing starts, rather than waiting for the user to volunteer "I logged in."

**Skip this step if:** The briefing (Orientation & Briefing section) already captured auth context (`AUTH_CONTEXT` is set from the user selecting "I have an API key or I'm logged in").

**Classify the API's auth profile from research findings:**

| Signal from research | Auth profile | What to ask |
|---------------------|-------------|-------------|
| Community wrappers use API keys (e.g., `STRIPE_SECRET_KEY`), MCP source shows `Authorization: Bearer` headers, spec has `security` section | **API key auth** | "Do you have an API key for `<API>`?" |
| Site has user accounts, research found auth-only features (order history, saved items, rewards, account settings), login pages exist | **Browser session auth** | "This API has authenticated endpoints ([list specific features from research, e.g., order history, saved addresses, rewards]). Are you logged in to `<site>` in your browser? The browser-sniff will find more endpoints if you are." |
| Endpoints accessible without auth, no login-gated features found, community wrappers describe API as "no auth required" | **No auth needed** | Skip this step silently |
| Both API key AND browser session features found | **Dual auth** | Ask about both: API key for smoke testing, browser session for browser-sniff |

**Name the specific features the user would unlock.** Do not say "auth would help." Say "This API has order history, saved addresses, and rewards that require a logged-in session."

**Where signals come from:**
- Phase 1 brief's "Data profile" and "Top Workflows" sections
- Phase 1.5a MCP source code analysis (auth patterns, token formats)
- Community wrapper README "auth" or "authentication" sections
- The API Key Gate's token detection (Phase 0.5) — if it already found a key, don't re-ask

**For API key auth:** Present via `AskUserQuestion`:
> "Do you have an API key for `<API>`? It will be used for read-only live smoke testing in Phase 5."
>
> 1. **Yes** — user provides the key or confirms it's in the environment
> 2. **No, continue without it** — skip live smoke testing

If the user provides a key, set it in `AUTH_CONTEXT` so the API Key Gate (Phase 0.5) does not re-ask.

**For browser session auth:** Present via `AskUserQuestion`:
> "`<API>` has authenticated endpoints ([list features]). Are you logged in to `<site>` in your browser? If so, the generated CLI will support `auth login --chrome` — you'll be able to authenticate just by being logged into the site in Chrome. No API key needed."
>
> 1. **Yes, I'm logged in** — I'll use your session during browser-sniff and enable browser auth in the CLI
> 2. **No, but I can log in** — I'll help you log in before browser-sniffing
> 3. **No, skip authenticated endpoints** — browser-sniff only public endpoints

Set `AUTH_SESSION_AVAILABLE=true` if the user selects option 1 or 2. The Browser-Sniff Gate (Phase 1.7) will use this flag. After traffic capture, Step 2d in [references/browser-sniff-capture.md](references/browser-sniff-capture.md) validates that cookie replay works before enabling browser auth in the generated CLI.

**For dual auth:** Ask about both in sequence — API key first (simple env var check), then browser session.

---

