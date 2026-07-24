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
3. **Live HeyGen is owner-run.** Submit only when the owner explicitly asked in
   THIS conversation and confirmed the template slug. Never submit from a cron,
   subagent, or unattended session. Download is safe to re-run.
4. **`engineMode` stays `"test"`.** Production (HeyGen 4) is a validation error
   by design until the owner flips it.
5. **Snapshot before owner edits**: after a cue/shot pass converges, copy the
   final LLM output to `cues.llm.json` / `shots.llm.json` (committed, immutable).
6. Never edit RULEBOOK/prompt/DESIGN/catalog/lint constants mid-run — rule
   changes go through the 060 fold, not through operating sessions.

## Verb Map

| Phrase | `run.sh` verb / CLI | Owner Gate / Behavior |
|---|---|---|
| "run v2 graphics", "run the concept pass" | `bash run.sh <slug> concept-pass` | |
| "run the cue pass" | `bash run.sh <slug> cue-pass` | |
| "audit the cues" | `bash run.sh <slug> audit` | |
| "open my v2 board", "open my storyboard", "final cut review" | `bash run.sh <slug> board` | **040 board approval** (Gate A/B behaviors) |
| "render the graphics" | `bash run.sh <slug> render` | |
| "run the shot pass" | `bash run.sh <slug> shot-pass` | |
| "make the avatar videos" | `bash run.sh <slug> avatar` | **080 live HeyGen** |
| "make the sound plan" | `bash run.sh <slug> sound` | |
| "mix the audio" | `bash run.sh <slug> mix` | **sound.json approval before mix** |
| "assemble the video" | `bash run.sh <slug> assemble` | Gate A (prints board URL) |
| "export the timeline", "resolve export" | `bash run.sh <slug> export` | |
| "qc the video", "filmstrip qc" | `bash run.sh <slug> qc` | |
| "fold the feedback" | `bash run.sh <slug> fold` | **060 fold** (Gate B check-off) |
| "analyze reference <url>" | `bash scripts/analyze-reference.sh <url>` | |
