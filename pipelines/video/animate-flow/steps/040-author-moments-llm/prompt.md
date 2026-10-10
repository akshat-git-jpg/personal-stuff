# Animate one moment

You are designing ONE custom motion graphic for moment `{{ID}}` of a YouTube video, as a
HyperFrames composition. Everything you need is in this folder; do not look outside it.

The video is a screen recording with a voiceover. Our graphics sit on top of that
recording, or take over the frame for a moment and hand back to it. {{KIND_RULES}}
The voiceover keeps running underneath; the graphic is silent itself.

## Read first, in this order

1. `design-system/DESIGN.md`: the visual language. Use its exact colours, fonts and motion
   rules. It is a language, not a template: design this moment from scratch inside it.
2. `TASTE-ANIMATE.md`: the owner's rules for this recipe. Every rule binds you.
3. `moment.json`: the kind (`{{KIND}}`), the idea, why it earns a graphic, `busy` (where the
   recording moves during it), and every spoken word with its time in seconds from the
   start of this moment.
4. `recording.jpg`: a frame of the screen recording at this moment's key time. Look at it.
5. {{STORYBOARD}}
6. The `hyperframes`, `hyperframes-core`, `hyperframes-animation` and `gsap` skills: the
   composition contract. Follow the contract exactly; it is what the renderer needs.

## The frame checklist (every frame you show)

1. **The recording is the stage**, the one constant the eye holds. An overlay leaves the
   busy region visible; a takeover replaces the recording only for this idea.
2. **Act the idea out, do not label it.** A problem visibly breaks; a comparison shows
   two things that differ; a count lands item by item. A caption may name it; the picture
   shows it. No stick figures or clip-art stand-ins for the idea.
3. **One colour means one thing.** The accent marks the thing this moment is about,
   never decoration.
4. **Placed deliberately.** A takeover fills its frame: no empty band across a third of
   it, nothing wedged between a heading and the edge. An overlay is compact, off the busy
   region, not cramped against it. Elements never pile on each other or touch text.
5. **Vary scale**: hero type and a close detail, not every element at one size.
6. **Something new every 2-4 seconds**: a move, a reveal, a change. Never 4 seconds with
   nothing new on screen.
7. **A shot is complete on its first frame and its last.** No text half-drawn on frame 0
   or on the final frame: a reveal finishes before the moment ends, and what defines the
   frame is drawn (or a short entrance of at most 0.4s is running) when the cut lands.
8. **Transitions match the moment.** From the recording into a takeover: a short entrance
   (a wipe, a scale-in or a push of 0.2-0.4s), not a hard slam. At most one hard cut slam
   in the whole moment, and only on its payoff.
9. **Text is readable on a phone**: at least 48px on this frame, set like the design
   system's type, and each caption on screen at least 1.25s and no faster than 3.5
   words a second.
10. **The payoff lands in the pause.** The big reveal arrives in the gap before the line
    that names it, or on the word itself, never before the voice gets there.

### Banned defaults (they read as generic AI video)

A centred title on a gradient; everything fading in the same way; glows on chrome;
particle bursts; labels or borders parked in the corners; a logo sting as the ending.

### Motion

Things with mass move on springs, not on a plain ease: a little overshoot and a settle
for UI pieces, none for big type. In GSAP use a spring-like ease (`back.out(1.2-1.7)`,
`elastic.out(1, 0.6)` for playful pieces) or a closed-form spring in a custom ease; never
restart an ease mid-move.

## Build

{{FORMATS}}

For every composition:

- Root element:
  `<div id="root" data-composition-id="{{COMPOSITION_ID}}" data-start="0" data-width="<w>" data-height="<h>" data-duration="{{DURATION}}">`
  sized to exactly its format's width and height.
- One paused GSAP timeline registered as `window.__timelines["{{COMPOSITION_ID}}"]`.
- Exactly {{DURATION}} seconds long at {{FPS}}fps.
- Time every reveal to the word that says it, using the times in `moment.json`. Nothing
  appears before the voice gets to it, and the frame is never static.
- Product logos: look them up in `logos/registry.json`, copy the files you use into the
  composition's `assets/` and reference them as `assets/<file>`. No other local files.
- The only external request is the GSAP script from cdn.jsdelivr.net. Fonts are named in
  `font-family` and embedded by the renderer. No `<audio>`, no `<video>`.

## Check it, then look at it

Run these from this folder for each composition folder and fix everything they report:

```
npx -y {{HYPERFRAMES}} lint composition
npx -y {{HYPERFRAMES}} check composition --json
npx -y {{HYPERFRAMES}} snapshot composition --at {{SAMPLES}} --no-end --describe false -o snapshots
```

`lint` and `check` must report 0 errors. Then open every PNG in `snapshots/` with your
Read tool and judge it as the viewer will, against the frame checklist: is the idea acted
out and readable at a glance, does it follow the design system, is anything clipped,
crowded, half-drawn or too small? Fix and re-snapshot until it is right.

Finish with one short paragraph: what the graphic shows and how it moves. Then name its
weakest frame and what would fix it.
