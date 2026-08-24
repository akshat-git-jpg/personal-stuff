#!/usr/bin/env python3
"""
extract_select.py — frame-accurate cut of one editorial moment, + frame-1 proof.

Cuts [start, end) from a raw clip with a re-encode (accurate to the frame, unlike
stream-copy which snaps to keyframes), then grabs the FIRST frame as a JPEG so you
can verify the select opens ON the action — the most important frame of the clip
(see knowledge/selection_rules.md, rule 6).

This extracts the raw moment. To extract AND grade in one pass, use grade.py with
--start/--end instead (one ffmpeg pass = one upload to Drive).

Usage:
    python3 extract_select.py RAW.mp4 --start 11.8 --end 18.1 \\
        --out broll-library/details/details_tie-running-shoes_C0415.mp4
    # then eyeball <out>.frame1.jpg before calling it done
"""
import argparse
import os
import subprocess
import sys


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("--start", type=float, required=True)
    ap.add_argument("--end", type=float, required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    if not os.path.isfile(args.input):
        sys.exit(f"No such file: {args.input}")
    if args.end <= args.start:
        sys.exit("--end must be greater than --start")
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)

    # Accurate trim: -ss/-to AFTER -i forces decode from 0 and cuts on the exact frame.
    subprocess.run(
        ["ffmpeg", "-y", "-i", args.input, "-ss", str(args.start), "-to", str(args.end),
         "-c:v", "libx264", "-crf", "16", "-preset", "slow",
         "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", args.out],
        check=True, stdin=subprocess.DEVNULL,
    )

    # Frame-1 proof grab.
    proof = os.path.splitext(args.out)[0] + ".frame1.jpg"
    subprocess.run(
        ["ffmpeg", "-y", "-i", args.out, "-frames:v", "1", "-q:v", "2", proof],
        check=True, capture_output=True, stdin=subprocess.DEVNULL,
    )
    print(f"wrote {args.out}\nframe-1 proof: {proof}  "
          f"← VERIFY this is the action already starting, not an empty frame / camera-glance.")


if __name__ == "__main__":
    main()
