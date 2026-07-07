#!/usr/bin/env python3
"""
Step 7/010 — package the final MP4 + thumbnail for handoff.  [RUN]  (final step)

  python3 run.py [<base>] [--drive] [--overwrite]

In:  ../../5-final-video-sync/010-mux-final-video-run/output/<base>.final.mp4
     ../../6-thumbnail/010-generate-thumbnail-opus/output/<base>.thumbnail.jpg
Out: copies both into the LOCAL output folder step 0-input/010 already
     created (read from its manifest's "local_output" field) — NOT a real
     YouTube API upload, purely local/Drive packaging.

With --drive, both files are also uploaded into the Drive "output" folder
step 0-input/010 already created (read from the manifest's
drive_folder_ids.output). This step never creates folders.
"""
import sys, json, shutil, argparse, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]          # explainer-videos-pipeline-1/
sys.path.insert(0, str(ROOT))
from lib import drive                                        # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
MANIFEST_DIR = ROOT / "0-input/010-create-drive-folders-run/output"
VIDEO_PREV = ROOT / "5-final-video-sync/010-mux-final-video-run/output"
THUMB_PREV = ROOT / "6-thumbnail/010-generate-thumbnail-opus/output"


def die(m): raise SystemExit("✖ " + m)


def infer_base():
    cands = sorted(VIDEO_PREV.glob("*.final.mp4"))
    if not cands:
        die(f"no final video found at {VIDEO_PREV} — run 5-final-video-sync/010 first")
    return cands[-1].name.split(".final.mp4")[0]


def load_manifest(base):
    mpath = MANIFEST_DIR / f"{base}.manifest.json"
    if not mpath.exists():
        die(f"no manifest for {base!r} at {mpath} — run 0-input/010 first")
    return json.loads(mpath.read_text())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base", nargs="?", help="topic base (default: infer from 5-final-video-sync/010)")
    ap.add_argument("--drive", action="store_true", help="also upload into the Drive output folder")
    ap.add_argument("--overwrite", action="store_true", help="with --drive, replace same-named files already in Drive")
    ap.add_argument("--drive-cli", default=None)
    a = ap.parse_args()

    base = a.base or infer_base()
    manifest = load_manifest(base)

    video = VIDEO_PREV / f"{base}.final.mp4"
    thumb = THUMB_PREV / f"{base}.thumbnail.jpg"

    local_output = pathlib.Path(manifest["local_output"])
    local_output.mkdir(parents=True, exist_ok=True)

    log = []
    for src, label in [(video, "final video"), (thumb, "thumbnail")]:
        if src.exists():
            shutil.copy2(src, local_output / src.name)
            log.append((label, 1, str(local_output / src.name)))
        else:
            log.append((label, 0, "(missing)"))

    print(f"✓ packaged → {local_output}")
    for label, n, where in log:
        print(f"  {'✓' if n else '—'} {label}: {where}")
    missing = [l for l, n, _ in log if not n]
    if missing:
        print(f"⚠ not yet present: {', '.join(missing)} (run the producing step first)")

    if a.drive:
        cli = drive.resolve_cli(a.drive_cli)
        out_folder_id = manifest["drive_folder_ids"]["output"]
        account = manifest["account"]
        print(f"↻ uploading into Drive output folder (account: {account})")
        for src, label in [(video, "final video"), (thumb, "thumbnail")]:
            if not src.exists():
                continue
            result = drive.upload(cli, src, out_folder_id, account, overwrite=a.overwrite)
            print(f"  ⬆ {label}: {result}")
        print(f"✓ Drive: {manifest['drive_link']}")


if __name__ == "__main__":
    main()
