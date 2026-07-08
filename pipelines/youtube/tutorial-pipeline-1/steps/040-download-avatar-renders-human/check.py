#!/usr/bin/env python3
"""Step 040 — download checklist. [HUMAN] gate helper.

  python3 check.py [<video_title>]

Exit 0 when all 3 segments are present in output/videos/, exit 1 otherwise.
"""
import sys, pathlib

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
VIDEOS = HERE / "output" / "videos"
S030_OUT = ROOT / "steps/030-submit-avatar-renders-run/output"
SEGMENTS = ("intro", "body", "conclusion")


def die(m): raise SystemExit("✖ " + m)


def infer_title(arg):
    if arg:
        return arg
    cands = sorted(S030_OUT.glob("*.heygen-manifest.json"))
    if not cands:
        die(f"can't infer video title — run step 030 first (no manifest in {S030_OUT})")
    return cands[0].name.split(".heygen-manifest.json")[0]


def main():
    title = infer_title(sys.argv[1] if len(sys.argv) > 1 else None)
    VIDEOS.mkdir(parents=True, exist_ok=True)
    present = missing = 0
    print(f"video: {title} · drop downloaded .mp4s in {VIDEOS}\n")
    for seg in SEGMENTS:
        f = VIDEOS / f"{seg}.mp4"
        ok = f.exists() and f.stat().st_size > 0
        present += ok; missing += (not ok)
        print(f"  {'✓' if ok else '✗'} {seg}.mp4")
    print(f"\n{present} present, {missing} missing")
    if missing:
        print("→ download the ✗ files from HeyGen into output/videos/, then re-run check.py")
        sys.exit(1)


if __name__ == "__main__":
    main()
