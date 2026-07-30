<!-- boss frontmatter -->
---
executor: agy
model:                   # blank = agy default (Gemini 3.1 Pro High)
test_cmd: cd pipelines/video/visuals-flow-2 && bash scripts/check.sh
                         # smoke gains timeline-mode assertions this plan (lanes render,
                         # dock reveals a tile with an inert-then-loaded iframe, zoom row).
ui: true                 # user-facing — crew must attach screenshots (timeline mode, docked detail, FX stage)
deploy:                  # no deploy — localhost tool
needs: ["172"]
---

# Plan 173: Storyboard in the SPA, part 2 — timeline canvas, detail dock, master play-through, FX stage

## Summary

- **Problem statement**: Plan 172 shipped the storyboard's list mode; the board's default landing view — the horizontal editor-style timeline (SCREEN/GRAPHICS/AVATAR lanes on one ruler, click-to-dock previews, global play-through, FX timing preview) — still only exists in the legacy page.
- **Goals**:
  - Timeline mode of the Storyboard tab: lane canvas with zoom/ruler/playhead, block click → detail dock showing the SAME `CueTile`/`GapBlock`/`ShotBlock` components (lazy iframe load on reveal), derivatives fold (EFFECTS/SOUND lanes, localStorage `board:tl-derivatives`), master audio play-through that follows the active block, SFX preview toggle, and the fixed-position FX simulation stage.
  - Timeline/List toggle in the secondary row goes live (state persisted in localStorage `board:sb-view`, default timeline — the legacy default landing view).
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — every ported behavior is pinned to legacy line numbers; layout math and stage logic inlined or in-repo.
- **Done criteria** (terse): `bash scripts/check.sh` exit 0 with the timeline smoke assertions; playhead/dock/zoom behaviors demonstrated in PR screenshots.
- **Stop conditions** (terse): tile look untouched; no changes to server or legacy pages; FX stage is a TIMING preview, not a look preview (keep the disclaimer).
- **Test / verification for success**: vitest on the pure layout/playthrough helpers; smoke on the rendered timeline; screenshots.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat adda9be..HEAD -- pipelines/video/visuals-flow-2/board-ui/ pipelines/video/visuals-flow-2/scripts/board-ui-smoke.mjs`
> Plans 169–172 must be merged. If not, STOP.

## Status

- **Priority**: high
- **Effort**: large
- **Risk**: medium-high — the most stateful client surface in the board
- **Depends on**: plan 172
- **Category**: feature (UI)
- **Planned-at SHA**: `adda9be`

## Why this matters

The timeline view is how the owner scans a whole video's composition at a glance and plays it end-to-end (GFX-08: global play-through). It is also where the FX/sound derivative lanes live. Without it the SPA cannot replace the legacy board, and plan 174's cutover cannot happen.

## Current state (facts, verified at adda9be — all board.mjs line numbers, legacy `renderTimelinePage`)

- **Canvas structure** (lines ~1705–1742): `.tl-layout` = `.tl-canvas-wrap` (scrollable) + `#detail-panel` aside (sticky, 520px). Canvas: `.tl-labels` sticky-left column (SCREEN / GRAPHICS / AVATAR labels, spacer, derivatives-fold block with EFFECTS + optional SOUND) beside `.tl-tracks`: ruler, screen bar track, graphics track (`.tl-block` per resolved cue: `data-start/dur/detail`, color by flag/placement, label = card basename), avatar track (`.tl-block` per span, `--shot` background, `id (mode)` label), a 24px toggle track holding the `details ▸` fold button + a small `Approve effects` button, then the folded EFFECTS (`.tl-mark` whips/beats, `.tl-span` ranges, `.tl-chip` for captions/bubble) and SOUND (`#fcd34d` marks) tracks, and `.tl-playhead`. **Port TIMELINE_CSS (lines ~413–439) verbatim.**
- **Layout math** (lines ~1810–1902 client JS): `pxps` (px/sec) from zoom slider; `PXPS_FIT = clamp((wrapWidth - 90) / TOTAL, 0.4, 30)` recomputed on resize (stays fit if it was fit); `layout()` sets track widths and block left/width (`min 2px`); `drawRuler()` ticks every `max(1, round(80/pxps))`s labeled `mm:ss`; ruler click seeks `master.currentTime = offsetX / pxps`.
- **Detail dock** (lines ~1849–1865): detail store holds every block's markup with iframes inert (`data-src`); `reveal(id)` parks the previous node back in the store, moves the target into `#detail-panel`, swaps `data-src`→`src`, wires probes/audio. React version: keep ALL blocks unmounted; dock renders `<CueTile/>`/`<GapBlock/>`/`<ShotBlock/>` for the selected block id only — iframe mounts on first reveal (`loading="lazy"` + src set on mount), unmount on switch. Tile editor STATE (frag text, flag, note, feedback) lives in the tab-level store from plan 172, so docking/undocking never loses edits — this is the React advantage over the legacy DOM-parking hack; preserve the store-owns-state design.
- **Master play-through** (lines ~1867–1894 + `playthroughView` helper, exported at lines ~832–849): `<audio id="master" src="/vo.mp3">` under the overview; on timeupdate move the playhead, pick the last non-shot block with `start <= t` and reveal it, then post `{ t: t - tile.start }` into the docked tile's iframe; playing the master pauses tile audios and vice versa. `playthroughView` (kind cue vs gap with `nextStart`) is ALREADY exported and tested server-side — import the same logic client-side by transcribing it into `board-ui/src/lib/playthrough.ts` with the identical algorithm (5 lines) and vitest it against the same cases as board.test.mjs lines ~233–254.
- **FX stage** (CSS lines ~395–409, JS lines ~1252–1321): fixed 480×270 bottom-right panel, `.on` while master plays; per-frame: context = `fxContext(t, fullframes, spans)` (graphic → shows the fullframe cue id, avatar, screen); fires `fxEventsAt(prevT, t, instances)` → flash (`fx-flash`, whip+style=flash) / whip-blur (`fx-whipblur`) / punch-in (`fx-punch`, beat), 350ms; bubble dot on `ctx-screen` when a bubble instance is enabled; caption chunk text (`capChunks`, highlight words `.hl`) rendered only in screen context; footer note `timing preview — final look is the module's` (keep — it disclaims look-accuracy). `FX_SIM_HELPERS` (fxContext/fxEventsAt, lines ~811–820) — transcribe to `board-ui/src/lib/fxSim.ts`, vitest with board.test.mjs's cases (lines ~969–988).
- **Effects toggles**: `.fx-chip` checkboxes (in the overview, plan 172 rendered them) drive `payload.effects`; toggling also dims the corresponding lane marker (`fx-off`). SFX preview checkbox (`#sfxToggle`, line ~1701) gates sound playback in the master loop — port: when enabled, on crossing a sound instance's `at`, play `/…` — **verify in the legacy source how SFX audio is actually played before porting; if it is not implemented beyond the checkbox, port the checkbox as-is and note it** (do not invent behavior).
- API (plan 169): `fx.fullframes`, `fx.shotSpans`, `fx.capChunks`, `effects.instances`, `sound.instances`, `segments`, `resolved`, `shots.spans`.

## Commands you will need

```bash
cd pipelines/video/visuals-flow-2
(cd board-ui && npx vitest run) && (cd board-ui && npm run build)
node scripts/board-ui-smoke.mjs
bash scripts/check.sh
node lib/board.mjs test-01     # manual: http://localhost:4322/app/?video=test-01#storyboard (timeline mode)
```

## Scope

**In scope:**
- `board-ui/src/components/{TimelineCanvas,DetailDock,FxStage}.tsx` + co-located CSS (new)
- `board-ui/src/lib/{timelineLayout.ts,playthrough.ts,fxSim.ts}` (new)
- `board-ui/src/tabs/StoryboardTab.tsx` (mode toggle goes live; timeline mode wires in)
- `board-ui/test/{timelineLayout,playthrough,fxSim}.test.ts` (new)
- `scripts/board-ui-smoke.mjs` (append timeline assertions)

**Out of scope (do NOT touch):** `lib/board.mjs`, legacy pages, `lib/board.test.mjs`, `scripts/check.sh`, Final Cut (plan 174), `videos/**`.

## Steps

1. **`timelineLayout.ts`** (pure, vitest): `fitPxps(wrapWidth, total)`, `blockRect(start, dur, pxps)` (`{ left, width: max(2, dur*pxps) }`), `rulerTicks(total, pxps)` (`[{ t, label }]`, step `max(1, round(80/pxps))`, label `mm:ss`), `timeAtOffset(x, pxps)`.
2. **`playthrough.ts` + `fxSim.ts`**: transcriptions per Current state; vitest each against the legacy test cases (board.test.mjs lines ~233–254 and ~969–988 — copy the case data, keep expectations identical).
3. **`TimelineCanvas.tsx`**: renders lanes from API data using `timelineLayout`; zoom slider (range `PXPS_FIT..30`), resize handling, ruler click → seek callback; derivatives fold (localStorage `board:tl-derivatives`, exact key) revealing EFFECTS/SOUND lanes + the small `Approve effects` button (same POST as the header one — both stay, matching legacy); block click → `onReveal(blockId)`; playhead positioned from the master clock.
4. **`DetailDock.tsx`**: sticky aside; placeholder `click a block to preview`; renders the selected block through the plan-172 components; tile state stays in the tab store (edits survive undocking).
5. **`FxStage.tsx`**: port per Current state; visible only while the master plays; driven by a `useMasterClock` hook (rAF loop reading the `<audio>` element) shared with the playhead and block-follow logic.
6. **Master audio + mode toggle** in `StoryboardTab.tsx`: `<audio class="scrub" src="/vo.mp3">` in timeline mode; timeupdate → playhead + auto-reveal (non-shot blocks only, lines ~1872–1891 semantics) + postMessage into the docked iframe; Timeline/List toggle live (localStorage `board:sb-view`, default `timeline`), List = plan 172's view unchanged.
7. **Vitest**: the three lib files (step 1–2 cases).

   **Verify:** `cd board-ui && npx vitest run` → green.
8. **Smoke additions** (`#storyboard` timeline mode is now default): `.tl-ruler` present with ≥2 ticks; `.tl-block` count ≥1 in the graphics track; `#detail-panel` (or `.detail-dock`) contains the placeholder text initially; after dump-dom with `&probe=layout`, y-stability still holds (dock must not push the header). Also assert list mode still reachable: a dump of the page contains the mode toggle labels `Timeline` and `List`.

   **Verify:** `node scripts/board-ui-smoke.mjs` → `board-ui smoke OK`.
9. **Screenshots for the PR**: timeline mode on test-01 (lanes + docked tile), zoomed-in state, FX stage visible mid-play (screenshot while `master` playing — use the browser manually; a paused frame with the stage forced `.on` is acceptable if headless timing is flaky, say which).

## Test plan

Vitest on the three pure libs (with legacy-identical cases); smoke assertions; legacy suites green via check.sh.

## Done criteria (machine-checkable)

```bash
cd pipelines/video/visuals-flow-2
bash scripts/check.sh              # exit 0
node scripts/board-ui-smoke.mjs    # 'board-ui smoke OK' — includes timeline assertions
```
Plus PR screenshots (timeline + dock, zoom, FX stage).

## STOP conditions

- Tile visual language changes → STOP (same rule as plan 172).
- `playthrough.ts`/`fxSim.ts` diverging from the legacy algorithms (they are contract-tested server-side) → STOP and reconcile; do not "improve" the algorithms.
- SFX preview: if the legacy checkbox turns out to have no audible implementation, port the checkbox and REPORT it — do not invent playback (LESSONS 2026-07-24: lookalike stubs are the failure mode; honesty about what legacy does is the fix).
- Never write outside the repo.

## Maintenance notes

- `useMasterClock` is the one rAF loop — playhead, block-follow, and FX stage all subscribe. A second loop is a bug.
- The dock deliberately renders components (state in the store) instead of parking DOM nodes like legacy — edits surviving undocking is a behavioral improvement to keep.
- localStorage keys are load-bearing owner state: `board:list-overview`, `board:tl-derivatives`, `board:reviewed:<video>`, `board:sb-view` (new, this plan).
