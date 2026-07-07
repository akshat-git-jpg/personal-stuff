"""Groq Whisper transcription. Used by step 020 (video->text) and step 120 (timestamped transcript).

Reuses the GROQ_API_KEY from ~/.zshenv. `word_timestamps=True` asks for word + segment
granularities (step 120); default returns segment-level verbose_json (step 020).
"""
import os, json
from .audio import to_mp3


def groq_transcribe(path, model="whisper-large-v3-turbo", word_timestamps=False):
    if not os.environ.get("GROQ_API_KEY"):
        raise SystemExit("✖ GROQ_API_KEY not set (it lives in ~/.zshenv)")
    from groq import Groq
    mp3 = to_mp3(path, suffix=".asr.mp3")
    kwargs = dict(model=model, response_format="verbose_json")
    if word_timestamps:
        kwargs["timestamp_granularities"] = ["segment", "word"]
    with open(mp3, "rb") as f:
        r = Groq().audio.transcriptions.create(file=(mp3.name, f.read()), **kwargs)
    mp3.unlink(missing_ok=True)
    # normalize SDK object -> plain dict
    if isinstance(r, dict):
        return r
    if hasattr(r, "model_dump"):
        return r.model_dump()
    return json.loads(str(r))
