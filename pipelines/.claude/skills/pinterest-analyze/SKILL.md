---
name: pinterest-analyze
description: Weekly, evidence-based performance review of YOUR posted Pinterest pins for a niche. For a given period it reads your pins + their analytics, pulls the competitors currently ranking on each pin's target keyword (via the research bot), diagnoses WHY your pins are or aren't getting reach and clicks, and gives prioritized, neutral fixes to grow saves/clicks to your Gumroad offer. Appends a dated entry to the niche ANALYSIS-LOG.md. Triggers on "run pinterest analysis", "analyze my pins", "pinterest weekly review", "how are my pins doing", "pinterest-analyze".
user-invocable: true
metadata:
  author: kbtg
  version: 1.0.0
---

# pinterest-analyze

Tell the user the **truth** about their pins — what's working, what isn't, and the highest-impact
fix — backed by data, never generic advice. This is a critic, not a cheerleader and not a doomer.

> **READ FIRST:** `~/codebase/personal-stuff/pipelines/pinterest/PINTEREST-PRINCIPLES.md` + the niche `playbook.md`.
> Judge pins against those rules AND the live competitors — not against opinion.

## Neutrality rules (non-negotiable)
1. **Evidence or silence.** Every claim cites a number (the pin's stats) or a concrete competitor
   comparison. No vibes, no horoscope advice.
2. **"Too early" is a valid verdict.** Pinterest SEO is a ~6-month game. A pin a few days old with low
   saves is NOT failing — flag insufficient data explicitly; never manufacture a problem to look useful.
3. **Separate FACT from HYPOTHESIS.** State the numbers as fact; label every "why" as a hypothesis.
4. **No generic filler** ("post more consistently", "use better keywords") unless tied to THIS pin's
   specific, shown gap.
5. **If it's working, say "keep going."** Don't invent changes.
6. **Rank fixes by expected impact.** 3–5 actions, not 20 equal ones.

## Inputs
- **Period** — user-specified (e.g. "last 7 days", a date range). Default: last 7 days.
- **Niche** — e.g. `wedding`.
- **Your performance data (account-safe):** the Pinterest **Analytics export** the user dropped in
  `<niche>/analytics/` (CSV, or pasted numbers). If absent → say so and run a **structural + competitor
  analysis only** (no performance claims). Never scrape/automate the posting account to get this.

## Process
1. **Gather your pins.** Read `pipelines/pinterest/<niche>/posts.json` (posted flag + postedDate + pinUrl) and
   each posted pin's `post.json` (title, target keyword, board, link) + `notes.md`. Keep those in the period.
2. **Attach performance.** Match each pin to its row in the analytics export → impressions, outbound
   clicks, saves, pin clicks. Compute **CTR = outbound clicks ÷ impressions**. No export → mark "no perf data".
3. **Pull live competition per pin.** For each pin's target keyword, run the research bot (research
   account, public search — never the posting account):
   ```bash
   node "/Users/kbtg/codebase/personal-stuff/tooling/claude-skills/pinterest-research/research.mjs" \
     --niche <niche> "<keyword>" --rounds 6 --top 15
   ```
   → the current top competitors + their save-velocity to benchmark against.
4. **Diagnose each pin (neutral, evidence-led).** Classify the bottleneck:
   - **Distribution** (low impressions): keyword/board/relevancy mismatch — or simply too new.
   - **Conversion** (impressions OK but CTR low, ~<0.5–1%): image doesn't stop the scroll / weak title /
     no clear payoff vs the competitors ranking for that keyword.
   - **Off-benchmark:** image or copy measurably weaker than the ranking pins (say exactly how).
   - **On track:** saving/clicking at or above benchmark → keep doing it.
   - **Too early:** not enough impressions yet to judge — watch, don't touch.
5. **Verdict + actions.** Overall **stay the course / tweak / pivot**, then 3–5 prioritized, specific,
   evidence-backed actions (which pin, what change, expected effect). Tie everything to the real goal:
   **more reach + more outbound clicks to the Gumroad offer.**
6. **Log it.** Append a dated entry to `pipelines/pinterest/<niche>/ANALYSIS-LOG.md` (create if missing) in the
   format below, so week-over-week drift is visible.

## ANALYSIS-LOG.md entry format
```markdown
## <YYYY-MM-DD> — reviewed <period> (<N> pins)
**Verdict:** stay the course | tweak | pivot — <one line>
**Numbers:** <impressions / outbound clicks / saves totals; best & worst pin>
**Working:** <evidence>
**Not working + why (hypothesis):** <evidence + clearly-labeled guesses>
**Actions next week (ranked by impact):**
1. <pin> — <specific change> → <expected effect>
**Watching (too early to call):** <pins/keywords>
```

## Honesty notes
- You **cannot** see your exact Pinterest search rank (Pinterest doesn't expose it). Infer from
  impressions + whether your pin shows up in the scraped results — say "inferred", never "ranked #X".
- New account / new pins: distribution builds over weeks. Don't over-correct on <2 weeks of data.
- Competitor scrape uses the **research account only**; the posting account is never automated.
