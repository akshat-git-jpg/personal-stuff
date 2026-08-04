<!-- boss frontmatter -->
---
executor: agy
model:                   # blank = agy default (Gemini 3.1 Pro High)
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
                         # after this plan, check.sh's board suite asserts the SPA-served /
                         # (redirect, title, API) and the smoke asserts all four tabs of the
                         # final board — the gate fails on a broken cutover.
ui: true                 # user-facing — crew must attach screenshots of ALL FOUR tabs post-cutover
deploy:                  # no deploy — localhost tool
needs: ["173"]
---

# Plan 174: Final Cut + Calibrate in the SPA, and the cutover — `/` serves the React board

## Summary

- **Problem statement**: After plans 169–173 the SPA has Run, Card Plan, and Storyboard, but Final Cut (Gate 3, step 120) and Calibrate still only exist in the legacy pages — and the legacy board still owns `/`. Final Cut is the odd one out the owner named: no video picker, and its "Approve final cut" button lives inside the Comments panel instead of the topbar.
- **Goals**:
  - Final Cut tab in the SPA: version select, scrubber + click transport + keyboard layer, pin-to-frame notes, comments panel with edit/delete/status, image attach, live status polling — with **Approve final cut in the shared action slot** and the **shared video picker** (both gaps closed by construction).
  - Calibrate ported as an SPA route (`#calibrate`, linked from the Storyboard secondary row, not in the tab strip).
  - **Cutover**: `/` serves the SPA; legacy render functions and their emitted CSS/JS deleted from `lib/board.mjs`; `/list` and `/calibrate` 302 to the SPA equivalents; `steps/080-approve-storyboard-human/run.sh` builds the UI if stale.
  - `lib/board.test.mjs` updated by the explicit disposition table below — every page-HTML assertion gets a named replacement (API test or smoke assertion), server-contract tests stay byte-identical.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — port sources pinned to line numbers; disposition table inlined; cutover is mechanical.
- **Done criteria** (terse): `bash scripts/check.sh` exit 0; `/` serves the SPA (302 → 200 with `<div id="root">`); smoke asserts all four tabs incl. Final Cut's approve-in-slot and picker; legacy render code gone.
- **Stop conditions** (terse): server POST/GET data contracts frozen; keep exported pure helpers tests import; do not delete a test without applying its dispositioned replacement.
- **Test / verification for success**: updated node suite + full smoke + the four-tab screenshot set with y-position stability (the redesign's acceptance proof).
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat adda9be..HEAD -- pipelines/video/visuals-flow/`
> Plans 169–173 must be merged. If not, STOP.

## Status

- **Priority**: high
- **Effort**: large
- **Risk**: medium-high — deletes the legacy surface
- **Depends on**: plan 173
- **Category**: feature + migration cutover
- **Planned-at SHA**: `adda9be`

## Why this matters

This plan delivers the owner's problems #1 and #2 end-to-end: after it, every tab — Final Cut included — lives under the one persistent header with the one picker and the right-aligned gate action, and the teleporting-chrome board is gone. The cutover is deliberately last: the owner reviews live videos daily, and until this merge the legacy board at `/` stayed fully functional.

## Current state (facts, verified at adda9be — board.mjs line numbers)

- **Final Cut markup** (lines ~1745–1800): version `<select id="fc-version">`; scrubber `#fc-scrub` (progress-painted range); transport `#fc-transport` (Play/Pause, clock `mm:ss:ff` current / `mm:ss` duration, ±5s, frame step ‹›, speed select 0.5–2×, mute); video container with `#fc-pin-marker` dot; kbd hint block; right panel (400px): Comments h3 + **`#fc-approve-btn` inside the panel (the misplacement this plan fixes)**, comments list, comment textarea (disabled until pause), Send + image attach + preview chip. **No `.sticky-header`, no picker — replaced by the shared header.**
- **Final Cut JS** (lines ~1905–2215): `initFinalCut` (once; version list REVERSED so newest first; 2.5s status poll while tab visible); `loadFcVersion` (video src `/video/<label>`, `/status` fetch, enable approve); comments rendered from `fcItems` keyed `final-<label>:<n>` (timecode link seeks + shows pin; image thumbnail from `/feedback-image/<key>`; ✎ edit via `prompt`, ✕ delete via `confirm`, both blocked for folded; status chip from `claude_status.json` items — fixed/question/other coloring); pause→enable input focused with `Type comment for mm:ss…`; play→disable+clear; click on video = pause OR set pin `{x,y}` percentages; transport math: `FC_FPS = 30`, `fmtClockFrames` counts WHOLE frames (owner-reported bug fix, lines ~2060–2073 comment — port the comment too); keyboard layer (lines ~2108–2134): Space/←/→(±5s)/Shift+arrows(frame) when not in a field, "just start typing" pauses and focuses the box, empty-box transport passthrough; **the key handler gates on `tab-final-cut` display — in React gate on `tab === 'final-cut'` instead**; submit: POST `/feedback-final` `{ label, item: { text, t, context, x?, y? }, image? }` → append to local items, no reload; Enter=send, Shift+Enter=newline; image: paste or file, 6MB cap (reuse plan 171's `validateImageFile`).
- **Calibrate** (lines ~2621–2658): one tile per beat card (`slug · max_beats · max_reveal_chars` header, preview iframe `/calibrate-card/<slug>`, overflow probes). API: `/api/calibrate-data` (plan 169). Port: `CalibrateTab.tsx` reusing the preview + overflow-badge pieces; route `#calibrate` (add to router `HASH_TAB`/`TAB_HASH` but NOT to `TABS` — the strip keeps four tabs; reach it from the Storyboard secondary-row `calibrate` link).
- **Server routes that stay** (all data/media endpoints): `/api/*`, `/card/*`, `/calibrate-card/*`, `/slice/*`, `/vo.mp3`, `/run-log`, `/run-videos`, `/save`, `/approve*`, `/card-feedback`, `/feedback-final*`, `/feedback-image/*`, `/status`, `/versions`, `/video/*`. The bare-URL→`?video=` 302 stays.
- **To delete from board.mjs**: `renderTimelinePage`, `renderBoardPage`, `renderCalibratePage`, `buildDetailBlocks`, `REV_BOX`, `BOARD_CSS`, `TIMELINE_CSS`, `RUN_CSS`, `SAVE_ACTIONS_JS`, `OVERFLOW_BADGE_JS`, `INIT_BLOCK_JS`, and their route bodies for `GET /`+`/index` (now `serveUi`), `GET /list`, `GET /calibrate` (now 302s). **KEEP**: `FX_SIM_HELPERS`/`fxContext`/`fxEventsAt`, `PLAYTHROUGH_HELPERS`/`playthroughView`, `buildSegments`, `synthCalibrationVars`, `timecode` (used by `handleSave`'s gap refs, line ~2321), `escapeHtml` if still referenced, `injectShim`, all `handle*`/`serve*`/`merge*`/`load*` server functions, `saveFeedbackImage`/`dropFeedbackImage`, `appendFinalFeedback`, `pinFromClick`, `toggleAuditAccepted`, `requestedWorkdir`, `latestWorkdir`, `resolveAndExtend` — tests import all of these from `./board.mjs`.
- **`steps/080-approve-storyboard-human/run.sh`** (launches the board): currently audit-gate then `node lib/board.mjs "$@"`.

## Commands you will need

```bash
cd pipelines/video/visuals-flow
(cd board-ui && npx vitest run) && (cd board-ui && npm run build)
node scripts/board-ui-smoke.mjs
node --test lib/board.test.mjs
bash scripts/check.sh
node lib/board.mjs test-01     # manual: http://localhost:4322/?video=test-01#final-cut
```

## Scope

**In scope:**
- `board-ui/src/tabs/{FinalCutTab,CalibrateTab}.tsx` + CSS (new); `board-ui/src/lib/router.ts` (add `#calibrate`); `board-ui/src/App.tsx` (wire both; FC actions/meta)
- `lib/board.mjs` (cutover: `/` → serveUi; `/list`,`/calibrate` 302; deletions per Current state)
- `lib/board.test.mjs` (disposition table below)
- `scripts/board-ui-smoke.mjs` (final-cut + calibrate + post-cutover `/` assertions)
- `steps/080-approve-storyboard-human/run.sh` (build-if-stale)
- `decisions.md` (visuals-flow's — append the cutover entry), `PIPELINE.md` + `README.md` (board references)
- `board-ui/test/fcTransport.test.ts` (new)

**Out of scope (do NOT touch):** every server data endpoint's request/response shape; `lib/board-data.mjs`; `lib/board-api.test.mjs`; `scripts/check.sh`; `videos/**`; `card-library/**`.

## Steps

1. **`FinalCutTab.tsx`** — port per Current state. Layout: left column (version-scoped player) + right Comments panel (`--panel` bordered card, like today, MINUS the approve button). Header wiring: `meta` = `final cut review`; `actions` = `<button className="approve" disabled={!version}>Approve final cut</button>` → `POST /approve-final-cut {version}` → refetch; `secondary` = the version select (`#fc-version`) — a version choice is context, not a gate action. Pure transport helpers into `board-ui/src/lib/fcTransport.ts`: `fmtClock`, `fmtClockFrames` (whole-frame counting + the two legacy comment blocks explaining WHY), `clampSeek(t, dur, delta)`, `frameStep(t, dir, fps)` — vitest: `fmtClockFrames(5 + 1/30)` → `00:05:01` (the exact bug the legacy comment documents), clamp bounds, frame step pause semantics tested in the component's handler (state assertion).
2. **`CalibrateTab.tsx`** — per Current state; router gains `#calibrate` (not in the strip); Storyboard secondary-row link becomes `#calibrate` (replacing the legacy `/calibrate` href).
3. **Cutover in `lib/board.mjs`:**
   - `GET /` + `/index` (post-redirect) → `serveUi(res, '/app/')` (reuse the plan-170 helper; it serves `index.html` — `base:'./'` makes assets resolve under `/`… **assets**: with `base:'./'` the built index.html references `./assets/x.js`, which under `/` resolves to `/assets/x.js` — extend `serveUi` so it also handles `/assets/*` when called from `/`: add a route `GET /assets/*` → serve from `UI_DIST/assets`).
   - `GET /list` → 302 `/{search}#storyboard` preserving `?video=`; `GET /calibrate` → 302 `/{search}#calibrate`. (Fixes the legacy bug where /list's tab links dropped `?video=`.)
   - Delete the legacy functions/consts per Current state. `node --check lib/board.mjs` after.
4. **`steps/080-approve-storyboard-human/run.sh`** — before launching the board:
   ```bash
   ui_dir="$(dirname "$0")/../../board-ui"
   if [ ! -d "$ui_dir/node_modules" ]; then (cd "$ui_dir" && npm ci); fi
   if [ ! -f "$ui_dir/dist/index.html" ] || [ -n "$(find "$ui_dir/src" -newer "$ui_dir/dist/index.html" -print -quit)" ]; then
     (cd "$ui_dir" && npm run build)
   fi
   ```
5. **`lib/board.test.mjs` disposition** — apply EXACTLY; every test not listed stays byte-identical:

   | Legacy test (line @adda9be) | Disposition |
   |---|---|
   | 48 `/list` cue ids + Approve | REWRITE: `/api/board-data` lists every cue id in `segments[].cueId`; `/list` returns 302 to `/#storyboard` preserving `?video=` |
   | 62 `/` lanes + `/list` link | REWRITE: `/` (with `?video=`) returns 200 containing `id="root"`; lanes are smoke's (`.tl-ruler`, `.tl-block`) |
   | 81 inert data-src | DELETE — dock lazy-mount is smoke's `#detail-panel` placeholder assertion (plan 173) |
   | 93 effects markers on `/` | REWRITE: API `effects.instances` verbatim + `fx` block present (already in board-api.test.mjs §6) — delete the page fetch |
   | 292 `/list` gap timecodes/order/highlight/minimap | REWRITE: assert on API `segments` (order, gap ids, `highlights` non-empty for the anchored cue) |
   | 320/356/388/416/448 feedback family | KEEP server halves (POST /save → feedback.json). Where they fetch `/` for prefill/folded rendering: assert `/api/board-data`.`feedback` instead |
   | 554 calibrate tiles | REWRITE: `/api/calibrate-data` card count (already exists — just delete the page fetch); `/calibrate` 302s to `/#calibrate` |
   | 716/753 renderBoardPage layouts | DELETE (function gone) — shots-null vs shots-present is API §6 + smoke |
   | 858/871 effects lane presence | REWRITE: API `effects === null` ↔ file absent; lane rendering is smoke |
   | 1091/1391 card plan page | REWRITE: API `cardPlan.sections` verbatim (incl. the spec-line string that must not be double-escaped — assert the RAW `does` text round-trips); rendering is plan 171's smoke |
   | 1136 approve-card-plan banner | KEEP POST assertions; banner wording moves to smoke (assert `build the NEW cards` appears on #card-plan when approved with toBuild>0 — extend smoke fixture card-plan.json with one `status:"new"` item) |
   | 1235 Run tab + HASH_TAB | REWRITE: smoke asserts Run renders at hash-less URL; API/board serves `/` 200; delete the emitted-JS regexes |
   | 1362 pre-040 approve | KEEP server half (approve on empty storyboard); disabled-button is smoke (plan 172) |
   | 1425 run emoji / 1445 page title | REWRITE into smoke: dump-dom contains the emoji set for the fixture statuses; `<title>` equals `<video> — visuals-flow board` (SPA sets it — verify App does; if missing, add `document.title = …` on data load) |
   | 1474–1551 screenshot family | KEEP (pure server: /save, /feedback-image, folded, orphan cleanup) |
   | 1571/1591 attach control ×3 parity | DELETE both — the trap they guarded (three fbBox copies) is structurally gone; the single `FeedbackBox` + smoke `.fb-attach` assertion (plan 171) replaces them. Note this in the test file where they were |
   | 1611 reviewed ticks | REWRITE into smoke: `data-rid="sb:` and `data-rid="cp:` present; localStorage key literal `board:reviewed:` appears in the bundle is NOT assertable — instead vitest `reviewed.ts` already pins the key (plan 171) |
   | 1640/1669/1688 picker/URL family | REWRITE: 302 redirect test stays (server); "both pickers navigate" becomes ONE picker — smoke asserts exactly one `#videoPicker` across all tabs; URL-wins is vitest on `videoFromSearch` + smoke fixture (`?video=` renders that video's name in the header) |
6. **Smoke additions**: `#final-cut` — `Approve final cut` INSIDE `.action-slot`; `#videoPicker` present; `#fc-transport` and `#fc-scrub` present; comments panel does NOT contain an approve button. `#calibrate` — ≥1 calibrate tile. Post-cutover `/`: `curl` 302 without `?video=`, 200 with, body contains `id="root"`; `/list?video=x` → 302 Location `/?video=x#storyboard`.
7. **Docs**: visuals-flow `decisions.md` — dated entry: board UI rewritten as React/Vite SPA (`board-ui/`), owner decision 2026-07-30, one shared header/action-slot, legacy server-rendered pages deleted, server API unchanged. `PIPELINE.md`/`README.md`: any `/list` or board-usage references updated (grep `rg -n "board|/list" PIPELINE.md README.md` and fix what's stale).
8. **Full verification**: `bash scripts/check.sh` → exit 0. Screenshot ALL FOUR tabs at 1400×1000 on test-01 into `.test-tmp/board-ui-smoke/` and attach to the PR; the smoke's y-stability assertion output (tabs.y/slot.y identical) quoted in the PR body — this is the redesign's acceptance proof.

## Test plan

Disposition table (step 5) + smoke extensions (step 6) + `fcTransport.test.ts`. After this plan the suite composition is: server contracts (node --test, unchanged), API contracts (board-api.test.mjs), pure client logic (vitest), rendered app (smoke).

## Done criteria (machine-checkable)

```bash
cd pipelines/video/visuals-flow
bash scripts/check.sh                                     # exit 0
node scripts/board-ui-smoke.mjs                           # 'board-ui smoke OK' — all four tabs + cutover
rtk proxy grep -c "renderTimelinePage\|renderBoardPage\|SAVE_ACTIONS_JS" lib/board.mjs   # 0 (or grep exits 1)
curl -s -o /dev/null -w '%{http_code}' "http://localhost:PORT/?video=test-01"            # 200 (manual, board running)
```
Plus the four-tab screenshot set + y-stability numbers in the PR.

## STOP conditions

- Any exported symbol in the KEEP list breaking a `board.test.mjs` import → STOP; deletions overreached.
- A disposition-table row that can't be applied as written (test asserts something with no replacement) → STOP and report the row; do not silently delete coverage.
- Final Cut behavior drift (frame-clock, pin, Enter-to-send, folded read-only) — these are owner-reported fixes with dated comments; port comments and behavior together.
- Never write outside the repo.

## Maintenance notes

- After this plan the legacy board is GONE — a future "why does /list 302" question is answered by the visuals-flow decisions.md entry this plan writes.
- The smoke script is now the board's rendered-truth gate; when adding a tab or control, add its assertion there in the same PR.
- `board-ui/dist` is build output: gitignored, rebuilt by steps/080 on staleness. If the board looks stale after a pull, `cd board-ui && npm run build`.
