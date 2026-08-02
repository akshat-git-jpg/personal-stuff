## Your job
Read the approved `screenplay.json` and write ONE Hyperframes composition at `videos/<slug>/film/index.html` covering the whole intro. One file, one continuous timeline. You are not assembling templates; there is no card catalog here and nothing to pick from.

## The canvas
1920x1080, 30fps, duration exactly `intake.json`'s `duration`.

Declare it on the composition root — **CSS alone does not size the render.** A
composition that sets `width: 1920px` on `<body>` and nothing else renders
portrait 1080x1920, because Hyperframes reads the canvas from `data-width` /
`data-height`, never from stylesheets:

```html
<div id="root" data-composition-id="intro" data-duration="34.2" data-fps="30"
     data-width="1920" data-height="1080">
  <!-- every clip is a DIRECT child of this root -->
</div>
```

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
- `../vo.mp3` (the voice, on a root `<audio>`)
- `../screen.mp4` (the recording, available as a framed element when a beat wants it, not as a default backdrop)
- `../avatar.mp4` (ONE clip covering the whole intro, muted, positioned by the beat's `face` value: `full` = full-frame, `panel` = docked, `none` = hidden). Because the avatar clip runs the full length, `data-media-start` is never needed to keep lip-sync — show it at its natural time offset.

## Beat by beat
For each screenplay beat, honour `t_start`/`t_end` exactly, put the beat's `stage` on screen, respect its `register` as the colour world, and **implement `carries` literally**: the named object from the named earlier beat must be the SAME element, transformed — not a new element that resembles it. Recreating the object instead of transforming it is the defect this whole system exists to prevent.

## Brand
Read `brand.json` from the pipeline root for palette and type tokens.

## What good looks like
Something is moving at every second; the register visibly changes at the turn; the final beat resolves into a clean hand-off rather than fading out to nothing.
