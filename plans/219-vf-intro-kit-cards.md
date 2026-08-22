---
executor: claude-p
model: sonnet
test_cmd: cd pipelines/video/intro-kit && bash scripts/check.sh
ui: true
deploy:
needs: []
needs_prs: []
touches: [pipelines/video/intro-kit/]

mutation_apply: perl -0pi -e 's{<div id="rows"[^>]*></div>}{}' pipelines/video/intro-kit/cards/checklist/index.html
mutation_command: bash scripts/check.sh
mutation_expect: E-KIT-DEVICE
mutation_cwd: pipelines/video/intro-kit
mutation_timeout: 900
---

# Plan 219: the locked intro kit — 7 cards, one accent, five moves

## Summary

- **Problem statement**: the `simple` intro flow (plan 218 added the switch, plan
  220 adds the steps) needs a FIXED set of card templates to fill in. Today no such
  set exists — the intro is authored from scratch as a bespoke Hyperframes film
  every video, which is exactly the cost the owner is removing.
- **Goals**:
  - Create `pipelines/video/intro-kit/` holding exactly 7 locked card templates,
    derived from four reference intros the owner chose.
  - Each card takes a `duration` variable (2.0-5.0s) — unlike the body card library,
    whose cards are fixed at 6s.
  - Each card uses ONLY the `card-library/DESIGN.md` palette and type scale, and
    only the 5 approved motion moves. No card invents a treatment.
  - Ship a real content gate: `scripts/check.sh` that RENDERS every card and
    inspects extracted frames, so a title-only stub cannot pass.
- **Executor proposed**: `claude-p` / Claude Sonnet — card design is quality-setting
  visual content the owner judges by eye, which `tooling/boss/data/rules.md` routes
  to claude-p sonnet rather than the agy default.
- **Done criteria** (terse — full list below): 7 card folders exist, each renders to
  a non-trivial mp4 at 2s/3.5s/5s, `scripts/check.sh` exits 0, and the branch
  commits a contact-sheet image per card.
- **Stop conditions** (terse — full list below): do not touch anything outside
  `pipelines/video/intro-kit/`; do not add an 8th card; do not weaken the device
  check to make a card pass.
- **Test / verification for success**: `scripts/check.sh` — structural checks plus a
  render-and-extract-frames device check per card, mutation-proven to fail on a
  gutted card.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 20a2ae62..HEAD -- pipelines/video/intro-kit pipelines/video/card-library/DESIGN.md`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: none in code (this plan is a standalone new folder). Sequenced
  after 218 only so the chain lands in a readable order.
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `20a2ae62`, 2026-08-22

## Why this matters

The owner's brief: *"focus on simplicity of motion graphics. Simple graphics with
good amount of motion. Nothing over the top new idea… more footage to avatar time."*

Four reference intros were measured this session. What they actually share:

| Video | Accent | Visual changes / first 45s | Graphics on screen |
|---|---|---|---|
| `_1gFEbL4LdA` | amber | 22 | ~40% |
| `nf5PUM0cg6k` | amber | 24 | ~57% |
| `VQ9R05DqL04` | teal | 20 | ~53% |
| `kO3WtZmDb_A` | lime | 60 | ~73% |

And the structural findings, which this kit encodes:

1. Full-screen avatar and full-screen card ALTERNATE on hard cuts. The avatar is
   never in a bubble or panel beside a graphic.
2. Every card carries the words being spoken, appearing word by word.
3. One accent colour on near-black for the whole intro. No register shift.
4. A tiny set of card types, reused. `kO3WtZmDb_A` shows the SAME card four times
   back to back, changing only its icon and two bullet lines.
5. Five motion moves total across all four videos: type-on text, fade-and-slide,
   stagger, slow drift, line-draw. Transitions are a white flash or a blur.

This plan builds ONLY the cards. Plan 220 builds the cut list, the builder that
turns a cut list into one composition, and the pacing lint that enforces the
ratios above. A card here is inert until 220 lands — that is intended, and it is
why this plan's gate must judge the cards on their own, by rendering them.

**The known failure mode this gate exists to catch.** On 2026-07-24 a crew shipped
all 12 enacted cards in the body library as 76-line title-only stubs and every
gate passed, because existence checks and lint are content-blind
(`plans/runs/LESSONS.md`). A card that renders a heading and nothing else is the
default failure here. `scripts/check.sh` therefore renders each card and asserts
on extracted FRAMES, and its mutation recipe guts a card's device to prove the
check fires.

## Current state

### Where this goes

New folder `pipelines/video/intro-kit/`, a sibling of
`pipelines/video/card-library/`. Nothing outside it changes.

```
pipelines/video/intro-kit/
  README.md
  CLAUDE.md
  KIT.md                  <- the locked contract: 7 cards, 5 moves, the ratios
  kit.json                <- machine-readable card registry (slug, vars, duration range)
  hyperframes.json        <- renderer manifest (copy of card-library's, verbatim)
  meta.json               <- renderer project id (own id, see Step 1)
  package.json            <- puppeteer-core + hyperframes deps for the checker
  cards/
    statement/index.html
    checklist/index.html
    logo-grid/index.html
    shot-float/index.html
    ui-mock/index.html
    chain/index.html
    lower-third/index.html
  logos -> ../card-library/logos      (symlink; real logos, never redrawn)
  scripts/check.sh
  lib/check-kit.mjs
  renders/                <- gitignored except the committed contact sheets
  frames/                 <- committed contact sheet per card (the ui: true evidence)
```

### The brand contract — `card-library/DESIGN.md`, read-only from here

Palette table, verbatim from `DESIGN.md`:

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

Rules quoted from `DESIGN.md` that this kit must obey:

- *"dark warm background always; one orange accent; green/red only for semantic
  good/bad; no new hues without a deliberate reason."*
- *"Rose is banned, and motion is never red or gold (owner, 2026-07-31)."*
  Connecting lines, track fills and sweeps stay `var(--accent)` orange.
- Font: `'Inter', system-ui, sans-serif`, weights 400-900, on every card.
- Hero: **120-200px**, weight 800-900, `letter-spacing: -0.035em`,
  `line-height: 1.0`, declared once as `--hero-size` in `:root`.
- Secondary: 40-56px, weight 600-700, `letter-spacing: -0.015em`.
- Labels / eyebrows: 22-28px, weight 700, uppercase, `letter-spacing: 0.12em`,
  colour `var(--accent)`.
- *"Tracking is in `em`, never `px`."*
- *"Never express focus with blur (owner, 2026-08-02)."* — see the `logo-grid`
  note below, which is the one deliberate exception and must be justified in the
  card's own comment.
- *"A graphic carries a mark, not text alone."*

### The exemplar to imitate — `card-library/slate/kinetic-sentence/index.html`

This existing card is already the reference "statement" treatment: word-by-word
reveal with an accent phrase. **Every kit card follows this file's shape.** Its
load-bearing parts, verbatim:

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
```

```html
<div id="root" data-composition-id="kineticsentence" data-start="0" data-duration="6" data-width="1920" data-height="1080"
  data-composition-variables='{"text":"...","accent":"burns credits","beats":[{"text":"Because","accent":false,"at":0.0}, ...]}'>
  <div id="bg" class="clip" data-start="0" data-duration="6" data-track-index="0"></div>
  <div id="frame" class="clip" data-start="0" data-duration="6" data-track-index="1">
    <div id="sentence"></div>
  </div>
</div>
```

```js
const VARS = (window.__hyperframes && window.__hyperframes.getVariables ? window.__hyperframes.getVariables() : null) || {};
```

The accent-colour trick, which every kit card that colours a word MUST copy
verbatim — this is a hard-won pipeline bug, documented in the exemplar:

```js
// Accent color is applied at BUILD time as an INLINE LITERAL, resolved
// from the live --accent token via getComputedStyle — never as a GSAP
// color tween and never as `var(--accent)` on the span. Verified
// 2026-07-31 against the render pipeline: in a --variables render the
// accent words came out white with (a) a color tween to var(--accent),
// (b) a static `.is-accent { color: var(--accent) }` class, and
// (c) inline `style.color = 'var(--accent)'` — while getComputedStyle
// resolved the token correctly and an inline literal rendered orange.
const ACCENT = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '').trim() || '#fb923c';
```

```js
window.__timelines = window.__timelines || {};
const tl = gsap.timeline({ paused: true });
window.__timelines['kineticsentence'] = tl;
```

The `window.__timelines[<data-composition-id>]` registration is **mandatory**.
Without it a render still succeeds but stalls 45s per worker.

### The one difference from the body library

Body cards are fixed at `data-duration="6"`. **Kit cards are variable-duration**,
because intro cards run 2-5s. Every kit card therefore:

- accepts a `duration` variable (default 3.5),
- writes it onto the root and every `.clip` child at runtime,
- scales its own motion schedule to it (a stagger over `0.55 * duration`, not a
  hard-coded 2s),
- and its `:root` `data-duration` literal is the DEFAULT only.

The snippet every card uses for this, written once here so all 7 are identical:

```js
      /* ===== DURATION (LOCKED — identical in all 7 kit cards) ===== */
      // Kit cards are variable-length: the builder (plan 220) picks 2.0-5.0s per
      // beat from the transcript, so nothing here may hard-code a schedule. The
      // root's data-duration literal is a default for standalone preview only.
      const DUR = Math.min(5, Math.max(2, Number(VARS.duration ?? 3.5)));
      const root = document.getElementById('root');
      root.setAttribute('data-duration', String(DUR));
      for (const el of root.querySelectorAll('.clip')) {
        el.setAttribute('data-duration', String(DUR));
      }
      // A fraction of the card's own length, never a wall-clock constant.
      const T = (frac) => +(DUR * frac).toFixed(3);
```

## The 7 cards — locked specs

Every card: `1920x1080`, 30fps, `data-start="0"`, `data-composition-id` = its slug
with dashes removed, a registered `window.__timelines` entry, the DESIGN.md palette
in `:root`, and the DURATION block above.

**Card 1 — `statement`** (from `_1gFEbL4LdA`, `nf5PUM0cg6k`, `VQ9R05DqL04`)
- Purpose: the spoken line, alone, word by word. The workhorse — expect it to be
  over half of every intro's cards.
- Variables: `{ text, accent, beats:[{text,accent,at}], icon (optional slug), duration }`
- Stage: centred sentence, hero scale by word count exactly as the exemplar does
  (`<=8 -> 120px`, `<=12 -> 96px`, else `64px`). Optional single line-art icon at
  22% from the left, 34% down, `stroke: var(--accent)`, `fill: none`, 2.5px stroke,
  drifting slowly.
- Moves: type-on (each word `opacity 0->1`, `duration 0.1`, `ease none`, at its
  `beats[i].at` scaled into `DUR`), plus a `#bg` drift (`scale 1 -> 1.05`,
  `x -20`, `y -10`, over `DUR`, `ease none`).
- Icon motion: `rotate: -4 -> 4` and `y: -12 -> 12` over `DUR`, `ease sine.inOut`.
  Slow drift only — no spin, no bounce.

**Card 2 — `checklist`** (from `kO3WtZmDb_A`, the card it repeats four times)
- Purpose: two to four verdict rows under one icon. The reference shows this is the
  card you reuse back-to-back; it must look correct three times in a row.
- Variables: `{ icon, rows:[{ text, mark:"yes"|"no" }], duration }` — 2 to 4 rows,
  more is a lint error in plan 220.
- Stage: a solid `var(--accent)` rounded panel, radius 28px, roughly 1180x620,
  centred; a black line icon top-left inside it at 96px; rows beneath at 44px
  weight 650, each preceded by a 34px round mark — `✓` on `#0a0805` for `yes`,
  `✗` on `#0a0805` for `no`. On the accent panel, text and marks are near-black
  (`#0a0805`), NOT white: white on `#fb923c` fails contrast.
- Moves: panel `scale 0.94 -> 1` + `opacity 0 -> 1` over `T(0.12)`, `ease power2.out`;
  rows stagger in with `y: 14 -> 0`, `opacity 0 -> 1`, each `0.16s`, evenly spaced
  across `T(0.25)` to `T(0.8)`.
- `id="rows"` is the container the mutation recipe deletes. It must be the element
  the rows are appended into.

**Card 3 — `logo-grid`** (from `kO3WtZmDb_A`)
- Purpose: "there are too many tools" — real product logos, then the line lands.
- Variables: `{ text, accent, beats:[...], logos:[<registry slug>], duration }` —
  6 to 12 logos.
- Stage: logos from `logos/registry.json` (the symlink), each in a 132px white
  rounded tile, radius 26px, scattered on a loose 4x3 grid with per-tile jitter of
  up to ±26px so it does not read as a table. The sentence sits centred on top.
- Moves: tiles fade in staggered over `T(0.0)` to `T(0.35)`; then at `T(0.42)` the
  tiles drop to `opacity 0.22` and `filter: blur(9px)` while the sentence types on.
- **DESIGN.md says "never express focus with blur".** This is the one deliberate
  exception in the kit, because the reference does exactly this and the blur is the
  content (the tools becoming noise), not a focus effect. Put that justification in
  the card's own header comment, quoting the rule it bends, or a future session will
  "fix" it.

**Card 4 — `shot-float`** (from `nf5PUM0cg6k`)
- Purpose: show generated stills/screenshots as evidence while the line runs.
- Variables: `{ text, accent, beats:[...], shots:[<relative image path>], duration }`
  — 3 to 6 shots.
- Stage: each shot in a rounded 9:16 or 16:9 frame, radius 22px, 1px
  `rgba(255,255,255,0.14)` border, scattered around the frame edges, none crossing
  the centre band where the sentence sits (y 44%-60% stays clear — the sentence
  owns it).
- Moves: each shot enters `opacity 0 -> 1` + `scale 0.9 -> 1` staggered over
  `T(0.3)`, then drifts for the rest of the card: `y ±18`, `rotate ±3.5`,
  `ease sine.inOut`, each shot given a different phase so they do not move as a
  block. Sentence types on from `T(0.2)`.

**Card 5 — `ui-mock`** (from `VQ9R05DqL04`)
- Purpose: a stylised app window, used twice per intro — once working, once failed.
- Variables: `{ appName, appLogo (optional registry slug), shot (image path), state:"ok"|"fail", caption (optional), duration }`
- Stage: an outlined window, radius 20px, roughly 1400x760 centred: a 56px title bar
  carrying `appName` + optional logo, a 240px left sidebar with two placeholder
  input blocks and one button labelled from `VARS.buttonLabel ?? "Generate"`, and
  the `shot` image filling the main pane.
- **The state token is the whole trick**: `state:"ok"` renders every stroke, the
  button and the title text in `var(--accent)`; `state:"fail"` renders them in
  `#ef4444`. Same geometry, same file, one variable. This is what the reference
  does and it is why no second "failure" card is needed.
- Moves: window `scale 0.96 -> 1` + `opacity 0 -> 1` over `T(0.12)`; the button
  gets one `scale 1 -> 0.96 -> 1` press at `T(0.45)`; the shot pane crossfades in
  at `T(0.5)`. On `fail`, add a single 2-frame horizontal `x: ±6` shake at
  `T(0.55)` — one shake, not a judder loop.
- Encode the mapping as a literal table in the card, not as prose:
  ```js
  const STATE_STROKE = { ok: ACCENT, fail: '#ef4444' };
  ```

**Card 6 — `chain`** (from `VQ9R05DqL04`)
- Purpose: N labelled inputs converging into one named thing.
- Variables: `{ items:[{ label, shot (optional image path) }], target:{ label, logo (optional) }, duration }`
  — 2 to 4 items.
- Stage: items in a row across the upper two-thirds, each a 16:9 rounded thumbnail
  (or an accent-outlined empty frame when it has no `shot`) with its `label` under
  it at 30px weight 700 in `var(--accent)`; a chip at the bottom centre carrying
  `target.label` and its logo; thin 2px `var(--accent)` connector lines from each
  item down into the chip.
- Moves: items fade+slide in staggered over `T(0.0)`-`T(0.35)`; each label types on
  right after its item; the connector lines DRAW (animate `stroke-dashoffset` from
  full length to 0, `ease power1.inOut`) over `T(0.4)`-`T(0.75)`; the chip scales in
  at `T(0.72)`.
- Lines are `var(--accent)`, per DESIGN.md: *"Connecting lines / track fills /
  sweeps stay `var(--accent)` orange in every register."*

**Card 7 — `lower-third`** (from `VQ9R05DqL04`)
- Purpose: the ONLY card that sits over live footage rather than replacing it. Used
  for the presenter's own name/role line.
- Variables: `{ text, accent, beats:[...], duration }`
- Stage: transparent background (NO `#bg` element — the avatar is behind it). Text
  bottom-left, 56px weight 700, at x 132px, baseline 128px from the bottom, with a
  soft dark scrim behind it (`linear-gradient` to `rgba(0,0,0,0.55)`, 340px tall)
  so it stays readable over any footage.
- Moves: type-on only, plus the scrim fading in over `T(0.08)`.
- **This card must declare `"overlay": true` in `kit.json`** — plan 220's pacing
  lint counts an overlay beat as AVATAR time, not graphics time, because the
  presenter is still on screen.

### The 5 approved moves — no card may use a sixth

| Move | Implementation |
|---|---|
| type-on | per-word `opacity 0->1`, `duration 0.1`, `ease none`, at its beat |
| fade-and-slide | `opacity 0->1` + `y 14->0`, `ease power2.out` |
| stagger | the same tween applied to N siblings at even offsets |
| slow drift | `x/y/rotate` within ±20px / ±4deg, `ease sine.inOut`, spanning the card |
| line-draw | `stroke-dashoffset` full -> 0, `ease power1.inOut` |

Explicitly banned in this kit: particles, 3D transforms, glow pulses, spins,
elastic/bounce eases, colour tweens (see the ACCENT note), and any blur other than
`logo-grid`'s documented exception.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Install kit deps | `cd pipelines/video/intro-kit && npm ci --no-audit --no-fund` | exit 0 |
| The kit gate (merge gate) | `cd pipelines/video/intro-kit && bash scripts/check.sh` | exit 0, prints `intro-kit check OK` |
| Render one card | `cd pipelines/video/intro-kit && npx hyperframes@latest render cards/statement -o renders/statement.mp4 --fps 30` | exit 0, mp4 > 40KB |
| Render with variables | add `--variables '{"duration":2.0}'` to the render command | exit 0, mp4 duration ≈ 2.0s |
| Probe a render's duration | `ffprobe -v error -show_entries format=duration -of csv=p=0 renders/statement.mp4` | ≈ the requested duration |
| Extract a contact sheet | `ffmpeg -v error -i renders/statement.mp4 -vf "fps=4,scale=480:-1,tile=4x4" -frames:v 1 frames/statement.jpg -y` | writes the jpg |
| Check the body library still passes | `cd pipelines/video/card-library && bash ../visuals-flow/scripts/check.sh` | not required — out of scope |

If `npm ci` fails with `EACCES` on `_cacache`, retry with `--cache ./.npm-cache`.
Never run `npm cache clean`.

## Scope

**In scope**: everything under `pipelines/video/intro-kit/` (new), plus this plan's
row in `plans/README.md`.

**Out of scope**:
- `pipelines/video/card-library/**` — the body library. READ `DESIGN.md` and use the
  `logos/` symlink; change neither. A card-library edit here would collide with
  plan 220 and with any in-flight body-card work.
- `pipelines/video/visuals-flow/**` — the pipeline. Plan 220 wires the kit in; this
  plan's cards are deliberately inert until then.
- The cut-list schema, the composition builder, the pacing lint, and steps
  115/125/135 — all plan 220.
- The board and the `yt-video-edit` skill — plan 221.

## Git workflow

- Branch: `advisor/219-vf-intro-kit-cards`
- Commit per card (7 commits) plus one for the scaffold and one for the gate.
  Message form: `feat(intro-kit): <card> card`. No AI footers. Do NOT push.

## Steps

### Step 1: scaffold the folder

Create the tree shown in Current state. `package.json` needs only what the checker
uses:

```json
{
  "name": "intro-kit",
  "private": true,
  "type": "module",
  "dependencies": { "puppeteer-core": "^23.0.0" }
}
```

Symlink the logos: `ln -s ../card-library/logos logos` (relative, so it survives a
clone).

**`hyperframes.json` and `meta.json` are required, not optional.** Plan 220's
renderer reuses `visuals-flow/lib/render.mjs`, whose staging step copies exactly
these two files from the library root into a temp dir before invoking the
hyperframes CLI:

```js
      fs.cpSync(path.join(cardLibraryRoot, 'hyperframes.json'), path.join(stagedDir, 'hyperframes.json'));
      fs.cpSync(path.join(cardLibraryRoot, 'meta.json'), path.join(stagedDir, 'meta.json'));
```

A kit without them fails at render time with an `ENOENT` that reads as a broken
card. Copy `hyperframes.json` from `../card-library/hyperframes.json` verbatim:

```json
{
  "$schema": "https://hyperframes.heygen.com/schema/hyperframes.json",
  "registry": "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
  "paths": {
    "blocks": "compositions",
    "components": "compositions/components",
    "assets": "assets"
  }
}
```

`meta.json` gets its OWN id so renders never collide with the body library's cache:

```json
{
  "id": "yt-intro-kit",
  "name": "YT Intro Kit (Hyperframes)"
}
```

`.gitignore`: `node_modules/`, `renders/`, `.npm-cache/`. **`frames/` is NOT
ignored** — the contact sheets are the committed visual evidence this plan's
`ui: true` gate requires.

Write `KIT.md` containing, verbatim from this plan: the 7-card table, the 5-move
table, the banned-move list, the DESIGN.md quotes, and the variable-duration
contract. `KIT.md` is the locked contract a future authoring step reads instead of
inventing a treatment — it is the artifact that replaces "full creative freedom".

Write `kit.json` as the machine-readable registry:

```json
{
  "cards": [
    { "slug": "statement",   "overlay": false, "minDuration": 2.0, "maxDuration": 5.0,
      "required": ["text", "beats"], "optional": ["accent", "icon"] },
    { "slug": "checklist",   "overlay": false, "minDuration": 2.5, "maxDuration": 5.0,
      "required": ["icon", "rows"], "optional": [] },
    { "slug": "logo-grid",   "overlay": false, "minDuration": 2.5, "maxDuration": 5.0,
      "required": ["text", "beats", "logos"], "optional": ["accent"] },
    { "slug": "shot-float",  "overlay": false, "minDuration": 2.5, "maxDuration": 5.0,
      "required": ["text", "beats", "shots"], "optional": ["accent"] },
    { "slug": "ui-mock",     "overlay": false, "minDuration": 2.5, "maxDuration": 5.0,
      "required": ["appName", "shot", "state"], "optional": ["appLogo", "caption", "buttonLabel"] },
    { "slug": "chain",       "overlay": false, "minDuration": 3.0, "maxDuration": 5.0,
      "required": ["items", "target"], "optional": [] },
    { "slug": "lower-third", "overlay": true,  "minDuration": 2.0, "maxDuration": 5.0,
      "required": ["text", "beats"], "optional": ["accent"] }
  ]
}
```

**Verify**: `cd pipelines/video/intro-kit && node -e "const k=require('fs').readFileSync('kit.json','utf8'); const j=JSON.parse(k); if(j.cards.length!==7) throw new Error('want 7 cards, got '+j.cards.length); console.log('kit.json ok')"` -> prints `kit.json ok`.

### Step 2: build `cards/statement/index.html`

Copy `../card-library/slate/kinetic-sentence/index.html` as the starting shape, then:
- change `data-composition-id` to `statement` and the timeline key to match,
- insert the DURATION block from Current state,
- replace every hard-coded `6` in `data-duration` attributes with the default `3.5`,
- scale each word's `at` into the card: a beat's time is `at` clamped to `DUR`, and
  if the last beat's `at` exceeds `DUR * 0.9`, compress all beats proportionally so
  the final word always lands before the card ends,
- add the optional icon element and its drift.

The beat-compression snippet (author it here, the executor places it):

```js
      // A card is only as long as the builder gave it. If the transcript's word
      // times run past the card, compress them proportionally rather than dropping
      // words — a sentence that stops mid-phrase reads as a broken render.
      const raw = (DATA.beats || []).map((b) => Number(b.at) || 0);
      const last = raw.length ? raw[raw.length - 1] : 0;
      const limit = DUR * 0.9;
      const squeeze = last > limit && last > 0 ? limit / last : 1;
      const beatAt = raw.map((t) => +(t * squeeze).toFixed(3));
```

**Verify**:
```bash
cd pipelines/video/intro-kit
npx hyperframes@latest render cards/statement -o renders/statement.mp4 --fps 30 --variables '{"duration":2.0}'
ffprobe -v error -show_entries format=duration -of csv=p=0 renders/statement.mp4
```
-> render exits 0 and the printed duration is between 1.9 and 2.1.

### Step 3: build the remaining six cards

One card per commit, in this order: `checklist`, `logo-grid`, `shot-float`,
`ui-mock`, `chain`, `lower-third`. Follow each card's locked spec above exactly.

After each card:

```bash
cd pipelines/video/intro-kit
npx hyperframes@latest render cards/<slug> -o renders/<slug>.mp4 --fps 30
ffmpeg -v error -i renders/<slug>.mp4 -vf "fps=4,scale=480:-1,tile=4x4" -frames:v 1 frames/<slug>.jpg -y
```

**Then LOOK at `frames/<slug>.jpg` before committing.** A card that renders its
heading and an empty stage is the exact defect this plan is written against. The
frames must show the card's DEVICE — rows present and staggered, logos present then
dimmed, connector lines actually drawn, the window outline in the right colour for
its state.

**Verify** (per card): the contact sheet exists and the render is non-trivial:
`test -s frames/<slug>.jpg && [ $(stat -f%z renders/<slug>.mp4) -gt 40000 ]` -> exit 0.

### Step 4: write the content gate — `lib/check-kit.mjs` + `scripts/check.sh`

`scripts/check.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[ -d node_modules ] || npm ci --no-audit --no-fund
node lib/check-kit.mjs
echo "intro-kit check OK"
```

`lib/check-kit.mjs` runs these checks. Each failure prints a grep-able code.

| Code | Check |
|---|---|
| `E-KIT-REG` | `kit.json` lists exactly 7 cards, and every listed slug has a `cards/<slug>/index.html` — and no `cards/` subfolder is missing from `kit.json` |
| `E-KIT-CANVAS` | each card's root declares `data-width="1920" data-height="1080"` and `data-start="0"` |
| `E-KIT-TIMELINE` | each card registers `window.__timelines['<id>']` for its own `data-composition-id` |
| `E-KIT-DURATION` | each card's source contains the DURATION block (`VARS.duration`) and no `.clip` carries a hard-coded `data-duration` other than the default |
| `E-KIT-TOKEN` | each card's `:root` defines `--bg-to`, `--text`, `--accent` with the DESIGN.md values, and the file contains no hex colour outside the approved set (`#3a1f08 #0a0805 #ffffff #fb923c #34d399 #ef4444 #facc15 #000`) |
| `E-KIT-MOVE` | no banned ease or property appears: `elastic`, `bounce`, `rotationY`, `rotationX`, `perspective`, and no `filter:blur` outside `cards/logo-grid/` |
| `E-KIT-ACCENT` | any card that colours a word uses the `getComputedStyle` ACCENT literal, and contains neither `color: var(--accent)` on a word span nor a GSAP `color:` tween |
| `E-KIT-DEVICE` | **the content check.** For each card: render it, extract 8 frames, and assert the card's own device is visible — see below |

**`E-KIT-DEVICE`, the part that must not be weakened.** For each card, render at
`duration: 3.5`, extract frames at 15%/35%/55%/75%/95%, and assert per card:

- every card: the frame at 95% has more than `2.5%` of pixels brighter than the
  background floor (a blank final frame means the card never fired), and the frame
  at 95% differs from the frame at 15% by more than `1.5%` of pixels (nothing moved
  = a still, not a card).
- `statement` / `lower-third`: the bright-pixel count at 95% is at least 1.6x the
  count at 15% (words accumulated).
- `checklist`: the DOM at 95% contains `#rows` with `>= 2` child elements, each with
  non-empty text. **This is the assertion the mutation recipe attacks** — deleting
  `<div id="rows">` must fail here with `E-KIT-DEVICE`.
- `logo-grid`: at least 6 tile elements present, and the mean tile opacity at 95% is
  below 0.5 (they dimmed).
- `shot-float`: at least 3 shot elements, and at least one has a different
  `transform` at 95% than at 15% (it drifted).
- `ui-mock`: rendered twice, once `state:"ok"` and once `state:"fail"`; the two
  runs' 75% frames must differ by more than 0.5% of pixels, and the `fail` run's
  stroke colour must resolve to `#ef4444`.
- `chain`: every connector path's `stroke-dashoffset` at 95% is within 1 of 0
  (the lines finished drawing), and at least 2 items are present.

Read the DOM by loading the card in puppeteer-core at the target time via the same
`window.__timelines[...]` seek the pipeline uses; read the pixels from the extracted
frames. Model the puppeteer usage on
`pipelines/video/card-library/scripts/overflow-probe.mjs`, which already does
headless card loading in this repo — read it, and its sibling
`scripts/overflow-probe.test.mjs`, before writing this. Note how
`visuals-flow/lib/frame-gate.mjs:17` resolves it:

```js
  const mod = path.join(cardLibraryRoot, 'scripts', 'overflow-probe.mjs');
```

**Tests that open a browser or a server must tear down in a `try/finally`.** A
puppeteer handle left open hangs the gate forever at 0% CPU with no output
(LESSONS 2026-07-31). Add a `process.on('exit')` force-close as a backstop.

**Verify**: `cd pipelines/video/intro-kit && bash scripts/check.sh` -> exit 0, prints `intro-kit check OK`.

### Step 5: prove the gate fires

```bash
cd pipelines/video/intro-kit
cp cards/checklist/index.html /tmp/checklist.bak
perl -0pi -e 's{<div id="rows"[^>]*></div>}{}' cards/checklist/index.html
bash scripts/check.sh          # MUST fail, printing E-KIT-DEVICE
cp /tmp/checklist.bak cards/checklist/index.html
bash scripts/check.sh          # MUST pass again
```

If the mutated run passes, `E-KIT-DEVICE` is not really checking content. Fix the
check; do not proceed.

**Verify**: the mutated run exits non-zero and its output contains `E-KIT-DEVICE`.

### Step 6: write the operating docs and commit the evidence

- `README.md` — what the kit is, how to render one card, where the contract lives.
- `CLAUDE.md` — how a session operates here: the kit is LOCKED; adding a card is an
  owner decision, not a session's; never edit a card to fit one video (that is what
  variables are for); always look at the contact sheet before committing.
- Commit all 7 files in `frames/`. This is the `ui: true` evidence.

**Verify**: `ls pipelines/video/intro-kit/frames/*.jpg | wc -l` -> `7`.

## Test plan

- `scripts/check.sh` is the whole gate: registry, canvas, timeline registration,
  variable duration, palette, banned moves, the accent literal, and the per-card
  device check.
- The device check is mutation-proven in Step 5 and re-proven by boss at merge.
- Manual visual pass: 7 contact sheets, committed, looked at by the executor before
  each commit.
- No unit-test framework is introduced — `check-kit.mjs` is a single script that
  exits non-zero with a code. That matches `card-library`'s existing checker style.

## Done criteria

- [ ] `cd pipelines/video/intro-kit && bash scripts/check.sh` exits 0 and prints `intro-kit check OK`.
- [ ] Exactly 7 card folders: `ls -d pipelines/video/intro-kit/cards/*/ | wc -l` -> `7`.
- [ ] Every card renders and is non-trivial: for each slug, `renders/<slug>.mp4` is over 40000 bytes.
- [ ] Variable duration works: rendering `statement` with `--variables '{"duration":2.0}'` yields an mp4 whose ffprobe duration is between 1.9 and 2.1, and with `5.0` between 4.9 and 5.1.
- [ ] 7 contact sheets committed: `ls pipelines/video/intro-kit/frames/*.jpg | wc -l` -> `7`, each over 10000 bytes.
- [ ] Mutation proof: deleting `<div id="rows">` from `cards/checklist/index.html` makes `bash scripts/check.sh` FAIL printing `E-KIT-DEVICE`; restoring it passes.
- [ ] `KIT.md` exists and contains the strings `statement`, `checklist`, `logo-grid`, `shot-float`, `ui-mock`, `chain`, `lower-third`, and the heading for the 5 approved moves.
- [ ] `kit.json` lists 7 cards and `lower-third` is the only one with `"overlay": true`.
- [ ] Scope: `git diff --name-only 20a2ae62..HEAD` lists only paths under `pipelines/video/intro-kit/` and `plans/`.
- [ ] Punt-marker sweep is clean: `git diff 20a2ae62..HEAD | grep -nEi '(^\+.*)(TODO|FIXME|for now|we can.?t easily|let.?s just|actually,|wait,)'` prints nothing.

## STOP conditions

- **Gate integrity**: if `E-KIT-DEVICE` fails on a card you wrote, fix the CARD.
  Loosening a threshold, adding a per-card exemption, or deleting the assertion is a
  STOP — report instead.
- Do NOT add an 8th card, however obviously useful. Seven is the owner's locked
  number, derived from four reference videos. A missing card type is a finding to
  report, not a card to add.
- Do NOT edit anything under `pipelines/video/card-library/`. If a kit card seems to
  need a DESIGN.md change, STOP and report — the brand contract is owner-owned.
- Do NOT add a motion move outside the approved five. If a card's spec seems
  impossible within them, STOP and report which card and which move.
- If `npx hyperframes@latest render` cannot run offline or in this environment,
  STOP and report — do not substitute a hand-rolled renderer or a screenshot for a
  real render, and do not mark the device check as skipped.
- If a card's contact sheet shows an empty or heading-only stage, that card is NOT
  done. Do not commit it and do not proceed to the next card.

## Maintenance notes

- **The kit is locked on purpose.** Its value is that it is the same every video.
  Adding a card is an owner decision recorded in `decisions.md`, not a session's
  judgment call.
- `logo-grid`'s blur is a documented exception to DESIGN.md's "never express focus
  with blur". Do not "fix" it, and do not copy it into another card.
- `lower-third` is the only overlay card. Plan 220's pacing lint counts overlay
  beats as avatar time; if a second overlay card is ever added, that lint must learn
  about it.
- The `E-KIT-DEVICE` thresholds (2.5% bright pixels, 1.5% frame delta, 1.6x growth)
  are deliberately loose — they catch a dead card, not a slightly-off one. Judgment
  on whether a card looks GOOD stays with the owner's review, which is plan 221's
  board tab.
- `ui-mock`'s `STATE_STROKE` table is the reason there is no separate failure card.
  A reviewer should check it is a literal map, not prose.
