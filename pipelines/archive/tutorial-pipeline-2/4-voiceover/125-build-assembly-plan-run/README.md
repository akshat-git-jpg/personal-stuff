# 125 · build-assembly-plan  ·  [RUN]

The heart of editor removal. Joins the segment map (which raw-footage span belongs to each
script segment) with the measured VO durations, and decides how each footage slice is
retimed to fit its voiceover. Pure arithmetic, no LLM.

- **In:** `../../3-scripting/040-polish-script-for-delivery-sonnet/output/<base>.segments.json` (segment map,
  written by the v3 polish rulebook) + `../120-make-timestamped-transcript-run/output/<base>.json`
  (VO timing) + `../080-synthesize-voice-run/output/<base>.work/chunks.json`
- **Out:** `output/<base>.assembly-plan.json`: per segment, the recording in/out points, the
  target duration (its VO length), the speed factor, freeze-extend padding, plus any
  fullscreen-avatar block or graphics insert that replaces/overlays it. Segments whose speed
  factor falls outside SPEED_BAND are marked `"flag": true` with a reason.
- **How:** `python3 run.py --base <base> --recording <path>`. Flags are printed as a numbered
  list; they are the only thing a human needs to fix by hand later.
- **Next:** step 135 renders graphics against the same timeline; step 162 executes this plan
