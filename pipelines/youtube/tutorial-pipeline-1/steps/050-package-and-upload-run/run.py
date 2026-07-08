#!/usr/bin/env python3
"""
Step 050 — package spokesperson clips + upload back to Drive.  [RUN]  (last step)

  python3 run.py [<video_title>] [--account EMAIL]

Reads:  ../040-download-avatar-renders-human/output/videos/{intro,body,conclusion}.mp4
        ../010-resolve-drive-input-run/output/<video_title>.input-manifest.json  (for folder_id)
Writes: output/spokesperson_intro.mp4, output/spokesperson_body.mp4, output/spokesperson_conclusion.mp4
        + uploads each into an output/ subfolder of the source Drive folder (find-or-created)
"""
import sys, json, shutil, argparse, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from lib import drive                                             # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "output"
S010_OUT = ROOT / "steps/010-resolve-drive-input-run/output"
S040_VIDEOS = ROOT / "steps/040-download-avatar-renders-human/output/videos"
SEGMENTS = ("intro", "body", "conclusion")


def die(m): raise SystemExit("✖ " + m)


def infer_title(arg):
    if arg:
        return arg
    cands = sorted(S010_OUT.glob("*.input-manifest.json"))
    if not cands:
        die(f"can't infer video title — run step 010 first (no manifest in {S010_OUT})")
    return cands[0].name.split(".input-manifest.json")[0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video_title", nargs="?")
    ap.add_argument("--account", default="kushalbakliwal25@gmail.com")
    ap.add_argument("--drive-cli", default=None)
    a = ap.parse_args()

    title = infer_title(a.video_title)
    input_manifest = json.loads((S010_OUT / f"{title}.input-manifest.json").read_text())
    folder_id = input_manifest["folder_id"]

    cli = drive.resolve_cli(a.drive_cli)
    output_id = drive.ensure_folder(cli, "output", folder_id, a.account)
    OUT.mkdir(parents=True, exist_ok=True)
    for seg in SEGMENTS:
        src = S040_VIDEOS / f"{seg}.mp4"
        if not src.exists():
            die(f"missing {src} — run step 040 (and its check.py) first")
        dest = OUT / f"spokesperson_{seg}.mp4"
        shutil.copyfile(src, dest)
        drive.upload(cli, dest, output_id, a.account, overwrite=True)
        print(f"  ⬆ {dest.name} → Drive folder output/")

    print(f"✓ packaged + uploaded 3 spokesperson clips for {title} → {drive.link(output_id)}")


if __name__ == "__main__":
    main()
