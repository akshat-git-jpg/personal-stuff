# design-systems/tools

Turn a reference video whose look you like into a new design system folder,
`design-systems/<name>/` (`DESIGN.md` + `tokens.json` + `reference/`).

## Usage

```bash
cd pipelines/video/design-systems
node tools/from-reference.mjs <youtube-url | video-file> --name <slug> \
  [--start 2:33 --end 3:18] [--crop W:H:X:Y] [--frames 48]
```

- `--start/--end` pick the slice to study (20-40s of the richest animation works best).
  For a URL only that slice is downloaded.
- `--crop` isolates the artwork when the reference shows it inside an app, a browser or
  next to a webcam. Pixel values are in the downloaded video's size (`sourceSize` in
  `frames.json`). Check a crop first with
  `ffmpeg -ss <t> -i <video> -frames:v 1 -vf crop=W:H:X:Y /tmp/crop.png`.
- `--no-author` stops after the contact sheets; `--author-only` re-runs only the writing step.
  `--force` rebuilds over an existing `DESIGN.md`.

Two halves:

1. **Frames.** yt-dlp (`--no-update`, 360-480p, falls back to the android client on a 403),
   ffmpeg scene scores, ~48 frames (hard cuts + a uniform grid), 2 overview sheets, 1 motion
   sheet (three 0.8s strips at 10fps where the picture changes most without a hard cut: morphs,
   wipes, colour floods) and a measured pixel palette.
2. **Authoring.** A fresh `claude -p` (opus, Read/Write/Edit/Glob only, no MCP) runs
   [`author-design-system.md`](author-design-system.md) in a staging folder that holds only
   the sheets, `frames.json` and the prompt. It never sees this repo. Its `DESIGN.md` and
   `tokens.json` are copied into `design-systems/<name>/`. Read the sheets yourself after a
   run and check the result matches them.

## Where media goes

| What | Where |
|---|---|
| Downloaded slice, raw frames, sheets, staging folder, author log | `~/kb-scratch/video/design-systems/<name>/` |
| Contact sheets (only when each is under 500KB), `frames.json` | `design-systems/<name>/reference/` (committed) |

A sheet over 500KB stays in scratch and `frames.json` records its path. No video is ever
committed.

A design system is pure style. It must not carry rules about which element to use for
which line, template names, or pipeline steps.

## Tests

`node --test` in this folder (pure parts only, no network).
