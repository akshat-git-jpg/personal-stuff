---
executor: agy
model:
test_cmd: find pipelines/youtube/explainer-videos-pipeline-1/3-voiceover -name "*.py" | xargs -I{} python3 -m py_compile {}
ui:
deploy:
needs: ["044", "045"]
---

# Plan 046: explainer-videos-pipeline-1 — 3-voiceover stage

## Summary

- **Problem statement**: `3-voiceover/` is empty. This pipeline needs a
  voiceover stage adapted from `tutorial-pipeline-2`'s — but as a CORE SUBSET
  only, since there's no avatar/talking-head output here at all (no
  avatar-segments planning, no corner-render-parts).
- **Goals**:
  - `010-synthesize-voice-run/`: TTS via Modal IndexTTS-2, using the fixed
    `shared/ref/owner-30s.wav`, ADAPTED from `tutorial-pipeline-2`'s 080 to
    drop the avatar-segments branch entirely (always plain-text chunking).
  - `020-trim-silence-run/`: near-verbatim port of `tutorial-pipeline-2`'s 100.
  - `030-voice-autoqc-run/`: near-verbatim port of 105, with the
    corner-render-parts reference removed from its README (doesn't exist here).
  - `040-review-voice-human/`: adapted README (drop corner-parts / avatar
    checklist items; keep the redo-loop instructions).
  - `050-make-timestamped-transcript-run/`: near-verbatim port of 120 — its
    output IS the timing spine for stage 4.
  - `shared/pronunciation-map.md`: the fix-loop artifact 040's checklist points to.
- **Executor proposed**: `agy` (owner's explicit instruction for this whole build).
- **Done criteria**: all 5 step folders + `shared/pronunciation-map.md` exist;
  every `.py` file compiles; `010`'s hard-stop on a missing reference voice is
  proven with a synthetic check (no real Modal/TTS call — that costs money and
  needs a real script, out of scope for this plan).
- **Stop conditions**: none beyond per-step specifics below.
- **Test / verification for success**: `py_compile` on all 4 new `.py` files,
  plus a synthetic check that `010` exits with the correct hard-stop message
  when `shared/ref/owner-30s.wav` is absent (it will be, since plan 044 only
  creates a placeholder slot).
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5a11eac..HEAD -- pipelines/youtube/explainer-videos-pipeline-1/3-voiceover pipelines/youtube/explainer-videos-pipeline-1/shared/pronunciation-map.md`
> Expect empty. STOP if `pipelines/youtube/explainer-videos-pipeline-1/lib/chunking.py`
> does not exist yet (plan 044 dependency) or if `2-scripting/030-clean-script-for-tts-run/run.py`
> does not exist yet (plan 045 dependency, needed for the default-input glob pattern below).

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (adapting already-working code; no new algorithms)
- **Depends on**: 044, 045
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `5a11eac`, 2026-07-07

## Why this matters

This stage's final output (the timestamped transcript) is the timing spine
the entire rest of the pipeline is built around — the inverted sync model
(voiceover drives motion-graphics timing, confirmed in the design) makes this
stage's correctness load-bearing for everything downstream in plans 047/048.

## Current state

- `pipelines/youtube/explainer-videos-pipeline-1/3-voiceover/` is empty.
- `pipelines/youtube/tutorial-pipeline-2/4-voiceover/080-synthesize-voice-run/run.py`
  (already read in full during design review) — the exemplar to ADAPT. Key
  changes required for this pipeline's version:
  - Drop the avatar-segments `.json` input branch in `load_chunks()` — always
    plain-text mode (`chunking.chunk(text, chunk_seconds)`), since no
    `avatar-segments.json` will ever exist in this pipeline.
  - Drop `write_avatar_outputs()` entirely and its call site in `main()`.
  - Change `PREV` to point at
    `../../2-scripting/030-clean-script-for-tts-run/output` and read
    `*.tts-ready.txt` (not `*.improved.txt` or `*.avatar-segments.json`).
  - Change `DEFAULT_REF` to `shared/ref/owner-30s.wav` (this pipeline's fixed
    voice, not `jamila-30s.wav`).
  - Keep: the redo-loop (`--only`), `--index` rebuild, `write_index()`,
    `stitch()` — all avatar-agnostic already.
- `pipelines/youtube/tutorial-pipeline-2/4-voiceover/100-trim-silence-run/run.py`
  (already read in full) — port near-verbatim; only `PREV` changes to
  `../010-synthesize-voice-run/output`.
- `pipelines/youtube/tutorial-pipeline-2/4-voiceover/105-voice-autoqc-run/run.py`
  (already read in full during design review) — port near-verbatim; only
  `work_dir = PIPELINE_ROOT / "3-voiceover" / "010-synthesize-voice-run" / "output" / f"{args.base}.work"`
  changes (this pipeline has no `4-voiceover` folder — it's `3-voiceover`
  here).
- `pipelines/youtube/tutorial-pipeline-2/4-voiceover/120-make-timestamped-transcript-run/run.py`
  (already read in full) — port near-verbatim; only `PREV` changes to
  `../020-trim-silence-run/output`.
- `pipelines/youtube/tutorial-pipeline-2/4-voiceover/110-review-voice-human/README.md`
  (already read in full) — adapt: drop the "spot-check corner parts" bullet
  and the "later, step 150 (generate avatars)" mention (no avatar stage
  exists here); keep the redo-loop instructions and the pronunciation-map fix
  path.
- `pipelines/youtube/tutorial-pipeline-2/shared/pronunciation-map.md` exists
  in the sibling pipeline (read it yourself for its exact format — a running
  list of name/number → correct-pronunciation-spelling fixes) — this plan
  creates an equivalent, empty-to-start file for this pipeline.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Syntax-check all new Python | `find pipelines/youtube/explainer-videos-pipeline-1/3-voiceover -name "*.py" \| xargs -I{} python3 -m py_compile {}` | exit 0 |
| Confirm folder empty before starting | `find pipelines/youtube/explainer-videos-pipeline-1/3-voiceover -type f` | zero output |

## Scope

**In scope**:
- `pipelines/youtube/explainer-videos-pipeline-1/3-voiceover/010-synthesize-voice-run/{run.py,README.md}`
- `pipelines/youtube/explainer-videos-pipeline-1/3-voiceover/020-trim-silence-run/{run.py,README.md}`
- `pipelines/youtube/explainer-videos-pipeline-1/3-voiceover/030-voice-autoqc-run/{run.py,README.md}`
- `pipelines/youtube/explainer-videos-pipeline-1/3-voiceover/040-review-voice-human/README.md`
- `pipelines/youtube/explainer-videos-pipeline-1/3-voiceover/050-make-timestamped-transcript-run/{run.py,README.md}`
- `pipelines/youtube/explainer-videos-pipeline-1/shared/pronunciation-map.md`

**Out of scope**:
- Any avatar-related code, file, or reference — none should appear anywhere in this stage.
- `tutorial-pipeline-2/` itself — read-only reference.
- A real TTS run (costs Modal GPU money and needs a real approved script) —
  this plan proves the hard-stop path only, never a real synth call.

## Git workflow

- Branch: `boss/046-explainer-voiceover`
- Commit: `feat(explainer-pipeline-1): 3-voiceover stage (core TTS/trim/QC/review/timestamps)` — no AI footers. Do NOT push.

## Steps

### Step 1: `010-synthesize-voice-run/`

Write `run.py`, adapting `tutorial-pipeline-2`'s 080 per the "Current state"
notes above — plain-text-only chunking, no avatar branch, no
`write_avatar_outputs`:

```python
#!/usr/bin/env python3
"""
Step 3/010 — synthesize the voiceover (owner's own voice, IndexTTS-2 on Modal).  [RUN]

  python3 run.py [<input>] [--chunk-seconds 20] [--interval-silence 150] [--discard-clips]
  python3 run.py [<input>] --only 0042,0043     # redo loop: re-synth just these chunks
  python3 run.py [<input>] --index              # rebuild the timeline only, no synth

Input (default: step 2/030's output): <base>.tts-ready.txt — one continuous voiceover,
no avatar blocks (this pipeline has no avatar/talking-head output at all).

What runs WHERE:  local chunks → Modal GPU synth (lib/modal_tts) → local stitch.
Output:
  output/<base>.voice.wav     the continuous voiceover (all chunks stitched)
  output/<base>.work/         kept by default: clips/0000.wav…, chunks.json, index.txt

Redo loop: clips are kept, so re-synthing one flagged chunk costs one chunk of GPU,
not the whole video.
"""
import sys, re, json, argparse, pathlib, shutil

ROOT = pathlib.Path(__file__).resolve().parents[2]          # explainer-videos-pipeline-1/
sys.path.insert(0, str(ROOT))
from lib import audio, chunking, modal_tts                   # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "output"
PREV = ROOT / "2-scripting/030-clean-script-for-tts-run/output"
DEFAULT_REF = ROOT / "shared/ref/owner-30s.wav"
WPS = chunking.WPS


def die(m): raise SystemExit("✖ " + m)


def load_chunks(inp, chunk_seconds):
    return chunking.chunk(inp.read_text(), chunk_seconds)


def write_index(clip_dir, chunks, out_path):
    text_by_id = {c["id"]: c["text"] for c in chunks}
    t, lines = 0.0, []
    for w in sorted(clip_dir.glob("*.wav")):
        d = audio.dur(w)
        preview = " ".join(text_by_id.get(w.stem, "").split()[:8])
        lines.append(f"{w.stem}  {audio.mmss(t)}–{audio.mmss(t + d)}  \"{preview}…\"")
        t += d
    out_path.write_text("\n".join(lines) + "\n")
    return out_path


def stitch(clip_dir, out_wav):
    wavs = sorted(clip_dir.glob("*.wav"))
    if not wavs:
        die("no wavs in clip dir — did the synth run?")
    audio.concat(wavs, out_wav)
    return len(wavs)


def basename(inp):
    return re.sub(r"\.(tts-ready|final|clean)$", "", inp.stem)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input", nargs="?", help="tts-ready.txt (default: step 2/030 output)")
    ap.add_argument("--ref", default=str(DEFAULT_REF))
    ap.add_argument("--chunk-seconds", type=float, default=20)
    ap.add_argument("--interval-silence", type=int, default=150,
                    help="ms of silence between sentences (lower = tighter)")
    ap.add_argument("--only", default=None, help="re-synth ONLY these chunk ids (e.g. 0042,0043)")
    ap.add_argument("--index", action="store_true", help="rebuild the timeline only, no synth")
    ap.add_argument("--discard-clips", action="store_true", help="delete the work dir after stitching")
    a = ap.parse_args()

    inp = pathlib.Path(a.input) if a.input else next(iter(sorted(PREV.glob("*.tts-ready.txt"))), None)
    if not inp or not inp.exists():
        die(f"no input (pass a path, or run step 2/030 first → {PREV})")
    if not pathlib.Path(a.ref).exists():
        die(f"no reference voice at {a.ref} — drop your ~30s sample there first "
            f"(see shared/ref/README.md)")

    base = basename(inp)
    OUT.mkdir(parents=True, exist_ok=True)
    work = OUT / f"{base}.work"
    clip_dir = work / "clips"
    out_wav = OUT / f"{base}.voice.wav"
    chunks = load_chunks(inp, a.chunk_seconds)

    if a.index:
        if not clip_dir.exists():
            die(f"no clips at {clip_dir} — run a full synth first")
        print(f"✓ rebuilt {write_index(clip_dir, chunks, work / 'index.txt')}")
        return

    if a.only:
        if not clip_dir.exists():
            die(f"no clips at {clip_dir} — run a full synth first")
        prev = json.loads((work / "chunks.json").read_text())
        if len(chunks) != len(prev):
            die(f"chunk count changed ({len(prev)} → {len(chunks)}): the edit shifted boundaries, "
                f"ids no longer line up. Run a full synth instead.")
        ids = {x.strip() for x in a.only.split(",") if x.strip()}
        sel = [c for c in chunks if c["id"] in ids]
        missing = ids - {c["id"] for c in sel}
        if missing:
            die(f"no such chunk id(s): {', '.join(sorted(missing))} (max {chunks[-1]['id']})")
        print(f"→ re-synthing {len(sel)} chunk(s): {', '.join(sorted(ids))}")
        modal_tts.modal_synth(sel, a.ref, clip_dir, a.interval_silence)
        n = stitch(clip_dir, out_wav)
        write_index(clip_dir, chunks, work / "index.txt")
        print(f"✓ re-stitched {n} clips → {out_wav}")
        return

    if clip_dir.exists():
        shutil.rmtree(clip_dir)
    clip_dir.mkdir(parents=True, exist_ok=True)
    (work / "chunks.json").write_text(json.dumps(chunks, ensure_ascii=False, indent=2))
    est_min = sum(len(c["text"].split()) for c in chunks) / WPS / 60
    print(f"→ {len(chunks)} chunks (~{a.chunk_seconds:g}s target, ~{est_min:.1f} min)")

    modal_tts.modal_synth(chunks, a.ref, clip_dir, a.interval_silence)
    n = stitch(clip_dir, out_wav)
    write_index(clip_dir, chunks, work / "index.txt")
    print(f"✓ stitched {n} clips → {out_wav}")
    print("→ next: step 020 (trim-silence)")
    if a.discard_clips:
        shutil.rmtree(work, ignore_errors=True)
        print("  (discarded clips — redo loop disabled for this run)")


if __name__ == "__main__":
    main()
```

Write `README.md`:

```markdown
# 3/010 · synthesize-voice  ·  [RUN]

TTS via Modal IndexTTS-2, using the fixed reference voice at
`../../shared/ref/owner-30s.wav`. Core subset only — no avatar-block chunking
(this pipeline has no avatar/talking-head output).

- **In:** `../../2-scripting/030-clean-script-for-tts-run/output/<base>.tts-ready.txt`
- **Out:** `output/<base>.voice.wav` + `output/<base>.work/` (clips, chunks.json, index.txt)
- **Hard-stop:** if `shared/ref/owner-30s.wav` is missing, stops with a clear message.
- **Redo loop:** `python3 run.py <input> --only 0042,0043` re-synths just those chunks.
- **Next:** step 020 (trim-silence)
```

**Verify**: `python3 -m py_compile pipelines/youtube/explainer-videos-pipeline-1/3-voiceover/010-synthesize-voice-run/run.py` → exit 0.

### Step 2: `020-trim-silence-run/`

Port `tutorial-pipeline-2`'s 100 near-verbatim; only change `PREV`:

```python
PREV = ROOT / "3-voiceover/010-synthesize-voice-run/output"
```

Update the module docstring's "step 080" references to "step 010", and
"step 120" to "step 050" (this stage's own step numbers). `ROOT` stays
`pathlib.Path(__file__).resolve().parents[2]` (same depth: `3-voiceover/020.../run.py`
→ `parents[2]` is `explainer-videos-pipeline-1/`, identical depth to the
source file). Everything else (the ffmpeg filter chain, `audio.dur` calls,
argparse flags) is unchanged — copy it exactly.

Write `README.md` (same shape as `tutorial-pipeline-2`'s 100, renumbered):

```markdown
# 3/020 · trim-silence  ·  [RUN]

Trims leading/trailing (and optionally internal) silence from the voiceover.
All ffmpeg, local, free.

- **In:** `../010-synthesize-voice-run/output/<base>.voice.wav`
- **Out:** `output/<base>.voice.trim.wav`
- **Run:** `python3 run.py [<voice.wav>] [--tighten]`
- **Next:** step 030 (voice-autoqc)
```

**Verify**: `python3 -m py_compile pipelines/youtube/explainer-videos-pipeline-1/3-voiceover/020-trim-silence-run/run.py` → exit 0.

### Step 3: `030-voice-autoqc-run/`

Port `tutorial-pipeline-2`'s 105 near-verbatim (the file you already read
during the design review). Only change the `work_dir` line:

```python
work_dir = PIPELINE_ROOT / "3-voiceover" / "010-synthesize-voice-run" / "output" / f"{args.base}.work"
```

(`PIPELINE_ROOT = STEP_DIR.parents[1]` stays unchanged — same depth.) All
thresholds (`WER_FLAG`, `LOUD_DB_DELTA`, `PACE_BAND`, `CLIP_PEAK_COUNT`) and
the WER/loudness/pace check logic are copied verbatim — this pipeline's
voiceover has the same quality bar as `tutorial-pipeline-2`'s.

Write `README.md`, adapted from `tutorial-pipeline-2`'s 105 (drop nothing —
this step is avatar-agnostic already):

```markdown
# 3/030 · voice-autoqc  ·  [RUN]

Cuts the listening burden of step 040 from "the whole video" to "only the
flagged chunks". Deterministic checks, no LLM.

- **In:** `../010-synthesize-voice-run/output/<base>.work/clips/*.wav` + `chunks.json`
- **Out:** `output/<base>.voice-qc.json` (per chunk: pass/flag + reason)
- **How:** `python3 run.py --base <base>`. Checks: WER vs script text, loudness/clipping
  outliers, duration vs words-per-second band.
- **Next:** step 040, where you listen only to flagged chunks
```

**Verify**: `python3 -m py_compile pipelines/youtube/explainer-videos-pipeline-1/3-voiceover/030-voice-autoqc-run/run.py` → exit 0.

### Step 4: `040-review-voice-human/`

Write `README.md`, adapted from `tutorial-pipeline-2`'s 110 (drop the
corner-parts spot-check bullet and the avatar mention; keep everything else):

```markdown
# 3/040 · review-voice  ·  [HUMAN gate]

Listen to the finished voiceover before it drives motion-graphics timing.
This is where the redo loop lives.

- **Review:** `../020-trim-silence-run/output/<base>.voice.trim.wav`, prioritizing
  any chunk flagged by `030-voice-autoqc-run`.
- **You approve → proceed to step 050 (timestamped transcript).**

## Checklist
- [ ] No mispronounced names / wrong numbers (check `../../shared/pronunciation-map.md`
      for known fixes, add new ones as you find them).
- [ ] No garbled/robotic chunk.
- [ ] Pacing/pauses feel natural.

## If something's wrong — fix upstream, re-synth just that bit
1. Find the timestamp; open `../010-synthesize-voice-run/output/<base>.work/index.txt` → the chunk id.
2. Fix the cause: a name → `../../shared/pronunciation-map.md` + the script; a wrong
   word → the script (back at `2-scripting`); a glitchy-but-correct read → no edit, just re-roll.
3. Re-synth only that chunk: `010-synthesize-voice-run/run.py <input> --only 0042`.

When it sounds right, say **approved**.
```

**Verify**: `test -f pipelines/youtube/explainer-videos-pipeline-1/3-voiceover/040-review-voice-human/README.md && echo ok` → `ok`.

### Step 5: `050-make-timestamped-transcript-run/`

Port `tutorial-pipeline-2`'s 120 near-verbatim (already read in full above).
Only change `PREV`:

```python
PREV = ROOT / "3-voiceover/020-trim-silence-run/output"
```

Update the docstring's "step 100"/"step 130" references to "step 020"/"step
4-motion-graphics/010" respectively. Everything else (the `ts()`/`write_srt()`/
`write_txt()` helpers, the Groq call via `lib.asr`) is copied verbatim.

Write `README.md`:

```markdown
# 3/050 · make-timestamped-transcript  ·  [RUN]  (final voiceover step)

Re-transcribes the final trimmed voiceover with word+segment timestamps.
This output is the TIMING SPINE for stage 4 (motion graphics render to fit
these timestamps, not the other way around).

- **In:** `../020-trim-silence-run/output/<base>.voice.trim.wav`
- **Out:** `output/<base>.srt`, `output/<base>.timestamps.txt`, `output/<base>.timestamps.json`
- **Run:** `python3 run.py [<voice.trim.wav>]`
- **Next:** `../../4-motion-graphics/010-plan-visuals-opus` reads `<base>.timestamps.json`
```

**Verify**: `python3 -m py_compile pipelines/youtube/explainer-videos-pipeline-1/3-voiceover/050-make-timestamped-transcript-run/run.py` → exit 0.

### Step 6: `shared/pronunciation-map.md`

Create `pipelines/youtube/explainer-videos-pipeline-1/shared/pronunciation-map.md`:

```markdown
# Pronunciation map

Running list of names/numbers the TTS gets wrong, fixed at the script level.
Grows across videos — check here first when `3-voiceover/040-review-voice-human`
flags a mispronunciation, add a line when you find a new one.

| As written | TTS says | Fix in script |
|---|---|---|
| (none yet) | | |
```

**Verify**: `test -f pipelines/youtube/explainer-videos-pipeline-1/shared/pronunciation-map.md && echo ok` → `ok`.

### Step 7: Synthetic hard-stop check for `010`

Prove the missing-reference-voice hard-stop without spending any Modal money:

```bash
cd pipelines/youtube/explainer-videos-pipeline-1/3-voiceover/010-synthesize-voice-run
mkdir -p ../../2-scripting/030-clean-script-for-tts-run/output
echo "This is a smoke test sentence." > ../../2-scripting/030-clean-script-for-tts-run/output/smoketest.tts-ready.txt
python3 run.py ../../2-scripting/030-clean-script-for-tts-run/output/smoketest.tts-ready.txt ; echo "exit=$?"
# Expect: exit=1 (non-zero), stderr contains "no reference voice at" and the shared/ref path
rm -f ../../2-scripting/030-clean-script-for-tts-run/output/smoketest.tts-ready.txt
```

**Verify**: exits non-zero with the exact "no reference voice at ... shared/ref/owner-30s.wav" message; fixture file removed after.

## Test plan

No test framework in `pipelines/`. Verification is `py_compile` on all new
`.py` files plus the manual hard-stop proof in Step 7 (reported in the
run-log with the actual stderr line).

## Done criteria

- [ ] All 5 step folders exist with README.md (+ run.py where applicable)
- [ ] All 4 `.py` files compile
- [ ] No avatar-related code, string, or file reference anywhere in `3-voiceover/`
- [ ] `shared/pronunciation-map.md` exists
- [ ] Step 7's synthetic hard-stop proof passes with the exact expected message

## STOP conditions

- `pipelines/youtube/explainer-videos-pipeline-1/lib/chunking.py` or `lib/modal_tts.py`
  missing (plan 044 not landed) — stop, do not recreate `lib/` here
- `2-scripting/030-clean-script-for-tts-run/run.py` missing (plan 045 not
  landed) — the synthetic test in Step 7 needs its output path convention;
  stop and report if it's absent
- Any file already exists under `3-voiceover/` before Step 1 — stop, report, do not overwrite

## Maintenance notes

- If `tutorial-pipeline-2`'s `lib/chunking.py`, `lib/audio.py`, or
  `lib/modal_tts.py` ever change (bugfix, new param), this pipeline's copies
  under its own `lib/` do NOT auto-update — they were deliberately duplicated
  (per repo convention: pipelines stay self-contained, only `pipelines/common/`
  is truly shared). Port fixes manually if they apply here too.
- The avatar-stripping in `010`'s `run.py` is the one meaningful code
  divergence from the sibling pipeline — if a future explainer video ever
  wants an avatar overlay, that's a new step to add, not a reason to
  resurrect the deleted avatar branch in this file (owner decision, this
  batch: core subset only).
