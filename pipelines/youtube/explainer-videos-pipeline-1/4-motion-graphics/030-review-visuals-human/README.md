# 4/030 · review-visuals  ·  [HUMAN]

Watch `../020-build-graphics-agy/output/<base>.motion.mp4` in full (not just
the snapshots) alongside the voiceover.

## Checklist
- [ ] Every cue matches its stated intent from `../010-plan-visuals-opus/output/<base>.visual-plan.md`.
- [ ] No text spilling off-canvas or unstyled elements (the failure modes
      `hyperframes lint`/`validate`/`inspect` catch structurally, but a human
      eye catches the ones that only show up in motion).
- [ ] Overall duration matches the voiceover (already asserted mechanically at
      build time and again at `5-final-video-sync/010` — this is a final
      human sanity check, not the only guardrail).
- [ ] If `010` flagged a non-1920×1080 aspect ratio from the channel's
      video-style-dna.md, confirm that's actually what you want here.

**You approve → proceed to `../../5-final-video-sync/010` (mux-final-video).**

If something's wrong: fix the composition in `../020-build-graphics-agy/hf-project/`
and re-run that step's render (Steps 5–6 of its rulebook) — no need to
re-plan from `010` unless the ISSUE is with the plan itself (wrong cue
timing/intent), not the execution.
