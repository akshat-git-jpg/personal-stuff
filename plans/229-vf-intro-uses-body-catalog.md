---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui: true
deploy:
needs: []
needs_prs: [181]
touches: [pipelines/video/visuals-flow/lib/intro-kit/inputs.mjs, pipelines/video/visuals-flow/lib/intro-kit/lint-cutlist.mjs, pipelines/video/visuals-flow/lib/intro-kit/render-simple.mjs, pipelines/video/visuals-flow/lib/intro-kit/lint-cutlist.test.mjs, pipelines/video/visuals-flow/lib/intro-kit/render-simple.test.mjs, pipelines/video/visuals-flow/board-ui/src/tabs/IntroTab.tsx, pipelines/video/visuals-flow/steps/115-author-intro-simple-llm/SIMPLE-PASS.md, pipelines/video/visuals-flow/TASTE-SIMPLE.md, .claude/skills/yt-video-edit/SKILL.md, pipelines/video/visuals-flow/decisions.md, decisions.md]

mutation_apply: node -e "const fs=require('fs');const f='pipelines/video/visuals-flow/lib/intro-kit/fixtures/good.json';const j=JSON.parse(fs.readFileSync(f,'utf8'));const b=j.beats.find(x=>x.kind==='card');b.vars.duration=3;fs.writeFileSync(f,JSON.stringify(j,null,2)+'\n');"
mutation_command: cd pipelines/video/visuals-flow && node --test lib/intro-kit/lint-cutlist.test.mjs
mutation_expect: S4 renderer-owned-var
mutation_cwd:
mutation_timeout:
---

# Plan 229: Point the simple intro flow at the body card catalog

## Summary

- **Problem statement**: The `simple` intro flow reads its card schema from
  `pipelines/video/intro-kit/kit.json` and stages its renders from
  `pipelines/video/intro-kit/`, a private 7-card kit. The body of the same
  video draws from the 68-card `pipelines/video/card-library/`. Two catalogs
  for one video means they drift, and the owner has to think about which cards
  exist where.
- **Goals**:
  - Make `card-library/catalog.json` the ONE card source for the intro too.
  - Rewire `lib/intro-kit/inputs.mjs`, `lint-cutlist.mjs` and
    `render-simple.mjs` onto the body catalog and the body asset protocol.
  - Retire lint code `S6` (its per-card duration range came from `kit.json`,
    which is being deleted; `S3` already gates every beat at 1.5–4.0s).
  - Add a non-blocking TRUNCATION NOTICE so the owner can see, after the first
    render, which body cards are running far short of their designed length.
  - Delete `pipelines/video/intro-kit/` and every doc that describes a locked
    7-card kit.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — every code change is
  inlined verbatim below, including the replacement `loadKit`, the new `S4`,
  and the full rewritten fixture.
- **Done criteria** (terse): `check.sh` exits 0; `intro-kit/` is gone; no file
  outside `plans/` and `decisions.md` mentions `intro-kit` as a card source;
  the lint accepts a body-catalog cut list and refuses an unknown slug, a bad
  beat shape, and a `duration` var.
- **Stop conditions** (terse): PR #181 (plan 228) must be merged first; do not weaken a
  lint assertion to make a fixture pass; do not change `S1`/`S2`/`S3`/`S5`/`S7`
  thresholds or logic; do not hand-migrate the one real cut list.
- **Test / verification for success**: `scripts/check.sh` (which sweeps every
  `lib/**/*.test.mjs`), plus a boss mutation recipe that proves the new `S4`
  `renderer-owned-var` rule actually fires.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 69042eb1..HEAD -- pipelines/video/visuals-flow/lib/intro-kit pipelines/video/intro-kit pipelines/video/visuals-flow/steps/115-author-intro-simple-llm pipelines/video/visuals-flow/board-ui/src/tabs/IntroTab.tsx`

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: plan 228 = PR #181 (must be merged — it creates the four
  `card-library` slugs this plan's fixtures reference)
- **Category**: tech-debt
- **Difficulty**: standard
- **Planned at**: commit `69042eb1`, 2026-08-23

## Why this matters

The owner's decision, 2026-08-23: **one card catalogue for the intro and the
body.** `intro-kit/KIT.md` says an eighth card needs an owner decision recorded
in `decisions.md` — this is a bigger decision than that, in the other
direction: the kit itself goes away, and the intro picks from the same 72 cards
the body picks from.

The intro's *pacing* discipline stays exactly as it is. `S1`, `S2`, `S3`, `S5`
and `S7` are what make a simple intro feel like the reference intros, and none
of them has anything to do with which folder a card lives in. Only the card
SOURCE changes.

There is one accepted cost. Kit cards were built to stretch: each reads a
`duration` variable and scales its motion schedule into 2–5s. Body cards are
not — their GSAP timelines are written in absolute seconds against a
`default_duration` of 4–15s. At a 2–4s intro cut, a body card will play its
entry animation and then be cut off part-way through its idle motion. The owner
chose (2026-08-23) to swap first and fix what actually looks bad, rather than
retrofit all 68 body cards up front. The truncation notice this plan adds is
how they find out which ones those are.

## Current state

### Files this plan rewires

| File | Role today |
|---|---|
| `lib/intro-kit/inputs.mjs` | resolves `INTRO_KIT_ROOT`, `loadKit()` (reads `intro-kit/kit.json`), `introWords()`, `loadCutlist()` |
| `lib/intro-kit/lint-cutlist.mjs` | the S1–S7 pacing gate; S4 and S6 read the kit |
| `lib/intro-kit/render-simple.mjs` | stages each card beat from `INTRO_KIT_ROOT` and renders it |
| `lib/intro-kit/cutlist-schema.mjs` | shape check only — needs NO change |
| `lib/intro-kit/fixtures/*.json` | 8 cut lists + `words.json`, all using bare kit slugs |
| `lib/board-data.mjs` | imports only `loadCutlist` — needs NO change |
| `board-ui/src/tabs/IntroTab.tsx` | `simpleBeatText()` knows three kit-specific var shapes |
| `steps/115-author-intro-simple-llm/{SIMPLE-PASS.md,README.md,step.json}` | the authoring rulebook, all describing "the locked kit of 7" |
| `TASTE-SIMPLE.md` | taste rules; its preamble says "picks and fills from seven locked cards" |
| `.claude/skills/yt-video-edit/SKILL.md` | guardrail 7a says the cards are LOCKED, 7 of them |

### `lib/intro-kit/inputs.mjs` today, verbatim

```js
// pipelines/video/intro-kit/ — plan 219's locked 7-card kit. Three levels up
// from lib/intro-kit/ (lib -> visuals-flow -> video), then into intro-kit/,
// exactly the sibling-folder pattern lib/intro-film/film-assets.mjs already
// uses to reach video/heygen/.
export const INTRO_KIT_ROOT = path.resolve(import.meta.dirname, '..', '..', '..', 'intro-kit');

export function loadKit({ root = INTRO_KIT_ROOT } = {}) {
  return JSON.parse(fs.readFileSync(path.join(root, 'kit.json'), 'utf8'));
}
```

`introWords(workdir)` and `loadCutlist(workdir)` below it are unchanged by this
plan.

### `kit.json`'s per-card shape (what the lint consumes today)

```json
{ "slug": "statement", "overlay": false, "minDuration": 2.0, "maxDuration": 5.0,
  "required": ["text", "beats"], "optional": ["accent", "icon"] }
```

`checkS4(cutlist, kit)` builds `bySlug` from `kit.cards`, then per card beat:
rejects an unknown slug, rejects `Boolean(card.overlay) !== (b.kind ===
'overlay')`, rejects a missing `required` key, and rejects any key outside
`required ∪ optional`. `checkS6(cutlist, kit)` rejects a beat length outside
`[card.minDuration, card.maxDuration]`.

### `catalog.json`'s per-card shape (what replaces it)

```json
{
  "slug": "checklist/checklist",
  "kind": "beat",
  "placement": "fullframe",
  "variables": { "title": { "required": true, "type": "string", "role": "heading", "example": "Section Title" } },
  "beat_source": "beat",
  "beat_shape": { "text": { "required": true, "type": "string", "role": "sentence", "example": "…" } },
  "default_duration": 8,
  "max_beats": 6
}
```

The three mappings that matter:

| kit.json | catalog.json |
|---|---|
| `overlay: true` | `placement === "overlay"` (12 of 72 cards) |
| `required: [...]` / `optional: [...]` | keys of `variables` split on each spec's `required` boolean |
| — (kit cards took `beats` as a plain required var) | `beat_source: "beat"` + `beat_shape` describes each element; 32 cards are `kind: "beat"` or `"word-sync"` |

`default_duration` across the catalog runs 4–15s; there is no per-card min/max,
which is why `S6` is retired rather than re-sourced.

### `render-simple.mjs`'s staging block today

```js
    fs.cpSync(path.join(INTRO_KIT_ROOT, 'hyperframes.json'), path.join(stagedDir, 'hyperframes.json'));
    fs.cpSync(path.join(INTRO_KIT_ROOT, 'meta.json'), path.join(stagedDir, 'meta.json'));
    const cardRel = path.join('cards', beat.card);
    const stagedCardDir = path.join(stagedDir, cardRel);
    fs.mkdirSync(path.dirname(stagedCardDir), { recursive: true });
    fs.cpSync(path.join(INTRO_KIT_ROOT, cardRel), stagedCardDir, { recursive: true });
    materializeAssetLinks(stagedCardDir);
```

and the vars it writes:

```js
    const vars = { ...(beat.vars ?? {}), duration };
    fs.writeFileSync(path.join(stagedDir, 'vars.json'), JSON.stringify(vars));
```

`materializeAssetLinks()` exists ONLY because kit cards reach `logos/` and
`shots/` through symlinks that survive `fs.cpSync` as absolute links and then
crash `hashRenderInputs`' walk with `EISDIR`. Plan 228's ported cards hold real
files and get their logos as pre-inlined data URIs, so the whole function and
its long header comment go away.

`lib/render.mjs` (the BODY renderer) is the model to match, lines 269–302:

```js
      fs.cpSync(path.join(cardLibraryRoot, 'hyperframes.json'), path.join(stagedDir, 'hyperframes.json'));
      fs.cpSync(path.join(cardLibraryRoot, 'meta.json'), path.join(stagedDir, 'meta.json'));
      ...
      fs.cpSync(path.join(cardLibraryRoot, cue.card), stagedCardDir, { recursive: true });
      ...
      const { variables: withImages, missing: missingImages } = enrichImages(cue.variables, workdir);
      const { variables: enrichedVars, missing } = enrichLogos(withImages, cardLibraryRoot);
      fs.writeFileSync(path.join(stagedDir, 'vars.json'), JSON.stringify(enrichedVars));
```

Note the body's `cue.card` is already `"<type>/<card>"`, so it is the *whole*
relative path — no `cards/` prefix.

### `board-ui/src/tabs/IntroTab.tsx`'s `simpleBeatText`, verbatim

```ts
function simpleBeatText(b: any): string {
  const vars = b?.vars || {};
  if (typeof vars.text === 'string') return vars.text;
  if (Array.isArray(vars.rows)) {
    return vars.rows.map((r: any) => r?.label ?? r?.text ?? '').filter(Boolean).join(', ');
  }
  if (typeof vars.appName === 'string') return vars.appName;
  return '';
}
```

`vars.rows` is a kit-only shape. Body cards put their words in `title`, `name`,
`question`, `prompt`, or `beats[].text`.

### The one real cut list on disk

`videos/consistent-character-ai-animation-howto/intro-simple/cutlist.json` —
34 beats, `"approved": false`, using only `statement` (18) and `checklist` (2).
Its checklist beats carry `{icon, rows:[{text, mark}]}`, a yes/no device the
body `checklist/checklist` does not have (it draws checkmarks only, from
`beats[].text`, under a required `title`). There is no faithful mechanical
mapping, and inventing a `title` would be authoring. Because the file is
`approved: false` and step 115 is a cheap re-run, this plan ARCHIVES it rather
than migrating it.

### The `S7` fixture words

`lib/intro-kit/fixtures/words.json` holds 19 words in three windows only:
`Quietly making people thousands of dollars a month` (3.2–5.8s),
`Too many tools one workflow` (18.2–19.6s), and
`See it before you build it` (24.6–26.2s). Any fixture beat that gains a
`beats[]` list OUTSIDE those windows trips `S7`. That is why the rewritten
`checklist/checklist` beat below carries a `title` and NO `beats`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full gate | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exit 0, last line `visuals-flow check OK` |
| Lint tests only | `cd pipelines/video/visuals-flow && node --test lib/intro-kit/lint-cutlist.test.mjs` | exit 0 |
| Renderer tests only | `cd pipelines/video/visuals-flow && node --test lib/intro-kit/render-simple.test.mjs` | exit 0 |
| Board UI tests + build | `cd pipelines/video/visuals-flow/board-ui && npx vitest run && npm run build` | exit 0 |
| Board UI smoke (screenshots) | `cd pipelines/video/visuals-flow && node scripts/board-ui-smoke.mjs` | exit 0 |
| Step registry / PIPELINE table | `cd pipelines/video/visuals-flow && node scripts/gen-pipeline-table.mjs --check` | exit 0 |
| Print the cut-list lint for a video | `cd pipelines/video/visuals-flow && bash run.sh <slug> intro-simple-lint` | prints the S-code report |

## Scope

**In scope**:
- `pipelines/video/visuals-flow/lib/intro-kit/inputs.mjs`
- `pipelines/video/visuals-flow/lib/intro-kit/lint-cutlist.mjs`
- `pipelines/video/visuals-flow/lib/intro-kit/render-simple.mjs`
- `pipelines/video/visuals-flow/lib/intro-kit/lint-cutlist.test.mjs`
- `pipelines/video/visuals-flow/lib/intro-kit/render-simple.test.mjs`
- `pipelines/video/visuals-flow/lib/intro-kit/fixtures/*.json` (rewrite 8, delete `bad-s6.json`)
- `pipelines/video/visuals-flow/board-ui/src/tabs/IntroTab.tsx`
- `pipelines/video/visuals-flow/steps/115-author-intro-simple-llm/{SIMPLE-PASS.md,README.md,step.json}`
- `pipelines/video/visuals-flow/TASTE-SIMPLE.md`
- `pipelines/video/visuals-flow/videos/consistent-character-ai-animation-howto/intro-simple/cutlist.json` (archive-rename only)
- `pipelines/video/intro-kit/` (deleted entirely)
- `.claude/skills/yt-video-edit/SKILL.md` (guardrail 7a)
- `pipelines/video/visuals-flow/decisions.md` (the full dated entry)
- `decisions.md` at the repo root (one pointer line)
- `plans/README.md` (status row)

**Out of scope** — looks related, do not touch:
- `lib/intro-kit/cutlist-schema.mjs` — it validates types and required KEYS of
  a beat (`id`, `kind`, `t_start`, `t_end`, `card`, `vars` is an object). None
  of that depends on which catalog a slug comes from.
- `lib/board-data.mjs` — imports `loadCutlist` only, whose signature is
  unchanged. Its `pacingSummary` mirrors S1/S2/S3, none of which change.
- `lib/intro-film/**` — the `complex` flow. It is a different lane and shares
  no artifact with this one except the output path `intro-film/out/intro.mp4`,
  which this plan does not move.
- `lib/render.mjs` and the whole body pipeline — this plan reads the body's
  conventions, it does not change them.
- `card-library/` — plan 228 owns every change there.
- `AVATAR_MAX_SHARE`, `AVATAR_MAX_HOLD`, `CUT_MIN`, `CUT_MAX` and the logic of
  `S1`, `S2`, `S3`, `S5`, `S7` — the pacing contract is unchanged.

## Git workflow

- Branch: `advisor/229-vf-intro-uses-body-catalog`
- Commit per step. Message style: `refactor(intro): read cards from the body catalog` — no AI footers. Do NOT push.

## Steps

### Step 1: Rewrite `lib/intro-kit/inputs.mjs` onto the body catalog

Replace the `INTRO_KIT_ROOT` constant and the `loadKit` function (the block
quoted in "Current state") with exactly this. Leave the file's other imports,
`introWords` and `loadCutlist` untouched.

```js
// pipelines/video/card-library/ — the ONE card catalogue, shared by the intro
// and the body (owner decision 2026-08-23, decisions.md). Three levels up from
// lib/intro-kit/ (lib -> visuals-flow -> video), then into card-library/ —
// the same sibling-folder pattern lib/render.mjs uses to reach it.
//
// This replaces pipelines/video/intro-kit/, plan 219's private 7-card kit,
// deleted by plan 229. The intro no longer has a card set of its own: it picks
// from the same catalogue the cue pass picks from, and a card added for the
// body is available to the intro the moment it lands in catalog.json.
export const CARD_LIBRARY_ROOT = path.resolve(import.meta.dirname, '..', '..', '..', 'card-library');

export function loadCatalog({ root = CARD_LIBRARY_ROOT } = {}) {
  return JSON.parse(fs.readFileSync(path.join(root, 'catalog.json'), 'utf8'));
}

// The flat per-card view the cut-list lint needs: which slugs exist, which are
// overlays, and which variables each one takes. DERIVED from catalog.json on
// every call rather than stored anywhere, so the intro can never drift from
// the body catalogue — that drift is the whole reason kit.json was retired.
//
// `duration` is deliberately EXCLUDED from `optional` even on the four cards
// whose catalog entry declares it: render-simple.mjs computes it from the
// beat's own length and injects it, so a cut list carrying one would be
// silently overwritten. S4's renderer-owned-var rule says so out loud.
const RENDERER_OWNED_VARS = new Set(['duration']);

export function loadKit({ root = CARD_LIBRARY_ROOT } = {}) {
  const catalog = loadCatalog({ root });
  const cards = (catalog.cards ?? []).map((c) => {
    const specs = Object.entries(c.variables ?? {});
    const required = specs.filter(([k, s]) => s?.required && !RENDERER_OWNED_VARS.has(k)).map(([k]) => k);
    const optional = specs.filter(([k, s]) => !s?.required && !RENDERER_OWNED_VARS.has(k)).map(([k]) => k);
    // A beat card carries its on-screen words in `beats`. In the body pipeline
    // that array lives beside the variables on the cue and the resolver merges
    // it in; in a cut list the authoring step writes it straight into `vars`.
    // It is OPTIONAL, never required — a beat card used as a still plate for
    // two seconds is a legitimate intro beat.
    const isBeatCard = c.beat_source === 'beat' || c.kind === 'beat' || c.kind === 'word-sync';
    if (isBeatCard) optional.push('beats');
    return {
      slug: c.slug,
      overlay: c.placement === 'overlay',
      required,
      optional,
      beatShape: isBeatCard ? (c.beat_shape ?? {}) : null,
      maxBeats: Number.isFinite(c.max_beats) ? c.max_beats : null,
      defaultDuration: Number.isFinite(c.default_duration) ? c.default_duration : null,
    };
  });
  return { cards };
}
```

**Verify**:
```
cd pipelines/video/visuals-flow && node -e "
const { loadKit } = await import('./lib/intro-kit/inputs.mjs');
const k = loadKit();
const by = Object.fromEntries(k.cards.map(c => [c.slug, c]));
if (k.cards.length < 70) throw new Error('expected 70+ cards, got ' + k.cards.length);
if (!by['overlay/lower-third'].overlay) throw new Error('overlay/lower-third not marked overlay');
if (by['checklist/checklist'].overlay) throw new Error('checklist/checklist wrongly marked overlay');
if (!by['checklist/checklist'].optional.includes('beats')) throw new Error('beat card missing optional beats');
if (by['tool-icon/logo-grid'].optional.includes('duration')) throw new Error('duration leaked into optional');
console.log('LOADKIT-OK', k.cards.length);
" --input-type=module
```
-> prints `LOADKIT-OK 72`.

### Step 2: Rewrite `S4` and retire `S6` in `lib/intro-kit/lint-cutlist.mjs`

**2a.** Update the import line — `loadKit` still comes from `./inputs.mjs`, so
that line is unchanged. Update the file header's second paragraph, which
currently reads "There are no warnings in this lint — every rule below is a
hard gate." Replace that sentence with:

```
// There are no warnings in this lint — every rule below is a hard gate. What
// the CLI additionally prints as `NOTICE` lines (plan 229) are NOT rules and
// never touch the exit code: they flag a body card running far shorter than
// the length it was designed for, so the owner knows where to look in the
// first render. Body cards hard-code their motion schedule in absolute
// seconds; only the four cards ported from the old intro kit scale to a
// `duration` variable.
```

**2b.** Replace the whole `checkS4` function (from its `// S4 —` comment
through its closing brace) with:

```js
// S4 — vars satisfies the card's catalog.json contract, and the beat's kind
// agrees with the card's own placement. Five sub-rules, each with its own
// suffix so a failure names what is wrong:
//   unknown-card       the slug is not in catalog.json
//   kind-mismatch      an overlay-placement card used as kind "card", or vice versa
//   missing-vars       a required variable is absent
//   extra-vars         a variable outside required + optional
//   renderer-owned-var `duration`, which render-simple.mjs computes and injects
// plus two beat-array rules for beat cards: bad-beat (an element failing the
// catalog's beat_shape) and too-many-beats (over max_beats).
function checkS4(cutlist, kit) {
  const errors = [];
  const bySlug = Object.fromEntries((kit?.cards ?? []).map((c) => [c.slug, c]));
  for (const b of cutlist.beats) {
    if (b.kind !== 'card' && b.kind !== 'overlay') continue;
    const card = bySlug[b.card];
    if (!card) {
      errors.push(
        `S4 unknown-card: ${b.id} references card "${b.card}", which is not in card-library/catalog.json — ` +
          'the intro and the body draw from the same catalogue, so a slug is "<type>/<card>", never a bare name',
      );
      continue;
    }
    if (Boolean(card.overlay) !== (b.kind === 'overlay')) {
      errors.push(
        `S4 kind-mismatch: ${b.id} uses card "${b.card}" as kind "${b.kind}", but its catalog placement is ` +
          `${card.overlay ? 'overlay' : 'fullframe'} — an overlay card may only be used with kind "overlay", and vice versa`,
      );
    }
    const allowed = new Set([...card.required, ...card.optional]);
    const vars = b.vars ?? {};
    const missing = card.required.filter((k) => !(k in vars));
    const ownedByRenderer = Object.keys(vars).filter((k) => k === 'duration');
    const extra = Object.keys(vars).filter((k) => !allowed.has(k) && k !== 'duration');
    if (missing.length) {
      errors.push(`S4 missing-vars: ${b.id} (${b.card}) is missing required var(s): ${missing.join(', ')}`);
    }
    if (ownedByRenderer.length) {
      errors.push(
        `S4 renderer-owned-var: ${b.id} (${b.card}) sets "duration" — render-simple.mjs computes it from ` +
          't_end - t_start and injects it, so a value here is silently overwritten. Change the beat length instead.',
      );
    }
    if (extra.length) {
      errors.push(`S4 extra-vars: ${b.id} (${b.card}) has var(s) outside required/optional: ${extra.join(', ')}`);
    }
    // Beat arrays. `at` is the cut list's own addition — the body pipeline's
    // resolver computes each reveal time from the transcript, while a cut list
    // authors it directly (rebased to the beat's own start), so it is allowed
    // on every element and is not part of any card's beat_shape.
    const beatsArr = vars.beats;
    if (Array.isArray(beatsArr) && beatsArr.length) {
      if (!card.beatShape) {
        errors.push(`S4 bad-beat: ${b.id} (${b.card}) supplies beats, but that card is not a beat card in catalog.json`);
      } else {
        if (card.maxBeats !== null && beatsArr.length > card.maxBeats) {
          errors.push(
            `S4 too-many-beats: ${b.id} (${b.card}) has ${beatsArr.length} beats, over its catalog max_beats of ${card.maxBeats}`,
          );
        }
        const shapeKeys = new Set([...Object.keys(card.beatShape), 'at']);
        for (const [i, el] of beatsArr.entries()) {
          if (!el || typeof el !== 'object' || Array.isArray(el)) {
            errors.push(`S4 bad-beat: ${b.id} (${b.card}) beats[${i}] is not an object`);
            continue;
          }
          for (const [k, spec] of Object.entries(card.beatShape)) {
            if (spec?.required && !(k in el)) {
              errors.push(`S4 bad-beat: ${b.id} (${b.card}) beats[${i}] is missing required key "${k}"`);
            }
          }
          for (const k of Object.keys(el)) {
            if (!shapeKeys.has(k)) {
              errors.push(`S4 bad-beat: ${b.id} (${b.card}) beats[${i}] has key "${k}" outside the card's beat_shape`);
            }
          }
        }
      }
    }
  }
  return errors;
}
```

**2c.** Delete the whole `checkS6` function and its `// S6 —` comment block,
and in its place put a tombstone comment:

```js
// S6 was RETIRED by plan 229. It gated each card beat against a per-card
// minDuration/maxDuration that only ever existed in intro-kit/kit.json; the
// body catalogue has a single `default_duration` and no range. S3 already
// gates every beat at [CUT_MIN, CUT_MAX] = 1.5-4.0s, which is a tighter bound
// than any kit range was. The number is not reused: a future rule gets S8.
```

Remove `...checkS6(cutlist, kit),` from the `errors` array in `lintCutlist`.
Leave `checkS1`, `checkS2`, `checkS3`, `checkS5` and `checkS7` and their order
exactly as they are.

**2d.** Add the truncation notice. Add this exported function just above
`lintCutlist`:

```js
// NOT a rule — see the file header. Body cards hard-code their motion in
// absolute seconds against a catalog `default_duration` of 4-15s, while an
// intro beat runs 1.5-4.0s, so a body card in an intro plays its entry and is
// then cut off mid-idle. The owner accepted that (2026-08-23) rather than
// retrofitting every body card up front; these notices are how they find out
// WHICH cards actually look wrong in the first render.
export const TRUNCATION_RATIO = 0.6;

export function truncationNotices({ cutlist, kit }) {
  const bySlug = Object.fromEntries((kit?.cards ?? []).map((c) => [c.slug, c]));
  const out = [];
  for (const b of cutlist.beats ?? []) {
    if (b.kind !== 'card' && b.kind !== 'overlay') continue;
    const card = bySlug[b.card];
    if (!card || card.defaultDuration === null) continue;
    const dur = beatDuration(b);
    if (dur < card.defaultDuration * TRUNCATION_RATIO) {
      out.push(
        `NOTICE truncation: ${b.id} (${b.card}) runs ${dur.toFixed(2)}s against a card designed for ` +
          `${card.defaultDuration}s — watch this one in the render; its motion may be cut off mid-way`,
      );
    }
  }
  return out;
}
```

**2e.** In the CLI guard at the bottom of the file, print the notices after the
errors, and do NOT let them affect the exit code. Find the block that reports
`errors` and add, immediately after it:

```js
  for (const n of truncationNotices({ cutlist, kit })) console.log(n);
```

Use `console.log`, not `console.error` — notices are not failures.

**Verify**:
```
cd pipelines/video/visuals-flow && rtk proxy grep -c "checkS6" lib/intro-kit/lint-cutlist.mjs
```
-> prints `0`.
```
cd pipelines/video/visuals-flow && rtk proxy grep -n "S4 renderer-owned-var\|S4 too-many-beats\|S4 bad-beat\|TRUNCATION_RATIO" lib/intro-kit/lint-cutlist.mjs
```
-> prints at least four matching lines.

### Step 3: Rewrite the eight fixtures onto body slugs

All fixtures live in `lib/intro-kit/fixtures/`. Keep every `id`, `kind`,
`t_start` and `t_end` EXACTLY as they are — the beat timings are what S1/S2/S3/S5
test, and changing one silently changes what a `bad-*` fixture proves.

**3a.** Delete `bad-s6.json`:
```bash
cd pipelines/video/visuals-flow && git rm lib/intro-kit/fixtures/bad-s6.json
```

**3b.** In `good.json` and in each remaining `bad-s*.json`, apply this slug and
vars mapping to every card/overlay beat:

| old `card` | new `card` | vars transform |
|---|---|---|
| `statement` | `slate/kinetic-sentence` | unchanged (`text`, `accent`, `beats[]`) |
| `checklist` | `checklist/checklist` | replace the whole `vars` object with `{ "title": "What you get" }` — drop `icon` and `rows`; add NO `beats` (see the words.json note in Current state) |
| `lower-third` | `overlay/lower-third` | replace the whole `vars` object with `{ "name": "Mira", "subtitle": "Founder and host" }` |
| `logo-grid` | `tool-icon/logo-grid` | rename the `logos` key to `productLogos`; keep `text`, `accent`, `beats[]` |
| `shot-float` | `enacted/shot-float` | unchanged (`text`, `accent`, `shots[]`, `beats[]`) |
| `ui-mock` | `enacted/ui-mock` | rename `appLogo`→`logo` if present; change `shot` to an image path, e.g. `"shots/ui.png"` (the current value `"dashboard"` is not a path); keep `appName`, `state` |
| `chain` | `process/chain` | `target` must become an OBJECT: `"target": "Decision"` becomes `"target": { "label": "Decision" }`; keep `items` |

For reference, `good.json`'s eleven beats today are:

```
b01 avatar                      0.00 -> 3.20
b02 card    statement    3.20 -> 6.40   {text, accent, beats[8]}
b03 avatar                      6.40 -> 9.40
b04 overlay lower-third  9.40 -> 11.80  {text, beats:[]}
b05 card    checklist   11.80 -> 15.00  {icon, rows[3]}
b06 avatar                     15.00 -> 18.20
b07 card    logo-grid   18.20 -> 21.40  {text, logos[3], beats[5]}
b08 avatar                     21.40 -> 24.60
b09 card    shot-float  24.60 -> 27.80  {text, shots[2], beats[6]}
b10 card    ui-mock     27.80 -> 31.00  {appName, shot, state}
b11 card    chain       31.00 -> 34.20  {items[3], target}
```

**3c.** `bad-s4.json` currently trips the old S4. Confirm it still trips the
new one; if its defect was an unknown BARE slug it now trips
`S4 unknown-card` for a different reason but still trips S4, which is what the
test asserts. If after the mapping it no longer trips S4, make it trip by
adding `"nope": 1` to one card beat's `vars` (that is `S4 extra-vars`). Do NOT
change its timings.

**Verify**:
```
cd pipelines/video/visuals-flow && node -e "
const fs=require('fs'), path=require('path');
const dir='lib/intro-kit/fixtures';
let bad=0;
for (const f of fs.readdirSync(dir)) {
  if (f === 'words.json') continue;
  const j = JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));
  for (const b of j.beats||[]) if (b.card && !b.card.includes('/')) { console.error(f+': bare slug '+b.card); bad=1; }
}
process.exit(bad);
"
```
-> exit 0, no output.

### Step 4: Update `lint-cutlist.test.mjs`

**4a.** Change the codes list:
```js
// S6 was retired by plan 229 (its per-card duration range lived only in the
// deleted intro-kit/kit.json; S3's [CUT_MIN, CUT_MAX] is a tighter bound).
const CODES = ['S1', 'S2', 'S3', 'S4', 'S5', 'S7'];
```

**4b.** Add these three tests at the end of the file, covering the new S4
sub-rules. They construct cut lists inline rather than adding fixtures.

```js
function oneCardCutlist(card, vars, { start = 0, end = 3 } = {}) {
  return {
    video: 'x', mode: 'simple', approved: false,
    span: { start, end },
    beats: [{ id: 'c1', kind: 'card', card, t_start: start, t_end: end, vars }],
  };
}

test('S4 refuses a duration var — the renderer owns it', () => {
  const result = lintCutlist({
    cutlist: oneCardCutlist('checklist/checklist', { title: 'What you get', duration: 3 }),
    kit, words: [],
  });
  assert.ok(
    result.errors.some((e) => e.startsWith('S4 renderer-owned-var')),
    `expected S4 renderer-owned-var, got:\n${result.errors.join('\n')}`,
  );
});

test('S4 refuses a beats element carrying a key outside the card beat_shape', () => {
  const result = lintCutlist({
    cutlist: oneCardCutlist('checklist/checklist', { title: 'What you get', beats: [{ text: 'Fast', bogus: 1 }] }),
    kit, words: [],
  });
  assert.ok(
    result.errors.some((e) => e.startsWith('S4 bad-beat')),
    `expected S4 bad-beat, got:\n${result.errors.join('\n')}`,
  );
});

test('S4 allows `at` on a beats element — the cut list authors reveal times directly', () => {
  const result = lintCutlist({
    cutlist: oneCardCutlist('checklist/checklist', { title: 'What you get', beats: [{ text: 'Fast', at: 0.4 }] }),
    kit, words: [],
  });
  assert.ok(
    !result.errors.some((e) => e.startsWith('S4')),
    `expected no S4 error, got:\n${result.errors.join('\n')}`,
  );
});

test('a body card far shorter than its designed length raises a truncation NOTICE, not an error', () => {
  const cutlist = oneCardCutlist('checklist/checklist', { title: 'What you get' }, { start: 0, end: 2 });
  const result = lintCutlist({ cutlist, kit, words: [] });
  assert.deepEqual(result.errors, [], `expected no errors, got:\n${result.errors.join('\n')}`);
  const notices = truncationNotices({ cutlist, kit });
  assert.ok(notices.some((n) => n.startsWith('NOTICE truncation')), `expected a truncation notice, got:\n${notices.join('\n')}`);
});
```

Add `truncationNotices` to the file's existing import from `./lint-cutlist.mjs`.
(`checklist/checklist` has `default_duration: 8`, so a 2s beat is under
`0.6 * 8 = 4.8` and a 3s beat is too — both notice. That is expected: almost
every body card will notice at intro lengths, which is exactly the list the
owner wants.)

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/intro-kit/lint-cutlist.test.mjs` -> exit 0, and the four new tests appear in the output.

### Step 5: Rewire `render-simple.mjs` onto card-library

**5a.** Change the import of `inputs.mjs`:
```js
import { loadKit, loadCutlist, CARD_LIBRARY_ROOT } from './inputs.mjs';
```
and add, next to the existing imports:
```js
import { enrichLogos } from '../logos-inline.mjs';
import { enrichImages } from '../images-inline.mjs';
```

**5b.** Delete the whole `materializeAssetLinks` function and the long comment
block above it (the one starting "Four of the seven kit cards reach their
assets through a SYMLINK"). Ported cards hold real files, and logos now arrive
as data URIs.

**5c.** Replace the staging block inside `renderCardBeat` (quoted in Current
state) with:

```js
    // --- staging, copied from lib/render.mjs's renderOne (see header comment) ---
    fs.cpSync(path.join(CARD_LIBRARY_ROOT, 'hyperframes.json'), path.join(stagedDir, 'hyperframes.json'));
    fs.cpSync(path.join(CARD_LIBRARY_ROOT, 'meta.json'), path.join(stagedDir, 'meta.json'));
    // A catalog slug IS the relative path ("<type>/<card>"), unlike the old
    // kit which prefixed every card with "cards/".
    const cardRel = beat.card;
    const stagedCardDir = path.join(stagedDir, cardRel);
    fs.mkdirSync(path.dirname(stagedCardDir), { recursive: true });
    fs.cpSync(path.join(CARD_LIBRARY_ROOT, cardRel), stagedCardDir, { recursive: true });
    // --- end staging ---
```

**5d.** `renderCardBeat` now needs the video workdir to resolve image paths.
Change its signature to
`function renderCardBeat(beat, { renderDir, cacheDir, noCache, workdir })`
and update its single call site in `renderSimple` to pass `workdir`.

**5e.** Replace the vars-writing lines with the body pipeline's enrichment:

```js
    const vars = { ...(beat.vars ?? {}), duration };
    // Same enrichment the body renderer applies (lib/render.mjs 292-302):
    // image paths become data URIs resolved against the video workdir, logo
    // slugs become data URIs under __logos. Card HTML has no stable base URL
    // across the board, the renderer and render2, so a data URI is the only
    // reference that means the same thing on all three.
    const { variables: withImages, missing: missingImages } = enrichImages(vars, workdir);
    const { variables: enrichedVars, missing: missingLogos } = enrichLogos(withImages, CARD_LIBRARY_ROOT);
    if (missingImages.length) console.warn(`${beat.id}: image(s) not found in the workdir: ${missingImages.join(', ')}`);
    if (missingLogos.length) console.warn(`${beat.id}: logo slug(s) not in card-library/logos/registry.json: ${missingLogos.join(', ')}`);
    fs.writeFileSync(path.join(stagedDir, 'vars.json'), JSON.stringify(enrichedVars));
```

Keep the existing comment above `const vars = ...` explaining why `duration` is
injected here rather than authored — it is still true and now S4 enforces it.

**5f.** Update the file's header comment: it currently says staging comes from
"pipelines/video/intro-kit/ instead of card-library/". Replace that sentence
with:

```
// Card rendering reuses lib/render.mjs's staging machinery (hashRenderInputs,
// runPool, rewriteDuration, DEFAULT_JOBS) and now also its asset enrichment
// (enrichImages + enrichLogos), staging from the same card-library/ the body
// pipeline uses — one catalogue for the intro and the body (owner decision
// 2026-08-23). The ~8 staging lines are still duplicated rather than shared,
// with this comment naming the original, because lib/render.mjs's own block is
// inlined inside its single renderOne() closure and pulling it out would touch
// how the body pipeline renders every card.
```

**5g.** After the lint gate in `renderSimple`, print the truncation notices:

```js
  for (const n of truncationNotices({ cutlist, kit })) console.log(n);
```

and add `truncationNotices` to the existing `./lint-cutlist.mjs` import.

**Verify**:
```
cd pipelines/video/visuals-flow && rtk proxy grep -c "INTRO_KIT_ROOT\|materializeAssetLinks" lib/intro-kit/render-simple.mjs
```
-> prints `0`.
```
cd pipelines/video/visuals-flow && node --test lib/intro-kit/render-simple.test.mjs
```
-> exit 0. Update assertions in that test file that name kit paths, bare slugs
or `materializeAssetLinks`; do NOT delete a test to make it pass (STOP
condition).

### Step 6: Generalise `simpleBeatText` in the board's Intro tab

Replace the function quoted in Current state with:

```ts
// Gate 125. A cut-list beat now fills ANY card in the body catalogue (plan
// 229), so there is no fixed set of variable shapes to enumerate — this walks
// the ones body cards actually put words in, most specific first, and falls
// back to the beat word list. This is the ONE thing the owner reads per row,
// so a blank cell here means a row they cannot review.
function simpleBeatText(b: any): string {
  const vars = b?.vars || {};
  for (const k of ['text', 'title', 'name', 'question', 'prompt', 'appName', 'headline', 'label']) {
    if (typeof vars[k] === 'string' && vars[k].trim()) return vars[k];
  }
  if (Array.isArray(vars.beats)) {
    const words = vars.beats.map((x: any) => (typeof x?.text === 'string' ? x.text : '')).filter(Boolean);
    if (words.length) return words.join(' ');
  }
  if (Array.isArray(vars.rows)) {
    return vars.rows.map((r: any) => r?.label ?? r?.text ?? '').filter(Boolean).join(', ');
  }
  if (Array.isArray(vars.items)) {
    return vars.items.map((r: any) => r?.label ?? r?.text ?? '').filter(Boolean).join(', ');
  }
  return '';
}
```

Also update the comment at line ~142, "the cards are locked (plan 219)", to
"the cards come from the shared body catalogue (plan 229)".

**Verify**:
```
cd pipelines/video/visuals-flow/board-ui && npx vitest run && npm run build
```
-> exit 0.
```
cd pipelines/video/visuals-flow && node scripts/board-ui-smoke.mjs
```
-> exit 0. This smoke reads `lib/intro-kit/fixtures/good.json`, so it exercises
the rewritten fixture through the real Intro tab. **Commit the Intro-tab
screenshot it produces** — `ui: true` on this plan means boss rejects the
branch without an image.

### Step 7: Rewrite the 115 step docs

**7a.** In `steps/115-author-intro-simple-llm/SIMPLE-PASS.md`, replace the two
sections "## The 7 cards, and what each is for" and "## Read
`../../../intro-kit/kit.json` for each card's required variables" (everything
from the `## The 7 cards` heading down to, but not including, `## The pacing
targets`) with exactly this:

```markdown
## Pick from the body card catalogue — the same one the cue pass uses

There is no intro card set. `pipelines/video/card-library/catalog.json` is the
ONE catalogue for the intro and the body (owner decision 2026-08-23), and every
card in it is available to you. A slug is always `"<type>/<card>"` —
`slate/kinetic-sentence`, never `kinetic-sentence`.

Read `catalog.json` and pick per beat. Each entry tells you everything you
need:

| Field | What it means for you |
|---|---|
| `purpose` | one line on what the card is for — this is your selection signal |
| `placement` | `overlay` cards may ONLY be used with `kind: "overlay"`; `fullframe` cards ONLY with `kind: "card"` |
| `variables` | `vars` must contain every entry with `"required": true`, and nothing outside the whole list |
| `beat_shape` | present on beat cards: the shape of each element of `vars.beats[]` |
| `max_beats` | the cap on `vars.beats[]` length |
| `default_duration` | the length the card's motion was designed for — see the truncation note below |

`vars.beats[]` elements may additionally carry `at` (seconds, rebased to the
beat's own start), which is the cut list's own field and is not in any
`beat_shape`.

**Never set `duration`.** The renderer computes it from `t_end - t_start` and
injects it; lint code `S4 renderer-owned-var` refuses a cut list that sets one.

If nothing in the catalogue expresses a beat, use `slate/kinetic-sentence` —
one spoken sentence, word by word, on the ambient canvas. It always works, and
it is the direct replacement for the old kit's `statement`.

### The four cards that came from the old intro kit

These were the intro kit's own devices and are now ordinary body cards, so the
body may use them too:

| Slug | Purpose |
|---|---|
| `tool-icon/logo-grid` | "too many tools" — real logos, then the line lands and they dim |
| `enacted/shot-float` | generated stills or screenshots as evidence while the line runs |
| `enacted/ui-mock` | a stylised app window around a screenshot, in an ok or a fail state |
| `process/chain` | N labelled inputs converging on one named output |

They are the only cards that scale their motion to the beat length.

### Truncation: expect it, report it, do not work around it

Body cards hard-code their motion schedule in absolute seconds against a
`default_duration` of 4–15s, while an intro beat runs 1.5–4.0s. A body card in
an intro therefore plays its entry animation and is cut off part-way through
its idle motion. The owner accepted this on 2026-08-23 rather than retrofitting
every body card up front.

`intro-simple-lint` prints a `NOTICE truncation:` line per beat that runs under
60% of its card's `default_duration`. Notices are NOT errors and never fail the
lint. **Do not lengthen a beat past its transcript line to silence one** — the
cut length comes from the words being spoken, and `S3` caps it at 4.0s anyway.
Leave the notices; they are the owner's list of what to look at in the render.
```

**7b.** In `steps/115-author-intro-simple-llm/README.md`, replace the sentence
naming "the locked kit of 7 (`../intro-kit/kit.json`)" with "the shared body
catalogue (`../../../card-library/catalog.json`)", and replace the table row
whose second column reads "plan 219's locked 7-card kit (the schema)" with
`| `../../../card-library/catalog.json` | the shared card catalogue — the schema for every card the intro may use |`.

**7c.** In `steps/115-author-intro-simple-llm/step.json`, replace the `summary`
string with:

```
"summary": "`transcript.json` + `segments.json` + `concept.json` + `../card-library/catalog.json` → `intro-simple/cutlist.json`. Runs only when `run-config.json` has `introMode: \"simple\"`. Picks a card slug per beat from the shared body catalogue and fills its variables — it never writes HTML. Approved at 125, rendered at 135.",
```

**Verify**:
```
cd pipelines/video/visuals-flow && node scripts/gen-pipeline-table.mjs --check
```
-> exit 0. If it fails because PIPELINE.md is stale, run
`node scripts/gen-pipeline-table.mjs` (no `--check`) to regenerate, then re-run
the check.

### Step 8: Update `TASTE-SIMPLE.md`

Two edits, and NOTHING else in that file — its rules are owner taste and are
retired in place, never deleted (the file says so itself).

**8a.** In the preamble, replace "`simple` picks and fills from seven locked
cards and prizes legibility and repeatability" with "`simple` picks and fills
from the shared body card catalogue and prizes legibility and repeatability".

**8b.** In `S-T4`'s body, replace "the kit's whole point is that no session has
to exercise taste about a 'story' here" — leave that sentence alone, it is
still true — but in `S-T2`'s **Enforced by** line, replace "`S4` in the pacing
lint checks that a card's `vars` satisfy its kit contract" with "`S4` in the
pacing lint checks that a card's `vars` satisfy its catalog contract".

Also append this rule at the end of the file, in the file's own format:

```markdown
## S-T8 — A truncation notice is information, not a defect to design around.

Body cards were built for 4-15s and an intro beat runs 1.5-4.0s, so almost
every card raises `NOTICE truncation`. Do not pick a card because it notices
less, and do not stretch a beat past its spoken line to silence one. Pick the
card that says the right thing; the notice tells the owner where to look in the
render.

**From:** owner decision, 2026-08-23 — swap the intro onto the body catalogue
first and fix the cards that actually look wrong, rather than retrofitting all
68 up front.

**Enforced by:** author judgement (the notice itself is non-blocking by
design).
```

**Verify**: `cd pipelines/video/visuals-flow && rtk proxy grep -c "seven locked cards" TASTE-SIMPLE.md` -> prints `0`.

### Step 9: Archive the one real cut list

```bash
cd pipelines/video/visuals-flow/videos/consistent-character-ai-animation-howto/intro-simple
git mv cutlist.json cutlist.pre-catalog.json
```

Then create `README.md` in that same directory containing:

```markdown
# intro-simple — this video needs a fresh 115 pass

`cutlist.pre-catalog.json` was authored against the deleted 7-card intro kit
(`pipelines/video/intro-kit/`). Two of its beats use that kit's `checklist`
card, whose `{icon, rows:[{text, mark}]}` yes/no device has no equivalent in
the body catalogue — `checklist/checklist` draws checkmarks only, from
`beats[].text` under a required `title`. There is no faithful mechanical
migration, and the file was never approved (`"approved": false`).

Re-author it against the shared catalogue:

    bash run.sh consistent-character-ai-animation-howto intro-simple

Kept for reference (the beat timings and the transcript-verified word lists in
its `statement` beats are still good source material). Delete it once the new
cut list is approved at gate 125.
```

**Verify**:
```
cd pipelines/video/visuals-flow && bash run.sh consistent-character-ai-animation-howto intro-simple-lint; echo "exit=$?"
```
-> the lint reports the cut list is missing and exits non-zero with a plain
sentence naming `intro-simple/cutlist.json` (from `loadCutlist`'s existing
throw). That is the correct degraded state, not a crash.

### Step 10: Delete `pipelines/video/intro-kit/`

```bash
cd /Users/kbtg/codebase/personal-stuff && git rm -r pipelines/video/intro-kit
```

**Verify**:
```
cd /Users/kbtg/codebase/personal-stuff && test ! -e pipelines/video/intro-kit && echo GONE
```
-> prints `GONE`.
```
cd /Users/kbtg/codebase/personal-stuff && rtk proxy grep -rn "intro-kit/kit.json\|intro-kit/KIT.md\|INTRO_KIT_ROOT\|video/intro-kit" --include=*.mjs --include=*.ts --include=*.tsx --include=*.sh --include=*.json --include=*.md . | rtk proxy grep -v "^./plans/" | rtk proxy grep -v node_modules
```
-> prints NOTHING. (`lib/intro-kit/` — the visuals-flow FOLDER — keeps its
name; only `pipelines/video/intro-kit/`, the card source, is gone. Matches
inside `plans/` are historical records and stay.)

### Step 11: Update the skill guardrail and record the decision

**11a.** In `.claude/skills/yt-video-edit/SKILL.md`, guardrail 7a, replace the
`simple` bullet:

> - `simple` — steps 115 (author the cut list) → 125 (owner gate) → 135 (render).
>   The cards are LOCKED (`pipelines/video/intro-kit/`, 7 of them). You pick and fill;
>   you never design. Rulebook: `steps/115-author-intro-simple-llm/SIMPLE-PASS.md`.
>   Taste: `TASTE-SIMPLE.md`. Pacing is ENFORCED by `lib/intro-kit/lint-cutlist.mjs`.

with:

> - `simple` — steps 115 (author the cut list) → 125 (owner gate) → 135 (render).
>   Cards come from the SHARED body catalogue
>   (`pipelines/video/card-library/catalog.json`) — the same one the cue pass
>   uses, slugs are `"<type>/<card>"`. You pick and fill; you never design.
>   Rulebook: `steps/115-author-intro-simple-llm/SIMPLE-PASS.md`. Taste:
>   `TASTE-SIMPLE.md`. Pacing is ENFORCED by `lib/intro-kit/lint-cutlist.mjs`
>   (S1-S5, S7 — S6 retired with the old kit).

Also, in the same guardrail, replace the paragraph beginning "**The intro's
'full creative freedom' applies to `complex` only**" — keep it, but change
"the `simple` flow is a locked kit of 7 cards (plan 219)" to "the `simple` flow
picks from the shared body catalogue (plan 229)".

**11b.** Append to **`pipelines/video/visuals-flow/decisions.md`** — the
pipeline's own decisions file, which is where every intro and card decision
already lives (its entries run `- **2026-08-20**: **Title…`, and
`intro-kit/KIT.md`'s "recorded in decisions.md" meant this file). Match that
format exactly:

```markdown
- **2026-08-23**: **One card catalogue for the intro and the body.** The `simple`
  intro flow no longer has a card set of its own: `pipelines/video/intro-kit/`
  (plan 219's locked 7-card kit, with its own `kit.json`, `hyperframes.json`
  and private logo mirror) is deleted, and steps 115/135 read
  `pipelines/video/card-library/catalog.json` like the body cue pass does. The
  four kit cards with no body equivalent were ported first (plan 228) as
  `tool-icon/logo-grid`, `enacted/shot-float`, `enacted/ui-mock` and
  `process/chain`; `statement`, `checklist` and `lower-third` map onto the
  existing `slate/kinetic-sentence`, `checklist/checklist` and
  `overlay/lower-third`. Two catalogues for one video drift, and the owner has
  to remember which cards exist where. **Accepted cost:** body cards hard-code
  their motion in absolute seconds against a 4-15s `default_duration`, so at a
  1.5-4.0s intro cut they play their entry and get truncated; the owner chose
  (this date) to swap first and fix the cards that actually look wrong, so
  `intro-simple-lint` now prints a non-blocking `NOTICE truncation:` per short
  beat instead of a gate. Lint code `S6` retired with `kit.json` (its per-card
  duration range had no catalogue equivalent; `S3`'s 1.5-4.0s is tighter
  anyway). This supersedes `intro-kit/KIT.md`'s "do not add an 8th card without
  an owner decision recorded in decisions.md" — the kit itself is gone.
  Plans 228, 229.
```

Then append ONE pointer line to the repo-root `decisions.md`, in that file's
own format, so a root-level session finds it:

```markdown
- **2026-08-23**: **The simple intro flow reads the body card catalogue.**
  `pipelines/video/intro-kit/` is deleted; steps 115/135 read
  `pipelines/video/card-library/catalog.json`. Full entry and the accepted
  truncation cost: `pipelines/video/visuals-flow/decisions.md`, same date.
  Plans 228, 229.
```

**Verify**:
```
cd /Users/kbtg/codebase/personal-stuff && rtk proxy grep -c "2026-08-23" pipelines/video/visuals-flow/decisions.md
```
-> at least `1`.
```
cd /Users/kbtg/codebase/personal-stuff && rtk proxy grep -c "reads the body card catalogue" decisions.md
```
-> prints `1`.

### Step 12: Run the whole gate on a clean tree

```bash
cd /Users/kbtg/codebase/personal-stuff/pipelines/video/visuals-flow
git clean -xdf lib/intro-kit board-ui/dist
bash scripts/check.sh
```

**Verify**: exit 0, last line `visuals-flow check OK`. Running after
`git clean` is deliberate — crews verify in worktrees carrying their own build
artifacts, and build-order dependencies only surface on a pristine tree
(LESSONS 2026-07-31).

## Test plan

- `lint-cutlist.test.mjs` — S6 removed from `CODES`; four new tests covering
  `renderer-owned-var`, `bad-beat`, the `at` allowance, and the truncation
  notice being a notice rather than an error. `good.json` must still produce
  zero errors after the fixture rewrite, and each `bad-s*.json` must still trip
  its own code.
- `render-simple.test.mjs` — existing tests updated for the card-library
  staging root, the `<type>/<card>` slug shape, and the removal of
  `materializeAssetLinks`.
- `board-ui` vitest + `scripts/board-ui-smoke.mjs` — the smoke loads the
  rewritten `fixtures/good.json` through the real Intro tab, so a blank text
  column would show up in the committed screenshot.
- `scripts/gen-pipeline-table.mjs --check` — catches a `step.json` edit that
  never regenerated `PIPELINE.md`.
- Boss mutation gate — sets `vars.duration` on a `good.json` card beat and
  requires `lint-cutlist.test.mjs` to fail printing `S4 renderer-owned-var`.
  This proves the new rule can actually fire, which is the exact class of
  defect that shipped twice on 2026-08-02.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow && bash scripts/check.sh` exits 0 after a `git clean -xdf lib/intro-kit board-ui/dist`, last line `visuals-flow check OK`.
- [ ] `test ! -e pipelines/video/intro-kit` — the folder is gone.
- [ ] `rtk proxy grep -rn "intro-kit/kit.json\|INTRO_KIT_ROOT\|video/intro-kit" --include=*.mjs --include=*.ts --include=*.tsx --include=*.sh --include=*.json --include=*.md . | rtk proxy grep -v "^./plans/" | rtk proxy grep -v node_modules` prints nothing.
- [ ] `cd pipelines/video/visuals-flow && node -e "const fs=require('fs');for(const f of fs.readdirSync('lib/intro-kit/fixtures')){if(f==='words.json')continue;for(const b of JSON.parse(fs.readFileSync('lib/intro-kit/fixtures/'+f,'utf8')).beats||[])if(b.card&&!b.card.includes('/'))process.exit(1)}console.log('ALL-SLUGS-QUALIFIED')"` prints `ALL-SLUGS-QUALIFIED`.
- [ ] `cd pipelines/video/visuals-flow && rtk proxy grep -c "checkS6\|materializeAssetLinks" lib/intro-kit/lint-cutlist.mjs lib/intro-kit/render-simple.mjs` reports 0 for both files.
- [ ] `lib/intro-kit/fixtures/bad-s6.json` no longer exists.
- [ ] `node --test lib/intro-kit/lint-cutlist.test.mjs` exits 0 and its output names the four new tests.
- [ ] `node scripts/board-ui-smoke.mjs` exits 0 and an Intro-tab screenshot is COMMITTED on the branch (`ui: true`).
- [ ] `node scripts/gen-pipeline-table.mjs --check` exits 0.
- [ ] `videos/consistent-character-ai-animation-howto/intro-simple/` contains `cutlist.pre-catalog.json` and `README.md`, and no `cutlist.json`.
- [ ] `pipelines/video/visuals-flow/decisions.md` carries the full 2026-08-23 entry, and the repo-root `decisions.md` carries the pointer line.
- [ ] `.claude/skills/yt-video-edit/SKILL.md` guardrail 7a no longer says the simple cards are locked or that there are 7 of them.
- [ ] `plans/README.md` row for plan 229 updated to DONE.

## STOP conditions

- **PR #181 (plan 228) must be merged before this plan starts.** Its four new
  slugs (`tool-icon/logo-grid`, `enacted/shot-float`, `enacted/ui-mock`,
  `process/chain`) are referenced by the rewritten fixtures and by
  `SIMPLE-PASS.md`. Verify with
  `node -e "const c=require('./pipelines/video/card-library/catalog.json').cards.map(x=>x.slug);['tool-icon/logo-grid','enacted/shot-float','enacted/ui-mock','process/chain'].forEach(s=>{if(!c.includes(s))throw new Error('228 not merged: missing '+s)});console.log('228-PRESENT')"`
  before Step 1. If it throws, STOP.
- **Gate integrity**: if a lint or test assertion fails, fix the fixture or the
  code. Weakening, swapping or deleting an assertion — including removing a
  `bad-s*.json` fixture other than `bad-s6.json`, or shortening the `CODES`
  list beyond dropping `S6` — is a STOP.
- **Do not change `AVATAR_MAX_SHARE`, `AVATAR_MAX_HOLD`, `CUT_MIN` or
  `CUT_MAX`, and do not change the logic of `S1`, `S2`, `S3`, `S5` or `S7`.**
  The pacing contract is measured from the owner's reference intros and is out
  of scope. `lint-cutlist.test.mjs`'s first test asserts all four constants; if
  you find yourself wanting to edit it, STOP.
- **Do not hand-migrate
  `videos/consistent-character-ai-animation-howto/intro-simple/cutlist.json`.**
  Its two `checklist` beats have no faithful body equivalent and inventing a
  `title` is authoring, not execution. Archive it as Step 9 says and stop
  there.
- **Do not turn a truncation notice into an error**, and do not add it to the
  `errors` array returned by `lintCutlist`. It is non-blocking by owner
  decision; making it a gate would fail almost every cut list.
- **Do not touch `lib/intro-film/**` or `lib/render.mjs`.** If a change seems to
  require editing the body renderer, STOP and report — that is a sign the
  staging duplication should be resolved deliberately, not as a side effect.
- **If `bad-s4.json` cannot be made to trip the new S4 without changing its
  beat timings**, STOP and report rather than adjusting a timing (that would
  silently change what S1/S3/S5 are being tested against).

## Maintenance notes

- `lib/intro-kit/` (the visuals-flow folder) keeps its name even though
  `pipelines/video/intro-kit/` is gone. Renaming it would touch `run.sh`,
  `board-data.mjs`, `board-ui-smoke.mjs`, three step READMEs and the skill — a
  separate, purely cosmetic change. Do not fold it into this plan.
- The truncation notice is the mechanism for the follow-up work the owner
  deferred. After the first real simple intro renders, the notices plus the
  render itself name the body cards worth retrofitting with the
  variable-duration contract (`DUR = clamp(VARS.duration ?? default, 2, 5)`,
  motion scaled to `DUR`) that the four ported cards already have. That is a
  future plan, card by card, not a sweep.
- `loadKit` derives its view from `catalog.json` on every call. A new catalog
  field that the intro should honour (a per-card duration range, say) is one
  line there plus one rule in the lint — and would be `S8`, since `S6` is
  retired and its number is not reused.
- A reviewer should scrutinise: that `good.json` still produces zero errors
  (the fixture rewrite is where a silent behaviour change would hide); that the
  committed Intro-tab screenshot actually shows text in every row; and that the
  `enrichImages`/`enrichLogos` call order in `render-simple.mjs` matches
  `lib/render.mjs` (images first, then logos — logos walk `beats[].logo`, which
  image enrichment must not have already rewritten).
