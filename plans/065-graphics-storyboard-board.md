---
executor: claude-p
model: sonnet
test_cmd: cd pipelines/video/card-library && node --test flow/board.test.mjs
ui: true
deploy:
needs: ["062 (beat cards)", "063 (resolved.json + workdir contract)"]
---

# Plan 065: Graphics storyboard board (local review server)

## Summary

- **Problem statement**: The owner must review every planned graphic — with its real content and real VO-synced timing — BEFORE batch rendering, and edit/flag/approve inline. Nothing provides that; reviewing by rendering everything first wastes minutes per iteration.
- **Goals**:
  - `flow/board.mjs` — local server (port 4322): one tile per cue, playing the REAL card (variables injected server-side) driven by that cue's MP3 slice, with inline editing, flag, and approve.
  - MP3 slicing via ffmpeg into `<workdir>/slices/`.
  - `flow/board.test.mjs` — route + injection tests.
- **Executor proposed**: claude-p / sonnet (standard)
- **Done criteria** (terse): `node --test flow/board.test.mjs` exit 0; board serves tiles, saves edits through the resolver, flags, approves.
- **Stop conditions** (terse): npm deps; iframe variable injection fails structurally; writes outside card-library + the passed workdir.
- **Test / verification for success**: route tests against a fixture workdir + a screenshot of the board on the PR (ui: true).
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 02f536f..HEAD -- pipelines/video/card-library/flow/board.mjs pipelines/video/card-library/flow/board.test.mjs`
> (must be empty; 062/063/064 files existing in flow/ is expected)

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (iframe injection + audio-driven seeking)
- **Depends on**: 062, 063
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `02f536f`, 2026-07-17

## Why this matters

The design's feedback loop (docs/specs/2026-07-17-motion-graphics-beat-sync-design.md): what the owner approves must be pixel-identical to what renders, at zero per-review token cost. HyperFrames makes this possible — the same card HTML that renders to MP4 plays live in an iframe. The board is where sync is *proven* (audio slice drives the timeline; you watch "Slow on mobile" appear as the VO says it), where text/timing edits happen (writing back to cues.json and re-resolving), and where no-card-fits cues get flagged into the novel-card loop.

## Current state

- `pipelines/video/card-library/serve.mjs` — the existing gallery server (node stdlib, no deps, `npm run serve`, port 4321). Read it before Step 1 and imitate its style: plain `http.createServer`, inline HTML template strings, live re-read from disk per request. The board is a sibling, not a modification of it.
- `flow/` after 062–064: `README.md` (workdir contract + cues.json schema), `resolve.mjs` (exports `resolveCues`; CLI writes resolved.json), `render.mjs`, `RULEBOOK.md`, fixtures, tests.
- Workdir (`~/kb-scratch/video/graphics/<slug>/`): `vo.mp3`, `transcript.json`, `cues.json`, `resolved.json`, `slices/`, `renders/`.
- Cards read variables via `window.__hyperframes.getVariables()` (see `pros-cons/pros-cons/index.html` line 65) and register a paused GSAP timeline on `window.__timelines[<id>]`. **Verified**: defining `window.__hyperframes` BEFORE the card's scripts run makes the card use injected values — the card checks `window.__hyperframes && window.__hyperframes.getVariables`.
- ffmpeg + ffprobe are installed and used across pipelines.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Run tests | `cd pipelines/video/card-library && node --test flow/board.test.mjs` | exit 0 |
| Slice audio | `ffmpeg -y -i vo.mp3 -ss <start> -t <dur> -c:a libmp3lame -q:a 4 slices/<id>.mp3` | slice written |
| Run board | `node flow/board.mjs ~/kb-scratch/video/graphics/<slug>` | `board at http://localhost:4322` |

## Scope

**In scope**:
- `pipelines/video/card-library/flow/board.mjs` (new)
- `pipelines/video/card-library/flow/board.test.mjs` (new)
- `pipelines/video/card-library/flow/fixtures/board/` (new; fixture workdir — generate its tiny mp3 in test setup with ffmpeg `sine`, do NOT commit binary audio)

**Out of scope**:
- serve.mjs, cards, catalog.json, resolve.mjs/render.mjs internals (import them, don't edit), RULEBOOK.md, render2.agrolloo.com / apps/hyperframes-render.

## Git workflow

- Branch: `advisor/065-graphics-storyboard-board`
- Commit per step, e.g. `feat(card-library): graphics storyboard board`. No AI footers. Do NOT push.

## Steps

### Step 1: board.mjs skeleton + slicing

`node flow/board.mjs <workdir>` — validate workdir has `cues.json` + `resolved.json` + `vo.mp3` (exit 1 with message otherwise). On start and after every save: for each resolved cue whose slice is missing or older than resolved.json, run the ffmpeg slice command (Commands table) with `-ss cue.start -t cue.duration`. Serve on port 4322 (`BOARD_PORT` env overrides). Node stdlib only.

Routes:

| Route | Behavior |
|---|---|
| `GET /` | board page: tiles in cue order |
| `GET /card/<id>` | the cue's card index.html with injection (Step 2) |
| `GET /slice/<id>.mp3` | the slice file |
| `POST /save` | body = full cues.json JSON: write `<workdir>/cues.json`, re-run resolver in-process (`resolveCues` import + re-write resolved.json), re-slice stale slices; respond `{ok, errors}` with resolver errors |
| `POST /approve` | set `"approved": true` in cues.json; respond `{ok:true}` |

**Verify**: `node flow/board.mjs flow/fixtures/board 2>&1 | head -1` (with fixture from Step 4 present) -> prints the localhost line

### Step 2: card injection route

`GET /card/<id>`: read the cue's card `index.html` from disk, inject this script block immediately BEFORE the first `<script` occurrence, serve as HTML:

```html
<script>
  window.__hyperframes = { getVariables: () => (__VARS__) };
  window.addEventListener('message', (e) => {
    if (!e.data || typeof e.data.t !== 'number') return;
    const tls = Object.values(window.__timelines || {});
    if (!tls.length) return;
    const tl = tls[0];
    tl.pause();
    tl.time(Math.min(e.data.t, tl.duration()));
  });
</script>
```

`__VARS__` = `JSON.stringify` of the cue's resolved `variables` (serialize with `JSON.stringify(vars).replace(/</g,'\\u003c')` to keep the inline script safe). The card's own `VARS =` line then picks up the injected object; its GSAP timeline is paused by construction, so seeking via `tl.time()` is the whole clock.

**Verify**: `curl -s localhost:4322/card/c01 | grep -c "getVariables"` -> `2` (injected shim + the card's own read)

### Step 3: board page

One HTML template string. Per cue tile, in cue order:

- header: `#<id> · <mm:ss start> · <card slug> · <duration>s · <placement>`
- the transcript anchor phrase(s) as quoted text (cue anchor bold, beat anchors listed with their reveal text)
- an `<iframe src="/card/<id>">` sized 480x270 (cards are 1920x1080; `transform: scale(0.25)` on the iframe body wrapper or width/height + CSS zoom — match how serve.mjs's gallery scales previews; read it and copy the technique)
- an `<audio controls src="/slice/<id>.mp3">` plus a play-sync script: on `timeupdate`/`requestAnimationFrame` while playing, `iframe.contentWindow.postMessage({t: audio.currentTime}, '*')`; on pause/seek, post once
- edit controls: textareas bound to the cue's JSON fragment (anchor, hold, variables, beats array) + per-board Save button → POST /save with the edited full cues.json; resolver errors from the response render in a red banner naming cue ids
- a `Flag: no card fits` toggle setting `flagged: true` on the cue (flagged tiles render dimmed with their `note`)
- top bar: video slug, cue count, flagged count, and an **Approve** button → POST /approve; when `approved: true`, show a green "approved — ready for `node flow/render.mjs`" banner

Keep it utilitarian — this is an internal cockpit like serve.mjs's gallery, not a product UI.

**Verify**: open `http://localhost:4322` against the fixture workdir; every fixture cue renders a tile; press play on a tile and observe the card's reveals advance with the audio (manual check; screenshot this for the PR — ui: true).

### Step 4: fixture + board.test.mjs

Fixture (`flow/fixtures/board/`): `cues.json` + `resolved.json` (2 cues: one `pros-cons/pros-cons` fullframe with 2 beats, one overlay single; hand-write both files consistent with the flow/README.md schema) + `transcript.json` (tiny). Test setup generates `vo.mp3`: `ffmpeg -y -f lavfi -i "sine=frequency=440:duration=30" -c:a libmp3lame flow/fixtures/board/vo.mp3` (gitignore it; add `flow/fixtures/board/vo.mp3` and `flow/fixtures/board/slices/` to `.gitignore`).

Tests (`node:test`, spawn the server on an ephemeral port via `BOARD_PORT=0`-style — have board.mjs print the actual bound port and export its `createServer(workdir)` for direct use in tests without spawning):

1. `GET /` → 200, contains both cue ids and the Approve button.
2. `GET /card/c01` → 200, contains the injected `getVariables` shim before the card's first original script AND the resolved beat text.
3. `GET /slice/c01.mp3` → 200, `audio/mpeg`, non-empty (slice generated on start).
4. `POST /save` with an edited valid cues.json → cues.json on disk updated, resolved.json regenerated, `{ok:true,errors:[]}`.
5. `POST /save` with a broken anchor → `{ok:false}` with the resolver error listed; cues.json still written (edits are never lost), resolved.json untouched.
6. `POST /approve` → cues.json has `approved: true`.

**Verify**: `node --test flow/board.test.mjs` -> all pass

## Test plan

Route/injection/save-loop covered by the 6 tests above against the fixture workdir; the audio-driven visual sync is verified manually once (Step 3 verify) and screenshotted for the PR. No tests spawn Chrome or render video.

## Done criteria

- [ ] `cd pipelines/video/card-library && node --test flow/board.test.mjs` exits 0
- [ ] Board runs against the fixture workdir; screenshot of the tile view attached to the PR
- [ ] `git diff --stat 02f536f..HEAD` limited to board.mjs, board.test.mjs, fixtures, .gitignore lines (plus plans/README.md row)
- [ ] No npm dependencies added

## STOP conditions

- Injection ordering fails (a card reads `getVariables` before the shim exists) — report which card pattern breaks it; do not rewrite cards (that's a 062-contract issue).
- The GSAP seek approach doesn't move the composition (e.g. a card registers no `window.__timelines` entry) — report the card; do not invent a per-card workaround.
- Any need for npm deps (websocket libs, frameworks) — the postMessage + POST design avoids them on purpose.
- Writes outside card-library and the passed workdir.

## Maintenance notes

- The board reads/writes ONLY workdir files + card HTML — it stays correct as cards and catalog grow. New beat cards work with zero board changes.
- If a future card uses multiple timelines, the `tls[0]` pick in the shim needs a convention (e.g. `window.__timelines[compositionId]`) — revisit then, with the 062 contract.
- Port 4321 = gallery, 4322 = board, 4100 = media-board (pipelines skill) — keep them distinct.
