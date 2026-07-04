#!/usr/bin/env python3
"""125 build-assembly-plan: per-segment retime math for the auto-assembled cut.

In:  ../040-polish-script-for-delivery-sonnet/output/<base>.segments.json
       [{seg_id, raw_start, raw_end, script_text, kind: "screen"|"a4_block"}]
     ../120-make-timestamped-transcript-run/output/<base>.json (VO word timings)
     ../080-synthesize-voice-run/output/<base>.work/chunks.json (chunk -> segment ids)
Out: ./output/<base>.assembly-plan.json
       [{seg_id, src_in, src_out, target_dur, speed, freeze_pad, overlay: [...], flag, reason}]

Rules:
  - target_dur = summed VO duration of the segment's chunks.
  - speed = (src_out - src_in) / target_dur, clamped to SPEED_BAND. Remainder handled by
    freeze-extending the slice's last frame (short footage) or flagging (footage too long
    to fit even at max speed).
  - kind == "a4_block" segments produce no screen slice; they reserve the span for the
    fullscreen avatar clip from step 160.
  - Every flag carries a human-readable reason; flags are the editor's entire remaining job.

NOT IMPLEMENTED YET - built by plans/011-tutorial-pipeline-v3.md (step: assembly plan).
"""
import sys

SPEED_BAND = (0.85, 1.18)

sys.exit("125 build-assembly-plan is not implemented yet. See plans/011-tutorial-pipeline-v3.md")
