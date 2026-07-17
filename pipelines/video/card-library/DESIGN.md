# Card design system

> Human-editor version of this document (plain style guide, no code):
> `../graphics-flow/EDITOR-STYLE-GUIDE.md`. Keep the two in sync when the
> system changes.

Every card in this library follows one visual family. This file is the contract a NEW
card must meet before it joins `catalog.json` (the timing/variables contract is the
"Beat contract" section in README.md — both apply). Distilled 2026-07-17 from the 37
existing cards; when in doubt, open `pros-cons/pros-cons/index.html` and
`verdict/verdict-report-card/index.html` as references.

## Palette (use these exact values via `:root` vars)

| Token | Value | Use |
|---|---|---|
| `--bg-from` | `#3a1f08` | radial gradient origin (burnt amber), ellipse at ~30% 20% |
| `--bg-to` | `#0a0805` | near-black warm undertone; page background stays `#000` |
| `--text` | `#ffffff` | primary text |
| `--text-dim` | `rgba(255, 239, 219, 0.55-0.65)` | secondary text (warm cream, NEVER pure grey) |
| `--accent` | `#fb923c` | THE accent: eyebrows, highlights, active states |
| positive | `#34d399` | pros, yes-marks, wins (green) |
| negative | `#fb7185` | cons, no-marks (rose) — or `rgba(255,255,255,0.28)` for neutral "no" |
| gold | `#facc15` | top grades, trophies, "winner" moments only |

Rules: dark warm background always; one orange accent; green/rose only for
semantic good/bad; gold only for verdict-winner moments. No new hues without a
deliberate reason.

## Typography

- Font: `'Inter', system-ui, sans-serif` (Google Fonts link, weights 400–900). Every card.
- Titles: 52–72px, weight 800, negative letter-spacing (-1 to -2px).
- List/row content: 24–40px, weight 400–600, line-height ~1.35.
- Labels/eyebrows: 18–22px, often uppercase with wide letter-spacing, `--accent` or `--text-dim`.
- Hero numbers (grades, stats): up to 220px, weight 900.

## Layout

- Canvas 1920x1080, content in a centered `#frame` with ~120px padding; content
  block max-width ~1560px.
- Panels: `rgba(255,255,255,0.04)` fill + 1px `rgba(255,255,255,0.1)` border +
  border-radius 24px, padding ~40px.
- Respect the capacity you declare: pick font sizes so `max_beats` rows at
  `max_reveal_chars` characters fit without overflow — then record those two
  numbers in the card's `catalog.json` entry. If content can overflow, the card
  is not done.

## Motion

- GSAP only, one paused timeline registered on `window.__timelines[id]` (see
  HYPERFRAMES.md for the mechanics).
- Eases: `power3.out` for containers/titles, `power2.out` for rows. Optional
  `back.out(...)` for playful pops (badges, stamps).
- Entrances: opacity 0→1 plus a small transform — y: 16–24 for rows, x: ±40 for
  columns, scale 0.9→1 for badges. Durations 0.45–0.6s.
- Containers reveal ~0.3s before their first item; items reveal on their beats
  (beat cards) — never all at once.
- No infinite loops, no randomness, no `Date.now()` — renders must be deterministic.

## New-card checklist

1. `:root` uses the palette tokens above; Inter loaded.
2. Beat contract met if progressive-reveal (README.md), incl. `beats` defaults that
   reproduce a good-looking standalone preview.
3. `max_beats` + `max_reveal_chars` measured honestly (fill the card to the limit
   and look at it) and recorded in `catalog.json` with `kind`, `placement`,
   `purpose`, `variables`, `beat_shape`, `default_duration`.
4. `npx hyperframes@latest lint <card>` passes (the 2 known warnings are OK).
5. Before shipping: render once and LOOK at the midpoint frame — layout intact,
   text readable at YouTube compression sizes.
6. Not a near-duplicate: check `catalog.json` purposes first; a variant of an
   existing card should be new `beats`/variables on the existing card, not a new folder.
