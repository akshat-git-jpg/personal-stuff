# 100 · trim-silence  ·  [RUN]

Trim leading/trailing dead air from the voiceover (optionally tighten internal pauses).

- **In:** `../080-synthesize-voice-run/output/<base>.voice.wav`
- **Out:** `output/<base>.voice.trim.wav`
- **Run:** `python3 run.py [--tighten] [--floor -40] [--max-pause 0.7]`  (edges-only by default)
- **Next:** listen, then step 120

All ffmpeg, local, free. Uses `lib/audio.py`.
