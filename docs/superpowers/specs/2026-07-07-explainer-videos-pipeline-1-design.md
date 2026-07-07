# explainer-videos-pipeline-1 — design

**Date**: 2026-07-07
**Status**: approved, proceeding to implementation plans (`plans/044`–`050`)

## Problem

`pipelines/youtube/explainer-videos-pipeline-1/` has 7 empty stage folders
(`1-research` … `7-upload`), created when `tutorial-pipeline-2` was restructured
into stage folders (PR #4). This design fills them in with a fully generated
explainer-video pipeline — no screen recording, no avatar/talking-head, unlike
`tutorial-pipeline-2`. Everything is script → voiceover → Hyperframes motion
graphics → mux → thumbnail → package.

## Prior art reused

- `pipelines/youtube/tutorial-pipeline-2/` — stage-folder + numbered-step
  convention (`NNN-name-actor/` with `README.md` + `run.py`|`rulebook.md` +
  `output/`, ×10 numbering, `-run`/`-sonnet`/`-human` actor suffixes), the
  voiceover machinery (`lib/audio.py`, `asr.py`, `chunking.py`, `modal_tts.py`),
  and the step-170 packaging pattern.
- `pipelines/.claude/skills/yt-style-copy/` + `pipelines/youtube/competitor-styles/` —
  competitor style-cloning (`script-style-dna.md`/`rubric.md`/`exemplars/` for
  script voice; `video-style-dna.md`/`frames/exemplars/` for visual + thumbnail
  style), per channel under `channels/<slug>/`.
- Hyperframes — renders the motion graphics and the thumbnail (via
  `hyperframes snapshot`).

## Folder tree

```
explainer-videos-pipeline-1/
  lib/                              # own copies: audio.py, asr.py, chunking.py, modal_tts.py, drive.py
  shared/ref/owner-30s.wav          # ONE fixed reference voice (placeholder name; user drops file in)
  0-input/
    010-create-drive-folders-run/         [RUN]    --topic "..." → creates <fixed-root>/<topic>/{input,output}/
                                                     in Drive + locally; writes output/<base>.manifest.json
  1-research/                             (stays empty — intentional)
  2-scripting/
    010-write-script-opus/                [OPUS]   --slug <channel> --topic "..." → yt-style-copy write-script;
                                                     hard-stops if script-style-dna.md missing for <slug>
    020-review-script-human/              [HUMAN]  resolve [VERIFY:] placeholders, approve before TTS spend
    030-clean-script-for-tts-run/         [RUN]    strip markdown + rubric-comment; hard-fail if [VERIFY: remains
  3-voiceover/                            (core subset — no avatar machinery)
    010-synthesize-voice-run/             [RUN]    TTS via Modal IndexTTS-2, shared/ref/owner-30s.wav
    020-trim-silence-run/                 [RUN]
    030-voice-autoqc-run/                 [RUN]
    040-review-voice-human/               [HUMAN]  flagged chunks only
    050-make-timestamped-transcript-run/  [RUN]    word-level timings → the sync spine for stage 4
  4-motion-graphics/
    010-plan-visuals-opus/                [OPUS]   --slug <channel> → timed visual plan from video-style-dna.md
                                                     + script + timestamps; hard-stops if DNA missing; target
                                                     duration = voiceover duration exactly
    020-build-graphics-agy/               [AGY]    authors + renders a Hyperframes composition per the plan;
                                                     renders WITHOUT the interactive preview pause (unattended
                                                     pipeline step — human review happens after, at 030); MUST
                                                     render and inspect the output before marking done
    030-review-visuals-human/             [HUMAN]
  5-final-video-sync/
    010-mux-final-video-run/              [RUN]    ffmpeg-muxes voice + rendered video; asserts
                                                     |render_dur - vo_dur| <= 0.5s, fails loud on mismatch
  6-thumbnail/
    010-generate-thumbnail-opus/          [OPUS]   --slug <channel> → Hyperframes snapshot styled per
                                                     video-style-dna.md's "Thumbnail style"; hard-stops if
                                                     missing; outputs 1280x720 JPG
  7-upload/
    010-package-for-handoff-run/          [RUN]    copies final MP4 + thumbnail into 0-input's output/ folder
                                                     (NOT a real YouTube API upload — local/Drive packaging only)
```

## Key decisions (locked, from user Q&A + Opus review)

1. **Stage granularity**: numbered sub-steps per stage, mirroring
   `tutorial-pipeline-2` exactly (confirmed after that pipeline's restructure
   PR #4 was merged to `main`).
2. **Missing style-DNA**: every DNA-consuming step hard-stops and names the
   `yt-style-copy` verb to run — never auto-triggers the expensive build.
3. **`0-input`**: fixed root Drive folder
   (`https://drive.google.com/drive/folders/1nnTXY8sSXOVyHxHX1aPPUR3gQxtpcWFO`);
   user supplies `--topic` per run; idempotent via `pp-drive ensure-folder`
   (find-or-create), passing the fixed folder id directly as `--parent`
   (mirrors `tutorial-pipeline-2`'s step 010 exactly, minus the by-name
   root lookup since the root is already a known id).
4. **Motion graphics + thumbnail**: both render via Hyperframes. Thumbnail
   uses `hyperframes snapshot --at <t>` (there is no generic "render one
   frame" mode) on a short composition, then converts PNG → 1280×720 JPG.
5. **Voiceover scope**: core TTS/trim/QC/review/timestamp subset only — no
   avatar-block planning, no corner-render-parts (no avatar output exists in
   this pipeline at all).
6. **Reference voice**: one fixed checked-in file at
   `shared/ref/owner-30s.wav` (placeholder name — user drops the real sample
   in before the first real run; the step hard-stops with a clear message if
   it's missing).
7. **Sync model — inverted from `tutorial-pipeline-2`**: the voiceover's
   timestamped transcript is the timing spine; motion graphics render to fit
   it. `5-final-video-sync` only muxes + asserts duration match — no
   retiming math (unlike `tutorial-pipeline-2`'s 125-build-assembly-plan).
8. **Independent per-stage channel slugs**: `2-scripting`, `4-motion-graphics`,
   and `6-thumbnail` each take their own `--slug` — a deliberate, explicit
   choice (three separate style decisions), not an oversight. The per-topic
   manifest records all three for the user's own traceability; no hard
   consistency check is enforced.
9. **Runtime model per step** (distinct from the *build* executor below):
   `2-scripting/010`, `4-motion-graphics/010`, `6-thumbnail/010` are run in a
   Claude Code session on **Opus** when the pipeline is actually used to make
   a video. `4-motion-graphics/020` (build-graphics) is run via the
   **Antigravity CLI (`agy`)** at runtime too, with a mandatory render + visual
   inspection before it's considered done.
10. **Build executor** (who *writes this pipeline's code*, separate from #9
    above): **all seven implementation plans are dispatched to `agy`**, per
    explicit owner instruction — this overrides `tooling/boss/data/rules.md`'s
    normal difficulty-based default (which would otherwise route the
    `tricky`-graded plans to `claude-p`/opus).
11. **Hand-off route**: `/secretary raise` on each plan → `boss:ready` PR(s) →
    `boss` dispatches/verifies/merges. Not a direct dispatch from this session.

## Fixes incorporated from the Opus design review (2026-07-07)

- Script's QC scorecard lives inside `script.md` as a trailing HTML comment,
  not a separate file — copy `script.md` wholesale.
  `write-script`'s own internal outline-approval gate (Pass 1 → human
  approval → Pass 2) is distinct from and precedes this pipeline's own
  `020-review-script-human`, which reviews the finished, QC'd script.
- Added `2-scripting/030-clean-script-for-tts-run`: strips markdown + the
  rubric HTML comment, hard-fails if any `[VERIFY:` placeholder survived
  review — closes the "TTS speaks a placeholder aloud" risk.
- `lib/chunking.py` is required in the copied `lib/` set — confirmed (by
  reading `tutorial-pipeline-2/4-voiceover/080-synthesize-voice-run/run.py`)
  that chunking runs for every TTS call, not just avatar-block mode.
- `3-voiceover/010` is *adapted*, not copied verbatim: the avatar-segments
  branch and `write_avatar_outputs()` are removed entirely (always
  plain-text chunking mode); the redo-loop (`--only`) is kept.
- `5-final-video-sync/010` gets an explicit duration-mismatch guardrail
  (ffprobe both durations, assert within ±0.5s, fail loud) — the inverted
  timing model has no other arithmetic check.
- A per-topic manifest (`0-input`'s `output/<base>.manifest.json`),
  appended to by each stage, records the three chosen slugs + voiceover and
  render durations.
- `0-input` mirrors `tutorial-pipeline-2` step 010's idempotent
  `ensure_folder` pattern exactly.
- Default video spec: 1920×1080 @ 30fps, unless a chosen channel's
  `video-style-dna.md` indicates otherwise.
- Hyperframes' normal "pause before render" gate is explicitly overridden in
  the `4-motion-graphics/020` and `6-thumbnail/010` rulebooks (unattended
  pipeline steps; human review happens after, matching `tutorial-pipeline-2`'s
  own precedent where step 135 already auto-renders before step 140's human
  review).

## Out of scope (explicit)

- `1-research` stays empty — no automation.
- `7-upload` is packaging only, never a real YouTube API call.
- No auto-trigger of `build-script-style-dna` / `build-video-style-dna`.
- No avatar/talking-head output anywhere in this pipeline.
