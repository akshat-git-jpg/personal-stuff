# Research snapshot — RapidAPI money-making ideas — round 2

## Question being researched
On RapidAPI Hub, which API ideas can a SOLO builder publish and actually make
money from — with a defensible moat and real evidence of money, not just a
"beatable" health metric? (a) Is EV charging finder good? (b) better alts?

## What changed since round 1
Round 1 verdict was NEEDS-WORK with 3 MAJOR findings:
- MAJOR-1: internal contradiction — disqualified EV charging for "no data moat,"
  then top-picked invoice OCR which is "buildable with a vision LLM" (lowest moat).
- MAJOR-2: "weak incumbent = opportunity" conflates lazy incumbents with
  structurally hard niches; YouTube/IG/Indeed weakness is external anti-bot, which
  a new entrant inherits.
- MAJOR-3: zero revenue evidence; whole ranking rested on an opaque "popularity"
  score that ≠ revenue.
This round closes all three with web research into real economics + moats, and
rebuilds the selection criteria.

## NEW evidence gathered this round (all web-verified)

### Real RapidAPI seller economics (closes MAJOR-3)
Source: Latenode/RapidAPI community thread of individual sellers.
- Realistic earnings are MODEST and SLOW: one seller ~$800/mo from a weather
  analytics API, but ~1 year to first paying customer. Another: profitable around
  month 4, "not massive money, but covers servers plus decent profit." A third:
  "revenue didn't mean anything for eight months."
- Consistent winning pattern, stated independently by multiple sellers:
  - "Niche APIs crush generic ones."
  - Biggest mistake = "trying to compete with free alternatives." (This directly
    validates the EV-charging-is-bad thesis — EV finder competes with free
    NREL/OpenChargeMap.)
  - Target BUSINESSES not individual devs: "they pay consistently and don't whine
    about fair pricing." Winning examples cited: document conversion for small
    businesses; real-estate data feeds.
- RapidAPI takes a 20–25% commission on all sales (sources vary 20% vs 25%).
- LIMITATION: exact $ price tiers for specific incumbents (EV Charge Finder,
  youtube-transcriptor, etc.) could NOT be retrieved — RapidAPI pricing pages are
  JS-rendered and not readable by WebFetch/search. So "money evidence" here is at
  the market/platform level (commission %, real seller revenue reports, competitor
  price floors below), not per-incumbent-tier. This is an honest gap.

### Moat reality for scrapers (closes MAJOR-2)
Source: youtube-transcript-api GitHub issue #511; Proxyway 2026 YouTube scraper guide.
- YouTube blocks cloud-provider IP ranges by ASN and added PoToken bot-detection
  in 2025–26. Residential proxies (~$5–10/GB) still return 403s even when rotated.
- Therefore the 64–84% success ceiling on every YouTube transcript incumbent is
  STRUCTURAL to the niche, not incumbent laziness. A new entrant inherits the same
  ceiling and the same perpetual, escalating cost war vs a $2T adversary.
- CLASSIFICATION (transient opening vs structural trap):
  - YouTube transcript → STRUCTURAL TRAP. Drop.
  - Instagram stats → STRUCTURAL TRAP (same anti-bot dynamic). Drop.
  - Indeed/jobs scraper → STRUCTURAL TRAP (same). Drop.
  - These three are removed from recommendations.

### Moat reality for invoice OCR (closes MAJOR-1, partially rehabilitates idea #2)
Sources: Mindee pricing/blog; Veryfi pricing FAQ; invoiceninja GitHub #11150.
- "Buildable with a vision LLM" was wrongly sold as an advantage in round 1. It is
  a NEGATIVE for moat: frontier models do invoice→JSON at ~$0.01–0.03/page, so the
  next 50 sellers can clone it. No data moat. Round-1 contradiction acknowledged.
- BUT a real MARKET SHIFT creates a thin positioning opening:
  - Mindee DISCONTINUED its free tier on 15 Sep 2025 (Platform v2).
  - Veryfi free tier = only 100 docs/mo, then a $500/mo Starter minimum.
  - Developers are publicly asking for a "cheap" alternative (invoiceninja issue
    #11150) after Mindee's change broke their workflow.
- So the only honest framing of invoice OCR: NOT a tech/data-moat play, but a
  PRICING/POSITIONING play for the cheap self-serve SMB/dev segment that
  Mindee/Veryfi just abandoned. Thin, replicable moat; realistic outcome is the
  "few hundred $/mo, covers servers + profit" tier, not a business.

### What "defensible" actually looks like (new, positive direction)
Sources: Crustdata B2B data API ranking; market-clarity monetization guide.
- The moat in data APIs is NOT the source — it's the aggregation: "how providers
  aggregate, verify, and deduplicate across multiple sources" (waterfall
  enrichment). Single-source wrappers (EV charging, single-site scrapers) have no
  moat by definition.
- Defensible shapes that recur: multi-source B2B enrichment, and signal/intent
  data (funding rounds, hiring surges, exec departures, technographics normalized
  from 35+ sources). The moat = the integration + normalization + dedup work, which
  is ongoing and hard to clone, not a single endpoint.

## Revised claims & conclusions

### EV charging finder — VERDICT UNCHANGED: bad money-maker
- Confirmed: data is free (NREL Alt Fuel Stations + OpenChargeMap, both
  web-verified as free/open). No moat. Competes with free → the #1 stated mistake
  of real sellers. Fresh strong leader already owns the keyword. Skip.

### The four round-1 alternatives — 3 of 4 now DROPPED
- YouTube transcript #1 — DROPPED. Structural anti-bot trap; inherited 64–84%
  ceiling; perpetual cost war.
- Instagram stats #3 — DROPPED. Same.
- Indeed/jobs scraper #4 — DROPPED. Same.
- Invoice OCR #2 — DOWNGRADED to "thin, conditional." Only viable as a cheap
  self-serve positioning play into the post-Mindee gap; no durable moat;
  realistic ceiling is hobby-income, not a business.

### Revised recommendation (rebuilt criteria)
The real selection test is now three gates, ALL required:
  1. Does NOT compete with a free/official source (kills EV, weather, fuel).
  2. Moat = ongoing multi-source aggregation/normalization, NOT a single wrapper
     and NOT a commodity-LLM wrapper (kills invoice OCR, generic OCR).
  3. NOT gated by an escalating platform anti-bot war (kills YouTube/IG/Indeed
     scrapers).
  Plus positioning: sell to BUSINESSES, niche over generic, expect 6–12 month
  ramp and modest (hundreds–low-thousands/mo) revenue after a 20–25% platform cut.

The shape that passes all three: niche multi-source B2B data aggregation /
signal data for a workflow businesses would rather buy than build. Concrete
solo-scale examples from real winners: document-conversion for SMBs, real-estate
data feeds, normalized multi-source company/contact enrichment or intent signals
for a vertical too small for People Data Labs to bother with.

## Open questions still acknowledged
- Could NOT get exact $ price tiers per incumbent (JS-rendered pages). Money
  evidence is market-level, not per-listing.
- "Popularity" score construction still opaque; now de-emphasized in favor of
  the three-gate moat test + real seller-revenue reports.
- The defensible "multi-source aggregation" direction is sound in principle but I
  have NOT identified a specific, validated niche with demonstrated paying demand —
  it's a shape/criteria, not yet a named, evidenced opportunity.
- Whether "broken" incumbents (8%, 0% success) are corpses vs still-earning:
  reframed — for the dropped scrapers it no longer matters (whole niche dropped);
  for invoice OCR the 8% one is treated as a likely corpse, not an opening.
