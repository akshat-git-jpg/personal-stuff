#!/bin/bash
# Thin wrapper → lib/tts-kokoro.py. Run from the project root:
#   bash steps/040-synthesize-voice-over-run/run.sh --video <slug> [--voice af_heart]
exec python3 "$(cd "$(dirname "$0")/../.." && pwd)/lib/tts-kokoro.py" "$@"
