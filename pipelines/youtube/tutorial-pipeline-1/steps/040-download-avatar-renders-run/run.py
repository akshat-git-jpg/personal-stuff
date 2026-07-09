#!/usr/bin/env python3
"""
Step 040 — wait + download finished HeyGen renders.  [RUN]  (no polling — one timed attempt)

  python3 run.py [<video_title>] [--buffer SECONDS]

Reads:  ../030-submit-avatar-renders-run/output/<video_title>.heygen-manifest.json
        ../020-extract-audio-run/output/<video_title>.audio-manifest.json  (each segment's clip length)
Writes: output/videos/<segment>.mp4   (idempotent — skips any .mp4 already present)

Anti-ban posture: NO status polling. For each pending segment this waits once — the segment's own
clip duration plus a fixed render buffer — then makes exactly ONE download attempt. If HeyGen isn't
done yet, that segment is reported pending and left alone; re-run this script later (already-
downloaded segments are skipped, so re-running only retries what's still missing).
"""
import sys, json, time, argparse, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from lib import heygen, audio                                     # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
VIDEOS = HERE / "output" / "videos"
S020_OUT = ROOT / "steps/020-extract-audio-run/output"
S030_OUT = ROOT / "steps/030-submit-avatar-renders-run/output"

DEFAULT_BUFFER = 60  # seconds of render overhead on top of clip length — a heuristic, not a poll


def die(m): raise SystemExit("✖ " + m)


def infer_title(arg):
    if arg:
        return arg
    cands = sorted(S030_OUT.glob("*.heygen-manifest.json"))
    if not cands:
        die(f"can't infer video title — run step 030 first (no manifest in {S030_OUT})")
    return cands[0].name.split(".heygen-manifest.json")[0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video_title", nargs="?")
    ap.add_argument("--buffer", type=float, default=DEFAULT_BUFFER,
                     help=f"extra seconds to wait on top of each clip's own duration (default {DEFAULT_BUFFER})")
    a = ap.parse_args()

    title = infer_title(a.video_title)
    mpath = S030_OUT / f"{title}.heygen-manifest.json"
    if not mpath.exists():
        die(f"no manifest for {title!r} — run step 030 first ({mpath})")
    jobs = json.loads(mpath.read_text())["jobs"]

    apath = S020_OUT / f"{title}.audio-manifest.json"
    wavs = json.loads(apath.read_text())["wavs"] if apath.exists() else {}

    cli = heygen.resolve_cli()
    VIDEOS.mkdir(parents=True, exist_ok=True)
    done = pending = 0
    for j in jobs:
        dest = VIDEOS / f"{j['segment']}.mp4"
        if dest.exists() and dest.stat().st_size > 0:
            print(f"  ✓ {dest.name} already downloaded")
            done += 1
            continue
        if not j.get("video_id"):
            pending += 1
            print(f"  … {j['segment']} has no video_id yet (submit not wired / not finished)")
            continue

        clip_len = audio.dur(wavs[j["segment"]]) if j["segment"] in wavs else 0.0
        wait = clip_len + a.buffer
        print(f"  ⏱ {j['segment']}: waiting {audio.mmss(wait)} "
              f"(clip {audio.mmss(clip_len)} + {a.buffer:.0f}s buffer), then one download attempt …")
        time.sleep(wait)

        if heygen.download(cli, j["video_id"], dest):
            done += 1; print(f"  ✓ {dest.name}")
        else:
            pending += 1
            print(f"  … {j['segment']} still not ready after the timed wait — no retry, try again later")

    print(f"\n✓ downloaded {done}, {pending} pending.")
    print("→ step 050 packages + uploads them" if not pending else
          "→ re-run this script later for the pending segment(s)")


if __name__ == "__main__":
    main()
