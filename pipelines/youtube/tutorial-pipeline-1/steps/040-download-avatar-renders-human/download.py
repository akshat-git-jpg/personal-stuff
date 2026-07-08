#!/usr/bin/env python3
"""
Step 040 — download finished HeyGen renders.  [RUN] side of the [HUMAN] gate.

  python3 download.py [<video_title>]

Reads:  ../030-submit-avatar-renders-run/output/<video_title>.heygen-manifest.json
Writes: output/videos/<segment>.mp4   (idempotent — skips any .mp4 already present)
"""
import sys, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from lib import heygen                                            # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
VIDEOS = HERE / "output" / "videos"
S030_OUT = ROOT / "steps/030-submit-avatar-renders-run/output"


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
    mpath = S030_OUT / f"{title}.heygen-manifest.json"
    if not mpath.exists():
        die(f"no manifest for {title!r} — run step 030 first ({mpath})")
    jobs = json.loads(mpath.read_text())["jobs"]

    cli = heygen.resolve_cli()
    VIDEOS.mkdir(parents=True, exist_ok=True)
    done = pending = 0
    for j in jobs:
        dest = VIDEOS / f"{j['segment']}.mp4"
        if dest.exists() and dest.stat().st_size > 0:
            continue
        if not j.get("video_id"):
            pending += 1
            print(f"   … {j['segment']} has no video_id yet (submit not wired / not finished)")
            continue
        if heygen.download(cli, j["video_id"], dest):
            done += 1; print(f"   ✓ {dest.name}")
        else:
            pending += 1; print(f"   … {j['segment']} not ready yet")
    print(f"✓ downloaded {done}, {pending} pending.")
    print("→ run check.py to confirm all 3 are present, then step 050 packages + uploads them")


if __name__ == "__main__":
    main()
