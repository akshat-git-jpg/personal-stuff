#!/usr/bin/env python3
"""162 auto-assemble: build the draft cut from the assembly plan with ffmpeg.

In:  ../125-build-assembly-plan-run/output/<base>.assembly-plan.json
     the raw screen recording (path via --recording)
     ../100-trim-silence-run/output/<base>.voice.trim.wav
     ../160-download-avatar-videos-human/output/videos/  (A3 corner parts, A4 blocks)
     ../135-build-graphics-sonnet/output/{clips,overlays}/
Out: ./output/<base>.draft-cut.mp4

Passes:
  1. Slice + retime each screen segment to target_dur (setpts; freeze-pad via tpad).
     A4-block segments substitute the fullscreen avatar clip instead of footage.
  2. Concat all segments (uniform 1080p30 intermediate).
  3. Overlay the A3 corner avatar parts start-to-end (position/scale from
     shared/heygen_config.py), then graphics overlays/inserts at cue timestamps.
  4. Mux <base>.voice.trim.wav as the only audio track.
  5. Print the plan's flagged segments as the step-165 QC checklist.

NOT IMPLEMENTED YET - built by plans/011-tutorial-pipeline-v3.md (step: auto-assemble).
"""
import sys

sys.exit("162 auto-assemble is not implemented yet. See plans/011-tutorial-pipeline-v3.md")
