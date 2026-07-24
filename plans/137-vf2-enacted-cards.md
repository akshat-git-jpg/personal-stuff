---
executor: agy
model:
test_cmd: cd pipelines/video/card-library && npm run check && cd ../visuals-flow-2 && bash scripts/check.sh
ui: true
deploy:
needs: [after 136-vf2-concept-doctrine]
---

# Plan 137: enacted-device card family (12 cards) + catalog metadata + bespoke flywheel

## Summary

- **Problem statement**: v1's 53 cards mostly REVEAL content (chips, tables, stat hits) — closer to labelling than to Loop Studio's "a picture that DOES the idea" (spec delta B). There is also no path from "no card fits" to a permanent new template — bespoke work evaporates instead of compounding.
- **Goals**: (1) 12 enacted-device cards + 1 overlay plate card in `card-library/enacted/` & `overlay/`, each with dark/light register variants, marker-word support, and 2 rotation variants; (2) catalog metadata additions (`register`, `marker`, `intent`, `anti_intent`, `variants`, `continuity`); (3) bespoke cue support in v2 + a promotion script that turns an approved bespoke composition into a library card (the flywheel).
- **Executor proposed**: agy (Gemini 3.1 Pro High) — owner directive 2026-07-24; visual output passes the render+inspect gate before landing (rules.md rider — the verifier renders and LOOKS, agy never self-certifies visuals).
- **Done criteria**: `npm run check` green in card-library (covers the 13 new cards + catalog), check.sh green in visuals-flow-2, every new card renders via hyperframes.
- **Stop conditions**: check-cards.sh rejects the metadata fields; any change to existing cards' behavior.
- **Test / verification for success**: card-library's own gate (`scripts/check-cards.sh` incl. catalog + card QA) + v2 unit tests for bespoke resolution; final verification renders 2 sample cards and inspects frames.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. Do NOT
> edit `plans/README.md`; report status in your run summary.
>
> **Drift check (run first)**: `git diff --stat 3bbaa6c..HEAD -- pipelines/video/card-library pipelines/video/visuals-flow-2`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: 134 (folder), 136 (register/marker cue fields exist; the metadata this plan adds is what makes E8/marker enforcement card-aware)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `3bbaa6c`, 2026-07-24

## Why this matters

Loop Studio's most visible quality driver is enactment: a database is a cylinder that fills, a race is bars that advance and stall — the graphic argues the clause without words. The owner's chosen architecture keeps templates (near-zero tokens) but wants Loop-Studio-grade devices IN the template library, with bespoke authoring as the escape hatch whose every use permanently grows the catalog (owner: "so many templates that over time we use templates only"). Reference doctrine mined from `~/.claude-personal/skills/loop-studio/` (proprietary — port ideas, never copy source).

## Current state

- Cards live in `pipelines/video/card-library/<family>/<name>/index.html` (Hyperframes HTML compositions). 53 cards, families: checklist, comparison, like-subscribe, link-in-description, overlay, process, prompt, pros-cons, section, slate, statement, table-of-contents, title, tool-icon, verdict.
- Machine contract: `catalog.json` — per card `slug`, `kind` (single|beat|word-sync), `placement` (fullframe|overlay), `purpose`, `variables` (object contracts with `type`/`role`/`required`/`example`), `beat_shape`, `max_beats`, `max_reveal_chars`, `default_duration`, `structural`. Example entry (first card):
  ```json
  { "slug": "prompt/prompt-typing", "kind": "single", "placement": "fullframe",
    "purpose": "a 'Prompt' panel that types its text out over the clip; ...",
    "variables": { "title": {"required": true, "type": "string", "role": "heading", "example": "Section Title"},
                   "prompt": {"required": true, "type": "string", "role": "sentence", "example": "This is an example sentence."} },
    "default_duration": 12 }
  ```
- Visual contract: `card-library/DESIGN.md` — palette tokens `--bg-from #3a1f08`, `--bg-to #0a0805`, `--text #fff`, `--text-dim rgba(255,239,219,.55-.65)`, `--accent #fb923c` (THE accent), positive `#34d399`, negative `#fb7185`, gold `#facc15`. "Dark warm background always; one orange accent." Reference cards to imitate: `pros-cons/pros-cons/index.html`, `verdict/verdict-report-card/index.html`.
- Beat contract (`card-library/README.md` §"Beat contract"): beat cards take `beats` (item shape per catalog `beat_shape` + required numeric `at` = seconds from card start); TIMELINE builds reveals with `DATA.beats.forEach(...)`; defaults in `data-composition-variables` must encode the 6s gallery look; ALL `data-duration` attributes keep one identical value (the flow rewrites it in a staged copy).
- Gates: `cd card-library && npm run check` (= `bash scripts/check-cards.sh`: catalog validation, logos, card QA); `npm run lint` / `npm run render` = hyperframes CLI.
- v2 side: `lib/resolve.mjs#validateCues` validates against catalog; `lib/render.mjs` stages a card dir, rewrites duration, writes `vars.json`, renders via `npx hyperframes@0.7.62 render`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Card gate | `cd pipelines/video/card-library && npm run check` | exit 0 |
| Render one card | `cd pipelines/video/card-library && npx --yes hyperframes@0.7.62 render enacted/fill-gauge/index.html /tmp/fill-gauge.mp4` | mp4 produced |
| v2 gate | `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` | exit 0 |

## Scope

**In scope**:
- `pipelines/video/card-library/enacted/*` (12 new card folders), `pipelines/video/card-library/overlay/label-plate/` (new)
- `pipelines/video/card-library/catalog.json` (13 new entries + metadata fields), `card-library/DESIGN.md` (new "Enacted device rules" section), `card-library/README.md` (metadata field docs), `card-library/scripts/check-catalog.mjs` (accept+validate new fields)
- `pipelines/video/visuals-flow-2/`: `lib/resolve.mjs` (+test) bespoke support, `lib/render.mjs` (+test) bespoke staging, `scripts/promote-bespoke.mjs` (new) + test, `steps/020-cue-pass-llm/cue-pass-prompt.md` (bespoke + intent/anti-intent selection rules), `PIPELINE.md` (bespoke cue schema)

**Out of scope**:
- Existing 53 cards' HTML/behavior (metadata-only catalog additions are allowed ONLY for the new fields' absence — do not add fields to old entries in this plan)
- v1 pipeline; variant ROTATION logic (plan 138); board display (140)

## Git workflow

- Branch: `advisor/137-vf2-enacted-cards`. Commit per card-group + per v2 step. Do NOT push.

## Steps

### Step 1: catalog metadata fields + validator

Extend `card-library/scripts/check-catalog.mjs` to accept and validate OPTIONAL per-card fields (error on wrong types/values, absence fine):
- `register`: array subset of `["dark","light"]` — which register skins the card implements (CSS class `register-dark`/`register-light` on `<body>`, driven by variable `register`).
- `marker`: boolean — card renders `variables.marker` (a single word, must appear verbatim inside its main text variable) with the accent sweep treatment.
- `intent`: string — one line, when to PICK this card.
- `anti_intent`: string — one line, when NOT to (the wrong-pick guard the cue pass reads).
- `variants`: array of strings (e.g. `["a","b"]`) — visual variants selectable via variable `variant`.
- `continuity`: boolean — card reserves a bottom-left 220×80px zone where the through-line motif element may persist (documented layout contract, no rendering requirement in this plan).

Document all six in `card-library/README.md` beside the beat contract.

**Verify**: `cd pipelines/video/card-library && npm run check-catalog` → exit 0 (existing entries unaffected).

### Step 2: the 12 enacted cards + 1 overlay plate

Build each under `card-library/enacted/<name>/index.html`, following DESIGN.md palette + typography and the beat contract; every text-bearing card implements `marker` (accent sweep on the word); every card implements `register` (dark default = problem styling; light = solution styling: background gradient origin shifts to a deep teal-free WARM CREAM zone — implement light register as `--bg-from:#2b2416; --bg-to:#0a0805` with `--text` unchanged, so the family stays one system) and `variant` (`a` default, `b` = alternate entrance direction + mirrored layout). Catalog entries carry kind/placement/purpose/variables/beat_shape/max_beats/default_duration + the Step-1 metadata (write `intent`/`anti_intent` for each — one line each, derived from the device descriptions below).

1. `fill-gauge` — beat, fullframe. A labeled vessel fills stepwise; each beat adds a measured pour + label chip; dark register drains instead. Vars: `title` (heading), `unit` (label, optional). beat_shape: `{ label: string/label, value: string/value }`. max_beats 6.
2. `race-bars` — beat, fullframe. Products race as horizontal bars; each beat advances all bars to given values; a stalled bar visibly judders and stops. Vars: `title`, `products` (array of `{name, logo?}`). beat_shape: `{ values: array }` (1:1 with products — the resolver already cross-checks `values.length === products.length`). max_beats 5.
3. `counter-tally` — beat, fullframe. One huge number rolls to each beat's value; a tick strip accumulates marks underneath. Vars: `title`, `suffix` (label, optional). beat_shape: `{ value: string/value, note: string/label optional }`. max_beats 6.
4. `pipeline-flow` — beat, fullframe. A node chain (from `steps` array) with a pulse that travels; each beat lights the named step. Vars: `title`, `steps` (array of strings, 3–6). beat_shape: `{ step: string/label }`. max_beats 6.
5. `before-after` — single, fullframe. Split panel; an accent slider sweeps left→right revealing AFTER over BEFORE. Vars: `title`, `before_label`, `after_label` (labels), `before_lines`/`after_lines` (arrays of ≤3 short strings). default_duration 8.
6. `stack-builder` — beat, fullframe. Blocks drop and stack into a column; dark register: the stack collapses on the final beat if variable `collapse: true`. Vars: `title`. beat_shape: `{ label: string/label }`. max_beats 6.
7. `connect-nodes` — beat, fullframe. Each beat adds a labeled node and draws an accent edge to the previous one, growing a graph. Vars: `title`. beat_shape: `{ label: string/label }`. max_beats 6.
8. `spotlight-focus` — single, fullframe. A dimmed grid of items; a spotlight sweeps then locks on `focus`, others fall to 25% opacity. Vars: `title`, `items` (array 4–8 strings), `focus` (string, must equal one item). default_duration 7.
9. `timeline-scrub` — beat, fullframe. A horizontal timeline; the playhead jumps to each beat's marker, stamping a label above it. Vars: `title`. beat_shape: `{ label: string/label }`. max_beats 6 (markers spread evenly).
10. `verdict-scale` — beat, fullframe. A balance scale; each beat drops a weight chip on `side` and the beam tips accordingly; final tilt = the verdict. Vars: `title`, `left_label`, `right_label`. beat_shape: `{ side: enum left|right, label: string/label }`. max_beats 6.
11. `price-meter` — beat, fullframe. An odometer-style money readout rises as cost chips slide in; dark register colors the total negative-rose past a `warn_at` value (variable, optional). Vars: `title`, `currency` (label, default "$"). beat_shape: `{ label: string/label, amount: string/value }`. max_beats 5.
12. `terminal-enact` — single, fullframe. A zsh-style window slides in and TYPES `command` with a blinking caret, then prints `output`. Vars: `title` (optional mono eyebrow), `command` (string, rendered verbatim), `output` (string, optional). default_duration 10. (This is the "show the real thing" device — the command must be real, never pseudo-code; put that sentence in its catalog `purpose`.)
13. `overlay/label-plate` — single, OVERLAY (transparent). A mono-type plate that snaps in and holds: `text` (label ≤5 words), `position` enum `top-left|top-center|bottom-left` (default top-left). Sized for compositing over footage; background a translucent dark plate with 1px accent keyline. default_duration 5.

Rules for all: one accent element per frame; `data-composition-variables` defaults produce a complete-looking 6s gallery preview; uniform `data-duration`; no external network fetches inside cards (fonts/assets inline or already-local like the rest of the library — copy whatever font strategy `pros-cons/pros-cons/index.html` uses).

**Verify** (after each card): `cd pipelines/video/card-library && npm run lint -- enacted/<name>/index.html` clean; after all: `npm run check` → exit 0. Render two samples (`fill-gauge`, `terminal-enact`) with the render command from the table and confirm the mp4s exist and are >0 bytes.

### Step 3: DESIGN.md enacted rules

Append a short "Enacted device rules" section to `card-library/DESIGN.md`: enact-don't-label definition + the mute test ("with audio muted and captions hidden, the moving object alone must communicate the idea"); registers dark=problem/light=solution with the exact light-register token values from Step 2; single marker word; real values/logos/commands, never lorem or pseudo-code.

**Verify**: `grep -n "Enacted device rules" pipelines/video/card-library/DESIGN.md` → present.

### Step 4: bespoke cue support in v2

Contract (add to v2 `PIPELINE.md` cues.json schema): a cue may set `"card": "bespoke"`, plus required `"bespoke": "<dirname>"` (a Hyperframes composition at `videos/<slug>/bespoke/<dirname>/index.html`), required `"placement": "fullframe"|"overlay"`, and beats as normal (beat timing still resolves from anchors; the bespoke composition must read `beats[].at` like a library beat card).

- `lib/resolve.mjs#validateCues` + `resolveCues`: when `cue.card === 'bespoke'`, skip catalog lookup; require `bespoke` + `placement`; error if the composition dir/index.html is missing (validateCues receives the workdir — extend its signature with an optional `workdir` arg; existing callers pass it in `main()`).
- `lib/render.mjs`: stage the bespoke dir instead of a card-library dir when `cue.card === 'bespoke'` (same duration rewrite + vars.json flow).
- `steps/020-cue-pass-llm/cue-pass-prompt.md`: replace the "flagged: true = no card fits" guidance with: still set `flagged: true` first; the SESSION then authors the bespoke composition under DESIGN.md + the enacted rules and re-runs resolve — bespoke is a deliberate escalation, never the model's first move. Choosing between cards: read each candidate's `intent` / `anti_intent` lines; an anti_intent match is a hard veto.

Tests: `lib/resolve.test.mjs` — bespoke cue with existing dir resolves; missing dir errors; missing placement errors. `lib/render.test.mjs` — staging picks the bespoke path (assert on the staged plan/paths, no real render).

**Verify**: `node --test lib/resolve.test.mjs lib/render.test.mjs` → pass.

### Step 5: the promotion script (flywheel)

New `pipelines/video/visuals-flow-2/scripts/promote-bespoke.mjs`:
`node scripts/promote-bespoke.mjs <slug-or-path> <bespoke-dirname> <family/card-name>` —
1. copies `videos/<slug>/bespoke/<dirname>/` → `../card-library/<family/card-name>/` (refuse if target exists);
2. prints a catalog.json entry STUB (slug, kind guessed from beats usage, placement, empty purpose/intent/anti_intent to fill) to stdout;
3. prints next steps: add the entry to catalog.json, run `npm run check`, commit + push in card-library (a card is only real once pushed — card-library/CLAUDE.md rule).
It never edits catalog.json itself (the human-judgment fields must be written deliberately).

Test `scripts/promote-bespoke.test.mjs` (register in check.sh): tmpdir fixture — copies, refuses existing target, stub contains the slug.

**Verify**: `node --test scripts/promote-bespoke.test.mjs` → pass.

### Step 6: full gates

**Verify**: `cd pipelines/video/card-library && npm run check && cd ../visuals-flow-2 && bash scripts/check.sh` → exit 0 (this is the merge test_cmd; it must pass in BOTH directories the plan writes to).

## Test plan

card-library's own gate covers catalog + card QA for the 13 new cards; hyperframes lint per card; two sample renders inspected by the verifier (render+inspect gate). v2 unit tests cover bespoke resolution/staging and the promote script. No test reads committed `videos/` data.

## Done criteria

- [ ] `cd pipelines/video/card-library && npm run check` → exit 0
- [ ] `ls pipelines/video/card-library/enacted | wc -l` → 12; `ls pipelines/video/card-library/overlay/label-plate` → index.html present
- [ ] `python3 -c "import json;c=json.load(open('pipelines/video/card-library/catalog.json'));e=[x for x in c['cards'] if x['slug'].startswith('enacted/')];assert len(e)==12 and all('intent' in x and 'anti_intent' in x for x in e);print('ok')"` → ok
- [ ] Two sample renders exist and open (verifier inspects frames)
- [ ] `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` → exit 0

## STOP conditions

- `check-cards.sh` or `check-catalog.mjs` rejects the new metadata fields in a way Step 1 can't extend without changing existing entries' validation.
- A new card can only pass hyperframes lint by violating the beat contract or DESIGN.md palette.
- Any edit to an existing card's index.html.

## Maintenance notes

- Plan 138 adds variant ROTATION (resolver picks `variant` by use-count) and brand-token injection — cards must keep reading palette via `:root` vars for that to work.
- Promoted bespoke cards go through the same publish-check/push gate as any card (render2.agrolloo.com gallery syncs from pushed main).
- The `continuity` zone contract is consumed when the persistent-motif lane lands (board/assemble follow-up); keep the reserved zone empty of card content.
