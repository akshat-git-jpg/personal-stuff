#!/usr/bin/env python3
"""
Step 020 — Google Drive video link -> raw transcript.  [RUN]  (first step of the pipeline)

  python3 run.py <drive_url> [--engine groq|openai|local] [--model <name>] [--keep-media]

Output (in ./output, named after the video):
  <base>.transcript.json   {"segments":[{"start","end","text"}, ...]}
  <base>.transcript.txt    plain readable transcript  (step 030 reads this)

Engines (default groq):
  groq    whisper-large-v3-turbo. Fastest + cheapest (~$0.02 / 30 min). Needs GROQ_API_KEY.
  openai  whisper-1. 25 MB upload cap (we downsample to fit). ~$0.18 / 30 min. Needs OPENAI_API_KEY.
  local   faster-whisper on this machine. Free + private, slower. pip install faster-whisper

Deps: ffmpeg + gdown (public Drive links). pip install gdown groq
"""
import sys, os, re, json, argparse, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]          # kushal-tutorial-pipeline-v2/
sys.path.insert(0, str(ROOT))
from lib import audio, asr                                   # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "output"


def drive_id(url):
    for pat in (r"/d/([A-Za-z0-9_-]{20,})", r"[?&]id=([A-Za-z0-9_-]{20,})"):
        m = re.search(pat, url)
        if m:
            return m.group(1)
    raise SystemExit(f"✖ could not find a Drive file id in: {url}")


def download(url, out_dir):
    """Download to the video's ORIGINAL filename so transcripts are named after it."""
    import gdown
    got = gdown.download(id=drive_id(url), output=str(out_dir) + os.sep, quiet=False)
    if not got:
        raise SystemExit("✖ gdown failed — is the link shared 'anyone with the link'?")
    return pathlib.Path(got)


def transcribe_groq(media, model):
    d = asr.groq_transcribe(media, model=model or "whisper-large-v3-turbo")
    return [{"start": s["start"], "end": s["end"], "text": s["text"]} for s in d.get("segments", [])]


def transcribe_openai(media, model):
    from openai import OpenAI
    with open(media, "rb") as f:
        r = OpenAI().audio.transcriptions.create(
            file=f, model=model or "whisper-1", response_format="verbose_json")
    return [{"start": s.start, "end": s.end, "text": s.text} for s in r.segments]


def transcribe_local(media, model):
    from faster_whisper import WhisperModel
    m = WhisperModel(model or "large-v3", device="auto", compute_type="auto")
    segments, _ = m.transcribe(str(media), vad_filter=True)
    return [{"start": s.start, "end": s.end, "text": s.text} for s in segments]


ENGINES = {"groq": transcribe_groq, "openai": transcribe_openai, "local": transcribe_local}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("--engine", choices=list(ENGINES), default="groq")
    ap.add_argument("--model", default=None)
    ap.add_argument("--keep-media", action="store_true")
    a = ap.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    print(f"→ {a.engine}")
    video = download(a.url, OUT)
    base = re.sub(r"[^\w.-]+", "_", video.stem) or "transcript"
    print(f"  video: {video.name}")

    # groq downsamples internally; openai/local need a small audio file
    media = video if a.engine == "groq" else audio.to_mp3(video, suffix=".16k.mp3")
    segs = ENGINES[a.engine](media, a.model)

    js = OUT / f"{base}.transcript.json"
    tx = OUT / f"{base}.transcript.txt"
    js.write_text(json.dumps({"segments": segs}, ensure_ascii=False, indent=2))
    tx.write_text("\n".join(s["text"].strip() for s in segs))

    if not a.keep_media:
        video.unlink(missing_ok=True)
        if media is not video:
            pathlib.Path(media).unlink(missing_ok=True)

    dur = segs[-1]["end"] if segs else 0
    print(f"✓ {len(segs)} segments, ~{dur/60:.1f} min\n  {js}\n  {tx}")
    print("→ next: step 030 (clean-and-fix-transcript) — Claude applies its rulebook to the .txt")


if __name__ == "__main__":
    main()
