"""Groq Whisper transcription. Used by step 020 (video->text) and step 120 (timestamped transcript).

Thin re-export of the shared pipelines/common/transcribe.py implementation
(deduped 2026-07-08 - this file and its sibling in the other pipeline were
byte-identical copies of the same Groq-calling code).
"""
import sys
from pathlib import Path

_PIPELINES_ROOT = Path(__file__).resolve().parents[3]
if str(_PIPELINES_ROOT) not in sys.path:
    sys.path.insert(0, str(_PIPELINES_ROOT))

from common.transcribe import groq_transcribe  # noqa: E402,F401
