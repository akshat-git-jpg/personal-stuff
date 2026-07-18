---
executor: agy
model:
test_cmd: bash pipelines/video/graphics-flow/scripts/check.sh
ui:
deploy:
needs: ["069 lands first (small shared edit in board.mjs handleSave)"]
---

# Plan 070: Graphics-flow render integrity — approval gate, staleness check, manifest that survives --only

## Summary

- **Problem statement**: `lib/render.mjs` renders whatever `resolved.json` says with no checks: it ignores the `approved` flag, trusts a possibly-stale `resolved.json`, and rewrites `manifest.md` from only the cues rendered *this run* — so `--only c05` destroys the full manifest, and edits after Approve silently keep `approved: true`.
- **Goals**: render refuses unapproved/stale input (with `--force`), the manifest is always derived from all resolved cues whose files exist on disk, and a board Save that changes cues resets approval.
- **Executor proposed**: agy (standard — behavior fully specified below).
- **Done criteria** (terse): approval + staleness gates with `--force`; manifest correct after `--only`; save-resets-approval; tests green.
- **Stop conditions** (terse): resolved.json semantics differ from what's documented here; test-01 fails the staleness check unexpectedly.
- **Test / verification for success**: new `lib/render.test.mjs` + `lib/board.test.mjs` cases; CLI checks on fixtures; `scripts/check.sh`.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8e48c2f..HEAD -- pipelines/video/graphics-flow/lib/render.mjs pipelines/video/graphics-flow/lib/render.test.mjs pipelines/video/graphics-flow/lib/board.mjs`

## Status

- **Priority**: P1
- **Effort**: S-M
- **Risk**: LOW
- **Depends on**: 069 (shared file board.mjs; soft — rebase if needed)
- **Category**: bug
- **Difficulty**: standard
- **Planned at**: commit `8e48c2f`, 2026-07-18

## Why this matters

The flow's contract (PIPELINE.md, HANDOFF.md) is: owner approves on the board
(step 040), THEN render (step 050), and the editor places clips at
`manifest.md` timecodes. Three gaps break that contract:

1. **No approval gate.** `render.mjs main()` reads only `resolved.json`
   (line 106) — never `cues.json` — so `approved: false` renders happily.
2. **Staleness.** `resolved.json` is a derived artifact of
   `cues.json` + `transcript.json`. Hand-edit cues.json and forget to re-run
   step 030, and render produces clips from the OLD resolution with no warning.
3. **Manifest clobber.** The manifest is written from the `rendered` array of
   this run only (`render.mjs` line 165:
   `fs.writeFileSync(path.join(workdir, 'manifest.md'), manifestMd(video, rendered, offset))`).
   Re-render one fixed cue with `--only c05` and the editor's manifest becomes
   a single row. A partial-failure run likewise writes a partial manifest.

Plus the flag-integrity gap on the board: after Approve, the client keeps
sending `approved: true` with every Save (`board.mjs` client `APPROVED`
variable, and `handleSave`'s `{ ...prev, ...incoming }` merge), so
post-approval edits stay "approved" — the flag stops meaning "the owner saw
this exact version".

## Current state

- `pipelines/video/graphics-flow/lib/render.mjs` (175 lines):
  - `parseArgs` supports `--only <cueId>` and `--quality`.
  - `main()` reads `resolved.json`, loops cues, stages each card in a temp dir,
    spawns `npx hyperframes@latest render`, ffprobe-verifies duration, collects
    `rendered`, then writes `manifest.md` from `rendered` and exits 1 if any errors.
  - `planRender(cue)` computes the output filename:
    `${mmssDigits(cue.start)}-${cue.id}-${basename(cue.card)}.${format}` where
    format is `mov` for `placement === 'overlay'`, else `mp4`.
  - `manifestMd(video, cues, offset)` builds the markdown table, applying
    `offset` to the place-at column only.
- `pipelines/video/graphics-flow/lib/resolve.mjs` exports `resolveCues(cues, words, catalog, cardLibraryRoot)`
  returning `{ resolved, errors }` — the same function step 030 and the board use.
- `resolved.json` shape: `{ video, offset, resolved: [...] }`.
- `cues.json` shape: `{ video, approved, offset, cues: [...] }` (schema in PIPELINE.md).
- `lib/render.test.mjs` (63 lines) tests pure helpers (`rewriteDuration`, `mmss`,
  `manifestMd`, `planRender`) — follow its style for new pure-function tests.
- Fixture workdir for CLI tests: `lib/fixtures/` has `cues-ok.json`, `cues-bad.json`,
  `transcript.json`; `lib/resolve.test.mjs` (lines ~166-197) shows how CLI
  invocations are tested with `spawnSync` against a temp workdir — copy that pattern.
- `videos/test-01/` is real data: cues.json (27 cues, `approved: false`),
  resolved.json in sync, transcript.json present.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Flow gate | `bash pipelines/video/graphics-flow/scripts/check.sh` | exit 0 |
| Staleness sanity on real data | `cd pipelines/video/graphics-flow && node lib/resolve.mjs test-01 && git diff --exit-code videos/test-01/resolved.json` | exit 0 (test-01 is in sync at plan time) |
| Approval gate check (no render spawned) | `cd pipelines/video/graphics-flow && node lib/render.mjs test-01 --only c01; echo $?` | exit 1 with a "not approved" message, BEFORE any npx spawn |

## Scope

**In scope**:
- `lib/render.mjs`: approval gate, staleness gate, `--force`, manifest-from-disk.
- `lib/render.test.mjs`: new tests.
- `lib/board.mjs`: reset `approved` when a Save changes cues (small, one spot in `handleSave`).
- `lib/board.test.mjs`: one new test for the reset.
- `steps/050-render-run/README.md`: document the gates and `--force`.

**Out of scope**:
- The render staging/spawn/ffprobe machinery itself (Step 7 only changes the version string it invokes).
- The board's other behaviors (069/073/074 own them).

## Git workflow

- Branch: `advisor/070-graphics-render-approval-integrity`
- Commit: `fix(graphics-flow): render approval+staleness gates, manifest derived from disk, save resets approval` — no AI footers. Do NOT push.

## Steps

### Step 1: Approval gate in render

In `render.mjs main()`, after resolving `workdir` and before reading
`resolved.json`: read `cues.json`; if `cuesFile.approved !== true` and
`!opts.force`, print
`refusing to render: cues.json approved=false — review on the board (node lib/board.mjs <slug>) or pass --force`
and `process.exit(1)`. Add `--force` to `parseArgs` and the usage string.

**Verify**: `node lib/render.mjs test-01 --only c01; echo $?` -> exit 1 with the message, instantly (no npx output).

### Step 2: Staleness gate in render

Still in `main()`, before the render loop: recompute resolution and compare.

```js
const words = JSON.parse(fs.readFileSync(path.join(workdir, 'transcript.json'), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(path.join(cardLibraryRoot, 'catalog.json'), 'utf8'));
const recomputed = resolveCues(cuesFile.cues, words, catalog, cardLibraryRoot);
const fresh = recomputed.errors.length === 0
  && JSON.stringify(recomputed.resolved) === JSON.stringify(resolved);
if (!fresh && !opts.force) { /* error: resolved.json is stale or cues.json no longer resolves — re-run node lib/resolve.mjs <slug> (exit 1) */ }
```

Import `resolveCues` from `./resolve.mjs`. On `--force`, print a warning and
continue with the on-disk `resolved.json`.

**Verify**:
`cd pipelines/video/graphics-flow && node lib/resolve.mjs test-01 && git diff --exit-code videos/test-01/resolved.json` -> exit 0 (baseline in sync), then temporarily edit one anchor word in a COPY of test-01 under a temp dir and confirm render exits 1 with the staleness message (use the temp-workdir pattern from `resolve.test.mjs`; never modify `videos/test-01/` itself).

### Step 3: Manifest derived from disk, not from this run

Extract a pure helper and use it after the render loop:

```js
export function manifestCues(resolved, renderDir) {
  return resolved.filter((cue) => fs.existsSync(path.join(renderDir, planRender(cue).outFile)));
}
```

Replace `manifestMd(video, rendered, offset)` with
`manifestMd(video, manifestCues(resolved, renderDir), offset)` — `resolved`
being the FULL list from resolved.json regardless of `--only`. If
`manifestCues` returns fewer cues than `resolved`, append a visible warning
line to stderr listing the missing cue ids (their clips don't exist yet), and
do not list them in the manifest (the manifest must never name a nonexistent
file). Keep the existing exit-1-on-errors behavior.

**Verify**: unit test in Step 5 (fs-based, no real renders).

### Step 4: Board Save resets approval when cues change

In `board.mjs handleSave()`, where `merged` is computed
(`const merged = { ...prev, ...incoming };`), add:

```js
if (prev.approved === true && JSON.stringify(prev.cues) !== JSON.stringify(incoming.cues)) {
  merged.approved = false;
}
```

(069 may have touched nearby feedback code — rebase cleanly; this is an
independent three-line addition.)

**Verify**: new board test in Step 5.

### Step 5: Tests

`lib/render.test.mjs` (pure/fs-level, follow existing style):

1. `manifestCues` returns only cues whose `planRender().outFile` exists in a
   temp renders dir (create two dummy files for a three-cue resolved list;
   expect two rows, sorted by start via the existing `manifestMd`).
2. CLI approval gate: temp workdir with `approved: false` cues.json +
   resolved.json + transcript.json (reuse `lib/fixtures/` data) ->
   `spawnSync node lib/render.mjs <dir>` exits 1, stderr mentions `approved`.
3. CLI staleness gate: same temp workdir but `approved: true` and a
   resolved.json with one `start` value perturbed -> exit 1, stderr mentions
   `stale`. (No npx is ever reached in either CLI test — they fail at the gates.)

`lib/board.test.mjs`:

4. Approve (POST `/approve`), then POST `/save` with a changed `hold` on one
   cue -> cues.json has `approved: false`. Saving identical cues back keeps
   `approved: true`.

**Verify**: `bash pipelines/video/graphics-flow/scripts/check.sh` -> exit 0.

### Step 6: Docs

Update `steps/050-render-run/README.md`: the two gates, `--force`, and the
manifest-from-disk rule ("re-running with `--only` refreshes that clip and the
manifest keeps every other existing row"). One sentence each in
`PIPELINE.md`'s step table row for 050 is optional — only if it reads wrong
after the change.

**Verify**: `grep -n 'force' pipelines/video/graphics-flow/steps/050-render-run/README.md` shows the flag documented.

### Step 7: Pin the hyperframes version

`render.mjs` spawns `npx hyperframes@latest` PER CUE (line 139) — 27 cues =
27 registry resolutions, and a mid-batch version bump can change renderer
behavior between c01 and c27. Pin it:

- Run `npm view hyperframes version` (with the pipeline `.npmrc` in effect)
  and record the result.
- Add `const HYPERFRAMES = process.env.HYPERFRAMES_VERSION ? \`hyperframes@\${process.env.HYPERFRAMES_VERSION}\` : 'hyperframes@<that version>';`
  near the top of `render.mjs`; use it in the spawn. Do the same in
  `steps/010-transcribe-run/run.sh`'s fallback transcribe line
  (`npx hyperframes@<that version> transcribe ...` — a plain literal is fine
  in the shell script; a one-line comment saying where the pin lives).
- Note the pin + env override in `steps/050-render-run/README.md`.

**Verify**: `grep -rn 'hyperframes@latest' pipelines/video/graphics-flow/lib pipelines/video/graphics-flow/steps` -> no hits.

## Test plan

Unit + CLI-level tests as in Step 5; no real hyperframes renders are needed
(both gates fire before staging). Full gate: `scripts/check.sh`.

## Done criteria

- [ ] `node lib/render.mjs <unapproved>` exits 1 before any staging/spawn; `--force` overrides.
- [ ] Stale `resolved.json` (vs recomputed `resolveCues`) exits 1 with a re-run hint; `--force` overrides.
- [ ] `--only` re-render leaves every other cue's manifest row intact; manifest never lists a missing file.
- [ ] Board Save that changes cues resets `approved` to false; identical Save doesn't.
- [ ] No `hyperframes@latest` remains in the flow; pinned version with `HYPERFRAMES_VERSION` override documented.
- [ ] All new tests pass; `scripts/check.sh` exits 0.

## STOP conditions

- `videos/test-01/resolved.json` is NOT reproducible from its cues.json at
  execution time (baseline staleness check fails) — stop and report; do not
  "fix" test-01 data.
- `resolveCues`'s output shape has changed since commit `8e48c2f` (plan 071
  may land around the same time — if `resolved` entries carry new fields,
  string-compare still works as long as both sides come from the same
  function; if the comparison misfires, stop and report rather than loosening it).

## Maintenance notes

- The staleness check makes render the enforcement point for "resolved.json is
  derived data" — if the resolver output shape evolves, this comparison stays
  valid automatically since both sides call the same `resolveCues`.
- If a future plan replaces `@latest` with a pinned hyperframes version, the
  gates here are unaffected.
