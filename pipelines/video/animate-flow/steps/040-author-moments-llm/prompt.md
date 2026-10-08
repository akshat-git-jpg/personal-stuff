# Animate one moment

You are designing ONE custom motion graphic for moment `{{ID}}` of a YouTube video, as a
HyperFrames composition. Everything you need is in this folder; do not look outside it.
While it plays, the graphic fills the whole frame and the voiceover keeps running
underneath. It is silent itself.

## Read first, in this order

1. `design-system/DESIGN.md`: the visual language. Use its exact colours, fonts and motion
   rules. It is a language, not a template: design this moment from scratch inside it.
2. `TASTE-ANIMATE.md`: the owner's rules for this recipe. Every rule binds you.
3. `moment.json`: the idea, why it earns a graphic, and every spoken word with its time in
   seconds from the start of this moment.
4. The `hyperframes`, `hyperframes-core`, `hyperframes-animation` and `gsap` skills: the
   composition contract. Follow the contract exactly; it is what the renderer needs.

## Build `composition/index.html`

- One standalone composition. Root element:
  `<div id="root" data-composition-id="{{COMPOSITION_ID}}" data-start="0" data-width="{{W}}" data-height="{{H}}" data-duration="{{DURATION}}">`
  sized to exactly {{W}}x{{H}}px, with a full-bleed background child (not a background
  on the root itself).
- One paused GSAP timeline registered as `window.__timelines["{{COMPOSITION_ID}}"]`.
- Exactly {{DURATION}} seconds long at {{FPS}}fps.
- Time every reveal to the word that says it, using the times in `moment.json`. Nothing
  appears before the voice gets to it, and the frame is never static.
- Product logos: look them up in `logos/registry.json`, copy the files you use into
  `composition/assets/` and reference them as `assets/<file>`. No other local files outside
  `composition/`.
- The only external request is the GSAP script from cdn.jsdelivr.net. Fonts are named in
  `font-family` and embedded by the renderer. No `<audio>`, no `<video>`.

## Check it, then look at it

Run these from this folder and fix everything they report:

```
npx -y {{HYPERFRAMES}} lint composition
npx -y {{HYPERFRAMES}} check composition --json
npx -y {{HYPERFRAMES}} snapshot composition --at {{SAMPLES}} --no-end --describe false -o snapshots
```

`lint` and `check` must report 0 errors. Then open every PNG in `snapshots/` with your
Read tool and judge it as the viewer will: is the idea readable at a glance, does it
follow the design system, is anything clipped, overlapping or too small? Fix and
re-snapshot until it is right.

Finish with one short paragraph: what the graphic shows and how it moves.
