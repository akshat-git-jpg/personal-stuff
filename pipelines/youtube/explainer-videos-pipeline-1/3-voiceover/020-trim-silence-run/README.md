# 3/020 · trim-silence  ·  [RUN]

Trims leading/trailing (and optionally internal) silence from the voiceover.
All ffmpeg, local, free.

- **In:** `../010-synthesize-voice-run/output/<base>.voice.wav`
- **Out:** `output/<base>.voice.trim.wav`
- **Run:** `python3 run.py [<voice.wav>] [--tighten]`
- **Next:** step 030 (voice-autoqc)
