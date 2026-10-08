# robonuggets-flat

One flat icon object sits in the middle of a full-bleed, single-colour field: cream, mustard yellow or electric blue.
It feels calm, editorial and tactile, like a paper cut-out on a coloured card.
The recognisable move: the background colour floods in with a soft, blurred, wavy edge while the hero object morphs into the next icon.

Ignored: the grey checkerboard (editor transparency, 2:42.7-2:59.8), the orange "Shape: ..." tag labels, bounding-box corner dots, the crosshair cursors and the white scrubber bar at the bottom edge.

## Palette

| Token | Hex | Role | Seen at |
|---|---|---|---|
| `paper` | `#eeece0` | background, calm/opening state | sheet-1 cells 1-5 (2:33.5-2:37.4). Measured `#ecebde`, snapped warmer/lighter |
| `mustard` | `#ecbf35` | background, main brand field | sheet-1 cells 6-9, sheet-2 cells 18-24. Measured `#e9bd38`, snapped |
| `cobalt` | `#2b2bd6` | background, "speed / sky" field | sheet-2 cells 6-17. Measured `#2c2bd2`, snapped |
| `ink` | `#17161a` | hero solid (pen nib), ground band | sheet-1 cells 1-5, sheet-2 cells 6-14. Measured, kept |
| `signal` | `#d93333` | primary hero fill (disc, ring) | sheet-1 cells 6-24, sheet-2 cells 18-24. Measured `#d83232`, snapped |
| `amber` | `#e9a03c` | second half of a split disc | sheet-2 cells 18-24 (3:11.9+). Guessed from the frame, not in measured list |
| `chalk` | `#f6f4ec` | light hero (moon disc, paper plane, dashed path) | sheet-2 cells 5-17 |
| `plane-shade` | `#b9b6e8` | shaded side of a white object | sheet-2 cells 1-2, 15-17 |
| `shadow` | `#17161a` at 25-35 % | soft contact shadow under an object | sheet-1 cells 4-5 |
| `footer-ink` | `#17161a` at 70 % on light fields, `#ecebde` at 70 % on `cobalt` | footer caption | all artwork cells |

Pairings seen: `ink` on `paper`, `signal` (+ `mustard` inner ring) on `mustard`, `chalk` on `cobalt` with `ink` ground, `signal` + `amber` split disc on `mustard`.
Never seen: hard gradients on backgrounds, outlines in a third colour, green, purple, photo textures.
The only gradients are soft blurs at flood edges and a faint radial falloff of the `mustard` flood (motion row 1).

## Typography

There is little text. The artwork shows only a small footer row, about 2-3 % of frame height.

- Footer left (x ≈ 4 %, y ≈ 92 %): a tiny index (`01 / 04` style, `footer-ink` at 50 %), then a bold word ("Ink", "Write", "Faster", "Half the price"), then a lighter grey subline.
- Footer right: a row of 3-4 small dashes as a progress marker, the active dash longer and darker.
- Family guess: a geometric grotesk. Use `"Inter", "Helvetica Neue", Arial, sans-serif` for `display` and `body`.
- Weights: label 700, subline and index 400. Sentence case. Tracking 0em on the label, 0.02em on the subline.
- Text does not animate in the frames. The footer label swaps with a hard cut at the scene change (2:38.4 "Write" → 2:40.3 "Half the price").
- If a title is needed, use `display` at 6 vh, weight 700, sentence case, `ink` on light fields, `chalk` on `cobalt`. This is a guess, not seen.

## Layout and composition

- Canvas 16:9 (source 640x360).
- One hero object, centred on x. The vertical centre sits at 45-50 % of height (pen nib 2:36.5, disc 2:39.4).
- Hero size: disc diameter ≈ 38 % of frame height (2:39.4). Pen nib height ≈ 35 % of frame height. Plane width ≈ 18 % of frame width (3:09.0).
- Safe margin ≈ 4 % on each side, set by the footer row.
- Empty space is ≈ 85-90 % of the frame. Max elements per frame: hero, its shadow or ground, one path line, footer.
- The ground band (3:01.7) fills the lower 45 % of the frame with a soft wavy top edge.

## Shapes, texture and depth

- Vocabulary: circles, concentric rings, half-circles, a leaf/shield (pen nib), a paper-plane triangle set, a wavy horizon band, a dashed curve.
- Fill only. No outlines on objects. Rings are built as filled annuli, not strokes: `signal` disc, `mustard` gap ≈ 4 % of disc diameter, `signal` ring ≈ 7 % of diameter (2:39.4).
- Corners: soft, small radius on pointed tips (≈ 2-4 px at 1080p). Circles are perfect.
- Depth: flat with a hint of paper. The pen nib has a subtle lighter facet on the left. The plane has a `plane-shade` underside.
- Shadow: soft contact shadow only, a thin flat ellipse/bar under the object (2:36.5 blurred, 2:37.4 crisp line). Token `shadow.contact`.
- Faint concentric echo rings around the hero, `signal` at ≈ 8 % opacity, radius 1.5x and 2x (3:12.9).
- Grain: none visible. Perspective: flat, frontal.
- Dashed path: `chalk`, ≈ 2 px stroke, dash 6 / gap 6, trailing behind a moving object (3:09.0).

## Motion language

Read from `motion-1.jpg`, 10 fps strips.

- **Colour flood (row 1, 2:37.7-2:38.2).** A `mustard` circle grows from the hero centre over `paper`. The edge is blurred (≈ 6 % of frame) and fills the frame in ≈ 400 ms. Ease `ease.flood` = `cubic-bezier(0.7, 0, 0.3, 1)`. Duration `duration.flood` = 400.
- **Morph (row 1).** During the flood the pen nib turns into the `signal` disc. The colour shifts first, the shape rounds over 2 frames, the ring lands at 2:38.2. Duration `duration.morph` = 300, ease `ease.morph` = `cubic-bezier(0.65, 0, 0.35, 1)`.
- **Wavy wipe (row 2, 3:08.4-3:08.7).** The `ink` ground band slides down and out of the frame in ≈ 300 ms with a blurred wavy edge. The moon disc morphs into the plane at the same time. Ease `ease.wipe` = `cubic-bezier(0.6, 0, 0.4, 1)`.
- **Travel (row 2, 3:08.5-3:08.9).** The plane moves up-right along the dashed path, ≈ 10 % of frame width in 400 ms, then settles. Ease `ease.out` = `cubic-bezier(0.22, 1, 0.36, 1)`.
- **Wavy wipe from top (row 3, 3:10.7-3:11.2).** A `mustard` band with a blurred wavy edge descends over `cobalt` in ≈ 500 ms. It wobbles 1-2 % in height before it drops (3:10.8-3:11.0).
- **Motion blur.** Fast moves smear the object (plane 3:10.0, disc 3:11.3). Use `filter: blur(4-8px)` on the moving element for 2-3 frames.
- **Idle.** While a state holds, the hero barely moves. The ring pulses slightly (2:38.4 → 2:39.4 the ring settles). No bounce or squash.
- **Rhythm.** A state holds 2-6 s (`motion.holdMs` = 3000). Transitions are short (300-500 ms). The footer label cuts, it does not animate.
- **Scene change** = colour flood or wavy wipe plus a hero morph. No hard cuts in the artwork.

## Recurring devices

- **Radial colour flood:** new background circle scales from 0 to 150 % of the frame diagonal from the hero centre, edge `blur(40px)`, 400 ms `ease.flood`.
- **Wavy band wipe:** a full-width band with a sine edge (amplitude ≈ 3 % height, 2 waves) and `blur(12px)` slides in or out vertically, 300-500 ms `ease.wipe`.
- **Hero morph:** cross-fade + scale between two icons at the same centre, 300 ms `ease.morph`, 4px blur at the midpoint.
- **Ring target:** `signal` disc, `mustard` gap, `signal` annulus, plus two faint echo rings.
- **Split disc:** disc cut at the vertical diameter, left half `signal`, right half `amber`, inside the ring.
- **Dashed trail:** `chalk` dashed curve that draws behind a moving object (`stroke-dashoffset`, 400 ms `ease.out`).
- **Contact shadow:** soft `ink` ellipse under a standing object, width ≈ 120 % of object width.
- **Footer caption:** index, bold word, subline at bottom-left, progress dashes at bottom-right.

## Do

- Use one full-bleed flat field per scene: `paper`, `mustard` or `cobalt`.
- Keep one hero object, centred, ≈ 35-40 % of frame height.
- Change scene by flood or wavy wipe, with the hero morph in the same 300-500 ms.
- Build rings from filled shapes and colour gaps.
- Hold each state 2-6 s with almost no motion.
- Add blur to fast moves and to flood edges.

## Don't

- Do not put two heroes side by side or fill the frame with UI.
- Do not use outlines, drop shadows below cards, or gradients on backgrounds.
- Do not hard-cut the background colour.
- Do not use bounce, elastic overshoot or squash.
- Do not add large text. Text stays in the small footer.
- Do not introduce colours outside the palette.

## Expressing ideas in this style

1. **"Costs dropped by half."** `mustard` field. A full `signal` ring target holds 1 s. The right half of the inner disc cross-fades to `amber` over 300 ms `ease.morph`, from the vertical diameter outward. Echo rings fade in to 8 % over 400 ms. Hold 3 s. Footer: "Half the price".
2. **"This step is fast."** `cobalt` field with an `ink` wavy ground. A `chalk` disc rests on the horizon for 1.5 s. The ground wipes down in 300 ms `ease.wipe`. The disc morphs into the plane in 300 ms, then travels up-right 10 % in 400 ms `ease.out` with a dashed trail. Footer: "Faster".
3. **"Start writing."** `paper` field. The `ink` pen nib rises 3 % into place over 400 ms `ease.out`. Its contact shadow sharpens from `blur(6px)` to a crisp bar. Hold 3 s.
4. **"A warning."** `paper` field. A `mustard` radial flood grows from centre in 400 ms `ease.flood`. The current hero morphs into the `signal` ring target in 300 ms. The ring pulses once to 104 % over 300 ms. Hold 2 s.
5. **"Before vs after."** Show the "before" hero on `cobalt`. A `mustard` wavy band wipes down from the top in 500 ms `ease.wipe`. The hero blurs to 8px and morphs into the "after" icon on `mustard`. The footer label cuts at the end of the wipe.

## Evidence and confidence

- Sure: the three background colours, `signal` and `ink`, centred single hero, flood and wavy wipe transitions, motion blur, footer layout (sheet-1, sheet-2, motion rows 1-3).
- Snapped: all hexes. Video compression shifts flat colours by 2-6 levels.
- Guessed: font family, `amber` hex, exact easing curves (10 fps strips give only 3-5 frames per move), echo-ring opacity, dash size.
- Not shown: any headline text, how text enters, exit animations to black, behaviour of more than one hero, sound sync. About 40 % of the slice is editor view on a transparent canvas.
