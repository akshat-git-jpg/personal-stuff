# BUILD BRIEF — static scene pass (`test` video)

**You are the scene-generation driver (Antigravity).** Turn each storyboard row
into a **static** Devsplainers-style motion-graphics scene. Static = the
final-frame look, **no motion yet** (a later pass adds GSAP). Rendering is local
and free; iterate freely.

## Read first (in this order)
1. `../storyboard.md` — the 31 scene specs (VO beat, visual metaphor, kit atoms, accent color, duration). One row = one scene.
2. `../../../kit/atoms.md` — the atom catalog: every class + which recipe/atom to use. **Compose only from these.**
3. `../../../kit/examples/{01-title-card,02-loop-diagram,03-gauge,04-compare-cards}/index.html` — worked reference scenes (few-shot). Copy their patterns.
4. `../../../SPEC.md` §3 (visual system) and §7 (verify checks).

## The folders are already scaffolded
`videos/test/scenes/s01-… … s31-…` each already contain:
- a `kit` symlink (→ the shared kit) — **do not delete it**; asset paths are root-relative `kit/tokens.css` etc. and resolve through it.
- `meta.json`
- a starter `index.html` with the correct `<head>`, root `data-duration`, watermark chrome, an empty registered timeline, and a `TODO` body.

**Your job per scene:** replace the `#body` TODO with the real composition for that row. Keep the `<head>`, the watermark clip, the root attrs, and the empty-timeline `<script>`.

## Hard rules (or it breaks)
- **Only kit atoms + tokens.** No raw hex colors (use `var(--…)`), no fonts other than the kit's (`var(--font-head)` / `var(--font-mono)`). The verify script rejects violations.
- **No motion this pass.** Leave the timeline empty (`gsap.timeline({paused:true})` registered as `window.__timelines['main']`). Do **not** add tweens — a later motion pass does that. Because the timeline is empty, the DOM's natural state IS the final look, so build the markup in its finished position.
- **Hyperframes clip/track rules:** every visually-overlapping element is its own `class="clip"` with `data-start="0"`, `data-duration="<scene dur>"`, and a **unique** `data-track-index`. Give each clip a stable `id`. Don't animate a `.clip` shell.
- **Keep the watermark** on every scene.
- **Missing line-art icons** (eye, ear, model-face, lock, laptop, waveform, translator/box, jigsaw): author them **inline** as `<svg class="icon …" viewBox="0 0 48 48" fill="none">` with `<path>`/`<line>` — single-weight, no fill (see `atoms.md` §19 and the icons already in examples 01 & 04). Stroke comes from `.icon` + a color modifier.

## Per-scene loop
1. Open `scenes/sNN-<slug>/index.html`, read storyboard row NN.
2. Build the `#body` composition from the specified atoms; set the accent per the row's color.
3. Verify (auto-renders a still + checks color/font/watermark/lint/canvas):
   ```
   node lib/verify.mjs videos/test/scenes/sNN-<slug>
   ```
   Fix anything it reports; repeat until `✓ PASS`.
4. Move to the next scene.

## Review the whole set
From the project root (`hyperframes/`):
```
node lib/serve.mjs      # http://localhost:4321 — contact sheet of all 31 scenes
```
Each tile shows the final composed frame. This is the human review gate — the look gets locked here before any motion is added.

## Do NOT
- add audio/VO, concatenate clips, or add transitions (deferred to a later phase);
- edit files under `../../../kit/` (that's the shared source — changing it affects every scene). If an atom is genuinely missing, flag it rather than hacking one scene.
