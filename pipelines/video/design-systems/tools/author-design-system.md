# Author a design system from a reference video

You are a motion designer reverse-engineering the visual style of a reference video so that
someone else can make NEW motion graphics in the same style, from scratch, in HTML/CSS/JS.

Design system name: `{{NAME}}`

## What is in this folder

{{SHEETS}}
- `frames.json` — the index: when each frame was taken (`t`, seconds in the source), which
  sheet and cell it sits in (cells count left to right, top to bottom), whether it was taken
  just after a scene change (`kind: "scene"`) or on a uniform grid (`kind: "uniform"`), and a
  `palette` measured from the frame pixels (hex + share of pixels).
- `overview` sheets: one frame per cell, timestamp burned in the top-left corner.
- `motion` sheets: each ROW is one short strip at the fps in `frames.json` (`sheets[].rows`),
  read left to right. Use these for easing, timing and transitions.

These files are your only source. You must not look outside this folder, and you must not
invent features you cannot point to in a frame.

## Steps

1. Read every sheet image. Read `frames.json`.
2. Decide what the reference's motion graphic actually is. If a frame shows app chrome,
   a timeline, a webcam bubble or a browser around the artwork, that is the recording, not
   the style: ignore it and describe only the artwork. The same goes for editor overlays
   inside the artwork: a grey checkerboard is transparency (no background), and small tag
   labels, bounding-box handles and cursors are selection UI. Say in one line what you ignored.
3. Separate what recurs (the style) from one-off content (the subject matter of this video).
   A design system is the recurring part only.
4. Write `DESIGN.md` and `tokens.json` in this folder (spec below). Nothing else.

## DESIGN.md — required sections, in this order

1. `# {{NAME}}` then a 2-3 line **essence**: the style in plain words, the feeling it gives,
   and the one thing that makes it recognisable.
2. `## Palette` — a table: role (background, primary shape, accent, ink, shadow...), hex,
   where you saw it (sheet + cell or timestamp). Start from the measured `palette` hexes;
   JPEG and video compression shift colours, so snap each to the clean flat value the
   designer most likely chose (say so when you snap). Note which pairings appear together and
   any colour that never appears (e.g. no gradients).
3. `## Typography` — families as best guess with a CSS fallback stack, weights, case, sizes
   relative to frame height, tracking, how text enters. If there is little or no text, say so
   plainly, and give the type that would fit the style.
4. `## Layout and composition` — canvas aspect, grid or centring habit, safe margins as % of
   frame, how much empty space, scale of the hero element relative to the frame, how many
   elements share a frame.
5. `## Shapes, texture and depth` — geometry vocabulary, stroke vs fill, corner radius,
   shadows (hard, soft, none), grain, gradients, lighting, perspective (flat, isometric, 3D).
6. `## Motion language` — easing (name a CSS cubic-bezier for each move type), typical
   durations in ms, entrance and exit habits, transition between scenes (cut, morph, wipe,
   colour flood...), secondary motion (overshoot, squash, idle loops), rhythm (how long a
   state holds). Cite the motion strip rows you read it from.
7. `## Recurring devices` — named, reusable moves this style keeps using (e.g. "background
   colour flood on scene change"), each with a one-line recipe.
8. `## Do` and `## Don't` — short bullets. The don'ts are what would break the style.
9. `## Expressing ideas in this style` — 3 to 5 worked examples. Each takes an abstract idea
   a narrator might say (e.g. "costs dropped by half", "three tools work together", "this
   step is slow", "a warning", "before vs after") and describes the frame-by-frame animation
   in this style: elements, colours by token name, layout, motion with timings.
10. `## Evidence and confidence` — what you are sure of, what you guessed, and what the
    frames could not show.

Keep it under ~250 lines. Concrete values beat adjectives: every claim a designer acts on
should carry a number, a hex or a timing.

## tokens.json — shape

```json
{
  "name": "{{NAME}}",
  "color": { "<role>": "#rrggbb" },
  "font": { "display": "<css stack>", "body": "<css stack>", "mono": "<css stack>" },
  "type": { "<role>": { "sizeVh": 0, "weight": 0, "tracking": "0em", "case": "none|upper" } },
  "space": { "marginPct": 0, "gapPct": 0 },
  "radius": { "<name>": "0px" },
  "shadow": { "<name>": "<css box-shadow or none>" },
  "stroke": { "<name>": 0 },
  "ease": { "<name>": "cubic-bezier(...)" },
  "duration": { "<name>": 0 },
  "motion": { "holdMs": 0, "transition": "<short phrase>" }
}
```

Values in `duration` and `holdMs` are milliseconds. Use the same token names in DESIGN.md.
The file must be valid JSON.

## Scope

This is pure visual style. It must not contain rules about which on-screen element to use for
which kind of sentence, template names, catalogue entries or editing-pipeline steps; those
belong to whoever uses the design system, not to the design system.
