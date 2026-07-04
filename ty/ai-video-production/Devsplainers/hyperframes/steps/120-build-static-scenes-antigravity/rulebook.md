# Rulebook — 120 build-static-scenes  (driver: Antigravity)

Turn each storyboard row into a **static** scene — the final-frame look, **no
motion** (step 150 adds that). Rendering is local/free; iterate.

## Read first
1. `videos/<slug>/storyboard.md` — one row = one scene.
2. `../../kit/atoms.md` — the atom catalog. **Compose only from these.**
3. `../../kit/examples/*/index.html` — worked reference scenes (copy their patterns).
4. `../../videos/test/scenes/` — a full set already built this way.

## Folders are pre-scaffolded (step 110)
Each `videos/<slug>/scenes/sNN-<slug>/` already has a `kit` symlink, `meta.json`,
and a starter `index.html` (correct head, root `data-duration`, watermark, empty
timeline, a `TODO` body). **Replace the `#body` TODO** with the real composition;
keep the head, the watermark clip, the root attrs, and the empty-timeline script.

## Hard rules (or verify rejects it)
- **Only kit atoms + tokens.** No raw hex (use `var(--…)`); no non-kit fonts.
- **No motion this pass** — leave the timeline empty; build markup in its finished position.
- **Clip/track rules:** each visually-overlapping element is its own `class="clip"` with `data-start="0"`, `data-duration="<scene dur>"`, a **unique** `data-track-index`, and a stable `id`. Never animate a `.clip` shell.
- **Keep the watermark** on every scene.
- **Missing line-art icons:** author inline `<svg class="icon …" viewBox="0 0 48 48" fill="none">`, single-weight, no fill (see `atoms.md` §19 + examples 01/04).

## Per-scene loop
1. Open `scenes/sNN-<slug>/index.html`, read storyboard row NN.
2. Build `#body` from the row's atoms; set the accent.
3. `node lib/verify.mjs videos/<slug>/scenes/sNN-<slug>` → fix until `✓ PASS`.

## Review (step 140)
`node lib/serve.mjs` → http://localhost:4321 (contact sheet).

## Do NOT
add motion/audio/transitions, or edit `../../kit/` (flag a missing atom instead of hacking one scene).
