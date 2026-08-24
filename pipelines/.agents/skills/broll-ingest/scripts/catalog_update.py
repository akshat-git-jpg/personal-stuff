#!/usr/bin/env python3
"""
catalog_update.py — append a graded select to the b-roll catalog (the brain).

The catalog (_catalog/broll_catalog.json) is the searchable index every future
edit queries. Each entry records the moment, where it came from, and how to use
it. Orientation is MANDATORY — vertical clips are NEVER b-roll in 16:9 edits.

Also probes orientation automatically (ffprobe rotation side-data) so you can't
forget it.

Usage:
    python3 catalog_update.py \\
        --catalog "~/.../Media/_catalog/broll_catalog.json" \\
        --file    broll-library/details/details_tie-running-shoes_C0415.mp4 \\
        --raw      raw-ingest/2026-06-11_office/C0415.mp4 \\
        --category details --desc "hands fastening running-shoe laces, clean tie" \\
        --tags shoes,hands,detail,morning --in 11.8 --out 18.1 --rating 4
"""
import argparse
import json
import os
import subprocess


def orientation(path: str) -> str:
    """vertical|horizontal, accounting for rotation side-data."""
    try:
        w = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                            "-show_entries", "stream=width,height",
                            "-of", "csv=p=0:s=x", path],
                           capture_output=True, text=True, stdin=subprocess.DEVNULL).stdout.strip()
        rot = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                              "-show_entries", "stream_side_data=rotation",
                              "-of", "default=nokey=1:noprint_wrappers=1", path],
                             capture_output=True, text=True, stdin=subprocess.DEVNULL).stdout.strip()
        wd, ht = (int(x) for x in w.split("x")[:2])
        if rot and abs(int(float(rot))) in (90, 270):
            wd, ht = ht, wd
        return "vertical" if ht > wd else "horizontal"
    except Exception:
        return "unknown"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--catalog", required=True)
    ap.add_argument("--file", required=True, help="graded library file path (relative to Media/)")
    ap.add_argument("--raw", default=None, help="source raw path (relative to Media/)")
    ap.add_argument("--category", required=True,
                    help="freedom|grind|machine|details|people|place|product")
    ap.add_argument("--desc", required=True)
    ap.add_argument("--tags", default="", help="comma-separated")
    ap.add_argument("--in", dest="t_in", type=float, required=True)
    ap.add_argument("--out", dest="t_out", type=float, required=True)
    ap.add_argument("--rating", type=int, default=3)
    ap.add_argument("--lut", default="buildloop-FINAL.cube")
    ap.add_argument("--probe-file", default=None,
                    help="local path to probe orientation from (defaults to --file if it exists)")
    args = ap.parse_args()

    catalog = os.path.expanduser(args.catalog)
    data = {"selects": []}
    if os.path.isfile(catalog):
        with open(catalog) as fh:
            data = json.load(fh)
    data.setdefault("selects", [])

    probe_src = args.probe_file or args.file
    orient = orientation(probe_src) if os.path.isfile(probe_src) else "unknown"

    entry = {
        "file": args.file,
        "raw": args.raw,
        "category": args.category,
        "description": args.desc,
        "tags": [t.strip() for t in args.tags.split(",") if t.strip()],
        "in": args.t_in,
        "out": args.t_out,
        "duration": round(args.t_out - args.t_in, 2),
        "rating": args.rating,
        "lut": args.lut,
        "orientation": orient,
    }
    data["selects"].append(entry)
    with open(catalog, "w") as fh:
        json.dump(data, fh, indent=2)

    flag = " 📱 VERTICAL (shorts/reels only — NEVER 16:9 b-roll)" if orient == "vertical" else ""
    print(f"catalog now {len(data['selects'])} selects. Added:{flag}")
    print(json.dumps(entry, indent=2))
    if orient == "unknown":
        print("\n⚠ orientation could not be probed — set it manually before this ships.")


if __name__ == "__main__":
    main()
