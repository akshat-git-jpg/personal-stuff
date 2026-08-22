# 445 · re-render the intro cut list with the real avatar · [RUN]

The simple-flow twin of `440-rerender-intro-film-run`. The cut list approved
at 125 was rendered against a STATIC STAND-IN — a still image, standing in for
the avatar so review cycles do not re-encode a talking head to judge pacing.
This step swaps the stand-in for the real, downloaded `avatar.mp4` and
produces the file that actually ships.

- **In:** `videos/<slug>/avatar.mp4` (the real avatar) + the approved
  `intro-simple/cutlist.json`
- **Out:** `intro-film/out/intro.mp4`
- **Fails** non-zero if `avatar.mp4` does not exist yet — this is what stops a
  session from re-running the same stand-in and calling it done.

```bash
bash run.sh <slug> intro-simple-rerender
```

## Why it must never be skipped

If this step is skipped, the video ships with a still image where the
presenter should be — deliberately `"optional": false`, same as 440.
