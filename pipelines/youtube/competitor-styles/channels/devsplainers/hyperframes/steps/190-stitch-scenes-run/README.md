# 190 · stitch-scenes · [RUN · free]

**Job:** Align each scene to its VO length and concatenate into one silent video.

**In:** `videos/<slug>/renders/scenes/*.mp4` + `durations.json`
**Out:** `videos/<slug>/renders/<slug>.silent.mp4`

**Run:** `bash steps/190-stitch-scenes-run/run.sh --video <slug>`
**Then:** proceed to 200.

**Cost:** **None** (ffmpeg). Per-scene length = max(scene, VO); short scenes freeze their last frame.
