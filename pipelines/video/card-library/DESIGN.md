# Card design system

> This file owns the palette. `../visuals-flow-2/EDITOR-STYLE-GUIDE.md` is the
> human-editor version (plain style guide, no code) and is checked against it:
> `check-cards.sh` fails if that file names a colour this one does not.

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
| negative | `#ef4444` | STATIC no-marks only: cons rows, ✗ value pills, a "not for you" mark — or `rgba(255,255,255,0.28)` for neutral "no" |
| gold | `#facc15` | top grades, trophies, "winner" moments only |

Rules: dark warm background always; one orange accent; green/red only for
semantic good/bad; no new hues without a deliberate reason.

**Rose is banned, and motion is never red or gold (owner, 2026-07-31).** The old
negative `#fb7185` clashed with the orange family ("pink and orange don't go
together") and is gone from every card; `#ef4444` replaced it for static
no-marks (cons, ✗ pills). Two follow-up rulings from the same board review, made
after seeing alternatives rendered:

- **Connecting lines / track fills / sweeps stay `var(--accent)` orange in every
  register.** A gold fill read as a stray yellow, not as energy.
- **No red "fail finale" on enacted chains.** pipeline-flow used to tint its
  final dark-register node red with an X badge and a judder; on the board it
  read as "weird — shouldn't that be orange only". Every node now resolves
  orange with a check in both registers. Red appears only where a mark is the
  CONTENT (a cons list, a failed criterion), never as motion or as a chain
  state.

## Typography

- Font: `'Inter', system-ui, sans-serif` (Google Fonts link, weights 400–900). Every card.

**The canvas is video, not web.** Type that looks generous in a browser reads as
timid at 1080p on a phone. Size against the FRAME, not against a document.

**Size alone is not the fix.** Enlarged type with default tracking and loose
leading looks *bigger*, not *designed*. Five things move together:

- **Hero** (the one thing the card is about): **120–200px**, weight **800–900**,
  `letter-spacing: -0.035em`, `line-height: 1.0`. Every fullframe card declares
  its hero size once as `--hero-size` in `:root` and uses
  `font-size: var(--hero-size)` on that element.
- **Secondary** (names, row content, values): 40–56px, weight 600–700,
  `letter-spacing: -0.015em`, `line-height: 1.2`.
- **Labels / eyebrows**: 22–28px, weight 700, uppercase, `letter-spacing: 0.12em`
  (wide — the opposite of the hero), colour `var(--accent)`.
- **Hero numbers** (grades, stats): up to 280px, weight 900, same tracking as hero.

**Tracking is in `em`, never `px`.** A fixed `-1.5px` is meaningful at 40px and
invisible at 160px. `-0.035em` scales with the type, which is why it survives a
size change and a px value does not. This was the single most-missed rule in the
pre-2026-07-25 library.

**Contrast, not just scale.** The hero is `var(--text)`. A headline set in
`var(--text-dim)` recedes no matter how large it is — that combination (large but
grey) is what read as "subtle" to the owner.

**Hierarchy is the point.** The hero must be at least **2.5×** the next-largest
text on the card. A card where everything sits in a narrow band reads as flat
however large the type is — a 2× spread across the whole library is what produced
the original complaint.

**The bands and the ratio must agree.** Secondary is capped at BOTH 56px and
`hero ÷ 2.5`, whichever is smaller. So a 56px secondary requires a hero of at
least 140px; a 120px hero allows a secondary of at most 48px. Pick the hero
first, then derive the ceiling — do not set both from the bands independently.

**The ratio has a ceiling too (owner, 2026-07-31).** The hero may be at most
**4×** the card's smallest content text, and list/table row text on a fullframe
card is never below **36px**. The 2.5× minimum alone produced compliant cards
that still looked wrong — `pros-cons` ran a 150px hero over 28px rows (5.4×),
which the owner read as "heading very big, rest all very small". Hierarchy is a
*spread*, not a cliff: if the rows must be small to fit, bring the hero down
(120–140px) rather than letting the gap widen. Both bounds are enforced by
`check-type-scale.mjs` alongside the minimums.

**One accented word per card.** Every fullframe card colours at least one text
element `var(--accent)`. Colour marks meaning; a card where the accent only
appears in dividers and underlines never tells the eye where to land.

**Never style the headline as a subordinate.** The idea-carrying line uses
`--text` at hero size, not `--text-dim` at body size.

**Big type means fewer words.** Growing the hero shrinks capacity, so
`max_beats` / `max_reveal_chars` in `catalog.json` must come DOWN to match —
verify with the `max` variant in `card-qa`, and reduce the declared capacity
until it fits. On a **short-hero** card, never shrink the hero to fit more
words; cut the words.

### Hero scale assumes a SHORT hero

Everything above is calibrated for a hero that is a title, a section name, or a
number. Applied blind it breaks three card shapes — which is exactly what the
2026-07-26 owner review caught: four cards, one bug. A card declares its shape
in `catalog.json` via **`hero_shape`**; absent means `short`, so most of the
library is unaffected.

| `hero_shape` | The hero is… | Rule |
|---|---|---|
| `short` (default) | a title, section name, or number | 120–200px floor, 2.5× ratio. Unchanged. |
| `prose` | a whole sentence — the sentence IS the card | Floor drops to **60px**. The ratio is skipped: the sentence is the only text there is, so "2.5× the next-largest" measures nothing. |
| `none` | nothing — the card has no hero | Exempt from `--hero-size`, the floor, and the ratio. A `none` card must NOT declare `--hero-size`. |

Two shapes qualify as `none`, for opposite reasons:

- **Parallel lists** (`checklist/icon-pills`) — no item outranks another. Sizing
  row 1 up invents a hierarchy the content does not have, and reads as a bug
  rather than as emphasis. It also breaks the icon column: a 120px tile beside
  72px ones pushes that row's pill off the shared left edge.
- **Dense tables** (`comparison/credits-math`) — the DATA is what the card is
  about; the heading only names it. Promoting the heading to 120px made it 3.75×
  the rows it labels and inverted the hierarchy. On these cards the largest text
  must be the content.

At 120px+ a full sentence runs three lines edge-to-edge with no margin, and an
accent plate behind it (`statement/keyword-statement`'s `.kw`) clips descenders
once `line-height` goes to 1.0. **Leading follows size**: 1.0 is a hero setting.
Prose at 64–70px wants 1.18–1.25, or the lines collide.

**The other four levers are not shape-dependent.** Em-based tracking, full
`--text` contrast, weight, and one accented word apply to every fullframe card.
Only *scale* is shape-sensitive — a useful thing to know, because scale was the
one lever that overshot when all five moved together.

These rules are enforced by `scripts/check-type-scale.mjs`.

## Layout

- Canvas 1920x1080, content in a centered `#frame` with ~120px padding; content
  block max-width ~1560px. Cards ready for the side avatar mode (below) follow
  relative rules instead — the 1920/1560 numbers apply to the full canvas only.
- Panels: `rgba(255,255,255,0.04)` fill + 1px `rgba(255,255,255,0.1)` border +
  border-radius 24px, padding ~40px.
- Respect the capacity you declare: pick font sizes so `max_beats` rows at
  `max_reveal_chars` characters fit without overflow — then record those two
  numbers in the card's `catalog.json` entry. If content can overflow, the card
  is not done. See "Big type means fewer words" above: capacity comes down to
  match the hero, never the other way around.
- **Survives worst-case content**: layouts must hold at both the minimum and maximum item counts the catalog allows, and at every string's `max_words`. Grid ratios must be computed from item count, never hardcoded for one count.
- **Meaningful strokes are ≥2px at ≥0.6 alpha (owner, 2026-07-31).** Any stroke
  the viewer is meant to READ as a complete shape — an accent ring, a keyline
  around a pill or lockup, an underline — must survive render + encode. A 1px
  stroke at 0.42 alpha (`link-scrim`'s old border) partially vanished on video
  and read as a broken, incomplete boundary. Hairlines are only acceptable on
  decorative panel edges (the `rgba(255,255,255,0.1)` panel border above) where
  a dropout is invisible.

## Declared capacity is the TIGHTEST variant's capacity

**Found 2026-07-30.** `resolve.mjs` rotates a reused card's `variant` by use count
(`cat.variants[useCount % cat.variants.length]`) — so the variant is chosen AFTER
the copy is authored, and the pass that wrote the copy could not know which layout
it would land in.

`enacted/pipeline-flow` has variants `a` (horizontal chain) and `b` (vertical). A
4-word title fits `a` comfortably; in `b` it wraps to two lines, pushes the chain
down, and clips both the title top and the last node off the canvas. `title` had no
`max_words` at all, so nothing rejected it.

So for any card declaring `variants`:

- Every capacity you declare (`max_words`, `max_beats`, `max_reveal_chars`) must be
  the limit of the variant with the LEAST room, not the roomiest one or the default.
- Verify with `card-qa` **in each variant**, not just the default.
- Prefer a machine-checkable cap on the catalog field over a note in prose:
  `validateVariable` already enforces `max_words`, so a cap fails at 040 instead of
  rendering clipped.

## Side-ready cards (side avatar mode)

In side mode the host takes the right 720px and the card renders into the left
**1200 × 1080**. The renderer bakes this by rewriting only `data-width` on
`#root` — it does not touch your CSS. So a side-ready card must lay out
**relative to its root**, and a card that hardcodes 1920px cannot work.

A card marked `"side": true` in `catalog.json` MUST satisfy all of:

1. **No hardcoded canvas width.** `html`, `body` and `#root` size with `100%`
   (or `100vw`/`100vh`), never `1920px`. The string `1920px` must not appear
   anywhere in the file. `data-width="1920"` on `#root` stays — that attribute
   is the thing the renderer rewrites.
2. **Type size does not change.** The point of side mode is that the graphic
   still reads. Never shrink a font to make a layout fit; re-stack it instead
   (row → column, 2-up → 1-up, horizontal chips → wrapped chips).
3. **Content widths are relative.** `max-width` in `%` or `vw`, or a px value
   that is ≤ 1080 so it still fits inside the 1200 column with padding. The
   old "content block max-width ~1560px" rule applies to the full canvas only.
4. **Nothing clips or overlaps at 1200 × 1080**, verified by rendering — not
   by reading the CSS.

A card that cannot meet these without shrinking type declares `"side": false`.
That is a legitimate outcome, not a failure: dense tables and wide matrices have
a real minimum width. The shot pass then cannot place a side span over it.

Verify with `node scripts/card-qa.mjs <slug> --side` and LOOK at the sheet.

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

## Ambient motion — never dead on screen

Every fullframe card must keep subtle continuous motion for its ENTIRE duration after the last reveal; overlay cards for their whole visible life. Approved treatments (pick per card, stay subtle):
- **breathe**: scale 1.000→1.012 on the main group, 6s, ease sine, alternate;
- **bg-drift**: the radial gradient origin drifts ±2% position, 12s loop;
- **accent-pulse**: the single accent element's glow/opacity 0.85→1.0, 4s;
- **float**: hero element translateY ±4px, 7s.

Rules: motion must be seek-deterministic (pure function of t — CSS animations/GSAP timelines are; `Math.random()`/rAF-accumulators are not); never louder than the entrance; never on body text. Marker: the implementing style/timeline block carries the comment `/* hf-ambient */` exactly once per card (machine-checkable).

### Long holds need a visible loop, not a breathe (owner, 2026-07-31)

The treatments above are calibrated for short tails. A cue stretched well past
the card's designed duration (the resolver holds a 6s card for a 17s narration
span) turns "subtle" into "dead": a 1.2% breathe is imperceptible, and the owner
reported 12 seconds of static screen on a card that technically complied with
this section. So there is a second tier:

- Any card that can hold **more than ~8s after its last beat** (in practice:
  every fullframe beat card — cue duration is set by narration, not by the
  card) must carry a **visible loop** for the hold: re-sweep the track fill,
  cycle a soft pulse across the nodes/chips one at a time, or re-run the accent
  underline — something with a discernible start and travel, on a 4–6s cycle.
- The loop obeys the same rules: seek-deterministic, quieter than the entrance,
  never on body text, inside the `/* hf-ambient */` block.
- The breathe/drift treatments stay, as the base layer under the loop.

## A graphic carries a mark, not text alone

**Owner rule, 2026-07-30.** Every fullframe card must put at least one non-text
element on screen — a colour logo, an image, or a concept icon. Raised against
`enacted/spotlight-focus`, which named OpusClip and Submagic as bare text with no
marks and read as a wireframe.

- **A card that names products MUST accept logo slugs.** Use a shape
  `lib/logos-inline.mjs` already inlines — `logo`, `productLogos[]` (index-aligned
  with the item array), `platforms[].logo`, `beats[].logo`, or `left/right.logo`.
  Inventing a new shape means the slugs silently resolve to nothing and the card
  falls back to letters, which is how this rule got raised in the first place.
- **A card that names no product** carries concept icons instead
  (`checklist/icon-pills`, `enacted/pipeline-flow`) or a drawn object
  (`enacted/bad-clip-montage`'s clip frame). A heading plus rows of words is not
  enough on its own.
- Logo tiles follow "Tool logos" below: square, consistent radius, no trimming and
  no `saturate()`/`brightness()`. Add the 1px inset only when `__logoDark[slug]`
  is true.

Known debt: 39 of 52 fullframe cards are text-only today. The two used as product
verdicts (`spotlight-focus`, `race-bars`) were fixed when the rule landed; the rest
are a sweep, not a blocker, and no NEW card may be added text-only.

## Declared capacity is not yet measured for most cards (2026-07-30)

`scripts/overflow-probe.mjs` renders every card headless at 1920x1080, per layout
variant, filled to its declared capacity, and measures every element against the
canvas. Run it with `npm run overflow-check`.

**Current state: 31 cards overflow at their declared capacity** (37 card/variant
combinations of 70). This is not a probe artifact — it was checked against known
ground truth: `enacted/pipeline-flow` with the REAL shipped content (3-word title,
3 steps) measures clean, while the same card filled to its declared max (6 beats)
overflows with the same offenders (`#card #title #chain`) the board reported for the
frame that actually shipped clipped.

So the declared numbers are too generous, exactly as `decisions.md` 2026-07-17
predicted when it recorded them as *"conservative estimates from layout math,
unverified until video #1"*.

**The usual culprit is `max_beats`, not a text field.** pipeline-flow's title was
fine at 3 words; six beats cannot fit its vertical chain. Deriving a cap therefore
has to consider `max_beats` and `max_reveal_chars`, not just `max_words` — shrinking
a text field to fix a beat-count overflow never converges, and the probe now reports
`UNATTRIBUTED` in that case rather than writing a nonsense cap.

The probe is deliberately NOT yet a blocking gate in `check-cards.sh`: it would fail
on 31 cards and stop all card work until every cap is corrected. Correcting them is
the outstanding sweep. Until then: run `npm run overflow-check` on any card you
touch, and never add a NEW card that the probe reports.

## New-card checklist

0. **Owner previews the LOOK before you build (owner rule 2026-07-31).** Before
   writing any code for a new card, give the owner 1–2 image-generation
   prompts (they run them in Google Gemini/Flow) — one per key moment of the
   card — and wait for their verdict. A text description is not a preview;
   `intro/versus-cold-open` was approved from generated frames and built to
   match them exactly. Build each prompt from this template, filling the
   [BRACKETS]:

   ```
   Flat 2D motion-graphics still frame, 16:9, 1920x1080, from a premium dark
   tech explainer video.

   TEXT RULE: the ONLY text anywhere in the image is: [EXACT TEXT LIST].
   No headline, no tagline, no subtitle, no watermark, no other words at all.

   Background: near-black warm brown (#0d0906), one very soft dim orange glow
   upper-left — subtle, not flooding the frame. Generous dark negative space.

   [COMPOSITION: what sits where, sizes/proportions, which elements are matte
   dark panels (rounded corners, thin 2px orange keyline at 60% opacity) and
   which carry the accent. Describe the card's KEY MOMENT as a frozen frame.]

   Style: flat design, matte surfaces, crisp vector edges, single accent
   color (white + orange #fb923c), Swiss/Apple-keynote minimalism.
   NO 3D extrusion, NO lens flares, NO sparkles, NO light streaks,
   NO gradients on text, NO photographic realism.
   ```

   The TEXT RULE allow-list and the NO-list are what keep the generator from
   inventing headlines and gloss — both happened without them. After the owner
   approves, the generated frames are the visual contract: build to match.

1. `:root` uses the palette tokens above; Inter loaded.
2. Beat contract met if progressive-reveal (README.md), incl. `beats` defaults that
   reproduce a good-looking standalone preview.
3. `max_beats` + `max_reveal_chars` measured honestly (fill the card to the limit
   and look at it) and recorded in `catalog.json` with `kind`, `placement`,
   `purpose`, `variables`, `beat_shape`, `default_duration`.
4. `npx hyperframes@latest lint <card>` passes (the 2 known warnings are OK).
5. Before shipping: render once and LOOK at the midpoint frame — layout intact,
   text readable at YouTube compression sizes.
6. Carries a non-text mark — logo, image or concept icon (see "A graphic carries a mark, not text alone"). A card naming products accepts logo slugs via a shape `logos-inline.mjs` already inlines.
7. **Legible on one viewing.** Render it and answer the mute test FROM THE FRAME: with audio off and captions hidden, is it clear what the card is showing without working it out? `lint`, `card-qa` and `check-type-scale` all pass on a card nobody can follow — `enacted/same-input-split` passed every gate and was rejected as "not intuitive, complicated to follow" (2026-07-30). The 050 mute test audits the cue PLAN against catalog purposes; it never sees your pixels.
8. Not a near-duplicate: check `catalog.json` purposes first; a variant of an
   existing card should be new `beats`/variables on the existing card, not a new folder.

## Tool logos (added 2026-07-18)

- Logos come ONLY from `logos/registry.json` slugs, inlined as data URIs at
  render/board time (`__logos`). Cards never hardcode brand imagery.
- **Logo tiles**: logos arrive as 256×256 opaque tiles with the mark at 72%; cards must render them square with a consistent border-radius and must **not** apply their own trimming, rescaling to a different safe area, or `saturate()`/`brightness()` filters that alter apparent weight. When `registry[slug].dark` is true, cards add a 1px `rgba(255,255,255,0.10)` inset border so the tile separates from a dark background.
- Winner moments may put the logo inside a gold chip (see
  `verdict/persona-match`): `rgba(250,204,21,0.07)` fill, `rgba(250,204,21,0.35)`
  1px border, radius 14px — gold text per the palette's winner rule.

## Enacted device rules

- **Enact, don't label**: The graphic must argue the clause without words. Use the mute test: with audio muted and captions hidden, the moving object alone must communicate the idea.
- **Registers**: Dark = problem styling. Light = solution styling (gradient `--bg-from: #2b2416; --bg-to: #0a0805`).
- **Marker**: A single marker word gets the accent sweep treatment.
- **Real data**: Use real values, logos, and commands. Never use lorem ipsum or pseudo-code.
