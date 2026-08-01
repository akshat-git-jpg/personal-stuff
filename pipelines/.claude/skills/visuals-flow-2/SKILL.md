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
2. **Close every step in the run ledger, and name steps ONLY by their folder id.**
   The owner follows a run from the board's Run tab, not the terminal, so a step
   that is not recorded did not visibly happen. Two rules, both non-negotiable:

   - **Task names are the step folder ids**, verbatim:
     `030-pick-or-propose-graphics-llm`, never "body cue pass", "cue pass" or
     "body graphics LLM". The same step must read identically on every video.
     `node lib/run-log.mjs <slug>` prints the full list.
   - **Every `-llm` / `-opus` step you run gets closed out** the moment it
     finishes, before you move on:
     ```
     node lib/run-log.mjs <slug> 030 running
     node lib/run-log.mjs <slug> 030 done \
       --did "Placed 23 body cues from the catalog, proposed 2 cards that do not exist yet." \
       --issues "2 W7 bare-stretch warnings in the 3-4 min talking-head stretch, left as-is." \
       --output "cues.json — 23 cues, 2 marked NEW for step 038"
     ```
     `did` and `output` are required; a missing one is refused rather than
     written half-empty. Omitted `issues` becomes an explicit "none found", so
     never omit it when there WERE issues. Write plain sentences the owner can
     read cold, not counts.

   The `-run` steps record themselves through `run.sh`. The three `-human` gates
   are recorded by the board when the owner approves. You are responsible only
   for the model-run steps.

3. **130 feedback-fold is Opus-class ONLY.** If the current session is not
   Opus-class, refuse the fold verb and say why.
4. **Live HeyGen: Avatar III test renders are pre-authorized** (owner rule
   2026-07-24 — Avatar III unlimited mode is free): sessions may submit
   Avatar III for TESTING without asking each time. Anything metered
   (Avatar IV, generative credits) and production renders stay owner-run —
   explicit ask in THIS conversation. Never submit from a cron. Download is
   safe to re-run.
5. **`engineMode` defaults to `"test"` (Avatar III, free); `"production"`
   (Avatar IV, METERED) is implemented (2026-08-01) but only ever set on the
   owner's explicit ask, per video.** The owner may ask for either engine
   mid-flow — "use heygen 3" / "use heygen 4": set `engineMode` in
   `shots.json` (test|production), re-run `node lib/resolve-shots.mjs`, then
   submit; or override one submit run with
   `node lib/avatar-render.mjs <slug> --submit --engine heygen3|heygen4`.
   Before any heygen4 batch: `heygen-web limits` must cover the total span
   seconds, and note IV bills at render COMPLETION (submit-time meter always
   reads UNLIMITED). Never flip to production yourself.
6. **Snapshot before owner edits**: after a cue/shot pass converges, copy the
   final LLM output to `cues.llm.json` / `shots.llm.json` (committed, immutable).
7. Never edit RULEBOOK/prompt/DESIGN/catalog/lint constants mid-run — rule
   changes go through the 130 fold, not through operating sessions.

## Verb Map

**Review model (owner reaffirmed 2026-07-29 — see decisions.md):** three owner
gates, and **none is skippable at any video length**.

**Gate 1 — Card Plan (step 037, comes first).** Every card the video will use —
body, intro and conclusion — marked EXISTING or NEW-to-build, approved before
anything is built or rendered. `bash run.sh <slug> outline` reads it as text;
the Card Plan tab on the board is where it is approved. A NEW card goes to step
038, which builds it into the shared collection. This replaced the zone-only
070 gate on 2026-07-30 — the body's build-vs-reuse call was previously made by
nobody.

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
| "where are we", "what's the status", "show me the run" | `bash run.sh <slug> status` (or the board's **Run** tab) | reads `run-log.json`; steps with no entry are labelled as inferred |
| "map the segments", "propose segments" | `bash run.sh <slug> segments` | writes `structure` + `segments`; owner then sets `confirmed: true`. 035 refuses without `structure` |
| "run v2 graphics", "run the concept pass" | `bash run.sh <slug> concept-pass` | |
| "run the cue pass" | `bash run.sh <slug> cue-pass` | authors the BODY only |
| "run the zone pass", "do the intro and outro" | `bash run.sh <slug> zone-pass` | authors the INTRO + CONCLUSION only, own rulebook |
| "check the cues", "validate the plan" | `bash run.sh <slug> validate` | pre-037; tolerates cards 038 has not built yet |
| "show me the card plan", "outline the cues" | `bash run.sh <slug> outline` | text view of the 037 plan |
| "approve the cards", "card plan" | `bash run.sh <slug> card-plan` then `board` | **037 card plan approval** |
| "build the new cards" | step 038 — see `steps/038-build-cards-llm-and-review-human/README.md` | only when 037 left something NEW |
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
