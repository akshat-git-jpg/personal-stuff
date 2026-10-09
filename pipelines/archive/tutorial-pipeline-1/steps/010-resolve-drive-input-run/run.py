#!/usr/bin/env python3
"""
Step 010 — resolve the Drive input.  [RUN]  (first step)

Takes a Drive FOLDER link, works out the video's type (" @ g1" or " @ g2" suffix on the folder name) and
title, then downloads intro.mp4 / body.mp4 / conclusion.mp4 into ./output/ — read from an
`input/` subfolder if one exists, else from the folder itself (flat fallback).

  python3 run.py --drive-link "https://drive.google.com/drive/folders/<id>" [--account EMAIL]

Out: output/<title>.input-manifest.json — {folder_id, type, video_title, files: {intro, body, conclusion}}
     output/intro.mp4, output/body.mp4, output/conclusion.mp4
"""
import sys, re, json, argparse, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]            # tutorial-pipeline-1/
sys.path.insert(0, str(ROOT))
from lib import drive                                           # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "output"
SEGMENTS = ("intro", "body", "conclusion")
FOLDER_ID_RE = re.compile(r"/folders/([a-zA-Z0-9_-]+)")
TYPE_RE = re.compile(r"\s*@\s*(g1|g2)$", re.IGNORECASE)


def die(m): raise SystemExit("✖ " + m)


def parse_folder_id(link):
    m = FOLDER_ID_RE.search(link)
    if not m:
        die(f"couldn't find a folder id in {link!r} (expected .../folders/<id>)")
    return m.group(1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--drive-link", required=True)
    ap.add_argument("--account", default="kushalbakliwal25@gmail.com")
    ap.add_argument("--drive-cli", default=None)
    a = ap.parse_args()

    cli = drive.resolve_cli(a.drive_cli)
    folder_id = parse_folder_id(a.drive_link)
    fid, name, mime = drive.stat(cli, folder_id, a.account)
    if mime != "application/vnd.google-apps.folder":
        die(f"{folder_id} is not a folder ({mime})")

    m = TYPE_RE.search(name)
    if not m:
        die(f"folder name {name!r} doesn't end in ' @ g1' or ' @ g2' — can't pick an avatar mapping")
    vtype = m.group(1).lower()
    video_title = TYPE_RE.sub("", name)

    print(f"↻ folder: {name} → type={vtype} title={video_title!r}")
    input_id = drive.find_child_folder(cli, folder_id, "input", a.account)
    segments_folder_id = input_id or folder_id
    print(f"  📁 reading segments from {'input/' if input_id else '(folder root, no input/ subfolder)'}")
    children = drive.list_folder(cli, segments_folder_id, a.account)
    by_name = {c["name"].lower(): c for c in children}

    OUT.mkdir(parents=True, exist_ok=True)
    files = {}
    for seg in SEGMENTS:
        key = f"{seg}.mp4"
        c = by_name.get(key)
        if not c:
            where = "input/" if input_id else name
            die(f"no {key!r} in Drive folder {where!r}")
        dest = OUT / key
        drive.download(cli, c["id"], a.account, dest)
        files[seg] = str(dest)
        print(f"  ⬇ {key} → {dest}")

    manifest = {"folder_id": folder_id, "type": vtype, "video_title": video_title, "files": files}
    mpath = OUT / f"{video_title}.input-manifest.json"
    mpath.write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    print(f"✓ resolved {video_title} ({vtype}) — manifest: {mpath}")


if __name__ == "__main__":
    main()
