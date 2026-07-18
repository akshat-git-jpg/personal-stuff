---
executor: claude-p
model: sonnet
test_cmd: bash pipelines/video/graphics-flow/scripts/check.sh
ui: true
deploy:
needs: ["after 073 (board.mjs chain complete)"]
---

# Plan 074: Zero-token visual QC — DOM overflow probe on board tiles + /calibrate capacity page

## Summary

- **Problem statement**: Nothing looks at rendered card visuals except humans (HANDOFF open item 4 — vision-model QC was rejected on cost), and the catalog's `max_beats`/`max_reveal_chars` are uncalibrated layout-math estimates (open item 5). But the board already runs every card in a real browser — layout breakage is measurable from the DOM for free.
- **Goals**: every board tile auto-probes its card for layout overflow at each beat time and badges red on breakage; a `/calibrate` route renders every beat card filled to its declared caps so the owner can verify/fix `max_beats`/`max_reveal_chars` on one page. Zero tokens, zero new dependencies.
- **Executor proposed**: claude-p sonnet (tricky — cross-frame probing and generic variable synthesis need judgment).
- **Done criteria** (terse): overflow badge appears for a deliberately overflowing cue and not for test-01's clean cues; `/calibrate` shows all 11 beat cards at capacity; tests + screenshots.
- **Stop conditions** (terse): cards whose layout makes DOM-rect probing meaningless; calibrate synthesis impossible for a card even with a per-card override.
- **Test / verification for success**: board tests for the probe wiring + manual screenshots (clean board, forced overflow, /calibrate).
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8e48c2f..HEAD -- pipelines/video/graphics-flow/lib/board.mjs pipelines/video/graphics-flow/lib/board.test.mjs`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (probe heuristics can false-positive; mitigated by tolerance + test-01 clean gate)
- **Depends on**: 073 (same file)
- **Category**: feature (quality infrastructure)
- **Difficulty**: tricky
- **Planned at**: commit `8e48c2f`, 2026-07-18

## Why this matters

The owner rejected vision-model QC on cost, so today visual breakage
(overflowing text, clipped rows) is caught only at owner review — or worse, by
the editor after render. Meanwhile the flow's own board (step 040) loads the
REAL card HTML in an iframe per cue, driven by a GSAP timeline. A DOM can
report its own overflow deterministically: any element whose bounding rect
exceeds the 1920×1080 canvas is broken, no vision model needed.

The same probe solves capacity calibration: `catalog.json` declares
`max_beats` and `max_reveal_chars` per beat card (11 cards), but HANDOFF
records they are "layout-math estimates, not yet visually calibrated"
(DESIGN.md's new-card checklist demands honest measurement). A page that
renders every beat card AT its declared caps makes calibration a one-look job,
and any future catalog/card change re-verifiable instantly.

## Current state

- `pipelines/video/graphics-flow/lib/board.mjs`:
  - `injectShim(html, variables)` (lines 25-42) injects `window.__hyperframes.getVariables`
    and a message listener that seeks the card's paused GSAP timeline
    (`tls[0].time(Math.min(e.data.t, tl.duration()))`) — this is where the
    probe reporter goes.
  - `serveCard(res, workdir, cardLibraryRoot, id)` (lines 447-460) serves
    `card-library/<card>/index.html` through `injectShim` with logo-enriched variables.
  - Tiles: `.preview` divs contain a 1920×1080 iframe scaled to 0.25
    (`transform:scale(0.25)`), one per resolved cue; audio drives seeks via
    `iframe.contentWindow.postMessage({ t }, '*')`.
  - Resolved beat times are available server-side: resolved entries carry
    `variables.beats[].at` (seconds from card start) and `duration`.
- Cards: 1920×1080 canvas, content inside `#frame` with ~120px padding
  (`card-library/DESIGN.md` Layout). Cards may legitimately use `overflow: hidden`
  — bounding-rect sweeps still detect content extending past the canvas.
- Catalog: `card-library/catalog.json` — beat cards carry `slug`, `kind: "beat"`,
  `variables` (descriptor strings, e.g. `"title": "string"`, arrays described in
  prose), `beat_shape` (e.g. `{ "kind": "pro|con", "text": "string" }`),
  `max_beats`, `max_reveal_chars`, `default_duration`.
- `lib/board.test.mjs` — server tests fetch pages and assert on HTML; no
  headless browser in the test suite (probe runtime behavior is verified
  manually — that's the ui gate).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Flow gate | `bash pipelines/video/graphics-flow/scripts/check.sh` | exit 0 |
| Manual board | `cd pipelines/video/graphics-flow && node lib/board.mjs test-01` | tiles probe on load; no red overflow badges on test-01 |
| Calibrate page | open `http://127.0.0.1:4322/calibrate` | one tile per beat card at declared caps |

## Scope

**In scope**:
- `lib/board.mjs`: probe in `injectShim`, badge wiring in the page script,
  `data-probe-times` on tiles, `/calibrate` route + synthesis helper.
- `lib/board.test.mjs`: tests for what's assertable server-side (probe script
  present in served card HTML; `/calibrate` lists every beat card; synthesis
  respects caps).
- `steps/040-storyboard-review-owner/README.md` + `HANDOFF.md` open-items 4/5
  cross-off note (one line each).

**Out of scope**:
- Rendering frames or any vision-model anything.
- Changing catalog cap VALUES (the owner does that using this tool).
- Card HTML edits (if a card is unmeasurable, report — don't patch cards here).

## Git workflow

- Branch: `advisor/074-graphics-overflow-qc`
- Commit: `feat(graphics-flow): DOM overflow probe on board tiles + /calibrate capacity page` — no AI footers. Do NOT push.

## Steps

### Step 1: Probe inside the shim

Extend `injectShim`'s injected script with a measurement function and a new
message type:

```js
function __measureOverflow() {
  const W = 1920, H = 1080, TOL = 2;
  const offenders = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > W + TOL || r.bottom > H + TOL || r.left < -TOL || r.top < -TOL) {
      offenders.push((el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : '')));
      if (offenders.length >= 5) break;
    }
  }
  const doc = document.documentElement;
  const scrolled = doc.scrollWidth > W + TOL || doc.scrollHeight > H + TOL;
  return { broken: offenders.length > 0 || scrolled, offenders };
}
```

Handle `{ probe: [t1, t2, ...] }` messages: for each t, seek the timeline
(same code path as the existing seek handler), then measure, then
`parent.postMessage({ __overflow: { t, ...__measureOverflow() } }, '*')` for
any broken t (and one final `{ __overflowDone: true }`). GSAP's `tl.time(t)`
applies styles synchronously, so measuring right after the seek is valid;
still wrap each step in `requestAnimationFrame` to let layout settle.

**Verify**: server test — GET `/card/c01` body contains `__measureOverflow` and the probe handler.

### Step 2: Tiles auto-probe and badge

- Server: on each cue tile, add `data-probe-times` = JSON array of
  `[...beats.map(b => b.at + 0.6), duration - 0.1]` (clamped to ≥0), from the
  resolved entry.
- Client: on iframe `load`, post `{ probe: times }`. A window-level `message`
  listener maps `event.source` back to its tile's iframe and, on a broken
  report, adds a badge to the tile header:
  `<span class="overflow-badge">OVERFLOW @ 12.4s (#frame .row)</span>` —
  red, monospace, small; CSS in `BOARD_CSS`. Multiple broken times collapse
  into one badge listing the times. All strings inserted via `textContent`
  (never innerHTML) since offender selectors derive from card DOM.

**Verify**: manual — `node lib/board.mjs test-01`; wait for tiles to load; expect ZERO overflow badges (test-01 v2 was visually reviewed). Then hand-edit one cue's fragment to exceed its card's `max_reveal_chars` by ~3× (don't Save — no; Save would fail validation. Instead temporarily bump a reveal text in cues.json to a very long string, re-run resolve with validation bypass impossible — so instead: craft a temp COPY of the fixture workdir with a long reveal and a loosened catalog copy is overkill. Simplest forced-positive: temporarily set TOL to -2000 in the shim, reload, observe every tile badge — proving the wiring end to end — then restore TOL). Screenshot both states for the PR.

### Step 3: `/calibrate` route

- `synthCalibrationVars(card)`: builds variables + beats for a beat card at
  its caps. Beats: `max_beats` items; each `beat_shape` string field gets
  filler text of exactly `max_reveal_chars` chars built from 6-char words
  (`"Mmmmmm Mmmmmm …"` — wide glyphs = conservative); enum-ish descriptors
  (e.g. `"pro|con"`) cycle their options; numeric fields get `88`; `at` spaced
  evenly across `default_duration`. Variables: string → `"Calibration title"`,
  descriptors containing `array` → a 3-item filler array matching the shape
  the descriptor spells out. Keep a small per-card override map
  (`CALIBRATE_OVERRIDES[slug]`) for any card whose descriptors don't
  synthesize cleanly — populate it as needed and note which cards needed it.
- Route `GET /calibrate`: reads the catalog, renders a page reusing the tile
  CSS: one tile per `kind === 'beat'` card — header
  `<slug> · max_beats=<n> · max_reveal_chars=<n>`, iframe via a
  `GET /calibrate-card/<slug>` sibling route (serves the card through
  `injectShim` with the synthesized variables), probe times = each beat's
  `at + 0.6` plus the end. Tiles badge exactly like Step 2. No audio, no
  save — a read-only inspection page.
- Link it from the board header (`<a href="/calibrate">calibrate</a>`, dim).

**Verify**: server test — `/calibrate` HTML contains one tile per beat card in
the catalog (count them dynamically from catalog.json; currently 11) and each
`/calibrate-card/<slug>` responds 200 with `getVariables` present. Manual —
open the page, screenshot; any red badges are FINDINGS about the catalog caps
(report them in the PR description; do not change the caps yourself).

### Step 4: Docs

- `steps/040-storyboard-review-owner/README.md`: one paragraph — tiles
  self-check for layout overflow at each beat; red badge = the card broke at
  that second; `/calibrate` renders every beat card at its declared caps.
- `HANDOFF.md`: update open items 4 and 5 to point at this mechanism (one line
  each; don't rewrite the doc).

**Verify**: `bash pipelines/video/graphics-flow/scripts/check.sh` -> exit 0.

## Test plan

Server-level tests (shim content, calibrate page coverage, synthesis caps);
manual runtime verification with three PR screenshots: clean test-01 board,
forced-positive badge (TOL trick), and the /calibrate page. The forced
positive proves the full postMessage wiring, which server tests can't reach.

## Done criteria

- [ ] test-01 board shows zero overflow badges; forced positive shows badges on every tile.
- [ ] `/calibrate` renders all beat cards at declared caps with live probes; findings (if any) listed in the PR description.
- [ ] Probe reports include the broken time and up to 5 offender selectors.
- [ ] Server tests for shim + calibrate coverage pass; `scripts/check.sh` exits 0.
- [ ] Three screenshots attached (ui gate).

## STOP conditions

- A card's layout defeats rect-based probing (e.g. intentional off-canvas
  decorative elements produce permanent false positives) — stop and report the
  card list; a per-card ignore list is an owner decision.
- `synthCalibrationVars` cannot fill a card even with a per-card override
  because its catalog descriptors are ambiguous — stop and report that card's
  slug and descriptor; fixing catalog prose is 060's jurisdiction.

## Maintenance notes

- New beat cards automatically appear on `/calibrate` (it reads the catalog) —
  DESIGN.md's "measure honestly" checklist item now has a tool; card authors
  should open `/calibrate` after adding a card.
- If probes ever get flaky with future GSAP versions, the seek-then-measure
  contract in the shim is the only coupling point.
