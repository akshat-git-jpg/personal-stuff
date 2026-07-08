#!/usr/bin/env python3
"""
Step 030 — submit HeyGen avatar renders.  [RUN]  (submits only — NO polling)

  python3 run.py [<video_title>]

Reads:  ../020-extract-audio-run/output/<video_title>.audio-manifest.json
Writes: output/<video_title>.heygen-manifest.json
"""
import sys, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from lib import heygen                                            # noqa: E402
from shared import avatar_mapping as M                            # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "output"
S020_OUT = ROOT / "steps/020-extract-audio-run/output"

PACING = {"min_gap": 45, "max_gap": 150, "settle_every": 5, "settle_gap": 600}


def die(m): raise SystemExit("✖ " + m)


def infer_title(arg):
    if arg:
        return arg
    cands = sorted(S020_OUT.glob("*.audio-manifest.json"))
    if not cands:
        die(f"can't infer video title — run step 020 first (no manifest in {S020_OUT})")
    return cands[0].name.split(".audio-manifest.json")[0]


def main():
    title = infer_title(sys.argv[1] if len(sys.argv) > 1 else None)
    mpath = S020_OUT / f"{title}.audio-manifest.json"
    if not mpath.exists():
        die(f"no manifest for {title!r} — run step 020 first ({mpath})")
    audio_man = json.loads(mpath.read_text())
    vtype = audio_man["type"]
    if vtype not in M.TYPES:
        die(f"unknown type {vtype!r} — add it to shared/avatar_mapping.py TYPES")

    cli = heygen.resolve_cli()
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = []
    print(f"video: {title} · type: {vtype} · submit (no polling)")
    for n, (seg, wav) in enumerate(audio_man["wavs"].items()):
        engine = M.SEGMENT_ENGINE[seg]
        avatar_id = M.TYPES[vtype][f"{engine}_avatar_id"]
        if n:
            heygen.human_delay(PACING, n)
        print(f"  → submit {seg} on {engine} (avatar {avatar_id})")
        res = heygen.submit(cli, wav, avatar_id, engine, title=f"{title}__{seg}")
        jobs.append({"segment": seg, "engine": engine, "avatar_id": avatar_id, "audio": wav, **res})
        vid = f" video_id={res['video_id']}" if res.get("video_id") else ""
        print(f"    {res.get('status')}{vid}")

    manifest = {"video_title": title, "type": vtype, "jobs": jobs}
    mpath_out = OUT / f"{title}.heygen-manifest.json"
    mpath_out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    real = sum(1 for j in jobs if j.get("status") == "submitted")
    print(f"✓ {real}/{len(jobs)} submitted for real. manifest: {mpath_out}")
    print("  → check HeyGen yourself; when renders finish, download in step 040")


if __name__ == "__main__":
    main()
