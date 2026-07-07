#!/usr/bin/env python3
"""Transcript fetching with a fallback chain: native YouTube captions ->
Groq Whisper -> local Whisper. Shared by the dossiers pipeline and (via
groq_transcribe) by tutorial-pipeline-2 and explainer-videos-pipeline-1's
lib/asr.py.

CLI:
    python3 -m common.transcribe fetch <youtube-url-or-id> --out-dir <dir> [--method auto|captions|groq|local]

No venv - stdlib + the `groq` package (already required by callers that use
Groq transcription) + system binaries `yt-dlp`, `ffmpeg`, `ffprobe`, `npx`.
"""
import argparse
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path

MIN_WORDS = 300
HERE = Path(__file__).resolve().parent                       # pipelines/common
REPO_ROOT = HERE.parents[1]                                   # <repo>
PP_YT_TRANSCRIPT = REPO_ROOT / "tooling" / "cli" / "youtube" / "pp-yt-transcript"

VIDEO_ID_RE = re.compile(r"(?:v=|youtu\.be/|shorts/)([A-Za-z0-9_-]{11})")


def video_id_from(url_or_id):
    """Extract an 11-char YouTube video id from a URL, or pass a bare id through."""
    m = VIDEO_ID_RE.search(url_or_id)
    if m:
        return m.group(1)
    if re.fullmatch(r"[A-Za-z0-9_-]{11}", url_or_id):
        return url_or_id
    raise ValueError(f"can't parse a YouTube video id from: {url_or_id}")


def _word_count(text):
    return len(text.split())


def to_mp3(src, dst_dir="/tmp", suffix=".mp3"):
    """Downsample any audio/video to 16 kHz mono mp3. Returns the output path."""
    dst = Path(dst_dir) / (Path(src).stem + suffix)
    subprocess.run(["ffmpeg", "-y", "-i", str(src), "-ac", "1", "-ar", "16000",
                    "-b:a", "64k", str(dst)], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return dst


def groq_transcribe(path, model="whisper-large-v3-turbo", word_timestamps=False):
    """One Groq Whisper call on a local audio/video file. Returns the parsed
    verbose_json response as a plain dict."""
    if not os.environ.get("GROQ_API_KEY"):
        raise SystemExit("✗ GROQ_API_KEY not set (it lives in ~/.zshenv)")
    from groq import Groq
    mp3 = to_mp3(path, suffix=".asr.mp3")
    kwargs = dict(model=model, response_format="verbose_json")
    if word_timestamps:
        kwargs["timestamp_granularities"] = ["segment", "word"]
    with open(mp3, "rb") as f:
        r = Groq().audio.transcriptions.create(file=(mp3.name, f.read()), **kwargs)
    mp3.unlink(missing_ok=True)
    if isinstance(r, dict):
        return r
    if hasattr(r, "model_dump"):
        return r.model_dump()
    return json.loads(str(r))


def fetch_youtube_audio(video_id, dst_dir):
    """yt-dlp pulls the best available audio track to dst_dir. Returns the
    downloaded file's path (native container - pass through to_mp3() before
    transcribing)."""
    out_template = str(Path(dst_dir) / f"{video_id}.%(ext)s")
    subprocess.run(["yt-dlp", "-f", "bestaudio", "--no-playlist",
                    "-o", out_template, f"https://youtu.be/{video_id}"],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    matches = list(Path(dst_dir).glob(f"{video_id}.*"))
    if not matches:
        raise RuntimeError(f"yt-dlp reported success but no file matched {video_id}.*")
    return matches[0]


def _timestamp_line(start_seconds, text):
    return f"[{int(start_seconds) // 60}:{int(start_seconds) % 60:02d}] {text.strip()}"


def _try_captions(video_id):
    r = subprocess.run([str(PP_YT_TRANSCRIPT), "get", video_id, "--format", "text", "--timestamps"],
                        capture_output=True, text=True)
    if r.returncode != 0:
        return None
    text = r.stdout
    return text if _word_count(text) >= MIN_WORDS else None


def _try_groq(video_id, work_dir):
    audio_path = fetch_youtube_audio(video_id, work_dir)
    try:
        result = groq_transcribe(audio_path, word_timestamps=True)
    finally:
        audio_path.unlink(missing_ok=True)
    segments = result.get("segments") or []
    text = "\n".join(_timestamp_line(s["start"], s["text"]) for s in segments)
    return text if _word_count(text) >= MIN_WORDS else None


def _try_local_whisper(video_id, work_dir):
    audio_path = fetch_youtube_audio(video_id, work_dir)
    before = set(Path(work_dir).glob("*"))
    try:
        subprocess.run(["npx", "hyperframes", "transcribe", str(audio_path), "--model", "small"],
                       check=True, cwd=work_dir, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    finally:
        audio_path.unlink(missing_ok=True)
    after = set(Path(work_dir).glob("*"))
    new_json = [p for p in (after - before) if p.suffix == ".json"]
    if not new_json:
        return None
    data = json.loads(new_json[0].read_text())
    new_json[0].unlink(missing_ok=True)
    words = data if isinstance(data, list) else (data.get("segments") or data.get("words") or [])
    text = "\n".join(_timestamp_line(w.get("start", 0), w.get("text", "")) for w in words)
    return text if _word_count(text) >= MIN_WORDS else None


_CHAIN_STEPS = {
    "captions": lambda video_id, wd: _try_captions(video_id),
    "groq": lambda video_id, wd: _try_groq(video_id, wd),
    "local": lambda video_id, wd: _try_local_whisper(video_id, wd),
}
_AUTO_ORDER = ["captions", "groq", "local"]


def fetch(video_id_or_url, method="auto", out_dir=None):
    """Fetch a transcript by the fallback chain (or a forced single method).
    Returns (transcript_text, method_used). Raises RuntimeError if every
    attempted method fails or returns under MIN_WORDS."""
    video_id = video_id_from(video_id_or_url)
    order = _AUTO_ORDER if method == "auto" else [method]
    if any(m not in _CHAIN_STEPS for m in order):
        raise ValueError(f"unknown method: {method}")
    with tempfile.TemporaryDirectory() as tmp:
        wd = out_dir or tmp
        for name in order:
            text = _CHAIN_STEPS[name](video_id, wd)
            if text is not None:
                return text, name
    raise RuntimeError(f"all methods failed for {video_id} (method={method})")


def main():
    p = argparse.ArgumentParser(prog="transcribe")
    sub = p.add_subparsers(dest="cmd", required=True)
    fetch_p = sub.add_parser("fetch")
    fetch_p.add_argument("video")
    fetch_p.add_argument("--method", choices=["auto", "captions", "groq", "local"], default="auto")
    fetch_p.add_argument("--out-dir", default=None)
    args = p.parse_args()
    text, method_used = fetch(args.video, method=args.method, out_dir=args.out_dir)
    out_dir = Path(args.out_dir) if args.out_dir else Path(".")
    out_dir.mkdir(parents=True, exist_ok=True)
    vid = video_id_from(args.video)
    out_path = out_dir / "transcript.md"
    out_path.write_text(text)
    print(json.dumps({"video_id": vid, "path": str(out_path), "method": method_used}))


if __name__ == "__main__":
    main()
