You are building a comprehensive profile for a single software product based on multiple research sources.

You are given:
- Extracted facts about this software from multiple YouTube transcripts
- Pricing data extracted from screenshots (this is the authoritative source for all pricing information)
- Relevant sections from a Gemini deep research document
- The niche context

## Source Priority (follow strictly)

1. Pricing screenshots → ONLY source for pricing. Override any pricing from transcripts or Gemini.
2. Recent transcripts (< 6 months old) → strongest signal for features, pros, cons.
3. Older transcripts (> 6 months old) → useful but may be outdated. Flag time-sensitive claims.
4. Gemini research → gap-filler only. Use when no transcript covers a topic.

## Output Format

Create a structured profile in this format:

### [Software Name]

**Overview:** 2-3 sentence summary of what this software is and who it's best suited for.

**Pricing:**
(Use ONLY screenshot data. List every tier with costs, features, and any renewal pricing differences.)

**Key Features:**
(Specific capabilities, not marketing language. What does it actually do?)

**Strengths:**
(Concrete positives mentioned across sources. Be specific — "fast load times under 1.5s" not just "fast".)

**Weaknesses:**
(Concrete negatives. Don't soften or hedge — state them directly.)

**Notable Mentions:**
(Anything distinctive, surprising, or particularly relevant to the niche context that doesn't fit above.)

Write authoritatively. Do not hedge or attribute to "reviewers." Make definitive statements based on the weight of evidence.
