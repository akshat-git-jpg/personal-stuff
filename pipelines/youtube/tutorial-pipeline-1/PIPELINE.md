# tutorial-pipeline-1

Turns a Drive folder of 3 raw segments (`intro.mp4`, `body.mp4`, `conclusion.mp4`) into 3
HeyGen-avatar "spokesperson" renders, dropped back into that same Drive folder. Standalone — does
not feed into or read from `tutorial-pipeline-2`.

## Drive layout

```
{title}_xx or {title}_yy/     ← the folder you link
  input/                      ← optional: intro.mp4, body.mp4, conclusion.mp4
                                 (falls back to reading them from the folder root if input/ is absent)
  output/                     ← find-or-created: spokesperson_intro/body/conclusion.mp4 land here
```

## The flow (run top to bottom)

| # | Step | Actor | In → Out |
|---|------|-------|----------|
| 010 | `resolve-drive-input` | [RUN] | Drive folder link → `intro/body/conclusion.mp4` downloaded from `input/` (or the folder root) + type (`xx`/`yy`) detected |
| 020 | `extract-audio` | [RUN] | each segment's video → its audio track (`.wav`) |
| 030 | `submit-avatar-renders` | [RUN] | audio + avatar mapping → HeyGen submit (no polling) |
| 040 | `download-avatar-renders` | [HUMAN] | check HeyGen → download finished `.mp4`s |
| 050 | `package-and-upload` | [RUN] | rename to `spokesperson_*` + upload into `output/` (find-or-created) in the source Drive folder |

```
Drive folder "{title}_xx" or "{title}_yy"
   │ 010 resolve drive input      [RUN]    → reads input/ (or root) → intro/body/conclusion.mp4 (local)
   │ 020 extract audio            [RUN]    → intro.wav, body.wav, conclusion.wav
   │ 030 submit avatar renders    [RUN]    → HeyGen submit per segment (no polling)
   │ 040 download avatar renders  [HUMAN]✋ → check HeyGen, download when ready
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
    avatar_mapping.py   ← EDIT: real HeyGen avatar ids per type, segment→engine rule
  steps/<NNN-name-actor>/
    README.md, run.py (or download.py + check.py for the human step), output/
```

## Conventions
Same as `tutorial-pipeline-2`: ×10 step numbering, `-run`/`-human` actor suffix, each step reads
`../<prev>/output/…` and writes its own `./output/…`, no HeyGen polling (anti-ban).

## Status
`030`'s HeyGen submit calls `generate-from-audio`, whose HTTP body is a `[TODO][HNS]` stub in
`tooling/cli/heygen-web/heygen-web.mjs` — needs a HAR capture (Preserve Log ON) of "existing avatar
+ uploaded audio + Generate" to go live. Every other step is real today.
