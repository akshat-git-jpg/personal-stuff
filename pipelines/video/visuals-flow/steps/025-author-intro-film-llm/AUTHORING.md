## Your job
Read the approved `screenplay.json` and write ONE Hyperframes composition at `videos/<slug>/intro-film/film/index.html` covering the whole intro. One file, one continuous timeline. You are not assembling templates.

## What you may and may not read

**Read in full**: `../card-library/DESIGN.md` and `../card-library/logos/registry.json`.
The design system and the real logos are the BRAND. The first version of this film
was authored against `brand.json` — five colour tokens, no typography — and shipped
a largest-text of 54px in Helvetica with invented colours.

**Never read**: `catalog.json`, `card-plan.json`, `cues.json`, or any card under
`../card-library/<slug>/`. The card catalog is a TEMPLATE SET. The owner's
requirement is that templates do not influence the intro at all:

> "just make sure that it's not using templatized things for intro and those
> templates are not influencing this intro creation anyway. That context should
> not come in intro."

The intro has full creative freedom. A catalog in scope quietly removes it — you
would start picking rather than authoring. This is enforced by
`lib/intro-film/no-template-contamination.test.mjs`, which fails if any file in
this step's folder names the catalog outside a prohibition.

## Your inputs come from the pipeline, not from you

This step exists inside `visuals-flow` precisely so it does NOT re-derive
things the pipeline already knows. Deriving them again re-opens bugs that are
already fixed:

- **`transcript.json`** — word-level timings from `010-transcribe-run`, already
  through its quality pass. The standalone version transcribed the intro itself
  and put four of five product names wrong on screen ("Hejian", "Arcad",
  "Open Art", "Higgs Field"). Use `introWords()` from `lib/intro-film/inputs.mjs`.
- **`segments.json`** — the measured intro span from `015-map-segments-run`. Use
  `introSpan()`. Never guess where the intro ends.
- **`concept.json`** — the video's `throughline` and `registers`. **Enact them.**
  The body inherits the same through-line, so a film that invents its own motif
  breaks the seam into the body. On the reference video the throughline literally
  reads *"Opens as five blank, equal candidate cards in the intro roll call"* —
  the intro is where the body's central object is born.

## The canvas
1920x1080, 30fps, duration exactly `introSpan().duration`.

Declare it on the composition root — **CSS alone does not size the render.** A
composition that sets `width: 1920px` on `<body>` and nothing else renders
portrait 1080x1920, because Hyperframes reads the canvas from `data-width` /
`data-height`, never from stylesheets:

```html
<div id="root" data-composition-id="intro" data-start="0" data-duration="34.2"
     data-fps="30" data-width="1920" data-height="1080">
  <!-- every clip is a DIRECT child of this root -->
</div>
```

`data-start="0"` on the root is required — the runtime needs it to begin
playback, and lint errors without it.

The root **must** carry `data-composition-id`, and you **must** register a
timeline under that exact id:

```js
window.__timelines = window.__timelines || {};
window.__timelines['intro'] = tl;   // the id from data-composition-id
```

Capture readiness polls `window.__timelines[<data-composition-id>]`. If the key
is missing the render still succeeds but stalls 45s per worker first — a ~4s
render becomes ~95s. If your motion is pure CSS rather than a GSAP timeline,
register a stub that reports the real duration (`{ duration: () => 34.2, pause(){return this}, play(){return this}, seek(){return this}, totalTime(){return this}, kill(){} }`);
the CSS adapter still drives the actual motion.

## Hard Hyperframes rules
- **`<video>` and `<audio>` MUST be direct children of the host composition root (`index.html`).** Never inside a sub-composition `<template>` or a wrapper `<div>` — the runtime only registers and drives media at root level, and a nested `<video>` renders blank/black.
- **Clips must also be direct children of the composition root.** A clip nested inside a wrapper `<div>` is not registered.
- **`class="clip"` is required on visible timed elements** (`<div>`, `<img>`, …). Without it the runtime keeps the element visible for the whole composition.
- **Audio always lives on a separate `<audio>` element**, even when the source file is the same. The `<video>` is `muted`; the `<audio>` carries sound.
- **Every `id` must be unique across the assembled page.** Duplicate `<video>`/`<img>` ids render incorrectly.
- `data-start`, `data-duration`, `data-track-index` drive timing; `data-media-start` is an offset INTO the source media (this is how the film shows a later part of the avatar clip without trimming the file).
- `<video>` may omit `data-duration` to use the media's intrinsic length.

## The materials

Reference them as **`assets/<name>`, never `../<name>`.** A path above the project root is a hyperframes lint ERROR, and a lint error stops `check` from sampling layout or contrast at all — it reports `layout: ok` against zero samples. `lib/film-assets.mjs` links the workdir media into `film/assets/` before every review and render, so the files are there.

- `assets/vo.mp3` (the voice, on a root `<audio>`)
- `../screen.mp4` (the recording, available as a framed element when a beat wants it, not as a default backdrop — add it to `FILM_MEDIA` in `lib/film-assets.mjs` if a film uses it)
- `assets/avatar.mp4` (ONE clip covering the whole intro, muted, positioned by the beat's `face` value: `full` = full-frame, `panel` = docked, `none` = hidden). Because the avatar clip runs the full length, `data-media-start` is never needed to keep lip-sync — show it at its natural time offset. `full` means the presenter LEADS the frame, not that the presenter covers it: see TASTE-INTRO.md T5.

## Beat by beat
For each screenplay beat, honour `t_start`/`t_end` exactly, put the beat's `stage` on screen, respect its `register` as the colour world, and **implement `carries` literally**: the named object from the named earlier beat must be the SAME element, transformed — not a new element that resembles it. Recreating the object instead of transforming it is the defect this whole system exists to prevent.

## Brand
`DESIGN.md` is required reading and the rule is stated once, at the top of this
file under "What you may and may not read". What it covers: palette, type scale,
register definitions, the "enact, don't label" rule, the mute test, and what each
colour is allowed to mean — roughly 400 enforced lines.

Use `card-library/logos/registry.json` for real product logos. Do not draw a
coloured rectangle where a logo belongs.

DESIGN.md and the card library are **read-only from here.** Never edit either.

## Taste
Read `TASTE-INTRO.md` at the visuals-flow root. It is the accumulated record of what the owner has rejected on screen, as numbered rules. Some are enforced by the review pass; the rest will only be caught by you reading them.

## Review before you render
Run `bash run.sh <slug> intro-review` and fix everything it reports. It takes about two minutes against the HTML and needs no encode:

- `check` reports occluded text, overflow, contrast and runtime errors, sampled densely including transition seams
- `check-film-style` enforces the DESIGN.md type contract and flags any beat with no motion of its own
- three frames are captured per beat (25%, 55%, 85% through it) and `review/REVIEW.md` groups them under the `stage` line all three must satisfy between them. One midpoint frame is not enough: any beat whose content fires late reviews as empty

Read those frames against their stage lines. **Actually look at them.** That is the only pass that catches a beat which renders cleanly and still argues the wrong thing — a crown landing on the presenter is a green frame and a broken film, and four rails at 2px/20% opacity are a green frame with nothing on it.

`intro-render` is the LAST step, not the review step. It also refuses until the owner approves the film on the board (step 027).

## What good looks like
Something is moving at every second; the register visibly changes at the turn; the final beat resolves into a clean hand-off rather than fading out to nothing.
