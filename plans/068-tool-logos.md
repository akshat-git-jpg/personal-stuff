---
executor: agy
model:
test_cmd: cd pipelines/video/graphics-flow && bash scripts/check.sh && cd ../card-library && bash scripts/beat-smoke.sh
ui:
deploy:
needs: ["card-library logos are new; no other plan touches them"]
---

# Plan 068: Real tool logos on cards

## Summary

- **Problem statement**: Cards show tool names as text only; the owner wants real logos/icons (they click better with viewers). No logo asset story exists.
- **Goals**:
  - `card-library/logos/` registry: auto-fetched favicons with manual override (`registry.json` + PNGs) + a fetch script.
  - A shared enrichment helper that turns logo slugs in cue variables into data URIs at render/board time (cards stay self-contained).
  - Logo support in 5 cards: `section/tool-intro`, `verdict/persona-match`, `comparison/summary-table` (column headers), `overlay/stat-hit`, `comparison/credits-math` — all graceful (no logo → renders exactly like today).
  - Resolver validation: referencing a logo slug that isn't in the registry fails loudly.
  - Rulebook/prompt rule so the cue pass sets logo slugs.
- **Executor proposed**: agy / Gemini 3.1 Pro High (default routing; visual output passes the verifier's render+inspect gate before landing)
- **Done criteria** (terse): both gates green; 5 seed logos fetched; render of tool-intro with a logo shows it (verifier inspects).
- **Stop conditions** (terse): no npm deps; favicon fetch failing offline is a SKIP not a workaround; never break no-logo rendering.
- **Test / verification for success**: `scripts/check.sh` + `beat-smoke.sh`; verifier renders tool-intro/persona-match with logos and inspects frames.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 545cfb8..HEAD -- pipelines/video/card-library/logos pipelines/video/graphics-flow/lib/logos-inline.mjs` (must be empty — these files must not exist yet)

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW-MED (multi-card edits; graceful-degradation requirement)
- **Depends on**: none open
- **Category**: feature
- **Difficulty**: standard (fully inlined below)
- **Planned at**: commit `545cfb8`, 2026-07-18

## Why this matters

Owner feedback (2026-07-18, logged in `graphics-flow/tests/TESTS.md` "Folded lessons"): tool logos click with viewers more than text names. The flow's cards are self-contained HTML rendered from staged temp dirs, and previewed via a board that injects variables server-side — so logos must travel INSIDE the variables as data URIs, resolved from one registry, never as external URLs (deterministic renders, no network at render time).

## Current state

- `pipelines/video/card-library/` — cards + `catalog.json` (42 entries). Cards read variables via `window.__hyperframes.getVariables()`. Exemplars to read before editing: `section/tool-intro/index.html`, `verdict/persona-match/index.html`, `comparison/summary-table/index.html`, `overlay/stat-hit/index.html`, `comparison/credits-math/index.html`.
- `pipelines/video/graphics-flow/lib/render.mjs` — stages a temp dir per cue, writes `vars.json` = `cue.variables`, renders with `--variables-file`. The enrichment hook goes right before `vars.json` is written.
- `pipelines/video/graphics-flow/lib/board.mjs` — `serveCard()` injects variables into card HTML for the iframe preview. Same enrichment hook before injection.
- `pipelines/video/graphics-flow/lib/resolve.mjs` — exports `validateCues(cues, catalog)`; the logo-slug check goes there.
- `pipelines/video/graphics-flow/scripts/check.sh` — runs the lib test files explicitly; add the new test file to it.
- Test video for context: test-01's five tools — OpenArt (openart.ai), Higgsfield (higgsfield.ai), Synthesia (synthesia.io), HeyGen (heygen.com), Arcads (arcads.ai).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Fetch a logo | `node scripts/fetch-logo.mjs openart openart.ai` (from card-library) | `logos/openart.png` + registry entry |
| Flow gate | `cd pipelines/video/graphics-flow && bash scripts/check.sh` | `graphics-flow check OK` |
| Card gate | `cd pipelines/video/card-library && bash scripts/beat-smoke.sh` | `beat-smoke OK` |

## Scope

**In scope**:
- `pipelines/video/card-library/`: `logos/` (new: `registry.json`, PNGs, `README.md` one-pager), `scripts/fetch-logo.mjs` (new), the 5 card index.html files, `catalog.json` (edit the 5 entries' variables docs), `README.md` (one line pointing at logos/README.md)
- `pipelines/video/graphics-flow/`: `lib/logos-inline.mjs` (new), `lib/logos.test.mjs` (new), `lib/render.mjs` + `lib/board.mjs` (enrichment hook), `lib/resolve.mjs` (validation), `scripts/check.sh` (add test file), `steps/020-cue-pass-llm/RULEBOOK.md` + `cue-pass-prompt.md` (logo rule), `PIPELINE.md` (variables note)

**Out of scope**: all other cards, the render/board architecture, cues.json schema fields beyond the optional logo keys, any external logo API beyond Google favicons.

## Git workflow

- Branch: `advisor/068-tool-logos`
- Commit per step. No AI footers. Do NOT push.

## Steps

### Step 1: Registry + fetch script (card-library)

`scripts/fetch-logo.mjs <slug> <domain>` (node stdlib): GET `https://www.google.com/s2/favicons?domain=<domain>&sz=128`, write `logos/<slug>.png`, upsert `logos/registry.json`:

```json
{ "openart": { "domain": "openart.ai", "file": "openart.png", "source": "favicon" } }
```

Rules: refuse to overwrite an entry whose `source` is `"manual"` (that's the override: owner replaces the PNG by hand and flips source). `logos/README.md` documents: fetch command, the manual-override convention, and that slugs are lowercase alphanumeric tool names. Seed the 5 test-01 tools (fetch all; if the network fails, create registry entries with `"file": null` and STOP-note it rather than fabricating images).

**Verify**: `node -e "const r=require('./logos/registry.json'); console.log(Object.keys(r).length)"` → `5`; `file logos/openart.png` → PNG image data (when network available)

### Step 2: Enrichment helper (graphics-flow)

`lib/logos-inline.mjs` exporting exactly:

```js
import fs from 'node:fs';
import path from 'node:path';

// Walks variables for logo references and inlines them as data URIs under
// variables.__logos. References: variables.logo, variables.productLogos[],
// beats[].logo (beats live inside variables after resolve). Missing slugs are
// returned in `missing` — callers decide loud vs lenient.
export function enrichLogos(variables, cardLibraryRoot) {
  const regPath = path.join(cardLibraryRoot, 'logos', 'registry.json');
  const registry = fs.existsSync(regPath) ? JSON.parse(fs.readFileSync(regPath, 'utf8')) : {};
  const refs = new Set();
  if (typeof variables.logo === 'string') refs.add(variables.logo);
  for (const s of variables.productLogos ?? []) if (typeof s === 'string') refs.add(s);
  for (const b of variables.beats ?? []) if (typeof b.logo === 'string') refs.add(b.logo);
  const logos = {};
  const missing = [];
  for (const slug of refs) {
    const entry = registry[slug];
    if (!entry || !entry.file) { missing.push(slug); continue; }
    const file = path.join(cardLibraryRoot, 'logos', entry.file);
    if (!fs.existsSync(file)) { missing.push(slug); continue; }
    logos[slug] = `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
  }
  return { variables: refs.size ? { ...variables, __logos: logos } : variables, missing };
}
```

Hook it in `render.mjs` (before writing vars.json; a non-empty `missing` is a per-cue error) and `board.mjs` `serveCard` (missing slugs are tolerated in preview — card hides the img).

**Verify**: `node --test lib/logos.test.mjs` (Step 5) passes

### Step 3: Card support (graceful in all 5)

Shared pattern inside each card's CONTENT/build: `const LOGOS = VARS.__logos ?? {};` and an `<img>` only when the slug resolves — `if (LOGOS[x]) img.src = LOGOS[x]; else img.remove()` (or don't create it). Per card:

- `section/tool-intro`: optional `logo` (slug). 96px rounded-14px img left of the name, vertically centered with it; name block shifts right only when a logo exists.
- `verdict/persona-match`: optional `logo` per beat item. 28px img before the winner text in the row.
- `comparison/summary-table`: optional `productLogos` (array of slugs, same order/length as `products`). 24px img above each product header cell, centered; header row grows taller only when any logo exists.
- `overlay/stat-hit`: optional `logo`. 32px img inline before the eyebrow text.
- `comparison/credits-math`: optional `logo`. 32px img before the title text.

Update the 5 `catalog.json` entries' `variables` docs with the new optional keys (e.g. `"logo": "string (optional) — logos/ registry slug, e.g. 'heygen'"`). Defaults carry NO logos (cards must look exactly as today with no variables — the gallery and beat-smoke render prove it).

**Verify**: `cd ../card-library && for c in section/tool-intro verdict/persona-match comparison/summary-table overlay/stat-hit comparison/credits-math; do npx hyperframes@latest lint $c || exit 1; done` → all exit 0

### Step 4: Validation + cue-pass rule

- `resolve.mjs` `validateCues`: for each cue, collect the same three reference kinds; a slug absent from the registry (or with `file: null`) → error `"<id>: unknown logo slug \"x\" — run card-library/scripts/fetch-logo.mjs"`. (Load registry the same way; pass `cardLibraryRoot` into `validateCues` from the CLI — adjust its signature and the existing callers/tests.)
- `RULEBOOK.md` (Variables section) + `cue-pass-prompt.md` (Variables paragraph): when a cue is about a specific tool, set its logo slug (lowercase alphanumeric tool name); summary-table gets `productLogos` aligned with `products`; only slugs that exist may be used — the resolver rejects unknown ones. List the currently-seeded slugs in the prompt's rules text as examples.
- `PIPELINE.md` field-semantics: one bullet for the optional logo keys.

**Verify**: `node lib/check-rulebook.mjs` → `rulebook ok`

### Step 5: Tests

`lib/logos.test.mjs` (node:test; fixture: temp dir with a tiny 1x1 PNG + registry): enrichLogos inlines a data URI for `logo`, `productLogos`, and `beats[].logo`; missing slug lands in `missing` and not in `__logos`; variables without any refs pass through unchanged (no `__logos` key). Plus validateCues: cue with unknown logo slug → error; known slug → clean. Add `lib/logos.test.mjs` to `scripts/check.sh`'s test list.

**Verify**: `bash scripts/check.sh` → `graphics-flow check OK`

## Test plan

Unit tests cover enrichment + validation; lint + beat-smoke prove no-logo rendering is unchanged; the with-logo LOOK is verified by the verifier's render+inspect gate after landing (standing agy rider) — render `tool-intro` with `{"logo":"heygen","name":"HeyGen"}` and `persona-match` with per-beat logos, inspect frames.

## Done criteria

- [ ] `cd pipelines/video/graphics-flow && bash scripts/check.sh` exits 0
- [ ] `cd pipelines/video/card-library && bash scripts/beat-smoke.sh` exits 0
- [ ] `logos/registry.json` has the 5 seed tools (files present, or null + STOP note if offline)
- [ ] All 5 cards render identically to before when no logo variables are given
- [ ] `git diff --stat 545cfb8..HEAD` limited to in-scope files (+ plans/README.md row)

## STOP conditions

- Network unavailable for favicon fetches → seed registry with `file: null`, note it, continue (owner fetches later); do NOT vendor placeholder images or use another API.
- Any card's no-logo rendering changes in any way — the graceful-degradation requirement is absolute.
- Any new npm dependency, any external URL left inside card HTML or variables (data URIs only).
- `validateCues` signature change breaks existing tests in a way that needs more than mechanical caller updates — report.

## Maintenance notes

- New tool → `node scripts/fetch-logo.mjs <slug> <domain>` once; ugly favicon → replace the PNG, set `"source": "manual"`. The cue pass may then use the slug.
- The `__logos` key is board/render plumbing, never authored by the cue pass — if it ever appears in cues.json, something upstream leaked.
