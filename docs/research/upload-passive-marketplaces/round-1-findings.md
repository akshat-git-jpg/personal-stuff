# Research snapshot — upload-once passive marketplaces (platform drives traffic, not saturated) — round 1

## Question being researched
Where can the user **bulk-upload digital assets once** and earn **passive income**, under two hard constraints:
1. **The marketplace's own buyer base + internal search/algorithm must surface the listing** — the user will NOT do external marketing / traffic generation.
2. **Not oversaturated** — a new uploader today can still realistically get organic surfacing.

User context: technically strong (generates CLIs/scrapers via a "printing-press" tool, runs Pinterest automation, has ElevenLabs/scraping/Gmail tooling). So code-based assets are in-scope, not just design files.

## Claims & conclusions

- **Apify Store is the strongest fit.** Top actors earn $5k–$20k/mo developer payout; many independents >$1k/mo; the most successful ones make >$10k MRR. Revenue is recurring per-run. Apify hosts infra + billing; 20% commission (rental) or platform-cost + 20% (pay-per-result). Internal Store search + Apify's own SEO drive buyers. Fits user's scraper-building skill. — evidence: apify.com/partners, help.apify.com, blog.apify.com (WebSearch, Jun 2026)
- **Apify saturation is concentrated, not total.** The big earners target Google Maps, LinkedIn, Amazon, Instagram, TikTok — those are crowded. Long-tail / niche-site scrapers are the open lane. — evidence: blog.apify.com
- **RapidAPI is weakening for solo sellers.** $44.9M revenue 2024 (up from $24M) BUT growth is now Enterprise Hub (~65% of revenue, six/seven-figure contracts); 35k APIs / 4M devs (crowded); 25% marketplace fee. Individual-developer earnings are openly questioned in community threads. — evidence: getlatka, zuplo, docs.rapidapi, latenode community (WebSearch)
- **AI training-data marketplaces are an emerging, low-saturation lane.** Opendatabay (LLM/fine-tuning datasets; upload + auto-exposed across LLMs/search; 5–30% tiered commission; payout within 30 days). Bounding.ai (computer-vision image datasets, royalties). Wirestock (sell photos/video into GenAI training sets; video especially scarce/high-demand). What sells = quality + provenance + legal right to use, NOT volume. — evidence: opendatabay.com, gisuser, bounding.ai (Medium), wirestock.io (WebSearch)
- **Whop marketplace has real organic discovery but is NOT pure-passive.** 2M+ weekly marketplace visitors, discovery algorithm + categories + trending + search. BUT: to appear on Whop Discover you need ≥1 paid product AND ≥1 genuine review; "top sellers all drive external traffic too"; marketplace-sourced buyers cost up to 30% commission vs 3% for your own. — evidence: insightraider, makerstack, bloggingx (WebSearch)
- **Etsy digital fails the no-traffic constraint.** Documented saturation + decline: shops down from 10–15 to 3–6 sales/day; one six-figure seller dropped $135k(2024)→$125k(2025). "Worth it only with strategic, data-driven, SEO-led research" = that IS driving traffic. — evidence: loveeattravelrepeat, craftedcharts, mydesigns (WebSearch)
- **Model hosting (Replicate / Hugging Face) is a weak passive play for asset authors.** Pricing info is all about what USERS pay to run models; no clear revenue-share/payout to people who upload models. — evidence: digitalocean, productmint, HF pricing docs (WebSearch)
- **Print-on-demand has low-competition pockets but marketplace internal traffic is the catch.** Tabletop gaming (board games, tarot, TCG), disc golf, bouldering, urban foraging, gravel biking cited as low-competition 2026 niches. Merch by Amazon gives Amazon-search internal traffic; Etsy/Shopify POD needs your own traffic. — evidence: gelato, printway, merchize (WebSearch)

## Conclusion drawn (to be attacked)
The two best bets under BOTH constraints are: **(1) Apify Store niche scrapers** (best fit for this user's skills + genuinely recurring) and **(2) AI training-data marketplaces** (newest, least saturated, upload-and-auto-expose). RapidAPI/Etsy/Whop partially violate the no-traffic or not-saturated constraints. Model hosting doesn't pay uploaders.

## Sources used (all secondary, web-search summaries, dated Jun 2026)
- Apify: apify.com/partners/actor-developers, help.apify.com, blog.apify.com, docs.apify.com
- RapidAPI: getlatka.com/companies/rapidapi, docs.rapidapi.com, zuplo.com, latenode community
- Data: opendatabay.com, gisuser.com, bounding.ai (Medium), wirestock.io
- Whop: insightraider.com, makerstack.co, bloggingx.com, semrush whop overview
- Etsy: loveeattravelrepeat.com, craftedcharts.com, mydesigns.io
- Model hosting: digitalocean.com, productmint.com, huggingface.co docs
- POD: gelato.com, printway.io, merchize.com, printful.com

## Open questions I already know about
- No primary earnings data — all figures are platform-published or blog-reported (selection/survivorship bias likely).
- "Upload once, platform drives traffic" is partly a myth on EVERY platform — even Apify/data marketplaces, does ranking really happen without reviews/external pull?
- Willingness-to-pay and time-to-first-dollar are unquantified for Apify long-tail and data marketplaces.
- Legal/ToS risk on scrapers (Apify) and on selling data/media into AI training sets (provenance, copyright) not assessed.
- Data-marketplace platforms (Opendatabay, Bounding.ai) are young — liquidity/actual buyer demand unverified.
