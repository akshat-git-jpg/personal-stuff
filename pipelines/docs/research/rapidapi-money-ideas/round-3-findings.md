# Research snapshot — RapidAPI money-making ideas — round 3

## Question being researched
Give a SOLO builder 2–3 NAMED, evidence-backed API ideas to make money on
RapidAPI — each with (1) a real demand + willingness-to-pay signal, (2) a thin or
beatable competitive field, (3) a defensible moat under the corrected gates.

## What changed since round 2
Round 2 verdict was NEEDS-WORK with 2 MAJOR findings:
- MAJOR-A: "drop all scrapers" was a logical inversion — anti-bot is a moat for
  whoever wins it (ScrapeCreators, a profitable SOLO scraper API, proves it).
- MAJOR-B: conclusion retreated into an un-actionable abstraction ("niche
  multi-source aggregation") with NO named, evidenced opportunity.
This round fixes Gate 3 and delivers three named ideas with web-verified demand.

### Corrected Gate 3 (was inverted in round 2)
- ❌ BAD: wrapping FREE/official data that merely sits behind anti-bot (commodity).
- ✅ GOOD: selling the anti-bot bypass / unified-normalized access ITSELF as the
  product, where the proxy+fingerprint+integration infra is the moat.

### Worked proof that a solo anti-bot API business is real (closes MAJOR-A)
ScrapeCreators (scrapecreators.com), founder Adrian Horning, Austin TX — a
self-described built-for-developers SOLO operation. 33+ platform APIs (TikTok, IG,
YouTube, X, LinkedIn, Reddit, Threads, Bluesky, Truth Social, + Facebook/Google/
LinkedIn/TikTok Ad Libraries). Pricing: Free 100 credits; Freelance $47/25k
($1.88/1k); Business $497/500k ($0.99/1k); Enterprise custom. So anti-bot scraping
across many platforms IS a viable solo business and the infra is the moat.

## THE THREE NAMED IDEAS (closes MAJOR-B)

### Idea A — Unified Ad-Library / competitor ad-intelligence API  [highest demand]
- DEMAND + WTP (web-verified): ad-intelligence software market $3.13B in 2024,
  projected $10.5B by 2035. Paid incumbents: MagicBrief from $249/mo, AdSpy
  $149/mo; an Apify ad-library scraper charges $0.005/ad. Performance marketers
  need it (Meta 2025: ad impressions +12%, price/ad +9% YoY → creative fatigue →
  demand for competitor ad intel). Clear, large, paying market.
- FIELD (pp-rapidapi): "Ad Libraries" 9.8/100%, "Google Ad Library" 9.7/100%,
  "Tiktok Ads Library" 9.6, "LinkedIn Ad Library" 9.4–9.5 — incumbents exist but
  are mostly SINGLE-platform. No dominant UNIFIED cross-platform normalized feed.
- MOAT: anti-bot + multi-source normalization across FB/Google/TikTok/LinkedIn ad
  libraries into one schema (waterfall-aggregation moat + Gate-3 anti-bot moat).
  ScrapeCreators proves solo-viable.
- HONEST CAVEAT: Meta has an OFFICIAL Ad Library API (free, but rate-limited,
  approval-gated, EU/politics restrictions). Differentiator must be unified
  cross-platform + no-approval + structured/dedup. Not greenfield; it's a
  "better-packaged" play in a fast-growing market.

### Idea B — Reddit data API  [thinnest field, strong demand, legal risk]
- DEMAND + WTP (web-verified): Reddit locked its API in 2023 ($0.24/1k calls,
  killed Apollo/RIF/Sync; Apollo faced ~$20M/yr). Nov 11 2025 "Responsible
  Builder Policy" now requires PRE-APPROVAL for ALL apps, including personal
  projects. Reddit data is so valuable that Google licenses it ~$60M/yr and
  OpenAI ~$70M/yr. Third parties are locked out → large unmet demand for
  programmatic Reddit data (AI training/RAG, social listening, market research).
- FIELD (pp-rapidapi): only TWO real listings — "reddit34" and "reddit3", both
  ~0.1–0.2 months old, 100% success. THIN, freshly-forming field.
- MOAT: anti-bot scraping of a platform that actively blocks + now gatekeeps its
  official API. Gate-3 compliant (the access itself is the product).
- HONEST CAVEAT: real LEGAL/ToS risk — Reddit is litigating against data scrapers
  (Reddit data-scraping suit, 2024–25). Higher risk than A or C; account/IP and
  potential legal exposure must be weighed.

### Idea C — Cheap self-serve invoice/receipt OCR  [lowest risk/effort, thinnest moat]
- DEMAND + WTP (web-verified): Mindee DISCONTINUED its free tier on 15 Sep 2025
  (Platform v2); Veryfi free = 100 docs total, then a $500/mo Starter minimum
  ($0.08/receipt, $0.16/invoice). Developers publicly asking for a "cheap"
  alternative after Mindee broke their workflow (invoiceninja GitHub #11150). The
  incumbents VACATED the cheap self-serve SMB/dev segment, and there's a clear
  price umbrella ($0.05–0.16/doc) to undercut.
- FIELD (pp-rapidapi): dedicated invoice/receipt OCR is WEAK — "Receipt and
  Invoice OCR API" at 8% success (likely a corpse), Taggun & "Receipt Recognition"
  aged/no live metrics; generic "OCR Wizard" is 100% but NOT invoice-structured.
  Genuine gap for a reliable, cheap, invoice-structured endpoint.
- MOAT: WEAKEST — it's a vision-LLM wrapper ($0.01–0.03/page), no data moat. The
  only moat is positioning (cheap self-serve into the vacated segment) +
  reliability + clean structured output. Honest ceiling: hobby-to-small income,
  not a business. BUT lowest effort (weekend build), NO anti-bot war, NO legal
  risk — best "first listing to learn the platform" bet.

## How the three map to the corrected gates + real economics
- Gate 1 (don't compete with free): A/B clear it (anti-bot access is the value);
  C partially (undercuts paid incumbents, not free ones — the free tiers just died).
- Gate 2 (aggregation/infra moat, not single wrapper): A strongest (multi-source
  + anti-bot), B medium (single-source but hard-to-access + anti-bot), C weakest.
- Gate 3 corrected (anti-bot bypass as product, not free-data wrapper): A/B pass;
  C n/a (no scraping).
- Real economics (round-2 seller data): expect 6–12mo ramp, 20–25% platform cut,
  realistic hundreds–low-thousands/mo for a solo — EXCEPT A, where the verified
  market size + WTP ($149–249/mo tools, $10.5B market) plus ScrapeCreators-style
  proof suggest a higher ceiling for an operator who clears the anti-bot moat.

## Recommendation
- Want real upside + willing to fight the anti-bot war → Idea A (ad intelligence).
- Want the thinnest field + accept legal risk → Idea B (Reddit data).
- Want to ship this weekend, low risk, learn the platform → Idea C (cheap invoice
  OCR), accepting it's hobby-tier income.

## Open questions still acknowledged
- Exact $ price tiers of the specific RapidAPI incumbents remain unobtained
  (JS-rendered pages); WTP evidence is from OFF-platform comparable tools +
  ScrapeCreators, not the RapidAPI listings themselves.
- "Demonstrated paying demand" for A and B is established at the MARKET level
  (paid competitors, licensing deals, market-size figures), not by a specific
  RapidAPI listing's subscriber count (not retrievable).
- Idea A: not validated whether a SOLO can keep 4 ad-library scrapers alive long-
  term vs Meta/Google defenses — ScrapeCreators is the existence proof but its
  per-platform reliability over time isn't independently confirmed.
- Idea B legal risk is real but unquantified (no case outcome yet).
- None of the three has been validated by actually building a prototype + getting
  one paying customer — the only true demand proof. This is research, not traction.
