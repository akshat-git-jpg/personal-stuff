#!/usr/bin/env python3
"""
Step 5/010 — mux the voiceover + rendered motion graphics into the final MP4.  [RUN]

  python3 run.py [<base>] [--tolerance 0.5]

In:  ../../3-voiceover/020-trim-silence-run/output/<base>.voice.trim.wav
     ../../4-motion-graphics/020-build-graphics-agy/output/<base>.motion.mp4
Out: output/<base>.final.mp4

HARD ASSERT: |video_duration - voice_duration| must be <= --tolerance seconds
(default 0.5s). This is the pipeline's inverted-sync-model guardrail — motion
graphics were rendered to fit the voiceover's duration (stage 4), so if they
don't match here, something upstream is wrong. This step FAILS LOUD on a
mismatch; it never silently truncates or pads either track.
"""
import sys, subprocess, argparse, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]          # explainer-videos-pipeline-1/
sys.path.insert(0, str(ROOT))
from lib import audio                                        # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "output"
VOICE_PREV = ROOT / "3-voiceover/020-trim-silence-run/output"
VIDEO_PREV = ROOT / "4-motion-graphics/020-build-graphics-agy/output"


def die(m): raise SystemExit("✖ " + m)


def infer_base():
    cands = sorted(VOICE_PREV.glob("*.voice.trim.wav"))
    if not cands:
        die(f"no voiceover found at {VOICE_PREV} — run 3-voiceover/020 first")
    return cands[-1].name.split(".voice.trim.wav")[0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base", nargs="?", help="topic base (default: infer from 3-voiceover/020)")
    ap.add_argument("--tolerance", type=float, default=0.5, help="max allowed duration mismatch, seconds")
    a = ap.parse_args()

    base = a.base or infer_base()
    voice = VOICE_PREV / f"{base}.voice.trim.wav"
    video = VIDEO_PREV / f"{base}.motion.mp4"

    if not voice.exists():
        die(f"no such file: {voice} (run 3-voiceover/020 first)")
    if not video.exists():
        die(f"no such file: {video} (run 4-motion-graphics/020 first)")

    voice_dur = audio.dur(voice)
    video_dur = audio.dur(video)
    if voice_dur == 0.0 or video_dur == 0.0:
        die(f"ffprobe couldn't read a duration (voice={voice_dur}, video={video_dur}) — "
            f"check both files are valid media")

    diff = abs(video_dur - voice_dur)
    if diff > a.tolerance:
        die(f"duration mismatch: video={video_dur:.2f}s voice={voice_dur:.2f}s "
            f"(diff {diff:.2f}s > tolerance {a.tolerance}s) — the motion-graphics render "
            f"(4-motion-graphics/020) did not hit the voiceover's duration. Fix the "
            f"composition's timeline length and re-render; do not proceed with a mismatched pair.")

    OUT.mkdir(parents=True, exist_ok=True)
    out_path = OUT / f"{base}.final.mp4"
    print(f"→ muxing: video={video_dur:.2f}s voice={voice_dur:.2f}s (diff {diff:.2f}s, within tolerance)")
    subprocess.run([
        "ffmpeg", "-y",
        "-i", str(video), "-i", str(voice),
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        str(out_path),
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    final_dur = audio.dur(out_path)
    print(f"✓ {out_path}  ({final_dur:.2f}s)")
    print("→ next: 6-thumbnail/010 (generate-thumbnail), then 7-upload/010 (package-for-handoff)")


if __name__ == "__main__":
    main()
