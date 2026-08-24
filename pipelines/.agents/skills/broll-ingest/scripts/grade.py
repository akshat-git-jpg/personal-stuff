#!/usr/bin/env python3
"""
grade.py — apply the BuildLoop cinematic grade (and optional per-shot fixes).

Wraps the locked color pipeline: optional pre-LUT exposure / white-balance
correction, then the 3D LUT, then format=yuv420p (REQUIRED — without it
QuickTime can't open the output after lut3d/drawtext).

Pick the LUT by the source gamma:
    Rec709 / bt709 footage      -> buildloop-FINAL        (or -soft for harsh midday)
    S-Log3 / S-Gamut3.Cine      -> buildloop-FINAL-slog3   (or -slog3-soft)
Check the Sony XML sidecar's CaptureGammaEquation if unsure — NEVER put the
plain FINAL LUT on log footage (it'll look flat and grey).

The grade is the GLOBAL look, not per-shot correction. If output is washed out
or blown, fix exposure/contrast FIRST with --exposure / --eq, then the LUT.

Usage:
    python3 grade.py IN.mp4 OUT.mp4                          # Rec709 FINAL
    python3 grade.py IN.mp4 OUT.mp4 --lut slog3              # log footage
    python3 grade.py IN.mp4 OUT.mp4 --exposure -0.4         # tame a blown sky
    python3 grade.py IN.mp4 OUT.mp4 --start 11.8 --end 18.1 # cut + grade in ONE pass
    python3 grade.py IN.mp4 OUT.mp4 --warm-fix              # de-orange a tungsten gym

After grading, verify with: python3 grade.py --measure OUT.mp4
(YAVG ~120-155 for bright outdoor; R-B mean ~+20-25 for warm interiors.)
"""
import argparse
import os
import subprocess
import sys

LUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "luts")
LUTS = {
    "final": "buildloop-FINAL.cube",
    "soft": "buildloop-FINAL-soft.cube",
    "slog3": "buildloop-FINAL-slog3.cube",
    "slog3-soft": "buildloop-FINAL-slog3-soft.cube",
}
# de-orange a warm tungsten interior (from the editorial selection rules)
WARM_FIX = "colorbalance=rm=-0.20:bm=0.16:rs=-0.08:bs=0.06"


def lut_path(key: str) -> str:
    p = os.path.join(LUT_DIR, LUTS[key])
    if not os.path.isfile(p):
        sys.exit(f"LUT not found: {p}")
    return p.replace(":", "\\:")  # escape for ffmpeg filter arg


def measure(path: str) -> None:
    """Print YAVG + per-channel means, averaged over the first few frames (exposure/WB gate)."""
    import json
    src = os.path.abspath(path).replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")
    proc = subprocess.run(
        ["ffprobe", "-v", "error", "-f", "lavfi", "-i", f"movie='{src}',signalstats",
         "-show_entries",
         "frame_tags=lavfi.signalstats.YAVG,lavfi.signalstats.RAVG,lavfi.signalstats.BAVG",
         "-read_intervals", "%+#5", "-of", "json"],
        capture_output=True, text=True, stdin=subprocess.DEVNULL,
    )
    try:
        frames = json.loads(proc.stdout).get("frames", [])
    except json.JSONDecodeError:
        frames = []
    if not frames:
        print("Could not read signalstats:\n" + "\n".join(proc.stderr.splitlines()[-4:]))
        return

    def avg(tag: str) -> float:
        vals = [float(f["tags"][tag]) for f in frames if f.get("tags", {}).get(tag)]
        return sum(vals) / len(vals) if vals else float("nan")

    yv, rv, bv = avg("lavfi.signalstats.YAVG"), avg("lavfi.signalstats.RAVG"), avg("lavfi.signalstats.BAVG")
    if yv == yv:  # not NaN
        verdict = "OK ~120-155" if 120 <= yv <= 155 else (
            "BLOWN >180 → add --exposure -0.3..-0.5" if yv > 180 else "dark/low (fine for moody/interior)")
        print(f"YAVG={yv:.0f}  ({verdict})")
    if rv == rv and bv == bv:
        rb = rv - bv
        verdict = "OK ~+20-25" if rb <= 25 else "too orange → --warm-fix"
        print(f"R-B mean={rb:+.0f}  ({verdict})")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("output", nargs="?")
    ap.add_argument("--lut", choices=list(LUTS), default="final")
    ap.add_argument("--exposure", type=float, help="pre-LUT exposure stops (e.g. -0.4 for a blown sky)")
    ap.add_argument("--eq", help="raw ffmpeg eq= args, e.g. 'brightness=-0.05:contrast=1.1'")
    ap.add_argument("--warm-fix", action="store_true", help="pre-LUT de-orange for tungsten interiors")
    ap.add_argument("--start", type=float, help="cut start (cut+grade in one pass)")
    ap.add_argument("--end", type=float, help="cut end")
    ap.add_argument("--measure", action="store_true", help="just measure exposure/WB of INPUT and exit")
    args = ap.parse_args()

    if not os.path.isfile(args.input):
        sys.exit(f"No such file: {args.input}")
    if args.measure:
        measure(args.input)
        return
    if not args.output:
        sys.exit("OUTPUT path required (or use --measure)")

    chain = []
    if args.exposure is not None:
        chain.append(f"exposure=exposure={args.exposure}")
    if args.warm_fix:
        chain.append(WARM_FIX)
    if args.eq:
        chain.append(f"eq={args.eq}")
    chain.append(f"lut3d=file='{lut_path(args.lut)}'")
    chain.append("format=yuv420p")     # MANDATORY after lut3d
    vf = ",".join(chain)

    cmd = ["ffmpeg", "-y"]
    if args.start is not None:
        cmd += ["-ss", str(args.start)]
    if args.end is not None:
        cmd += ["-to", str(args.end)]
    cmd += ["-i", args.input, "-vf", vf,
            "-c:v", "libx264", "-crf", "16", "-preset", "slow",
            "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", args.output]
    print("grade:", vf)
    subprocess.run(cmd, check=True, stdin=subprocess.DEVNULL)
    print(f"\nwrote {args.output}")
    measure(args.output)


if __name__ == "__main__":
    main()
