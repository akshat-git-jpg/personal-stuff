## How to use this
The session reads `qc/contact-sheet.jpg` (and the individual frames in `qc/frames/` when it needs a closer look) alongside `screenplay.json`. Score every line. Any FAIL means the film fails.

## The bar
- [ ] **Continuity** — for every beat whose screenplay entry has a non-null `carries`, the named object is visibly the same thing transformed, not a new element that resembles it. This is the single most important line.
- [ ] **Register** — the colour world visibly changes where the screenplay says it turns. A viewer should notice the shift without being told.
- [ ] **Motion** — something is moving in every second of the film. No dead stretch.
- [ ] **The face lands early** — the presenter is on screen within the first two beats, and reads as a person rather than a floating cut-out.
- [ ] **Typography** — no clipped, overflowing or overlapping text at any frame; no text too small to read at 1080p.
- [ ] **The hand-off** — the final beat resolves into a clean, deliberate exit rather than fading to nothing.
- [ ] **Not a slideshow** — moving through the contact sheet, the film reads as one continuous piece rather than a series of unrelated full-screen graphics. If you can point at the seams between beats, it fails.

## Verdict
Emit `PASS` or `FAIL` plus at most three concrete issues, each naming the beat id and what to change. On FAIL, the authoring step gets ONE retry with those issues; the second render goes to the owner regardless of its verdict.
