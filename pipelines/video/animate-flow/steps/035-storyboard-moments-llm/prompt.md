# Storyboard the moments

You are drawing the storyboard for {{COUNT}} motion-graphic moments of one YouTube video:
one key still per moment ({{IDS}}). Everything you need is in this folder; do not look
outside it.

The video is a voiceover over {{BED}}. Each moment either **takes over** the whole frame
for a few seconds and then hands back to the recording, or sits **on top of** the
recording as an overlay while the recording keeps playing. The owner approves or rejects
each still before anyone animates it, so a still is cheap and fast: a draft of the one
frame that carries the idea, not the animation.

## Read first

1. `TASTE-ANIMATE.md`: the owner's rules for this recipe. Every rule binds you.
2. `design-system/DESIGN.md`: the visual language. Use its exact colours and fonts.
3. `moments.json`: per moment its `kind`, idea, why, spoken words with times, `busy` (where
   the recording moves, which an overlay must stay off), and `ownerNote` if the owner
   rejected an earlier still. An owner note overrides the idea where they disagree.
4. `recording/<id>.jpg`: a frame of the screen recording during that moment. Look at it.

## The frame checklist (every still)

1. **The recording is the stage.** It is the constant the eye holds. An overlay sits on it
   and leaves the region the voice is talking about (`busy`) visible. A takeover replaces
   it for a moment and must earn that.
2. **Act the idea out, do not label it.** A problem is something visibly breaking; a
   comparison is two things side by side that differ. A caption can name it; the picture
   has to show it. No stick figures or clip art standing in for the idea.
3. **One colour means one thing.** The accent colour marks the one thing the moment is
   about, never decoration.
4. **No AI defaults:** no centred title on a gradient, no glows, no particle bursts, no
   labels or borders parked in the corners, no "everything fades in".
5. **Placed deliberately.** A takeover fills its frame: no empty band across a third of
   it. An overlay is compact and placed off the busy region, not cramped against it.
6. **Vary scale across the board.** Wides, mids and at least one close-up across the
   moments, not one framing repeated.
7. **Text is set like the design system's type**, at least 48px on this {{W}}x{{H}} frame,
   one short line per element, nothing touching another element or the frame edge.
8. **Finished.** The still is the moment's fullest frame: every word that is on screen is
   fully drawn.

## Write

For every moment, `stills/<id>.html`: one static page exactly {{W}}x{{H}}px (`html, body`
sized to it, `margin: 0`, `overflow: hidden`), no script, no animation. Fonts by
`font-family` (Google Fonts links are fine). A logo from `logos/registry.json` is copied
to `stills/assets/<file>` and referenced as `assets/<file>`. No other files, no
`<video>`, no `<audio>`.

- **takeover:** the page paints the whole frame (a full-bleed background).
- **overlay:** `html` and `body` are `background: transparent`; paint only the graphic.
  It will be laid over `recording/<id>.jpg` at full size.

Then `board.json`:

```json
{ "m01": { "at": 6.2, "caption": "One line: what this frame shows." } }
```

`at` is the second (from the moment's start, within its duration) that this still is the
frame of: the instant the idea lands, after the word that names it.

Before you stop, check each still against the checklist and fix what fails. Finish with
one line per moment: what the still shows. Then name the weakest still and why.
