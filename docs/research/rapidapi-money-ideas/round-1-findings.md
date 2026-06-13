# Research snapshot — RapidAPI money-making ideas — round 1

## Question being researched
On RapidAPI Hub, which API ideas can a solo builder publish and actually make
money from? Specifically: (a) is an "EV charging finder" API a good money-maker?
(b) what are better alternatives?

## Method / tooling
All data pulled from `pp-rapidapi`, an unofficial CLI that replays the public
RapidAPI Hub GraphQL `searchApis` operation (same request the rapidapi.com/hub
website fires). It returns public catalog records only. Fields per API: name,
slug, category, pricing tier (FREE/FREEMIUM/PAID), popularity (0–10),
latencyMs, serviceLevel %, successRate %, updatedAt, ageMonths, provider,
description. It does NOT return actual $ plan prices, subscriber counts,
revenue, or per-endpoint lists. Data obtained 2026-06-06.

Important caveat about the metrics: "popularity" is a 0–10 score of unknown
construction (RapidAPI's internal popularity signal, not raw subscriber/revenue
count). "successRate" and "latencyMs" are RapidAPI's measured health metrics.
None of these directly equal revenue.

## Claims & conclusions

### On the EV charging finder
- CLAIM: EV charging finder is NOT a good money-maker. Evidence:
  - "EV charging" keyword returns 15+ competitors (competition command).
  - Energy category: 113 total APIs, CLI flags it "crowded", freemiumShare 0.88.
  - Top incumbent "EV Charge Finder" (OpenWeb Ninja): popularity 9.8, successRate
    100%, ageMonths 1.7 (fresh but already #1). latency 6393ms.
  - Several fast alternatives already exist: "411 Vehicle Data" 186ms, "EV
    Stations" 618ms.
- CLAIM: No data moat. Evidence/reasoning: I asserted the underlying data comes
  from free public datasets — US DOE NREL Alternative Fuel Stations API and
  OpenChargeMap — so any builder can wrap the same free source, which is why
  there are ~12 near-identical wrappers. (NOTE: this is my own domain knowledge,
  NOT verified via any tool in this session.)
- CLAIM: 88% freemium share → buyers expect free → hard to charge.

### On better alternatives (the 4 recommended ideas)
The framing I used: there are no empty niches (every category returns "crowded"),
so the winning play is "high-demand keyword where the current leader is weak —
beat it on reliability, speed, or freshness." Ideas ranked:

1. Reliable YouTube transcript API. Evidence: keyword leaders are unreliable —
   "Youtube transcriptor" 9.9 popularity but 84% successRate; another listing
   64% successRate; another 13016ms latency. Claimed demand: "huge" (AI
   summarizer apps). Claimed moat: needs rotating-proxy infra because YouTube
   blocks. (Demand + moat claims are my reasoning, not tool-verified.)

2. Invoice/receipt → JSON extraction API. Evidence: "Receipt and Invoice OCR
   API" successRate 8% (broken); "Invoice Data Extraction API" no live metrics;
   generic OCR APIs (OCR Wizard 100%) aren't invoice-structured. Claimed: strong
   B2B/fintech willingness to pay; buildable with a vision LLM. (WTP claim is my
   reasoning, not tool-verified.)

3. Instagram Statistics/analytics API. Evidence: "Instagram Statistics API" 9.9
   popularity but 65% successRate, 11.2 months old (stale). Hot keyword, flaky
   leader.

4. Fast Indeed/jobs scraper. Evidence: "Indeed Scraper API" 9.7 popularity but
   20721ms latency; "Upwork Jobs" 0% successRate (broken). Jobs category 269 APIs.

### What I told the user to avoid
- Commodity/strong-leader niches: EV charging, weather, fuel prices, generic
  OCR, HTML→PDF.
- Saturated mega-scrapers where every leader is already 9.9 pop / 100% success:
  LinkedIn, Amazon, TikTok, Google Maps, real estate. Stated reason: would need
  serious infra just to match; not a solo entry point.

### Recommendation given
Start with #1 (YouTube transcript) or #2 (invoice extraction). #2 has better
money (B2B pays), #1 has bigger raw volume. Both have visibly broken/weak
incumbents and are solo-buildable.

## Raw competition data captured (for reference)
- YouTube transcript leaders: Youtube transcriptor (9.9 pop, 3197ms, 84%),
  YouTube Captions/Transcript/Subtitles (9.9, 4999ms, 83%), YT Summarizer GPT
  (9.8, 6822ms, 98%), Youtube Transcribe Fastest (9.7, 3480ms, 99%), YT
  Transcripts (9.6, 13016ms, 64%).
- Invoice OCR: OCR Wizard (9.6, 521ms, 100%), Doc2txt (9.2, 100%), OCR Supreme
  (8.2, 100%), Receipt and Invoice OCR (0.1 pop, 413ms, 8%), Invoice Data
  Extraction (no metrics).
- Email verification (an avoided-but-noted space): Validect (9.7, 100%, 28.6mo),
  MailOK (9.7, 100%), Advanced Email Validator (9.7, 99%).
- Company enrichment: B2B Company Data Enrichment (9.7, 83%), Pro Email Finder
  (9.7, 83%), Company Enrichment (9.5, 54%, 49.6mo stale), Company Intelligence
  (0.1, 0%).

## Open questions I already know about
- "popularity" score construction is opaque; does high popularity actually mean
  meaningful paying demand, or just traffic/visibility?
- successRate/latency are point-in-time health snapshots — could be transient
  outages, not durable weakness. Not checked over time.
- I never verified actual $ pricing for any incumbent (CLI can't return it).
- The "free public data source" claim for EV (NREL/OpenChargeMap) is unverified.
- "Willingness to pay" for invoice OCR / YouTube transcript is asserted, not
  evidenced with any real buyer/pricing signal.
- YouTube transcript & Instagram scraping carry ToS/legal risk and RapidAPI
  policy risk that I did not assess.
- No check of whether a weak successRate listing is actually losing customers vs
  still earning despite the metric.
- Survivorship/visibility bias: the CLI only shows what ranks in search; dead or
  unlisted APIs that failed aren't shown, so "weak incumbent = opportunity" may
  ignore why others already failed there.
