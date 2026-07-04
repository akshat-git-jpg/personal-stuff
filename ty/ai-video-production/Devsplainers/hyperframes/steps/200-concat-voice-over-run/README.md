# 200 · concat-voice-over · [RUN · free]

**Job:** Pad each VO clip to its scene length and concatenate into one audio track.

**In:** `videos/<slug>/audio/*.trim.wav` + `durations.json`
**Out:** `videos/<slug>/renders/<slug>.vo.wav`

**Run:** `bash steps/200-concat-voice-over-run/run.sh --video <slug>`
**Then:** proceed to 210.

**Cost:** **None** (ffmpeg). Same per-scene lengths as 190 → tracks line up.
