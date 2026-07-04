#!/usr/bin/env python3
"""
Step 170 — package everything into the Drive-style handoff folders.  [RUN]  (final step)

Mirrors the layout you keep in Drive under "video production":

  <title>/
    script-writer/
      input/                          (you fill: raw recording / brief)
      output/                         (they produce: the script)
    video-editor/
      input/
        full-block-spokesperson/      ← A4 full-screen avatar videos (one per block)
        talking-head-spokesperson/    ← A3 corner avatar videos (the ≤7-min parts)
        plan/                         ← visual plan + avatar script + SRT/timestamps
        audio/                        ← the full voiceover (one file)
        screen-recording/             ← you drop the raw screen recording here
      output/                         (they produce: the edited video / review)

  python3 run.py [<base>] [--title "Video Title"]
  python3 run.py [<base>] --title "Video Title" --drive   # also upload files into Drive

Copies what the pipeline has produced into video-editor/input; notes anything still missing
(e.g. avatar videos not downloaded yet).

With --drive, each produced file is uploaded into the Drive folder structure that **step 010
already created** (read from step 010's <title>.drive-folders.json manifest). This step never
creates folders — run step 010 first with the same --title. Pass --overwrite to replace files
already in Drive.
"""
import sys, json, shutil, argparse, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]          # kushal-tutorial-pipeline-v2/
sys.path.insert(0, str(ROOT))
from lib import drive                                        # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "output"
S = ROOT / "steps"
S05_OUT = S / "010-create-drive-folders-run/output"


def die(m): raise SystemExit("✖ " + m)


def infer_base(arg):
    if arg:
        return arg
    cands = sorted((S / "100-trim-silence-run/output").glob("*.voice.trim.wav"))
    if not cands:
        die("can't infer <base> — pass it (or run the pipeline first)")
    return cands[0].name.split(".voice.trim.wav")[0]


def safe(name):
    return "".join(c if c.isalnum() or c in " -_." else "_" for c in name).strip() or "untitled"


def copy_glob(srcdir, pattern, dstdir, log, label):
    files = sorted(pathlib.Path(srcdir).glob(pattern)) if pathlib.Path(srcdir).exists() else []
    dstdir.mkdir(parents=True, exist_ok=True)
    for f in files:
        shutil.copy2(f, dstdir / f.name)
    log.append((label, len(files), str(dstdir.relative_to(OUT))))
    return len(files)


def load_manifest(title, title_arg):
    """Load step 010's folder-id manifest for this title (it owns folder creation)."""
    mpath = S05_OUT / f"{title}.drive-folders.json"
    if not mpath.exists():
        avail = sorted(p.name.split(".drive-folders.json")[0]
                       for p in S05_OUT.glob("*.drive-folders.json")) if S05_OUT.exists() else []
        die(f"no Drive folders for {title!r} — run step 010 first:\n"
            f"  python3 ../010-create-drive-folders-run/run.py --title {title_arg!r}\n"
            f"  available manifests: {', '.join(avail) or '(none)'}")
    return json.loads(mpath.read_text())


def upload_into_existing(cli, root, manifest, overwrite):
    """Upload each produced file into its pre-made Drive folder (step 010). Creates no folders."""
    account = manifest["account"]
    folders = manifest["folders"]
    print(f"↻ uploading into Drive structure {manifest['title']!r} (account: {account})")
    n_up = n_skip = n_miss = 0
    for f in sorted(root.rglob("*")):
        if not f.is_file():
            continue
        parent_rel = f.parent.relative_to(root).as_posix()      # "." for top-level files
        fid = folders.get(parent_rel)
        if not fid:
            print(f"  ⚠ no Drive folder for {parent_rel}/ — skipped {f.name}"); n_miss += 1; continue
        out = drive.upload(cli, f, fid, account, overwrite=overwrite)
        wrote = "uploaded" in out
        n_up += wrote; n_skip += (0 if wrote else 1)
        print(f"  {'⬆' if wrote else '·'} {parent_rel}/{f.name}")
    print(f"✓ Drive: {n_up} uploaded, {n_skip} skipped"
          + (f", {n_miss} no-folder" if n_miss else "") + f" → {manifest['link']}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base", nargs="?")
    ap.add_argument("--title", default=None, help="topic/title for the folder (default: <base>)")
    ap.add_argument("--drive", action="store_true",
                    help="upload produced files into the Drive folders step 010 created")
    ap.add_argument("--drive-cli", default=None,
                    help="path to pp-drive (default: PATH, then in-tree personal-stuff/tooling/cli/drive)")
    ap.add_argument("--overwrite", action="store_true",
                    help="with --drive, replace same-named files already in Drive")
    a = ap.parse_args()
    base = infer_base(a.base)
    title = safe(a.title or base)

    root = OUT / title
    ve_in = root / "video-editor" / "input"
    for d in [root / "script-writer/input", root / "script-writer/output",
              ve_in, root / "video-editor/output"]:
        d.mkdir(parents=True, exist_ok=True)

    log = []
    # avatar videos (from step 160 download — may be empty if not downloaded yet)
    copy_glob(S / "160-download-avatar-videos-human/output/videos", f"{base}__a4__*.mp4",
              ve_in / "full-block-spokesperson", log, "A4 full-screen videos")
    copy_glob(S / "160-download-avatar-videos-human/output/videos", f"{base}__a3__*.mp4",
              ve_in / "talking-head-spokesperson", log, "A3 corner videos")
    # plan + reference docs
    plan = ve_in / "plan"; plan.mkdir(parents=True, exist_ok=True)
    for src, label in [
        (S / f"130-plan-visuals-sonnet/output/{base}.visual-plan.md", "visual plan"),
        (S / f"080-synthesize-voice-run/output/{base}.avatar-fullscreen.md", "avatar script"),
        (S / f"120-make-timestamped-transcript-run/output/{base}.srt", "subtitles (srt)"),
        (S / f"120-make-timestamped-transcript-run/output/{base}.timestamps.txt", "timestamped transcript"),
    ]:
        if src.exists():
            shutil.copy2(src, plan / src.name); log.append((label, 1, "video-editor/input/plan"))
        else:
            log.append((label, 0, "(missing)"))
    # the full voiceover
    copy_glob(S / "100-trim-silence-run/output", f"{base}.voice.trim.wav", ve_in / "audio", log, "voiceover (full)")
    # screen recording — human drops it here
    sr = ve_in / "screen-recording"; sr.mkdir(parents=True, exist_ok=True)
    (sr / "PUT-SCREEN-RECORDING-HERE.txt").write_text(
        "Drop the raw screen recording for this video here before handing off to the editor.\n")

    # handoff summary
    lines = [f"# Handoff — {title}", "", "Contents of video-editor/input:", ""]
    for label, n, where in log:
        mark = "✓" if n else "—"
        lines.append(f"- {mark} {label}: {n} → {where}")
    lines += ["", "Add the raw **screen recording** to video-editor/input/screen-recording/.",
              "Files are uploaded into Drive → video production by `run.py --drive` "
              "(folders are pre-created by step 010).", ""]
    (root / "HANDOFF.md").write_text("\n".join(lines))

    print(f"✓ packaged → {root}")
    for label, n, where in log:
        print(f"  {'✓' if n else '—'} {label}: {n}")
    print(f"  see {root / 'HANDOFF.md'}")
    missing = [l for l, n, _ in log if not n]
    if missing:
        print(f"⚠ not yet present: {', '.join(missing)} (run the producing step first)")

    if a.drive:
        manifest = load_manifest(title, a.title or base)
        cli = drive.resolve_cli(a.drive_cli)
        upload_into_existing(cli, root, manifest, a.overwrite)


if __name__ == "__main__":
    main()
