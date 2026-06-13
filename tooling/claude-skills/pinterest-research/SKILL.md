---
name: pinterest-research
description: Find winning, replicable Pinterest pin ideas for a niche by scraping live search results, reading hidden engagement (saves + pin age → save-velocity), ranking the outliers, and turning them into scored, ready-to-build pin briefs. Triggers on "research pinterest", "research keto pins", "find winning pinterest pins", "what should I post on pinterest", "find outlier pins", "pinterest-research", "give me pin ideas for <niche>".
user-invocable: true
metadata:
  author: kbtg
  version: 1.0.0
---

# pinterest-research

Tell the user what pins to make next, backed by real data. Scrape live Pinterest search for the
niche's keywords, read each pin's hidden engagement (saves + age → **save-velocity**), surface the
**outliers** (winning fast), then critique + reshape them into concrete briefs the user can build
with `pinterest-make-post`.

> **READ FIRST — every run:** `~/codebase/TY/pinterest/PINTEREST-PRINCIPLES.md`. All scoring,
> keyword, and brief decisions below MUST follow it (search-engine mindset, specific-beats-broad,
> alignment, the 4 click triggers, mistakes-to-avoid, the pin→freebie→email→PDF funnel).

## How it gets the data (no paid API needed)
The official Pinterest API hides competitor engagement, so we use a logged-in real browser. A
**research Pinterest account** session is captured once; then a headless Chromium runs searches and
reads the engagement numbers straight out of Pinterest's own page data (the same numbers the SortPins
extension overlays). Runs on the user's **Mac (residential IP)** — datacenter IPs get blocked.

## Two modes
- **Niche discovery** (`niche-scan.mjs`) — *which niche should I sell in?* Scores many candidate
  niches at once on demand / monetization / openness. Edit the `CANDIDATES` list to change niches.
- **Deep keyword research** (`research.mjs`) — *what pins should I make in this niche?* Scrapes a few
  keywords, ranks pins by save-velocity, produces scored briefs.

## One-time setup (check, install only if missing)
Let `SKILL_DIR` = this folder.
1. Deps: if `SKILL_DIR/node_modules` is absent →
   `cd "<SKILL_DIR>" && npm install --registry=https://registry.npmjs.org && npx playwright install chromium`
2. Session: if `~/codebase/TY/pinterest/.auth/pinterest-state.json` is absent, the **user** logs in once.
   Best: reuse their Arc session (no re-login). Tell them to fully quit Arc, then run in their terminal:
   `! /Applications/Arc.app/Contents/MacOS/Arc --remote-debugging-port=9222 >/dev/null 2>&1 &`
   then you run `node "<SKILL_DIR>/connect-arc.mjs"` to save the session.
   Fallback (popup login): `! node "<SKILL_DIR>/login.mjs"`.

## Niche discovery (run when picking a niche)
`node "<SKILL_DIR>/niche-scan.mjs" --rounds 3 --top 25` → per-niche scorecard JSON (topVelocity,
productLinkPct = do they BUY, freshTopPct = is it OPEN, distinctDomains). Saved to
`TY/pinterest/_niche-scan/`. Analyse against the four criteria (Demand · Monetization · Openness ·
Product-fit), recommend the niche, then deep-scan it. See `TY/pinterest/NICHE-RESEARCH.md` for the
method + the running findings log (APPEND new scans there so research isn't lost).

## Process (deep keyword research)
1. **Niche + keywords.** Get the niche (e.g. keto). Keywords come from the user, or from the niche
   `config.json` `researchKeywords`, or default to the niche name. Favour **specific** seed terms
   (per principles): "keto dinner", "keto breakfast", "keto meal plan" — not just "keto".
2. **Scrape.** Run:
   `node "<SKILL_DIR>/research.mjs" --niche <niche> "kw1" "kw2" [--rounds 6] [--top 20]`
   It prints compact JSON (top pins per keyword: title, saves, savesPerMonth, ageDays, pinUrl, link,
   image, pinner) and writes the full list to `<niche>/research/<date>-<kw>.json`.
3. **Analyse (this is the value).** From the scraped pins:
   - **Outliers:** highest `savesPerMonth` = winning fast → strongest to replicate.
   - **Format/angle clusters:** what TYPES win (listicles, weekly grids, single-recipe, planners…)
     and what hooks/titles recur. Map winning formats to our templates.
   - **Keywords:** harvest the recurring phrases from winning titles/descriptions = the terms to
     reuse across pin/board/profile (alignment rule).
   - **Gaps:** what's missing or weak in the top results that our PDF/offer can beat.
4. **Score + brief each idea** on the rubric → **Greenlight / Reshape / Skip**. For greenlit, output
   a concrete brief: working title (using ≥2 click triggers), the hook, the target keyword phrase,
   the `pinterest-make-post` template to use, and one line on **why it should win** (cite the data).
5. **Handoff.** Present the ranked briefs. Greenlit ones are ready to run through `pinterest-make-post`.
   (Idea-bank persistence — Google Sheet or local file — is a later add; for now present in chat +
   the raw JSON is saved under `<niche>/research/`.)

## Scoring rubric (every candidate)
| Dimension | Greenlight when… |
|---|---|
| **Demand** | the keyword clearly has volume / multiple high-save pins |
| **Velocity proof** | top pins show high `savesPerMonth` (winning, not just old) |
| **Beatability** | top results look generic/weak — we can make a clearly better version |
| **Offer-fit** | it pulls toward the PDF/freebie funnel |
| **Replicability** | one of our templates can produce it well |
| **Differentiation** | there's a specific angle/gap we can own |

## Notes / gotchas
- Numbers are **directional** (Pinterest's own fields; labels can be fuzzy) — rank by them, don't quote
  them as gospel.
- Run from the **Mac** (residential IP). Selectors/data shapes can change — `research.mjs` reads pins
  path-agnostically (deep-walks Pinterest's JSON), but if a run returns 0 pins, the session likely
  expired → re-run `login.mjs`.
- ToS-grey (like any scraping); keep it gentle and on the dedicated research account.
