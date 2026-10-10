# 050 · review the frames · [RUN]

```
node lib/run.mjs <slug> review-frames [--only m02] [--no-snapshots] [--no-measure] [--no-cut]
```

The cheap pass before anything is encoded. Per moment and per format:

1. **Contract** (`lib/review-frames.mjs` `contractErrors`): composition id, canvas, duration
   equal to the moment, silent, no file outside `assets/` and no host beyond the GSAP CDN and
   Google Fonts.
2. **hyperframes check** through the kit (`lib/kit/hyperframes.mjs`): lint, runtime errors,
   layout overflow and occlusion, contrast. A lint error empties the later passes, so any
   error fails the step.
3. **Measured checks** (`lib/frame-checks.mjs` on the kit's box probe, every 0.25s of the
   composition in hyperframes' Chrome). They add what the hyperframes check does not already
   report; text-on-text overlap and text spilling out of its box stay hyperframes' job.
   - text cut off by the frame edge (hyperframes measures it but files it as info): error
   - crowding: a graphic colliding with text, peer icons piled on each other, or a graphic
     wedged beside hero type (neither attached nor clear), held 0.75s or more: warning
   - finished frame: text half-revealed on the moment's first or last frame: error; a
     takeover opening on an empty stage: warning
   - empty band (takeovers): the built-up frame spans under 55% of the height, or leaves an
     empty band of 30% or more: warning
   - covers busy (overlays): the overlay covers over 25% of where the recording moves during
     the moment (frame-difference motion map of `screen.mp4`, cached in `<media>/motion/`): error
4. **Three stills** near 25/55/85% of the moment, moved to the nearest instant with nothing
   half-revealed, into `<media>/review/<id>/`.
5. **The cut**, when one exists (070 also runs this after every cut): dead beats on the
   composite (no visible change for `review.deadMax` seconds, default 4; recording motion
   counts as change), attributed to moments or the recording, and the **phone sheet**
   `<media>/review/phone.jpg` (one frame a second, 360px wide; one per extra format).

`REVIEW.md` always ends with a `**Weakest moment:**` line: the moment with the most to fix
(errors weigh 3, warnings 1, dead seconds 0.5).

- **Out:** `review/REVIEW.md` + `review/check.json` + `review/cut.json` (gitignored, regenerated each run).
- Exit 1 on any error. Fix by re-running 040 for that moment (`--only`) or by a direct edit
  of `moments/<id>/index.html`.
- What it cannot see: whether the graphic is any good. That is the owner's call at 080.
