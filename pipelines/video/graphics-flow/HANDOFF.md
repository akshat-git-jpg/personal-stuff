# graphics-flow handoff (2026-07-18)

For the next session picking this up. Everything below was true and verified on
2026-07-18. Read PIPELINE.md first if you have never seen this pipeline; read
this doc for where things actually stand and what is open.

## What this is

Beat-synced motion graphics for final-workflow videos. One VO mp3 in, a folder
of rendered clips plus an editor manifest out. Graphics reveal their content at
the exact second the voiceover speaks each point. One LLM call per video;
everything else is scripts. Design spec: `docs/specs/2026-07-17-motion-graphics-beat-sync-design.md`.
Decisions log entries: decisions.md 2026-07-17 and 2026-07-18.

## State: what is built and verified

- **Steps 010-050 all exist and ran end to end on real content once** (test-01,
  a 32-min "5 AI video tools" comparison; workdir `videos/test-01/`), EXCEPT
  step 050 (render) which has NOT yet run on test-01. Renders + manifest are
  the one untested-at-scale piece. The render machinery itself is proven on
  single cards (beat-smoke, card inspections).
- **010 transcribe**: Groq whisper-large-v3-turbo fast path (22s for 32 min,
  correct brand spellings), local whisper fallback (~8 min). Accepts vo.mp4/mov/
  mkv/m4a/wav and extracts vo.mp3 itself. NOTE: test-01's transcript.json is
  from the LOCAL engine and contains garbled names ("Heigen"); its anchors quote
  those garbles correctly. A fresh Groq transcript would shift timestamps
  slightly and break existing anchors, so leave test-01's transcript alone.
- **020 cue pass**: Sonnet subagent, prompt assembled from
  `steps/020-cue-pass-llm/cue-pass-prompt.md` + card-library `catalog.json` +
  transcript text. Two runs done: v1 (21 cues, generic) and v2 (27 cues, current
  cues.json, uses the new cards). v1 is in git history.
- **030 resolve**: anchor matching plus schema validation (validateCues) against
  catalog contracts. Caught 5 real errors on v2 before anything rendered. All 27
  v2 cues currently resolve clean.
- **040 board**: full-script timeline at localhost:4322 (also on the local-apps
  dashboard as "graphics storyboard", no-arg start picks the latest video).
  Transcript top to bottom, cue cards inline as LIVE previews (real card HTML
  driven by the VO slice, not rendered video), collapsed gap blocks, mini-map,
  per-template usage chips (red past 3 uses), one audio at a time, per-block
  feedback boxes that Save writes to `feedback.json`. Save preserves top-level
  cues.json fields (offset bug fixed 2026-07-18).
- **050 render**: staged per-cue renders (data-duration rewrite in a temp copy,
  the ONLY way to set duration; script-time patching does not work), mp4 for
  fullframe, transparent mov for overlays, ffprobe checks, manifest.md at
  workdir root with the timeline `offset` applied to place-at timecodes.
- **card-library** (sibling folder, the asset hub): 42 cards, 11 of them beat
  cards taking reveal timing as `beats[].at` data. New cards from this effort:
  stat-hit, tool-intro, persona-match, credits-math, step-flow, plus callout
  style variants and pricing-tiers annual strike-through. All visually
  inspected. `catalog.json` carries per-card contracts incl. `max_beats` and
  `max_reveal_chars` (estimates, not yet visually calibrated). `DESIGN.md` is
  the visual system new cards must follow. `beat-smoke.sh` is the gate.

## Where the rules live (four surfaces)

1. `steps/020-cue-pass-llm/RULEBOOK.md` + `cue-pass-prompt.md`: selection
   judgment (density, routing, specificity-wins, repetition caps incl. the
   stat-hit cap, anchor discipline, correct-brand-spelling rule). Edit BOTH
   together, the prompt is what the model actually sees.
2. `card-library/DESIGN.md`: palette, typography, motion, capacity honesty.
3. `card-library/catalog.json`: machine-enforced per-card contracts (the
   resolver validates against it). Prefer encoding a lesson here over prose.
4. `tests/TESTS.md`: findings log + "Folded lessons" provenance.

## Model routing (owner-decided, do not re-litigate)

- 020 cue pass: Sonnet (agy/Gemini approved as a free alternate to trial).
- Novel-card authoring: Opus. Antigravity only under the recorded
  render-plus-visual-inspection mitigation (decisions.md 2026-07-07).
- **060 feedback-fold: Opus-class ONLY** (`steps/060-feedback-fold-opus/README.md`).
  Any owner feedback (board `feedback.json` or chat) gets folded into the rule
  surfaces and marked folded. This is the never-repeat-a-mistake guarantee.
  Trigger: owner says "fold the feedback".
- Plan execution (boss): default agy per `tooling/boss/data/rules.md`
  (2026-07-18); claude-p sonnet for taste-judged content or non-inlinable
  plans; opus for tricky. agy visual output ALWAYS gets rendered and inspected
  by the verifier before landing.

## Immediate state of test-01

- v2 cues.json (27 cues) resolved clean, on the board, NOT yet owner-approved.
- Owner feedback so far came via chat, already folded (stat-hit cap, usage
  chips, logos plan). `feedback.json` is empty as of handoff.
- Next actions on this video: owner reviews/approves on the board, then
  `node lib/render.mjs test-01` and hand `renders/` + `manifest.md` to the
  editor. That render run is the last unproven step of the whole flow.

## In flight

- **PR #25 (plan 068, tool logos)**: boss:ready, executor agy, not yet picked
  up by boss. Favicon registry with manual override in card-library/logos/,
  data-URI enrichment at render/board time, logo slots in 5 cards, resolver
  validation, cue-pass rule. After it lands: render tool-intro and
  persona-match with logos and INSPECT the frames (standing agy rider), then
  consider a v3 cue pass on test-01 so logos appear.

## Open items for the next phase (not started, in rough priority order)

1. **Render + editor handoff proof** (small): run 050 on approved test-01,
   check the clips and manifest against the actual final edit. Expect lessons
   about `offset` and editor ergonomics.
2. **Avatar/screen-recording shot plan** (the big one, owner's stated next
   phase): decide per stretch of the video whether avatar video or screen
   recording shows, plus layout hints, with durations. The board was built for
   this: `buildSegments()` in lib/board.mjs is the seam; shot spans become a
   third segment kind (or gap attributes) in the same timeline. The gap blocks
   are deliberately untyped today. Schema was deliberately NOT invented yet.
   Prior art: tutorial-pipeline-1/2 in pipelines/youtube/.
3. **Global play-through on the board** (deferred by owner): master player,
   auto-scroll, cards animate as the playhead crosses. Same buildSegments seam.
4. **Automated visual QC** (OPEN PROBLEM, owner rejected the vision-model
   version on cost): today nothing looks at rendered frames except humans.
   Schema validation covers structure; visual breakage (overflow etc.) is
   caught at owner review. Revisit only with a cheaper mechanism.
5. **Capacity calibration**: max_beats/max_reveal_chars are layout-math
   estimates. Calibrate by filling cards to their caps and looking (or fold
   real failures from reviews as they come).
6. **agy cue-pass trial**: run 020 on agy for one video, compare against
   Sonnet on the rubric (RULEBOOK section 9). Frees the last per-video cents.
7. **Density calibration**: 60-120s fullframe cadence and 18-28 cues per 30
   min were educated guesses. Fold owner edits from the first few real videos.
8. **Board port hygiene** (small): EADDRINUSE crashes with a raw stack when
   4322 is taken. Print a clear message or auto-pick a port.

## How to run (quick reference)

```
cd pipelines/video/graphics-flow
bash steps/010-transcribe-run/run.sh <slug>        # vo.mp3 or vo.mp4 in videos/<slug>/ first
# 020: Sonnet subagent with steps/020-cue-pass-llm/cue-pass-prompt.md
#      (+ catalog.json + transcript text) writing videos/<slug>/cues.json
node lib/resolve.mjs <slug>
node lib/board.mjs [<slug>]                        # review at :4322, Save/Approve
node lib/render.mjs <slug> [--quality draft]       # after approval
bash scripts/check.sh                              # flow gate
(cd ../card-library && bash scripts/beat-smoke.sh) # card gate
```

Test log with all findings and folded lessons: `tests/TESTS.md`. Per-video data
convention: `videos/<slug>/` (text committed, media gitignored).
