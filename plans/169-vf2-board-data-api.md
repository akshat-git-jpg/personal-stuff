<!-- boss frontmatter -->
---
executor: agy
model:                   # blank = agy default (Gemini 3.1 Pro High)
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
                         # check.sh gains lib/board-api.test.mjs in this plan, so the gate
                         # can fail on this plan's own deliverable (the API contract).
ui:                      # server-only — no user-facing view changes
deploy:                  # no deploy — localhost tool
needs: []                # first plan of the board React-rewrite batch (169→174)
---

# Plan 169: Board data API — everything the React board will render, as JSON

## Summary

- **Problem statement**: The review board (`lib/board.mjs`, ~2900 lines) bakes all its data into server-rendered HTML template strings. The owner has decided to rebuild the board UI as a React/Vite SPA (like `apps/tutorial-tracker-app`); the SPA needs the same data as JSON. Today there is no JSON surface — `loadBoardData`, `buildSegments`, the anchor-highlight matching, probe times, and the FX derivations all live inline in the render functions.
- **Goals**:
  - New module `lib/board-data.mjs`: `buildBoardData(workdir, cardLibraryRoot)` returning the full board state as one JSON-safe object (schema inlined below).
  - New routes `GET /api/board-data` and `GET /api/calibrate-data` in `lib/board.mjs`, honoring `?video=` exactly like every other route (via the existing `requestedWorkdir`).
  - Zero behavior change to every existing page and route — the legacy HTML board keeps working byte-for-byte.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — schema, code skeletons, and commands are fully inlined.
- **Done criteria** (terse): `bash scripts/check.sh` exits 0 with the new `lib/board-api.test.mjs` in its file list; the new tests assert the schema below against the board fixtures; all 461 pre-existing tests still pass unmodified.
- **Stop conditions** (terse): do not modify any render function's output; do not change any existing route; do not touch `board.test.mjs`; stop if the API needs data no existing loader produces.
- **Test / verification for success**: node --test contract tests over the new endpoints using the existing `lib/fixtures/board/` fixtures.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat adda9be..HEAD -- pipelines/video/visuals-flow/lib/board.mjs pipelines/video/visuals-flow/lib/board-data.mjs pipelines/video/visuals-flow/scripts/check.sh`
> If `board.mjs` has drifted, re-read the drifted regions before editing; the line numbers below were taken at `adda9be`.

## Status

- **Priority**: high (blocks 170–174)
- **Effort**: medium
- **Risk**: low — additive only
- **Depends on**: none
- **Category**: feature (API layer)
- **Planned-at SHA**: `adda9be`

## Why this matters

The owner is replacing the board's server-rendered HTML with a React SPA (owner decision, 2026-07-30 — chosen over extracting template-string components). The rewrite only stays reviewable if it lands in ordered slices, and every later slice consumes this API. Getting the schema right here means plans 170–174 never have to re-litigate data shape. The legacy board must keep working untouched throughout the migration, because the owner reviews live videos on it daily.

## Current state (facts, verified at adda9be)

All paths relative to `pipelines/video/visuals-flow/`.

- `lib/board.mjs` — the whole board: server + 3 render functions. Relevant internals:
  - `loadBoardData(workdir)` (line ~2704) reads cues/resolved/transcript/feedback/shots/effects/sound/audit/card-plan and returns `{ cuesFile, resolved, words, feedbackItems, shots, effects, sound, audit, cardPlan, hasResolved }`.
  - `buildSegments(words, resolved, { gapMinWords })` (line ~860, exported) — cue/gap segmentation.
  - `requestedWorkdir(url, launchWorkdir)` (line ~2727, exported) — resolves `?video=` to a bootable child of `videos/`, else falls back to the launch workdir. **Reuse it; do not re-implement.**
  - `computeProbeTimes(beats, duration)` (line ~853) — overflow probe times per cue.
  - Anchor-highlight matching (lines ~1002–1022 inside `buildDetailBlocks`): for each phrase in `[cue.anchor, ...beats.map(b => b.anchor)]`, `normWord`-normalize and find the first contiguous word match in the segment, collecting matched word indices into a `Set`.
  - FX derivations (lines ~1095–1101 in `renderBoardPage`, duplicated in `renderTimelinePage`): `fullframes` from resolved fullframe cues, `shotSpans` from shot spans, `capChunks = planCaptions(words)` only when a captions effect is enabled.
  - `synthCalibrationVars(card)` (line ~2556, exported) and the calibrate tile inputs (`renderCalibratePage`, line ~2621): beat cards from the catalog + probe times.
  - Card-plan feedback grouping (lines ~1408–1420 in `renderTimelinePage`): feedback keys `zone-<part>:<n>` / `card-body:<n>` grouped into `planComments[part]` entries `{ text, added, folded, cue }`.
- `lib/board.test.mjs` — 81 tests; fixtures in `lib/fixtures/board/` (`cues.json`, `resolved.json`, `transcript.json`; `vo.mp3` is ffmpeg-generated by `ensureFixtureAudio()`). `makeWorkdir()` copies fixtures into `lib/.test-tmp/board/board-*`. **Copy this fixture pattern for the new test file; do not modify board.test.mjs.**
- `scripts/check.sh` — `node --test` over an explicit file list, then 3 rulebook checks, then `scripts/test-run-sh.sh`. New test files must be added to the list explicitly.
- Conventions: plain `.mjs`, node:test + `assert/strict`, no external deps. Exemplar for a data-shaping module + its test: `lib/card-plan.mjs` / `lib/card-plan.test.mjs`.

## Commands you will need

```bash
cd pipelines/video/visuals-flow
bash scripts/check.sh                      # full gate — expect "visuals-flow check OK"
node --test lib/board-api.test.mjs         # just the new file
node --test lib/board.test.mjs             # legacy suite must stay green UNMODIFIED
```

## Scope

**In scope (the only files to touch):**
- `pipelines/video/visuals-flow/lib/board-data.mjs` (new)
- `pipelines/video/visuals-flow/lib/board-api.test.mjs` (new)
- `pipelines/video/visuals-flow/lib/board.mjs` (add the two routes + import; extract-and-delegate only, no behavior change)
- `pipelines/video/visuals-flow/scripts/check.sh` (add `lib/board-api.test.mjs` to the node --test list)

**Out of scope (do NOT touch):**
- `lib/board.test.mjs` — the legacy suite is the no-regression proof; it must pass unmodified.
- All render functions' emitted HTML/CSS/JS — later plans replace them; this plan only *reads* the same loaders.
- `videos/**` — live video workdirs (opusclip-vs-submagic is in flight).
- Anything under `card-library/`.

## The API schema (authoritative — later plans consume exactly this)

`GET /api/board-data` (and `?video=<slug>`) → `200 application/json`:

```jsonc
{
  "video": "test-01",
  "hasResolved": true,                    // false before step 040 — the SPA must render the degraded board
  "totalDuration": 322.4,                 // last word end, 0 if no words
  "approved": {
    "cues": false, "shots": false,        // shots: null when no shots.json
    "effects": false,                     // null when no effects.json
    "cardPlan": true,                     // null when no card-plan.json
    "finalCut": false                     // from final-cut.json if present, else null
  },
  "cues": [ /* cuesFile.cues verbatim */ ],
  "resolved": [ /* resolved.json .resolved verbatim, [] when !hasResolved */ ],
  "segments": [                           // buildSegments output + unresolved cues prepended (same as pages)
    { "kind": "gap", "id": "seg-0", "start": 0, "end": 12.1,
      "words": [{ "text": "so", "start": 0.0, "end": 0.3 }] },
    { "kind": "cue", "id": "seg-1", "cueId": "c01", "start": 12.1, "end": 21.4,
      "unresolved": false,
      "words": [ /* same shape */ ],
      "highlights": [4, 5, 6],            // word indices matched by the anchor/beat-anchor phrases
      "probeTimes": [12.7, 21.3],         // computeProbeTimes(resolved.variables?.beats, duration); [] when unresolved
      "inShot": false }                   // segment midpoint inside a shot span
  ],
  "shots": {                              // null when no shots.json
    "engineMode": "test", "approved": false, "errors": [],
    "spans": [ /* resolveShots resolved spans */ ],
    "fileSpans": [ /* shotsFile.spans verbatim (the editable originals) */ ]
  },
  "effects": { "approved": false, "instances": [ /* verbatim */ ] },   // null when absent
  "sound":   { "instances": [ /* verbatim */ ] },                      // null when absent
  "audit":   { "cues": { "c01": { "verdict": "labelled", "fix": "…" } } },  // null when absent
  "cardPlan": {                            // null when absent
    "approved": false,
    "sections": [ /* card-plan.json sections verbatim */ ],
    "comments": { "body": [ { "text": "…", "added": "2026-07-28", "folded": false, "cue": "c03" } ] }
  },
  "feedback": { "<ref>": { "text": "…", "added": "…", "folded": "…?", "image": "feedback-images/x.png", "context": { } } },
  "fx": {
    "fullframes": [ { "id": "c02", "start": 30.9, "end": 39.9 } ],
    "shotSpans":  [ { "id": "s1", "start": 50.0, "end": 61.0 } ],
    "capChunks":  [ /* planCaptions(words) only when a captions effect instance is enabled, else [] */ ]
  }
}
```

Notes pinned as decisions (do not deviate):
- Segment ids are `seg-<index>` in the same order the pages use: **unresolved cues first** (`start: 0`), then `buildSegments` output — matching `renderTimelinePage` lines ~1356–1360.
- `highlights` reuses the exact matching loop from `buildDetailBlocks` (`normWord` from `./resolve.mjs`), moved into `board-data.mjs`. Do not re-implement normalization.
- Everything must be plain JSON (no Maps/Sets/undefined leakage — use `null`).

`GET /api/calibrate-data` → `200 application/json`:

```jsonc
{ "cards": [ { "slug": "comparison/versus-table", "max_beats": 5, "max_reveal_chars": 20,
               "probeTimes": [1.2, 2.4, 5.9] } ] }
```
One entry per `kind === 'beat'` card in `card-library/catalog.json`, `probeTimes` from `computeProbeTimes(synthCalibrationVars(card).beats, card.default_duration)`.

## Steps

1. **Create `lib/board-data.mjs`.** Move (do not copy) `loadBoardData` and `computeProbeTimes` out of `board.mjs` into it; export both plus the new builder. `board.mjs` imports them back so the legacy pages keep calling the same functions — single source. Skeleton:

   ```js
   // board-data.mjs — one JSON-safe snapshot of everything the board renders.
   // The React SPA (plans 170-174) consumes this; the legacy pages keep using
   // loadBoardData directly until the cutover deletes them.
   import fs from 'node:fs';
   import path from 'node:path';
   import { normWord } from './resolve.mjs';
   import { planCaptions } from './captions.mjs';

   export function computeProbeTimes(beats, duration) { /* moved verbatim from board.mjs */ }
   export function loadBoardData(workdir) { /* moved verbatim from board.mjs */ }

   export function anchorHighlights(cue, segWords) {
     const phrases = [cue.anchor, ...(cue.beats ?? []).map((b) => b.anchor)];
     const highlighted = new Set();
     for (const phrase of phrases) {
       if (!phrase) continue;
       const p = phrase.split(/\s+/).map(normWord).filter(Boolean);
       if (p.length === 0) continue;
       for (let j = 0; j <= segWords.length - p.length; j++) {
         let ok = true;
         for (let k = 0; k < p.length; k++) {
           if (normWord(segWords[j + k].text) !== p[k]) { ok = false; break; }
         }
         if (ok) { for (let k = 0; k < p.length; k++) highlighted.add(j + k); break; }
       }
     }
     return [...highlighted].sort((a, b) => a - b);
   }

   export function buildBoardData(workdir, cardLibraryRoot, { buildSegments }) {
     // buildSegments is injected from board.mjs to avoid a circular import
     // (board.mjs exports it and its tests import it from there).
     const d = loadBoardData(workdir);
     /* assemble and return EXACTLY the schema in plan 169 */
   }
   ```

   `approved.finalCut`: read `final-cut.json` if present (`JSON.parse(...).approved === true`), else `null`.

   **Verify:** `node --test lib/board.test.mjs` → all pass (moves are re-imported, nothing else changed).

2. **Add the routes to `handleRequest` in `board.mjs`**, directly above the `/list` route:

   ```js
   if (req.method === 'GET' && url.pathname === '/api/board-data') {
     res.setHeader('content-type', 'application/json; charset=utf-8');
     res.setHeader('cache-control', 'no-store');
     return res.end(JSON.stringify(buildBoardData(workdir, cardLibraryRoot, { buildSegments })));
   }
   if (req.method === 'GET' && url.pathname === '/api/calibrate-data') {
     const catalog = JSON.parse(fs.readFileSync(path.join(cardLibraryRoot, 'catalog.json'), 'utf8'));
     const cards = catalog.cards.filter((c) => c.kind === 'beat').map((card) => ({
       slug: card.slug, max_beats: card.max_beats ?? 0, max_reveal_chars: card.max_reveal_chars ?? null,
       probeTimes: computeProbeTimes(synthCalibrationVars(card).beats, card.default_duration),
     }));
     res.setHeader('content-type', 'application/json; charset=utf-8');
     res.setHeader('cache-control', 'no-store');
     return res.end(JSON.stringify({ cards }));
   }
   ```

   `workdir` at that point is already `requestedWorkdir(url, launchWorkdir)`, so `?video=` works for free.

   **Verify:** `node -e "import('./lib/board.mjs')"` from the flow root → no import errors.

3. **Write `lib/board-api.test.mjs`** (fixture pattern copied from `board.test.mjs` lines 8–46: `FIXTURE_DIR`, `ensureFixtureAudio`, `makeWorkdir`, `startServer`). Tests to write (each is one `test()`):
   1. `/api/board-data` returns 200 JSON matching the schema: `video`, `hasResolved: true`, `totalDuration > 0`, `segments` non-empty, every segment has `kind/id/start/end/words`, every cue segment has `cueId`, `highlights` (array of ints), `probeTimes`.
   2. Segment ids and order agree with the page contract: unresolved cues first, ids are `seg-<i>` counting from 0.
   3. A cue whose anchor matches fixture words yields non-empty `highlights`; the highlighted words re-join to the anchor phrase (use `buildSegments` + fixture data to pick the cue).
   4. `approved` block: after `POST /approve`, re-fetch → `approved.cues === true`.
   5. Degraded pre-040 board: build a workdir with only `cues.json`, `transcript.json`, `vo.mp3` (no `resolved.json` — same construction as board.test.mjs line ~1349) → `hasResolved: false`, `resolved: []`, `segments` still lists the cues as unresolved, response is still 200.
   6. `shots`/`effects`/`sound`/`audit`/`cardPlan` are `null` when their files are absent; with `effects.json` present (fixture flag `makeWorkdir(true)`), `effects.instances` is verbatim and `fx.capChunks` is non-empty only if a captions instance is enabled.
   7. `?video=<other-slug>` resolves like the pages do: unknown slug falls back to the launch workdir's data (assert `video` field).
   8. `/api/calibrate-data`: one entry per beat card in the real catalog, every entry has `slug` and non-empty `probeTimes` when `max_beats > 0`.
   9. Feedback: write a feedback item via `POST /save` (copy the payload shape from board.test.mjs line ~320), re-fetch → `feedback[ref].text` present.

   **Verify:** `node --test lib/board-api.test.mjs` → all pass.

4. **Add the file to `scripts/check.sh`** node --test list (after `lib/board.test.mjs`).

   **Verify:** `bash scripts/check.sh` → exits 0, prints `visuals-flow check OK`.

## Test plan

Covered in step 3 — 9 contract tests in `lib/board-api.test.mjs`, node:test, following `lib/board.test.mjs`'s fixture conventions.

## Done criteria (machine-checkable)

```bash
cd pipelines/video/visuals-flow
node --test lib/board-api.test.mjs        # ≥9 tests, all pass
node --test lib/board.test.mjs            # 81 tests, all pass, file UNMODIFIED (git diff --stat shows no change)
bash scripts/check.sh                      # exit 0
git diff adda9be..HEAD --stat -- pipelines/video/visuals-flow/lib/board.test.mjs   # empty
```

## STOP conditions

- If moving `loadBoardData`/`computeProbeTimes` breaks any board.test.mjs test, STOP — the move must be import-transparent; report which test.
- If the schema requires data no existing loader produces (i.e. you'd have to invent a new file format), STOP and report the gap.
- Do not "improve" the legacy pages while in the file. Extract-and-delegate only.
- Never write outside the repo (agy permission-dialog trap — LESSONS 2026-07-06).

## Maintenance notes

- Plans 170–174 consume this schema; a field rename here is a breaking change for them — the schema block above is the contract of record.
- After plan 174's cutover, `board-data.mjs` becomes the ONLY data path; the injected `buildSegments` seam can then be simplified if `buildSegments` moves here too (reviewer note, not this plan's work).
