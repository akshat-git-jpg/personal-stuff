---
executor: agy
model:
test_cmd: bash pipelines/video/visuals-flow/scripts/check.sh
ui:
deploy:
needs: []
---

# Plan 104: board effects lane — markers, toggles, approval gate, CSS-sim playback

## Summary

- **Problem statement**: The effects layer plans per-instance data into `videos/<slug>/effects.json`, but the owner has no visual pre-review — effects are visible only as raw JSON or a full draft render. Design spec: `docs/specs/2026-07-20-board-effects-lane-design.md` (owner-approved 2026-07-20).
- **Goals**:
  - Effects lane on the board: minimap markers (whip/beat points, drift spans), a chips row with per-instance `enabled` toggles that ride Save, video-wide chips for captions/bubble.
  - Third approval gate: "Approve effects" button + `/approve-effects` endpoint; any effects change on Save resets approval; `assemble.mjs` refuses an unapproved `effects.json` unless `--force`.
  - Master VO playback (`/vo.mp3` route + header audio + minimap playhead) driving a fixed CSS sim stage (context label, real caption preview via `planCaptions`, CSS approximations of flash/whip/punch/drift/bubble at instance timestamps).
  - `drift.mjs` `plan()` stamps informational `start`/`end`; `effects-plan.mjs` carries top-level `approved` across regeneration only when instances are canonically unchanged.
- **Executor proposed**: agy (Gemini 3.1 Pro High) — standard difficulty, fully inlined.
- **Done criteria** (terse): check.sh green with the new board/assemble/effects-plan tests (the owner eyeballs the lane locally post-merge — the ui screenshot gate was removed 2026-07-18, decisions.md).
- **Stop conditions** (terse): touch only the in-scope files; do not change any effect module's `contribute()` rendering output; stop after 2 failed attempts at any single verify.
- **Test / verification for success**: node --test additions in `lib/board.test.mjs` + `lib/assemble.test.mjs` via check.sh.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat c82b552..HEAD -- pipelines/video/visuals-flow/lib/board.mjs pipelines/video/visuals-flow/lib/board.test.mjs pipelines/video/visuals-flow/lib/assemble.mjs pipelines/video/visuals-flow/lib/assemble.test.mjs pipelines/video/visuals-flow/lib/effects-plan.mjs pipelines/video/visuals-flow/lib/effects/drift.mjs`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (independent of plan 105; either order lands cleanly)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `c82b552`, 2026-07-20

## Why this matters

Six effect modules now decide how the final video moves (transitions, punch-ins, captions, drift, bubble), and the owner's only review surfaces are raw JSON and a multi-minute draft render. The board already reviews cues and shots with approval gates; effects are the one artifact that goes to assembly sight-unseen. This plan gives effects the same treatment: see them, toggle them, approve them — and adds a deliberately-scoped timing preview so density/placement problems surface before any render. The preview simulates timing, not final pixels; each effect's look is a global constant already frame-verified against references (spec, owner decision 1).

## Current state

All paths relative to `pipelines/video/visuals-flow/`.

- `lib/board.mjs` (~1086 lines) — the review board server. Key facts verified at `c82b552`:
  - `loadShots(workdir, words)` (line ~26) returns `null` when `shots.json` is absent; every caller handles null. **Follow this exact pattern for `loadEffects`.**
  - `renderBoardPage(cuesFile, resolved, words, feedbackItems, shots)` (line ~331) builds the page: sticky header with topbar buttons (`#approveBtn`, `#approveShotsBtn` conditional, `#saveBtn`), banner div, usage chips, minimap lane-rows (`graphics`, conditional `avatar`), lane legend, then timeline blocks.
  - Save flow (client, line ~562): collects cues + spans + feedback, POSTs `{video, approved, cues, feedback, spans?}` to `/save`.
  - `handleSave` (line ~637): merges over the existing cues.json, does a **key-order-insensitive canon compare** (line ~659) and resets `approved` when cues actually changed; when `shots.json` exists it applies `mergeShots`, resets shot approval on cue change with the warning `'shots: un-approved — cues changed after shot approval (re-review the shot plan)'`, lints, rewrites `resolved.json`, returns `{ok, errors, warnings}`.
  - `handleApproveShots` (line ~786): reads shots.json, sets `approved = true`, writes back. **Mirror this exactly for effects.**
  - Routing in `handleRequest` (line ~941): GET `/`, `/card/:id`, `/calibrate`, `/calibrate-card/:slug`, `/slice/:id.mp3`; POST `/save`, `/approve`, `/approve-shots`. POSTs are origin-checked to localhost/127.0.0.1.
  - `serveSlice` (line ~930) is the exemplar for a new audio route: reads the file, `content-type: audio/mpeg`, `cache-control: no-store`.
  - CSS lives in the `BOARD_CSS` template string (line ~145); client JS in the page template string (line ~529).
- `lib/effects-plan.mjs` — CLI, no exports. Computes `defaultInstances` from `EFFECT_MODULES[].plan(ctx)`, merges per-id overrides from any existing `effects.json` via `{ ...inst, ...override }`, writes `{ video, instances }`. **It currently drops any other top-level field** — an `approved` flag would be lost on regeneration; this plan fixes that.
- `lib/effects/drift.mjs` — `plan(ctx)` pushes `{ id: 'drift-<segId>', type, segId, direction, enabled: true }` for each `kind === 'screen'` segment. The segment objects in `ctx.segments` carry `start` and `end` (they come from `planSegments` in `assemble.mjs`). `contribute()` looks up instances by `segId` only.
- `lib/assemble.mjs` — main() gates, verified at `c82b552`:
  - line ~733: refuses `cuesFile.approved !== true` without `--force`.
  - line ~758 (inside `if (fs.existsSync(shotsPath))`): refuses `shotsFile.approved !== true` without `--force`, message `'shots.json approved=false'`.
  - The effects gate goes immediately AFTER the whole shots `if` block, BEFORE any effects/segment planning.
- `lib/captions.mjs` — exports `planCaptions(words, opts)` returning chunks `[{i, text, words: [{text, hl}], start, end}]` where `hl` comes from the real `markKeyword`. Used server-side for the honest caption preview.
- Instance shapes (from `videos/test-01/effects.json`, real data):
  - whip: `{"id":"whip-57.5","type":"whip","at":57.52,"direction":"right","fromIdx":0,"toIdx":1,"style":"flash","enabled":true}` (style is `"flash"` or `"blur"`)
  - beat: `{"id":"beat-138.9","type":"beat","at":138.865,"punch":1.08,"enabled":true}`
  - captions: `{"id":"captions","type":"captions","enabled":true,"fontPx":44,"yFrac":0.87}` (video-wide)
  - drift: `{"id":"drift-screen-03","type":"drift","segId":"screen-03","direction":"in","enabled":true}` (no `at` — this plan adds `start`/`end`)
  - bubble: `{"id":"bubble","type":"bubble","enabled":true}` (video-wide)
- `lib/board.test.mjs` (exemplar for all new tests) — pattern: fixture dir `lib/fixtures/board/`, temp workdirs via `makeWorkdir()` copying `cues.json, resolved.json, transcript.json, vo.mp3` into `lib/.test-tmp/board/board-*`, `startServer(workdir)` → real HTTP via `fetch`, `server.close()` in `finally`.
- `lib/assemble.test.mjs` — has existing gate tests for cues/shots approval refusal; follow their style for the effects gate test.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full verify (the merge gate) | `bash pipelines/video/visuals-flow/scripts/check.sh` | exits 0, ends `visuals-flow check OK` |
| One suite while iterating | `cd pipelines/video/visuals-flow && node --test lib/board.test.mjs` | all pass |
| Board up for the screenshot | `cd pipelines/video/visuals-flow && node lib/board.mjs test-01` | prints `board at http://localhost:4322` |

## Scope

**In scope** (the ONLY files to touch):
- `pipelines/video/visuals-flow/lib/board.mjs`
- `pipelines/video/visuals-flow/lib/board.test.mjs` (+ new fixture file `lib/fixtures/board/effects.json`)
- `pipelines/video/visuals-flow/lib/assemble.mjs`
- `pipelines/video/visuals-flow/lib/assemble.test.mjs`
- `pipelines/video/visuals-flow/lib/effects-plan.mjs`
- `pipelines/video/visuals-flow/lib/effects/drift.mjs`

**Out of scope** (looks related — do NOT touch):
- Every other `lib/effects/*` module: this plan changes NO rendering output. `whip.mjs`, `beats.mjs`, `captions.mjs` (module in `lib/effects/`), `bubble.mjs`, `registry.mjs` stay byte-identical.
- `lib/captions.mjs` (the shared caption planner) — imported, not modified.
- `scripts/check.sh` and `lib/effects.test.mjs` — plan 105 owns both; touching them here creates a merge conflict.
- `EFFECTS.md`, `RULEBOOK.md`, prompts, `videos/test-01/*` — committed data/rule surfaces; do not edit (the fixture copy in `lib/fixtures/board/` is the test's own file).
- `steps/090-assemble-run/run.sh` — the gate lives in `assemble.mjs`, which the step already calls.

## Steps

### Step 1 — drift instances carry start/end

In `lib/effects/drift.mjs` `plan()`, add `start: seg.start, end: seg.end` to the pushed instance (informational; `contribute()` keeps using `segId` and must not change). 

**Verify:** `cd pipelines/video/visuals-flow && node --test lib/assemble.test.mjs` — passes (drift plan shape is covered indirectly; no behavior change).

### Step 2 — effects-plan preserves `approved` honestly

In `lib/effects-plan.mjs`, after building `newInstances`, replace the `outData` construction with:

```js
const canon = (v) => Array.isArray(v) ? v.map(canon)
  : (v && typeof v === 'object')
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]))
    : v;
const unchanged = JSON.stringify(canon(existing.instances ?? [])) === JSON.stringify(canon(newInstances));
const outData = {
  video,
  approved: existing.approved === true && unchanged,
  instances: newInstances
};
```

**Verify:** `node --test lib/board.test.mjs` after Step 6's tests exist (the merge behavior is tested there via the exported helper — see Step 3); for now `node lib/effects-plan.mjs test-01 --help 2>&1; echo $?` is NOT a gate — just confirm the file parses: `node --check lib/effects-plan.mjs` → exit 0. **Do NOT run `node lib/effects-plan.mjs test-01`** — it rewrites the committed `videos/test-01/effects.json`.

### Step 3 — board: loadEffects + save merge + approve endpoint

In `lib/board.mjs`:

1. Export `loadEffects(workdir)` next to `loadShots` — same null-when-missing contract:

```js
// Reads effects.json; null when the video has no effects plan yet — every
// caller must handle null and render the pre-effects board.
export function loadEffects(workdir) {
  const p = path.join(workdir, 'effects.json');
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { return { instances: [], errors: [`effects.json unreadable: ${e.message}`] }; }
}
```

2. Export `mergeEffects(prevEffectsFile, toggles)` — `toggles` is the Save payload's `effects` array `[{id, enabled}]`; only `enabled` is applied; a real change resets approval (canon compare, same helper shape as `mergeShots`):

```js
// Merge semantics mirror mergeShots: only `enabled` is board-writable;
// a real change resets approval.
export function mergeEffects(prevEffectsFile, toggles) {
  const canon = (v) => Array.isArray(v) ? v.map(canon)
    : (v && typeof v === 'object')
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]))
      : v;
  const byId = new Map((toggles ?? []).map((t) => [t.id, !!t.enabled]));
  const instances = (prevEffectsFile.instances ?? []).map((inst) =>
    byId.has(inst.id) ? { ...inst, enabled: byId.get(inst.id) } : inst);
  const changed = JSON.stringify(canon(prevEffectsFile.instances ?? [])) !== JSON.stringify(canon(instances));
  const merged = { ...prevEffectsFile, instances };
  if (prevEffectsFile.approved === true && changed) merged.approved = false;
  return { merged, changed };
}
```

3. In `handleSave`, after the shots block: when `effects.json` exists, apply `mergeEffects` if the payload carries `effects`; ALSO reset effects approval when `cuesChanged` (stale-defaults safety, mirroring shots):

```js
let mergedEffects = null;
const effectsPath = path.join(workdir, 'effects.json');
if (fs.existsSync(effectsPath)) {
  mergedEffects = JSON.parse(fs.readFileSync(effectsPath, 'utf8'));
  if (cuesFile.effects !== undefined) {
    const { merged, changed } = mergeEffects(mergedEffects, cuesFile.effects);
    mergedEffects = merged;
    if (changed) resWarningsEffects.push('effects: un-approved — effects changed after approval (re-approve on the board)');
  }
  if (cuesChanged && mergedEffects.approved === true) {
    mergedEffects.approved = false;
    resWarningsEffects.push('effects: un-approved — cues changed after effects approval (re-run node lib/effects-plan.mjs and re-review)');
  }
  fs.writeFileSync(effectsPath, JSON.stringify(mergedEffects, null, 2));
}
```

(Declare `const resWarningsEffects = [];` before the block and splice it into the returned `warnings` alongside `shotWarnings`. Only emit the first warning when the effects file was approved before the toggle change — i.e. move the push inside a `prevApproved && changed` check; an unapproved file toggling needs no warning.)

4. New handler + route (mirror `handleApproveShots` / `/approve-shots`):

```js
async function handleApproveEffects(req, res, workdir) {
  await readBody(req);
  const effectsPath = path.join(workdir, 'effects.json');
  const effectsFile = JSON.parse(fs.readFileSync(effectsPath, 'utf8'));
  effectsFile.approved = true;
  fs.writeFileSync(effectsPath, JSON.stringify(effectsFile, null, 2));
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ ok: true }));
}
```

Route: `if (req.method === 'POST' && url.pathname === '/approve-effects') { return handleApproveEffects(req, res, workdir); }`

5. New `/vo.mp3` route (exemplar `serveSlice`): GET `/vo.mp3` → read `path.join(workdir, 'vo.mp3')`, `content-type: audio/mpeg`, `cache-control: no-store`, 404 when missing.

**Verify:** `node --check lib/board.mjs` → exit 0.

### Step 4 — board page: effects lane, chips, approve button, master player, sim stage

Still `lib/board.mjs`. Pass `effects = loadEffects(workdir)` from the GET `/` handler into `renderBoardPage(cuesFile, resolved, words, feedbackItems, shots, effects)` (new trailing param, default `null`).

Inside `renderBoardPage`, when `effects?.instances?.length`:

1. **Server-side prep** (top of the function, alongside existing data prep):

```js
const fxInstances = effects?.instances ?? [];
const fxPoint = fxInstances.filter((i) => i.type === 'whip' || i.type === 'beat');
const fxSpan = fxInstances.filter((i) => i.type === 'drift' && typeof i.start === 'number');
const fxGlobal = fxInstances.filter((i) => i.type === 'captions' || i.type === 'bubble');
// honest caption preview: the REAL planner + keyword marker
const { planCaptions } = await import('./captions.mjs'); // move to a top-level static import instead
const capChunks = fxInstances.some((i) => i.type === 'captions' && i.enabled) ? planCaptions(words) : [];
// context windows for the sim stage
const fxFullframes = resolved.filter((c) => c.placement === 'fullframe').map((c) => ({ id: c.id, start: c.start, end: c.start + c.duration }));
const fxShotSpans = (shots?.spans ?? []).map((s) => ({ id: s.id, start: s.start, end: s.start + s.duration }));
```

Use a top-level `import { planCaptions } from './captions.mjs';` (static, next to the other lib imports) — the inline dynamic import above is illustration only.

2. **Effects minimap lane** (render after the avatar lane-row): a relative-positioned strip with absolute markers.

```js
const fxLaneHtml = fxInstances.length ? `
  <div class="lane-row"><span class="lane-label">effects</span>
    <div class="minimap minimap-fx" style="position:relative; background:transparent;">
      ${fxSpan.map((i) => `<div class="fx-span${i.enabled ? '' : ' fx-off'}" title="${escapeHtml(i.id)}" style="left:${(i.start / totalDuration * 100).toFixed(2)}%; width:${((i.end - i.start) / totalDuration * 100).toFixed(2)}%"></div>`).join('')}
      ${fxPoint.map((i) => `<div class="fx-marker fx-${escapeHtml(i.type)}${i.enabled ? '' : ' fx-off'}" title="${escapeHtml(i.id)}${i.style ? ' · ' + escapeHtml(i.style) : ''}" style="left:${(i.at / totalDuration * 100).toFixed(2)}%"></div>`).join('')}
      <div id="fxPlayhead"></div>
    </div>
  </div>` : '';
```

3. **Chips row** (below the lane legend): every instance gets a labeled checkbox chip. Label format: `whip 0:57 flash`, `beat 2:18`, `drift screen-03`, `captions`, `bubble` (use the existing `timecode()` for times).

```js
const fxChipsHtml = fxInstances.length ? `<div class="fx-chips">${fxInstances.map((i) => {
  const when = typeof i.at === 'number' ? ' ' + timecode(i.at) : (typeof i.start === 'number' ? ' ' + timecode(i.start) : '');
  const extra = i.style ? ' ' + escapeHtml(i.style) : '';
  return `<label class="fx-chip"><input type="checkbox" class="fx-toggle" data-fx-id="${escapeHtml(i.id)}" ${i.enabled ? 'checked' : ''}/>${escapeHtml(i.type)}${when}${extra}</label>`;
}).join('')}</div>` : '';
```

4. **Topbar + banner**: when `effects` is non-null add `<button id="approveEffectsBtn">Approve effects</button>` next to the shots button, an `engine`-style chip is NOT needed; add to the banner block: `${effects && effects.approved ? '<div class="banner ok">…effects approved — ready for step 090 assemble</div>' : ''}` (copy the exact dismissable-banner markup shape of the shots banner above it).

5. **Master player + sim stage markup** (end of sticky header, only when `fxInstances.length`): 

```html
<audio id="master" class="scrub" controls src="/vo.mp3"></audio>
<div id="fxStage">
  <div class="frame"><span class="ctx" id="fxCtx"></span></div>
  <div class="flash"></div>
  <div class="bubble"></div>
  <div class="cap" id="fxCap"></div>
  <div class="note-fixed">timing preview — final look is the module's</div>
</div>
```

6. **CSS** (append to `BOARD_CSS`):

```css
.minimap-fx { height:18px; }
.fx-marker { position:absolute; top:2px; bottom:2px; width:3px; border-radius:1px; }
.fx-whip { background:var(--accent); }
.fx-beat { background:var(--ok); }
.fx-span { position:absolute; top:6px; height:6px; background:rgba(245,237,226,0.28); border-radius:3px; }
.fx-off { opacity:0.25; }
#fxPlayhead { position:absolute; top:-2px; bottom:-2px; width:2px; background:#fff; opacity:0; }
.fx-chips { display:flex; flex-wrap:wrap; gap:6px; margin:8px 0; }
.fx-chip { font-size:11px; font-family:ui-monospace,Menlo,monospace; color:var(--dim); border:1px solid var(--line); border-radius:20px; padding:3px 10px; cursor:pointer; display:inline-flex; align-items:center; gap:5px; }
.fx-chip input { accent-color: var(--accent); }
#approveEffectsBtn { border-color:var(--ok); color:var(--ok); }
#fxStage { position:fixed; right:24px; bottom:24px; width:480px; height:270px; background:#141017; border:1px solid var(--line); border-radius:10px; overflow:hidden; z-index:200; display:none; }
#fxStage.on { display:block; }
#fxStage .frame { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; transition:transform 0.3s ease-out; }
#fxStage .ctx { font:11px ui-monospace,Menlo,monospace; color:var(--dim); }
#fxStage .flash { position:absolute; inset:0; background:#ffd9b0; opacity:0; pointer-events:none; }
#fxStage.fx-flash .flash { animation:fxFlash 0.3s ease-out; }
@keyframes fxFlash { 0%{opacity:0} 25%{opacity:0.9} 100%{opacity:0} }
#fxStage.fx-punch .frame { transform:scale(1.08); }
#fxStage.fx-whipblur .frame { animation:fxWhip 0.25s ease-in; }
@keyframes fxWhip { 0%{filter:blur(0);transform:translateX(0)} 50%{filter:blur(8px);transform:translateX(-40px)} 100%{filter:blur(0);transform:translateX(0)} }
#fxStage.fx-drift .frame { transform:scale(1.04); transition:transform 3s linear; }
#fxStage .cap { position:absolute; left:8px; right:8px; bottom:10%; text-align:center; font-weight:700; font-size:16px; color:#fff; text-shadow:0 0 4px #000; }
#fxStage .cap .hl { color:var(--accent); }
#fxStage .bubble { position:absolute; top:12px; right:12px; width:56px; height:56px; border-radius:50%; border:3px solid var(--accent); background:#2a1d14; display:none; }
#fxStage.ctx-screen .bubble.on { display:block; }
#fxStage .note-fixed { position:absolute; top:6px; right:10px; font-size:10px; color:var(--dim); }
```

7. **Pure sim helpers — exported from board.mjs for tests, and embedded verbatim in the client script.** Author them ONCE as a string constant so server export and client injection cannot drift:

```js
export const FX_SIM_HELPERS = `
function fxContext(t, fullframes, spans) {
  if (fullframes.some((f) => t >= f.start && t < f.end)) return 'graphic';
  if (spans.some((s) => t >= s.start && t < s.end)) return 'avatar';
  return 'screen';
}
function fxEventsAt(prevT, t, instances) {
  return instances.filter((i) => i.enabled && typeof i.at === 'number' && i.at > prevT && i.at <= t);
}
function fxDriftActive(t, instances, ctx) {
  return ctx === 'screen' && instances.some((i) => i.type === 'drift' && i.enabled
    && typeof i.start === 'number' && t >= i.start && t <= i.end);
}
`;
// Node-side bindings for tests:
const fxSim = {};
new Function('exports', FX_SIM_HELPERS
  + '\nexports.fxContext = fxContext; exports.fxEventsAt = fxEventsAt; exports.fxDriftActive = fxDriftActive;')(fxSim);
export const { fxContext, fxEventsAt, fxDriftActive } = fxSim;
```

8. **Client script additions** (inside the existing page `<script>`): embed `FX_DATA = ${JSON.stringify({ instances: fxInstances, fullframes: fxFullframes, spans: fxShotSpans, capChunks, total: totalDuration })}` and `${FX_SIM_HELPERS}`; then:
   - Chip toggles: `document.querySelectorAll('.fx-toggle')` → on change set `FX_DIRTY_TOGGLES = true` and update the corresponding lane marker's `fx-off` class (match by `data-fx-id` → title). Extend the Save payload builder with `payload.effects = [...document.querySelectorAll('.fx-toggle')].map((el) => ({ id: el.dataset.fxId, enabled: el.checked }));` (only when any `.fx-toggle` exists).
   - Approve button: `approveEffectsBtn.onclick = async () => { await fetch('/approve-effects', { method: 'POST' }); location.reload(); };` (guard for null like `approveShotsBtn`).
   - Master loop: on `#master` play → add `on` to `#fxStage`, show `#fxPlayhead` (`opacity:1`), start a rAF loop; each frame: `const t = master.currentTime;` set playhead `left = (t/FX_DATA.total*100)+'%'`; compute `ctx = fxContext(t, FX_DATA.fullframes, FX_DATA.spans)` → set stage class `ctx-screen|ctx-avatar|ctx-graphic` and `#fxCtx` text (`'screen' | 'avatar' | fullframe id`); fire `fxEventsAt(prevT, t, FX_DATA.instances)` → for a whip with `style==='flash'` pulse class `fx-flash`, whip otherwise `fx-whipblur`, beat `fx-punch` (add class, remove after 350ms via setTimeout keyed per event); toggle `fx-drift` by `fxDriftActive`; bubble `.on` when a bubble instance is enabled; caption: find the chunk in `FX_DATA.capChunks` with `start <= t < end` and `ctx === 'screen'` → render `chunk.words.map(w => w.hl ? '<span class="hl">'+esc+'</span>' : esc).join(' ')` into `#fxCap` (escape with the existing `escapeForBanner`-style escaper), else clear. Track `prevT = t` at loop end; on pause/ended remove `on` and stop the loop.

**Verify:** `cd pipelines/video/visuals-flow && node --test lib/board.test.mjs` — existing tests still green (effects-less fixtures render the pre-effects board unchanged).

### Step 5 — assemble gate

In `lib/assemble.mjs` main(), immediately after the closing brace of the `if (fs.existsSync(shotsPath)) { … }` block, insert:

```js
const effectsGatePath = path.join(workdir, 'effects.json');
if (fs.existsSync(effectsGatePath)) {
  const effectsFile = JSON.parse(fs.readFileSync(effectsGatePath, 'utf8'));
  if (effectsFile.approved !== true && !opts.force) {
    console.error('refusing to render: effects.json approved=false — review the effects lane on the board (node lib/board.mjs <slug>) or pass --force');
    process.exit(1);
  }
}
```

Missing `effects.json` = no gate (pre-effects and graphics-only videos assemble unchanged).

**Verify:** `node --test lib/assemble.test.mjs` — existing gate tests still green.

### Step 6 — tests

1. **Fixture**: create `lib/fixtures/board/effects.json` (matches the board fixture's timeline scale — its transcript is ~30s):

```json
{
  "video": "board-fixture",
  "approved": false,
  "instances": [
    { "id": "whip-5.0", "type": "whip", "at": 5.0, "direction": "right", "fromIdx": 0, "toIdx": 1, "style": "flash", "enabled": true },
    { "id": "beat-12.0", "type": "beat", "at": 12.0, "punch": 1.08, "enabled": true },
    { "id": "drift-screen-01", "type": "drift", "segId": "screen-01", "direction": "in", "start": 14.0, "end": 22.0, "enabled": true },
    { "id": "captions", "type": "captions", "enabled": true, "fontPx": 44, "yFrac": 0.87 },
    { "id": "bubble", "type": "bubble", "enabled": true }
  ]
}
```

2. **board.test.mjs additions** (extend `makeWorkdir` with an optional flag that also copies `effects.json`; default off so every existing test is untouched):
   - `GET / without effects.json renders no effects lane` — response lacks `minimap-fx` and `Approve effects`.
   - `GET / with effects.json renders lane, chips, approve button, sim stage` — response matches `/minimap-fx/`, `/fx-chip/`, `/>Approve effects</`, `/fxStage/`, `/timing preview/`, and the caption data (`/capChunks/` or a known fixture word).
   - `POST /save with an effects toggle writes enabled and resets approval` — pre-set `approved: true` in the workdir copy; save payload `effects: [{id:'whip-5.0', enabled:false}]` (plus the fixture's cues verbatim); assert file now has `enabled:false` for that id, `approved === false`, and the response warnings include `effects: un-approved`.
   - `POST /save with unchanged toggles preserves approval` — same but all toggles as-is; `approved` stays `true`, no effects warning.
   - `POST /approve-effects sets approved` — then GET `/` shows the approved banner.
   - `mergeEffects only applies enabled` — unit: a toggle entry with extra fields (`{id, enabled, punch: 99}`) must not alter `punch`.
   - `fxContext / fxEventsAt / fxDriftActive` — unit tests on the exported helpers: context precedence (graphic > avatar > screen), events fire once per crossing (`prevT` exclusive, `t` inclusive), drift active only in screen context inside [start,end], disabled instances never fire.
   - `effects-plan approved carry` — unit-test via `spawnSync` of `node lib/effects-plan.mjs <tmp-workdir>` on a MINIMAL temp workdir you build in `.test-tmp` (copy the board fixture's `resolved.json` + `transcript.json` + `vo.mp3`; NO avatar files): run once → file has `approved:false`; hand-set `approved:true` and rerun → still `true` (instances unchanged); disable one instance and rerun → overrides preserved AND `approved:false`... note the override itself keeps instances different from defaults, so assert the simpler honest pair: (a) `approved:true` + untouched file + rerun → `true`; (b) `approved:true` + one `enabled:false` override + rerun → `false`. **Never point this at `videos/test-01`.**
   - `GET /vo.mp3 serves audio` — status 200, `content-type: audio/mpeg`.
3. **assemble.test.mjs addition**: `assemble refuses unapproved effects.json` — in a temp workdir where cues+shots gates pass (or are absent) and `effects.json` has `approved:false`, assert exit != 0 and stderr matches `/effects\.json approved=false/`; with `approved:true` the run proceeds past the gate (it may fail later for missing media — assert only that the effects message is absent).

**Verify:** `bash pipelines/video/visuals-flow/scripts/check.sh` → exit 0, `visuals-flow check OK`.

## Test plan

All in Step 6 — new cases appended to `lib/board.test.mjs` and `lib/assemble.test.mjs`, following those files' existing fixture/tmp-workdir/HTTP patterns. No new test files (check.sh's list is out of scope here — plan 105 owns it).

## Done criteria

- `bash pipelines/video/visuals-flow/scripts/check.sh` → exit 0.
- `git diff c82b552..HEAD --stat` touches only the six in-scope files + the new fixture.
- `grep -c "approve-effects" pipelines/video/visuals-flow/lib/board.mjs` ≥ 2 (route + handler).
- `grep -n "effects.json approved=false" pipelines/video/visuals-flow/lib/assemble.mjs` → one hit.
- (Owner eyeball, post-merge, not a crew gate: `node lib/board.mjs test-01` shows the effects lane, chips, Approve effects, and the sim stage during master playback.)

## STOP conditions

- Any need to modify a file outside the in-scope list (especially `scripts/check.sh`, `lib/effects.test.mjs`, any `lib/effects/*` other than `drift.mjs`, or anything under `videos/`) — stop and report.
- Any test run or manual command that would WRITE into `videos/test-01/` (effects-plan, assemble without `--out` into a tmp dir) — stop; tests use fixture/tmp workdirs only.
- The same verify failing after 2 fix attempts — stop and report the failing output.

## Maintenance notes

- The sim stage is the seam for GFX-08 (full play-through): the master player, playhead, and rAF loop are exactly the transport GFX-08 needs; GFX-08 adds card animation + auto-scroll on top.
- `FX_SIM_HELPERS` is authored once and both exported (tests) and injected (client) — keep it dependency-free (no DOM, no imports) or the `new Function` binding breaks.
- Reviewers should scrutinize: the `prevT`-exclusive event window (double-fire on seek is the classic bug), and that Save still round-trips cues byte-identically when no `.fx-toggle` exists (pre-effects videos).
- Plan 105 rewrites `lib/effects.test.mjs` and check.sh; if both land, effects-plan's `approved` carry gets covered from two angles — fine, not a conflict (different files).
