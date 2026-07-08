#!/usr/bin/env python3
"""
Step 020 — extract audio from the 3 input segments.  [RUN]

  python3 run.py [<video_title>]

Reads:  ../010-resolve-drive-input-run/output/<video_title>.input-manifest.json
Writes: output/intro.wav, output/body.wav, output/conclusion.wav
"""
import sys, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from lib import audio                                            # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "output"
S010_OUT = ROOT / "steps/010-resolve-drive-input-run/output"
SEGMENTS = ("intro", "body", "conclusion")


def die(m): raise SystemExit("✖ " + m)


def infer_title(arg):
    if arg:
        return arg
    cands = sorted(S010_OUT.glob("*.input-manifest.json"))
    if not cands:
        die(f"can't infer video title — run step 010 first (no manifest in {S010_OUT})")
    return cands[0].name.split(".input-manifest.json")[0]


def main():
    title = infer_title(sys.argv[1] if len(sys.argv) > 1 else None)
    mpath = S010_OUT / f"{title}.input-manifest.json"
    if not mpath.exists():
        die(f"no manifest for {title!r} — run step 010 first ({mpath})")
    manifest = json.loads(mpath.read_text())

    OUT.mkdir(parents=True, exist_ok=True)
    wavs = {}
    for seg in SEGMENTS:
        src = manifest["files"][seg]
        dest = OUT / f"{seg}.wav"
        audio.extract_audio(src, dest)
        wavs[seg] = str(dest)
        print(f"  🎧 {seg}.mp4 → {dest} ({audio.mmss(audio.dur(dest))})")

    (OUT / f"{title}.audio-manifest.json").write_text(
        json.dumps({"video_title": title, "type": manifest["type"], "wavs": wavs}, indent=2))
    print(f"✓ extracted audio for {title}")


if __name__ == "__main__":
    main()
