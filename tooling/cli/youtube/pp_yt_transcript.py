"""pp-yt-transcript — agent-native CLI for YouTube transcripts.

Fetches a video's captions without MCP, without Claude in the loop, and
without an API key. Designed so bash crons / Hermes / agents can pull a
transcript and pipe compact text straight into a single `claude -p` call.

Primary path: youtube-transcript-api (hits YouTube's timedtext endpoint —
the same one the web player uses — so it succeeds from a residential IP
where yt-dlp's caption extractor currently fails). Fallback path: yt-dlp's
subtitle download (`python3 -m yt_dlp`), used only if the primary errors.

NOTE ON RELIABILITY: run this from a RESIDENTIAL IP (your Mac). YouTube
blocks datacenter IPs (Hostinger/AWS/GCP) for transcript fetches regardless
of config — there is no free fix for that. The cache below softens repeat
hits; for VPS use you'd route egress through a home IP (Tailscale exit node).

Subcommands:
  get URL|ID  [--lang en] [--format text|json|srt|vtt] [--timestamps]
              [--no-cache] [--no-fallback]
  langs URL|ID                      # list available caption tracks
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Optional

from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.formatters import (
    JSONFormatter,
    SRTFormatter,
    TextFormatter,
    WebVTTFormatter,
)

CACHE_DIR = Path(
    os.environ.get("PP_YT_CACHE", Path.home() / ".cache" / "pp-yt-transcript")
)

# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #

_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")


def extract_video_id(s: str) -> str:
    """Accept a bare 11-char ID or any common YouTube URL shape."""
    s = s.strip()
    if _ID_RE.match(s):
        return s
    # youtu.be/<id>, watch?v=<id>, /shorts/<id>, /embed/<id>, /live/<id>
    patterns = [
        r"youtu\.be/([A-Za-z0-9_-]{11})",
        r"[?&]v=([A-Za-z0-9_-]{11})",
        r"/shorts/([A-Za-z0-9_-]{11})",
        r"/embed/([A-Za-z0-9_-]{11})",
        r"/live/([A-Za-z0-9_-]{11})",
    ]
    for p in patterns:
        m = re.search(p, s)
        if m:
            return m.group(1)
    raise ValueError(f"could not extract a video ID from: {s!r}")


def lang_priority(want: str) -> list[str]:
    """Build a sensible language fallback list around the requested code."""
    want = want.lower()
    base = want.split("-")[0]
    order = [want]
    for c in (base, f"{base}-US", f"{base}-GB", "en", "en-US", "en-GB"):
        if c not in order:
            order.append(c)
    return order


# --------------------------------------------------------------------------- #
# fetch — primary (youtube-transcript-api) then yt-dlp fallback
# --------------------------------------------------------------------------- #


def fetch_primary(video_id: str, want_lang: str):
    """Return (FetchedTranscript, source_str). Raises on total failure."""
    api = YouTubeTranscriptApi()
    langs = lang_priority(want_lang)
    try:
        return api.fetch(video_id, languages=langs), "direct"
    except Exception:
        pass  # fall through to manual track selection / translation

    transcripts = list(api.list(video_id))  # raises if disabled/unavailable
    if not transcripts:
        raise RuntimeError("no caption tracks listed for this video")
    # prefer manually-created tracks over auto-generated
    transcripts.sort(key=lambda t: t.is_generated)
    base = transcripts[0]
    target = want_lang.split("-")[0]
    if base.language_code.split("-")[0] != target and base.is_translatable:
        try:
            return base.translate(target).fetch(), f"translated:{base.language_code}->{target}"
        except Exception:
            pass
    return base.fetch(), f"fallback-lang:{base.language_code}"


def _parse_vtt(text: str) -> str:
    """Strip WEBVTT headers, cue timings, and inline tags; dedup rolling lines."""
    out: list[str] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line == "WEBVTT" or line.startswith(("Kind:", "Language:", "NOTE")):
            continue
        if "-->" in line:
            continue
        if line.isdigit():
            continue
        line = re.sub(r"<[^>]+>", "", line)  # <c>, <00:00:00.000> etc.
        if not line:
            continue
        if out and out[-1] == line:  # auto-subs repeat each line across cues
            continue
        out.append(line)
    return " ".join(out)


def fetch_ytdlp(video_id: str, want_lang: str) -> str:
    """Best-effort fallback via `python3 -m yt_dlp`. Returns plain text only."""
    base = want_lang.split("-")[0]
    with tempfile.TemporaryDirectory() as d:
        cmd = [
            sys.executable, "-m", "yt_dlp",
            "--skip-download", "--write-auto-subs", "--write-subs",
            "--sub-langs", f"{base}.*,en.*", "--sub-format", "vtt/best",
            "-o", os.path.join(d, "%(id)s.%(ext)s"),
            f"https://www.youtube.com/watch?v={video_id}",
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
        vtts = sorted(glob.glob(os.path.join(d, "*.vtt")))
        if not vtts:
            raise RuntimeError(
                "yt-dlp fallback produced no subtitles "
                f"(exit {proc.returncode}): {proc.stderr.strip()[-300:]}"
            )
        return _parse_vtt(Path(vtts[0]).read_text(encoding="utf-8", errors="replace"))


# --------------------------------------------------------------------------- #
# cache
# --------------------------------------------------------------------------- #


def cache_path(video_id: str, lang: str) -> Path:
    return CACHE_DIR / f"{video_id}.{lang}.json"


def cache_load(video_id: str, lang: str) -> Optional[dict]:
    p = cache_path(video_id, lang)
    if p.exists():
        try:
            return json.loads(p.read_text())
        except Exception:
            return None
    return None


def cache_store(video_id: str, lang: str, payload: dict) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path(video_id, lang).write_text(json.dumps(payload))


# --------------------------------------------------------------------------- #
# rendering
# --------------------------------------------------------------------------- #


def render(payload: dict, fmt: str, timestamps: bool) -> str:
    snippets = payload["snippets"]
    if fmt == "json":
        return json.dumps(payload, indent=2)
    if fmt == "srt":
        return _SrtFromRaw(snippets)
    if fmt == "vtt":
        return _VttFromRaw(snippets)
    # text
    if timestamps:
        return "\n".join(f"[{_ts(s['start'])}] {s['text']}" for s in snippets)
    return " ".join(s["text"].replace("\n", " ") for s in snippets)


def _ts(sec: float) -> str:
    sec = int(sec)
    h, rem = divmod(sec, 3600)
    m, s = divmod(rem, 60)
    return f"{h:02d}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def _srt_ts(sec: float) -> str:
    ms = int(round(sec * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _SrtFromRaw(snippets: list[dict]) -> str:
    parts = []
    for i, s in enumerate(snippets, 1):
        end = s["start"] + s.get("duration", 0)
        parts.append(
            f"{i}\n{_srt_ts(s['start'])} --> {_srt_ts(end)}\n{s['text']}\n"
        )
    return "\n".join(parts)


def _VttFromRaw(snippets: list[dict]) -> str:
    lines = ["WEBVTT", ""]
    for s in snippets:
        end = s["start"] + s.get("duration", 0)
        a = _srt_ts(s["start"]).replace(",", ".")
        b = _srt_ts(end).replace(",", ".")
        lines.append(f"{a} --> {b}\n{s['text']}\n")
    return "\n".join(lines)


# --------------------------------------------------------------------------- #
# commands
# --------------------------------------------------------------------------- #


def cmd_get(args: argparse.Namespace) -> int:
    video_id = extract_video_id(args.url)
    lang = args.lang.lower()

    payload = None if args.no_cache else cache_load(video_id, lang)
    if payload is None:
        try:
            fetched, source = fetch_primary(video_id, lang)
            payload = {
                "video_id": video_id,
                "language": getattr(fetched, "language", None),
                "language_code": getattr(fetched, "language_code", lang),
                "is_generated": getattr(fetched, "is_generated", None),
                "source": source,
                "snippets": fetched.to_raw_data(),
            }
        except Exception as primary_err:
            if args.no_fallback:
                print(f"ERROR: primary fetch failed: {primary_err}", file=sys.stderr)
                return 2
            print(
                f"WARN: primary fetch failed ({primary_err}); trying yt-dlp fallback…",
                file=sys.stderr,
            )
            try:
                text = fetch_ytdlp(video_id, lang)
            except Exception as fb_err:
                print(
                    f"ERROR: both paths failed.\n  primary: {primary_err}\n  yt-dlp:  {fb_err}",
                    file=sys.stderr,
                )
                return 2
            # fallback yields text only — wrap as a single pseudo-snippet
            payload = {
                "video_id": video_id,
                "language": None,
                "language_code": lang,
                "is_generated": None,
                "source": "yt-dlp-fallback",
                "snippets": [{"text": text, "start": 0.0, "duration": 0.0}],
            }
        if not args.no_cache:
            cache_store(video_id, lang, payload)

    sys.stdout.write(render(payload, args.format, args.timestamps))
    sys.stdout.write("\n")
    return 0


def cmd_langs(args: argparse.Namespace) -> int:
    video_id = extract_video_id(args.url)
    api = YouTubeTranscriptApi()
    tracks = list(api.list(video_id))
    if not tracks:
        print("(no caption tracks)", file=sys.stderr)
        return 1
    for t in tracks:
        kind = "auto" if t.is_generated else "manual"
        tr = " translatable" if t.is_translatable else ""
        print(f"{t.language_code}\t{kind}\t{t.language}{tr}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="pp-yt-transcript",
        description="Agent-native YouTube transcript CLI (no API key, no MCP).",
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    g = sub.add_parser("get", help="Fetch a transcript.")
    g.add_argument("url", help="YouTube URL or 11-char video ID.")
    g.add_argument("--lang", default="en", help="Preferred language code (default en).")
    g.add_argument(
        "--format",
        choices=["text", "json", "srt", "vtt"],
        default="text",
        help="Output format (default text: one flowing block, ideal for piping to an LLM).",
    )
    g.add_argument(
        "--timestamps",
        action="store_true",
        help="With --format text, prefix each line with [mm:ss].",
    )
    g.add_argument("--no-cache", action="store_true", help="Bypass and don't write cache.")
    g.add_argument(
        "--no-fallback",
        action="store_true",
        help="Don't try the yt-dlp fallback if the primary path fails.",
    )
    g.set_defaults(func=cmd_get)

    l = sub.add_parser("langs", help="List available caption tracks.")
    l.add_argument("url", help="YouTube URL or 11-char video ID.")
    l.set_defaults(func=cmd_langs)

    return p


def main(argv: Optional[list[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except ValueError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
