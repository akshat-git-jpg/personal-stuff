<!-- boss frontmatter -->
---
executor: agy
model:                   # blank = agy default (Gemini 3.1 Pro High)
test_cmd: cd pipelines/video/visuals-flow-2 && bash scripts/check.sh
                         # smoke gains storyboard-tile assertions this plan (tile anatomy,
                         # approve-disabled pre-040, save round-trip via the real server).
ui: true                 # user-facing — crew must attach screenshots (storyboard tiles, reviewed-collapse, pre-040 degraded state)
deploy:                  # no deploy — localhost tool
needs: ["171"]
---

# Plan 172: Storyboard in the SPA, part 1 — tiles, list mode, Save/Approve wiring

## Summary

- **Problem statement**: The SPA (plans 170–171) has a shell, Run, and Card Plan; the board's core review surface — the storyboard tiles with live card previews — still only exists in the legacy pages. The owner explicitly likes the storyboard tile visual language (bordered panel, header line, live card preview, excerpt with highlighted anchor words): it must be PORTED, not redesigned.
- **Goals**:
  - `CueTile` / `GapBlock` / `ShotBlock` React components — pixel-faithful ports of the legacy tiles, each defined once.
  - Storyboard tab in **list mode**: overview block (usage chips, minimap lanes, legend, fold state), ordered tile list with shot blocks spliced by start time, reviewed-collapse (with iframe unload), per-cue audio scrub synced to the card iframe.
  - The full **Save** collector (cues + spans + effects toggles + feedback + images → `POST /save`) and **Approve graphics / Approve shots / Approve effects** in the shared action slot; Save and the rest in the secondary row.
  - The pre-040 degraded board (no `resolved.json`): banner + disabled approve, exactly like legacy.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — the legacy markup/CSS/JS being ported is all in-repo at pinned line numbers; collector and tile skeletons inlined below.
- **Done criteria** (terse): `bash scripts/check.sh` exit 0 with the storyboard smoke assertions; a scripted save round-trip against the real server updates `cues.json` and re-renders.
- **Stop conditions** (terse): tile look changes → stop; server contracts frozen; timeline-canvas mode is plan 173, not this one.
- **Test / verification for success**: vitest on the pure collector; smoke assertions on rendered tiles; a save round-trip driven through the API in `board-api.test.mjs`-style node test is NOT needed (legacy tests already pin /save) — the smoke asserts the UI side.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat adda9be..HEAD -- pipelines/video/visuals-flow-2/board-ui/ pipelines/video/visuals-flow-2/scripts/board-ui-smoke.mjs`
> Plans 169–171 must be merged. If not, STOP.

## Status

- **Priority**: high
- **Effort**: large
- **Risk**: medium — the board's core surface
- **Depends on**: plan 171
- **Category**: feature (UI)
- **Planned-at SHA**: `adda9be`

## Why this matters

This is Gate 2 (080) — where the owner approves what the video will actually look like. The tile language is the one part of the old board the owner asked to KEEP; the redesign's job here is consistency around it, not novelty. Everything already built (header, FeedbackBox, reviewed ticks) plugs in; this plan proves the component model carries the board's heaviest page.

## Current state (facts, verified at adda9be — all board.mjs line numbers)

- **Tile anatomy** (`buildDetailBlocks`, lines ~933–1063). Cue tile (`div.timeline-block.tile.reviewable`, `data-id/rid/card/lead/start`):
  1. `.tile-header.rev-head`: `#id · mm:ss.s → mm:ss.s · <card> · <dur>s · <placement>` (+ audit chip when `audit.cues[id]` exists: verdict-colored `usage-chip` with `fix` as title) + the reviewed tick; unresolved header variant: `#id · unresolved · <card>`.
  2. `.excerpt`: segment words, anchor/beat-anchor matches wrapped in `<mark>` (API `highlights`).
  3. `.anchor` (bold anchor), `.beats` list (`<reveal.text> @ "<anchor>"`).
  4. media: `.preview` (480×270 window, 1920×1080 iframe at scale(0.25)) + `audio.scrub` from `/slice/<id>.mp3`; unresolved → `.unresolved-note`.
  5. flag checkbox (`flag: no card fits`) + `.note` input (why).
  6. FeedbackBox (ref = cue id) + `textarea.frag` (pretty-printed `{ anchor, hold, variables, beats }` JSON).
  Gap block: `.gap-block` fold — header `▸ mm:ss.s → mm:ss.s · Ns · "preview words…"`, body = full words + FeedbackBox (`gap-<mm:ss.s>` ref, timecode() format at line ~805). Shot block: `🧍 <id> [A|P|S] · times · Ns — note`, `textarea.shot-frag` (original span JSON), FeedbackBox (ref = span id). Shot blocks splice into the list before the first block with `start >= span.start` (lines ~1041–1060). Tiles inside a shot span get `.in-shot` (purple left border).
  **CSS to port verbatim** (BOARD_CSS): `.timeline-block .tile* .excerpt mark .anchor .beats .preview .unresolved-note .overflow-badge audio.scrub .flag .note textarea.frag/.shot-frag .gap-* .shot-block .in-shot .rev*` (lines ~241–410). Keep class names — the smoke and any owner muscle-memory CSS tweaks depend on them.
- **Overview block** (renderBoardPage lines ~1185–1210): fold button (`overview ▾/▸`, localStorage `board:list-overview`), usage chips (`<cardname> ×N`, `.hot` when N>3), lane rows (graphics minimap: flex-grow=duration segments, colors — flagged `--err`, fullframe `--accent`, overlay `--overlay-seg`, gap `--line`; avatar minimap `--shot`; effects lane; sound lane), legend. Clicking a minimap segment scrolls to its block.
- **Reviewed-collapse iframe unload** (lines ~547–558): collapsing stores `iframe.src` in `data-rev-src` and removes `src` (30+ live card iframes must not stay resident); expanding restores. Port as a `CueTile` effect on the reviewed state.
- **Audio↔iframe sync** (INIT_BLOCK_JS lines ~483–504): `timeupdate/seeked/pause/play` post `{ t: audio.currentTime }` to the tile's iframe; play pauses every other tile's audio; rAF loop while playing.
- **Overflow badges** (OVERFLOW_BADGE_JS lines ~444–477): on iframe load, post `{ probe: probeTimes }` (API `segments[].probeTimes`); listen for `__overflow` messages, accumulate times/offenders into a red `.overflow-badge` on the tile header.
- **Save collector** (lines ~682–741): payload `{ video, approved, cues: [...], feedback, feedbackImages?, spans?, effects? }`; cue = `{ id, card, anchor, hold, variables, beats (from frag JSON), flagged, lead? (from data-lead), note? }`; broken frag JSON → banner `invalid fragment JSON — nothing saved:` and NO save; response `{ ok, errors, warnings }` → banner (`saved — N lint warnings, M errors` breakdown) or `location.reload()` when clean (SPA: refetch board data instead).
- **Approve buttons**: graphics `POST /approve`; shots `POST /approve-shots` (+ `engineMode` usage-chip next to it); effects `POST /approve-effects`. Pre-040: approve graphics disabled with title `nothing to approve until step 040 resolves the cues` (line ~1682); banner explains 040 and links `#card-plan` (line ~1692). Approved banners: graphics `approved — ready for node lib/render.mjs`; shots `shot plan approved — ready for the avatar render step`; effects `effects approved — ready for step 090 assemble`; shots errors banner.
- **Secondary row contents** (owner spec): Save, `n/m reviewed` count, `mark all reviewed`, `expand all`, calibrate link, Timeline/List mode toggle (Timeline mode itself lands in plan 173 — render the toggle with Timeline disabled + title `timeline mode ships in plan 173`).
- API fields (plan 169): everything above is served — `segments` (with `highlights`, `probeTimes`, `inShot`), `shots.fileSpans` vs `shots.spans`, `effects.instances`, `audit`, `approved.*`.

## Commands you will need

```bash
cd pipelines/video/visuals-flow-2
(cd board-ui && npx vitest run) && (cd board-ui && npm run build)
node scripts/board-ui-smoke.mjs
bash scripts/check.sh
node lib/board.mjs test-01      # manual: http://localhost:4322/app/?video=test-01#storyboard
```

## Scope

**In scope:**
- `board-ui/src/components/{CueTile,GapBlock,ShotBlock,Minimap,OverviewBlock,Banner}.tsx` + co-located CSS (new)
- `board-ui/src/lib/{collector.ts,tileSync.ts,overflow.ts}` (new)
- `board-ui/src/tabs/StoryboardTab.tsx` + CSS (replaces the placeholder; keeps the `_global` FeedbackBox)
- `board-ui/src/App.tsx` (storyboard actions/meta/secondary wiring)
- `board-ui/test/collector.test.ts` (new)
- `scripts/board-ui-smoke.mjs` (append storyboard assertions)

**Out of scope (do NOT touch):** the timeline canvas / detail dock / FX stage / master play-through (plan 173); `lib/board.mjs` and all legacy pages; `lib/board.test.mjs`; `scripts/check.sh`; `videos/**`.

## Steps

1. **Pure collector `board-ui/src/lib/collector.ts`** (vitest target — DOM-free):

   ```ts
   export type TileModel = { id: string; card: string; lead: number | '' ; fragJson: string; flagged: boolean; note: string };
   export type CollectResult =
     | { ok: true; cues: CueOut[] }
     | { ok: false; broken: string[] };            // 'c03: Unexpected token …'
   export function collectCues(tiles: TileModel[]): CollectResult { /* port of lines ~683–701 */ }
   export function collectSpans(models: { id: string; fragJson: string }[]):
     { ok: true; spans: unknown[] } | { ok: false; broken: string[] } { /* lines ~704–709 */ }
   export function buildSavePayload(args: {
     video: string; approved: boolean; cues: CueOut[];
     feedback: Record<string, string>; feedbackImages?: Record<string, string | null>;
     spans?: unknown[]; effects?: { id: string; enabled: boolean }[];
   }): object { /* exact legacy field set — spans/effects/feedbackImages only when present, lines ~711–721 */ }
   ```
   StoryboardTab keeps tile editor state (frag text, flag, note) in React state keyed by cue id, seeded from the API; Save = `collectCues` → on broken, error banner and abort; else `fetch('/save', …)` with `buildSavePayload` composed with `savePayloadFeedback` (plan 171); on `ok` → `markSaved()` + refetch board data + warnings banner if any.

2. **`CueTile.tsx` / `GapBlock.tsx` / `ShotBlock.tsx`** — port the anatomy + CSS verbatim from Current state. `CueTile` props: `{ seg, cue, resolved, audit, reviewed }`; internals: lazy iframe (`loading="lazy"`, src `/card/<id>` — with reviewed-collapse unloading via state, not data attributes), audio scrub wired by `tileSync.ts` (port of INIT_BLOCK_JS as a hook `useTileSync(audioRef, iframeRef)`), overflow badge via `overflow.ts` (port of OVERFLOW_BADGE_JS as `useOverflowBadge(iframeRef, probeTimes)` returning the badge model `{ times, offenders }` rendered inline — React-idiomatic, no DOM search).
3. **`OverviewBlock.tsx` + `Minimap.tsx`** — usage chips, lanes, legend, fold with `board:list-overview` (exact key), minimap click scrolls to `document.getElementById(blockId)`.
4. **`StoryboardTab.tsx`** — order blocks: unresolved cue tiles first, then segments, shot blocks spliced by start (pure `spliceShotBlocks(blocks, spans)` helper — vitest it with the splice cases from lines ~1041–1060); `.in-shot` from API `inShot`; `_global` FeedbackBox above the list (kept from plan 171); reviewed-collapse via `useReviewed` (rid `sb:<id>`), `mark all reviewed` / `expand all` in secondary row; pre-040: no tiles → the 040 banner, approve disabled.
5. **Wire the header** (App.tsx): meta `duration: mm:ss.s · N graphics · N flagged`; actions (in this order): `Approve graphics` (disabled pre-040 with the exact legacy title), `Approve shots` when `shots` non-null (with the `engineMode` chip beside it), `Approve effects` when `effects` non-null; each POSTs then refetches. Secondary row: `Save` (accent-styled), reviewed count, mark-all/expand-all, `calibrate` link (`/calibrate` — legacy page until 174), disabled Timeline toggle. Approved/error banners per Current state, dismissable.
6. **Vitest** `collector.test.ts`: happy path (2 tiles → cues with lead/note omission rules: `lead` only when `data-lead !== ''`, `note` only when non-empty); broken JSON aborts with the id-prefixed message; spans collection; payload composition (spans/effects/images only when present).

   **Verify:** `cd board-ui && npx vitest run` → green.
7. **Smoke additions** (`#storyboard` against the smoke fixture workdir — it has resolved.json):
   - tile anatomy: `class="timeline-block tile reviewable"`, `class="excerpt"` containing `<mark>`, `class="preview"` with an iframe whose src starts `/card/`, `audio` with `/slice/`, `textarea` with class `frag`, one `.fb-shot` per feedback box (count `.fb-shot` ≥ number of cue tiles).
   - header: `Approve graphics` inside `.action-slot`; `Save` inside `.app-header-row2`.
   - pre-040 degraded: build a second smoke workdir WITHOUT `resolved.json` (copy only cues/transcript + vo.mp3 + card-plan.json); assert the page renders (dump-dom non-empty, `no <code>resolved.json</code> yet` banner text present) and `Approve graphics` carries `disabled`.
   - y-stability re-runs for all tabs (already in the harness).

   **Verify:** `node scripts/board-ui-smoke.mjs` → `board-ui smoke OK`.
8. **Screenshots for the PR**: `#storyboard` on test-01 (tiles with live previews), one tile reviewed-collapsed, and the pre-040 state on opusclip-vs-submagic (`?video=opusclip-vs-submagic#storyboard`).

## Test plan

Vitest on collector + splice helper; smoke assertions (step 7); legacy suites green via check.sh.

## Done criteria (machine-checkable)

```bash
cd pipelines/video/visuals-flow-2
bash scripts/check.sh              # exit 0
node scripts/board-ui-smoke.mjs    # 'board-ui smoke OK' — includes storyboard + pre-040 assertions
```
Plus PR screenshots (tiles, collapsed tile, pre-040 board).

## STOP conditions

- Any visual redesign of the tile (typography, borders, spacing, the mark highlight, preview size) → STOP. Port, don't reinterpret.
- Any change to `/save`'s request or response shape → STOP (frozen until 174).
- The timeline canvas, detail dock, FX stage, master playhead: OUT — if the tab feels incomplete without them, that is plan 173's job, note it and move on.
- Never write outside the repo.

## Maintenance notes

- `collector.ts` is the single place the save wire format lives client-side; plan 173 adds nothing to it (canvas edits flow through the same tile state).
- The reviewed-collapse iframe unload is a memory-pressure fix (30+ iframes) — if a future change makes tiles remount on collapse, keep the unload semantics.
- Plan 173 reuses `CueTile` inside the detail dock — do not fork it there.
