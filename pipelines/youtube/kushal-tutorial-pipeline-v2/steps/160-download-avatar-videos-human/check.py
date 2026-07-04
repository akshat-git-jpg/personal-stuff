#!/usr/bin/env python3
"""
Step 160 — download checklist.  helper for the [HUMAN] gate.

Reads step 150's HeyGen manifest (the list of submitted renders) and reports which avatar videos
are already in this step's output/videos/ and which are still missing — so you know exactly what
to download from HeyGen and can confirm you dropped them all in.

  python3 check.py [<base>]

Expects each video named <job-name>.mp4 (e.g. BODY_2__a4__intro.mp4, BODY_2__a3__corner-p01.mp4) —
the same names step 150 recorded in the manifest and step 170 looks for. Exit 0 when all present.
"""
import sys, json, pathlib

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]                                       # kushal-tutorial-pipeline-v2/
VIDEOS = HERE / "output" / "videos"
S90_OUT = ROOT / "steps/150-submit-avatar-videos-run/output"


def die(m): raise SystemExit("✖ " + m)


def infer_base(arg):
    if arg:
        return arg
    cands = sorted(S90_OUT.glob("*.heygen-manifest.json"))
    if not cands:
        die(f"can't infer <base> — run step 150 submit first (no manifest in {S90_OUT})")
    return cands[0].name.split(".heygen-manifest.json")[0]


def main():
    base = infer_base(sys.argv[1] if len(sys.argv) > 1 else None)
    mpath = S90_OUT / f"{base}.heygen-manifest.json"
    if not mpath.exists():
        die(f"no manifest for {base!r} — run step 150 submit first ({mpath})")
    jobs = json.loads(mpath.read_text()).get("jobs", [])
    if not jobs:
        die("manifest has no jobs — run step 150 submit first")

    VIDEOS.mkdir(parents=True, exist_ok=True)
    present = missing = 0
    print(f"video: {base} · drop downloaded .mp4s in {VIDEOS}\n")
    for flow in ("a4", "a3"):
        fjobs = [j for j in jobs if j["flow"] == flow]
        if not fjobs:
            continue
        label = "A4 full-screen blocks" if flow == "a4" else "A3 corner parts"
        print(f"{label}:")
        for j in fjobs:
            f = VIDEOS / f"{j['name']}.mp4"
            ok = f.exists() and f.stat().st_size > 0
            present += ok; missing += (not ok)
            print(f"  {'✓' if ok else '✗'} {j['name']}.mp4")
        print()
    print(f"{present} present, {missing} missing")
    if missing:
        print("→ download the ✗ files from HeyGen into output/videos/, then re-run check.py")
        sys.exit(1)
    print("✓ all avatar videos present — step 170 can package them")


if __name__ == "__main__":
    main()
