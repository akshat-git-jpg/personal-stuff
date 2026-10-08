# 010 · take in the sources · [RUN]

Names the video, copies its sources out of the way of the repo, and marks the workdir as an
animate run.

```
node lib/run.mjs <name> intake --audio <voiceover> [--screen <recording.mp4>] \
  [--title "<working title>"] [--design-system default] [--canvas 1920x1080] [--from <s> --to <s>]
```

- `<name>` goes through `vreg ensure` (`pipelines/video-registry`). The key it prints names
  the workdir; it may differ from the name you typed when another pipeline already knows the
  video.
- **In:** a voiceover file (any audio or video ffmpeg reads), optionally the screen recording.
  `--from/--to` trims both to a window, in seconds of the source.
- **Out:** `videos/<key>/run-config.json` (`template: "animate"`, `designSystem`, optional
  `canvas`, `total`), and in the media folder `~/kb-scratch/video/animate-flow/<key>/`:
  `audio.wav` (the mux source), `vo.mp3` (what the transcriber reads), `screen.mp4` if given.
- No screen recording is fine: 070 lays the moments over a plain bed in the design system's
  background colour.
