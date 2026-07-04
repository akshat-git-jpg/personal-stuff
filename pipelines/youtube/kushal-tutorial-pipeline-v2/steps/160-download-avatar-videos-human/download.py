#!/usr/bin/env python3
"""
Step 160 — download finished HeyGen renders (scripted path).  [RUN] side of the [HUMAN] gate.

Step 150 submitted the renders (no polling). Once HeyGen shows them finished, this pulls each by its
video_id into output/videos/ — IF the web-session fetch endpoint is wired
(lib/heygen.py WebSessionBackend.fetch). Until then it reports stub-not-wired and you download
manually from HeyGen (see README). Either way, run check.py to confirm what landed.

  python3 download.py [<base>] [--flow a4|a3|both]

Reads:  ../150-submit-avatar-videos-run/output/<base>.heygen-manifest.json
Writes: output/videos/<job-name>.mp4   (idempotent — skips any .mp4 already present)
"""
import sys, json, argparse, pathlib

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]                                       # kushal-tutorial-pipeline-v2/
sys.path.insert(0, str(ROOT))
from lib import heygen                                        # noqa: E402
from shared import heygen_config as C                         # noqa: E402

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


def download_flow(flow, jobs, usage_log):
    fjobs = [j for j in jobs if j["flow"] == flow]
    if not fjobs:
        return 0, 0
    backend = heygen.get_backend(C.FLOWS[flow]["backend"], C.FLOWS[flow], ROOT)
    heygen.usage_snapshot(C.USAGE, usage_log, f"{flow} download before")
    done = pending = 0
    for n, j in enumerate(fjobs):
        dest = VIDEOS / f"{j['name']}.mp4"
        if dest.exists() and dest.stat().st_size > 0:        # already here (scripted or manual)
            continue
        if not j.get("video_id"):                            # never got a render id → manual download
            pending += 1; print(f"   … {j['name']} has no video_id (download manually)"); continue
        if n:
            heygen.human_delay(C.PACING, n)
        try:
            if backend.fetch(j["video_id"], dest):
                done += 1; print(f"   ✓ {dest.name}")
            else:
                pending += 1; print(f"   … {j['name']} not ready yet")
        except NotImplementedError as e:
            pending += 1; print(f"     [stub] {e}")
    heygen.usage_diff(C.USAGE, usage_log, f"{flow} download after")
    return done, pending


def main():
    ap = argparse.ArgumentParser(description="Download finished HeyGen renders into output/videos/")
    ap.add_argument("base", nargs="?")
    ap.add_argument("--flow", choices=["a4", "a3", "both"], default="both")
    a = ap.parse_args()

    base = infer_base(a.base)
    mpath = S90_OUT / f"{base}.heygen-manifest.json"
    if not mpath.exists():
        die(f"no manifest for {base!r} — run step 150 submit first ({mpath})")
    jobs = json.loads(mpath.read_text()).get("jobs", [])
    VIDEOS.mkdir(parents=True, exist_ok=True)
    usage_log = HERE / "output" / f"{base}.usage-log.md"

    flows = ("a4", "a3") if a.flow == "both" else (a.flow,)
    print(f"video: {base} · download {', '.join(flows)} → {VIDEOS}")
    done = pending = 0
    for flow in flows:
        d, p = download_flow(flow, jobs, usage_log)
        done += d; pending += p
    print(f"✓ downloaded {done}, {pending} pending. Parts stay SEPARATE (editor combines).")
    print("→ run check.py to confirm all videos are present, then step 170 packages them")


if __name__ == "__main__":
    main()
