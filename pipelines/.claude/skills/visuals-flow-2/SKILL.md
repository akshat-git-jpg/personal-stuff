---
name: visuals-flow-2
description: Operate the visuals-flow-2 pipeline (pipelines/video/visuals-flow-2) by verb — the session runs the steps, the owner only reviews the board and green-lights live HeyGen. Verbs: run v2 graphics for <video>, run the concept pass, audit the cues, make the sound plan, mix the audio, open my v2 board, final cut review, run graphics for <video>, run the shot pass for <video>, open my storyboard/board, render the graphics, make the avatar videos, download the avatar videos, assemble the video, export the timeline / open it in resolve, qc the video, analyze reference <url>, fold the feedback. Triggers on those phrases plus "visuals-flow-2", "run the cue pass", "approve flow for <video>", "avatar clips for <video>", "resolve export", "filmstrip qc".
---

# visuals-flow-2 — operating skill (verb router)

Run everything from `pipelines/video/visuals-flow-2/`. This skill routes verbs to
step procedures; judgment content lives in the step rulebooks and stays there.
State of the pipeline + full command list: `README.md` and `run.sh <slug> status`. Schemas: `PIPELINE.md`.

## Guardrails (check BEFORE any verb, never skip)

1. **Pre-flight for ANY LLM pass** (concept, cue, audit or shot): `node lib/feedback-status.mjs`
   must exit 0. Non-zero = unfolded owner feedback = unapplied lessons — run the
   fold first or stop and tell the owner.
2. **060 feedback-fold is Opus-class ONLY.** If the current session is not
   Opus-class, refuse the fold verb and say why.
3. **Live HeyGen: Avatar III test renders are pre-authorized** (owner rule
   2026-07-24 — Avatar III unlimited mode is free): sessions may submit
   Avatar III for TESTING without asking each time. Anything metered
   (Avatar IV, generative credits) and production renders stay owner-run —
   explicit ask in THIS conversation. Never submit from a cron. Download is
   safe to re-run.
4. **`engineMode` stays `"test"`.** Production (HeyGen 4) is a validation error
   by design until the owner flips it.
5. **Snapshot before owner edits**: after a cue/shot pass converges, copy the
   final LLM output to `cues.llm.json` / `shots.llm.json` (committed, immutable).
6. Never edit RULEBOOK/prompt/DESIGN/catalog/lint constants mid-run — rule
   changes go through the 130 fold, not through operating sessions.

## Verb Map

**Review model (owner reaffirmed 2026-07-29 — see decisions.md):** three owner
gates, and **none is skippable at any video length**.

**Gate 1 — Zone Plan (PLAN review, comes first).** The owner reviews the concept 
placement on the timeline to prevent wasting render cycles on intro/conclusion concepts
that need board approval before production.

**Gate 2 — Storyboard (COMPOSITION review).** The owner reviews and
finalises the whole plan before ANY render:
- where an avatar appears, and **which avatar variation** each span uses
  (full screen / bubble / panel / side view / avatar with motion graphics)
- where motion graphics appear, and **which card** each one uses
- the **text on every card**

The shot pass (060) therefore runs BEFORE this gate, not after — avatar spans
must be on the board when the owner reviews. Nothing renders until the owner
approves both `cues.json` and `shots.json`.

**Gate 3 — Final Cut (OUTPUT review).** The assembled draft, which must contain
**everything the final video will have** — graphics, avatar layer, effects,
sound, captions. Judged in motion, timestamped comments, versions, live
check-off. It is not a plan review: plan-class defects should already be gone.

Between the gates the session runs unattended: render → avatar renders → cut.

| Phrase | `run.sh` verb / CLI | Owner Gate / Behavior |
|---|---|---|
| "run v2 graphics", "run the concept pass" | `bash run.sh <slug> concept-pass` | |
| "run the cue pass" | `bash run.sh <slug> cue-pass` | |
| "audit the cues" | `bash run.sh <slug> audit` | |
| "run the shot pass" | `bash run.sh <slug> shot-pass` | |
| "open my v2 board", "open my storyboard", "final cut review" | `bash run.sh <slug> board` | **080 storyboard approval** or **120 final cut approval** |
| "render the graphics" | `bash run.sh <slug> render` | |
| "make the avatar videos" | `bash run.sh <slug> avatar` | **100 live HeyGen** |
| "make the cut", "cut the video" | `bash run.sh <slug> cut` | |
| "make the sound plan" | `bash run.sh <slug> sound` | |
| "mix the audio" | `bash run.sh <slug> mix` | |
| "assemble the video" | `bash run.sh <slug> assemble` | Prints board URL for final cut |
| "export the timeline", "resolve export" | `bash run.sh <slug> export` | **on-request only** |
| "qc the video", "filmstrip qc" | `bash run.sh <slug> qc` | |
| "fold the feedback", "feedback is done", "I'm done reviewing" | **invoke the `visuals-flow-feedback` skill** (it wraps `bash run.sh <slug> fold`) | **130 fold** |
| "analyze reference <url>" | `bash scripts/analyze-reference.sh <url>` | |
