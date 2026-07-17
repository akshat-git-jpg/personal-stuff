# Rulebook 135 · build-graphics (Claude Code, model: Sonnet)

Stub. Written by plans/011-tutorial-pipeline-v3.md (step: graphics rulebook).

The rulebook will specify, per visual-plan cue type:
- which hyperframes workflow authors it (motion-graphics for callouts, stat hits, and
  lower-thirds; faceless-explainer blueprints for concept inserts longer than ~8s)
- the brand tokens (colors, fonts) shared with the channel look
- render settings: full-frame cues to 1920x1080 MP4, overlay cues to transparent MOV,
  duration locked to the cue's duration from the visual plan
- the verify pass: snapshot each clip's midpoint frame and check it against the cue intent
  before handing to step 162

Owner: author this in a Claude Code session on Sonnet with the pipelines:hyperframes + motion-graphics skills loaded.

For final-workflow videos this is superseded by the beat-sync flow rulebook: pipelines/video/card-library/flow/RULEBOOK.md (plan 064).
