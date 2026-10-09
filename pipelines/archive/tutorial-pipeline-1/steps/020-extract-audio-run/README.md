# 020 · extract-audio  ·  [RUN]

- **In:** step 010's downloaded `intro.mp4`/`body.mp4`/`conclusion.mp4`
- **Out:** `output/intro.wav`, `output/body.wav`, `output/conclusion.wav` (16kHz mono) +
  `output/<title>.audio-manifest.json`
- **Run:** `python3 run.py [<video_title>]` (title inferred from step 010's manifest if omitted)
- **Next:** step 030 submits each wav to HeyGen against the mapped avatar
