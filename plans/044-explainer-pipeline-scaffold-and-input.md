---
executor: agy
model:
test_cmd: find pipelines/youtube/explainer-videos-pipeline-1/lib pipelines/youtube/explainer-videos-pipeline-1/0-input -name "*.py" | xargs -I{} python3 -m py_compile {}
ui:
deploy:
needs: []
---

# Plan 044: explainer-videos-pipeline-1 — shared scaffolding + 0-input

## Summary

- **Problem statement**: `pipelines/youtube/explainer-videos-pipeline-1/` has 7 empty
  stage folders and no shared library, reference-voice slot, or entry step. Every
  other plan in this batch (045–050) depends on this one existing first.
- **Goals**:
  - Copy (and lightly adapt) `tutorial-pipeline-2`'s shared library into this
    pipeline's own `lib/`.
  - Create the `shared/ref/` slot for the fixed reference voice.
  - Build `0-input/010-create-drive-folders-run/`: takes `--topic`, creates a Drive
    folder skeleton under a fixed root, mirrors it locally, and writes the
    per-topic manifest every later step appends to.
  - Write the pipeline's own `PIPELINE.md` (the map, mirroring `tutorial-pipeline-2`'s).
- **Executor proposed**: `agy` (owner's explicit instruction — the entire pipeline
  build goes through Antigravity, overriding the normal difficulty-based default).
- **Done criteria**: `lib/` has 5 files and compiles; `shared/ref/` exists with a
  `.gitkeep` and a README note; `0-input/010.../run.py` creates folders + manifest
  and is idempotent on rerun; `PIPELINE.md` exists.
- **Stop conditions**: `pp-drive` binary not found; the fixed root Drive folder id
  is rejected by `pp-drive` (e.g. deleted/no access).
- **Test / verification for success**: `python3 -m py_compile` on every new `.py`
  file, plus a live dry run of `010-create-drive-folders-run` against the real
  fixed Drive folder (creates real folders — cheap, reversible, uses `ensure_folder`
  so a rerun does not duplicate anything).
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5a11eac..HEAD -- pipelines/youtube/explainer-videos-pipeline-1`
> Expect empty (the folder currently holds only 7 empty directories — `1-research`
> through `7-upload` — with nothing inside them; `git diff --stat` shows nothing for
> empty dirs, so also run `find pipelines/youtube/explainer-videos-pipeline-1 -type f`
> and expect zero output before starting).

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (new files only; the one live-effect command is idempotent folder creation)
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `5a11eac`, 2026-07-07

## Why this matters

This is the foundation every other plan in the batch (045–050) builds on: the shared
`lib/`, the reference-voice slot, and the per-topic manifest contract that every
later step reads from and appends to. Getting the manifest shape and the Drive
idempotency right here avoids rework in every downstream plan.

## Current state

- `pipelines/youtube/explainer-videos-pipeline-1/` contains exactly 7 empty
  directories: `1-research/ 2-scripting/ 3-voiceover/ 4-motion-graphics/
  5-final-video-sync/ 6-thumbnail/ 7-upload/`. No `0-input/`, no `lib/`, no
  `shared/`, no `PIPELINE.md` yet.
- `pipelines/youtube/tutorial-pipeline-2/lib/` (read yourself) has: `__init__.py`
  (empty), `audio.py` (dur/mmss/to_mp3/concat — ffmpeg wrappers, no step-specific
  logic), `asr.py` (Groq Whisper wrapper), `chunking.py` (sentence-packing;
  `chunk(text, chunk_seconds)` and `chunk_segments(...)` — copy BOTH functions even
  though this new pipeline only ever uses `chunk()`, since it's one small file and
  keeping it identical avoids drift), `modal_tts.py` (the IndexTTS-2 Modal call —
  do not read/reproduce its body here, just copy the file verbatim), `drive.py`
  (pp-drive CLI wrapper: `resolve_cli`, `ensure_folder(cli, name, account,
  parent="root")`, `upload`, `link`).
- `pipelines/youtube/tutorial-pipeline-2/lib/drive.py` resolves the `pp-drive`
  binary via: explicit `--drive-cli` flag → `PATH` → in-tree fallback at
  `ROOT.parents[2] / "tooling/cli/drive/pp-drive"` where `ROOT =
  pathlib.Path(__file__).resolve().parents[1]`. For `explainer-videos-pipeline-1`,
  `ROOT.parents[2]` from `lib/drive.py` is `personal-stuff/` — same relative
  depth as `tutorial-pipeline-2/lib/drive.py`, since both pipelines sit at
  `pipelines/youtube/<name>/lib/drive.py` (3 levels above `personal-stuff/`). Copy
  `drive.py` verbatim; the path math does not need to change.
- `pipelines/youtube/tutorial-pipeline-2/2-recording/010-create-drive-folders-run/run.py`
  (read yourself in full) is the exemplar for `0-input/010`. Key pattern to
  reuse: `drive.ensure_folder(cli, name, account, parent)` is find-or-create
  (idempotent), `TREE` is an ordered list of relative subfolder paths (parent
  before child), and the manifest written to `output/<title>.drive-folders.json`
  maps every relative path to its Drive folder id.
- Fixed root Drive folder id (from the owner's given link
  `https://drive.google.com/drive/folders/1nnTXY8sSXOVyHxHX1aPPUR3gQxtpcWFO`):
  `1nnTXY8sSXOVyHxHX1aPPUR3gQxtpcWFO`. Unlike `tutorial-pipeline-2` step 010
  (which looks up a root folder BY NAME under `"root"`), this pipeline's root is
  already a known id — pass it directly as `parent` to `ensure_folder` for the
  topic-folder creation, skip the by-name root lookup entirely.
- Google account default: `kushalbakliwal25@gmail.com` (same as
  `tutorial-pipeline-2` step 010's `--account` default — read that file's
  `argparse` default yourself to confirm before copying).
- `pipelines/youtube/tutorial-pipeline-2/PIPELINE.md` (read yourself) — the map
  file this pipeline's own `PIPELINE.md` should mirror in format (flow table,
  ASCII diagram, Layout section, Conventions section, Status section).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Syntax-check new Python | `find pipelines/youtube/explainer-videos-pipeline-1/lib pipelines/youtube/explainer-videos-pipeline-1/0-input -name "*.py" \| xargs -I{} python3 -m py_compile {}` | exit 0, no output |
| Find pp-drive | `which pp-drive \|\| ls tooling/cli/drive/pp-drive` | one path resolves |
| Confirm empty pipeline dir | `find pipelines/youtube/explainer-videos-pipeline-1 -type f` | zero output (before any step below) |

## Scope

**In scope**:
- `pipelines/youtube/explainer-videos-pipeline-1/lib/__init__.py`
- `pipelines/youtube/explainer-videos-pipeline-1/lib/audio.py`
- `pipelines/youtube/explainer-videos-pipeline-1/lib/asr.py`
- `pipelines/youtube/explainer-videos-pipeline-1/lib/chunking.py`
- `pipelines/youtube/explainer-videos-pipeline-1/lib/modal_tts.py`
- `pipelines/youtube/explainer-videos-pipeline-1/lib/drive.py`
- `pipelines/youtube/explainer-videos-pipeline-1/shared/ref/.gitkeep`
- `pipelines/youtube/explainer-videos-pipeline-1/shared/ref/README.md`
- `pipelines/youtube/explainer-videos-pipeline-1/0-input/010-create-drive-folders-run/run.py`
- `pipelines/youtube/explainer-videos-pipeline-1/0-input/010-create-drive-folders-run/README.md`
- `pipelines/youtube/explainer-videos-pipeline-1/PIPELINE.md`

**Out of scope**:
- Anything under `1-research/` through `7-upload/` — those are plans 045–050.
- `tutorial-pipeline-2/` itself — read-only reference, never edit it.
- Any real video-topic run (this plan only scaffolds; do not invent a real
  `--topic` beyond the one throwaway test folder in Step 4, which you must
  document how to remove).

## Git workflow

- Branch: `boss/044-explainer-scaffold-input`
- Commit: `feat(explainer-pipeline-1): shared lib + 0-input scaffolding` — no AI footers. Do NOT push.

## Steps

### Step 1: Copy the shared library

Copy these 5 files verbatim from `pipelines/youtube/tutorial-pipeline-2/lib/` into
a new `pipelines/youtube/explainer-videos-pipeline-1/lib/`: `__init__.py`,
`audio.py`, `asr.py`, `chunking.py`, `modal_tts.py`, `drive.py`. Do not modify their
contents in this step (plan 046 adapts `synthesize-voice`'s use of `chunking`, not
`chunking.py` itself).

**Verify**: `diff pipelines/youtube/tutorial-pipeline-2/lib/audio.py pipelines/youtube/explainer-videos-pipeline-1/lib/audio.py` → no output (identical).

### Step 2: Reference-voice slot

Create `pipelines/youtube/explainer-videos-pipeline-1/shared/ref/.gitkeep` (empty
file, so the directory is tracked before the real voice sample exists) and
`pipelines/youtube/explainer-videos-pipeline-1/shared/ref/README.md`:

```markdown
# Reference voice

Drop your ~30 second voice sample here as `owner-30s.wav` before running
`3-voiceover/010-synthesize-voice-run`. Every explainer video uses this one
fixed voice (see `pipelines/youtube/tutorial-pipeline-2/shared/ref/jamila-30s.wav`
for the equivalent in the sibling pipeline). The synth step hard-stops with a
clear message if this file is missing.
```

**Verify**: `ls pipelines/youtube/explainer-videos-pipeline-1/shared/ref/` → shows `.gitkeep` and `README.md`.

### Step 3: `0-input/010-create-drive-folders-run/run.py`

Write `pipelines/youtube/explainer-videos-pipeline-1/0-input/010-create-drive-folders-run/run.py`:

```python
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
```

Write `pipelines/youtube/explainer-videos-pipeline-1/0-input/010-create-drive-folders-run/README.md`:

```markdown
# 0/010 · create-drive-folders  ·  [RUN]  (first step)

Creates `<topic>/{input,output}/` under the fixed root Drive folder, mirrors it
locally, and writes the per-topic manifest every later step appends to.

- **Run:** `python3 run.py --topic "Video Topic"`
- **Out:** `output/<base>.manifest.json` + `output/<base>/{input,output}/` locally;
  same tree in Drive under the fixed root folder
  (`https://drive.google.com/drive/folders/1nnTXY8sSXOVyHxHX1aPPUR3gQxtpcWFO`).
- **Idempotent:** re-running finds existing folders and preserves manifest
  fields other steps have already filled in.
- **Next:** step 2-scripting/010 reads `<base>` from this manifest.
```

**Verify**: `python3 -m py_compile pipelines/youtube/explainer-videos-pipeline-1/0-input/010-create-drive-folders-run/run.py` → exit 0.

### Step 4: Live dry run + idempotency check

Run the step twice against a throwaway topic to prove idempotency, then delete
the throwaway local output (leave the Drive folders — they're harmless empty
folders and deleting them isn't worth the risk of touching the wrong id):

```bash
cd pipelines/youtube/explainer-videos-pipeline-1/0-input/010-create-drive-folders-run
python3 run.py --topic "Plan 044 Smoke Test"
python3 run.py --topic "Plan 044 Smoke Test"   # second run — must not error, must reuse folder ids
cat output/plan-044-smoke-test.manifest.json   # confirm drive_folder_ids present, both runs same ids
rm -rf output/*   # clear the throwaway local output before committing (keep the run.py/README.md)
```

**Verify**: both runs exit 0; the two manifest reads show identical
`drive_folder_ids` (proves `ensure_folder`'s find-or-create is working, not
creating duplicate folders on the second run).

### Step 5: `PIPELINE.md`

Write `pipelines/youtube/explainer-videos-pipeline-1/PIPELINE.md` mirroring
`tutorial-pipeline-2/PIPELINE.md`'s structure (flow table, ASCII diagram, Layout,
Conventions, Status). Content for the flow table (fill in stages as they land in
plans 045–050; for THIS plan, only the `0-input` row is real, mark the rest
`(plan 04N, not yet implemented)`):

```markdown
# explainer-videos-pipeline-1

One linear pipeline that turns a topic + three independently-chosen competitor
channel styles (script, motion-graphics, thumbnail) into a published-ready
explainer video draft. No screen recording, no avatar — fully generated via
Hyperframes motion graphics timed to a synthesized voiceover.

## The flow (run top to bottom)

| # | Step | Actor | In → Out |
|---|------|-------|----------|
| 0/010 | `create-drive-folders` | [RUN] | `--topic` → `<base>` manifest + Drive/local input+output folders |
| 1 | `research` | — | intentionally empty — no automation |
| 2/010 | `write-script` | [OPUS] | `--slug --topic` → script.md cloned from a competitor channel's voice (plan 045) |
| 2/020 | `review-script` | [HUMAN] | resolve `[VERIFY:]` placeholders, approve (plan 045) |
| 2/030 | `clean-script-for-tts` | [RUN] | strip markdown/comments → TTS-ready text (plan 045) |
| 3/010 | `synthesize-voice` | [RUN] | TTS via Modal IndexTTS-2, fixed reference voice (plan 046) |
| 3/020 | `trim-silence` | [RUN] | (plan 046) |
| 3/030 | `voice-autoqc` | [RUN] | (plan 046) |
| 3/040 | `review-voice` | [HUMAN] | (plan 046) |
| 3/050 | `make-timestamped-transcript` | [RUN] | the timing spine for stage 4 (plan 046) |
| 4/010 | `plan-visuals` | [OPUS] | `--slug` → timed visual plan from video-style-dna.md (plan 047) |
| 4/020 | `build-graphics` | [AGY] | authors + renders Hyperframes composition (plan 047) |
| 4/030 | `review-visuals` | [HUMAN] | (plan 047) |
| 5/010 | `mux-final-video` | [RUN] | voice + graphics → final MP4, duration-asserted (plan 048) |
| 6/010 | `generate-thumbnail` | [OPUS] | `--slug` → Hyperframes snapshot styled thumbnail (plan 049) |
| 7/010 | `package-for-handoff` | [RUN] | final MP4 + thumbnail → topic's output/ folder (plan 050) |

## Layout
```
explainer-videos-pipeline-1/
  PIPELINE.md            ← this file (the map)
  lib/                   ← shared logic (audio, asr, chunking, modal_tts, drive)
  shared/ref/            ← the fixed reference voice
  0-input/ 1-research/ … 7-upload/
    <NNN-name-actor>/
      README.md
      run.py | rulebook.md
      output/
```

## Conventions
- ×10 numbering per stage (010, 020, 030 …).
- Actor suffix names the executor: `-run` / `-opus` / `-agy` / `-human`.
- Independent `--slug` per style-cloning step (2-scripting, 4-motion-graphics,
  6-thumbnail) — three separate competitor-channel choices by design.
- Every DNA-consuming step hard-stops (never auto-builds) if the named
  channel's `script-style-dna.md` / `video-style-dna.md` is missing.

## Status
Built across plans 044 (this scaffold) through 050. See `plans/README.md`.
```

**Verify**: `test -f pipelines/youtube/explainer-videos-pipeline-1/PIPELINE.md && echo ok` → `ok`.

## Test plan

No unit-test framework exists in `pipelines/` (verified: no `pytest.ini`/`conftest.py`
anywhere under `pipelines/`). Verification is: `py_compile` on every new `.py` file,
plus the live idempotent dry-run in Step 4.

## Done criteria

- [ ] `lib/` has all 5 files, byte-identical to `tutorial-pipeline-2/lib/`'s equivalents
- [ ] `shared/ref/.gitkeep` and `README.md` exist
- [ ] `0-input/010-create-drive-folders-run/run.py` + `README.md` exist and compile
- [ ] Two consecutive live runs against the same `--topic` produce identical `drive_folder_ids`
- [ ] Throwaway smoke-test local output removed before commit (Drive folders may remain — harmless)
- [ ] `PIPELINE.md` exists at the pipeline root

## STOP conditions

- `pp-drive` binary cannot be resolved (neither on `PATH` nor at the in-tree fallback path)
- The fixed root Drive folder id is rejected by `pp-drive` (deleted, no access, or wrong id) — do not silently fall back to creating a new root folder
- Any existing file under `1-research/` through `7-upload/` is found (would mean another plan already ran out of order) — stop and report, do not overwrite

## Maintenance notes

- The fixed root Drive folder id is a hardcoded constant in `run.py` — if the
  owner ever needs to point this pipeline at a different Drive root, that's a
  one-line change in this file, not a config file (matches the fact that it's
  a one-time-set owner decision, not a per-run parameter).
- Every later plan's step must `manifest.update({...})` (never blind-overwrite
  the whole file) so fields from earlier stages survive — Step 3's `run.py`
  above already does this; copy the same read-modify-write pattern in every
  subsequent step that touches the manifest.
