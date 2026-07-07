# 162 · auto-assemble  ·  [RUN]

Execute the assembly plan: the step that used to be "the editor". ffmpeg only, no LLM,
no judgment; every decision was already made in step 125.

- **In:** `../125-build-assembly-plan-run/output/<base>.assembly-plan.json` + the raw
  recording + `../100-trim-silence-run/output/<base>.voice.trim.wav` +
  `../160-download-avatar-videos-human/output/videos/` (A3 corner parts, A4 blocks) +
  `../135-build-graphics-sonnet/output/`
- **Out:** `output/<base>.draft-cut.mp4` (screen slices retimed to VO, corner avatar
  overlaid throughout, A4 fullscreen blocks and graphics inserted at their timestamps,
  VO as the audio track)
- **How:** `python3 run.py --base <base> --recording <path>`. Per segment: cut, retime
  (setpts/atempo-free since VO is the audio), freeze-pad, then one concat, then overlay
  passes (corner avatar scaled per `shared/heygen_config.py`, graphics at cue timestamps),
  then mux the VO. Prints the flagged-segment list from the plan at the end as the QC
  checklist for step 165.
- **Next:** step 165, watch the draft cut
