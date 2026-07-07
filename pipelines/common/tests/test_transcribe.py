import json
from pathlib import Path
from unittest.mock import patch, MagicMock

from common import transcribe


def test_video_id_from_variants():
    assert transcribe.video_id_from("https://youtu.be/dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    assert transcribe.video_id_from("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    assert transcribe.video_id_from("dQw4w9WgXcQ") == "dQw4w9WgXcQ"


def test_fetch_auto_uses_captions_when_long_enough():
    long_text = "word " * 400
    with patch("common.transcribe._try_captions", return_value=long_text) as cap, \
         patch("common.transcribe._try_groq") as groq:
        text, method = transcribe.fetch("dQw4w9WgXcQ", method="auto")
    assert method == "captions"
    assert text == long_text
    cap.assert_called_once()
    groq.assert_not_called()


def test_fetch_auto_falls_through_to_groq_when_captions_too_short():
    short_text = "word " * 50
    long_text = "word " * 400
    with patch("common.transcribe._try_captions", return_value=None), \
         patch("common.transcribe._try_groq", return_value=long_text) as groq, \
         patch("common.transcribe._try_local_whisper") as local:
        text, method = transcribe.fetch("dQw4w9WgXcQ", method="auto")
    assert method == "groq"
    assert text == long_text
    groq.assert_called_once()
    local.assert_not_called()


def test_fetch_auto_falls_through_to_local_when_captions_and_groq_fail():
    long_text = "word " * 400
    with patch("common.transcribe._try_captions", return_value=None), \
         patch("common.transcribe._try_groq", return_value=None), \
         patch("common.transcribe._try_local_whisper", return_value=long_text) as local:
        text, method = transcribe.fetch("dQw4w9WgXcQ", method="auto")
    assert method == "local"
    local.assert_called_once()


def test_fetch_raises_when_all_methods_fail():
    with patch("common.transcribe._try_captions", return_value=None), \
         patch("common.transcribe._try_groq", return_value=None), \
         patch("common.transcribe._try_local_whisper", return_value=None):
        try:
            transcribe.fetch("dQw4w9WgXcQ", method="auto")
            assert False, "expected RuntimeError"
        except RuntimeError:
            pass


def test_try_captions_rejects_thin_output():
    fake = MagicMock(returncode=0, stdout="too short")
    with patch("common.transcribe.subprocess.run", return_value=fake):
        assert transcribe._try_captions("dQw4w9WgXcQ") is None


def test_try_captions_accepts_long_output():
    fake = MagicMock(returncode=0, stdout="word " * 400)
    with patch("common.transcribe.subprocess.run", return_value=fake):
        assert transcribe._try_captions("dQw4w9WgXcQ") is not None


def test_fetch_explicit_method_skips_chain(tmp_path):
    long_text = "word " * 400
    with patch("common.transcribe._try_groq", return_value=long_text) as groq, \
         patch("common.transcribe._try_captions") as cap:
        text, method = transcribe.fetch("dQw4w9WgXcQ", method="groq", out_dir=str(tmp_path))
    assert method == "groq"
    cap.assert_not_called()
