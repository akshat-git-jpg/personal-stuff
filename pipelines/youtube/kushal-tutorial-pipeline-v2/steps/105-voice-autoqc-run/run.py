#!/usr/bin/env python3
"""105 voice-autoqc: flag bad TTS chunks so the human gate only listens to flags.

In:  ../080-synthesize-voice-run/output/<base>.work/{clips/*.wav, chunks.json}
Out: ./output/<base>.voice-qc.json  {chunk_id: {"verdict": "pass"|"flag", "reasons": [...]}}

Checks (all deterministic, thresholds below):
  1. WER: re-transcribe each clip via lib.asr (Groq whisper), compare to the chunk's
     script text after normalization (lowercase, strip punctuation, numbers spelled out).
     Flag when WER > WER_FLAG.
  2. Loudness: mean dBFS per clip vs median of all clips. Flag when > LOUD_DB_DELTA away,
     or when clipping (peak >= 0 dBFS).
  3. Pace: words / duration outside PACE_BAND (words per second).

NOT IMPLEMENTED YET - built by plans/011-tutorial-pipeline-v3.md (step: voice auto-QC).
"""
import sys

WER_FLAG = 0.18
LOUD_DB_DELTA = 6.0
PACE_BAND = (1.8, 3.6)

sys.exit("105 voice-autoqc is not implemented yet. See plans/011-tutorial-pipeline-v3.md")
