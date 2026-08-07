# 108 · re-render the intro film with the real avatar · [RUN]

The intro is approved at 027 against a STATIC STAND-IN — a still image
composed into the design, standing in for the avatar so review cycles do not
re-encode megabytes of talking head to judge motion graphics. This step swaps
the stand-in for the real, rendered `avatar.mp4` and produces the file that
actually ships.

- **In:** `videos/<slug>/avatar.mp4` (the real avatar, downloaded at 100) +
  the approved `intro-film/screenplay.json`
- **Out:** `intro-film/out/intro.mp4`
- **Fails** non-zero if `avatar.mp4` does not exist yet — this is what stops a
  session from re-running the same stand-in and calling it done.

```bash
bash run.sh <slug> intro-rerender
```

## Why it must never be skipped

If this step is skipped, the video ships with a still image where the
presenter should be. It is deliberately `"optional": false` — nothing about
this step is a nice-to-have.
