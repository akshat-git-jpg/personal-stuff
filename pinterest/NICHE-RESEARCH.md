# Pinterest Niche & Pin Research — method + findings log

How we research Pinterest *data-first* (which niche, which pins) and the findings so far.
The engine is the **`pinterest-research`** skill (installed in both Claude accounts). This doc is
the durable record so the research isn't lost and any future session knows how to reproduce it.

> Pair this with `PINTEREST-PRINCIPLES.md` (the rules) — research finds *what* to make; principles
> govern *how* to make it well.

---

## Why this exists (the core insight)
The official Pinterest API hides competitor engagement. But a **logged-in browser** can read the
hidden numbers (saves, pin age) straight out of Pinterest's own page JSON — the same data the
SortPins extension overlays. We drive a real (headless) browser with **Playwright**, scroll like a
human to load results, capture the JSON Pinterest's own app fetches, and rank pins by a velocity
signal. Free, runs on the **Mac (residential IP)** — datacenter IPs get blocked.

**Save-velocity is the key metric:** `savesPerMonth = saves ÷ ageDays × 30`. A pin with 45k saves in
9 days (≈151k/mo) is winning *now*; a 136k-save pin that's 6.5 years old (≈1.7k/mo) is not. Raw saves
mislead — velocity finds live outliers.

---

## The toolset (`pinterest-research` skill)
Path: `~/.claude-personal/skills/pinterest-research/` (mirror in `~/.claude-work/`).

| File | Job |
|---|---|
| `connect-arc.mjs` | **Reuse an existing Arc login** over Arc's debug port → saves the session. No re-login. |
| `login.mjs` | Alternative: log in via a popup Chromium, save the session. |
| `research.mjs` | **Deep keyword research** — scrape N keywords, rank pins by save-velocity, print + save JSON. |
| `niche-scan.mjs` | **Niche discovery** — scan many candidate niches at once, score each (demand/buys?/open?). |
| `lib/scrape.mjs` | Data logic: path-agnostic deep-walk of Pinterest JSON → pin records → velocity ranking. |

Session is saved to `TY/pinterest/.auth/pinterest-state.json` (**gitignored — it's a credential**).

### Setup (once)
```bash
cd ~/.claude-personal/skills/pinterest-research
npm install --registry=https://registry.npmjs.org && npx playwright install chromium
```
Login (reuse Arc — fully quit Arc first, then):
```bash
/Applications/Arc.app/Contents/MacOS/Arc --remote-debugging-port=9222 >/dev/null 2>&1 &
node connect-arc.mjs        # confirms Pinterest login, saves the session; Arc can close after
```

### Run — niche discovery
```bash
node niche-scan.mjs --rounds 3 --top 25      # scores the candidate niches in niche-scan.mjs
```
Per niche it computes: **topVelocity** (demand), **productLinkPct** (% winners linking to a
product/shop = does the audience BUY), **freshTopPct** (% top pins <45 days = can new pins break in =
how open), **distinctDomains** (fragmentation). Output saved to `TY/pinterest/_niche-scan/`.

### Run — deep keyword research (after picking a niche)
```bash
node research.mjs --niche wedding --rounds 6 --top 12 "wedding planning checklist" "wedding timeline"
```
Output saved to `TY/pinterest/<niche>/research/<date>-<kw>.json`.

---

## The scoring criteria (a good niche needs all four)
1. **Demand** — pins getting saved *fast* (save-velocity).
2. **Monetization proof** — winning pins link to paid products (Etsy/Gumroad/Payhip/Shopify). If the
   top pinners already sell PDFs, the audience buys. *Strongest "this niche makes money" signal.*
3. **Beatability / openness** — fresh pins breaking into the top (low % = locked up by incumbents),
   spread across many small creators (fragmented = enterable).
4. **Product-fit** — we can actually make the PDF/printable, and it suits our templates (checklists,
   planners, weekly grids, guides) and Pinterest's buyer audience.

Then: cluster winning **formats**, harvest recurring **keywords** (alignment), find **gaps** to beat,
and write scored briefs (Greenlight / Reshape / Skip) for `pinterest-make-post`.

---

## Findings log

### 2026-06-02 — keto deep-scan (proof run)
3 keywords (`keto dinner`, `keto breakfast`, `keto meal plan`), ~370 pins, 84.6s. Learnings:
- **Top live outlier:** "20 Quick Keto Dinners in Under 30 Minutes" — 45,308 saves in 9 days (≈151k/mo).
- **Winning formats:** numbered listicle + a constraint ("under 30 minutes", "that aren't eggs");
  "X-Day plan for beginners"; "3-ingredient" simple recipes (evergreen save magnets).
- **Funnel proof:** a competitor ("Keto Pancakes", 23k/mo) links straight to a *paid* keto PDF guide.
- **Keywords:** low carb · for beginners · meal prep · under 30 minutes · high protein · weight loss.
- Raw data: `keto/research/2026-06-02-*.json`.

### 2026-06-02 — 12-niche opportunity scan (which niche to sell digital products)
1 keyword each, 3 scrolls, 107.6s. Raw data: `_niche-scan/scan-2026-06-02.json`.

| Niche | Demand (top/mo) | Buys? (productLink%) | Open? (fresh<45d%) | Spread (domains) | Read |
|---|---|---|---|---|---|
| **Wedding** | 984 | 72% | 52% | 10 | 🟢 Best balance: buyers + wide-open + checklist/planner fit |
| **Budget/Finance** | 651 | 56% | 44% | 8 | 🟢 Evergreen, repeat buyers, a whole product line |
| **Self-care/wellness** | 180 | 56% | 56% | 4 | 🟢 Dark horse — most open + trending, thin data |
| Printable wall art | 1858 | 76% | 32% | 13 | ⚠️ Top buy-rate but it's *art files*, not PDF guides |
| Teacher/homeschool | 4812 | 40% | 8% | 20 | ⚠️ Huge demand but freebie culture + new pins can't break in |
| Home/cleaning | 1731 | 32% | 32% | 10 | 🟡 Demand ok, weak buy-intent |
| Fitness | 306 | 48% | 48% | 11 | 🟡 Content wins, planners sell weakly |
| Meal-planner | 65 | 64% | 36% | 17 | 🔴 Low demand (recipes win, "planners" don't) |
| Manifestation / ADHD / Small-biz / Resume | low | 20–40% | — | — | 🔴 Weak buy-signal or one-off flukes |

**Conclusion / recommendation:**
- **"Highest demand" ≠ best.** Teacher/homeschool had 5× demand but only 8% fresh pins (locked up) +
  a free-printable culture → bad for a newcomer selling PDFs.
- **Top picks: Wedding & Budget/Finance** — both hit all four criteria. Wedding = most open + highest
  buy-intent among guide niches + high spend (one-time customers, huge volume). Budget = evergreen +
  repeat buyers (budget planner → debt payoff → savings challenge = a shop, not one product).
- **Self-care** = highest openness (56% fresh) + trending, but thin/concentrated data = higher risk.
- **Skip printable wall art for us** despite its 76% buy-rate — it's a design/art-file game, not the
  PDF-guide game our templates are built for.
- **Status:** niche not yet finalised — awaiting the user's pick (by interest, among Wedding / Budget /
  Self-care), then a full multi-keyword deep-scan to confirm before committing.

---

### 2026-06-02 — wedding deep-scan (chosen niche)
5 keywords (`wedding planning checklist`, `wedding planner printable`, `wedding budget tracker`,
`wedding timeline`, `how to plan a wedding`), 513 wedding-relevant unique pins. Raw data:
`wedding/research/2026-06-02-*.json`.

- **Hero format = the Wedding Planning Checklist.** Owns the top of every search. Fresh winner:
  "The Ultimate Wedding Planning Checklist" — 277 saves in 11 days (≈755/mo) → links to a **paid
  Payhip product**. A brand-new pin already winning = niche is open NOW.
- **Monetization confirmed:** top product-linked pins go to Etsy + Payhip (e.g. "Printable My Wedding
  Checklist" 984/mo on Etsy).
- **Sub-products (the product line):** checklist (anchor) · budget breakdown ("$10K/$20k wedding") ·
  day-of timeline ("for a 2PM ceremony") · decor checklist · guest/RSVP · name-change guide · the
  all-in-one **Wedding Planner Binder** (the $19–29 hero bundle).
- **THE WEDGE:** the biggest-save magnet pins (Comprehensive Checklist 1,296 saves; Budget Breakdown
  1,470 saves; multiple "wedding planning boards") **link to nothing / sell nothing.** Brides save them
  en masse with no funnel. Play = make the same magnet → free mini-checklist → email → paid planner PDF.
- **Winning title patterns:** "Ultimate/Complete Wedding Planning Checklist", "...You'll Actually Use",
  "$X Wedding Budget Breakdown", "X Steps + Timeline", "for a 2PM Ceremony".
- **Keywords:** wedding planning checklist · ultimate/complete · printable · bride/bridal · wedding
  budget breakdown · wedding day timeline · order of events · ceremony to reception · name change.
- **First briefs:** (1) Ultimate Wedding Planning Checklist [free-guide, lead magnet] · (2) How to
  Budget a $10k Wedding [listicle] · (3) 12-Month Wedding Timeline [weekly-grid] · (4) The Checklist
  You'll Actually Use [listicle]. **Product:** "The Ultimate Wedding Planner" PDF bundle (~$19–29) +
  free 1-page checklist lead magnet. Timing: engagement season Nov–Feb → Dec–Mar peak search.

## Gotchas
- Numbers are **directional** (Pinterest's own fields, fuzzy labels) — rank by them, don't quote as gospel.
- Run from the **Mac** (residential IP). If a run returns 0 pins, the session expired → re-login.
- The scrape pulls a little **off-niche noise** (Pinterest mixes in unrelated pins); `niche-scan` filters
  by relevance tokens, `research.mjs` does not yet (a relevance filter is a known TODO).
- ToS-grey (like any scraping) — keep it gentle, on the dedicated research account.
