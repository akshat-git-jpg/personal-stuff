---
executor: agy
model:
test_cmd: bash pipelines/video/visuals-flow/scripts/check.sh
ui: true
deploy:
needs: []
---

# Plan 084: Whip-pan transitions at screen ↔ avatar boundaries (step 090 assemble)

## Summary

- **Problem statement**: Step 090 assembles the final video with hard cuts everywhere. The owner wants the screen-recording ↔ full-screen-avatar boundaries to feel like a YouTube whip-pan — a fast directional slide with motion blur — instead of a hard cut.
- **Goals**:
  - New pure planner `planTransitions()` in `lib/assemble.mjs` that marks every screen↔avatar boundary eligible for a whip transition (with skip rules), unit-tested.
  - `runAssembly()` encodes a 0.4s transition segment at each eligible boundary (xfade slide + tmix motion blur), trimming 0.2s off each neighbor so total duration is unchanged and the concat stays stream-copy-valid.
  - `--transitions whip|none` CLI flag, default `whip`. `assembly.md` reflects the mode and lists transitions.
- **Executor proposed**: agy (Gemini 3.1 Pro High, agy default) — plan is fully inlined; visual output must pass the render+inspect gate before landing (verifier renders test-01 `--draft` and LOOKS at the transition frames; agy never self-certifies visuals).
- **Done criteria** (terse): `bash pipelines/video/visuals-flow/scripts/check.sh` exits 0 with the new tests; integration test proves transition segments exist, are ~0.4s, and final duration/resolution/audio probes still pass; `--transitions none` reproduces today's behavior byte-for-byte in segment structure.
- **Stop conditions** (terse): missing `xfade`/`tmix` in the local ffmpeg build; any change needed outside `lib/assemble.mjs`, `lib/assemble.test.mjs`, `steps/090-assemble-run/README.md`; concat stream-copy failing (encoder param mismatch).
- **Test / verification for success**: unit tests on `planTransitions` + extended ffmpeg integration test (segment count, per-transition `.ts` duration probe, total duration exact); manual/verifier: draft-render test-01 and inspect transition frames.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 88c6943..HEAD -- pipelines/video/visuals-flow/lib/assemble.mjs pipelines/video/visuals-flow/lib/assemble.test.mjs pipelines/video/visuals-flow/steps/090-assemble-run/README.md`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: 083 (landed)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `88c6943`, 2026-07-18

## Why this matters

The POC final.mp4 (test-01) is assembled with hard cuts. When the video jumps from a screen recording to a full-screen HeyGen avatar and back, a hard cut reads as cheap; the standard YouTube grammar for this jump is a whip-pan: the outgoing frame slides off fast under heavy horizontal motion blur while the incoming frame slides in. The owner explicitly requested this effect (2026-07-18) with reference screenshots of a competitor video. It must not break the plan-083 architecture: every segment is encoded independently to `.ts` with identical encoder params, then concatenated with `-c:v copy` — so the transition must itself be a tiny encoded segment, and neighbors must shrink by the same amount of timeline the transition covers (audio is a single continuous vo.mp3 mux and must stay untouched).

## Current state

All work happens in `pipelines/video/visuals-flow/`. Run all commands from that directory.

- `lib/assemble.mjs` — step 090's engine. Key parts (excerpts verified at commit 88c6943):
  - `planSegments({resolved, avatarJobs, total})` (line 16) returns a contiguous array of `{kind: 'screen'|'graphic'|'avatar', id, start, end}` covering `[0, total]`, sorted by time. `screen` segments are gap-fillers between replacements.
  - `planSegmentOverlays(segments, overlays)` (line 54) maps overlay clips onto segments in segment-local time.
  - `encoderArgs({encoder, draft})` (line 76): "One settings object per run — every segment MUST use identical encoder params so the concat stream-copy is valid."
  - The encode loop (lines 163–221): per segment, builds `spawnArgs`. Source resolution per kind:
    ```js
    if (seg.kind === 'screen') {
      seekArgs = ['-ss', String(seg.start + screenOffset), '-to', String(seg.end + screenOffset)];
      src = screen;
    } else if (seg.kind === 'avatar') {
      const job = avatarJobs.find(j => j.id === seg.id);
      src = job.file;
    } else if (seg.kind === 'graphic') { ... }
    ```
    Segments without overlays encode with `-vf \`${VF},tpad=stop_mode=clone:stop_duration=30\` -t <dur> -an <ENC> -f mpegts`. `VF` is `scale=<w>:<h>:force_original_aspect_ratio=decrease,pad=...,fps=30,format=yuv420p` (line 157).
  - Final pass (lines 227–231): concat demuxer with `-c:v copy` + vo.mp3 audio mux; then ffprobe duration/resolution/audio checks that `process.exit(1)` on mismatch.
  - `assemblyMd(...)` (line 91) hardcodes the sentence `Hard cuts, no transitions.` in the header line (line 99).
  - `parseArgs` (line 118) is a hand-rolled flag loop (`--screen`, `--draft`, `--encoder`, `--keep-temp`, `--force`); follow its style for the new flag.
- `lib/assemble.test.mjs` — the exemplar for both test styles: pure-planner unit tests (`planSegments: contiguity and edge placement`, line 10) and the ffmpeg integration test (line 96) that synthesizes lavfi color sources, runs `runAssembly`, and probes the output. New tests must match this file's conventions (node:test, `assert` from `node:assert/strict`, `{skip: ...}` guard on ffmpeg presence, temp dir under `lib/.test-tmp/`).
- `steps/090-assemble-run/run.sh` — thin wrapper forwarding `"$@"` to `node lib/assemble.mjs`; no change needed.
- House rule (repo CLAUDE.md / plans/WORKFLOW.md): commit per step, no AI footers, never push.

## Design (decided — do not re-litigate)

- **Where**: transitions ONLY at screen→avatar and avatar→screen adjacencies. Graphic boundaries stay hard cuts (cards pop in place by design).
- **Duration**: `TRANSITION_DUR = 0.4` seconds total (12 frames @30fps), consuming 0.2s from each neighbor's timeline. Total video duration is unchanged.
- **Direction**: screen→avatar uses xfade `slideleft`; avatar→screen uses `slideright` (whip over to the host, whip back).
- **Blur**: `tmix=frames=3` after the xfade — at full-width slide in 12 frames each frame moves ~160px, so a 3-frame average gives a genuine whip smear. The first/last output frames blend slightly with in-clip neighbors; this softness at the joins is accepted (it reads as the whip settling).
- **Frame alignment** (the correctness core): a transition at boundary `b` covers timeline `[b−0.2, b+0.2]`.
  - Input A = source A over `[b−0.2, b]`, extended with `tpad=stop_mode=clone:stop_duration=1` (frozen last frame under the second half of the slide).
  - Input B = source B over `[b, b+0.2]`, prefixed with `tpad=start_mode=clone:start_duration=0.2` (frozen first frame under the first half).
  - At output t=0 the frame is 100% A@(b−0.2) — matching the shortened A segment's last frame; at t=0.4 it is 100% B@(b+0.2) — matching the shortened B segment's first frame.
- **Skip rules** (each falls back to a hard cut at that boundary, silently — they are legitimate layouts, not errors): neighbor segment shorter than 1.0s on either side; any overlay intersecting `[b−0.2, b+0.2]` (overlay compositing happens per-segment and must not straddle a transition); boundary at `t=0` or `t=total` (no neighbor).
- **Flag**: `--transitions whip|none`, default `whip`. `none` must produce exactly today's segment plan (regression guarantee).
- **Encoder params**: the transition `.ts` uses the same `VF` + `ENC` as every other segment — this is what keeps the stream-copy concat valid.

## The planner (inline — place as-is in `lib/assemble.mjs`, export it)

```js
export const TRANSITION_DUR = 0.4;

// Whip transitions at screen<->avatar boundaries. Returns [{at, direction,
// fromIdx, toIdx}] in timeline order. Skips: short neighbors, overlay
// straddle, t=0/t=total edges (planSegments guarantees contiguity, so a
// boundary is simply segments[i].end === segments[i+1].start).
export function planTransitions(segments, overlays, { duration = TRANSITION_DUR } = {}) {
  const half = duration / 2;
  const out = [];
  for (let i = 0; i < segments.length - 1; i++) {
    const a = segments[i], b = segments[i + 1];
    const pair = `${a.kind}>${b.kind}`;
    if (pair !== 'screen>avatar' && pair !== 'avatar>screen') continue;
    if (a.end - a.start < 1.0 || b.end - b.start < 1.0) continue;
    const at = a.end;
    if (overlays.some((o) => o.start < at + half && o.end > at - half)) continue;
    out.push({ at, direction: pair === 'screen>avatar' ? 'left' : 'right', fromIdx: i, toIdx: i + 1 });
  }
  return out;
}
```

## The transition encode (inline — the filter graph to use in `runAssembly`)

For a transition `t` at boundary `b = t.at`, with `half = TRANSITION_DUR / 2`:

- Source slices (reuse the segment-source logic):
  - A screen side: input args `['-ss', String(b - half + screenOffset), '-to', String(b + screenOffset), '-i', screen]`.
  - An avatar side for job `j` (clip-local time = timeline − `j.start`): FROM-side slice `['-ss', String(b - half - j.start), '-to', String(b - j.start), '-i', j.file]`; TO-side slice `['-ss', '0', '-to', String(half), '-i', j.file]` (a transition into an avatar always starts at that job's clip start, since `b` is the segment boundary).
- Filter graph (both inputs normalized by the run's `VF` first):

```js
const chain =
  `[0:v]${VF},tpad=stop_mode=clone:stop_duration=1[a];` +
  `[1:v]${VF},tpad=start_mode=clone:start_duration=${half}[b];` +
  `[a][b]xfade=transition=slide${t.direction}:duration=${TRANSITION_DUR}:offset=0[x];` +
  `[x]tmix=frames=3[v]`;
const spawnArgs = ['-y', ...sliceA, ...sliceB,
  '-filter_complex', chain, '-map', '[v]',
  '-t', String(TRANSITION_DUR), '-an', ...ENC, '-f', 'mpegts', transFile];
```

Neighbor trims: a segment with a transition at its END encodes `half` seconds shorter at the tail (screen: reduce the `-to` seek by `half`; avatar: reduce `-t` by `half`). A segment with a transition at its START encodes `half` shorter at the head (screen: increase `-ss` by `half`; avatar: add `['-ss', String(half)]` before its `-i`). Graphic segments are never adjacent to a transition (skip rules guarantee it), so their path is untouched. The transition's concat line is inserted between its two neighbors' lines.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Test gate (this is boss's merge gate) | `bash scripts/check.sh` (from `pipelines/video/visuals-flow/`) | exit 0, `visuals-flow check OK` |
| ffmpeg capability check | `ffmpeg -hide_banner -filters \| grep -E 'xfade\|tmix'` | both filters listed |
| Single test file | `node --test lib/assemble.test.mjs` | all pass |
| Draft render (verifier, not executor) | `bash steps/090-assemble-run/run.sh test-01 --draft` | `final-draft.mp4` in kb-scratch |

## Scope

**In scope**:
- `pipelines/video/visuals-flow/lib/assemble.mjs`
- `pipelines/video/visuals-flow/lib/assemble.test.mjs`
- `pipelines/video/visuals-flow/steps/090-assemble-run/README.md` (document the flag, one paragraph)

**Out of scope** (do not touch):
- `lib/render.mjs`, `lib/board.mjs`, `lib/avatar-render.mjs` — unrelated engines.
- `steps/090-assemble-run/run.sh` — already forwards `"$@"`.
- The `visuals-flow` skill file and `PIPELINE.md`/`HANDOFF.md` — doc sync happens in the owner's next docs pass, not here.
- `videos/test-01/**` — never regenerate or edit committed per-video artifacts (the committed `assembly.md` for test-01 is only rewritten when the owner actually re-assembles).

## Git workflow

- Branch: `boss/084-assemble-whip-transitions`
- Commit per step, conventional messages (e.g. `feat(visuals-flow): planTransitions — whip boundaries planner`), no AI footers. Do NOT push.

## Steps

### Step 1: `planTransitions` + unit tests

Add the planner exactly as inlined above (place it after `planSegmentOverlays`). Add unit tests to `lib/assemble.test.mjs` following the `planSegments` test style, covering: (a) screen→avatar gives `left`, avatar→screen gives `right`; (b) graphic boundaries produce nothing; (c) a neighbor < 1.0s is skipped; (d) an overlay straddling the boundary is skipped; (e) an avatar span starting at t=0 or ending at total produces no transition on that outer edge (its inner boundary still qualifies).

**Verify**: `node --test lib/assemble.test.mjs` → all pass, new tests visible in output.

### Step 2: wire transitions into `runAssembly` + `--transitions` flag

Add `transitions: 'whip' | 'none'` (default `'whip'`) to `runAssembly`'s options and `--transitions` to `parseArgs` (reject any value other than `whip`/`none`, matching the `--encoder` validation style). When `'none'`, or when `planTransitions` returns `[]`, the encode loop must be byte-identical in behavior to today. When `'whip'`: compute the trims map, adjust neighbor encodes, encode each transition `.ts` (named `seg-NNN-trans-<fromId>-<toId>.ts` in sequence order) with the inlined filter graph, and insert its concat line between the neighbors.

**Verify**: `node --test lib/assemble.test.mjs` → integration tests still pass (they exercise the default `whip` path — the existing test fixture has a screen→avatar boundary at t=6, so it now produces a transition; update the segment-count assertion accordingly and add: every `trans` `.ts` probes to duration 0.4 ± 0.05 via ffprobe, and the final duration/resolution/audio assertions still hold).

### Step 3: `--transitions none` regression + assembly.md

Extend `assemblyMd(video, segments, overlays, total, outPath, transitions)` to (a) replace the hardcoded `Hard cuts, no transitions.` sentence with `Hard cuts.` when there are no transitions and `Whip transitions at the listed boundaries; hard cuts elsewhere.` otherwise, and (b) append a `## Transitions` table (`| at | direction | from | to |`) when non-empty. Update the existing `assemblyMd: format` unit test and add one for the transitions table. Add an integration assertion that running with `transitions: 'none'` produces the same number of `.ts` segments as before this plan (no `trans` files).

**Verify**: `node --test lib/assemble.test.mjs` → all pass.

### Step 4: docs + gate

Add a short "Transitions" paragraph to `steps/090-assemble-run/README.md`: default whip at screen↔avatar boundaries, `--transitions none` to disable, skip rules one line each.

**Verify**: `bash scripts/check.sh` → exit 0, `visuals-flow check OK`.

## Test plan

All in `lib/assemble.test.mjs`, following its existing two conventions: pure unit tests for `planTransitions` (Step 1 list) and the lavfi-synthesized ffmpeg integration test extended per Steps 2–3 (transition `.ts` present and 0.4s ± 0.05, total duration still exact, `none` mode structurally identical to pre-plan behavior).

## Done criteria

- [ ] `bash scripts/check.sh` exits 0 (from `pipelines/video/visuals-flow/`).
- [ ] `node --test lib/assemble.test.mjs` shows the new planTransitions unit tests and extended integration assertions passing.
- [ ] Integration test proves: ≥1 `trans` `.ts` exists in whip mode with ffprobe duration 0.4 ± 0.05; final output duration within 0.5s of total; resolution and audio probes unchanged.
- [ ] `--transitions none` path asserted structurally identical to pre-plan segment output (no `trans` files, same segment count).
- [ ] `plans/README.md` row 084 updated to DONE.

## STOP conditions

- `ffmpeg -filters` lacks `xfade` or `tmix` on this machine — stop and report the ffmpeg version; do not substitute filters.
- The concat final pass fails or the duration/resolution probes fail after adding transitions (indicates encoder-param mismatch between transition and neighbor segments) — stop after 5 fix attempts per the run rules.
- Any needed change outside the three in-scope files — stop and report.

## Maintenance notes

- The corner avatar track (owner-deferred) will composite through `planSegmentOverlays` (plan 083 notes); it does NOT interact with transitions — transitions only touch base-track boundaries.
- If a future card type wants transitions at graphic boundaries, extend the `pair` allowlist in `planTransitions` — nothing else changes.
- The verifier must render test-01 `--draft` and visually inspect at least one screen→avatar and one avatar→screen transition before landing (decisions.md 2026-07-07 render+inspect mitigation; agy never self-certifies visuals).
- The 0.4s/0.2s split, slide directions, and tmix strength are taste constants — if the owner wants them tuned after watching, that is a constants-only edit at the top of `assemble.mjs`.
