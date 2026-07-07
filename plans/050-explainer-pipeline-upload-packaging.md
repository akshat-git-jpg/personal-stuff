---
executor: agy
model:
test_cmd: python3 -m py_compile pipelines/youtube/explainer-videos-pipeline-1/7-upload/010-package-for-handoff-run/run.py
ui:
deploy:
needs: ["048", "049"]
---

# Plan 050: explainer-videos-pipeline-1 — 7-upload stage

## Summary

- **Problem statement**: `7-upload/` is empty. This pipeline needs a final
  packaging step that copies the final MP4 + thumbnail into the topic's
  `output/` folder created by `0-input` — this is packaging/handoff, NOT a
  real YouTube API upload.
- **Goals**: `010-package-for-handoff-run/`: copy the final MP4 + thumbnail
  into `0-input`'s local `output/<base>/output/` folder; optionally upload
  both into the matching Drive folder (`--drive` flag, reusing `lib/drive.py`
  and the manifest's folder ids from `0-input`).
- **Executor proposed**: `agy` (owner's explicit instruction for this whole build).
- **Done criteria**: `run.py` compiles; a synthetic test proves the copy
  logic (using throwaway files standing in for a real final MP4/thumbnail).
- **Stop conditions**: none beyond per-step specifics below.
- **Test / verification for success**: `py_compile` + a synthetic
  copy-only test (no `--drive` flag exercised — that needs a real Drive
  account round-trip, out of scope for this plan's verification).
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5a11eac..HEAD -- pipelines/youtube/explainer-videos-pipeline-1/7-upload`
> Expect empty. STOP if `pipelines/youtube/explainer-videos-pipeline-1/0-input/010-create-drive-folders-run/run.py`
> does not exist yet (plan 044 dependency — this plan reads its manifest shape and its `output/<base>/output/` path).

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (mechanical copy only, mirrors `tutorial-pipeline-2`'s
  step-170 pattern almost exactly)
- **Depends on**: 048, 049
- **Category**: feature
- **Difficulty**: mechanical
- **Planned at**: commit `5a11eac`, 2026-07-07

## Why this matters

This is the pipeline's final handoff point — the point where "a script, a
voiceover, and some rendered graphics" becomes "one folder with a finished
video and thumbnail, ready to actually upload to YouTube by hand." Getting
the reused-manifest-folder-ids path right avoids re-deriving Drive folder ids
that `0-input` already created and stored.

## Current state

- `pipelines/youtube/explainer-videos-pipeline-1/7-upload/` is empty.
- `pipelines/youtube/explainer-videos-pipeline-1/0-input/010-create-drive-folders-run/run.py`
  (from plan 044 — already written in this batch, read it yourself once
  landed) writes `output/<base>.manifest.json` with shape:
  ```json
  {
    "topic": "...", "base": "...", "account": "...",
    "drive_folder_ids": {"topic": "...", "input": "...", "output": "..."},
    "drive_link": "...", "local_input": "...", "local_output": "..."
  }
  ```
  `local_output` is the exact local path (`0-input/010.../output/<base>/output`)
  this plan's step copies the final MP4 + thumbnail INTO. `drive_folder_ids.output`
  is the Drive folder id to upload into when `--drive` is passed.
- `pipelines/youtube/explainer-videos-pipeline-1/5-final-video-sync/010-mux-final-video-run/output/<base>.final.mp4`
  (from plan 048) and
  `pipelines/youtube/explainer-videos-pipeline-1/6-thumbnail/010-generate-thumbnail-opus/output/<base>.thumbnail.jpg`
  (from plan 049) are the two files this step copies.
- `pipelines/youtube/tutorial-pipeline-2/7-final-assembly/170-package-for-handoff-run/run.py`
  (already read in full during the earlier tutorial-pipeline-2 restructure
  work) is the closest exemplar for the `drive.upload()` call shape and the
  `HANDOFF.md`-summary pattern — this plan's version is much simpler (2 files,
  not a whole role/input/output tree) so port only the relevant parts:
  `drive.resolve_cli()`, `drive.upload(cli, file, parent, account, overwrite=...)`,
  and the "log list + missing-items" summary pattern.
- `pipelines/youtube/explainer-videos-pipeline-1/lib/drive.py` (from plan 044)
  has `upload(cli, file, parent, account, name=None, overwrite=False)`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Syntax-check | `python3 -m py_compile pipelines/youtube/explainer-videos-pipeline-1/7-upload/010-package-for-handoff-run/run.py` | exit 0 |
| Confirm folder empty before starting | `find pipelines/youtube/explainer-videos-pipeline-1/7-upload -type f` | zero output |

## Scope

**In scope**:
- `pipelines/youtube/explainer-videos-pipeline-1/7-upload/010-package-for-handoff-run/run.py`
- `pipelines/youtube/explainer-videos-pipeline-1/7-upload/010-package-for-handoff-run/README.md`

**Out of scope**:
- Any real YouTube Data API call — this step is packaging only, never a real
  upload to YouTube itself (owner decision, locked in the design doc).
- A real `--drive` round-trip test — needs a live Drive account; this plan
  verifies the copy-only path with synthetic local files.

## Git workflow

- Branch: `boss/050-explainer-upload-packaging`
- Commit: `feat(explainer-pipeline-1): 7-upload stage (package-for-handoff)` — no AI footers. Do NOT push.

## Steps

### Step 1: `010-package-for-handoff-run/run.py`

```python
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
```

Write `README.md`:

```markdown
# 7/010 · package-for-handoff  ·  [RUN]  (final step)

Copies the final MP4 + thumbnail into the topic's `output/` folder that
`0-input/010` already created. **Not a real YouTube API upload** — pure
local/Drive packaging, mirroring `tutorial-pipeline-2`'s step 170 pattern.

- **Run:** `python3 run.py [<base>] [--drive] [--overwrite]`
- **Pulls from:** `5-final-video-sync/010` (final MP4), `6-thumbnail/010` (thumbnail)
- **Out:** both files copied into `0-input`'s local `output/<base>/output/`;
  with `--drive`, also uploaded into the matching Drive folder (folder ids
  read from `0-input`'s manifest — this step never creates folders).
- **Then:** upload `output/<base>/output/` to YouTube by hand.

Mechanical copy only — no transforms. Re-run anytime (e.g. after a thumbnail redo).
```

**Verify**: `python3 -m py_compile pipelines/youtube/explainer-videos-pipeline-1/7-upload/010-package-for-handoff-run/run.py` → exit 0.

### Step 2: Synthetic copy-only test (no `--drive`)

```bash
cd pipelines/youtube/explainer-videos-pipeline-1
mkdir -p 0-input/010-create-drive-folders-run/output
mkdir -p 5-final-video-sync/010-mux-final-video-run/output
mkdir -p 6-thumbnail/010-generate-thumbnail-opus/output

cat > 0-input/010-create-drive-folders-run/output/smoketest.manifest.json <<'EOF'
{
  "topic": "Smoke Test", "base": "smoketest", "account": "kushalbakliwal25@gmail.com",
  "drive_folder_ids": {"topic": "fake_topic_id", "input": "fake_input_id", "output": "fake_output_id"},
  "drive_link": "https://drive.google.com/drive/folders/fake_topic_id",
  "local_input": "/tmp/plan050-smoketest/input",
  "local_output": "/tmp/plan050-smoketest/output"
}
EOF
echo "fake video bytes" > 5-final-video-sync/010-mux-final-video-run/output/smoketest.final.mp4
echo "fake thumbnail bytes" > 6-thumbnail/010-generate-thumbnail-opus/output/smoketest.thumbnail.jpg

python3 7-upload/010-package-for-handoff-run/run.py smoketest
ls /tmp/plan050-smoketest/output   # expect: smoketest.final.mp4, smoketest.thumbnail.jpg

# Clean up
rm -rf /tmp/plan050-smoketest 0-input/010-create-drive-folders-run/output \
       5-final-video-sync/010-mux-final-video-run/output \
       6-thumbnail/010-generate-thumbnail-opus/output
```

**Verify**: both files appear in `/tmp/plan050-smoketest/output/` with correct
names; all fixture directories removed afterward.

## Test plan

No test framework in `pipelines/`. Verification is `py_compile` plus the
synthetic copy-only proof in Step 2 (reported in the run-log with the actual
`ls` output).

## Done criteria

- [ ] `010-package-for-handoff-run/{run.py,README.md}` exist, `run.py` compiles
- [ ] Synthetic test: both files copied to the manifest's `local_output` path with correct names
- [ ] All fixture files/directories removed after Step 2

## STOP conditions

- `0-input/010-create-drive-folders-run/run.py` missing (plan 044 not
  landed) — this plan's manifest-shape assumption depends on it; stop and
  report if absent
- Any file already exists under `7-upload/` before Step 1 — stop, report, do not overwrite

## Maintenance notes

- If `0-input/010`'s manifest JSON shape ever changes (field renames), this
  step's `load_manifest()` reads `manifest["local_output"]` and
  `manifest["drive_folder_ids"]["output"]` directly — update both together.
- This step deliberately never calls the YouTube Data API — if a REAL
  YouTube upload is ever wanted, that's a new, separate step (and a new
  Google API scope/credential), not an extension of this one (owner decision,
  locked in the design doc: 7-upload is packaging only).
