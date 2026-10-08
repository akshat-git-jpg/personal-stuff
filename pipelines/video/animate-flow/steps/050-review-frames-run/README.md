# 050 · review the frames · [RUN]

```
node lib/run.mjs <slug> review-frames [--only m02] [--no-snapshots]
```

The cheap pass before anything is encoded. Per moment:

1. **Contract** (`lib/review-frames.mjs` `contractErrors`): composition id, canvas, duration
   equal to the moment, silent, no file outside `assets/` and no host beyond the GSAP CDN and
   Google Fonts.
2. **hyperframes check** through the kit (`lib/kit/hyperframes.mjs`): lint, runtime errors,
   layout overflow and occlusion, contrast. A lint error empties the later passes, so any
   error fails the step.
3. **Three stills** at 25/55/85% of the moment, into `<media>/review/<id>/`.

- **Out:** `review/REVIEW.md` + `review/check.json` (gitignored, regenerated each run).
- Exit 1 on any error. Fix by re-running 040 for that moment (`--only`) or by a direct edit
  of `moments/<id>/index.html`.
- What it cannot see: whether the graphic is any good. That is the owner's call at 080.
