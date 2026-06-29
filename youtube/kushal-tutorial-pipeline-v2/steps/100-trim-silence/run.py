#!/usr/bin/env python3
"""
Step 100 — trim dead air from the voiceover.  [RUN]

  python3 run.py [<voice.wav>] [--floor -40] [--edge 0.15] [--tighten] [--max-pause 0.7]

Default input: step 080's `output/<base>.voice.wav`. Always trims leading/trailing silence.
--tighten (optional) also removes internal silences longer than --max-pause — off by default
because it can make speech run together; turn it on only if the voiceover feels too loose, and
listen after. All ffmpeg, local, free. Output: output/<base>.voice.trim.wav
"""
import sys, subprocess, argparse, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]          # kushal-tutorial-pipeline-v2/
sys.path.insert(0, str(ROOT))
from lib import audio                                        # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "output"
PREV = ROOT / "steps/080-synthesize-voice/output"


def die(m): raise SystemExit("✖ " + m)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("wav", nargs="?", help="voiceover to trim (default: step 080's output)")
    ap.add_argument("--floor", type=float, default=-40, help="silence threshold in dB")
    ap.add_argument("--edge", type=float, default=0.15, help="min leading/trailing silence to cut (s)")
    ap.add_argument("--tighten", action="store_true", help="also drop internal pauses > --max-pause")
    ap.add_argument("--max-pause", type=float, default=0.7, help="internal pause length to drop (s)")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()

    src = pathlib.Path(a.wav) if a.wav else next(
        (p for p in sorted(PREV.glob("*.voice.wav")) if ".trim" not in p.name), None)
    if not src or not src.exists():
        die(f"no voiceover found (pass a path, or run step 080 first → {PREV})")
    OUT.mkdir(parents=True, exist_ok=True)
    out = pathlib.Path(a.out) if a.out else OUT / (src.stem + ".trim.wav")

    th = f"{a.floor}dB"
    af = (f"silenceremove=start_periods=1:start_silence={a.edge}:start_threshold={th}:detection=peak,"
          f"areverse,"
          f"silenceremove=start_periods=1:start_silence={a.edge}:start_threshold={th}:detection=peak,"
          f"areverse")
    if a.tighten:
        af += (f",silenceremove=stop_periods=-1:stop_silence={a.max_pause}:"
               f"stop_threshold={th}:detection=peak")

    print("→ trim:", "tighten" if a.tighten else "edges only", f"(floor {a.floor}dB)")
    subprocess.run(["ffmpeg", "-y", "-i", str(src), "-af", af, str(out)], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    d0, d1 = audio.dur(src), audio.dur(out)
    print(f"✓ {out}  ({d0:.1f}s → {d1:.1f}s, cut {d0 - d1:.1f}s)")
    print("→ next: listen; then step 120 (make-timestamped-transcript)")


if __name__ == "__main__":
    main()
