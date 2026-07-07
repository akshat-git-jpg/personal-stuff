# Rulebook — 150 build-motion-scenes  (driver: Antigravity)

The static scenes are **approved — the look is locked**. Add animation only: give
each scene a GSAP timeline that animates its elements *in*. Do **not** change
layout, content, atoms, colors, text, or duration.

## Read first
1. `../../kit/recipes.js` — the `R.*` helpers you must use (don't hand-roll tweens).
2. `../../kit/examples/*/index.html` — the timeline sections are your cadence reference.
3. `../../videos/test/scenes/s01`…`s12` — a full set already animated this way.

## The one rule that keeps the look locked
Each scene ends with an **empty** paused timeline. Replace it with `R.*`
**entrances** (`fadeUp`, `slideIn`, `popIn`, `drawOn`, `countUp`, `staggerIn`,
`grow`, `needle`). These use GSAP `from()`, so the timeline's end state
(progress = 1) equals the approved static frame — you animate *into* it without
changing it. Never use a `to()` that leaves an element in a new final state.

## Helper → atom
- text → `fadeUp` · pills/badges/icons → `popIn` (`{stagger:0.1}` groups)
- connectors/SVG strokes/rings → `drawOn` · big-stat → `countUp`
- lists/card groups → `staggerIn` · bars/fills → `grow` (`{axis:'x'}` horizontal)
- gauge needle → `needle(..., {svgOrigin:'cx cy'})` · watermark → `slideIn(...,'right')`

## Timing (restrained, ~3/10)
Choreograph in VO order (chrome → headline → body → captions). Entrances finish
in the first ~40–60% of the scene; the rest holds (the scene is as long as its VO
clip). ~0.35–0.6s each, stagger ~0.06–0.12s. Draw connectors after their nodes appear.

## Lint traps (or render fails)
Animate inner content, never a `.clip` shell. Timeline stays
`gsap.timeline({paused:true})` registered as `window.__timelines['main']`. **No
`repeat:-1`** — use `R.pulse`. Deterministic only.

## Per-scene loop
1. Add `id`s to elements you'll animate if they lack them.
2. Replace the empty timeline with `R.*` entrances.
3. `node lib/verify.mjs videos/<slug>/scenes/sNN-<slug>` → the ~80% still should match the approved static frame; if something's missing, its entrance ends too late — move it earlier.

## Review (step 170)
`node lib/serve.mjs` → http://localhost:4321, "play motion" on.
