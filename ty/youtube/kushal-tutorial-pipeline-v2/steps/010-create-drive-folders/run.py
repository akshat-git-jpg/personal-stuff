#!/usr/bin/env python3
"""
Step 010 — create the Drive handoff folder skeleton.  [RUN]  (first step)

Makes the empty folder tree in Google Drive under "video production" up front, so the structure
exists from day one (the team can drop the raw recording / brief in early) and step 170 only has to
UPLOAD files into folders that already exist — it never creates folders.

Creates, under <drive-root> (default "video production"):

  <title>/
    script-writer/{input, output}
    video-editor/
      input/{full-block-spokesperson, talking-head-spokesperson, plan, audio, screen-recording}
      output/

  python3 run.py --title "Video Title" [--account EMAIL] [--drive-root "video production"]

Out: output/<title>.drive-folders.json — maps each subfolder (relative path) to its Drive id.
     Step 170 reads this to upload each produced file into the right existing folder.

Idempotent: re-running finds the existing folders (pp-drive ensure-folder is find-or-create).
"""
import sys, json, argparse, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]          # kushal-tutorial-pipeline-v2/
sys.path.insert(0, str(ROOT))
from lib import drive                                        # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "output"

# The handoff tree (relative to <title>/). Order matters: a parent is always listed before its
# children, so its id is known by the time we create the child.
TREE = [
    "script-writer",
    "script-writer/input",
    "script-writer/output",
    "video-editor",
    "video-editor/input",
    "video-editor/input/full-block-spokesperson",
    "video-editor/input/talking-head-spokesperson",
    "video-editor/input/plan",
    "video-editor/input/audio",
    "video-editor/input/screen-recording",
    "video-editor/output",
]


def safe(name):
    return "".join(c if c.isalnum() or c in " -_." else "_" for c in name).strip() or "untitled"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--title", required=True, help="video title — names the top folder in Drive")
    ap.add_argument("--account", default="kushalbakliwal25@gmail.com",
                    help="Google account that owns the folders (default: kushalbakliwal25@gmail.com)")
    ap.add_argument("--drive-root", default="video production",
                    help='Drive folder to create the tree inside (default: "video production")')
    ap.add_argument("--drive-cli", default=None,
                    help="path to pp-drive (default: PATH, then the sibling personal-stuff repo)")
    a = ap.parse_args()

    title = safe(a.title)
    cli = drive.resolve_cli(a.drive_cli)
    print(f"↻ creating Drive skeleton (account: {a.account})")

    vp = drive.ensure_folder(cli, a.drive_root, a.account, "root")
    print(f"  📂 {a.drive_root} → {vp}")
    folders = {".": drive.ensure_folder(cli, title, a.account, vp)}
    print(f"  📁 {title} → {folders['.']}")

    for rel in TREE:
        parent_rel = rel.rsplit("/", 1)[0] if "/" in rel else "."
        name = rel.rsplit("/", 1)[-1]
        folders[rel] = drive.ensure_folder(cli, name, a.account, folders[parent_rel])
        print(f"  📁 {title}/{rel}")

    manifest = {"title": title, "drive_root": a.drive_root, "account": a.account,
                "title_folder_id": folders["."], "link": drive.link(folders["."]),
                "folders": folders}
    OUT.mkdir(parents=True, exist_ok=True)
    mpath = OUT / f"{title}.drive-folders.json"
    mpath.write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    print(f"✓ {len(folders)} folders ready → {manifest['link']}")
    print(f"  manifest: {mpath}")
    print("→ next: run the pipeline; step 170 --drive uploads files into this structure")


if __name__ == "__main__":
    main()
