---
executor: agy
model:
test_cmd: bash pipelines/video/graphics-flow/scripts/check.sh
ui: true
deploy:
needs: ["after 069/070/072 (board.mjs chain); before 074"]
---

# Plan 073: Graphics board hardening — safe Save, localhost bind + port hygiene, incremental slices

## Summary

- **Problem statement**: Four small board defects: (1) one invalid fragment JSON makes Save silently do nothing (unguarded `JSON.parse` in the click handler); (2) the server binds all interfaces with unauthenticated write endpoints; (3) a taken port 4322 crashes with a raw EADDRINUSE stack (HANDOFF open item 8); (4) every Save re-encodes ALL vo slices because staleness is mtime-based against a freshly rewritten resolved.json, with slow-seek ffmpeg args.
- **Goals**: Save reports exactly which cue's JSON is broken; server binds 127.0.0.1 and walks to a free port with a clear message; slices regenerate only when their cue's start/duration changed, with fast-seek ffmpeg.
- **Executor proposed**: agy (standard; ui gate — screenshot required).
- **Done criteria** (terse): all four fixed with tests where testable; `scripts/check.sh` green; screenshot of the per-cue JSON error banner.
- **Stop conditions** (terse): board tests fail at baseline; slice-cache change alters slice audio content.
- **Test / verification for success**: board tests + manual board run screenshot.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8e48c2f..HEAD -- pipelines/video/graphics-flow/lib/board.mjs pipelines/video/graphics-flow/lib/board.test.mjs`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 069, 070, 072 (same file — this plan rebases on their landed state)
- **Category**: bug / dx
- **Difficulty**: standard
- **Planned at**: commit `8e48c2f`, 2026-07-18

## Why this matters

The board (step 040) is the owner's only review gate before rendering; its
failure modes directly cost review sessions:

1. **Silent Save no-op.** The save handler starts with
   `const fragment = JSON.parse(tile.querySelector('.frag').value);` inside
   `document.getElementById('saveBtn').onclick = async () => {...}` — one
   malformed fragment (a stray comma while hand-editing) throws, the whole
   Save aborts with only a console error, and the owner believes they saved.
2. **LAN-exposed write endpoints.** `server.listen(port, cb)` (board.mjs
   ~line 561) binds 0.0.0.0; `/save` and `/approve` accept unauthenticated
   POSTs that write files. Localhost-only is the intended posture.
3. **EADDRINUSE raw stack.** HANDOFF.md open item 8 and tests/TESTS.md finding
   5 record a real incident: a stale board on 4322 made a new launch die with
   a raw stack while the stale instance silently served WRONG (fixture) data.
4. **Save latency.** `ensureSlices()` marks a slice stale when its mtime is
   older than resolved.json's — but every Save rewrites resolved.json, so all
   ~27 slices re-encode on every Save. Worse, the ffmpeg args are
   `-i voPath -ss start` (input-then-seek = decode from file start; a cue at
   29:00 decodes 29 minutes of audio).

## Current state

- `pipelines/video/graphics-flow/lib/board.mjs` — after 069/070/072 land this
  file will have merged feedback, approval-reset, and lint-warning changes;
  none touch the four areas above. Key excerpts at commit `8e48c2f`:

```js
// ensureSlices (lines 44-66)
const stale = !fs.existsSync(slicePath) || fs.statSync(slicePath).mtimeMs < resolvedMtime;
if (!stale) continue;
const result = spawnSync('ffmpeg', [
  '-y', '-i', voPath,
  '-ss', String(cue.start),
  '-t', String(cue.duration),
  '-c:a', 'libmp3lame', '-q:a', '4',
  slicePath,
], { encoding: 'utf8' });
```

```js
// main (lines 546-564)
const port = Number(process.env.BOARD_PORT) || 4322;
server.listen(port, () => {
  console.log(`board at http://localhost:${server.address().port}`);
});
```

- `lib/board.test.mjs` — server tests bind port 0 (`server.listen(0)` style via
  the existing tests' setup); follow their pattern.
- The board is registered on the local-apps dashboard as "graphics storyboard",
  launched with no args (latest video). `BOARD_PORT` env var already exists.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Board tests | `cd pipelines/video/graphics-flow && node --test lib/board.test.mjs` | all pass |
| Flow gate | `bash pipelines/video/graphics-flow/scripts/check.sh` | exit 0 |
| Manual run for screenshot | `cd pipelines/video/graphics-flow && node lib/board.mjs lib/fixtures/board` | board serves on 127.0.0.1 |

## Scope

**In scope**:
- `lib/board.mjs`: client save handler try/catch; `listen` host + port walk;
  `ensureSlices` cache keying + ffmpeg arg order; guard `latestWorkdir` when
  `videos/` is missing.
- `lib/board.test.mjs`: tests for slice cache + save-error response path where feasible.
- `steps/040-storyboard-review-owner/README.md`: one line on port behavior.

**Out of scope**:
- Feedback lifecycle (069), approval semantics (070), lint (072), overflow QC (074).
- Any authentication scheme — localhost bind is the fix, not passwords.

## Git workflow

- Branch: `advisor/073-graphics-board-hardening`
- Commit: `fix(graphics-flow): board — per-cue JSON save errors, localhost bind + port walk, incremental slices` — no AI footers. Do NOT push.

## Steps

### Step 1: Per-cue JSON errors in the Save handler

In the client script's save onclick, wrap fragment parsing:

```js
const broken = [];
const cues = [...document.querySelectorAll('.tile')].map((tile) => {
  let fragment;
  try { fragment = JSON.parse(tile.querySelector('.frag').value); }
  catch (e) { broken.push(tile.dataset.id + ': ' + e.message); return null; }
  ...
}).filter(Boolean);
if (broken.length) { showBanner('invalid fragment JSON — nothing saved:<br>' + broken.map(escapeForBanner).join('<br>'), 'err'); return; }
```

Nothing is POSTed when any tile is broken (partial saves would silently drop
the broken cue — all-or-nothing is the safe semantic).

**Verify**: manual — run the fixture board, corrupt one fragment textarea, hit Save: red banner names the cue id; cues.json untouched. Screenshot this for the PR (ui gate).

### Step 2: Bind localhost, walk to a free port

```js
function listenOnFreePort(server, startPort, attempts = 10) {
  return new Promise((resolve, reject) => {
    const tryPort = (p, left) => {
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE' && left > 0) {
          console.error(`port ${p} in use — trying ${p + 1}`);
          tryPort(p + 1, left - 1);
        } else reject(err);
      });
      server.listen(p, '127.0.0.1', () => { server.removeAllListeners('error'); resolve(p); });
    };
    tryPort(startPort, attempts);
  });
}
```

Use it in `main()`; keep `BOARD_PORT` as the start port; print the final URL.
Also guard `latestWorkdir()` with `fs.existsSync(videosDir)` returning null.

**Verify**: start two boards on the fixture workdir simultaneously — the second prints "port 4322 in use — trying 4323" and serves; `curl -s http://127.0.0.1:4323/ | head -1` returns HTML. Kill both.

### Step 3: Incremental slices + fast seek

Replace mtime staleness with a content key. Write `slices/.index.json` mapping
`cue.id -> "\${cue.start}:\${cue.duration}"`; a slice regenerates iff its file
is missing or its key changed; entries for cues that no longer exist are
dropped (and their mp3s unlinked). Move `-ss` BEFORE `-i` (input seeking —
fast and sample-accurate enough for review slices):

```js
['-y', '-ss', String(cue.start), '-t', String(cue.duration), '-i', voPath, '-c:a', 'libmp3lame', '-q:a', '4', slicePath]
```

**Verify**: board test — call `ensureSlices` twice via a Save round-trip on the
fixture workdir; assert the second Save leaves slice mtimes unchanged for
untouched cues, and a cue whose `hold` changed gets a new mtime. (The fixture
board dir has a real `vo.mp3` and ffmpeg is available — the existing slice
test proves this works in tests.)

### Step 4: Docs

`steps/040-storyboard-review-owner/README.md`: note the board binds
127.0.0.1, starts at `BOARD_PORT` (default 4322) and walks up to +10 when
taken, printing the final URL.

**Verify**: `bash pipelines/video/graphics-flow/scripts/check.sh` -> exit 0.

## Test plan

Board tests for slices and (where reachable) the save path; manual screenshot
of the per-cue JSON error banner and the port-walk message; flow gate green.

## Done criteria

- [ ] Save with a broken fragment shows a red banner naming the cue; nothing written.
- [ ] Server binds 127.0.0.1; taken port walks up with a clear message (no raw stack).
- [ ] Second Save re-encodes only changed cues' slices; `-ss` precedes `-i`.
- [ ] `latestWorkdir` returns null (clean usage error) when `videos/` is absent.
- [ ] `scripts/check.sh` exits 0; PR carries the two screenshots.

## STOP conditions

- Baseline board tests fail before your changes — stop and report.
- Slice audio produced by the new ffmpeg arg order sounds truncated/shifted on
  the fixture (listen to one slice) — stop and report rather than shipping
  wrong review audio.

## Maintenance notes

- `slices/.index.json` lives inside the gitignored `slices/` dir — no gitignore change needed.
- Plan 074 adds probe logic to the same file; it expects this plan's landed state.
