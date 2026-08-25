#!/usr/bin/env python3
from __future__ import annotations
"""Loop Studio platform adapters — ONE import that makes every engine run on
macOS (Apple Silicon), Windows, or Linux. Engines must never call mlx_whisper
or hevc_videotoolbox directly; they call these.

  from ls_platform import transcribe, hevc_encode_args, ffmpeg_check

Verified: darwin/arm64 branch (2026-07-14). Windows/Linux branches are
code-complete but UNTESTED until the clean-install test on a real machine —
do not claim Windows support to buyers before that gate passes.
"""
import os
import platform as _pl
import shutil, subprocess, sys

IS_MAC_ARM = sys.platform == "darwin" and _pl.machine() == "arm64"
IS_WIN = sys.platform.startswith("win")

# ── transcription ────────────────────────────────────────────────────────
# Apple Silicon → mlx-whisper (GPU, ~11× realtime). Anywhere else →
# faster-whisper (CTranslate2; CUDA if present, else CPU int8).
_fw_model = None

def transcribe(audio_path: str, language: str | None = None, word_timestamps: bool = True) -> dict:
    """Returns {'text', 'language', 'segments':[{'start','end','text','words':[{'word','start','end'}]}]}
    — the mlx-whisper shape, on every OS."""
    if IS_MAC_ARM:
        try:
            import mlx_whisper
            return mlx_whisper.transcribe(
                audio_path, path_or_hf_repo=os.environ.get("LS_WHISPER_MODEL_MLX", "mlx-community/whisper-large-v3-mlx"),
                language=language, word_timestamps=word_timestamps,
                condition_on_previous_text=False)
        except ImportError:
            pass  # mlx-whisper not installed on this Apple Silicon box -> fall back to faster-whisper (large-v3) below
    # Windows / Linux / Intel Mac
    global _fw_model
    from faster_whisper import WhisperModel  # pip install faster-whisper
    if _fw_model is None:
        try:
            _fw_model = WhisperModel(os.environ.get("LS_WHISPER_MODEL", "large-v3"), device="cuda", compute_type="float16")
        except Exception:
            _fw_model = WhisperModel(os.environ.get("LS_WHISPER_MODEL", "large-v3"), device="cpu", compute_type="int8")
    segs, info = _fw_model.transcribe(
        audio_path, language=language, word_timestamps=word_timestamps,
        condition_on_previous_text=False)
    out = {"text": "", "language": info.language, "segments": []}
    for s in segs:
        words = [{"word": w.word, "start": w.start, "end": w.end} for w in (s.words or [])]
        out["segments"].append({"start": s.start, "end": s.end, "text": s.text, "words": words})
        out["text"] += s.text
    return out

# ── encoding ─────────────────────────────────────────────────────────────
_enc_cache = None

def _ffmpeg_encoders() -> str:
    try:
        return subprocess.run(["ffmpeg", "-hide_banner", "-encoders"],
                              capture_output=True, text=True).stdout
    except FileNotFoundError:
        return ""

def _nvenc_works() -> bool:
    """ffmpeg LISTS nvenc even without an NVIDIA GPU — probe a real 1-frame encode."""
    try:
        r = subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "color=black:s=64x64:d=0.1",
                            "-c:v", "hevc_nvenc", "-f", "null", "-"],
                           capture_output=True, timeout=20)
        return r.returncode == 0
    except Exception:
        return False

def hevc_encode_args(quality: int = 55) -> list[str]:
    """Best available HEVC encoder for archival transcodes.
    Mac: VideoToolbox (hw) · NVIDIA: NVENC · else: libx265 CPU (slow but same result)."""
    global _enc_cache
    if _enc_cache is None:
        encs = _ffmpeg_encoders()
        if sys.platform == "darwin" and "hevc_videotoolbox" in encs:
            _enc_cache = ["-c:v", "hevc_videotoolbox", "-q:v", str(quality),
                          "-profile:v", "main10", "-pix_fmt", "p010le", "-tag:v", "hvc1"]
        elif "hevc_nvenc" in encs and _nvenc_works():
            _enc_cache = ["-c:v", "hevc_nvenc", "-preset", "p5", "-cq", "28", "-tag:v", "hvc1"]
        else:
            _enc_cache = ["-c:v", "libx265", "-crf", "26", "-preset", "medium", "-tag:v", "hvc1"]
    return list(_enc_cache)

def h264_delivery_args(crf: int = 18) -> list[str]:
    """Delivery renders: libx264 everywhere (already cross-platform)."""
    return ["-c:v", "libx264", "-crf", str(crf), "-preset", "medium"]

# ── environment doctor ───────────────────────────────────────────────────
def ffmpeg_check() -> tuple[bool, str]:
    if shutil.which("ffmpeg"):
        return True, "ffmpeg ok"
    hint = ("winget install --id Gyan.FFmpeg  (then reopen the terminal)" if IS_WIN
            else "brew install ffmpeg" if sys.platform == "darwin"
            else "sudo apt install ffmpeg")
    return False, f"ffmpeg missing → {hint}"

def doctor() -> list[str]:
    """REQUIRED prerequisites to render (empty list = ready). The one-command fix
    for anything here is: python3 core/engine/setup.py. Torch is OPTIONAL — see
    optional_missing()."""
    issues = []
    ok, _ = ffmpeg_check()
    if not ok: issues.append("ffmpeg (encode/render) missing → run: python3 core/engine/setup.py")
    transcriber = "mlx-whisper" if IS_MAC_ARM else "faster-whisper"
    try:
        __import__(transcriber.replace("-", "_"))
    except ImportError:
        issues.append(f"{transcriber} (transcription) missing → run: python3 core/engine/setup.py")
    # node + npm: the Remotion render engine needs them; a fresh Mac often has neither.
    if not (shutil.which("node") and shutil.which("npm")):
        issues.append("node/npm (Remotion render engine) missing → run: python3 core/engine/setup.py")
    # brand-font drift: the name in brand.json must match the engine.tsx loader import, or the
    # render silently falls back to the default font (the "the font isn't mine" support trap).
    try:
        import importlib.util as _ilu
        _sbf = os.path.join(os.path.dirname(os.path.abspath(__file__)), "set_brand_font.py")
        _spec = _ilu.spec_from_file_location("_set_brand_font", _sbf) if os.path.exists(_sbf) else None
        if _spec is not None and _spec.loader is not None:
            _mod = _ilu.module_from_spec(_spec)
            _spec.loader.exec_module(_mod)
            for _p in _mod.drift():
                issues.append("font drift → " + _p + "  (fix: python3 core/engine/set_brand_font.py)")
    except Exception:
        pass
    return issues

def optional_missing() -> list[str]:
    """Nice-to-have deps that do NOT block a first render (don't fail on these)."""
    notes = []
    try:
        import torchaudio  # noqa: F401 — forced alignment in core/engine/cut (raw-take cutter)
    except ImportError:
        notes.append("torch/torchaudio not installed (OPTIONAL — only to cut raw multi-take footage) "
                     "→ python3 core/engine/setup.py --with-cutter")
    return notes

if __name__ == "__main__":
    print(f"platform: {sys.platform}/{_pl.machine()}  mac_arm={IS_MAC_ARM} win={IS_WIN}")
    print("hevc args:", " ".join(hevc_encode_args()))
    probs = doctor()
    if probs:
        print("doctor: NOT READY —")
        for p in probs: print("  •", p)
        print("\n→ One command installs all of it:  python3 core/engine/setup.py")
    else:
        print("doctor: healthy [OK] — ready to render")
    for n in optional_missing(): print("  (optional)", n)
