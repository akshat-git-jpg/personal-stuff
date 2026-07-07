# Plan 011: Tutorial pipeline v3 — implement deterministic assembly

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat ce08e57..HEAD -- pipelines/youtube/tutorial-pipeline-2/`
> (expect: no changes to `steps/105-*`, `steps/125-*`, `steps/162-*`, `steps/040-*` beyond this plan's own work)

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: none (v3 scaffolds are committed at `91892b4`)
- **Category**: feature
- **Planned at**: commit `ce08e57`, 2026-07-05

## Why this matters

The v3 redesign (see `pipelines/youtube/tutorial-pipeline-2/SPEC.md`) removes the
video editor's timeline work by making assembly deterministic: script polish emits a
segment map tying each script block to its raw-footage span; TTS gives each block's exact
voiceover length; a plan step computes per-block retimes; ffmpeg executes them. The step
folders, READMEs, and stub `run.py` files exist. This plan fills in the four missing
implementations and the two prompt conversions.

## Current state

- `steps/040-polish-script-for-delivery-sonnet/rulebook.md` polishes the script but does
  not emit a segment map.
- `steps/105-voice-autoqc-run/run.py`, `steps/125-build-assembly-plan-run/run.py`,
  `steps/162-auto-assemble-run/run.py` are stubs that `sys.exit()` with a pointer here.
  Each stub's docstring is the authoritative mini-spec; thresholds sit at the top.
- `steps/135-build-graphics-sonnet/rulebook.md` is a stub (see Step 6 scope note).
- `lib/` has `asr.py` (Groq Whisper), `audio.py` (duration/concat helpers) to reuse.
- Test data: `steps/080-synthesize-voice-run/output/BODY_2.work/clips/*.wav` and
  `chunks.json` exist from a real run. BODY_2 has NO segments.json (predates v3), so 125
  and 162 are verified with the synthetic fixtures below, not BODY_2.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Compile check | `python3 -m py_compile pipelines/youtube/tutorial-pipeline-2/steps/*/run.py` | exit 0 |
| ffmpeg present | `ffmpeg -version` | version string |
| Test recording | `ffmpeg -y -f lavfi -i testsrc=duration=60:size=1280x720:rate=30 -f lavfi -i sine=frequency=440:duration=60 -shortest /tmp/p011-rec.mp4` | 60s test video |
| Test VO | `ffmpeg -y -f lavfi -i sine=frequency=330:duration=50 /tmp/p011-vo.wav` | 50s wav |

## Scope

**In scope**:
- `steps/040-…-sonnet/rulebook.md` + `README.md`: add segment-map emission rules.
- Implement `run.py` for steps 105, 125, 162.
- `lib/handoff.py`: clipboard handoff helper for `-antigravity` steps.
- Convert rulebooks of 030 and 060 into self-contained Antigravity paste prompts.
- Register progress in `plans/README.md`.

**Out of scope**:
- Step 135's rulebook content (needs a Claude Code session with the pipelines hyperframes
  skills — flagged for the owner, see Step 6).
- The HeyGen `TODO[HNS]` submit/fetch stubs in `lib/heygen.py` (pre-existing v2 item).
- Running Modal TTS, HeyGen, or anything that spends money.
- The Devsplainers PoC folder.

## Git workflow

- Branch: `advisor/011-tutorial-pipeline-v3`
- Commit per step: `feat(tutorial-pipeline): <step> — <what>` — no AI footers. Do NOT push.

## Steps

All paths below are relative to `pipelines/youtube/tutorial-pipeline-2/`.

### Step 1: Segment map in 040

Edit `steps/040-polish-script-for-delivery-sonnet/rulebook.md`. Keep every existing polish
rule. Add a final section instructing the model to ALSO write
`output/<base>.segments.json` with this schema:

```json
[
  {
    "seg_id": "s01",
    "kind": "screen",
    "raw_start": 12.40,
    "raw_end": 41.92,
    "script_text": "The polished sentences belonging to this block."
  }
]
```

Rules to state in the rulebook: block boundaries may sit only where the raw ASR transcript
(`../020-transcribe-video-to-text-run/output/<base>.transcript.json`) shows a silence gap
of at least 1.0s, or at a brief-section change; every sentence of `improved.txt` belongs to
exactly one segment, in order; `raw_start`/`raw_end` come from the ASR word timestamps of
the first/last raw word the block was derived from; `kind` is `"a4_block"` only for blocks
the avatar plan will render fullscreen (intro, verdicts, conclusion), else `"screen"`.
Update the step README's Out line to mention both outputs.

**Verify**: the rulebook shows the schema and the boundary rules; `grep -c segments.json steps/040-polish-script-for-delivery-sonnet/rulebook.md` -> `>= 2`

### Step 2: Implement 105 voice-autoqc

Fill `steps/105-voice-autoqc-run/run.py` per its docstring. Reuse `lib/asr.py` for
re-transcription and `lib/audio.py` for durations; compute mean/peak dBFS with ffmpeg
(`ffmpeg -i clip.wav -af volumedetect -f null -`) rather than adding a dependency. WER =
word-level Levenshtein distance / reference length after normalization (lowercase, strip
punctuation). Output one JSON verdict per chunk plus a printed summary table; exit 0 even
when chunks are flagged (flags are information, not failure).

**Verify**: `python3 steps/105-voice-autoqc-run/run.py --base BODY_2` -> writes
`steps/105-voice-autoqc-run/output/BODY_2.voice-qc.json` with one entry per clip in
`steps/080-synthesize-voice-run/output/BODY_2.work/clips/`; summary prints pass/flag counts.
(Groq key required; if `GROQ_API_KEY` is absent, run with `--skip-wer` — implement that
flag — and verify loudness/pace checks alone.)

### Step 3: Implement 125 build-assembly-plan

Fill `steps/125-build-assembly-plan-run/run.py` per its docstring, with one refinement over
the stub text: segment VO spans come from aligning each segment's `script_text` against the
word-timestamped VO transcript (`../120-make-timestamped-transcript-run/output/<base>.json`),
not from `chunks.json`. Alignment: walk the timestamped words in order, matching each
segment's normalized word sequence greedily; a segment's `vo_start`/`vo_end` are its first
and last matched word times; `target_dur = vo_end - vo_start` (pad the last segment to the
audio end). Then per segment: `speed = (raw_end - raw_start) / target_dur`; clamp into
`SPEED_BAND`; if footage is short, `freeze_pad` makes up the difference; if footage is too
long even at max speed, set `"flag": true, "reason": "footage exceeds VO at max speed"`.
`a4_block` segments skip retime math and copy the span for substitution.

Create the synthetic fixture in `/tmp/p011-fixtures/`: a `segments.json` with three screen
segments (raw spans 0–20s, 20–45s, 45–60s) and a fake timestamped-transcript JSON giving
those segments VO durations of 18s, 25s, and 7s. Expected plan: speeds 1.11, 1.00, and a
flag on segment 3 (60−45=15s footage vs 7s VO -> speed 2.14 > 1.18).

**Verify**: running against the fixture produces exactly one flagged segment (s03) and
speeds within ±0.01 of 1.11 / 1.00; `python3 -m py_compile` clean.

### Step 4: Implement 162 auto-assemble

Fill `steps/162-auto-assemble-run/run.py` per its docstring: slice + retime with
`setpts=PTS/<speed>` (video only; audio comes from the VO track), freeze-pad with `tpad`,
concat via the concat demuxer at a uniform 1920x1080/30fps intermediate, overlay corner
avatar parts sequentially (position/scale from `shared/heygen_config.py`), overlay/insert
graphics when `steps/135-build-graphics-sonnet/output/` has clips, then mux the VO wav.
Missing optional inputs (no avatars downloaded, no graphics yet) must degrade gracefully
with a printed notice, not fail: the minimum viable output is retimed screen slices + VO.

**Verify**: with `/tmp/p011-rec.mp4` and `/tmp/p011-vo.wav` (see Commands) and the Step 3
fixture plan, output `draft-cut.mp4` duration equals the VO duration ±0.2s
(`ffprobe -show_entries format=duration`), and it plays.

### Step 5: Antigravity handoff + prompt conversions

Add `lib/handoff.py`: `python3 lib/handoff.py <step-folder> [--base <base>]` reads that
step's `rulebook.md`, substitutes `<base>` and any `<fill in: …>` markers it can, copies
the result to the clipboard (`pbcopy`), and prints "pasted prompt ready for Antigravity".
Then edit the rulebooks of 030 and 060 so each works as a standalone paste: state the
file to read, the file to write (relative to the pipeline root), and the completion
message to print; remove any phrasing that assumes a Claude Code session (tool names,
"apply this rulebook").

**Verify**: `python3 lib/handoff.py steps/030-clean-and-fix-transcript-antigravity --base BODY_2 && pbpaste | head -3` shows the prompt with BODY_2 substituted.

### Step 6: Flag the 135 rulebook for a Claude Code session

Do NOT author `steps/135-build-graphics-sonnet/rulebook.md` content (it depends on the
pipelines-scoped hyperframes skills, only available in Claude Code). Instead append one
line to the stub: "Owner: author this in a Claude Code session on Sonnet with the
pipelines:hyperframes + motion-graphics skills loaded." Record the same in your final
report.

**Verify**: stub still points to this plan and carries the owner note.

## Test plan

Step-level verifies above, plus a final sweep: `python3 -m py_compile` across all step
scripts and `lib/`; `grep -rn "NOT IMPLEMENTED" steps/*/run.py` returns nothing for
105/125/162; PIPELINE.md's Status section updated to reflect what is now implemented.

## Done criteria

- [ ] 040 rulebook emits the segment map (schema + boundary rules present)
- [ ] 105 runs on BODY_2 clips and writes a verdict per chunk
- [ ] 125 reproduces the fixture's expected speeds and single flag
- [ ] 162 produces a playable draft cut equal to VO length on the synthetic fixture
- [ ] handoff.py round-trips a rulebook to the clipboard; 030/060 prompts are standalone
- [ ] PIPELINE.md Status section and plans/README.md row updated

## STOP conditions

- Any step would call Modal, HeyGen, or another paid service (Groq transcription of the
  short BODY_2 clips is allowed; it is pennies).
- Existing files under any `steps/*/output/` would be modified or deleted (write new files only).
- `ffmpeg` is missing or the synthetic fixtures cannot reproduce the expected numbers after
  two attempts (report the math mismatch instead of tuning thresholds to pass).

## Maintenance notes

- Thresholds (`WER_FLAG`, `SPEED_BAND`, etc.) live at the top of each run.py on purpose;
  tune them from real flag rates after the first full video, and log the tuning in
  `pipelines/decisions.md`.
- The first real video through 040 needs the owner to eyeball segments.json against the
  recording once; that validates the boundary rules before trusting 125's math.
