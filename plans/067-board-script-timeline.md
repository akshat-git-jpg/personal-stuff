---
executor: agy
model:
test_cmd: cd pipelines/video/graphics-flow && node --test lib/board.test.mjs
ui: true
deploy:
needs: ["066 landed (graphics-flow layout)", "living board.mjs — read it fully first"]
---

# Plan 067: Storyboard board — full-script timeline view

## Summary

- **Problem statement**: The board (`graphics-flow/lib/board.mjs`) shows cue tiles as an isolated list — the owner can't see WHERE in the 32-minute video each graphic sits, what's between them, or review the video as a whole. The next phase will add avatar/screen-recording shot plans, and the UI must already be timeline-shaped so that lands without a rebuild.
- **Goals**:
  - Rebuild `GET /` as a vertical script timeline: the ENTIRE transcript in order; cue cards inline at their exact positions; the stretches between cues as collapsed, untyped VO blocks (duration + excerpt, expandable).
  - A fixed horizontal mini-map strip: the whole video as proportional colored segments, click-to-jump.
  - Keep everything that works: per-cue slice players (one playing at a time), live card iframes with injected variables, inline edit → save → re-resolve, flag, approve, no-arg latest-video mode, port 4322, node stdlib only.
- **Executor proposed**: agy / Gemini 3.1 Pro High, its default (owner routing 2026-07-18); render+inspect verification stays on the verifier side
- **Done criteria** (terse): board tests pass (existing + new timeline tests); screenshot of the timeline view on the PR.
- **Stop conditions** (terse): no npm deps; no changes to resolve/render/cards; keep all existing routes working.
- **Test / verification for success**: `node --test lib/board.test.mjs` + PR screenshot (ui: true).
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat bd4896c..HEAD -- pipelines/video/graphics-flow/lib/board.mjs pipelines/video/graphics-flow/lib/board.test.mjs` (must be empty)

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (view-layer rebuild over unchanged data + routes)
- **Depends on**: 066 (landed)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `bd4896c`, 2026-07-18

## Why this matters

Review today means stepping through 21 disconnected tiles; the owner has no sense of pacing (are graphics bunched? is a 5-minute stretch bare?) and no view of the whole video. The timeline view turns review into reading the script top to bottom, previewing graphics exactly where they land. Decided design constraints (owner, 2026-07-18): vertical script-first layout with a mini-map (NOT a horizontal NLE timeline); gap stretches stay UNTYPED for now (the avatar/screen-recording shot-plan schema is the next phase — do not invent it here); per-cue playback only (global play-through is explicitly next phase).

## Current state

All in `pipelines/video/graphics-flow/` (read `lib/board.mjs` fully before editing — it's ~380 lines, node stdlib only):

- `lib/board.mjs`: `createServer(workdir)` exported (tests use it); routes `GET /` (tile list page), `GET /card/<id>` (card HTML with injected `getVariables` shim + postMessage seek listener), `GET /slice/<id>.mp3`, `POST /save` (writes cues.json, re-runs resolver in-process, re-slices), `POST /approve`; ffmpeg slicing on start for stale slices; single-playback rule in the page script ("one video at a time" comment); no-arg mode picks latest `videos/*/cues.json`.
- Workdir data the page already loads: `cues.json` (cue fields incl. `anchor`, `beats[].anchor`, `flagged`, `note`), `resolved.json` (`{video, offset, resolved: [{id, card, placement, start, duration, variables}]}`), `transcript.json` (flat `[{text, start, end}]` word array — ~6k words for 32 min), `vo.mp3`, `slices/`.
- `lib/board.test.mjs`: 6 tests via exported `createServer` + fixture workdir `lib/fixtures/board/` (2 cues; vo.mp3 generated in test setup via ffmpeg sine). The fixture `transcript.json` is tiny — extend it if the timeline tests need more words.
- Page styling: dark utilitarian cockpit (inline CSS template string). Keep that language — this is an internal tool, not a product page. Palette hints already in the CSS (dark bg, accent orange); reuse them.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Tests | `cd pipelines/video/graphics-flow && node --test lib/board.test.mjs` | exit 0 |
| Manual run | `node lib/board.mjs test-01` | timeline at :4322 against the real 21-cue workdir |

## Scope

**In scope**: `lib/board.mjs`, `lib/board.test.mjs`, `lib/fixtures/board/*` (fixture data only if needed), `PIPELINE.md` (update the step-040 description line).

**Out of scope**: resolve.mjs, render.mjs, transcribe, cards, catalog, rulebook, any new npm dependency, any shots.json/avatar-span schema (next phase), global play-through (next phase).

## Git workflow

- Branch: `advisor/067-board-script-timeline`
- Commit per step, e.g. `feat(graphics-flow): board script-timeline view`. No AI footers. Do NOT push.

## Steps

### Step 1: Segment model (pure function, exported)

Add exported `buildSegments(words, resolved, { gapMinWords = 8 } = {})` returning an ordered array covering the whole transcript:

```js
[
  { kind: 'gap', start, end, words: [...] },                    // stretch with no cue
  { kind: 'cue', cue, start, end, words: [...] },               // words inside [cue.start, cue.start+cue.duration)
  ...
]
```

Rules: cues sorted by `start`; a cue's span = `[start, start + duration)`; each word belongs to the cue span it falls in (by word `start`), else to the surrounding gap; adjacent gaps merge; a gap shorter than `gapMinWords` words folds into the FOLLOWING segment (avoids confetti between back-to-back cues); overlay cues that overlap a fullframe cue's span still get their own `cue` segment ordered by start (the overlapping words appear only in the FIRST segment that claims them — no duplication). Every word appears exactly once; segments are contiguous in time order.

**Verify**: unit tests in Step 4 pass for this function (write them first if you like).

### Step 2: The timeline page

Rebuild the `GET /` page body as a single vertical flow rendered from `buildSegments`:

- **Header bar** (sticky): video slug · total duration · cue count (`N graphics · M flagged`) · Save · Approve (+ the existing approved banner behavior).
- **Mini-map** (sticky, under the header, ~28px tall, full width): one flex row, each segment a div with `flex-grow: (end-start)`; gaps neutral dark, fullframe cues accent orange, overlay cues a lighter orange, flagged cues rose; hover shows `mm:ss · card`; click scrolls the corresponding block into view (`scrollIntoView({behavior:'smooth'})`). Give each timeline block `id="seg-<index>"`.
- **Gap block**: collapsed row: `▸ 04:32 → 06:50 · 2m 18s · "<first ~14 words>…"` in dim text; click toggles the full transcript text of that span (readable measure, ~70ch). No type label — untyped by design this phase.
- **Cue block**: the EXISTING tile (iframe preview, slice audio player, edit textareas, flag checkbox + note, per-cue meta line), plus two additions: (a) the block shows its local transcript excerpt with the cue anchor and each beat anchor **highlighted** (wrap the matched words in `<mark>`; match by the same normalization resolve.mjs uses — import `normWord`), and (b) timecode range in the meta line (`04:32.0 → 04:56.5`).
- Keep the one-audio-at-a-time rule and all existing client JS working (save collects the same edited cues.json shape as today).
- 20+ iframes on one page: add `loading="lazy"` to tile iframes so off-screen cards don't all boot at once.

**Verify**: `node lib/board.mjs test-01` → page shows the full 32-min script as blocks; scroll + mini-map click both land on the right cue; edits + Save still round-trip.

### Step 3: PIPELINE.md line

Update the step-040 row/description to say the board is a full-script timeline (transcript + inline cue previews + mini-map), per-cue playback.

**Verify**: `grep -c "timeline" PIPELINE.md` ≥ 1

### Step 4: Tests

Extend `lib/board.test.mjs` (existing 6 must keep passing):

1. `buildSegments`: words fully covered, no duplication, contiguous order (fixture with 2 cues + gaps).
2. Short-gap folding: a 3-word gap between two cues folds forward.
3. `GET /` contains: at least one gap block timecode, both cue ids in DOM order matching start order, and a `<mark>` for the fixture cue's anchor words.
4. Mini-map: number of segment divs equals `buildSegments` length for the fixture.
5. Existing save/approve/slice/card-injection tests unchanged and green.

**Verify**: `node --test lib/board.test.mjs` → all pass

## Test plan

Segment model is pure and unit-tested; page assertions are string/DOM-order checks against the fixture server (no browser automation). The visual result is judged by the PR screenshot (ui: true): full timeline visible with mini-map, one expanded gap, one cue block with highlighted anchors.

## Done criteria

- [ ] `cd pipelines/video/graphics-flow && node --test lib/board.test.mjs` exits 0
- [ ] Manual run against `test-01` renders all 21 cues inline in a full-script timeline (screenshot on PR)
- [ ] All pre-existing routes behave identically (save/approve/flag/slices/injection)
- [ ] `git diff --stat bd4896c..HEAD` limited to in-scope files (+ plans/README.md row)

## STOP conditions

- Any temptation to add a dependency (virtual-scroller, framework) — stdlib + vanilla JS only.
- Any schema invention for avatar/screen spans — that's the next phase's decision, not this plan's.
- Changes needed in resolve.mjs/render.mjs to make the view work — report instead; the view must be derivable from existing files (only importing existing exports like `normWord` is fine).
- The 21-cue real workdir becomes unusably slow with lazy iframes — report with numbers rather than architecting a fix.

## Maintenance notes

- `buildSegments` is the seam the next phase extends: avatar/screen shot spans will become a third segment kind (or an attribute on gaps) rendered in the same flow, and global play-through will drive scroll against the same segment list. Keep it pure and exported.
- Mini-map colors: gaps neutral, fullframe accent, overlay light accent, flagged rose — reuse the page's existing CSS variables.
