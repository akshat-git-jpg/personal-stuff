# 5/010 · mux-final-video  ·  [RUN]  (final assembly step)

Muxes the voiceover audio with the rendered Hyperframes video into the final
MP4. Asserts the two durations match within 0.5s before muxing — the
pipeline's only arithmetic guardrail for the inverted sync model (motion
graphics render to FIT the voiceover, not the other way around).

- **In:** `../../3-voiceover/020-trim-silence-run/output/<base>.voice.trim.wav`
  + `../../4-motion-graphics/020-build-graphics-agy/output/<base>.motion.mp4`
- **Out:** `output/<base>.final.mp4`
- **Run:** `python3 run.py [<base>] [--tolerance 0.5]`
- **Fails loud, never silently truncates/pads** — a duration mismatch means
  something upstream (the motion-graphics render) is wrong; fix and re-render there.
- **Next:** step 6-thumbnail/010, then step 7-upload/010
