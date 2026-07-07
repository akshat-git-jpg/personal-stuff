---
name: personal-stuff-video-automation-campaign
description: Use when working toward fully automated YouTube video production in personal-stuff — the tutorial pipeline v3 (plan 011), voice↔video sync for TTS voiceovers, adding motion graphics or avatar overlays, or any "automate video creation end to end" request for screen-recording or explainer videos. Also use before touching tts-flow assemble.py, tutorial-pipeline-2 steps, or proposing a new TTS/sync/graphics approach.
---

# Video-automation campaign (the owner's #1 open problem)

## Overview

Goal (owner, 2026-07-05): **entire video creation automated — voice↔video sync plus motion graphics — best quality, token-optimized, without raising cost.** Two distinct product lines share the assets; know which one you're in before doing anything:

| Line | Where | Sync strategy | State (2026-07-05) |
|---|---|---|---|
| **Own tutorials** (screen-recording style) | `pipelines/youtube/tutorial-pipeline-2/` (contains the **v3** flow — name is historical) | **Sync by construction**: VO is generated from the recording's own transcript; a segment map + per-block TTS durations let ffmpeg retime video to audio (speed band 0.85–1.18 + freeze-pad) | Steps 000–170 scaffolded; v2 voice+avatar machinery works; **plan 011 (the only open plan) implements 040-segment-map/105/125/162** |
| **Dub flow** (replace a freelancer's narration in an existing recording) | `pipelines/video/voice/tts-flow/` | Anchor + silence-absorb; currently ±1–2s global — good for talk-over, **NOT click-along** | Engine settled (IndexTTS-2 on Modal, ~$0.50/video); blocker documented in `SYNC-PROBLEM.md` (the source of truth — read it before this skill's summary) |

Explainer-style (non-screen-recording) videos ride the graphics phase (hyperframes) + yt-style script generation; there is no separate pipeline for them yet — treat that as a candidate, not a build target.

## Phase 0 — the ceiling decision (gate before any sync work)

`SYNC-PROBLEM.md`'s open question decides everything: **will the spokesperson record the screen TO a finished voiceover (VO-first), or must record-then-dub stay?**
- VO-first available → frame-perfect sync is achievable (option C) and Whisper drops out of the dub path entirely. The v3 own-tutorials line already embodies this philosophy.
- Record-then-dub only → the honest automated ceiling is **sentence-level (~±0.3s)**. Do not promise better.

**GATE: if this answer isn't on record, get it from the owner and append it to `decisions.md` before building.** (Owner leaned dub-flow as of the last session; that is a lean, not a decision.)

## Phase 1 — execute plan 011 (deterministic assembly)

`plans/011-tutorial-pipeline-v3.md` is executor-ready (schema, fixtures, expected numbers, STOP conditions all authored). Dispatch it through the `orchestrate` skill loop — do NOT hand-implement it inline in a chat session.
- Verify anchors (from the plan): step 125 fixture must produce speeds 1.11 / 1.00 / one flag; step 162 draft-cut duration = VO duration ±0.2s (`ffprobe -show_entries format=duration`).
- Difficulty is `standard`→sonnet-eligible EXCEPT the plan already fences step 135 out (below).
- STOP conditions include "no paid services" (Modal/HeyGen) — respect them.
- Plan 011's note "log tuning in `pipelines/decisions.md`" is stale — **that file does not exist**; log tuning in the root `decisions.md`.
- After: the first real video's `segments.json` must be owner-eyeballed once against the recording before trusting 125's math (plan's own maintenance note).

## Phase 2 — dub-flow sync upgrade (only if the dub line stays)

Build per SYNC-PROBLEM.md's recommendation: **A+B (per-sentence sync) as the automated baseline**, then judge.
1. Feed `segments.json` (93 segs in `work/finaltest/`) to synth instead of `chunks.json` (Modal app already takes per-segment `{id,text}`; use `interval_silence` 80ms).
2. In `pipeline/assemble.py`: anchor per SEGMENT; asymmetric correction — early → pad gap; late → remove silence then a tiny **capped per-sentence** `atempo`.
3. Re-render `work/finaltest/` and compare against `engines/indextts2/output/FINAL_8min_jamila.mp4`; judge click-lag by eye at sentence level.
**GATE: if sentence-level is still not tight enough for click-along → the answer is option C (VO-first), which is a recording-process change → back to Phase 0's owner decision. Do NOT reach for option D (word-level anchoring) first — it's ranked fragile/artifact-prone in SYNC-PROBLEM.md.**

## Phase 3 — motion graphics

1. Author `steps/135-build-graphics-sonnet/rulebook.md` **in a Claude Code session, on Sonnet, with the pipelines-scoped `hyperframes*` skill family loaded** (they only activate under `pipelines/`). Note: there is NO pipelines-scoped "motion-graphics" skill — plan 011 step 6's wording implies one; `pipelines/video/motion-graphics/` is a content directory. This is the standing owner flag from plan 011 step 6.
2. Ground it in `pipelines/video/motion-graphics/Devsplainers/` (the design-system breakdown) and `pipelines/video/card-library/` (existing GSAP card templates; gallery via `npm run serve` → localhost:4321; editor-facing rendering already hosted at render2.agrolloo.com).
3. Step 162 already degrades gracefully when `135/output/` is empty — graphics are additive, ship the retimed cut first.
**FENCE: Antigravity never touches graphics — the Devsplainers PoC failed quality on all four axes (decisions.md 2026-07-05). Quality-setting steps are Sonnet-in-Claude-Code by decided routing.**

## Phase 4 — avatar path (decision-gated, ToS-risky)

HeyGen `submit`/`fetch` in `lib/heygen.py` are `TODO[HNS]` stubs → step 160 is a manual download gate today. Automating it means driving the HeyGen web session (`tooling/cli/heygen-web/` — cookie-rotating, **likely ToS violation, ban risk on a paid account**, real quota ~20 min/month).
**GATE: automating HeyGen requires an explicit owner decision in `decisions.md`. Default: keep the manual gate.**
Standing HeyGen rules (owner-set): **Avatar III only — never IV/V** (III is the unlimited/free tier on the legacy plan; IV/V are metered; keep `use_unlimited_mode: true`, never `--iv`, never the official metered HeyGen MCP), and **prove every create op stayed free**: `heygen-web usage --save` before, `usage --diff` after — both credit and free-seconds deltas must be 0 (baseline: `infra/secrets/heygen-usage-last.json`). Also: `avatar_id`s are still `REPLACE_WITH_…` placeholders; BODY_2 test outputs predate the avatar-aware flow. Deferred finding PIPE-01 (162's avatar/graphics overlay passes) blocks on real HeyGen downloads existing — don't implement against stubs (plan 011 review, plans/README.md).

## Cost/token discipline (the "without affecting cost" constraint)

- Actor routing is decided (decisions.md 2026-07-05): Antigravity = prompt grind; Sonnet-in-Claude-Code = quality-setting steps (script polish, visual plan, graphics); deterministic scripts = transcribe/TTS/assembly; **Opus/Fable stay OUT of the per-video loop**.
- Paid surface is tiny and fixed: Modal GPU synth ~$0.50/video; Groq Whisper = pennies; everything else local. ElevenLabs stays rejected (recurring per-generation cost).
- LLM work rides the Claude subscription (yt-style/script steps), not API keys.
- Rotate the Groq key if not already done — it was pasted in a chat once (HANDOVER.md note).

## Fenced wrong paths (do not re-attempt without new evidence)

| Wrong path | Why fenced |
|---|---|
| "Slow down the TTS to fix sync" | TTS already runs ~6% slow; slowing worsens click-lag (SYNC-PROBLEM.md hard-won fact #1) |
| Global `atempo` fit for click-along | That's the current ±1–2s ceiling — the thing being replaced |
| Time-stretching speech per-clip beyond tiny caps | Artifacts; the sync method is anchor + silence-absorb by design |
| RVC to fix delivery/pronunciation | RVC is a voice skin — copies every flaw; kept only as fallback |
| ElevenLabs / paid TTS | "No recurring cost" is a hard requirement |
| Antigravity for graphics | Failed the Devsplainers PoC on all axes |
| Word-level anchoring (option D) as first resort | Fragile/complex; only after A+B measured insufficient AND C rejected |

## Success criteria (judge by these, not vibes)

- Plan 011 done criteria green (fixture numbers exact, draft-cut = VO ±0.2s, playable).
- Dub flow: side-by-side of old vs per-sentence render shows click-lag reduced to sentence level; owner signs off by eye.
- A full real video passes 000→162 with humans only at recording + the 5 review gates.
- Every phase's decisions landed in `decisions.md` (see **personal-stuff-change-control**).

## When NOT to use this skill

- Hyperframes authoring mechanics → the pipelines-scoped `hyperframes*` skills
- Script/style generation → `yt-style-copy` skill + `pipelines/youtube/competitor-styles/`
- Rendering cards for the editor → `pipelines/video/card-library/` README + render2
- General repo work → the other personal-stuff-* skills

## Provenance and maintenance

Grounded in `SYNC-PROBLEM.md`, `tts-flow/CLAUDE.md`, `plans/011-tutorial-pipeline-v3.md`, `SPEC.md`/`HANDOVER.md`, decisions.md (2026-07-05 entries), and owner interview (2026-07-05). This is the most volatile skill in the library — re-verify before each campaign session:
- Is plan 011 still TODO? `grep -n "| 011" plans/README.md`
- Sync blocker still open? read `pipelines/video/voice/tts-flow/SYNC-PROBLEM.md` header
- 135 rulebook still a stub? `head pipelines/youtube/tutorial-pipeline-2/steps/135-build-graphics-sonnet/rulebook.md`
- HeyGen still stubbed? `grep -n "TODO\[HNS\]" pipelines/youtube/tutorial-pipeline-2/lib/heygen.py`
