# BUILD BRIEF — motion pass (`test` video, scenes s01–s12)

**You are the motion driver (Antigravity).** The 12 static scenes are **approved
— the look is locked**. Your only job now is to **add the animation**: give each
scene a real GSAP timeline that animates its elements *in*. Do **not** change
layout, content, atoms, colors, or text. Rendering is local/free — iterate.

## Read first
1. `../../kit/recipes.js` — the `R.*` motion helpers you must use (don't hand-roll tweens).
2. `../../kit/examples/{01-title-card,02-loop-diagram,03-gauge,04-compare-cards}/index.html` — the **timeline sections** are your reference for cadence and which helper fits which atom. Copy their patterns.
3. `../storyboard.md` — the VO beat per scene tells you the *order* things should appear.

## The one rule that keeps the look locked
Each scene currently ends with an **empty** paused timeline. Replace it with `R.*`
tweens that are all **entrances** (`R.fadeUp`, `R.slideIn`, `R.popIn`,
`R.drawOn`, `R.countUp`, `R.staggerIn`, `R.grow`, `R.needle`). Because these use
GSAP `from()`, the timeline's **end state (progress = 1) equals the current
static look** — so you animate *into* the approved frame without changing it.
Never use a `to()` that leaves an element in a different final position/opacity.

## Helper → atom cheat sheet
- text (headline, caption, section-label, subtitle) → `R.fadeUp`
- pills / badges / stamps / icons → `R.popIn` (add `{stagger:0.1}` for a group)
- dashed connectors / rings / SVG strokes → `R.drawOn`
- big-stat numbers → `R.countUp`
- lists / agenda rows / card groups → `R.staggerIn`
- bars / status-bar fills → `R.grow` (`{axis:'x'}` for horizontal)
- gauge needle → `R.needle(..., {svgOrigin:'cx cy'})`
- watermark → `R.slideIn(tl,'.watermark',0.2,'right',{dist:24})` (every scene)

## Timing (restrained, ~3/10 — this is the house style)
- Choreograph in VO order: section-label/chrome first (~0.1s), then headline (~0.3s), then the diagram/body elements, captions last.
- Entrances finish within the **first ~40–60%** of the scene; the rest is a hold. Typical entrance 0.35–0.6s, stagger 0.06–0.12s.
- Draw connectors *after* the nodes they join appear.

## Hyperframes lint rules (or render fails)
- Animate the **inner content**, never a `class="clip"` shell.
- Timeline stays `gsap.timeline({paused:true})` and registered as `window.__timelines['main']`.
- **No `repeat:-1`.** If you want a breathing/pulse hold, use `R.pulse` (it derives a finite count).
- Deterministic only — no `Math.random`, `Date.now`, `fetch`, `requestAnimationFrame`.

## Per-scene loop
1. Open `scenes/sNN-<slug>/index.html`. Add `id`s to the elements you'll animate if they lack them.
2. In the `<script>`, replace the empty timeline with `R.*` entrance tweens (see cheat sheet + examples).
3. Verify:
   ```
   node lib/verify.mjs videos/test/scenes/sNN-<slug>
   ```
   The still it renders (at ~80% of the scene) should look like the approved static frame — if an element is missing there, its entrance is finishing too late; move it earlier.
4. Preview motion locally if unsure: `npx hyperframes@latest preview` then open the scene.

## Do NOT
- change any content/atoms/colors/text or the scene duration;
- add audio/VO or transitions between scenes (a later step stitches them);
- edit `../../kit/` (shared source).

When s01–s12 are done and pass verify, tell me and I'll render + stitch them into `test_cut.mp4`.
