---
executor: claude-p
model: opus
test_cmd: bash pipelines/video/card-library/scripts/beat-smoke.sh
ui: true
deploy:
needs: []
---

# Plan 097: verdict-chip + score-pill overlay cards

## Summary

- **Problem statement**: During result-review narration the reference channel pins spoken pros/cons as ✓/✗ chips on the footage and pops a score badge at the spoken score (`references/vPqSgj8Ta3Y.md` moments 2:42.5 and ~2:11). Our overlay lineup (stat-hit, lower-third, tip-banner…) has no verdict or score form.
- **Goals**: two new card-library cards — `overlay/verdict-chips` (beat card: chips tick in one per beat, accumulate bottom-left) and `overlay/score-pill` (single: label + N/10 pill with optional logo) — registered in catalog.json, routable by the cue pass, passing the card gate.
- **Executor proposed**: claude-p / opus (novel-card authoring is Opus-class — HANDOFF "Model routing", owner-decided).
- **Done criteria** (terse): beat-smoke green (count bumped), calibrate page renders both cards, cue-pass routing lines added, screenshot attached (ui gate).
- **Stop conditions** (terse): resolve/lint reject `kind:beat` + `placement:overlay` → stop; never edit render.mjs.
- **Test / verification for success**: card gate + a scratch-video resolve/lint round-trip + rendered-frame inspection.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a249173..HEAD -- pipelines/video/card-library pipelines/video/visuals-flow/steps/020-cue-pass-llm`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard (taste-judged output — hence opus + ui screenshot)
- **Planned at**: commit `a249173`, 2026-07-19

## Why this matters

The reference channel's review segments never leave a spoken judgment
un-visualized: each pro/con becomes a persistent chip, each score a badge, at
the exact spoken second. These two overlays give our cue pass the same move on
demo/screen footage — the highest-frequency overlay pattern in all three
analyzed reference videos.

## Current state

- `pipelines/video/card-library/` — 42 cards; families are directories
  (`overlay/`, `section/`, `comparison/`, …), one card = `family/name/index.html`.
- Card contract (exemplar to imitate: `checklist/checklist/index.html`):
  1920x1080 page, `#root` with `data-composition-id`, `data-duration`,
  `data-composition-variables` (JSON defaults), children as `class="clip"`
  tracks, one paused GSAP timeline registered on
  `window.__timelines['<id>']`, `/* ===== CONTENT ===== */` vs
  `/* ===== TIMELINE (LOCKED) ===== */` split, palette via `:root` vars.
- Style rules (`card-library/DESIGN.md`, mirrored in visuals-flow
  `EDITOR-STYLE-GUIDE.md`): Inter only; accent `#FB923C`; positive `#34D399`;
  negative `#FB7185`; panels white 4% fill + white 10% 1px border, radius 24;
  entrances 0.45–0.6s strong ease-out; overlays anchor to a corner/lower
  third, never center-blocking; transparent background for overlay cards
  (no `#bg` gradient — body stays transparent).
- `catalog.json` — machine contract. Beat exemplar (checklist): `kind:"beat"`,
  `beat_shape:{"text":"string"}`, `max_beats`, `max_reveal_chars`,
  `default_duration`. Single overlay exemplar (`overlay/stat-hit`):
  `kind:"single"`, `placement:"overlay"`, `variables`, `default_duration: 5`.
  Logos: `"logo": "string (optional) — logos/ registry slug"`.
- `scripts/beat-smoke.sh` — card gate; line 5 asserts the beat-card count:
  `[ "$(...)" = "11" ]` — MUST be bumped to `12` when `verdict-chips` lands.
- Cue-pass surface: `steps/020-cue-pass-llm/cue-pass-prompt.md` injects
  `{{CATALOG}}` (new cards flow in automatically) but the "Choosing a card"
  routing prose + `RULEBOOK.md` must gain matching lines (edit BOTH together —
  HANDOFF rule surface 1).
- Verification loop for a scratch video: `node lib/resolve.mjs <slug>` +
  `node lib/lint-cues.mjs <slug>` in `pipelines/video/visuals-flow`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Card gate | `bash pipelines/video/card-library/scripts/beat-smoke.sh` | exit 0 |
| Flow gate | `bash pipelines/video/visuals-flow/scripts/check.sh` | exit 0 |
| Render one card for inspection | `cd pipelines/video/card-library && npx hyperframes@latest render overlay/score-pill -o /tmp-render.mp4` — write INSIDE the repo, e.g. `-o scratch-render.mp4`, delete after | exit 0, file exists |

## Scope

**In scope**:
- `pipelines/video/card-library/overlay/verdict-chips/index.html` (new)
- `pipelines/video/card-library/overlay/score-pill/index.html` (new)
- `pipelines/video/card-library/catalog.json` (2 entries)
- `pipelines/video/card-library/scripts/beat-smoke.sh` (count 11 → 12)
- `pipelines/video/visuals-flow/steps/020-cue-pass-llm/cue-pass-prompt.md` + `RULEBOOK.md` (routing lines, edited together)

**Out of scope**:
- `render.mjs`, `resolve.mjs`, `lint-cues.mjs` code (config/prose only if a
  named constant list must mention the new slugs — read before assuming)
- Any existing card; the board; effects modules.

## Git workflow

- Branch: `advisor/097-verdict-and-score-overlays`
- Commit per step: `feat(card-library): <step>` — no AI footers. Do NOT push.

## Steps

### Step 1: overlay/verdict-chips card

Beat card, transparent overlay. Chips accumulate in a column anchored
bottom-left (120px inset), each chip = icon circle (✓ green / ✗ rose) + label
in a dark panel pill (near-black 82% opacity, radius 999, Inter 600 ~30px,
white text). Each beat: chip slides up 20px + fades in 0.45s ease-out; ✓/✗
draws/pops 0.2s later (imitate the checklist card's box-then-check rhythm).
Chips persist to card end.

`data-composition-variables` defaults (also the catalog beat shape):

```json
{"beats":[
  {"text":"Clean underwater scene","verdict":"yes","at":0.4},
  {"text":"Weird shirt removal","verdict":"no","at":1.2}
]}
```

Follow the checklist exemplar's structure exactly: CONTENT/TIMELINE split,
paused GSAP timeline in `window.__timelines['verdict-chips']`, no `#bg` layer
(transparent body), `will-change` on animated nodes.

catalog.json entry (insert alphabetically within the overlay family group):

```json
{
  "slug": "overlay/verdict-chips",
  "kind": "beat",
  "placement": "overlay",
  "purpose": "spoken pros/cons pinned to footage: green-check / rose-cross pill chips tick in one per beat and persist, anchored bottom-left",
  "variables": {},
  "beat_shape": { "text": "string", "verdict": "string — 'yes' | 'no'" },
  "default_duration": 8,
  "max_beats": 4,
  "max_reveal_chars": 32
}
```

**Verify**: `cd pipelines/video/card-library && node -e "const c=require('./catalog.json').cards.find(x=>x.slug==='overlay/verdict-chips');console.log(c.kind,c.placement,c.max_beats)"` -> `beat overlay 4`

### Step 2: overlay/score-pill card

Single card, transparent overlay, `default_duration: 4`. One pill anchored
bottom-left: optional muted logo (imitate the muted-logo treatment used by
`section-counter-scale` — saturate .5, small), label (dim cream, uppercase,
20px), divider dot, score `N/10` (white 900, ~44px; the number counts up from
0 over 0.5s like `overlay/stat-hit`). Gold `#FACC15` for the score text ONLY
when `winner: true` (DESIGN.md gold rule). Entrance: scale from 90% + fade,
0.5s, slight overshoot allowed (badge exception in DESIGN.md).

catalog.json entry:

```json
{
  "slug": "overlay/score-pill",
  "kind": "single",
  "placement": "overlay",
  "purpose": "spoken score badge: label + animated N/10 pill (optional logo; gold only when winner) at the second the score is said",
  "variables": {
    "label": "string",
    "score": "number",
    "max": "number (optional, default 10)",
    "logo": "string (optional) — logos/ registry slug",
    "winner": "boolean (optional, default false)"
  },
  "default_duration": 4
}
```

**Verify**: `bash pipelines/video/card-library/scripts/beat-smoke.sh` -> exit 0 AFTER Step 3's count bump; at this point run `node -e "require('./catalog.json')"` (cwd card-library) -> exit 0 (valid JSON).

### Step 3: gates and routing

1. `scripts/beat-smoke.sh`: bump the beat-count assertion `"11"` → `"12"`.
2. `cue-pass-prompt.md` "Choosing a card" section — add two routing lines
   (and mirror them word-for-word in the step's `RULEBOOK.md`):
   - "VO judges a result while footage shows it (a pro or con is spoken) →
     `overlay/verdict-chips`, one beat per spoken judgment, ≤4."
   - "VO announces a rating or score ('gets a 9.5 out of 10') →
     `overlay/score-pill` at the spoken score; `winner:true` only for a
     final-verdict winner."
3. Read `pipelines/video/visuals-flow/lib/lint-cues.mjs` header constants: if
   any list enumerates overlay slugs by name (e.g. stat-hit spacing rule),
   decide whether the new slugs belong there — the stat-hit cap/spacing rule
   does NOT extend to these cards (verdict chips are expected several times
   per review segment); leave generic caps to apply.

**Verify**: `bash pipelines/video/card-library/scripts/beat-smoke.sh` -> exit 0. `bash pipelines/video/visuals-flow/scripts/check.sh` -> exit 0 (`check-rulebook.mjs` confirms prompt/RULEBOOK stay in sync if it checks that — if it fails, read its output and fix the pair).

### Step 4: visual proof (ui gate)

Render both cards (`npx hyperframes@latest render <slug> -o scratch-<name>.mp4`
inside `card-library/`, then `ffmpeg -ss 2 -i scratch-<name>.mp4 -frames:v 1 shot-<name>.png`),
LOOK at the frames (extract-and-look is mandatory — TESTS.md folded lesson),
attach the two PNGs to the PR, delete the scratch files. Judge against:

- [ ] chips/pill anchored bottom-left, nothing near frame center
- [ ] colors exactly `#34D399` / `#FB7185` / `#FB923C` family, dark pill panels
- [ ] Inter, no emoji, text fits (no wrap/clip at max_reveal_chars)
- [ ] background fully transparent (checkerboard in a viewer / alpha in ffprobe)

**Verify**: `ffprobe -v error -show_entries stream=pix_fmt -of csv=p=0 scratch-verdict-chips.mov 2>/dev/null || true` — if the render tool emits mov with alpha for overlays use it; otherwise confirm transparency by rendering over a colored backdrop and inspecting. State plainly in the PR what was checked.

## Test plan

Card gate (beat-smoke, count 12), flow gate (check.sh incl. rulebook sync),
catalog JSON validity, rendered-frame visual inspection against the Step 4
rubric (rubric = the checklist above; the tier-3 verifier scores against it).

## Done criteria

- [ ] Both `index.html` files exist and register timelines under the correct composition ids
- [ ] `bash pipelines/video/card-library/scripts/beat-smoke.sh` exit 0 (count = 12)
- [ ] `bash pipelines/video/visuals-flow/scripts/check.sh` exit 0
- [ ] Routing lines present in BOTH cue-pass-prompt.md and RULEBOOK.md, identical wording
- [ ] Two inspection PNGs attached to the PR and passing the Step 4 rubric

## STOP conditions

- `resolve.mjs`/`lint-cues.mjs` structurally reject `kind:"beat"` + `placement:"overlay"` (unknown-combination error) — stop and report; do NOT patch resolver code under this plan.
- Any DESIGN.md conflict (new hue, center-anchored overlay) that seems needed — stop; the design rules win.
- beat-smoke fails for a reason OTHER than the count line — stop, report output.

## Maintenance notes

- These cards are cue-routable; expect the 060 fold to tune `max_beats` / spacing after the first real video uses them.
- Reference evidence: `references/vPqSgj8Ta3Y.md` (verdict chips 2:42.5; score pills throughout rounds).
