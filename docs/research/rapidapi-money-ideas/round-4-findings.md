# Research snapshot — RapidAPI money-making ideas — round 4 (final, cap)

## Question
Give a solo builder 2–3 NAMED, demand-backed API ideas for RapidAPI, with HONEST
risk framing.

## What changed since round 3
Round 3 verdict: NEEDS-WORK, zero BLOCKER, two MAJORs — both about honest risk
framing, NOT missing evidence (critic CONFIRMED 8 of 9 demand specifics itself).
This round applies the two reframes; no new demand research needed.

### Demand/WTP facts — all independently CONFIRMED by the round-3 critic
- Ad-intelligence market: real, large, ~9.8% CAGR. (Exact figures vary by research
  house — closest single source ~$2.87B (2024) → ~$8B (2035); other houses higher.
  Treat as "real and growing," NOT a precise $3.13B→$10.5B.)
- AdSpy $149/mo; MagicBrief from $249/mo (3-mo min). CONFIRMED.
- Meta Ad Library API is genuinely FREE but approval-gated (app review + business +
  identity verification, ~200 calls/hr, no creative media, one country/call).
- Reddit locked API 2023 ($0.24/1k, killed Apollo ~$20M/yr). CONFIRMED.
- Reddit Nov 2025 Responsible Builder Policy: pre-approval for ALL apps incl.
  hobby, 2–4 wk review. CONFIRMED.
- Reddit licensing: Google ~$60M/yr, OpenAI ~$70M/yr (~10% of Reddit revenue).
- Mindee killed free tier 15 Sep 2025 (overage from $0.05/credit). Veryfi free=100
  docs then $500/mo Starter ($0.08 receipt/$0.16 invoice). invoiceninja #11150
  devs want a cheap alt. ALL CONFIRMED.

## REFRAME 1 (closes round-3 MAJOR on Idea B legal risk)
Idea B (sell scraped Reddit data) is RECLASSIFIED from "thin-field opportunity" to
"AVOID / do-not-build for most solo builders," because:
- Reddit filed suit 22 Oct 2025 naming data-scraping VENDORS — SerpApi, Oxylabs,
  AWM Proxy — under DMCA §1201 anti-circumvention (plus separate Perplexity &
  Anthropic suits). Selling scraped Reddit access is the precise conduct being
  litigated, against third-party scrapers, not just AI labs.
- An unresolved suit = open-ended exposure, not safety.
- A RapidAPI Reddit-scraping listing would almost certainly be killed on first
  DMCA/ToS complaint (marketplace risk, on top of legal risk).
- Verdict on B: the thin field is thin FOR A REASON (legal/circumvention risk +
  Reddit's active enforcement), which is exactly the survivorship trap the earlier
  rounds warned about. Keep B in the brief only as a documented "why this looks
  tempting but is a trap" example.

## REFRAME 2 (closes round-3 MAJOR on Idea A differentiation)
Idea A (unified ad-library/ad-intelligence API) is kept but HONESTLY downgraded
from "highest demand / higher ceiling (assertion)" to "best risk-adjusted of the
scraper-class ideas, with real but unproven-for-solo durability":
- The "no-approval" differentiator is partly a circumvention treadmill: it means
  doing the verification/anti-bot work Meta gates, and Meta can tighten it. Not a
  permanent moat — a maintained one.
- ScrapeCreators is ONE anecdote AND a direct competitor already at $0.99–1.88/1k
  covering ad libraries; a solo entrant competes with it, not just with weak
  RapidAPI listings. "Higher ceiling" is plausible (verified market + WTP), not
  proven for a new solo entrant.
- WTP evidence is market-level (paid comparable tools), not from a specific
  RapidAPI listing's subscribers (not retrievable). Disclosed limit, acceptable
  for an idea brief.
- Legal posture milder than B: Meta's Ad Library is PUBLIC transparency data and
  Meta is not running a §1201 scraper-vendor campaign like Reddit — but ToS
  circumvention risk is non-zero.

## FINAL RANKED RECOMMENDATION (honest)
1. Idea C — Cheap self-serve invoice/receipt OCR. SAFEST, lowest effort, clear
   evidenced gap (Mindee/Veryfi vacated the cheap segment), no anti-bot war, no
   meaningful legal risk. Honest ceiling: hobby-to-small income, thin moat
   (positioning + reliability, not data). Best FIRST listing to learn the platform
   and get a paying customer fast.
2. Idea A — Unified ad-library/ad-intelligence API. HIGHEST UPSIDE if you can win
   and maintain the anti-bot/normalization work, in a large growing paid market —
   but you compete with ScrapeCreators and ride a Meta-defense treadmill. For a
   builder willing to invest in infra. Real but unproven-for-solo durability.
3. Idea B — Reddit data API. AVOID. Tempting (thin field, huge demand, licensing
   deals prove value) but it's the exact model Reddit is actively suing scraper
   vendors over under DMCA §1201. Documented here as a trap, not a recommendation.

## Cross-cutting honest framing (from real seller data, round 2)
- Expect 6–12 month ramp, 20–25% RapidAPI commission, realistic hundreds–low-
  thousands/mo for a solo. Winners target BUSINESSES, niche over generic, and
  NEVER compete with free (the #1 stated mistake — which is why EV charging fails).
- None of these is validated by a built prototype + one paying customer — the only
  true demand proof. This is a vetted idea brief, not traction.

## Open items remaining at cap
- Exact RapidAPI per-listing $ tiers + subscriber counts never retrievable
  (JS-rendered); WTP is market-level. Disclosed, acceptable for an idea brief.
- Idea A solo durability vs ScrapeCreators + Meta defenses: unproven.
- Market-size figures for ad intelligence vary >2x across research houses; use
  directionally only.
- Idea B legal exposure unquantified (suit unresolved) — handled by reclassifying
  B as AVOID.
