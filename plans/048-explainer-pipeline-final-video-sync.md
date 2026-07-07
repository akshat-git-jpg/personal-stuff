---
executor: agy
model:
test_cmd: python3 -m py_compile pipelines/youtube/explainer-videos-pipeline-1/5-final-video-sync/010-mux-final-video-run/run.py
ui:
deploy:
needs: ["046", "047"]
---

# Plan 048: explainer-videos-pipeline-1 — 5-final-video-sync stage

## Summary

- **Problem statement**: `5-final-video-sync/` is empty. This pipeline needs
  one deterministic step that muxes the voiceover audio with the rendered
  Hyperframes video into a final MP4, asserting the two durations actually
  match before muxing (the inverted sync model's only arithmetic guardrail).
- **Goals**: `010-mux-final-video-run/`: ffmpeg-mux voice + video, hard-fail
  (not silently truncate/pad) if durations differ by more than 0.5s.
- **Executor proposed**: `agy` (owner's explicit instruction for this whole build).
- **Done criteria**: `run.py` compiles; a synthetic test proves both the
  happy path (matching durations → muxed output) and the failure path
  (mismatched durations → hard-fail with a clear message, no output file written).
- **Stop conditions**: none beyond per-step specifics below.
- **Test / verification for success**: `py_compile` + a synthetic ffmpeg-based
  test using two short generated clips (one audio, one video) of known,
  controllable durations — no dependency on plans 046/047 having produced
  real output.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5a11eac..HEAD -- pipelines/youtube/explainer-videos-pipeline-1/5-final-video-sync`
> Expect empty.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED (the duration-assert logic must be correct — a silent
  truncate/pad here would ship a broken video with no warning)
- **Depends on**: 046, 047
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `5a11eac`, 2026-07-07

## Why this matters

This step is the only place in the pipeline that mechanically verifies the
inverted-sync-model assumption (motion graphics were rendered to fit the
voiceover) actually held. Every other duration check in the batch (plan 047's
rulebook Step 6) is advisory / self-reported by a creative step; this one is
the hard, code-enforced gate before a final MP4 is produced.

## Current state

- `pipelines/youtube/explainer-videos-pipeline-1/5-final-video-sync/` is empty.
- Inputs once plans 046/047 have run for real:
  - `../../3-voiceover/020-trim-silence-run/output/<base>.voice.trim.wav` (the voice)
  - `../../4-motion-graphics/020-build-graphics-agy/output/<base>.motion.mp4` (the rendered video, silent or with its own scratch audio track — mux replaces/adds the real voice track)
- `pipelines/youtube/explainer-videos-pipeline-1/lib/audio.py` (from plan 044,
  copied from `tutorial-pipeline-2/lib/audio.py`) has `dur(p)` — ffprobe-based
  duration in seconds, returns `0.0` if unreadable. Reuse this for the
  duration check rather than writing a new ffprobe wrapper.
- Tolerance: ±0.5 seconds (matches plan 047's rulebook's own advisory check,
  by design — a render that passes there should also pass here).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Syntax-check | `python3 -m py_compile pipelines/youtube/explainer-videos-pipeline-1/5-final-video-sync/010-mux-final-video-run/run.py` | exit 0 |
| Confirm folder empty before starting | `find pipelines/youtube/explainer-videos-pipeline-1/5-final-video-sync -type f` | zero output |
| Generate a synthetic test audio clip | `ffmpeg -y -f lavfi -i "sine=frequency=440:duration=5" test-audio.wav` | 5.0s wav |
| Generate a synthetic test video clip | `ffmpeg -y -f lavfi -i "color=c=blue:s=320x240:d=5" -pix_fmt yuv420p test-video.mp4` | 5.0s mp4 |

## Scope

**In scope**:
- `pipelines/youtube/explainer-videos-pipeline-1/5-final-video-sync/010-mux-final-video-run/run.py`
- `pipelines/youtube/explainer-videos-pipeline-1/5-final-video-sync/010-mux-final-video-run/README.md`

**Out of scope**:
- Any retiming/re-encoding logic beyond the straight mux — this stage
  deliberately does no assembly-plan math (unlike `tutorial-pipeline-2`'s 125/162).
- Real voiceover/rendered-video files — this plan tests with synthetic ffmpeg-generated clips only.

## Git workflow

- Branch: `boss/048-explainer-final-sync`
- Commit: `feat(explainer-pipeline-1): 5-final-video-sync stage (mux + duration guardrail)` — no AI footers. Do NOT push.

## Steps

### Step 1: `010-mux-final-video-run/run.py`

```python
#!/usr/bin/env python3
"""
Step 5/010 — mux the voiceover + rendered motion graphics into the final MP4.  [RUN]

  python3 run.py [<base>] [--tolerance 0.5]

In:  ../../3-voiceover/020-trim-silence-run/output/<base>.voice.trim.wav
     ../../4-motion-graphics/020-build-graphics-agy/output/<base>.motion.mp4
Out: output/<base>.final.mp4

HARD ASSERT: |video_duration - voice_duration| must be <= --tolerance seconds
(default 0.5s). This is the pipeline's inverted-sync-model guardrail — motion
graphics were rendered to fit the voiceover's duration (stage 4), so if they
don't match here, something upstream is wrong. This step FAILS LOUD on a
mismatch; it never silently truncates or pads either track.
"""
import sys, subprocess, argparse, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]          # explainer-videos-pipeline-1/
sys.path.insert(0, str(ROOT))
from lib import audio                                        # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "output"
VOICE_PREV = ROOT / "3-voiceover/020-trim-silence-run/output"
VIDEO_PREV = ROOT / "4-motion-graphics/020-build-graphics-agy/output"


def die(m): raise SystemExit("✖ " + m)


def infer_base():
    cands = sorted(VOICE_PREV.glob("*.voice.trim.wav"))
    if not cands:
        die(f"no voiceover found at {VOICE_PREV} — run 3-voiceover/020 first")
    return cands[-1].name.split(".voice.trim.wav")[0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base", nargs="?", help="topic base (default: infer from 3-voiceover/020)")
    ap.add_argument("--tolerance", type=float, default=0.5, help="max allowed duration mismatch, seconds")
    a = ap.parse_args()

    base = a.base or infer_base()
    voice = VOICE_PREV / f"{base}.voice.trim.wav"
    video = VIDEO_PREV / f"{base}.motion.mp4"

    if not voice.exists():
        die(f"no such file: {voice} (run 3-voiceover/020 first)")
    if not video.exists():
        die(f"no such file: {video} (run 4-motion-graphics/020 first)")

    voice_dur = audio.dur(voice)
    video_dur = audio.dur(video)
    if voice_dur == 0.0 or video_dur == 0.0:
        die(f"ffprobe couldn't read a duration (voice={voice_dur}, video={video_dur}) — "
            f"check both files are valid media")

    diff = abs(video_dur - voice_dur)
    if diff > a.tolerance:
        die(f"duration mismatch: video={video_dur:.2f}s voice={voice_dur:.2f}s "
            f"(diff {diff:.2f}s > tolerance {a.tolerance}s) — the motion-graphics render "
            f"(4-motion-graphics/020) did not hit the voiceover's duration. Fix the "
            f"composition's timeline length and re-render; do not proceed with a mismatched pair.")

    OUT.mkdir(parents=True, exist_ok=True)
    out_path = OUT / f"{base}.final.mp4"
    print(f"→ muxing: video={video_dur:.2f}s voice={voice_dur:.2f}s (diff {diff:.2f}s, within tolerance)")
    subprocess.run([
        "ffmpeg", "-y",
        "-i", str(video), "-i", str(voice),
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        str(out_path),
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    final_dur = audio.dur(out_path)
    print(f"✓ {out_path}  ({final_dur:.2f}s)")
    print("→ next: 6-thumbnail/010 (generate-thumbnail), then 7-upload/010 (package-for-handoff)")


if __name__ == "__main__":
    main()
```

Write `README.md`:

```markdown
# 5/010 · mux-final-video  ·  [RUN]  (final assembly step)

Muxes the voiceover audio with the rendered Hyperframes video into the final
MP4. Asserts the two durations match within 0.5s before muxing — the
pipeline's only arithmetic guardrail for the inverted sync model (motion
graphics render to FIT the voiceover, not the other way around).

- **In:** `../../3-voiceover/020-trim-silence-run/output/<base>.voice.trim.wav`
  + `../../4-motion-graphics/020-build-graphics-agy/output/<base>.motion.mp4`
- **Out:** `output/<base>.final.mp4`
- **Run:** `python3 run.py [<base>] [--tolerance 0.5]`
- **Fails loud, never silently truncates/pads** — a duration mismatch means
  something upstream (the motion-graphics render) is wrong; fix and re-render there.
- **Next:** step 6-thumbnail/010, then step 7-upload/010
```

**Verify**: `python3 -m py_compile pipelines/youtube/explainer-videos-pipeline-1/5-final-video-sync/010-mux-final-video-run/run.py` → exit 0.

### Step 2: Synthetic happy-path + failure-path test

```bash
cd pipelines/youtube/explainer-videos-pipeline-1/5-final-video-sync/010-mux-final-video-run
mkdir -p ../../3-voiceover/020-trim-silence-run/output ../../4-motion-graphics/020-build-graphics-agy/output

# Happy path: matching durations (5.0s each)
ffmpeg -y -f lavfi -i "sine=frequency=440:duration=5" ../../3-voiceover/020-trim-silence-run/output/smoketest.voice.trim.wav
ffmpeg -y -f lavfi -i "color=c=blue:s=320x240:d=5" -pix_fmt yuv420p ../../4-motion-graphics/020-build-graphics-agy/output/smoketest.motion.mp4
python3 run.py smoketest ; echo "exit=$?"
# Expect: exit=0, output/smoketest.final.mp4 exists, duration ≈5.0s
ffprobe -i output/smoketest.final.mp4 -show_format -v error | grep duration

# Failure path: mismatched durations (5.0s voice vs 8.0s video — diff 3.0s > 0.5s tolerance)
ffmpeg -y -f lavfi -i "color=c=red:s=320x240:d=8" -pix_fmt yuv420p ../../4-motion-graphics/020-build-graphics-agy/output/smoketest2.motion.mp4
ffmpeg -y -f lavfi -i "sine=frequency=440:duration=5" ../../3-voiceover/020-trim-silence-run/output/smoketest2.voice.trim.wav
python3 run.py smoketest2 ; echo "exit=$?"
# Expect: exit=1 (non-zero), stderr contains "duration mismatch", no output/smoketest2.final.mp4 written
test -f output/smoketest2.final.mp4 && echo "BUG: mismatched mux should not have produced output" || echo "correctly refused to mux"

# Clean up all fixtures
rm -rf ../../3-voiceover/020-trim-silence-run/output ../../4-motion-graphics/020-build-graphics-agy/output output
```

**Verify**: happy path exits 0 with a ~5.0s output file; failure path exits
non-zero with "duration mismatch" in stderr and produces NO output file; all
fixture directories removed afterward.

## Test plan

No test framework in `pipelines/`. Verification is `py_compile` plus the
synthetic ffmpeg-based happy/failure-path proof in Step 2, reported in the
run-log with actual exit codes and the ffprobe duration line.

## Done criteria

- [ ] `010-mux-final-video-run/{run.py,README.md}` exist, `run.py` compiles
- [ ] Happy-path synthetic test: exit 0, output file exists, duration ≈ input
- [ ] Failure-path synthetic test: exit 1, "duration mismatch" in stderr, no output file written
- [ ] All fixture files/directories removed after Step 2 (no leftover synthetic clips committed)

## STOP conditions

- `ffmpeg`/`ffprobe` not available on the executor's machine — stop and report (cannot verify without them)
- Any file already exists under `5-final-video-sync/` before Step 1 — stop, report, do not overwrite

## Maintenance notes

- The 0.5s tolerance is shared with plan 047's rulebook (Step 6 of
  `020-build-graphics-agy`'s rulebook.md) — change both together if it ever
  needs adjusting, so a render that self-reports as passing there also passes
  this hard gate.
- `-map 0:v:0 -map 1:a:0` deliberately drops any audio track already in the
  rendered `.motion.mp4` (Hyperframes renders may include scratch/no audio) —
  the voiceover from stage 3 is always the authoritative audio track.
