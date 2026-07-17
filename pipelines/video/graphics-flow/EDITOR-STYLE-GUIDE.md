# Motion graphics style guide (for the video editor)

This is the visual system every motion graphic and overlay in our videos
follows. The pre-rendered clips you receive from the pipeline already match it.
Use this guide whenever you build something by hand, so your graphics and ours
look like one family.

(Technical source of truth for the automated side: `../card-library/DESIGN.md`.
If the two ever disagree, tell us instead of guessing.)

## Colors

Use these exact values. No other hues.

| Use | Hex | Notes |
|---|---|---|
| Background gradient, origin | `#3A1F08` | burnt amber, radial gradient centered around upper-left (about 30% x, 20% y) |
| Background gradient, outer | `#0A0805` | near-black with a warm undertone; page base is pure black `#000000` |
| Primary text | `#FFFFFF` | |
| Secondary text | `#FFEFDB` at 55-65% opacity | warm cream. Never use plain grey for dim text |
| Accent (THE brand color) | `#FB923C` | orange. Labels, highlights, active states, buttons |
| Accent light | `#FDBA74` | secondary accent when two accent levels are needed |
| Positive / pro / yes | `#34D399` | green |
| Negative / con / no | `#FB7185` | rose. For a muted "no", white at 28% opacity also appears |
| Winner / top grade / gold moment | `#FACC15` | ONLY for verdict-winner moments, never decoration |

Rules: dark warm background always. One orange accent per composition. Green
and rose only when the meaning is good vs bad. Gold only when something wins.

## Typography

- One font family everywhere: **Inter** (Google Fonts, weights 400 to 900).
- Titles: 52 to 72 px at 1080p, weight 800, slightly tight letter-spacing
  (about -1 to -2 px).
- Hero numbers and grades: up to 220 px, weight 900.
- List and row content: 24 to 40 px, weight 400 to 600, line-height about 1.35.
- Small labels and eyebrows: 18 to 22 px, usually UPPERCASE with wide
  letter-spacing, colored accent orange or the dim cream.
- Sentence case for normal text. All-caps only for the small labels.

## Layout

- Canvas 1920x1080. Keep content inside roughly 120 px padding on all sides;
  content block max width about 1560 px, centered.
- Panels and rows: white at 4% opacity fill, 1 px border of white at 10%
  opacity, corner radius 24 px, inner padding about 40 px.
- Don't crowd: if a list needs tiny text to fit, cut items instead of shrinking.

## Motion feel

- Entrances are quick and decisive: 0.45 to 0.6 seconds, strong ease-out
  (fast start, soft landing). Nothing bouncy unless it's a small badge or
  stamp, which may pop with a slight overshoot.
- Elements enter with opacity 0 to 1 plus a SMALL move: rows slide up 16 to
  24 px, side columns slide in 40 px, badges scale from 90%.
- Containers appear a beat before their contents; list items appear one by
  one, never all at once.
- No idle loops, no wiggle, no continuous drift. A graphic settles and holds.

## Overlays (graphics over screen recording)

- Transparent background, content anchored to a corner or lower third, never
  center-blocking the demo.
- Same palette and type rules as above; the dark panel style (near-black at
  high opacity, rounded corners) keeps text readable over any footage.

## Quick don'ts

- No colors outside the table above, no gradients other than the background.
- No fonts other than Inter, no drop shadows on text (soft glow on accent
  shapes is fine).
- No emoji in graphics.
- Product names always spelled correctly on screen (HeyGen, OpenArt AI,
  Higgsfield, Synthesia, Arcads), even if the voiceover audio mangles them.
