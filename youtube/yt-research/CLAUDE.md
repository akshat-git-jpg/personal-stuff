# yt-research — Claude Code instructions

YouTube niche research pipeline. Produces a knowledge base used as input for comparison-video script generation.

## Pipeline

- **Phase 1 (automated, Gemini API)** — `npx ts-node run.ts --niche <name>`
  Runs: validate → transcripts → pricing → extract → profiles → comparative.
  Writes into `niches/<name>/output/`.
- **Phase 2 (Claude Code, this terminal)** — triggered by the user, not by `run.ts`.
  You synthesize the knowledge base directly from Phase 1 outputs.

## When the user says "Synthesize the KB for niche <name>"

Do these in order:

1. Read the system prompt: `common/prompts/yt-research/kb-synthesis.md` (path from repo root). This defines the exact output format, source-priority rules, and deterministic tone. Follow it strictly.
2. Read the niche context:
   - `niches/<name>/niche.md`
   - `niches/<name>/gemini-research.md`
3. Read all per-software profiles in `niches/<name>/output/profiles/*.md`.
4. Read `niches/<name>/output/comparative-insights.md`.
5. Read all pricing-text files in `niches/<name>/output/pricing-text/*.md` (screenshot ground truth).
6. Synthesize the full KB → write to `niches/<name>/output/knowledge-base.md`.
7. Compress to a compact version → write to `niches/<name>/output/knowledge-base-compact.md`.
   - Target: 2,000–3,000 words.
   - Keep exact structure, conclusions, rankings, verdicts, and all pricing.
   - Keep the "Key Findings & Surprises" section intact.
   - Only remove redundancy and verbose explanation.
8. Append a one-line summary to `niches/<name>/output/run-log.md`:
   ```
   ## [Phase 2: KB Synthesis (Claude Code)]
   Full KB: knowledge-base.md (<N> words)
   Compact KB: knowledge-base-compact.md (<N> words)
   ```

## Source priority (from kb-synthesis.md — repeated for emphasis)

1. Pricing screenshots → ONLY source for pricing.
2. Software profiles → primary for features, pros, cons.
3. Comparative insights → primary for rankings and verdicts.
4. Gemini research → gap-filler only.

If inputs are missing (e.g., no pricing for a software), note it in the `Gaps` section of the KB rather than inventing data.
