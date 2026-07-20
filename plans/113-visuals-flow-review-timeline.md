<!-- boss frontmatter -->
---
executor: claude-p
model: sonnet
test_cmd: bash pipelines/video/visuals-flow/scripts/check.sh
ui:                      # blank — the ui:true screenshot gate was removed 2026-07-18 (decisions.md); visual check is a local owner eyeball (see "Visual acceptance rubric")
deploy:                  # none — local dev/review tool
needs: []
---

# Plan 113: visuals-flow review board — horizontal timeline overview view

## Summary

- **Problem statement**: The step-040 review board (`localhost:4322`, `lib/board.mjs`) shows the whole video only as three thin (18–28px) minimap strips, then a long vertical scroll of dense cue/shot/effect blocks. The owner finds it cluttered and hard to review fast — you can't *see* the video, and graphics / avatar / effects don't line up against each other on a shared time axis.
- **Goals**:
  - Add a **horizontal, editor-style timeline view** as the board's new default landing (`/`): one shared time ruler, stacked tracks (SCREEN, GRAPHICS, AVATAR, EFFECTS), every item a proportionally-sized block placed at its real start time so the lanes visually align.
  - **On-demand previews**: nothing heavy renders until you click a block; clicking opens that block's existing detail (live card iframe + VO scrub + feedback/edit) in a docked side panel. This makes the page *lighter* than today, not heavier.
  - Keep today's vertical detail board intact at `/list`, one click away via a header toggle. No pipeline/schema/token-cost changes — this is pure review UI over data the server already loads.
  - Free win: a master VO playhead that sweeps across all tracks delivers the owner-deferred **GFX-08** (global play-through).
- **Executor proposed**: `claude-p` / Claude Sonnet (visual/taste-sensitive UI, fully inlined here but not mechanical).
- **Done criteria** (terse — full list below): `bash pipelines/video/visuals-flow/scripts/check.sh` exits 0; `GET /` returns the timeline (all four lanes + cue ids + toggle to `/list`); `GET /list` unchanged (cue ids + Approve graphics); timeline store uses `data-src` not eager `src` for card iframes.
- **Stop conditions** (terse — full list below): a test would need to render or mutate `videos/test-01/*` (forbidden — use the temp fixture); the shared block HTML would have to diverge between the two views; approve/save/feedback semantics change.
- **Test / verification for success**: unit tests in `lib/board.test.mjs` against a temp fixture workdir (existing `makeWorkdir()` pattern) + `check.sh`; plus a local owner eyeball against the Visual acceptance rubric.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat db921ea..HEAD -- pipelines/video/visuals-flow/lib/board.mjs pipelines/video/visuals-flow/lib/board.test.mjs pipelines/video/visuals-flow/PIPELINE.md`

## Status

- **Priority**: P2
- **Effort**: M
- **Depends on**: none (independent of the TODO plan 105)
- **Risk**: MED (large single-file UI change; the mitigations below keep the two views sharing one block-render path and keep `/list` byte-identical)
- **Category**: feature (dx / review ergonomics)
- **Difficulty**: standard (visual, but every decision is pinned here; critical snippets inlined)
- **Planned at**: commit `db921ea`, 2026-07-21

## Why this matters

The board is where the owner does the two review sittings per video (graphics + shots) and eyeballs effects. Review speed and comprehension directly gate throughput on the whole video pipeline. Today the "whole video at a glance" is only the top minimap strips, which are too abstract to build a mental model from, and the real review is a long vertical scroll where graphics, avatar spans, and effects are interleaved by time but never shown *aligned* — so you can't see, e.g., that an effect fires right as an avatar span starts. A horizontal multi-track timeline is the mental model humans already have for "a video," and on-demand previews remove the per-cue iframe weight that makes the current page busy and slow. This is additive: the vertical list stays for bulk JSON editing, which it is genuinely better at.

**Load-bearing house rules (do NOT re-litigate — from `decisions.md`):**
- **2026-07-18** — the boss `ui:true` screenshot gate was **removed**; there is no screenshot merge gate. Visual correctness is verified by a local owner eyeball (`node lib/board.mjs test-01` → open `/`) against the rubric at the end of this plan. Do not add a screenshot step.
- **2026-07-20** — **unit suites must never render or touch committed per-video data**, and `scripts/check.sh`'s explicit `node --test` list is the only test-registration point. New tests MUST use the existing temp-fixture `makeWorkdir()` helper (copies `lib/fixtures/board/*` into `.test-tmp/`), MUST NOT read/write `videos/test-01/*`, and MUST NOT spawn any render/assemble. `lib/board.test.mjs` is already in `check.sh`'s list — do not add a new test file.
- **2026-07-20 (GFX-08)** — global play-through is owner-deferred with "same `buildSegments` seam; 104's master player is its seam." This plan implements it via the master `<audio>` playhead. Keep it simple (a moving line + click-to-seek); no per-effect ffmpeg preview.

## Current state

All paths below are under `pipelines/video/visuals-flow/`.

### `lib/board.mjs` (1321 lines) — the single file this plan touches (plus its test)

Relevant structure (verified at `db921ea`):

- `const BOARD_CSS = \`…\`` (lines 171–261): all board styles. Defines the palette CSS vars used for lanes: `--accent` #fb923c (fullframe card), `--overlay-seg` #38bdf8 (overlay card), `--shot` #a78bfa (avatar span), `--err` #ff6b6b (flagged), `--ok` #34d399 (beat fx), `--line` (screen/base). Already has `.minimap*`, `.lane-row`, `.lane-label`, `.fx-marker`, `.fx-span` classes.
- `const OVERFLOW_BADGE_JS = \`…\`` (from line 266): client script with `wireProbe(tile)` that posts probe times into each tile's iframe and turns overflow reports into a header badge. Currently invoked page-wide on load.
- `const FX_SIM_HELPERS` / `FX_SIM` (lines 307–325): CSS-sim helpers for the effects timing preview (used by the list view's `#fxStage`). Leave on the list view; the timeline does not need them.
- `export function buildSegments(words, resolved, {gapMinWords=8})` (line 336): returns ordered segments `{kind:'cue'|'gap', cue?, start, end, words}`. **Reuse this** for the graphics lane — already unit-tested.
- `function renderBoardPage(cuesFile, resolved, words, feedbackItems={}, shots=null, effects=null)` (lines 405–826): builds the entire current page. Inside it:
  - The three minimap lanes (graphics/avatar/effects) — lines ~448–481, 433–440.
  - The per-block detail HTML: cue tiles + gap blocks built in `timelineBlocks = segments.map(...)` (lines 484–562); shot blocks spliced in (lines 564–581). **This block HTML is what the timeline's detail panel must reuse — extract it (Step 1).**
  - The sticky header with the topbar (Approve graphics / Approve shots / Approve effects / Save / calibrate link) — lines 593–603.
  - A `<audio id="master" src="/vo.mp3">` that is rendered **only when** `fxInstances.length` (line 629). The timeline needs this player **always**.
- The block view-model the timeline needs is already computed at the top of `renderBoardPage`: `segments` (graphics), `shots.spans` (avatar), and `fxInstances` split into `fxPoint` (whip/beat, has `.at`), `fxSpan` (drift, has `.start`/`.end`), `fxGlobal` (captions/bubble) — lines 425–431.
- `async function handleRequest(req, res, workdir, cardLibraryRoot)` (line 1160): the router. The `/` handler (lines **1176–1187**) loads `cuesFile`, `resolved`, `words`, `feedbackItems`, `shots`, `effects` and returns `renderBoardPage(...)`. `/card/:id` (1189–1192) serves a single card iframe; `/slice/:id.mp3` (1207–1210); `/vo.mp3` (1228–1237); POST `/save`,`/approve`,`/approve-shots`,`/approve-effects`. `createServer(workdir)` (1243) resolves `cardLibraryRoot`.

### `lib/board.test.mjs` — test conventions to match exactly

- `makeWorkdir(withEffects=false)` (lines 23–32): `fs.mkdtempSync` under `.test-tmp/board/`, copies `cues.json`/`resolved.json`/`transcript.json`/`vo.mp3` (+`effects.json`) from `lib/fixtures/board/`. **This is the ONLY workdir tests may use.**
- `startServer(workdir)` (34–39): `createServer` + `server.listen(0)` + returns `{server, base}`.
- Existing test `GET / lists every cue id and an Approve button` (lines 48–60): fetches `/`, asserts `/c01/`, `/c02/`, `/>Approve graphics</`. Fixture has cues `c01`, `c02`.

### The current `/` route code (board.mjs:1176–1187) — you will edit this

```js
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index')) {
    const cuesFile = JSON.parse(fs.readFileSync(path.join(workdir, 'cues.json'), 'utf8'));
    const { resolved } = JSON.parse(fs.readFileSync(path.join(workdir, 'resolved.json'), 'utf8'));
    const words = JSON.parse(fs.readFileSync(path.join(workdir, 'transcript.json'), 'utf8'));
    const fbPath = path.join(workdir, 'feedback.json');
    const feedbackItems = fs.existsSync(fbPath) ? normalizeFeedbackItems(JSON.parse(fs.readFileSync(fbPath, 'utf8')).items) : {};
    const shots = loadShots(workdir, words);
    const effects = loadEffects(workdir);
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    return res.end(renderBoardPage(cuesFile, resolved, words, feedbackItems, shots, effects));
  }
```

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full flow test gate (merge gate) | `bash pipelines/video/visuals-flow/scripts/check.sh` | prints `visuals-flow check OK`, exit 0 |
| Board tests only (fast loop) | `cd pipelines/video/visuals-flow && node --test lib/board.test.mjs` | all pass, exit 0 |
| Local visual eyeball (owner) | `cd pipelines/video/visuals-flow && node lib/board.mjs test-01` then open the printed `http://127.0.0.1:<port>/` | timeline renders; `/list` toggle works |
| Drift check | `git diff --stat db921ea..HEAD -- pipelines/video/visuals-flow/lib/board.mjs pipelines/video/visuals-flow/lib/board.test.mjs pipelines/video/visuals-flow/PIPELINE.md` | only these files changed |

## Scope

**In scope** (touch only these):
- `pipelines/video/visuals-flow/lib/board.mjs`
- `pipelines/video/visuals-flow/lib/board.test.mjs`
- `pipelines/video/visuals-flow/PIPELINE.md` (one-line doc update, Step 5)

**Out of scope** (looks related — do NOT touch):
- Any `videos/**` file, especially `videos/test-01/*` — the review data is committed; tests use the temp fixture only.
- `lib/render.mjs`, `lib/resolve*.mjs`, `lib/assemble.mjs`, `lib/effects/*`, `lib/export-timeline.mjs`, `steps/**` — no pipeline/data/schema change.
- `lib/fixtures/board/*` — reuse the existing fixture as-is; do not add or edit fixtures.
- `scripts/check.sh` — the new tests live in the already-registered `lib/board.test.mjs`; do not edit the test list.
- The list view's rendered HTML (`renderBoardPage` output at `/list`) must stay byte-for-byte what `/` produces today, except for the added header view-toggle (Step 2).

## Git workflow

- Branch: `advisor/113-visuals-flow-review-timeline`
- Commit per step (rollback granularity), messages like `feat(visuals-flow): timeline overview view — <step>`. No AI footers. Do NOT push.

## Steps

Order is chosen so the codebase is never broken between steps: internals first (Step 1), then a no-op route split (Step 2), then the new page (Step 3), then tests (Step 4), then docs (Step 5).

### Step 1: Extract the shared detail-block renderer and a subtree-scoped client init (no behavior change)

Refactor **within `board.mjs`** so the per-block detail HTML has a single source both views call:

1. Extract the body that builds `timelineBlocks` (cue tiles + gap blocks, lines 484–562) and the shot-block splicing (564–581) into a new function:

   ```js
   // Returns an ordered array of { html, start, id, isShot } for every cue tile,
   // gap block, and shot block. `id` is the DOM id the block already uses
   // (`seg-<i>` for cue/gap, `shot-<span.id>` for shots) — the timeline links to it.
   function buildDetailBlocks(cues, segments, resolved, shots, feedbackItems, unresolvedSegs) { ... }
   ```

   Move the existing logic verbatim; have `renderBoardPage` call it and keep producing the exact same `timelineHtml`. Each returned block's `id` must match the id already in its HTML (`seg-<i>`, `shot-<span.id>`) — do not renumber.

2. Refactor the page-load client init so a single block can be initialised on demand. Today `OVERFLOW_BADGE_JS`'s `wireProbe(tile)` plus the tile audio↔iframe `postMessage` loop (the `document.querySelectorAll('.tile').forEach(...)` block near line 657) run once over the whole page. Wrap the per-tile wiring in one function and call it per-root:

   ```js
   // initBlock(root): wire probe + audio<->iframe sync for every .tile inside `root`.
   // Idempotent (guard with a data-inited flag) so re-calling on a revealed block is safe.
   function initBlock(root) { root.querySelectorAll('.tile:not([data-inited])').forEach(tile => { tile.dataset.inited='1'; /* existing wireProbe + audio sync body */ }); }
   ```

   On the list page, call `initBlock(document)` on load (preserves current behavior). Keep this as shared JS strings so both pages import the identical functions.

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/board.test.mjs` → all existing tests pass (the `/` output is unchanged at this step).

### Step 2: Add `/list` route + header view-toggle (no default change yet)

1. In `handleRequest`, factor the `/` handler's data-loading (board.mjs:1177–1183) into a small helper `loadBoardData(workdir)` returning `{cuesFile, resolved, words, feedbackItems, shots, effects}` (both routes will use it).
2. Add a route: `GET /list` → `renderBoardPage(...)` (same output the `/` route produces today). Leave `/` and `/index` still returning `renderBoardPage` **for now**.
3. In the shared sticky-header topbar (renderBoardPage, ~line 594), add a view toggle at the far left:
   `<span class="view-toggle"><a href="/">Timeline</a><a href="/list" class="active">List</a></span>`
   Add minimal CSS to `BOARD_CSS` (`.view-toggle a{…}`, `.view-toggle a.active{color:var(--accent)}`). The list page marks `List` active; the timeline page (Step 3) marks `Timeline` active.

**Verify**: `node --test lib/board.test.mjs` passes; `curl -s localhost:<port>/list` (or a quick test) contains `>Approve graphics<`. Existing `/` test still green.

### Step 3: Build `renderTimelinePage(...)` and make it the `/` default

Add `function renderTimelinePage(cuesFile, resolved, words, feedbackItems, shots, effects)` returning a full HTML document that shares `BOARD_CSS` and the sticky header (video/duration/counts + the three Approve buttons + Save + the view-toggle with `Timeline` active). Below the header, render:

**(a) The track canvas** — a horizontally-scrollable region. Compute the view-model from the same inputs (`buildSegments(words, resolved)` for graphics; `shots.spans` for avatar; the `fxPoint`/`fxSpan`/`fxGlobal` split for effects; `totalDuration = words.at(-1).end`). Four lane rows, each `<div class="tl-lane">` with a left `tl-label` gutter and a positioned `tl-track` of width `totalDuration*PXPS`:

- **SCREEN**: one full-width bar (`var(--line)`).
- **GRAPHICS**: one absolutely-positioned block per resolved cue — `data-start`, `data-dur` (seconds), `data-detail="seg-<i>"`, color by placement (`--accent` fullframe / `--overlay-seg` overlay / `--err` flagged), label = card short name (`cue.card.split('/').pop()`).
- **AVATAR**: one block per `shots.spans[]` — `data-start`, `data-dur`, `data-detail="shot-<id>"`, color `--shot`, label = span id.
- **EFFECTS**: point markers for `fxPoint` (`data-start=at`, thin tick, `--accent` whip / `--ok` beat), span bars for `fxSpan` (drift), and `fxGlobal` (captions/bubble) as small labeled chips at the lane's left. Disabled instances (`enabled:false`) get class `fx-off`.

A time ruler row on top (`tl-ruler`) with tick labels, and a `tl-playhead` vertical line spanning all lanes.

**(b) The detail dock + hidden store**:
- `<aside id="detail-panel">` (empty placeholder: "click a block to preview").
- `<div id="detail-store" hidden>` containing every block from `buildDetailBlocks(...)` wrapped as `<div class="detail-item" id="detail-<blockId>">…block html…</div>`. **Critical**: in the store, the card iframes must be inert — replace `src="/card/…"` with `data-src="/card/…"` so nothing fetches until a block is revealed. Do this by generating the blocks then `.replace('<iframe loading="lazy" src=', '<iframe loading="lazy" data-src=')` (the block HTML uses exactly that prefix — see board.mjs:521).

**(c) Client JS** (add as a string; place & wire — this is the load-bearing part):

```js
const PXPS_FIT = Math.max(0.4, (canvas.clientWidth - LABEL_W) / TOTAL);   // fit whole video
let pxps = PXPS_FIT;
function layout() {
  document.querySelectorAll('.tl-track').forEach(t => t.style.width = (TOTAL*pxps)+'px');
  document.querySelectorAll('.tl-block').forEach(b => {
    b.style.left  = (parseFloat(b.dataset.start)*pxps)+'px';
    b.style.width = Math.max(2, parseFloat(b.dataset.dur||0)*pxps)+'px';
  });
  document.querySelectorAll('.tl-mark').forEach(m => m.style.left = (parseFloat(m.dataset.start)*pxps)+'px');
  drawRuler();                       // ticks every ~round(80/pxps) seconds, labelled mm:ss
}
zoom.addEventListener('input', () => { pxps = +zoom.value; layout(); });   // range: PXPS_FIT..30, default PXPS_FIT

// click a block/marker -> move its detail into the dock (moving preserves listeners),
// lazy-load its iframe once, init it. Move the previously-open one back to the store.
let openId = null;
function reveal(detailId) {
  const store = document.getElementById('detail-store');
  const panel = document.getElementById('detail-panel');
  if (openId) store.appendChild(document.getElementById('detail-'+openId));  // park previous
  const node = document.getElementById('detail-'+detailId);
  if (!node) return;
  panel.replaceChildren(node);
  node.querySelectorAll('iframe[data-src]').forEach(f => { if (!f.src) f.src = f.dataset.src; });
  initBlock(node);                    // from Step 1 — idempotent
  openId = detailId;
}
document.querySelectorAll('[data-detail]').forEach(el =>
  el.addEventListener('click', () => reveal(el.dataset.detail)));

// master playhead across all lanes (delivers GFX-08)
const master = document.getElementById('master');
master.addEventListener('timeupdate', () => {
  document.getElementById('tl-playhead').style.left = (master.currentTime*pxps)+'px';
});
canvas.querySelector('.tl-ruler').addEventListener('click', e => {
  const x = e.offsetX; master.currentTime = x/pxps;                 // click ruler to seek
});
window.addEventListener('resize', () => { /* recompute PXPS_FIT if zoom==fit */ });
layout();
```

Include an always-present `<audio id="master" class="scrub" controls src="/vo.mp3"></audio>` in the header (the list view only adds it conditionally — the timeline always needs it).

**(d) Add `BOARD_CSS` rules** for `.tl-lane`, `.tl-label`, `.tl-track` (`position:relative; height:…`), `.tl-block` (`position:absolute; overflow:hidden; cursor:pointer; border-radius:3px; font-size:10px`), `.tl-mark`, `.tl-ruler`, `.tl-playhead` (`position:absolute; top:0; bottom:0; width:2px; background:#fff`), `#detail-panel` (docked right, `position:sticky; top:…` or a fixed right column, `max-width:520px`, scrollable), `.fx-off{opacity:.3}`. Reuse existing palette vars.

**(e) Route change**: in `handleRequest`, change the `/`+`/index` handler to return `renderTimelinePage(...)` (using `loadBoardData`), and confirm `/list` returns `renderBoardPage(...)`.

**Verify**: `node --test lib/board.test.mjs` (after Step 4 updates the tests); manual: `node lib/board.mjs test-01`, open `/` → four lanes render aligned, clicking a graphics block loads its card preview in the dock, the `Timeline`/`List` toggle switches views, dragging the audio moves the playhead across lanes.

### Step 4: Tests (temp fixture only — never test-01)

In `lib/board.test.mjs`, using the existing `makeWorkdir()`/`startServer()` helpers:

1. **Update** the existing `GET /` test → rename to `GET /list lists every cue id and an Approve button` and fetch `${base}/list` (assertions unchanged: `/c01/`, `/c02/`, `/>Approve graphics</`).
2. **Add** `GET / renders the timeline with all four lanes and a link to /list`:
   - fetch `/`, status 200; assert the HTML contains the lane labels (e.g. `/SCREEN/`, `/GRAPHICS/`, `/AVATAR/`), the cue ids (`/c01/`), a `data-detail="seg-`, `href="/list"`, and `>Approve graphics<`.
3. **Add** `GET / keeps card previews inert in the detail store (data-src, not eager src)`:
   - fetch `/`; assert `html.includes('data-src="/card/')` is true and `html.includes('<iframe loading="lazy" src="/card/')` is false (no eager card iframe on the timeline).
4. **Add** (optional, with `makeWorkdir(true)`) `GET / shows effects markers when effects.json is present`: fetch `/`, assert an fx marker/class (e.g. `/tl-mark/` or `/fx-/`) appears.

Do NOT add a new test file and do NOT edit `scripts/check.sh` — `board.test.mjs` is already registered.

**Verify**: `bash pipelines/video/visuals-flow/scripts/check.sh` → `visuals-flow check OK`, exit 0.

### Step 5: Doc touch

In `PIPELINE.md`, update the step-040 row (line ~19) to note the new default view, e.g. append to its "Out" cell: `(board default = horizontal timeline overview; List toggle = the per-cue detail view)`. One line; no other doc changes.

**Verify**: `git diff --stat db921ea..HEAD` shows only `lib/board.mjs`, `lib/board.test.mjs`, `PIPELINE.md`.

## Test plan

- All new assertions live in `lib/board.test.mjs` against `makeWorkdir()` temp dirs (fixture cues `c01`/`c02`); no render, no assemble, no `videos/test-01` access.
- The merge gate is `bash pipelines/video/visuals-flow/scripts/check.sh` (runs the full `node --test` list incl. `board.test.mjs`, then `check-rulebook`).
- `/list` output must remain identical to today's `/` except for the added header view-toggle — the reused `buildDetailBlocks` guarantees the block HTML doesn't drift.

## Done criteria

- [ ] `bash pipelines/video/visuals-flow/scripts/check.sh` exits 0 and prints `visuals-flow check OK`.
- [ ] `GET /` returns 200 and contains: the four lane labels, cue ids, `data-detail="seg-`, `data-src="/card/` (and NOT eager `<iframe loading="lazy" src="/card/`), a `href="/list"` toggle, and `>Approve graphics<`.
- [ ] `GET /list` returns 200 and contains the cue ids + `>Approve graphics<` (the detail list, unchanged).
- [ ] `git diff --stat db921ea..HEAD` lists only `pipelines/video/visuals-flow/lib/board.mjs`, `.../lib/board.test.mjs`, `.../PIPELINE.md`.
- [ ] Save / Approve graphics / Approve shots / Approve effects / feedback boxes still function on `/list` (unchanged handlers) and from a revealed block in the timeline dock.

## Visual acceptance rubric (owner eyeball — no screenshot gate)

Run `node lib/board.mjs test-01`, open `/`, and confirm:
1. The whole video is visible at a glance as four aligned horizontal lanes (SCREEN / GRAPHICS / AVATAR / EFFECTS) on one time ruler; a graphics block and an avatar span that overlap in time visibly line up vertically.
2. The page loads light — no card iframes render until you click a block (fast even on test-01's 18 cues + 9 spans).
3. Clicking any graphics block opens its live card preview + VO scrub + feedback box in the docked panel; clicking another block swaps it.
4. The `Timeline` / `List` toggle switches between the new view and the untouched detail list.
5. Dragging/playing the master audio sweeps a single playhead across all lanes; clicking the ruler seeks.
6. Zoom slider goes from whole-video-fit to second-level detail with horizontal scroll; blocks stay correctly placed.

## STOP conditions

- Any test or step would need to read/write `videos/test-01/*` or spawn a render/assemble → STOP (use `makeWorkdir()` only). This is the 2026-07-20 house rule.
- The two views would need different block HTML (i.e. `buildDetailBlocks` can't serve both) → STOP and report; do not fork the block renderer.
- `renderBoardPage`'s output at `/list` changes in any way other than the added header toggle → STOP.
- After 5 self-fix attempts the Done criteria still fail → write `BLOCKED: done criteria unreachable after 5 attempts` and stop.

## Maintenance notes

- `buildDetailBlocks` is now the single source of the cue/gap/shot detail HTML for both views — future block changes land there once. `initBlock(root)` is the single per-block client init; keep it idempotent (the timeline calls it on reveal).
- The timeline reuses `buildSegments` (graphics) and the same `fxPoint/fxSpan/fxGlobal` split `renderBoardPage` uses — if the effects taxonomy grows, update both the list lane and the timeline lane together (same edit-both discipline as the effects rulebook).
- This delivers GFX-08 (global play-through) via the master playhead — update the `plans/README.md` GFX-08 backlog note to "landed via 113" when this merges.
- A reviewer should scrutinise: (1) no eager card-iframe `src` leaks into the timeline store (perf + the whole point of on-demand); (2) `/list` byte-parity except the toggle; (3) the reveal move-mechanism parks the previously-open block back into the store so its audio stops and it can be reopened.
