---
executor: claude-p
model: sonnet
test_cmd: cd pipelines/video/card-library && bash scripts/beat-smoke.sh
ui:
deploy:
needs: []
---

# Plan 062: Beat contract + seed catalog retrofit (card-library)

## Summary

- **Problem statement**: Card-library cards hardcode their reveal timing (e.g. pros-cons staggers rows at fixed 0.12s intervals), so a card cannot sync its reveals to when a voiceover actually speaks each point. The new graphics flow (design: `docs/specs/2026-07-17-motion-graphics-beat-sync-design.md`) needs cards that take reveal timing as data.
- **Goals**:
  - Define the beat contract in the card-library README.
  - Retrofit 8 progressive-reveal cards to build their timeline from a `beats` variable.
  - Author `catalog.json` covering all 37 cards (the cue-pass model's menu).
  - Add `scripts/beat-smoke.sh` as the machine gate.
- **Executor proposed**: claude-p / sonnet (standard)
- **Done criteria** (terse): smoke script exit 0 — 8 cards lint, catalog validates, pros-cons renders with custom beats.
- **Stop conditions** (terse): a card's timeline can't be expressed as beats; lint fails on an UNCHANGED card; any write outside `pipelines/video/card-library/`.
- **Test / verification for success**: `bash scripts/beat-smoke.sh` (lint + catalog validation + one draft render with ffprobe duration check).
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 02f536f..HEAD -- pipelines/video/card-library/`
> (Only `RENDERS.md` churn elsewhere is expected in the repo; if card-library files already drifted, STOP.)

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `02f536f`, 2026-07-17

## Why this matters

The graphics flow generates per-video motion graphics whose internal reveals sync to the voiceover: each pro/con/bullet appears at the second the VO speaks it (word timestamps come from Whisper; a resolver computes per-beat offsets — plan 063). For that to work, cards must accept `beats: [{...item, at: <seconds>}]` and build their GSAP timeline from it, instead of hardcoding offsets. The card's visual design and motion style stay untouched — only the *when* becomes data. Duration is NOT handled by the card: the render loop (plan 063) rewrites the static `data-duration` attributes in a staged copy (verified 2026-07-17: a script-time attribute patch does NOT change render length; a static rewrite does — 270 frames at data-duration="9").

## Current state

- `pipelines/video/card-library/` — HyperFrames project: 37 cards in 11 category folders, each `<category>/<card>/index.html`. Root has `hyperframes.json`, `meta.json`, `package.json`, `serve.mjs` (gallery), `README.md`, `HYPERFRAMES.md`, `gallery-order.json`.
- Every card follows the same shape (read `pros-cons/pros-cons/index.html` first — it is the exemplar):
  - root div: `data-composition-id`, `data-start="0"`, `data-duration="6"`, `data-composition-variables='...'` (JSON defaults)
  - a `/* ===== CONTENT ===== */` script block reading `VARS` via `window.__hyperframes.getVariables()` into `const DATA = {...}` with `??` fallbacks
  - a `/* ===== TIMELINE (LOCKED) ===== */` block registering a paused GSAP timeline on `window.__timelines[id]`
- pros-cons current timeline (lines 82–88): title at 0.1, `.pros`/`.cons` columns at 0.4, rows staggered from 0.8/0.95 at 0.12 — these fixed numbers are what this plan replaces with beat data.
- README.md documents the CONTENT-vs-TIMELINE split and warns lint shows two expected warnings ("Studio can't drag-edit" + "Google Fonts") — those warnings are normal, lint still exits 0.
- `.npmrc` pins the public registry (global npm 401s otherwise). Always run npx from inside `pipelines/video/card-library/`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Lint a card | `cd pipelines/video/card-library && npx hyperframes@latest lint pros-cons/pros-cons` | exit 0 (2 known warnings OK) |
| Render a card | `npx hyperframes@latest render pros-cons/pros-cons --variables '<json>' -o /tmp-path/out.mp4 --fps 30 --quality draft --quiet` | exit 0, MP4 written |
| Clip duration | `ffprobe -v error -show_entries format=duration -of csv=p=0 <file>` | seconds, e.g. `6.000000` |

## Scope

**In scope** (only these paths):
- `pipelines/video/card-library/README.md` (add "Beat contract" section)
- `pipelines/video/card-library/catalog.json` (new)
- `pipelines/video/card-library/scripts/beat-smoke.sh` (new; create `scripts/`)
- These 8 card files:
  `pros-cons/pros-cons/index.html`, `checklist/checklist/index.html`, `section/bullet-points/index.html`, `section/key-takeaways/index.html`, `comparison/summary-table/index.html`, `comparison/feature-matrix/index.html`, `verdict/verdict-report-card/index.html`, `table-of-contents/table-of-contents/index.html`

**Out of scope**:
- The other 29 cards' index.html (they get catalog.json entries only — no code edits; they are "single" cards).
- `serve.mjs`, `hyperframes.json`, `meta.json`, `gallery-order.json` — the gallery must keep working unchanged.
- Anything under `flow/` (plans 063–065), the spec doc, other pipelines.

## Git workflow

- Branch: `advisor/062-beat-card-contract`
- Commit per step — messages like `feat(card-library): beat contract for pros-cons`. No AI footers. Do NOT push.

## Steps

### Step 1: Write the beat contract into README.md

Append a `## Beat contract (progressive-reveal cards)` section stating exactly:

1. A **beat card** accepts two extra variables: `beats` (array; item shape is card-specific and listed in `catalog.json` as `beat_shape`, always plus a required numeric `at` = seconds from card start) and nothing else new. Reveal timing comes ONLY from `beats[].at`.
2. The TIMELINE block builds reveals with `DATA.beats.forEach(...)` — no hardcoded per-item offsets. Entrance motion (easing, direction, duration of each reveal animation) stays fixed per card.
3. Defaults in `data-composition-variables` must encode the card's current 6s look, so the gallery preview and a variable-less render look exactly like today.
4. Card `data-duration` stays static in the file. Per-cue durations are applied by the flow's render step, which rewrites the attribute in a staged copy — cards must keep ALL their `data-duration` attributes at one identical value so a global rewrite is safe.
5. Single-shot cards (no progressive reveals) are exempt; they are `"kind": "single"` in catalog.json.

**Verify**: `grep -c "Beat contract" pipelines/video/card-library/README.md` -> `1`

### Step 2: Retrofit pros-cons (the exemplar retrofit — do it exactly like this)

Replace the CONTENT block's `DATA` and the row-building + timeline code with:

```js
/* ===== CONTENT ===== (editor / Gemini edits ONLY this) ===== */
const VARS = (window.__hyperframes && window.__hyperframes.getVariables ? window.__hyperframes.getVariables() : null) || {};
const DATA = {
  title: VARS.title ?? 'Hostinger',
  beats: VARS.beats ?? [
    { kind: 'pro', text: 'Cheapest n8n hosting',   at: 0.8 },
    { kind: 'pro', text: 'One-click install',      at: 0.92 },
    { kind: 'pro', text: 'Great support',          at: 1.04 },
    { kind: 'con', text: 'No EU-only region',      at: 0.95 },
    { kind: 'con', text: 'Scales slower than VPS', at: 1.07 },
  ],
};

/* ===== TIMELINE (LOCKED — do not edit) ===== */
const $ = (id) => document.getElementById(id);
$('title').textContent = DATA.title;
const rows = DATA.beats.map((b) => {
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `<span class="ic">${b.kind === 'pro' ? '✓' : '✕'}</span><span></span>`;
  row.lastElementChild.textContent = b.text;
  $(b.kind === 'pro' ? 'prosList' : 'consList').appendChild(row);
  return { b, row };
});
window.__timelines = window.__timelines || {};
const tl = gsap.timeline({ paused: true });
tl.from('#card .title', { opacity: 0, y: 24, duration: 0.6, ease: 'power3.out' }, 0.1);
const firstAt = (kind, fb) => { const xs = DATA.beats.filter((b) => b.kind === kind); return xs.length ? Math.max(0.3, Math.min(...xs.map((b) => b.at)) - 0.3) : fb; };
tl.from('.pros', { opacity: 0, x: -40, duration: 0.6, ease: 'power3.out' }, firstAt('pro', 0.4));
tl.from('.cons', { opacity: 0, x: 40, duration: 0.6, ease: 'power3.out' }, firstAt('con', 0.4));
rows.forEach(({ b, row }) => tl.from(row, { opacity: 0, y: 16, duration: 0.45, ease: 'power2.out' }, b.at));
window.__timelines['proscons'] = tl;
```

Notes that carry to every retrofit: reveal text goes in via `textContent` (never interpolated into innerHTML — beat text is arbitrary); each column/section container reveals 0.3s before its first beat; the default `beats` reproduce today's default look (title/rows timings above match the old stagger).
Also update `data-composition-variables` on the root div: replace the `pros`/`cons` arrays with a `beats` default equal to the DATA fallback above (keep `title`).

**Verify**: `cd pipelines/video/card-library && npx hyperframes@latest lint pros-cons/pros-cons` -> exit 0

### Step 3: Retrofit the remaining 7 cards

Same transformation per card, applying this fixed rule: **the card's existing repeated-item array in DATA becomes `beats`; each item keeps its existing fields exactly and gains `at`; the per-item timeline offsets/staggers are replaced by `b.at`; container/section reveals move to 0.3s before their first beat; defaults reproduce the current default look.** Cards and their beat item shape (record these in catalog.json step 4):

| Card | beat item shape (existing fields + `at`) |
|---|---|
| `checklist/checklist` | whatever its DATA items hold today (open the file; typically `{text}`) + `at` |
| `section/bullet-points` | existing item fields + `at` |
| `section/key-takeaways` | existing item fields + `at` |
| `comparison/summary-table` | existing row fields (e.g. `{cells: [...]}`) + `at` — one beat per table row |
| `comparison/feature-matrix` | existing row fields + `at` — one beat per matrix row |
| `verdict/verdict-report-card` | existing grade-row fields + `at` |
| `table-of-contents/table-of-contents` | existing chapter-row fields + `at` |

If a card's items render via innerHTML interpolation today, switch the text fields to `textContent` as in Step 2. Do not change CSS, markup structure, colors, or entrance animations.

**Verify**: `for c in checklist/checklist section/bullet-points section/key-takeaways comparison/summary-table comparison/feature-matrix verdict/verdict-report-card table-of-contents/table-of-contents; do npx hyperframes@latest lint $c || break; done` -> all exit 0

### Step 4: Author catalog.json (all 37 cards)

Create `pipelines/video/card-library/catalog.json`:

```json
{
  "cards": [
    {
      "slug": "pros-cons/pros-cons",
      "kind": "beat",
      "placement": "fullframe",
      "purpose": "two-column pros vs cons; each row reveals on its beat",
      "variables": { "title": "string" },
      "beat_shape": { "kind": "'pro' | 'con'", "text": "string" },
      "default_duration": 6
    }
  ]
}
```

One entry per card folder (all 37 from `find . -name index.html`). Rules: `kind` is `"beat"` for the 8 retrofitted cards, `"single"` otherwise; `placement` is `"overlay"` for every card under `overlay/` plus `like-subscribe` and `link-in-description`, `"fullframe"` otherwise; `variables` lists the card's non-beat variables with their JS types (read each card's `data-composition-variables`); `beat_shape` only on beat cards; `default_duration` = the card's root `data-duration` value; `purpose` is one concrete line (what it shows, not "a card").

**Verify**: `node -e "const c=require('./catalog.json');const n=c.cards.length;if(n!==37)throw n;console.log('ok',n)"` -> `ok 37`

### Step 5: Write scripts/beat-smoke.sh

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
BEAT_CARDS=$(node -e "require('./catalog.json').cards.filter(c=>c.kind==='beat').forEach(c=>console.log(c.slug))")
[ "$(echo "$BEAT_CARDS" | wc -l | tr -d ' ')" = "8" ]
node -e "
const fs=require('fs');const c=require('./catalog.json');
if(c.cards.length!==37)throw new Error('want 37 cards, got '+c.cards.length);
for(const card of c.cards){
  if(!fs.existsSync(card.slug+'/index.html'))throw new Error('missing dir: '+card.slug);
  if(!['beat','single'].includes(card.kind))throw new Error('bad kind: '+card.slug);
  if(!['fullframe','overlay'].includes(card.placement))throw new Error('bad placement: '+card.slug);
  if(card.kind==='beat'&&!card.beat_shape)throw new Error('beat card missing beat_shape: '+card.slug);
  if(typeof card.default_duration!=='number')throw new Error('bad default_duration: '+card.slug);
}
console.log('catalog ok');
"
for c in $BEAT_CARDS; do npx hyperframes@latest lint "$c"; done
TMP=$(mktemp -d)
npx hyperframes@latest render pros-cons/pros-cons \
  --variables '{"title":"Smoke","beats":[{"kind":"pro","text":"A","at":0.5},{"kind":"con","text":"B","at":2.5}]}' \
  -o "$TMP/smoke.mp4" --fps 30 --quality draft --quiet
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TMP/smoke.mp4")
node -e "if(Math.abs(parseFloat('$DUR')-6)>0.15)throw new Error('duration '+'$DUR')"
rm -rf "$TMP"
echo "beat-smoke OK"
```

`chmod +x scripts/beat-smoke.sh`.

**Verify**: `bash scripts/beat-smoke.sh` -> last line `beat-smoke OK`, exit 0

## Test plan

The smoke script is the test: catalog structural validation (37 entries, dirs exist, enums valid), lint on all 8 beat cards, and one real render with custom beats whose output duration ffprobe-checks at 6s ±0.15. No unit-test infra exists in card-library; do not add a test framework.

## Done criteria

- [ ] `bash scripts/beat-smoke.sh` exits 0 from `pipelines/video/card-library/`
- [ ] `git diff --stat 02f536f..HEAD` touches only the in-scope paths
- [ ] README.md has the Beat contract section with all 5 rules
- [ ] Each of the 8 retrofitted cards still lints and has `beats` defaults reproducing its old default content

## STOP conditions

- A card's existing timeline cannot be expressed as per-item beats (e.g. items animate interdependently) — report which card and why; do not force it. Ship the plan with 7 (adjust the `= "8"` check and note it in the commit).
- Lint fails on a card you did NOT edit (environment problem, not yours).
- A card has differing `data-duration` values across its clips (breaks contract rule 4) — report it rather than papering over.
- Any need to write outside `pipelines/video/card-library/`.

## Maintenance notes

- catalog.json is the cue-pass model's card menu (plan 064's prompt embeds it) and the resolver/render loop reads `default_duration`/`placement` (plan 063). Renaming a card folder now requires a catalog.json update — `beat-smoke.sh` catches drift.
- New cards authored later (novel-cue loop) must follow the README Beat contract section and add a catalog.json entry.
