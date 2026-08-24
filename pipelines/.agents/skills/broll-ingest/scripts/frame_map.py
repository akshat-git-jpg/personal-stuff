#!/usr/bin/env python3
"""
frame_map.py — dense, timestamped contact sheets for reviewing a raw clip.

Samples one frame every N seconds (default 1 frame / 2.5s), stamps the exact
source timecode onto each frame, and tiles them into PNG sheets you can look
at to FIND THE MOMENTS (see knowledge/selection_rules.md).

Long clips are split across multiple sheets (~24 frames each) — one giant tile
is unreadable. Dark / low-contrast footage hides motion, so use --dense (or a
higher --fps) and re-map the suspected action window at 3 fps before cutting.

Usage:
    python3 frame_map.py INPUT.mp4 [--fps 0.4] [--dense] [--out DIR]
    python3 frame_map.py INPUT.mp4 --window 11.0 16.0 --fps 3   # tight pass on an action beat

Notes:
- --fps is frames-PER-SECOND to sample (0.4 = one frame every 2.5s). --dense = 1.0.
- Output: DIR/sheet_001.png, sheet_002.png, ... plus a printed index of
  (sheet, tile, timecode) so you can name the exact frame of each moment.
"""
import argparse
import math
import os
import subprocess
import sys

TILE_COLS = 6
TILE_ROWS = 4            # 24 frames per sheet
FRAMES_PER_SHEET = TILE_COLS * TILE_ROWS


def duration(path: str) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nokey=1:noprint_wrappers=1", path],
        capture_output=True, text=True, stdin=subprocess.DEVNULL,
    ).stdout.strip()
    return float(out) if out else 0.0


def build_sheet(path: str, start: float, end: float, fps: float, out_png: str) -> int:
    """Render one tiled sheet covering [start, end). Returns frame count."""
    span = max(0.0, end - start)
    n = min(FRAMES_PER_SHEET, max(1, int(span * fps)))
    cols = TILE_COLS
    rows = math.ceil(n / cols)
    # drawtext stamps the absolute source time (start + frame_time) on each frame.
    vf = (
        f"fps={fps},"
        f"drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:"
        f"text='%{{eif\\:({start}+t)\\:d}}s':x=8:y=8:fontsize=28:"
        f"fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=6,"
        f"scale=480:-1,tile={cols}x{rows}:padding=4:color=black"
    )
    subprocess.run(
        ["ffmpeg", "-y", "-ss", str(start), "-to", str(end), "-i", path,
         "-vf", vf, "-frames:v", "1", out_png],
        check=True, capture_output=True, stdin=subprocess.DEVNULL,
    )
    return n


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("--fps", type=float, default=0.4, help="frames/sec to sample (0.4 = 1 per 2.5s)")
    ap.add_argument("--dense", action="store_true", help="shortcut for --fps 1.0")
    ap.add_argument("--window", nargs=2, type=float, metavar=("START", "END"),
                    help="only map this time window (use --fps 3 for action beats)")
    ap.add_argument("--out", default=None, help="output dir (default: <input>_frames/)")
    args = ap.parse_args()

    if not os.path.isfile(args.input):
        sys.exit(f"No such file: {args.input}")
    fps = 1.0 if args.dense else args.fps
    out_dir = args.out or (os.path.splitext(args.input)[0] + "_frames")
    os.makedirs(out_dir, exist_ok=True)

    total = duration(args.input)
    start, end = (args.window if args.window else (0.0, total))
    # seconds covered per sheet so each sheet holds ~FRAMES_PER_SHEET frames
    sec_per_sheet = FRAMES_PER_SHEET / fps
    n_sheets = max(1, math.ceil((end - start) / sec_per_sheet))

    print(f"{args.input}: {total:.1f}s total | mapping [{start:.1f}, {end:.1f}] "
          f"@ {fps} fps -> {n_sheets} sheet(s) in {out_dir}")
    for i in range(n_sheets):
        s = start + i * sec_per_sheet
        e = min(end, s + sec_per_sheet)
        png = os.path.join(out_dir, f"sheet_{i+1:03d}.png")
        frames = build_sheet(args.input, s, e, fps, png)
        print(f"  sheet_{i+1:03d}.png  covers {s:.1f}-{e:.1f}s  ({frames} frames, "
              f"tile reads left→right, top→bottom; +{1/fps:.1f}s per tile)")
    print("\nReview every sheet. For each editorial MOMENT, note the exact second "
          "(stamped on the frame), then cut with extract_select.py.")


if __name__ == "__main__":
    main()
