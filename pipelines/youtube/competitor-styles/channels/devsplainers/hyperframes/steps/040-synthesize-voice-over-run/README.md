# 040 · synthesize-voice-over · [RUN · free]

**Job:** Generate one voice clip per line with local Kokoro TTS (free, offline).

**In:** `videos/<slug>/tts-lines.md`
**Out:** `videos/<slug>/audio/beatNN.wav` (24 kHz)

**Run:** `bash steps/040-synthesize-voice-over-run/run.sh --video <slug> [--voice af_heart]`
**Then:** proceed to 050.

**Cost:** **None** (deterministic, runs on-device). One-time setup: `pip install kokoro soundfile`.
