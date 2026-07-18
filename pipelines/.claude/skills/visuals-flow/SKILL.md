---
name: visuals-flow
description: Operate the visuals-flow pipeline (pipelines/video/visuals-flow) by verb — the session runs the steps, the owner only reviews the board and green-lights live HeyGen. Verbs: run graphics for <video>, run the shot pass for <video>, open my storyboard/board, render the graphics, make the avatar videos, download the avatar videos, fold the feedback. Triggers on those phrases plus "visuals-flow", "run the cue pass", "approve flow for <video>", "avatar clips for <video>".
---

# visuals-flow — operating skill (verb router)

Run everything from `pipelines/video/visuals-flow/`. This skill routes verbs to
step procedures; judgment content lives in the step rulebooks and stays there.
State of the pipeline + full command list: `HANDOFF.md`. Schemas: `PIPELINE.md`.

## Guardrails (check BEFORE any verb, never skip)

1. **Pre-flight for ANY LLM pass** (cue or shot): `node lib/feedback-status.mjs`
   must exit 0. Non-zero = unfolded owner feedback = unapplied lessons — run the
   fold first or stop and tell the owner.
2. **060 feedback-fold is Opus-class ONLY.** If the current session is not
   Opus-class, refuse the fold verb and say why (HANDOFF "Model routing").
3. **Live HeyGen is owner-run.** Submit only when the owner explicitly asked in
   THIS conversation and confirmed the template slug. Never submit from a cron,
   subagent, or unattended session. Download is safe to re-run.
4. **`engineMode` stays `"test"`.** Production (HeyGen 4) is a validation error
   by design until the owner flips it (docs/specs/2026-07-18-avatar-shot-plan-design.md).
5. **Snapshot before owner edits**: after a cue/shot pass converges, copy the
   final LLM output to `cues.llm.json` / `shots.llm.json` (committed, immutable).
6. Never edit RULEBOOK/prompt/DESIGN/catalog/lint constants mid-run — rule
   changes go through the 060 fold, not through operating sessions.

## Verb: "run graphics for <slug>"

1. Guardrail 1. If `videos/<slug>/transcript.json` is missing:
   `bash steps/010-transcribe-run/run.sh <slug>` (accepts vo.mp3/mp4/mov/mkv/m4a/wav).
2. Run the cue pass IN THIS SESSION: paste **the prompt only**
   (`steps/020-cue-pass-llm/cue-pass-prompt.md`), as it is self-contained
   (RULEBOOK.md is the 060 fold's judgment archive, kept in sync by the fold).
   Fill its placeholders with `../card-library/catalog.json` and the output of
   `node lib/transcript-text.mjs <slug>` (never raw transcript.json). Produce
   `videos/<slug>/cues.json` exactly per the prompt's schema. Any
   Sonnet-class-or-better session qualifies (the pass is form-filling; HANDOFF
   "Model routing").
3. Fix-loop (≤3 rounds): `node lib/resolve.mjs <slug> && node lib/lint-cues.mjs <slug>`;
   feed error output back into step 2 verbatim. Errors surviving round 3 →
   stop, surface to the owner.
4. Guardrail 5 (snapshot to `cues.llm.json`), then tell the owner the board is
   ready: `node lib/board.mjs <slug>`.

## Verb: "run the shot pass for <slug>"

1. Guardrail 1, plus `cues.json` must have `"approved": true` (the shot pass
   plans AROUND approved graphics — refuse otherwise).
2. Extract the fullframe cue times for the prompt:
   `node -e "const r=require('./videos/<slug>/resolved.json');for(const c of r.resolved.filter(c=>c.placement==='fullframe'))console.log(c.id, c.start, +(c.start+c.duration).toFixed(2))"`
3. Run the shot pass IN THIS SESSION: paste **the prompt only**
   (`steps/070-shot-pass-llm/shot-pass-prompt.md`) with the fullframe list +
   the output of `node lib/transcript-text.mjs <slug>` (never raw transcript.json)
   → `videos/<slug>/shots.json`. (RULEBOOK.md is the fold's judgment archive).
4. Fix-loop (≤3 rounds): `node lib/resolve-shots.mjs <slug> && node lib/lint-shots.mjs <slug>`.
5. Guardrail 5 (snapshot to `shots.llm.json`), then point the owner at the
   board's shot lane + "Approve shots" button.

## Verb: "open my storyboard" / "open the board"

`node lib/board.mjs <slug>` (background), report the printed 127.0.0.1 URL.
Unsaved-feedback warning and approval semantics are the board's own.

## Verb: "render the graphics"

`node lib/render.mjs <slug>` — it refuses unapproved/stale on its own; never
pass `--force` unless the owner says so. Output: `renders/` + `manifest.md`.

## Verb: "make the avatar videos" (live HeyGen — guardrail 3)

1. Requires `shots.json` `"approved": true` and the owner's template slug
   (from `pipelines/video/heygen/registry.json`; ask if not given).
2. `bash steps/080-avatar-render-run/run.sh <slug> --template <slug> --submit`
   — gates, slicing, pacing, and `avatar-jobs.json` are the step's own.
3. Tell the owner renders take minutes; the download verb finishes the job.

## Verb: "download the avatar videos"

`bash steps/080-avatar-render-run/run.sh <slug> --download` — one attempt per
pending job; re-run until no `pending:` lines. Output: clips in
`~/kb-scratch/video/heygen/visuals-flow/<slug>/` + `avatar-manifest.md`.
Editor handoff = `renders/` + `manifest.md` + those clips + `avatar-manifest.md`.

## Verb: "assemble the video" / "build the final video"

1. Requires: cues approved + rendered (`renders/` complete), shots approved
   with ALL avatar clips downloaded (every `avatar-jobs.json` job has `file`),
   and the VO-aligned screen recording at `videos/<slug>/screen.mp4` (ask the
   owner for it if missing — it is never committed). Graphics-only videos
   (no shots.json) assemble fine.
2. `bash steps/090-assemble-run/run.sh <slug>` — gates, segment planning, and
   the ffmpeg passes are the step's own. Output:
   `~/kb-scratch/video/visuals-flow/<slug>/final.mp4` + committed
   `assembly.md` (the EDL).
   For a fast placement check first, add `--draft` (720p preview,
   `final-draft.mp4`); re-run without it for the ship render.
3. The editor handoff bundle is unchanged; final.mp4 is an additional output —
   per video the owner ships it directly or hands the bundle to the editor.

## Verb: "fold the feedback" (guardrail 2 — Opus-class only)

Follow `steps/060-feedback-fold-opus/README.md`: `node lib/edit-delta.mjs <slug>`
for the owner-edit diff, fold lessons into the rule surfaces, mark items folded.
Done when `node lib/feedback-status.mjs` exits 0.
