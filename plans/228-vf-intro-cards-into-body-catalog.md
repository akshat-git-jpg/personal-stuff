---
executor: agy
model:
test_cmd: cd pipelines/video/card-library && bash scripts/check-cards.sh && node scripts/check-catalog.mjs && cd ../visuals-flow && bash scripts/check.sh
ui:
deploy:
needs: []
needs_prs: []
touches: [pipelines/video/card-library/catalog.json, pipelines/video/card-library/tool-icon/logo-grid/index.html, pipelines/video/card-library/enacted/shot-float/index.html, pipelines/video/card-library/enacted/ui-mock/index.html, pipelines/video/card-library/process/chain/index.html, pipelines/video/visuals-flow/lib/logos-inline.mjs, pipelines/video/visuals-flow/lib/logos.test.mjs]

mutation_apply:
mutation_command:
mutation_expect:
mutation_cwd:
mutation_timeout:
---

# Plan 228: Port the four intro-only cards into the body card library

## Summary

- **Problem statement**: The `simple` intro flow renders from its own private
  7-card kit at `pipelines/video/intro-kit/`, separate from the 68-card body
  catalog at `pipelines/video/card-library/`. The owner wants ONE catalog
  serving both intro and body. Four of the seven kit cards (`logo-grid`,
  `shot-float`, `ui-mock`, `chain`) have no body equivalent, so they must
  become real body cards before the intro can be repointed.
- **Goals**:
  - Add `tool-icon/logo-grid`, `enacted/shot-float`, `enacted/ui-mock` and
    `process/chain` to `card-library/`, each with a `catalog.json` entry.
  - Convert their asset access from the kit's private symlink + `LOGO_FILES`
    mirror to the body pipeline's `enrichLogos` / `enrichImages` data-URI
    mechanism.
  - Extend `enrichLogos` to walk `variables.target.logo` and
    `variables.items[].logo` (the two shapes `process/chain` uses), with a unit
    test.
  - Leave `pipelines/video/intro-kit/` and every visuals-flow intro code path
    untouched — plan 229 does that.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — the four card files
  are copied verbatim and then get a short, named list of edits; no
  re-expression, no design judgment.
- **Done criteria** (terse): `check-cards.sh` + `check-catalog.mjs` +
  visuals-flow `check.sh` all exit 0; the four new slugs are in `catalog.json`;
  each new card renders to a non-trivial MP4; `enrichLogos` resolves
  `target.logo` and `items[].logo`.
- **Stop conditions** (terse): do not touch `intro-kit/`, do not touch any
  `lib/intro-kit/*` file, do not weaken a gate to make it pass.
- **Test / verification for success**: the three check scripts above, plus a
  new unit test in `lib/logos.test.mjs` and a real hyperframes render of each
  new card whose output file must exceed 20 KB.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 69042eb1..HEAD -- pipelines/video/card-library pipelines/video/intro-kit pipelines/video/visuals-flow/lib/logos-inline.mjs`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `69042eb1`, 2026-08-23

## Why this matters

The owner authored a `simple` intro flow (plans 218–221) against a locked
7-card kit that lives in its own folder with its own `kit.json` schema, its own
`hyperframes.json`, and its own private copy of the logo lookup. That was the
right call while the flow was being proven; it is the wrong call now, because
it means the intro and the body of the same video draw from two different card
sets that drift independently. The owner's decision (2026-08-23) is one
catalog for both.

Four kit cards are genuinely new visual devices the body catalog does not have,
so they are worth keeping — they just belong in `card-library/` like every
other card. This plan moves them and makes them speak the body pipeline's asset
protocol. It changes nothing about how the intro runs; plan 229 does that, and
it depends on this one landing first.

## Current state

### The two card roots

| Root | Shape | Schema | Consumers |
|---|---|---|---|
| `pipelines/video/card-library/` | `<type>/<card>/index.html`, 68 cards | `catalog.json` (`slug: "<type>/<card>"`) | visuals-flow body pipeline; render2 Templates tab (directory scan) |
| `pipelines/video/intro-kit/` | `cards/<card>/index.html`, 7 cards | `kit.json` | `visuals-flow/lib/intro-kit/*` only |

`card-library/CLAUDE.md` is the operating contract for adding a card. Its two
registrations are independent: the folder shape makes the card visible in
render2, the `catalog.json` entry makes it selectable by the pipeline. Both are
required here.

### The four cards being ported, and their current variables

Read verbatim from `pipelines/video/intro-kit/kit.json`:

```json
{ "slug": "logo-grid",   "overlay": false, "minDuration": 2.5, "maxDuration": 5.0,
  "required": ["text", "beats", "logos"], "optional": ["accent"] },
{ "slug": "shot-float",  "overlay": false, "minDuration": 2.5, "maxDuration": 5.0,
  "required": ["text", "beats", "shots"], "optional": ["accent"] },
{ "slug": "ui-mock",     "overlay": false, "minDuration": 2.5, "maxDuration": 5.0,
  "required": ["appName", "shot", "state"], "optional": ["appLogo", "caption", "buttonLabel"] },
{ "slug": "chain",       "overlay": false, "minDuration": 3.0, "maxDuration": 5.0,
  "required": ["items", "target"], "optional": [] }
```

Each card's `===== CONTENT =====` block, verbatim from its `index.html`:

`intro-kit/cards/logo-grid/index.html` lines 67–80:
```js
        text: VARS.text ?? "There are too many tools doing one job each",
        accent: VARS.accent ?? "one job each",
        beats: VARS.beats ?? [
          { text: "There", accent: false, at: 0.0 },
          ... nine word objects ...
        ],
        logos: VARS.logos ?? ["openart", "higgsfield", "synthesia", "heygen", "arcads", "n8n", "make", "zapier"]
```

`intro-kit/cards/shot-float/index.html` lines 68–80:
```js
        text: VARS.text ?? "Every one of these was generated, not filmed",
        accent: VARS.accent ?? "generated, not filmed",
        beats: VARS.beats ?? [ ... eight word objects ... ],
        shots: VARS.shots ?? ["shots/mockup-dashboard.jpg", "shots/mockup-code.jpg", "shots/mockup-chat.jpg", "shots/mockup-social.jpg"]
```

`intro-kit/cards/ui-mock/index.html` lines 87–92:
```js
        appName: VARS.appName ?? "OpenArt",
        appLogo: VARS.appLogo ?? "openart",
        shot: VARS.shot ?? "shots/mockup-dashboard.jpg",
        state: VARS.state === 'fail' ? 'fail' : 'ok',
        caption: VARS.caption ?? null,
        buttonLabel: VARS.buttonLabel ?? "Generate"
```

`intro-kit/cards/chain/index.html` lines 71–76:
```js
        items: VARS.items ?? [
          { label: "Podcast audio", shot: "shots/mockup-chat.jpg" },
          { label: "Screen capture", shot: "shots/mockup-code.jpg" },
          { label: "Analytics data", shot: "shots/mockup-dashboard.jpg" }
        ],
        target: VARS.target ?? { label: "Final video", logo: "heygen" }
```

### How the kit reaches assets today (the thing being replaced)

Three of the four cards hold a **symlink** — `logos -> ../../logos` and/or
`shots -> ../../shots` — and each one carries a hand-written mirror of the logo
registry:

```js
      const LOGO_FILES = {
        openart: "openart.png", higgsfield: "higgsfield.png", synthesia: "synthesia.png",
        heygen: "heygen.png", arcads: "arcads.png", n8n: "n8n.png", make: "make.png",
        zapier: "zapier.png", langchain: "langchain.png", flowise: "flowise.png",
        submagic: "submagic.png", opusclip: "opusclip.png"
      };
```

The asset lines that consume it:

| File | Line | Current code |
|---|---|---|
| `logo-grid/index.html` | 134 | `const tiles = DATA.logos.slice(0, 12).map((slug, i) => {` |
| `logo-grid/index.html` | 144 | `img.src = 'logos/' + (LOGO_FILES[slug] \|\| 'openart.png');` |
| `ui-mock/index.html` | 144–145 | `if (DATA.appLogo && LOGO_FILES[DATA.appLogo]) {` / `logoImg.src = 'logos/' + LOGO_FILES[DATA.appLogo];` |
| `ui-mock/index.html` | 151 | `shotImg.src = DATA.shot;` |
| `chain/index.html` | 133 | `img.src = it.shot;` |
| `chain/index.html` | 185–186 | `if (DATA.target.logo && LOGO_FILES[DATA.target.logo]) {` / `targetLogo.src = 'logos/' + LOGO_FILES[DATA.target.logo];` |
| `shot-float/index.html` | 127, 136 | `const shots = DATA.shots.slice(0, 6).map((src, i) => {` / `img.src = src;` |

### How the body pipeline reaches assets (the target protocol)

`visuals-flow/lib/render.mjs` lines 292–302 enrich the variables before writing
`vars.json`:

```js
      const { variables: withImages, missing: missingImages } = enrichImages(cue.variables, workdir);
      ...
      const { variables: enrichedVars, missing } = enrichLogos(withImages, cardLibraryRoot);
      ...
      fs.writeFileSync(path.join(stagedDir, 'vars.json'), JSON.stringify(enrichedVars));
```

- `enrichImages(variables, workdir)` (`lib/images-inline.mjs`) walks the whole
  variables tree and replaces **any string ending in `.jpg|.jpeg|.png|.webp`**
  with a `data:` URI, resolved relative to the VIDEO WORKDIR. Paths that escape
  the workdir or do not exist are left as-is and reported in `missing`.
- `enrichLogos(variables, cardLibraryRoot)` (`lib/logos-inline.mjs`) collects
  logo slugs and writes their data URIs to `variables.__logos[slug]`, plus
  `variables.__logoDark[slug]`. It currently walks exactly these shapes:

```js
  if (typeof variables.logo === 'string') refs.add(variables.logo);
  for (const s of variables.productLogos ?? []) if (typeof s === 'string') refs.add(s);
  for (const p of variables.platforms ?? []) if (typeof p?.logo === 'string') refs.add(p.logo);
  for (const b of variables.beats ?? []) if (typeof b.logo === 'string') refs.add(b.logo);
  for (const side of [variables.left, variables.right, ...(Array.isArray(variables.sides) ? variables.sides : [])]) {
    if (typeof side?.logo === 'string') refs.add(side.logo);
  }
```

So `variables.logo` and `variables.productLogos[]` are already supported; the
`target.logo` / `items[].logo` shapes that `chain` uses are NOT.

`card-library/logos/registry.json` holds exactly twelve slugs: `openart
higgsfield synthesia heygen arcads n8n make zapier langchain flowise submagic
opusclip` — the same twelve the kit's `LOGO_FILES` mirror lists, so nothing is
lost by deleting the mirror.

### Catalog entry conventions to match

`scripts/check-catalog.mjs` enforces, for every variable and every `beat_shape`
entry: `type` present; for `type: "string"`, a `role` from
`['heading','sentence','label','descriptor','value','logo_slug','icon_name','free']`
AND an `example` that itself passes `validateVariable`. `type: "array"` is only
recursed into when `item_shape` is present. An array of bare slug strings is
declared as `{"required": …, "type": "array", "role": "logo_slug_list"}` —
see `enacted/race-bars` and `enacted/spotlight-focus`.

Role rules that bite (from `card-library/VARIABLE-CONTRACT.md`): `heading` —
max 7 words, no terminal `.`, at most one comma; `sentence` — max 18 words;
`label` — max 5 words, no terminal `.`.

`scripts/check-cards.sh` scans **every top-level folder** as a card type and
fails a type folder holding no cards. Its IGNORE list is
`node_modules assets compositions scripts logos renders brand .git` — so do NOT
create a new top-level folder for assets. All four target types
(`tool-icon/`, `enacted/`, `process/`) already exist and already hold cards.

### The type-scale gate, and why each entry declares `hero_shape`

`scripts/check-type-scale.mjs` runs over every `placement: "fullframe"` card
and enforces DESIGN.md's typography contract: the card must NAME its hero via a
`--hero-size` custom property, the hero must be >= 120px and between 2.5x and
4x the next-largest text, and list/table row text must be >= 36px. A card
declares its SHAPE in `catalog.json` via `hero_shape`, which changes what the
gate demands:

| `hero_shape` | Meaning | Effect |
|---|---|---|
| absent / `"short"` | hero is a title, a section name, a number | 120px floor + the 2.5x–4x ratio |
| `"prose"` | the hero IS a whole sentence | floor drops to 60px, the ratio is moot |
| `"none"` | no hero at all — parallel lists, dense tables, chrome | exempt from `--hero-size`, the floor and the ratio |

The four ported cards therefore declare:

| Slug | `hero_shape` | Why |
|---|---|---|
| `tool-icon/logo-grid` | `prose` | its hero is the spoken line, revealed word by word |
| `enacted/shot-float` | `prose` | same — a spoken line over floating stills |
| `enacted/ui-mock` | `none` | it is an app window's chrome; no item outranks another |
| `process/chain` | `none` | N parallel input labels converging on one target |

`slate/kinetic-sentence` and `statement/keyword-statement` already use
`hero_shape: "prose"` for exactly the first reason.

`scripts/check-side.mjs` only inspects `side: true` cards, and all four are
declared `side: false`, so it skips them.

`scripts/check-cards.sh` also has a "nothing left untracked" step. `renders/`
is in `card-library/.gitignore`, so `card-qa.mjs` output does not trip it — but
anything else left in the tree will.

### The mockup images

`pipelines/video/intro-kit/shots/` holds four JPEGs used only as standalone
preview defaults: `mockup-chat.jpg` (52.6K), `mockup-code.jpg` (57.5K),
`mockup-dashboard.jpg` (42.3K), `mockup-social.jpg` (37.4K). They are the
cards' `??` fallbacks, never what the pipeline supplies — in the pipeline the
image path comes from the video workdir and `enrichImages` turns it into a data
URI. They are kept so a card still previews correctly in render2's Templates
tab, copied as REAL FILES into each card that names them (never a symlink —
`lib/intro-kit/render-simple.mjs`'s own header documents that a nested symlink
survives `fs.cpSync` as an absolute link and then crashes the render's hash
walk with `EISDIR`).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Card structure gate | `cd pipelines/video/card-library && bash scripts/check-cards.sh` | exit 0, ends `card checks OK`-style summary with no `FAIL:` lines |
| Catalog gate | `cd pipelines/video/card-library && node scripts/check-catalog.mjs` | exit 0, no `FAIL:` output |
| Full visuals-flow gate | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exit 0, last line `visuals-flow check OK` |
| Render one card | `cd pipelines/video/card-library && npx --yes hyperframes@latest render <type>/<card> --fps 30 --format mp4 --quality standard -o /tmp/<card>.mp4` | exit 0, file created |
| Lint one card | `cd pipelines/video/card-library && npx --yes hyperframes@latest lint <type>/<card>` | exit 0 ("Studio can't drag-edit" and "Google Fonts" warnings are EXPECTED and not failures) |
| Logo unit tests | `cd pipelines/video/visuals-flow && node --test lib/logos.test.mjs` | exit 0 |

## Scope

**In scope**:
- `pipelines/video/card-library/tool-icon/logo-grid/` (new)
- `pipelines/video/card-library/enacted/shot-float/` (new)
- `pipelines/video/card-library/enacted/ui-mock/` (new)
- `pipelines/video/card-library/process/chain/` (new)
- `pipelines/video/card-library/catalog.json` (four new entries)
- `pipelines/video/visuals-flow/lib/logos-inline.mjs` (walker extension)
- `pipelines/video/visuals-flow/lib/logos.test.mjs` (one new test)

**Out of scope** — looks related, do not touch:
- `pipelines/video/intro-kit/` — plan 229 deletes it. Deleting it here would
  break `lib/intro-kit/inputs.mjs`, which still resolves `INTRO_KIT_ROOT` and
  is still the live path for the `simple` intro flow.
- Every file under `pipelines/video/visuals-flow/lib/intro-kit/` — plan 229 owns
  all of them.
- `pipelines/video/card-library/gallery-order.json` — ordering only, not a
  whitelist; a card is visible without an entry.
- The three kit cards that already have body twins (`statement`, `checklist`,
  `lower-third`) — plan 229 maps the intro onto the existing body cards
  instead of porting these.

## Git workflow

- Branch: `advisor/228-vf-intro-cards-into-body-catalog`
- Commit per step. Message style: `feat(cards): port logo-grid into the body catalog` — no AI footers. Do NOT push.

## Steps

### Step 1: Extend `enrichLogos` to walk `target.logo` and `items[].logo`

Edit `pipelines/video/visuals-flow/lib/logos-inline.mjs`. Immediately after the
existing `sides` loop (the block ending `if (typeof side?.logo === 'string')
refs.add(side.logo);` and its closing `}`), insert:

```js
  // process/chain's two shapes (plan 228): one named target the inputs
  // converge on, and the input rows themselves. Same one-line-per-shape
  // pattern as sides[] above — this walker is a list of known shapes, not a
  // generic deep search, on purpose (a deep search would pick up any string
  // field called `logo` that is not a registry slug).
  if (typeof variables.target?.logo === 'string') refs.add(variables.target.logo);
  for (const it of Array.isArray(variables.items) ? variables.items : []) {
    if (typeof it?.logo === 'string') refs.add(it.logo);
  }
```

Then add this test at the end of
`pipelines/video/visuals-flow/lib/logos.test.mjs`, matching the file's existing
import style and test naming:

```js
test('enrichLogos resolves process/chain shapes: target.logo and items[].logo', () => {
  const root = path.resolve(import.meta.dirname, '..', '..', 'card-library');
  const { variables, missing } = enrichLogos(
    { target: { label: 'Final video', logo: 'heygen' }, items: [{ label: 'Clips', logo: 'opusclip' }] },
    root,
  );
  assert.deepEqual(missing, []);
  assert.ok(variables.__logos.heygen.startsWith('data:'), 'target.logo was not inlined');
  assert.ok(variables.__logos.opusclip.startsWith('data:'), 'items[].logo was not inlined');
});
```

If `logos.test.mjs` does not already import `path`, add
`import path from 'node:path';` to its imports.

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/logos.test.mjs` -> exit 0, the new test named `enrichLogos resolves process/chain shapes` passes.

### Step 2: Create `tool-icon/logo-grid`

```bash
cd pipelines/video/card-library
mkdir -p tool-icon/logo-grid
cp ../intro-kit/cards/logo-grid/index.html tool-icon/logo-grid/index.html
```

Do NOT copy the `logos` symlink. Then make exactly these four edits to
`tool-icon/logo-grid/index.html`:

1. In the `===== CONTENT =====` block, rename the variable:
   `logos: VARS.logos ?? [...]` becomes
   `productLogos: VARS.productLogos ?? ["openart", "higgsfield", "synthesia", "heygen", "arcads", "n8n", "make", "zapier"]`
   (keep the same default list).
2. Make the same rename inside the root element's
   `data-composition-variables='…'` JSON attribute: the `"logos"` key becomes
   `"productLogos"`.
3. Delete the whole `const LOGO_FILES = { … };` declaration and the comment
   block above it that begins "The kit's own mirror of logos/registry.json".
4. Replace the tile loop's slug source and image source:
   - line ~134: `DATA.logos.slice(0, 12)` becomes `DATA.productLogos.slice(0, 12)`
   - line ~144: `img.src = 'logos/' + (LOGO_FILES[slug] || 'openart.png');`
     becomes:
     ```js
        // Logos arrive pre-inlined as data URIs in VARS.__logos (enrichLogos,
        // lib/logos-inline.mjs) — the card no longer mirrors the registry.
        const href = (VARS.__logos || {})[slug];
        if (href) { img.src = href; } else { img.remove(); }
     ```
     If `img` is appended to its tile before this point, `img.remove()` is
     correct; if it is appended after, replace `img.remove()` with
     `img.style.display = 'none'`. Read the surrounding lines and pick the one
     that matches.

Add this entry to `catalog.json`'s `cards` array (append at the end):

```json
    {
      "slug": "tool-icon/logo-grid",
      "hero_shape": "prose",
      "kind": "beat",
      "placement": "fullframe",
      "side": false,
      "purpose": "a grid of real tool logos behind one spoken line; the logos dim as the line lands — the 'too many tools doing one job each' beat",
      "variables": {
        "text": {
          "required": true,
          "type": "string",
          "role": "sentence",
          "example": "There are too many tools doing one job each"
        },
        "productLogos": {
          "required": true,
          "type": "array",
          "role": "logo_slug_list",
          "note": "up to 12 registry slugs; the grid dims them as the line lands"
        },
        "accent": {
          "required": false,
          "type": "string",
          "role": "free",
          "example": "one job each"
        },
        "duration": {
          "required": false,
          "type": "number",
          "role": "free",
          "note": "2.0-5.0; the card scales its own motion schedule to it (intro-kit variable-duration contract)"
        }
      },
      "beat_source": "beat",
      "beat_shape": {
        "text": {
          "required": true,
          "type": "string",
          "role": "label",
          "example": "tools"
        },
        "accent": {
          "required": true,
          "type": "boolean"
        },
        "at": {
          "required": true,
          "type": "number"
        }
      },
      "default_duration": 3.5,
      "max_beats": 14,
      "max_reveal_chars": 16
    }
```

**Verify**:
```
cd pipelines/video/card-library && node scripts/check-catalog.mjs
```
-> exit 0, no `FAIL:` lines.
```
cd pipelines/video/card-library && npx --yes hyperframes@latest render tool-icon/logo-grid --fps 30 --format mp4 --quality standard -o /tmp/logo-grid.mp4 && test $(stat -f%z /tmp/logo-grid.mp4) -gt 20000 && echo RENDER-OK
```
-> prints `RENDER-OK`.

### Step 3: Create `enacted/shot-float`

```bash
cd pipelines/video/card-library
mkdir -p enacted/shot-float/shots
cp ../intro-kit/cards/shot-float/index.html enacted/shot-float/index.html
cp ../intro-kit/shots/mockup-dashboard.jpg ../intro-kit/shots/mockup-code.jpg \
   ../intro-kit/shots/mockup-chat.jpg ../intro-kit/shots/mockup-social.jpg \
   enacted/shot-float/shots/
```

Do NOT copy the `shots` symlink — the `cp` above puts real files there instead.

One edit to `enacted/shot-float/index.html`: at line ~136 the loop does
`img.src = src;`. Guard it so an absent image does not render a broken-image
icon:

```js
        if (src) { img.src = src; } else { img.style.display = 'none'; }
```

Nothing else changes — `shots` is a plain array of image path strings, which
`enrichImages` already rewrites to data URIs generically by file extension.

Append to `catalog.json`:

```json
    {
      "slug": "enacted/shot-float",
      "hero_shape": "prose",
      "kind": "beat",
      "placement": "fullframe",
      "side": false,
      "purpose": "generated stills or screenshots floating as evidence while one spoken line runs word by word",
      "variables": {
        "text": {
          "required": true,
          "type": "string",
          "role": "sentence",
          "example": "Every one of these was generated, not filmed"
        },
        "shots": {
          "required": true,
          "type": "array",
          "note": "up to 6 image paths relative to the video workdir; enrichImages inlines each as a data URI"
        },
        "accent": {
          "required": false,
          "type": "string",
          "role": "free",
          "example": "generated, not filmed"
        },
        "duration": {
          "required": false,
          "type": "number",
          "role": "free",
          "note": "2.0-5.0; the card scales its own motion schedule to it (intro-kit variable-duration contract)"
        }
      },
      "beat_source": "beat",
      "beat_shape": {
        "text": {
          "required": true,
          "type": "string",
          "role": "label",
          "example": "generated"
        },
        "accent": {
          "required": true,
          "type": "boolean"
        },
        "at": {
          "required": true,
          "type": "number"
        }
      },
      "default_duration": 3.5,
      "max_beats": 14,
      "max_reveal_chars": 16
    }
```

**Verify**:
```
cd pipelines/video/card-library && node scripts/check-catalog.mjs && npx --yes hyperframes@latest render enacted/shot-float --fps 30 --format mp4 --quality standard -o /tmp/shot-float.mp4 && test $(stat -f%z /tmp/shot-float.mp4) -gt 20000 && echo RENDER-OK
```
-> prints `RENDER-OK`.

### Step 4: Create `enacted/ui-mock`

```bash
cd pipelines/video/card-library
mkdir -p enacted/ui-mock/shots
cp ../intro-kit/cards/ui-mock/index.html enacted/ui-mock/index.html
cp ../intro-kit/shots/mockup-dashboard.jpg enacted/ui-mock/shots/
```

Do NOT copy the `logos` or `shots` symlinks. Then make exactly these four edits
to `enacted/ui-mock/index.html`:

1. In the `===== CONTENT =====` block, rename `appLogo: VARS.appLogo ?? "openart",`
   to `logo: VARS.logo ?? "openart",` — `variables.logo` is the shape
   `enrichLogos` already walks.
2. Make the same rename in the root element's `data-composition-variables='…'`
   JSON attribute: `"appLogo":"openart"` becomes `"logo":"openart"`.
3. Delete the whole `const LOGO_FILES = { … };` declaration and its preceding
   comment block.
4. Replace lines ~143–145:
   ```js
         const logoImg = document.getElementById('appLogoImg');
         if (DATA.appLogo && LOGO_FILES[DATA.appLogo]) {
           logoImg.src = 'logos/' + LOGO_FILES[DATA.appLogo];
   ```
   with:
   ```js
         const logoImg = document.getElementById('appLogoImg');
         // Pre-inlined data URI from enrichLogos (lib/logos-inline.mjs).
         const logoHref = DATA.logo && (VARS.__logos || {})[DATA.logo];
         if (logoHref) {
           logoImg.src = logoHref;
   ```
   Leave the existing `else` branch (whatever it does when there is no logo)
   exactly as it is.

Leave line ~151 `shotImg.src = DATA.shot;` alone — `shot` is a plain image path
string and `enrichImages` handles it.

Do NOT rename the HTML element id `appLogoImg` or the `appName` variable.

Append to `catalog.json`:

```json
    {
      "slug": "enacted/ui-mock",
      "hero_shape": "none",
      "kind": "single",
      "placement": "fullframe",
      "side": false,
      "purpose": "a stylised app window around a real screenshot, in an ok or a fail state — the 'here is the tool, here is where it breaks' beat",
      "variables": {
        "appName": {
          "required": true,
          "type": "string",
          "role": "label",
          "example": "OpenArt"
        },
        "shot": {
          "required": true,
          "type": "string",
          "role": "free",
          "note": "image path relative to the video workdir; enrichImages inlines it as a data URI",
          "example": "shots/mockup-dashboard.jpg"
        },
        "state": {
          "required": true,
          "type": "string",
          "role": "free",
          "enum": ["ok", "fail"],
          "example": "ok"
        },
        "logo": {
          "required": false,
          "type": "string",
          "role": "logo_slug",
          "example": "openart"
        },
        "caption": {
          "required": false,
          "type": "string",
          "role": "label",
          "example": "Four renders in"
        },
        "buttonLabel": {
          "required": false,
          "type": "string",
          "role": "label",
          "example": "Generate"
        },
        "duration": {
          "required": false,
          "type": "number",
          "role": "free",
          "note": "2.0-5.0; the card scales its own motion schedule to it (intro-kit variable-duration contract)"
        }
      },
      "default_duration": 3.5
    }
```

**Verify**:
```
cd pipelines/video/card-library && node scripts/check-catalog.mjs && npx --yes hyperframes@latest render enacted/ui-mock --fps 30 --format mp4 --quality standard -o /tmp/ui-mock.mp4 && test $(stat -f%z /tmp/ui-mock.mp4) -gt 20000 && echo RENDER-OK
```
-> prints `RENDER-OK`.

### Step 5: Create `process/chain`

```bash
cd pipelines/video/card-library
mkdir -p process/chain/shots
cp ../intro-kit/cards/chain/index.html process/chain/index.html
cp ../intro-kit/shots/mockup-chat.jpg ../intro-kit/shots/mockup-code.jpg \
   ../intro-kit/shots/mockup-dashboard.jpg process/chain/shots/
```

Do NOT copy the `logos` or `shots` symlinks. Then make exactly these three
edits to `process/chain/index.html`:

1. Delete the whole `const LOGO_FILES = { … };` declaration and its preceding
   comment block.
2. Replace lines ~185–186:
   ```js
         if (DATA.target.logo && LOGO_FILES[DATA.target.logo]) {
           targetLogo.src = 'logos/' + LOGO_FILES[DATA.target.logo];
   ```
   with:
   ```js
         // Pre-inlined data URI from enrichLogos (lib/logos-inline.mjs), which
         // learned target.logo and items[].logo in plan 228.
         const targetHref = DATA.target?.logo && (VARS.__logos || {})[DATA.target.logo];
         if (targetHref) {
           targetLogo.src = targetHref;
   ```
   Leave the existing `else` branch exactly as it is.
3. Guard the item image at line ~133: `img.src = it.shot;` becomes
   ```js
          if (it.shot) { img.src = it.shot; } else { img.style.display = 'none'; }
   ```

Append to `catalog.json`:

```json
    {
      "slug": "process/chain",
      "hero_shape": "none",
      "kind": "single",
      "placement": "fullframe",
      "side": false,
      "purpose": "N labelled inputs converging on one named output — the 'all of this becomes that' beat",
      "variables": {
        "items": {
          "required": true,
          "type": "array",
          "item_shape": {
            "label": {
              "required": true,
              "type": "string",
              "role": "label",
              "example": "Podcast audio"
            },
            "shot": {
              "required": false,
              "type": "string",
              "role": "free",
              "note": "image path relative to the video workdir; enrichImages inlines it as a data URI",
              "example": "shots/mockup-chat.jpg"
            },
            "logo": {
              "required": false,
              "type": "string",
              "role": "logo_slug",
              "example": "opusclip"
            }
          }
        },
        "target": {
          "required": true,
          "type": "object",
          "shape": {
            "label": {
              "required": true,
              "type": "string",
              "role": "label",
              "example": "Final video"
            },
            "logo": {
              "required": false,
              "type": "string",
              "role": "logo_slug",
              "example": "heygen"
            }
          }
        },
        "duration": {
          "required": false,
          "type": "number",
          "role": "free",
          "note": "2.0-5.0; the card scales its own motion schedule to it (intro-kit variable-duration contract)"
        }
      },
      "default_duration": 3.5
    }
```

Note `target` is an OBJECT, never a bare string — `chain/index.html` reads
`DATA.target.label` and `DATA.target.logo`. A string `target` renders an empty
label, which is exactly the bug sitting unrendered in
`visuals-flow/lib/intro-kit/fixtures/good.json` today (plan 229 fixes that
fixture).

**Verify**:
```
cd pipelines/video/card-library && node scripts/check-catalog.mjs && npx --yes hyperframes@latest render process/chain --fps 30 --format mp4 --quality standard -o /tmp/chain.mp4 && test $(stat -f%z /tmp/chain.mp4) -gt 20000 && echo RENDER-OK
```
-> prints `RENDER-OK`.

### Step 6: Confirm no symlinks and no stray top-level folder came across

```bash
cd pipelines/video/card-library
find tool-icon/logo-grid enacted/shot-float enacted/ui-mock process/chain -type l
```

**Verify**: the command prints NOTHING. A symlink here breaks the render's hash
walk with `EISDIR` (documented in `lib/intro-kit/render-simple.mjs`'s header).

```bash
cd pipelines/video/card-library && git status --porcelain --untracked-files=all . | awk '{print $2}' | cut -d/ -f1 | sort -u
```

**Verify**: only `catalog.json`, `enacted`, `process` and `tool-icon` appear.
No new top-level folder — `check-cards.sh` scans every one as a card type.

### Step 7: Run the whole gate

```bash
cd pipelines/video/card-library && bash scripts/check-cards.sh && node scripts/check-catalog.mjs
cd pipelines/video/visuals-flow && bash scripts/check.sh
```

**Verify**: both commands exit 0; the second ends with `visuals-flow check OK`.
`check-cards.sh` must report `72 cards found` (68 before + 4 new), `all 72
cards registered`, and end with `card check OK`.

If `check-type-scale` fails on one of the new cards, the fix is in the CARD:
either its `hero_shape` in `catalog.json` is wrong for what the card actually
shows (consult the table in Current state), or a font-size in its `index.html`
violates DESIGN.md and should be corrected there. **Editing
`scripts/check-type-scale.mjs`, its constants, or `DESIGN.md` to make a card
pass is a STOP.**

### Step 8: Render a contact sheet for each new card

```bash
cd pipelines/video/card-library
for c in tool-icon/logo-grid enacted/shot-float enacted/ui-mock process/chain; do
  node scripts/card-qa.mjs "$c"
done
```

**Verify**: each run exits 0. `card-library/CLAUDE.md` step 5 requires a contact
sheet for a new card; if `card-qa.mjs` writes files under `renders/`, leave them
untracked — `renders/` is gitignored and generated media is never committed.
If any card's sheet shows clipped, overlapping or misaligned content, that is a
STOP (see STOP conditions), not something to fix by shrinking the example.

## Test plan

- One new unit test in `visuals-flow/lib/logos.test.mjs` covering the two new
  `enrichLogos` shapes (Step 1). It is reached by `check.sh`'s
  `find lib -name '*.test.mjs' … | xargs -0 node --test` sweep, so it joins the
  gate by existing.
- `check-catalog.mjs` validates all four new catalog entries, including that
  every string variable's `example` passes `validateVariable` against its own
  role and word limits.
- `check-cards.sh` validates the folder shape and the catalog registration of
  every card, and fails on any type folder holding no cards.
- A real hyperframes render per card (Steps 2–5), gated on output size, proves
  the card actually produces frames rather than only parsing — LESSONS
  2026-07-24: "file exists / mp4 >0 bytes" is not proof of device code, so the
  gate here is >20 KB plus the contact sheet in Step 8.

## Done criteria

- [ ] `cd pipelines/video/card-library && bash scripts/check-cards.sh` exits 0 and reports `72 cards found`.
- [ ] `cd pipelines/video/card-library && node scripts/check-catalog.mjs` exits 0 with no `FAIL:` lines.
- [ ] `cd pipelines/video/visuals-flow && bash scripts/check.sh` exits 0, last line `visuals-flow check OK`.
- [ ] `node -e "const c=require('./pipelines/video/card-library/catalog.json').cards.map(x=>x.slug); for (const s of ['tool-icon/logo-grid','enacted/shot-float','enacted/ui-mock','process/chain']) if(!c.includes(s)) { console.error('MISSING '+s); process.exit(1);} console.log('ALL FOUR PRESENT')"` prints `ALL FOUR PRESENT`.
- [ ] `find pipelines/video/card-library/tool-icon/logo-grid pipelines/video/card-library/enacted/shot-float pipelines/video/card-library/enacted/ui-mock pipelines/video/card-library/process/chain -type l` prints nothing.
- [ ] `rtk proxy grep -rl "LOGO_FILES" pipelines/video/card-library/tool-icon/logo-grid pipelines/video/card-library/enacted/ui-mock pipelines/video/card-library/process/chain` prints nothing.
- [ ] All four cards rendered to an MP4 larger than 20 KB (Steps 2–5).
- [ ] `git diff --stat 69042eb1..HEAD -- pipelines/video/intro-kit` prints nothing — `intro-kit/` is untouched.
- [ ] `plans/README.md` row for plan 228 updated to DONE.

## STOP conditions

- **`pipelines/video/intro-kit/` must not be modified or deleted by this plan.**
  It is still the live schema and card source for the `simple` intro flow until
  plan 229 lands. If a step seems to require touching it, stop and report.
- **Do not modify anything under `pipelines/video/visuals-flow/lib/intro-kit/`.**
  That whole folder is plan 229's scope. The only visuals-flow files this plan
  touches are `lib/logos-inline.mjs` and `lib/logos.test.mjs`.
- **Gate integrity**: if a gate assertion fails, fix the card or the catalog
  entry. Weakening, swapping, deleting or `IGNORE`-listing an assertion to make
  a check pass is a STOP. This includes editing `check-cards.sh`'s IGNORE list,
  editing `scripts/check-type-scale.mjs` or its `HERO_MIN` / `HERO_RATIO` /
  `HERO_RATIO_MAX` / `ROW_MIN` constants, editing `DESIGN.md`, and relaxing a
  role's word limit in `VARIABLE-CONTRACT.md`.
- **If a contact sheet (Step 8) shows clipped, overlapping or misaligned
  content at the card's `max` variant**, stop and report with the sheet path.
  Do not "fix" it by shortening the catalog `example` — the example is the
  declared capacity, and shrinking it hides the overflow instead of fixing it.
- **If `enrichLogos`' new walk turns out to already exist** in some other form
  on the branch you check out (drift), stop and report rather than adding a
  second walk.
- **Do not commit anything under `card-library/renders/`** or any other
  generated media.

## Maintenance notes

- The four ported cards are the only cards in `card-library/` that honour the
  intro kit's variable-duration contract (`DUR = clamp(VARS.duration ?? 3.5, 2,
  5)`, motion scaled to `DUR`). Every other body card hard-codes its motion
  schedule in absolute seconds. That asymmetry is deliberate and temporary —
  the owner accepted (2026-08-23) that body cards will be truncated at intro cut
  lengths until it is measured which ones actually look wrong.
- `enrichLogos` is a list of KNOWN variable shapes, not a deep search. Any new
  card that puts a logo slug somewhere new needs one more line there, plus a
  test. This is the fourth time that has happened (`sides[]` was the third, on
  2026-07-31, and it shipped letter fallbacks until someone noticed).
- A reviewer should scrutinise: that no symlink survived the copy; that the
  three `LOGO_FILES` mirrors are gone rather than merely unused; and that the
  `process/chain` catalog entry declares `target` as an object, since the
  in-repo fixture that predates this plan gets it wrong.
- Plan 229 depends on this one. It repoints the whole `simple` intro flow at
  `card-library/` and deletes `pipelines/video/intro-kit/`.
