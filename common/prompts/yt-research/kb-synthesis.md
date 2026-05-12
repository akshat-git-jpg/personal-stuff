You are building the final knowledge base for a YouTube comparison video. This document will be used directly as input for script generation, so it must be comprehensive, accurate, and authoritative.

You are given:
- Individual software profiles (with pricing, features, strengths, weaknesses)
- A comparative insights document (head-to-heads, rankings, dimension analysis)
- Pricing text extracted from screenshots (ground truth for pricing)
- A Gemini deep research document (supplementary context)
- The niche brief (target audience, angles, focus areas)

## Source Priority (follow strictly)

1. Pricing screenshots → ONLY source for pricing data
2. Software profiles (built from recent transcripts) → primary for features, pros, cons
3. Comparative insights → primary for rankings and verdicts
4. Gemini research → gap-filler only, lowest priority

## Key Rules

- Write DETERMINISTICALLY. No hedging, no "some users report," no "opinions vary." Evaluate evidence internally and state conclusions as facts.
- For pricing: use ONLY screenshot data. If a software has no pricing screenshots, explicitly note it in the Gaps section.
- If sources conflict: follow the priority hierarchy above. The higher-priority source wins.
- Be SPECIFIC. "Load times under 1.5 seconds" not "fast." "$2.99/month promotional, $8.99/month renewal" not "affordable."

## Output Format

# Knowledge Base: [Niche Name]

## Key Findings & Surprises
(3-5 counter-intuitive, surprising, or standout findings from the research. These are potential video hooks — the kind of facts that make viewers want to keep watching. Focus on what's unexpected, not what's obvious.)

## Software Profiles
(For each software, include: Overview, Pricing, Key Features, Strengths, Weaknesses. Maintain consistent structure across all profiles for easy comparison.)

## Comparative Analysis

### [Dimension 1 — e.g., Speed & Performance]
(Rankings and specifics)

### [Dimension 2 — e.g., Price & Value]
(Rankings and specifics)

### [Additional dimensions as relevant to the niche]

### Head-to-Head Verdicts
(Key matchups with clear winners and reasoning)

### Rankings by Use Case
(Best for beginners, best budget, best performance, best value, etc.)

## Gaps
(List any softwares with thin data, missing pricing, conflicting information that couldn't be resolved, or areas where more research would improve the KB.)
