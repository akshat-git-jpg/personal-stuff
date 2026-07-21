<!-- boss frontmatter -->
---
executor: agy
model:
test_cmd: cd pipelines/video/card-library && bash scripts/check-cards.sh && node scripts/check-catalog.mjs
ui: true
deploy:
needs: ["Uses the object-form variable contract from 115 — land 115 first"]
---

# Plan 119: `title/title-versus` card, and cold-open routing by capability instead of slug

## Summary

- **Problem statement**: The cue prompt's cold-open rule hard-codes `title/title-aurora-wave` as THE comparison opener while demanding the compared products be "the VISUAL hero". That card renders logos as small chips beneath a dominant text title, so the rule's intent and its prescribed card contradict each other — and every model that follows the rule produces the same rejected output. No card in the library renders two large logo lockups with a VS between them.
- **Goals**:
  - Add `title/title-versus`: two large logo tiles side by side, product name beneath each, VS badge between.
  - Change the cold-open rule to route by a **capability declared in the catalog**, never by a hard-coded slug.
  - Establish `roles` as the general mechanism so future rules stop naming cards.
- **Executor proposed**: `agy` (Gemini 3.1 Pro High) — card build with a full exemplar inlined; passes the render+inspect gate.
- **Done criteria** (terse — full list below): card renders with real logos; catalog entry with object-form variables; prompt routes by role; `check-cards.sh` and `check-catalog.mjs` green.
- **Stop conditions** (terse — full list below): logo data URIs not reaching the card; any change to `title-aurora-wave`'s own rendering.
- **Test / verification for success**: render the card with two real registry logos, extract a frame, and look at it against the layout spec.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 18488a2..HEAD -- pipelines/video/card-library pipelines/video/visuals-flow/steps/020-cue-pass-llm`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 115 (object-form catalog variables)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `18488a2`, 2026-07-21

## Why this matters

Owner review of `opusclip-tutorial` on 2026-07-21 rejected the intro card. The owner's description of what it should have been: *"two big logos with text at the bottom, side by side, with versus in between."*

The cue-pass session did not choose badly — it followed a mandatory rule verbatim:

> **Cold open (mandatory for comparison videos):** the intro title card makes the compared products the VISUAL hero — `title/title-aurora-wave` with `platforms` logo chips, never a text-only title.

`title-aurora-wave` draws a large title with a row of small logo chips beneath. The products are decoration, not the hero. So the rule's stated intent is unreachable through the card the rule mandates, and every model reproduces the same result. Hard-coding a slug inside a rule converts a card-set gap into a permanent, invisible defect.

The layout the owner wants half-exists in `comparison/head-to-head` ("two-contender VS panel … center VS badge"), but that card takes a raw `logoSvg` string and falls back to a coloured letter tile — it is **not** wired to the logo registry, so it cannot show real product logos. Neither existing card can do the job.

## Current state

### The exemplar to copy: `card-library/title/title-aurora-wave/index.html` (280 lines)

Structure to imitate exactly:
- A header comment block (lines 9–10) telling the human editor to change `:root` colours and variables, and **not** to touch the TIMELINE block.
- `data-composition-variables='{...}'` on the root element (line 115) carrying demo data so the card renders standalone.
- `const VARS = (window.__hyperframes && window.__hyperframes.getVariables ? window.__hyperframes.getVariables() : null) || {};` (line 144).
- `const DATA = { title: VARS.title ?? '…', platforms: VARS.platforms ?? PLATFORMS };` (lines 165–167).
- `const LOGOS = VARS.__logos ?? {};` (line 197) — **this is the registry hook**.
- `/* ===== TIMELINE (LOCKED — do not edit) ===== */` (line 171) and `window.__timelines['title-aurora-wave'] = tl;` (line 277).

### How logos reach a card — `visuals-flow/lib/logos-inline.mjs`

```js
  if (typeof variables.logo === 'string') refs.add(variables.logo);
  for (const s of variables.productLogos ?? []) if (typeof s === 'string') refs.add(s);
  for (const p of variables.platforms ?? []) if (typeof p?.logo === 'string') refs.add(p.logo);
  for (const b of variables.beats ?? []) if (typeof b.logo === 'string') refs.add(b.logo);
  ...
  return { variables: refs.size ? { ...variables, __logos: logos } : variables, missing };
```

Called by `lib/board.mjs` and `lib/render.mjs`. **Consequence that shapes this plan: if the new card uses a `platforms` array of `{name, logo}`, logo inlining works with zero changes to `logos-inline.mjs`.** Use that shape; do not invent a new variable name.

`resolve.mjs` also validates `platforms[].logo` slugs against the registry (lines 79–91), so unknown slugs already error.

### The publishing contract — `card-library/CLAUDE.md`

A card is real only when it is `<type>/<card-name>/index.html`, committed **and pushed**; the render2 Templates tab is a live directory scan. `verdict/winners-podium` sat untracked for a day exactly this way. `bash scripts/check-cards.sh` is the structural gate.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Card structure gate | `cd pipelines/video/card-library && bash scripts/check-cards.sh` | exit 0 |
| Catalog contract gate (from 115) | `cd pipelines/video/card-library && node scripts/check-catalog.mjs` | `catalog ok` |
| Hyperframes lint | `cd pipelines/video/card-library && npx --yes hyperframes@0.7.62 lint title/title-versus` | exit 0 (the "Studio can't drag-edit" and "Google Fonts" warnings are expected) |
| Render to inspect | `cd pipelines/video/card-library && npx --yes hyperframes@0.7.62 render title/title-versus --out /tmp/tv.mp4` | mp4 written |
| Extract a frame | `ffmpeg -v error -ss 3 -i /tmp/tv.mp4 -frames:v 1 /tmp/tv.png -y` | png written |
| Visuals-flow suite | `cd pipelines/video/visuals-flow && node --test` | exit 0 |

## Scope

**In scope**:
- `pipelines/video/card-library/title/title-versus/index.html` (new)
- `pipelines/video/card-library/catalog.json` (new entry + `roles` on the two existing comparison openers)
- `pipelines/video/card-library/gallery-order.json` (surface the new card)
- `pipelines/video/visuals-flow/steps/020-cue-pass-llm/cue-pass-prompt.md` and `RULEBOOK.md` (cold-open rule)

**Out of scope**:
- `title/title-aurora-wave` and `title/title-cinematic-float` internals. They gain a `roles` entry in the catalog and nothing else.
- `comparison/head-to-head`. Wiring it to the logo registry is a reasonable future change but is **not** this plan — it would alter a card already used in `opusclip-tutorial` cue `c29`.
- `lib/logos-inline.mjs` — using `platforms` means no change is needed. If you find yourself editing it, the card's variable shape is wrong.
- Any `cues.json`.

## Git workflow

- Branch: `advisor/119-title-versus-card`
- Commit per step. Message style: `feat(card-library): title-versus comparison opener`. No AI footers. Do NOT push.

## Steps

### Step 1: Build the card

Create `title/title-versus/index.html` by copying `title/title-aurora-wave/index.html` and replacing the layout. Keep the header comment block, the `data-composition-variables` attribute, the `VARS`/`DATA`/`LOGOS` wiring, and the TIMELINE marker convention.

**Layout spec** (this is the acceptance criterion — the owner's own description):

```
                Submagic  vs  OpusClip          ← optional title line, small
      ┌──────────────┐              ┌──────────────┐
      │              │              │              │
      │     LOGO     │     VS       │     LOGO     │   ← tiles ~360px, equal size
      │              │   (badge)    │              │
      └──────────────┘              └──────────────┘
          Submagic                      OpusClip       ← product name, large, beneath
```

Requirements:
- **The logo tiles are the largest elements on screen.** Tile side ≈ 360px on the 1920×1080 canvas; logo image ≈ 60% of the tile, centred, `object-fit: contain`.
- Product name beneath each tile, ~64px, weight 800.
- A centred `VS` badge between the tiles, visually subordinate to the logos.
- The optional `title` line sits **above** the lockup at ~44px — deliberately smaller than the product names, inverting `title-aurora-wave`'s hierarchy. Omit the element entirely when `title` is absent.
- Exactly two platforms is the designed case. With 3–4, keep tiles equal and shrink them; render no VS badge for >2.

Variables:

```json
{
  "title": "optional, small line above the lockup",
  "platforms": [ { "name": "Submagic", "logo": "submagic" }, { "name": "OpusClip", "logo": "opusclip" } ]
}
```

Logo resolution — copy this from `title-aurora-wave`:

```js
const LOGOS = VARS.__logos ?? {};
// each tile:
const src = LOGOS[p.logo];
tile.innerHTML = src
  ? `<img class="logo" src="${src}" alt="">`
  : `<span class="logo-fallback">${(p.name || '?')[0]}</span>`;
```

Motion (TIMELINE block, paused GSAP timeline, seek-safe, registered as `window.__timelines['title-versus']`):
1. `0.10s` tiles scale in from `0.86` with `back.out(1.6)`, left then right, 0.12s apart.
2. `0.55s` VS badge pops from `scale 0.4` with `back.out(2.4)`.
3. `0.75s` product names rise 18px with `power3.out`, staggered 0.08s.
4. `0.95s` optional title fades in from `y: -14`.
5. A slow ambient drift on the background only — never on the tiles, so logos stay crisp.

`data-composition-variables` demo data must use `submagic` and `opusclip`, which both exist in `logos/registry.json`.

**Verify**: `cd pipelines/video/card-library && npx --yes hyperframes@0.7.62 lint title/title-versus` -> exit 0

### Step 2: Render and LOOK at it

Per `plans/runs/LESSONS.md` 2026-07-19, a successful render proves nothing about how it looks.

```
cd pipelines/video/card-library
npx --yes hyperframes@0.7.62 render title/title-versus --out /tmp/tv.mp4
ffmpeg -v error -ss 3 -i /tmp/tv.mp4 -frames:v 1 /tmp/tv.png -y
```

Open `/tmp/tv.png` and check every item:
- [ ] Both logos visible as **images**, not letter fallbacks (this proves `__logos` wiring).
- [ ] Tiles are the dominant elements; each product name is larger than the title line.
- [ ] The VS badge sits centred between the tiles and does not overlap either.
- [ ] Nothing is clipped at any edge.

A letter-tile fallback means `__logos` is not arriving — see STOP conditions. Attach the PNG to the PR (`ui: true`).

**Verify**: `/tmp/tv.png` satisfies all four checks.

### Step 3: Catalog entry with role routing

Add the card using the object-form contract from plan 115:

```json
{
  "slug": "title/title-versus",
  "kind": "single",
  "placement": "fullframe",
  "roles": ["comparison-coldopen"],
  "purpose": "comparison cold open: two large logo tiles side by side with the product name beneath each and a VS badge between — the compared products ARE the visual hero",
  "variables": {
    "title": { "type": "string", "required": false, "role": "heading", "max_words": 6,
               "omit_unless": "it adds framing the product names do not already carry",
               "example": "Which one ships faster" },
    "platforms": { "type": "array", "required": true, "item_shape": {
        "name": { "type": "string", "required": true,  "role": "label",     "max_words": 3, "example": "Submagic" },
        "logo": { "type": "string", "required": false, "role": "logo_slug", "example": "submagic" }
    }}
  },
  "default_duration": 10
}
```

Also add `roles` to the two existing openers so the rule has a real choice set:
- `title/title-aurora-wave` → `"roles": ["title", "comparison-coldopen"]`
- `title/title-cinematic-float` → `"roles": ["title", "comparison-coldopen"]`

Add `title/title-versus` to `gallery-order.json` near the other title cards.

**Verify**: `cd pipelines/video/card-library && node scripts/check-catalog.mjs && bash scripts/check-cards.sh` -> `catalog ok`, exit 0

### Step 4: Route the cold-open rule by capability

In `cue-pass-prompt.md`, replace the hard-coded rule with:

```
Cold open (mandatory for comparison videos): open on a card whose catalog
`roles` include `comparison-coldopen`, with the compared products supplied as
`platforms` entries carrying their logo slugs — never a text-only title. When
two products are compared, prefer `title/title-versus`: it renders both logos
at hero size with a VS between them, which is what a versus video promises in
its first seconds. The other `comparison-coldopen` cards lead with the title
and reduce the products to chips — use them only when there are more than
four products, or no logo exists for a product.
```

Two properties matter and must survive review: the rule states the **capability** first and the slug only as a preference, and it says **why** each option is chosen, so a model with a changed card set can still decide correctly.

Mirror into `RULEBOOK.md`.

**Verify**: `cd pipelines/video/visuals-flow && node lib/check-rulebook.mjs` -> `rulebook ok`

### Step 5: Prove it resolves end to end

Write a temporary cue using the new card against the existing `opusclip-tutorial` transcript in a scratch workdir (never touch `videos/opusclip-tutorial/cues.json`):

```
mkdir -p /tmp/tv-check && cp pipelines/video/visuals-flow/videos/opusclip-tutorial/transcript.json /tmp/tv-check/
```

Write `/tmp/tv-check/cues.json` with a single `title/title-versus` cue anchored `"Some Magic and Opus Clips both promise"`, `platforms` = Submagic/OpusClip with their slugs. Then:

```
cd pipelines/video/visuals-flow && node lib/resolve.mjs /tmp/tv-check
```

**Verify**: exit 0, and `/tmp/tv-check/resolved.json` contains the cue with both logo slugs intact and no `unknown logo slug` error.

### Step 6: Publish check

Per `card-library/CLAUDE.md`, a card the editor cannot see does not exist.

**Verify**: `cd pipelines/video/card-library && bash scripts/check-cards.sh` -> exit 0, and `git status --short title/title-versus/` shows the file staged/committed (not untracked).

## Test plan

The card has no unit tests — cards are verified structurally by `check-cards.sh`, contractually by `check-catalog.mjs`, and visually by the Step 2 frame inspection. The visuals-flow suite must stay green because the catalog changed.

## Done criteria

- [ ] `title/title-versus/index.html` exists, committed (not untracked)
- [ ] `cd pipelines/video/card-library && bash scripts/check-cards.sh` exits 0
- [ ] `cd pipelines/video/card-library && node scripts/check-catalog.mjs` prints `catalog ok`
- [ ] `npx hyperframes@0.7.62 lint title/title-versus` exits 0
- [ ] Extracted frame shows two real logo images at hero size with a VS between (PNG attached to PR)
- [ ] Catalog entry carries `roles: ["comparison-coldopen"]`; both existing openers carry `roles` too
- [ ] The cold-open rule names a **role** before any slug
- [ ] `cd pipelines/video/visuals-flow && node --test` exits 0
- [ ] Step 5 scratch resolve exits 0 with logos intact

## STOP conditions

- **Logos render as letter fallbacks.** `__logos` is not arriving. Do **not** work around it by embedding logo files in the card — stop and report; the `platforms` shape is the contract that makes inlining work.
- **You need to edit `lib/logos-inline.mjs`.** That means the variable shape diverged from `platforms[].logo`. Stop and fix the card's shape instead.
- **`title-aurora-wave` renders differently than before.** It must be untouched apart from its catalog `roles`.
- **The catalog entry will not pass `check-catalog.mjs`.** Plan 115 may not have landed. Stop and report rather than reverting to string-form variables.

## Maintenance notes

- `roles` is introduced here as the general escape from slug-hard-coding. Every future rule that would name a card should name a role instead; the fold should treat a new hard-coded slug in the prompt as a defect.
- The layout is specified for exactly two products because that is the case the owner rejected. The 3–4 path is defensive; if multi-product versus opens become common, revisit the tile sizing deliberately.
- `comparison/head-to-head` remains logo-blind. When a plan wires it to the registry, reuse the `platforms` convention rather than inventing a third logo shape.
