# Rulebook — 230 create-thumbnail

Design and render the YouTube thumbnail (1280×720) in the channel's look, reusing
the kit. The thumbnail owns CTR — it is NOT the title repeated; it's one bold idea.

## Input → Output
`videos/<slug>/script.md` (the hook / signature beat) + `kit/` →
`videos/<slug>/renders/<slug>_thumb.png`

## Design rules
- **Canvas 1280×720** (16:9). Near-black bg, kit tokens only (colors/fonts).
- **≤ 4 words**, huge Anton caps, one hero word in an accent color. Punchy, curiosity-driven — not the full title.
- **One hero visual** — a single big line-art icon or the video's signature graphic (reuse a scene's key atom). No clutter; readable as a tiny mobile thumbnail.
- Optional small `<devsplainers>` mark; skip the busy chrome (section labels/catch-stack).
- High contrast; test legibility at ~120px wide.

## How to build + render
1. Make `videos/<slug>/thumb/` with a `kit` symlink (→ the shared kit) and an `index.html`:
   - root `data-width="1280" data-height="720"`, single static `clip` (empty timeline is fine).
   - compose from kit atoms; headline via `.headline`, hero icon inline `<svg class="icon ...">`.
2. Render one frame to PNG:
   ```
   npx hyperframes@latest snapshot videos/<slug>/thumb --at 0 -o videos/<slug>/renders/thumb
   ```
   then move/rename the PNG to `videos/<slug>/renders/<slug>_thumb.png`.
3. Eyeball it small; iterate on wording/visual.

## Then
▶ print the thumbnail path — video (from 210) + thumbnail are ship-ready.
