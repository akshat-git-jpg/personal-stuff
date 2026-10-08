# default — the channel brand as a free-design system

Warm, dark, confident. One orange accent that tells the eye where to land. Big type,
few words, and something always moving. Every moment is designed from scratch; this
file is the language, not a layout to fill in.

Canvas: 1920x1080 at 30fps unless the moment says otherwise. Size everything against
the frame, not against a web page: type that looks generous in a browser reads timid
on a phone.

## Palette

Use these exact values. Put them on `:root` as CSS variables.

| Token | Value | Job |
|---|---|---|
| `--bg-from` | `#3a1f08` | burnt amber, the origin of the background glow |
| `--bg-to` | `#0a0805` | near-black with a warm undertone; the page itself is `#000` |
| `--text` | `#ffffff` | primary text, every headline |
| `--text-dim` | `rgba(255, 239, 219, 0.6)` | secondary text: warm cream, never grey |
| `--accent` | `#fb923c` | THE accent: the one word, line or shape that matters |
| `--positive` | `#34d399` | good, yes, pass: only when the meaning is "good" |
| `--negative` | `#ef4444` | a static "no" mark only (a cross, a failed row) |
| `--gold` | `#facc15` | winners and top grades only |

- The ground is always dark and warm: a radial glow from `--bg-from` (near the
  top-left third) into `--bg-to`.
- One accent. Lines, sweeps, progress fills and connectors are always `--accent`.
- Green and red carry meaning, never decoration. Red never moves; gold never moves
  except on a winner.
- Banned: rose/pink (`#fb7185` and friends), cold greys for text, any new hue without
  a reason you could say out loud.

## Type

Font: `'Inter', system-ui, sans-serif`, weights 400-900. Name it in `font-family` only:
the renderer embeds Inter itself, so no `<link>` to a font service is needed.

| Role | Size at 1080p | Weight | Tracking | Leading |
|---|---|---|---|---|
| Hero (the one thing the moment is about) | 120-200px | 800-900 | `-0.035em` | 1.0 |
| Hero number (a stat, a price, a step number) | up to 280px | 900 | `-0.035em` | 1.0 |
| Secondary (names, short lines) | 40-56px | 600-700 | `-0.015em` | 1.2 |
| Label / eyebrow | 22-28px | 700, uppercase | `0.12em` | 1.2 |

- Tracking is in `em`, never `px`.
- The hero is at least 2.5x the next text down, and at most 4x the smallest text.
  Hierarchy is a spread, not a cliff.
- Big type means fewer words. Cut words before shrinking the hero.
- Colour one word or element `--accent` so the eye knows where to land.
- No `<br>` in running text; let it wrap with `max-width`.

## Motion language

- GSAP, one paused timeline per composition, everything a pure function of time.
- Entrances: opacity plus a small move. Rows `y: 16-24`, columns `x: +-40`, badges
  `scale: 0.9 -> 1`. 0.45-0.6s. Eases `power3.out` for titles and containers,
  `power2.out` for rows, `back.out(1.6)` only for small pops (a badge, a stamp).
- Reveal on the words. When the voice says a thing, that thing appears; never show the
  whole list before the voice gets to it.
- Never dead on screen. After the last reveal keep a quiet loop going: the glow drifts,
  the accent pulses, a fill re-sweeps. Holds longer than ~8s need a loop you can see
  start and travel (4-6s cycle), not just a 1% breathe.
- Focus is light, scale or colour. Never blur the things that are not the subject.
- Exits are quick (0.3-0.4s, `power2.in`) or the moment simply cuts; do not let an exit
  eat the last word.
- No `repeat: -1`, no `Math.random()` without a seed, no clocks.

## Layout

- Content sits inside ~120px of padding; a content block is at most ~1560px wide.
- One idea per moment. Three to five items on screen at once is the ceiling.
- Panels, when you need one: `rgba(255,255,255,0.04)` fill, 1px
  `rgba(255,255,255,0.1)` border, 24px radius, ~40px padding.
- A stroke the viewer must read as a shape (a ring, an underline, a keyline) is at
  least 2px at 0.6 alpha or it breaks up after encoding.
- Text never crosses a graphic, and nothing important touches the frame edge.

## Marks

- Every moment carries at least one non-text mark: a product logo, an icon, a drawn
  object or a shape that acts out the idea. Words alone read as a wireframe.
- Product logos come only from the staged `logos/` folder (`logos/registry.json` maps a
  slug to its file). Copy the files you use into your composition's `assets/` folder.
  Render them square, with a consistent radius, never recoloured or filtered. When the
  registry says `"dark": true`, add a 1px `rgba(255,255,255,0.10)` inset border.
- Never invent a brand's logo. A product with no logo in the registry gets its name in
  type, set well, plus a neutral icon.
- Icons: simple line icons drawn in inline SVG, 2-3px strokes, `--text` or `--accent`.

## Do / Don't

Do:
- Act the idea out. Mute the audio: the moving picture alone should say it.
- Use real names, numbers and steps from the narration.
- Leave air. A frame that is 40% empty reads premium.

Don't:
- Fill the frame with a paragraph of text.
- Use stock "tech" decoration (circuit lines, random particles, lens flares).
- Put a label on a thing when the thing itself could do the job.
- Use red or gold as motion, or pink anywhere.
