---
executor: claude-p
model: sonnet
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui: true
deploy:
needs: []
---

# Plan 150: visuals-flow avatar side mode — delete stage, add side-by-side

## Summary

- **Problem statement**: The shot pass has three avatar modes (`full`/`panel`/`stage`) but the prompt never says *when* to pick one, and two of its rules forbid the very placements `panel` and `stage` exist for. Result: every span on test-03 came out full-screen. The owner wants `stage` gone and a new `side` mode (motion graphics one half, host the other) as the second main mode alongside `full`.
- **Goals**:
  - Delete `stage` mode entirely from the pipeline.
  - Add `side` mode: graphics render at 1200×1080 on the left, avatar cover-cropped into 720×1080 on the right.
  - Make `mode` a REQUIRED field — no silent `?? 'full'` default.
  - Rewrite the shot-pass rulebook so mode is a real decision, and fix rules 5/7 which currently contradict the non-full modes.
  - Leave `panel` and the corner bubble code untouched but unruled (owner: out of scope for now).
- **Executor proposed**: `claude-p` / `sonnet` — this plan rewrites the shot-pass rulebook, which is quality-setting content the owner judges by taste (`tooling/boss/data/rules.md`).
- **Done criteria** (terse — full list below): `bash scripts/check.sh` exits 0; `planSideGeometry` returns the exact object in Step 4; grep proves zero `stage` references in lib/ and the prompt; a new ffmpeg pixel test proves the avatar composites into the right 720px.
- **Stop conditions** (terse — full list below): do not touch `card-library/`; do not remove `panel` or corner-bubble code; do not invent a `side` catalog field (plan 151 owns it).
- **Test / verification for success**: unit tests for geometry + lint, plus an ffmpeg integration test that composites a known-colour clip and samples luma inside and outside the side box.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 525d5ba..HEAD -- pipelines/video/visuals-flow/`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `525d5ba`, 2026-07-25

## Why this matters

Avatar modes were added over two plans (147 `panel`, 148 `stage`) but the rulebook that drives the LLM was never updated to match. The modes exist and are correctly enforced downstream by `lint-shots.mjs`; the model upstream was simply never told when to use them, and was actively told not to. This is the pipeline's signature failure — a capability enforced on one surface and never taught on the previous one.

The owner has decided `stage` (host inside a card's designed `head_zone`) is not the shape they want: it needs every card redesigned with a hole in the right place, only 2 of 49 have one, and the result is less clean than a straight vertical split. `side` replaces it. Keeping both would leave two overlapping ways to do one thing.

**Load-bearing insight for the executor**: `stage`'s compositing machinery is exactly what `side` needs — cover-crop to a zone, rounded mask, overlay at an offset, plus the matching FCPXML crop+transform. You are **re-pointing tested code at a fixed zone**, not writing new ffmpeg maths. Preserve the maths; change what feeds it.

## Current state

### Files and their roles

| File | Role |
|---|---|
| `lib/shot-constants.mjs` | Single source of truth for shot-pass constraints. `lib/build-shot-prompt.mjs` renders these into the prompt; `lib/check-shot-rulebook.mjs` fails if prompt and source disagree. |
| `lib/resolve-shots.mjs` | Validates `shots.json`, resolves anchors to times, writes `shots.resolved.json`. |
| `lib/lint-shots.mjs` | Enforces the constants. Errors E1–E6, warnings W1–W6. |
| `lib/avatar-render.mjs` | Plans HeyGen jobs from resolved spans; maps `mode` → job `kind`. |
| `lib/assemble.mjs` | Builds the ffmpeg filter chain. Owns `planPanelGeometry` / `planStageGeometry`. |
| `lib/export-timeline.mjs` | Emits FCPXML for DaVinci Resolve. |
| `lib/render.mjs` | Stages card HTML and invokes the hyperframes CLI. Owns `rewriteDuration`. |
| `steps/070-shot-pass-llm/shot-pass-prompt.md` | GENERATED in part — the constraints block comes from `shot-constants.mjs`. |

### The current mode plumbing

`lib/resolve-shots.mjs:34-35`:

```js
    const mode = span.mode ?? 'full';
    if (mode !== 'full' && mode !== 'panel' && mode !== 'stage') { errors.push(`${span.id}: unknown mode "${span.mode}" — must be "full", "panel", or "stage"`); continue; }
```

`lib/avatar-render.mjs:43`:

```js
    kind: s.mode === 'stage' ? 'avatar-stage' : (s.mode === 'panel' ? 'avatar-panel' : 'avatar-full'),
```

`lib/assemble.mjs:58-75` — the geometry you are re-pointing:

```js
// Stage geometry: the host fills the covering card's declared head_zone.
// The clip is cover-cropped to the zone's aspect (scale up, crop centre) so the
// face is never letterboxed or squashed. Dimensions forced EVEN for yuv420p.
export function planStageGeometry({ zone, canvas, radiusPx, srcAspect = 16 / 9 }) {
  const { w: W, h: H } = canvas;
  const zw = Math.round((zone.w * W) / 2) * 2;
  const zh = Math.round((zone.h * H) / 2) * 2;
  const zoneAspect = zw / zh;
  // cover: scale so the SHORT side fills, then centre-crop the overflow
  const scaleW = zoneAspect > srcAspect ? zw : Math.round((zh * srcAspect) / 2) * 2;
  const scaleH = zoneAspect > srcAspect ? Math.round((zw / srcAspect) / 2) * 2 : zh;
  return {
    scaleW, scaleH,
    cropW: zw, cropH: zh,
    cropX: Math.round((scaleW - zw) / 2),
    cropY: Math.round((scaleH - zh) / 2),
    x: Math.round(zone.x * W),
    y: Math.round(zone.y * H),
    radius: zone.radius ?? radiusPx,
  };
}
```

`lib/assemble.mjs:388-396` — how stage overlays are built (this is what gets replaced):

```js
  const stageOverlays = stageJobs.map(j => {
    const overlappingCues = resolved.filter(c => c.placement === 'fullframe' && j.start < c.start + c.duration && c.start < j.end);
    const cue = overlappingCues[0];
    const cardDef = catalog?.cards?.find(card => card.slug === cue?.slug);
    return {
      id: j.id, start: j.start, end: j.end, file: j.file, isStage: true, zone: j.zone || cardDef?.head_zone
    };
  });
```

`lib/assemble.mjs:646-653` — the stage filter chain (preserve this maths, feed it a fixed zone):

```js
          } else if (o.isStage) {
            const g = planStageGeometry({ zone: o.zone, canvas: CANVAS, radiusPx: SHOT_CONSTANTS.STAGE_HEAD_RADIUS_PX.value });
            const r = g.radius;
            chain += `[${globalInputIdx}:v]trim=start=${o.trimStart},setpts=PTS-STARTPTS+${adjustedAt}/TB,scale=${g.scaleW}:${g.scaleH},crop=${g.cropW}:${g.cropH}:${g.cropX}:${g.cropY},format=yuva444p,` +
              `geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':` +
              `a='if(lt(hypot(max(abs(X-W/2)-(W/2-${r}),0),max(abs(Y-H/2)-(H/2-${r}),0)),${r + 0.5}),255,0)'[${oj}];`;
            chain += `[${lastV}][${oj}]overlay=x=${g.x}:y=${g.y}:eof_action=pass:enable='between(t,${adjustedAt},${adjustedUntil})'[${nextV}];`;
          } else {
```

`lib/export-timeline.mjs:68-82` — the stage FCPXML branch (same re-point).

`lib/lint-shots.mjs:62-72` (E2) and `:118-135` (E6/W6) — the stage lint. E6's shape (*"this span must be covered by exactly one fullframe cue, and that cue's card must declare the right capability"*) is exactly what `side` needs.

`lib/lint-shots.mjs:89`:

```js
  const fullSpans = spans.filter((s) => s.mode !== 'panel' && s.mode !== 'stage');
```

### The rulebook defects being fixed

`steps/070-shot-pass-llm/shot-pass-prompt.md` currently says:

- Line 38-40, a Modes block that is **descriptive only** — says what each mode *is*, never when to use it.
- Rule 5: *"NEVER place a span over a fullframe graphics cue"* — but `side` (like `stage`) **requires** a covering fullframe cue. `lint-shots.mjs` errors if it has none.
- Rules 2/3/4 say "full-screen host moment" / "full-screen time" throughout, biasing every choice to `full`.
- The prompt never lists which cards support the non-full modes, so the model cannot pick one safely.

### Card rendering — why side needs a canvas rewrite

The hyperframes CLI takes **no size flag** (`lib/render.mjs:47-54`). A card's canvas comes from its own `data-width` / `data-height` on `#root` plus its CSS. So rendering a card into the 1200px left half means rewriting the staged HTML — exactly the pattern `rewriteDuration` already uses:

```js
export function rewriteDuration(html, seconds) {
  const re = /data-duration="([0-9.]+)"/g;
  const values = new Set();
  let m;
  while ((m = re.exec(html))) values.add(m[1]);
  if (values.size === 0) {
    return { html, error: 'no data-duration attribute found' };
  }
  if (values.size > 1) {
    return { html, error: `mixed data-duration values: ${[...values].sort().join(', ')}` };
  }
  const newHtml = html.replace(/data-duration="[0-9.]+"/g, `data-duration="${seconds}"`);
  return { html: newHtml, error: null };
}
```

Follow this exemplar exactly for `rewriteCanvas`.

### Design constants (decided — do not re-derive)

- Graphics box: **1200 × 1080**, at x=0.
- Avatar box: **720 × 1080**, at x=1200. Fixed right, always. No per-span side choice.
- **No radius, no inset, no divider** on the side split — a hard clean edge.
- `side` **counts against** `AVATAR_FULL_CAP` (a side clip burns the same HeyGen render seconds as a full one; the current exemption of panel/stage is a latent bug, but fixing panel is out of scope here — only make `side` count).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full gate (merge gate) | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exit 0, final line `visuals-flow check OK` |
| One test file | `cd pipelines/video/visuals-flow && node --test lib/assemble.test.mjs` | exit 0 |
| Rulebook sync | `cd pipelines/video/visuals-flow && node lib/check-shot-rulebook.mjs` | exit 0 |
| Regenerate prompt from constants | `cd pipelines/video/visuals-flow && node lib/build-shot-prompt.mjs` | rewrites the generated block in the prompt |

**Never** author a test command as `node --test <dir>/` — it fails on node 22.14 (LESSONS 2026-07-09). Use explicit files, as `scripts/check.sh` already does.

## Scope

**In scope** (only these paths):
- `pipelines/video/visuals-flow/lib/shot-constants.mjs`
- `pipelines/video/visuals-flow/lib/resolve-shots.mjs` + `.test.mjs`
- `pipelines/video/visuals-flow/lib/lint-shots.mjs` + `.test.mjs`
- `pipelines/video/visuals-flow/lib/avatar-render.mjs` + `.test.mjs`
- `pipelines/video/visuals-flow/lib/assemble.mjs` + `.test.mjs`
- `pipelines/video/visuals-flow/lib/export-timeline.mjs` + `.test.mjs`
- `pipelines/video/visuals-flow/lib/render.mjs` + `.test.mjs`
- `pipelines/video/visuals-flow/lib/check-shot-rulebook.mjs`
- `pipelines/video/visuals-flow/lib/board.mjs` + `.test.mjs`
- `pipelines/video/visuals-flow/steps/070-shot-pass-llm/shot-pass-prompt.md`
- `pipelines/video/visuals-flow/steps/070-shot-pass-llm/README.md`

**Out of scope** (looks related — do NOT touch):
- `pipelines/video/card-library/**` — the `side` catalog field, `DESIGN.md`, the `host-stage` card and `tool-intro`'s `head_zone` all belong to plan 151. This plan must not edit any card or the catalog.
- `lib/effects/bubble.mjs`, `planCornerChunks`, `CORNER_CHUNK` — corner bubble stays exactly as-is (owner: out of scope).
- `planPanelGeometry` and every `panel` branch — panel stays functional. You only remove panel from the **prompt's offered modes**, not from the code.
- `videos/**` — no video workdir is edited by this plan.

## Git workflow

- Branch: `advisor/150-vf2-avatar-side-mode`
- Commit per step: `visuals-flow: <step summary>` — no AI footers. Do NOT push.

## Steps

### Step 1: Constants — drop stage, add side

In `lib/shot-constants.mjs`, **remove** `STAGE_HEAD_RADIUS_PX` and **add**:

```js
  SIDE_GRAPHICS_W:    { value: 1200, rule: 'In side mode the motion-graphics card renders 1200px wide at x=0, full canvas height.' },
  SIDE_AVATAR_W:      { value: 720,  rule: 'In side mode the host occupies the right 720px of the canvas, full height, cover-cropped from the source clip. The split is a hard edge — no inset, no corner radius.' },
```

Keep every other constant unchanged.

**Verify**: `cd pipelines/video/visuals-flow && node -e "import('./lib/shot-constants.mjs').then(m=>{const c=m.SHOT_CONSTANTS;console.log(c.STAGE_HEAD_RADIUS_PX===undefined&&c.SIDE_GRAPHICS_W.value===1200&&c.SIDE_AVATAR_W.value===720?'OK':'FAIL')})"` -> `OK`

### Step 2: Resolver — modes become full|panel|side, and mode is REQUIRED

In `lib/resolve-shots.mjs`, replace lines 34-35 with:

```js
    if (span.mode === undefined) { errors.push(`${span.id}: mode is required — must be "full" or "side" ("panel" is supported but not currently planned)`); continue; }
    const mode = span.mode;
    if (mode !== 'full' && mode !== 'panel' && mode !== 'side') { errors.push(`${span.id}: unknown mode "${span.mode}" — must be "full", "panel", or "side"`); continue; }
```

Note the deliberate change: an omitted `mode` is now an **error**, not a silent `full`. That silent default is why every test-03 span came out full-screen.

Update `lib/resolve-shots.test.mjs`: any fixture span missing `mode` must gain one; add a test asserting a span with no `mode` produces an error containing `mode is required`, and a test that `mode: "stage"` is now rejected.

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/resolve-shots.test.mjs` -> exit 0

### Step 3: Job kinds — `avatar-stage` becomes `avatar-side`

In `lib/avatar-render.mjs:43`:

```js
    kind: s.mode === 'side' ? 'avatar-side' : (s.mode === 'panel' ? 'avatar-panel' : 'avatar-full'),
```

Update `lib/avatar-render.test.mjs` fixtures accordingly.

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/avatar-render.test.mjs` -> exit 0

### Step 4: Geometry — `planStageGeometry` becomes `planSideGeometry`

In `lib/assemble.mjs`, **replace** `planStageGeometry` with `planSideGeometry`. Keep the cover-crop maths **byte-identical**; only the signature and the zone source change:

```js
// Side geometry: the host occupies a fixed right-hand column, the motion-graphics
// card the left. The clip is cover-cropped to the column's aspect (scale up, crop
// centre) so the face is never letterboxed or squashed. Dimensions forced EVEN for
// yuv420p. This is the former planStageGeometry maths with a constant zone.
export function planSideGeometry({ canvas, constants, srcAspect = 16 / 9 }) {
  const { w: W, h: H } = canvas;
  const zw = Math.round(constants.SIDE_AVATAR_W.value / 2) * 2;
  const zh = Math.round(H / 2) * 2;
  const zoneAspect = zw / zh;
  // cover: scale so the SHORT side fills, then centre-crop the overflow
  const scaleW = zoneAspect > srcAspect ? zw : Math.round((zh * srcAspect) / 2) * 2;
  const scaleH = zoneAspect > srcAspect ? Math.round((zw / srcAspect) / 2) * 2 : zh;
  return {
    scaleW, scaleH,
    cropW: zw, cropH: zh,
    cropX: Math.round((scaleW - zw) / 2),
    cropY: Math.round((scaleH - zh) / 2),
    x: W - zw,
    y: 0,
    radius: 0,
  };
}
```

At canvas 1920×1080 this returns **exactly**:

```json
{"scaleW":1920,"scaleH":1080,"cropW":720,"cropH":1080,"cropX":600,"cropY":0,"x":1200,"y":0,"radius":0}
```

Add that as a unit test in `lib/assemble.test.mjs`, following the existing `planPanelGeometry returns exact integers, both dimensions even` test (line ~658) as the exemplar.

**Verify**: `cd pipelines/video/visuals-flow && node -e "Promise.all([import('./lib/assemble.mjs'),import('./lib/shot-constants.mjs')]).then(([a,s])=>console.log(JSON.stringify(a.planSideGeometry({canvas:{w:1920,h:1080},constants:s.SHOT_CONSTANTS}))))"` -> `{"scaleW":1920,"scaleH":1080,"cropW":720,"cropH":1080,"cropX":600,"cropY":0,"x":1200,"y":0,"radius":0}`

### Step 5: Assemble — side overlays and the filter chain

In `lib/assemble.mjs`:

1. Rename `stageJobs` → `sideJobs` throughout (the `runAssembly` signature, `loadAssemblyInputs`, the return object). The job filter becomes `j.kind === 'avatar-side'`.
2. Replace the `stageOverlays` block (line ~388) with — note it no longer needs the catalog or a zone, because the zone is now constant:

```js
  const sideOverlays = sideJobs.map(j => ({
    id: j.id, start: j.start, end: j.end, file: j.file, isSide: true
  }));
  overlays.push(...panelOverlays, ...sideOverlays);
```

3. Replace the `o.isStage` branch (line ~646) with an `o.isSide` branch. Because `radius` is 0, the rounded-rect `geq` mask is a no-op and must be **dropped** — a hard-edged column needs no alpha mask:

```js
          } else if (o.isSide) {
            const g = planSideGeometry({ canvas: CANVAS, constants: SHOT_CONSTANTS });
            chain += `[${globalInputIdx}:v]trim=start=${o.trimStart},setpts=PTS-STARTPTS+${adjustedAt}/TB,scale=${g.scaleW}:${g.scaleH},crop=${g.cropW}:${g.cropH}:${g.cropX}:${g.cropY}[${oj}];`;
            chain += `[${lastV}][${oj}]overlay=x=${g.x}:y=${g.y}:eof_action=pass:enable='between(t,${adjustedAt},${adjustedUntil})'[${nextV}];`;
          } else {
```

4. Remove the now-unused `catalog?.cards?.find(...)` lookup that only served stage. Leave the `catalog` parameter itself in place — other code paths use it.

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/assemble.test.mjs` -> exit 0

### Step 6: Card renders at 1200px for side cues — `rewriteCanvas`

Add to `lib/render.mjs`, immediately after `rewriteDuration`, following its exact shape:

```js
// Side-mode cues render the card into the left column instead of the full canvas.
// The hyperframes CLI has no size flag — the canvas comes from the card's own
// data-width — so bake it into the staged HTML, exactly as rewriteDuration does
// for duration. A side-ready card lays out relative to its root, so changing
// data-width is sufficient; a card with hardcoded 1920px CSS is rejected by
// card-library's side gate, not here.
export function rewriteCanvas(html, width) {
  const re = /data-width="(\d+)"/g;
  const values = new Set();
  let m;
  while ((m = re.exec(html))) values.add(m[1]);
  if (values.size === 0) {
    return { html, error: 'no data-width attribute found' };
  }
  if (values.size > 1) {
    return { html, error: `mixed data-width values: ${[...values].sort().join(', ')}` };
  }
  const newHtml = html.replace(/data-width="\d+"/g, `data-width="${width}"`);
  return { html: newHtml, error: null };
}
```

Wire it in the render loop (around line 166) so that when a cue carries `sideMode: true`, `rewriteCanvas(html, SHOT_CONSTANTS.SIDE_GRAPHICS_W.value)` is applied after `rewriteDuration` and before `injectBrand`. A cue without `sideMode` is untouched — existing behaviour must not change.

Add unit tests to `lib/render.test.mjs` for: no `data-width` → error; mixed values → error; single value → rewritten to 1200.

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/render.test.mjs` -> exit 0

### Step 7: Lint — repurpose E6/W6, fix E2, count side against the cap

In `lib/lint-shots.mjs`:

1. **E2** — replace the `s.mode !== 'stage'` exemption with `s.mode !== 'side'`. A `side` span is *expected* to overlap a fullframe cue.
2. **E6/W6** — rename `stageSpans` → `sideSpans` (`s.mode === 'side'`). Keep the coverage logic identical in shape: exactly one covering fullframe cue, else `E6 side-coverage: side span <id> has no covering cue` / `... crosses two cues`. **Replace the `head_zone` check** with a `side` capability check:

```js
        if (!cardDef?.side) {
          errors.push(`E6 side-coverage: side span ${s.id} covering card ${c.slug} is not side-capable (catalog "side" is not true)`);
        }
```

   Keep `W6 side-outlives` with the same semantics.
3. **E4 budget** — line 89 becomes:

```js
  const fullSpans = spans.filter((s) => s.mode !== 'panel');
```

   so `side` counts against `AVATAR_FULL_CAP` (it burns the same HeyGen render seconds). `panel` keeps its existing exemption — changing panel is out of scope.

Update `lib/lint-shots.test.mjs`: rename the stage cases to side, and add a case where a side span covers a card with `side: false` → expect the E6 error.

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/lint-shots.test.mjs` -> exit 0

### Step 8: Export timeline — side FCPXML branch

In `lib/export-timeline.mjs`, replace the `c.isStage` branch with `c.isSide`, calling `planSideGeometry({ canvas: { w, h }, constants: SHOT_CONSTANTS })`. The crop/transform arithmetic below it is **unchanged** — it already derives everything from the geometry object, and `planSideGeometry` returns the same keys. Update the import from `planStageGeometry` to `planSideGeometry`.

Update `lib/export-timeline.test.mjs` fixtures from stage to side.

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/export-timeline.test.mjs` -> exit 0

### Step 9: The rulebook — make mode a real decision

Rewrite `steps/070-shot-pass-llm/shot-pass-prompt.md`. This is the heart of the plan; the code changes above are worth nothing if the model still picks `full` every time.

**9a. The Modes block** (currently lines 38-40) becomes prescriptive and drops `panel` from the offered set:

```markdown
## Modes — every span MUST declare one

`mode` is REQUIRED on every span. There is no default; omitting it is an error.

- `"full"` — the host takes the whole frame. Use when the host IS the content:
  the intro, the conclusion, a verdict, a reaction, a transition between tools.
  Nothing on screen competes with them.
- `"side"` — motion graphics fill the left 1200px, the host the right 720px, for
  the whole span. Use when the host is talking about a point that HAS a graphic:
  a claim with evidence, a comparison being narrated, a takeaway being explained.
  The graphic and the host are both load-bearing.

A `side` span MUST be covered by exactly one fullframe cue, and that cue's card
MUST be side-capable (listed under "Side-capable cards" below). A `side` span
that covers a card not on that list is a defect.

Prefer `side` whenever a fullframe graphic already occupies the window and the
host has something to say over it — that is the case this mode exists for. Reach
for `full` when the host needs the frame to themselves.
```

**9b. Rule 5** becomes mode-scoped:

```markdown
5. A `full` span must NEVER overlap a fullframe graphics cue — those windows are
   listed below; plan around them. A `side` span is the opposite: it REQUIRES a
   covering fullframe cue whose card is side-capable. Overlay cues are fine to
   overlap in either mode.
```

**9c. Rules 2, 3 and 4** — replace the phrase "full-screen host moment"/"full-screen time" with "host moment"/"host time" wherever it means *any* host presence rather than specifically `mode: "full"`. Rule 3's cadence requirement is about the host being present, not about the mode.

**9d.** Add a `<SIDE_CAPABLE_CARDS>` placeholder section immediately after the `<FULLFRAME_CUES>` section:

```markdown
## Side-capable cards (a `side` span may only cover one of these)

<SIDE_CAPABLE_CARDS>
```

**There is no script that fills these placeholders** — `<FULLFRAME_CUES>` is filled by the operating session before it pastes the prompt (`steps/070-shot-pass-llm/README.md`: *"paste the prompt only (`shot-pass-prompt.md`, placeholders filled) into the executor"*). Do not invent a filler script; follow the existing convention.

Instead, add the exact fill command to `steps/070-shot-pass-llm/README.md` next to the existing placeholder instruction:

````markdown
Fill `<SIDE_CAPABLE_CARDS>` with:

```bash
node -e "const c=require('../../../card-library/catalog.json');const s=(c.cards||[]).filter(x=>x.placement==='fullframe'&&x.side===true).map(x=>'- '+x.slug);console.log(s.length?s.join('\n'):'(none yet — no side spans may be planned)')"
```
````

Run that command yourself now and confirm it prints `(none yet — no side spans may be planned)`. **That is the correct output until plan 151 lands**, and it means the shot pass cannot plan a side span yet — which is intended, not a bug.

**9e.** Run `node lib/build-shot-prompt.mjs` to regenerate the constants block, and update `lib/check-shot-rulebook.mjs` so it no longer asserts the removed `STAGE_HEAD_RADIUS_PX` line and does assert the two new SIDE constants.

**Verify**: `cd pipelines/video/visuals-flow && node lib/check-shot-rulebook.mjs && grep -c "stage" steps/070-shot-pass-llm/shot-pass-prompt.md` -> exit 0 from the first command, and `0` from the grep

### Step 10: Board — make `side` visible on the storyboard

The storyboard is where the owner reviews avatar placement AND mode (decisions.md 2026-07-24: *"Storyboard review scope = COMPOSITION ONLY: where screen recording, where which motion graphic, where the avatar and in which presentation mode"*). Today `lib/board.mjs` cannot show a side span as anything but a full one:

```js
      const label = origSpan.mode === 'panel' ? '[P]' : '[A]';   // lines 770 and 862
```

A `side` span falls through to `[A]` — identical to full. That is the same "computed on one surface, never consumed on the next" failure this plan exists to fix, and it would leave the owner unable to review mode on the surface built for it.

1. At **both** line 770 and line 862, replace the binary label with a three-way map:

```js
      const label = origSpan.mode === 'panel' ? '[P]' : (origSpan.mode === 'side' ? '[S]' : '[A]');
```

2. At line 1086, change the silent fallback so a missing mode is visible rather than reading as `full`:

```js
    const mode = shots?.resolved?.find(s => s.id === span.id)?.mode || '?';
```

Add a test to `lib/board.test.mjs` asserting a `side` span renders `[S]` and a `full` span renders `[A]` — following whatever existing board test covers span labels.

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/board.test.mjs && grep -c "\[S\]" lib/board.mjs` -> exit 0 and `2`

### Step 11: Prove the pixels

Add an integration test to `lib/assemble.test.mjs` following the existing `Integration: ffmpeg runAssembly panel composite` test (line ~718) as the exemplar. It must:

- generate a solid **blue** clip as the avatar source and a solid **black** base;
- run `runAssembly` with one `avatar-side` job;
- extract a frame and sample mean luma **inside** the side box (x 1200–1920) and **outside** it (x 0–1200);
- assert inside ≈ blue luma (±10) and outside ≈ black (±10).

The outside assertion is the one that matters: it proves the avatar did **not** take the full frame. A test that only samples inside would pass even if side silently degraded to full-screen — the exact failure this plan exists to fix.

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/assemble.test.mjs` -> exit 0, and the new test name appears in the pass list

### Step 12: Full gate

**Verify**: `cd pipelines/video/visuals-flow && bash scripts/check.sh` -> exit 0, final line `visuals-flow check OK`

## Test plan

- **Unit**: `planSideGeometry` exact-integer test; `rewriteCanvas` three cases; resolver required-mode and rejected-stage cases; lint E6 side-coverage (no cover / two covers / non-side-capable card) and E4 counting side.
- **Integration**: the ffmpeg composite test in Step 10 — inside AND outside sampling.
- **Rulebook**: `node lib/check-shot-rulebook.mjs` proves prompt and constants agree.
- **Regression**: the full `scripts/check.sh` suite must stay green; no existing test may be deleted to make it pass. Renaming stage fixtures to side is expected; deleting a test case is not.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow && bash scripts/check.sh` exits 0
- [ ] `grep -ric "stage" lib/*.mjs steps/070-shot-pass-llm/shot-pass-prompt.md | grep -v ':0$'` returns nothing (zero stage references outside of unrelated words — verify any hit is a false positive like "stagedDir" and rename the check accordingly; `stagedDir` in `render.mjs` is legitimate and must be excluded by using `grep -o "\bstage\b"`)
- [ ] `node -e "…planSideGeometry…"` prints exactly `{"scaleW":1920,"scaleH":1080,"cropW":720,"cropH":1080,"cropX":600,"cropY":0,"x":1200,"y":0,"radius":0}`
- [ ] `node lib/check-shot-rulebook.mjs` exits 0
- [ ] The prompt contains a `## Modes — every span MUST declare one` section, a `## Side-capable cards` section, and zero occurrences of the word `stage`
- [ ] A span with no `mode` produces an error containing `mode is required`
- [ ] `grep -c "\[S\]" lib/board.mjs` returns `2` — a side span is distinguishable from a full one on the storyboard (screenshot in the PR, since `ui: true`)
- [ ] The new ffmpeg side-composite test passes and asserts BOTH inside and outside luma
- [ ] `git diff --stat 525d5ba..HEAD --name-only` lists only paths from the In-scope list

## STOP conditions

- **Any file under `pipelines/video/card-library/` needs editing.** Stop and report. Plan 151 owns the catalog `side` field, `DESIGN.md`, the `host-stage` card and `tool-intro`'s `head_zone`. If a test appears to need a real side-capable card, use a **fixture** catalog object in the test, never the real catalog.
- **`planPanelGeometry`, any `panel` branch, `planCornerChunks`, `CORNER_CHUNK` or `lib/effects/bubble.mjs` would change.** Panel and corner bubble are deliberately untouched. Removing panel from the prompt's offered modes is correct; removing panel *code* is not.
- **A test must be deleted to get the suite green.** Renaming a stage fixture to side is expected. Deleting coverage is a signal the change is wrong — stop and report.
- **The ffmpeg composite test cannot distinguish side from full-screen.** If you cannot make the outside-the-box assertion fail when side is wired to full-canvas geometry, the test is not proving anything — stop and report rather than shipping a test that cannot fail.

## Maintenance notes

- The `<SIDE_CAPABLE_CARDS>` injection is the coupling point with plan 151. Until a card declares `side: true`, the shot pass correctly cannot plan any side span. Reviewers should confirm the "(none yet)" path is exercised rather than crashing.
- `panel` is now code-live but rule-dead: reachable only by hand-editing `shots.json`. That is the owner's deliberate choice (2026-07-25), not an oversight. If panel is ever revived, its prompt block and an E2 exemption review are the two places to touch.
- The E4 asymmetry is deliberate and worth scrutiny at review: `side` counts against the cap, `panel` does not. Panel's exemption predates this plan and was left alone to keep scope tight; it is probably also wrong and should be revisited when panel is un-parked.
- The silent `?? 'full'` default is the specific bug that made test-03 all full-screen. If a future change reintroduces a default for `mode`, that regression is invisible in every gate — this plan's required-mode test is the only thing guarding it.
