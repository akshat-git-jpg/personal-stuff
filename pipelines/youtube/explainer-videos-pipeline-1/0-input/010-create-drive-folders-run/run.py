#!/usr/bin/env python3
"""
Step 0/010 — create the Drive + local topic folder skeleton.  [RUN]  (first step)

Creates, under the FIXED root Drive folder (owner-supplied, not looked up by name):

  <topic>/
    input/
    output/

  python3 run.py --topic "Video Topic" [--account EMAIL] [--drive-cli PATH]

Out: output/<base>.manifest.json — the per-topic record every later step in this
     pipeline appends to (script slug, motion-graphics slug, thumbnail slug,
     voiceover duration, render duration — filled in as each stage runs).

Idempotent: re-running finds the existing folders (pp-drive ensure-folder is
find-or-create) and reuses the existing manifest instead of overwriting fields
other steps have already filled in.
"""
import sys, json, argparse, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]          # explainer-videos-pipeline-1/
sys.path.insert(0, str(ROOT))
from lib import drive                                        # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "output"

FIXED_ROOT_FOLDER_ID = "1nnTXY8sSXOVyHxHX1aPPUR3gQxtpcWFO"    # owner's fixed Drive root


def safe(name):
    return "".join(c if c.isalnum() or c in " -_." else "_" for c in name).strip() or "untitled"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--topic", required=True, help="video topic — names the Drive + local folder")
    ap.add_argument("--account", default="kushalbakliwal25@gmail.com",
                    help="Google account that owns the folders")
    ap.add_argument("--drive-cli", default=None,
                    help="path to pp-drive (default: PATH, then in-tree personal-stuff/tooling/cli/drive)")
    a = ap.parse_args()

    base = safe(a.topic)
    cli = drive.resolve_cli(a.drive_cli)
    OUT.mkdir(parents=True, exist_ok=True)
    mpath = OUT / f"{base}.manifest.json"

    print(f"↻ creating Drive skeleton for {base!r} (account: {a.account})")
    topic_id = drive.ensure_folder(cli, base, a.account, FIXED_ROOT_FOLDER_ID)
    input_id = drive.ensure_folder(cli, "input", a.account, topic_id)
    output_id = drive.ensure_folder(cli, "output", a.account, topic_id)

    local_input = OUT / base / "input"
    local_output = OUT / base / "output"
    local_input.mkdir(parents=True, exist_ok=True)
    local_output.mkdir(parents=True, exist_ok=True)

    manifest = {}
    if mpath.exists():
        manifest = json.loads(mpath.read_text())  # preserve fields other steps already filled in
    manifest.update({
        "topic": a.topic,
        "base": base,
        "account": a.account,
        "drive_folder_ids": {"topic": topic_id, "input": input_id, "output": output_id},
        "drive_link": drive.link(topic_id),
        "local_input": str(local_input),
        "local_output": str(local_output),
    })
    mpath.write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    print(f"✓ {base}/{{input,output}} ready → {manifest['drive_link']}")
    print(f"  local: {local_input} , {local_output}")
    print(f"  manifest: {mpath}")


if __name__ == "__main__":
    main()
