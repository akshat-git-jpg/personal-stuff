# tutorial-pipeline-1

Turns a Drive folder of 3 raw segments (`intro.mp4`, `body.mp4`, `conclusion.mp4`) into 3
HeyGen-avatar "spokesperson" renders, dropped back into that same Drive folder. Standalone — does
not feed into or read from `tutorial-pipeline-2`.

Each type (`g1`/`g2`) maps to a HeyGen **template** id (a pre-composed background + avatar
bubble, already correctly framed for its own aspect ratio) — NOT a raw avatar id. See
`tooling/cli/heygen-web/API-REFERENCE.md`'s "Create from template" section.

## Drive layout

```
{title} @ g1 or {title} @ g2/  ← the folder you link
  input/                      ← optional: intro.mp4, body.mp4, conclusion.mp4
                                 (falls back to reading them from the folder root if input/ is absent)
  output/                     ← find-or-created: spokesperson_intro/body/conclusion.mp4 land here
```

## The flow (run top to bottom)

| # | Step | Actor | In → Out |
|---|------|-------|----------|
| 010 | `resolve-drive-input` | [RUN] | Drive folder link → `intro/body/conclusion.mp4` downloaded from `input/` (or the folder root) + type (`g1`/`g2`) detected |
| 020 | `extract-audio` | [RUN] | each segment's video → its audio track (`.wav`) |
| 030 | `submit-avatar-renders` | [RUN] | audio + avatar mapping → HeyGen submit (no polling) |
| 040 | `download-avatar-renders` | [RUN] | waits once per segment (clip duration + buffer, no polling) → one download attempt |
| 050 | `package-and-upload` | [RUN] | rename to `spokesperson_*` + upload into `output/` (find-or-created) in the source Drive folder |

```
Drive folder "{title} @ g1" or "{title} @ g2"
   │ 010 resolve drive input      [RUN]    → reads input/ (or root) → intro/body/conclusion.mp4 (local)
   │ 020 extract audio            [RUN]    → intro.wav, body.wav, conclusion.wav
   │ 030 submit avatar renders    [RUN]    → HeyGen submit per segment (no polling)
   │ 040 download avatar renders  [RUN]     → timed wait per segment (no poll), one download attempt
   │ 050 package + upload         [RUN]    → spokesperson_{intro,body,conclusion}.mp4 → Drive output/
   ▼
3 spokesperson clips, local + in Drive's output/ subfolder
```

## Layout
```
tutorial-pipeline-1/
  PIPELINE.md
  lib/            drive.py (pp-drive wrapper), audio.py (ffmpeg), heygen.py (heygen-web wrapper)
  shared/
    avatar_mapping.py   ← EDIT: real HeyGen template id per type
  ui/                   ← local UI wrapper (dashboard app `avatar renderer`, :4371) that runs steps 010→050 as one job. The five steps remain the source of truth.
  steps/<NNN-name-actor>/
    README.md, run.py, output/
```

## Conventions
Same as `tutorial-pipeline-2`: ×10 step numbering, `-run`/`-human` actor suffix, each step reads
`../<prev>/output/…` and writes its own `./output/…`, no HeyGen polling (anti-ban) — 040 waits a
computed duration instead of polling status.

Graphics step: consume `pipelines/video/graphics-flow` per its INTEGRATION.md (workdir-by-path contract).

## Status
`030`'s HeyGen submit calls `generate-from-template` — real and HAR-verified 2026-07-09
end-to-end (real render, downloaded, confirmed correctly composed). Every step is real today.
