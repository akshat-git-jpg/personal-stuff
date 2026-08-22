# KIT.md — the locked contract

This file is the contract a future authoring step reads instead of inventing a
treatment. It replaces "full creative freedom" with 7 cards, 5 moves, and the
ratios below. Do not add an 8th card or a 6th move without an owner decision
recorded in `decisions.md`.

## Why this shape

Four reference intros were measured (see `plans/219-vf-intro-kit-cards.md` for
the full table). What they share:

1. Full-screen avatar and full-screen card ALTERNATE on hard cuts. The avatar is
   never in a bubble or panel beside a graphic.
2. Every card carries the words being spoken, appearing word by word.
3. One accent colour on near-black for the whole intro. No register shift.
4. A tiny set of card types, reused. One reference shows the SAME card four
   times back to back, changing only its icon and two bullet lines.
5. Five motion moves total across all four videos: type-on text, fade-and-slide,
   stagger, slow drift, line-draw. Transitions are a white flash or a blur.

## The brand contract — `card-library/DESIGN.md`, read-only from here

| Token | Value | Use |
|---|---|---|
| `--bg-from` | `#3a1f08` | radial gradient origin (burnt amber), ellipse at ~30% 20% |
| `--bg-to` | `#0a0805` | near-black warm undertone; page background stays `#000` |
| `--text` | `#ffffff` | primary text |
| `--text-dim` | `rgba(255, 239, 219, 0.60)` | secondary text (warm cream, NEVER pure grey) |
| `--accent` | `#fb923c` | THE accent: eyebrows, highlights, active states |
| positive | `#34d399` | pros, yes-marks, wins (green) |
| negative | `#ef4444` | STATIC no-marks only |
| gold | `#facc15` | top grades only |

Rules quoted from `DESIGN.md`:

- "dark warm background always; one orange accent; green/red only for
  semantic good/bad; no new hues without a deliberate reason."
- "Rose is banned, and motion is never red or gold (owner, 2026-07-31)."
  Connecting lines, track fills and sweeps stay `var(--accent)` orange.
- Font: `'Inter', system-ui, sans-serif`, weights 400-900, on every card.
- Hero: **120-200px**, weight 800-900, `letter-spacing: -0.035em`,
  `line-height: 1.0`, declared once as `--hero-size` in `:root`.
- Secondary: 40-56px, weight 600-700, `letter-spacing: -0.015em`.
- Labels / eyebrows: 22-28px, weight 700, uppercase, `letter-spacing: 0.12em`,
  colour `var(--accent)`.
- "Tracking is in `em`, never `px`."
- "Never express focus with blur (owner, 2026-08-02)." — `logo-grid` is the one
  deliberate exception, justified in its own header comment.
- "A graphic carries a mark, not text alone."

## The variable-duration contract

Kit cards run 2-5s (unlike the body card library, whose cards are fixed at 6s).
Every kit card:

- accepts a `duration` variable (default 3.5),
- writes it onto the root and every `.clip` child at runtime,
- scales its own motion schedule to it (a stagger over a fraction of `duration`,
  never a hard-coded 2s),
- and its `:root` `data-duration` literal is the DEFAULT only.

```js
      /* ===== DURATION (LOCKED — identical in all 7 kit cards) ===== */
      const DUR = Math.min(5, Math.max(2, Number(VARS.duration ?? 3.5)));
      const root = document.getElementById('root');
      root.setAttribute('data-duration', String(DUR));
      for (const el of root.querySelectorAll('.clip')) {
        el.setAttribute('data-duration', String(DUR));
      }
      const T = (frac) => +(DUR * frac).toFixed(3);
```

## The 7 cards

| Slug | Purpose | Overlay | Duration |
|---|---|---|---|
| `statement` | the spoken line, alone, word by word — the workhorse | no | 2.0-5.0 |
| `checklist` | two to four verdict rows under one icon, safe to repeat back-to-back | no | 2.5-5.0 |
| `logo-grid` | "too many tools" — real logos, then the line lands and they dim | no | 2.5-5.0 |
| `shot-float` | generated stills/screenshots as evidence while the line runs | no | 2.5-5.0 |
| `ui-mock` | a stylised app window, used twice per intro — once ok, once fail | no | 2.5-5.0 |
| `chain` | N labelled inputs converging into one named thing | no | 3.0-5.0 |
| `lower-third` | the ONLY card that sits over live footage (presenter name/role) | **yes** | 2.0-5.0 |

`lower-third` is the only card with `"overlay": true` in `kit.json` — plan
220's pacing lint counts an overlay beat as AVATAR time, not graphics time,
because the presenter is still on screen.

### `statement`

Centred sentence, hero scale by word count (`<=8 -> 120px`, `<=12 -> 96px`,
else `64px`). Optional single line-art icon at 22% from the left, 34% down,
`stroke: var(--accent)`, `fill: none`, drifting slowly. Moves: type-on words at
their beat, `#bg` drift, icon slow drift (rotate ±4, y ±12, `sine.inOut`).

### `checklist`

A solid `var(--accent)` rounded panel (radius 28px, ~1180x620) with a black
line icon top-left and 2-4 verdict rows beneath, each with a `yes`/`no` mark.
Text and marks on the panel are near-black (`#0a0805`), not white. `id="rows"`
is the container the mutation recipe deletes — it must be the element the rows
are appended into. Moves: panel scale+fade in, rows stagger in.

### `logo-grid`

6-12 real product logos scattered on a loose 4x3 grid with jitter, the
sentence centred on top. Moves: tiles fade in staggered, then dim to
`opacity 0.22` + `blur(9px)` while the sentence types on. This is the one
deliberate exception to "never express focus with blur" — the blur IS the
content (the tools becoming noise), not a focus effect.

### `shot-float`

3-6 shots in rounded frames scattered around the edges, none crossing the
centre band (y 44%-60%) where the sentence sits. Moves: shots enter
staggered, then drift for the rest of the card (y ±18, rotate ±3.5,
`sine.inOut`, phase-offset per shot). Sentence types on from early in the card.

### `ui-mock`

An outlined app window (title bar, sidebar, main pane showing `shot`). The
`state` token (`"ok"` | `"fail"`) recolours every stroke, the button and the
title text — `var(--accent)` for ok, `#ef4444` for fail. Same geometry, same
file, one variable — this is why no second "failure" card exists. Moves:
window scale+fade in, one button press, shot pane crossfade, and on `fail` a
single 2-frame shake.

### `chain`

2-4 items in a row (thumbnail + label) converging via drawn connector lines
into a target chip at bottom centre. Moves: items fade+slide in staggered,
labels type on, connector lines draw (`stroke-dashoffset` full -> 0), chip
scales in last. Lines are `var(--accent)` per DESIGN.md's connector rule.

### `lower-third`

Transparent background (no `#bg` — the avatar is behind it). Text bottom-left
with a soft dark scrim behind it so it reads over any footage. Moves: type-on
only, plus the scrim fading in.

## The 5 approved moves — no card may use a sixth

| Move | Implementation |
|---|---|
| type-on | per-word `opacity 0->1`, `duration 0.1`, `ease none`, at its beat |
| fade-and-slide | `opacity 0->1` + `y 14->0`, `ease power2.out` |
| stagger | the same tween applied to N siblings at even offsets |
| slow drift | `x/y/rotate` within ±20px / ±4deg, `ease sine.inOut`, spanning the card |
| line-draw | `stroke-dashoffset` full -> 0, `ease power1.inOut` |

Explicitly banned in this kit: particles, 3D transforms, glow pulses, spins,
elastic/bounce eases, colour tweens (see the ACCENT note in each card's
comments), and any blur other than `logo-grid`'s documented exception.
