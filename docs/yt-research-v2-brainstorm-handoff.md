# Session Handoff — YouTube research + scripting pipeline v2 (brainstorm, mid-flight)

Date: 2026-07-07. Session ran in `tooling/captain/` cwd but the topic is `pipelines/youtube/`. Brainstorm is NOT finished — six approaches were presented, the owner has not picked one. No design, no spec, no code yet.

## Where it started

Owner makes screen-recorded YouTube videos (tutorials, reviews, 10+ software comparisons). Video production is largely automated (freelancer records, Claude edits); the gap is **research + scripting**, currently done by freelancers. He wants a long-term (5–10 year) flow that does transcript-grounded research and scripting, token-efficiently — his instinct: pull YouTube transcripts per topic (20–30 videos, huge) and script from them, but reading raw transcripts with a frontier model every video is too token-heavy. Explicitly: "not a cheap one-time thing", open to better approaches.

## Constraints and answers extracted from the owner

- **Why the existing pipeline isn't the answer**: too much manual input (paste Gemini deep research, collect pricing screenshots, hunt video IDs), output quality too weak, cost-heavy, not long-term. Re-doing deep research + 20–30 transcripts per video every time is not time/cost effective.
- **Freelancers**: current system works fine; goal is to REDUCE dependency, not eliminate them. "Even if we help them and they are still in the picture, that's fine."
- **Tool overlap across videos**: HIGH — the same software reappears across many videos. This is the biggest architectural lever (favors persistent per-software knowledge over per-video research).
- **Current freelancer workflow** (two variants): (a) explore software hands-on → plan what to show → write script → record; (b) freestyle screen-record a draft → proper script written after → TTS → editor syncs voice to recording.
- **Volume / cost tolerance**: undecided; wants "balance of cost and quality".

## What already exists (found this session — do not rebuild blind)

- `/Users/kbtg/codebase/personal-stuff/pipelines/youtube/yt-research/` — Phase 1 TS pipeline (`npx ts-node run.ts --niche <slug>`): validate → transcripts → pricing → extract → profiles → comparative, via Gemini API. Phase 2 = Claude synthesizes `knowledge-base.md` + `knowledge-base-compact.md` (2–3k words) per `yt-research/CLAUDE.md`. Ran at least once (niche `n8n-hosting`).
- `/Users/kbtg/codebase/personal-stuff/pipelines/youtube/yt-script/` — KB → outline (approval gate) → script. `Guidelines/voice.md`, `structure.md`, `script-generation.md`, `reference.md` hold the owner's voice — **worth keeping regardless of approach**.
- `/Users/kbtg/codebase/personal-stuff/docs/research-and-script-workflow.md` — master wizard doc for the existing flow. Note: `pipelines/youtube/CLAUDE.md` links it as `../docs/research-and-script-workflow.md` (pipelines/docs/), which doesn't exist — the file lives at repo-root `docs/`. Stale link, unfixed.
- Existing distillation shape (transcripts → per-software profiles → comparative → compact KB) is architecturally correct; the problems are manual inputs, per-video throwaway research, and quality.
- Relevant CLIs already in `tooling/cli/`: `pp-youtube` (search/metadata), `pp-yt-transcript` (transcript text), `pp-openrouter` (cheap-model routing).

## Core principle established

A frontier model must never read raw transcripts at script time. Transcripts are read exactly once, by a cheap model, distilled into compact structured facts; everything downstream reads only the compact layer. The token problem is a pipeline-shape problem.

## The six approaches presented (owner has NOT chosen)

1. **Persistent per-software dossier library** — recommended. Research unit = software, not video. `dossiers/<tool>.md` (~1–2k words each): dated pricing, strengths/weaknesses, quirks creators hit on screen, head-to-head notes, "screen-worthy moments" (what to demonstrate). Cheap model reads each transcript once (map-reduce) → merge into dossier with as-of dates + source citations (video ID + timestamp); conflicts flagged, not overwritten. New video = load 10–15 dossiers (~20k words) → comparative synthesis → video brief → script via existing yt-script guidelines. Refresh pass re-checks only stale facts. Pros: cost amortizes with high overlap, quality compounds, freelancer becomes verifier. Cons: biggest of the cheap builds, needs refresh discipline.
2. **Automate the existing per-video pipeline** — keep per-niche batch shape, automate discovery (pp-youtube), transcripts (pp-yt-transcript), replace Gemini-paste with agentic web research, cheap-model extraction. Pros: ships in days, proven format. Cons: per-video throwaway research — re-researches overlapping tools forever; exactly the owner's complaint.
3. **RAG / NotebookLM transcript store** — dump transcripts, query at script time. Pros: cheapest, near-zero tokens. Cons: retrieval answers questions, doesn't produce comparative judgment (rankings/verdicts) — the substance of these videos. Sidecar, not spine.
4. **Agentic deep-research run per video** — no stored KB; fresh multi-agent research each video. Pros: always fresh, no maintenance. Cons: most expensive per video, cost never decreases, repeats work given high overlap.
5. **Structured freelancer intake + AI synthesis** — freelancers keep doing hands-on research but through a rigid per-tool intake template (setup friction, pricing seen, what broke, demo moments); AI merges with thin transcript pass → brief + script. Pros: genuine hands-on ground truth, lowest AI cost. Cons: doesn't reduce freelancer dependency much.
6. **Hands-on agent research (computer use)** — agent signs up, clicks through, deploys test apps, captures screenshots feeding the dossier format. Pros: only fully-automated first-hand truth; screenshots double as edit assets. Cons: heaviest build; accounts/payments/captcha friction; token-hungry and flaky today.

**Combined recommendation given**: #1 as spine, #5 feeding it (freelancer hands-on notes as one more dossier input stream alongside transcripts), #3 as citation-lookup sidecar, #6 as later upgrade. #2 only if something must work this week. Avoid #4.

## Key files for next session

- This file first, then:
- `/Users/kbtg/codebase/personal-stuff/pipelines/youtube/yt-research/CLAUDE.md` — existing Phase 1/2 contract.
- `/Users/kbtg/codebase/personal-stuff/pipelines/youtube/yt-script/CLAUDE.md` — script contract + voice guidelines to preserve.
- `/Users/kbtg/codebase/personal-stuff/docs/research-and-script-workflow.md` — current end-to-end wizard being superseded.
- Plan file: none yet. Memory files touched: none.

## Running state

- Background processes: none.
- Dev servers / ports: none.
- Open worktrees / branches: none. No files modified this session except this handoff + one line in `docs/README.md`.

## Verification — how to confirm things still work

- Nothing was changed, so nothing to verify. Sanity check of the existing pipeline if needed: `ls /Users/kbtg/codebase/personal-stuff/pipelines/youtube/yt-research/niches/n8n-hosting/output/` — should show profiles/, knowledge-base files.

## Deferred + open questions

- Open: **which approach** (one of the six, or the combined #1+#5 spine) — the owner asked for six options and stopped there.
- Open: volume/cost target per video (owner deferred: "balance of cost and quality").
- Deferred: fixing the stale `research-and-script-workflow.md` link in `pipelines/youtube/CLAUDE.md`.
- Deferred: dossier schema, refresh cadence, model choice for distillation (Haiku vs Gemini Flash via pp-openrouter) — all design-phase details once an approach is picked.

## Pick up here

Ask the owner which approach (or the combined #1+#5 spine) to design, then continue the superpowers brainstorming flow: design sections → approval → spec at `docs/superpowers/specs/2026-07-XX-yt-research-v2-design.md` → writing-plans.
