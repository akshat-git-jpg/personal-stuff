---
executor: agy
model:
test_cmd: bash pipelines/video/visuals-flow/scripts/check.sh
ui: true
deploy:
needs: [084 must land first — both plans rewrite the avatar-segment encode path in lib/assemble.mjs]
---

# Plan 085: Flash + punch-in refresh beats inside long avatar spans (step 090)

## Summary

- **Problem statement**: A full-screen avatar span can run minutes with zero visual change — a retention risk. The owner wants the "flash cut" YouTube pattern inside long spans: the frame blinks with a color wash and the same avatar continues, with a slight punch-in so it reads as a deliberate jump cut.
- **Goals**:
  - `planAvatarBeats()` pure planner: a beat every ~20s inside avatar segments, snapped to the nearest inter-word silence gap (word timestamps — never blinks mid-word), ≥8s from span edges.
  - At each beat the avatar segment splits into sub-segments with alternating punch-in (1.0× / 1.08×) and a 0.24s brand-orange wash straddling the cut (0.12s ramp-in on the outgoing side, 0.12s ramp-out on the incoming side).
  - `--beats on|off` flag, default `on`. VISUAL ONLY — no SFX, no audio change of any kind (owner decision 2026-07-18).
- **Executor proposed**: agy (Gemini 3.1 Pro High) — fully inlined; visual output passes the render+inspect gate (verifier renders test-01 `--draft`, inspects a beat).
- **Done criteria** (terse): `check.sh` exits 0 with new unit + integration tests; `--beats off` structurally identical to pre-plan; total duration byte-exact unchanged.
- **Stop conditions** (terse): needs changes outside the two in-scope files; concat probes fail; interaction with plan 084's transitions cannot be resolved by ordering (see Design).
- **Test / verification for success**: `planAvatarBeats` unit tests + extended ffmpeg integration test (sub-segment `.ts` count, duration probes); verifier visual inspection of a flash frame.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 88c6943..HEAD -- pipelines/video/visuals-flow/lib/assemble.mjs pipelines/video/visuals-flow/lib/assemble.test.mjs` — plan 084's changes WILL appear (it lands first); anything else is drift.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: 084 (landed)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `88c6943`, 2026-07-18 (084 rebases this — run the drift check)

## Why this matters

test-01's shot plan has 9 avatar-full spans totaling 247.7s; individual spans reach tens of seconds of a static talking head. The standard retention grammar (owner's reference screenshots, 2026-07-18) is a color-flash jump cut: a colored wash blinks over the frame for a few frames and the same shot continues, punched in slightly so the continuation reads as a new angle. Word-level timestamps let this pipeline do what a human editor does by ear — cut at sentence gaps — automatically.

## Current state

Work in `pipelines/video/visuals-flow/`. After plan 084, `lib/assemble.mjs` contains `planSegments` (contiguous base track), `planTransitions` (whip boundaries), `planSegmentOverlays` (overlay→segment mapping, handles arbitrary segment lists), and the per-segment encode loop where an avatar segment encodes its clip with `src = job.file` (clip-local time 0 = timeline `job.start`), `-t <dur>`, shared `VF`/`ENC`, `-f mpegts`. `assemble.test.mjs` is the exemplar: pure-planner unit tests + a lavfi-synthesized integration test. Design palette (`../card-library/DESIGN.md` line 21): `--accent: #fb923c` — "THE accent"; the wash uses it.

## Design (decided — do not re-litigate)

- Constants at the top of `assemble.mjs` (taste knobs, owner may tune later):
  `BEAT_INTERVAL = 20`, `BEAT_MIN_EDGE = 8`, `BEAT_SNAP_WINDOW = 3`, `BEAT_MIN_GAP = 0.25`, `FLASH_DUR = 0.24`, `FLASH_COLOR = '0xfb923c'`, `FLASH_ALPHA = 0.85`, `PUNCH_SCALE = 1.08`.
- **Beat placement**: inside each `avatar` segment, targets at `start + k*BEAT_INTERVAL`; each snaps to the CENTER of the nearest inter-word gap (`words[i+1].start - words[i].end >= BEAT_MIN_GAP`) within ±`BEAT_SNAP_WINDOW`s; no qualifying gap → that beat is dropped. Beats must lie in `[start+BEAT_MIN_EDGE, end-BEAT_MIN_EDGE]`. A span shorter than `BEAT_INTERVAL + BEAT_MIN_EDGE` gets no beats.
- **Split-then-plan ordering** (this is what makes 084 + overlays compose cleanly): `planSegments` → beat-split avatar segments into sub-segments (`kind` stays `'avatar'`, same `id` plus `sub` index, each carrying `punch` = `PUNCH_SCALE` on odd sub-index, 1.0 on even) → `planTransitions` (fires only on screen↔avatar pairs, so avatar↔avatar sub-boundaries are naturally ignored; a transition trims only the first/last sub-segment) → `planSegmentOverlays` over the SUB-segment list (overlay slicing then just works).
- **Punch-in**: appended to the sub-segment's filter after `VF`: `,scale=trunc(iw*<punch>/2)*2:-2,crop=<w>:<h>` (center crop is ffmpeg's default). `punch` 1.0 appends nothing.
- **Flash**: a lavfi color layer overlaid on the sub-segment edge touching a beat. Outgoing side (sub-segment ending at a beat): `color=c=<FLASH_COLOR>@<FLASH_ALPHA>:s=<w>x<h>:r=30,format=yuva420p,fade=t=in:st=<dur-0.12>:d=0.12:alpha=1` overlaid on the base. Incoming side: `fade=t=out:st=0:d=0.12:alpha=1`. Total wash on screen = 0.24s centered on the cut.
- **No audio change whatsoever** — vo.mp3 mux stays byte-identical in the final pass.
- **Flag**: `--beats on|off`, default `on`, validated like `--encoder`. `off` → no splitting, structurally today's output.

## The planner (inline — place as-is, export it)

```js
export const BEAT_INTERVAL = 20, BEAT_MIN_EDGE = 8, BEAT_SNAP_WINDOW = 3, BEAT_MIN_GAP = 0.25;

// Refresh beats inside one avatar segment: every ~BEAT_INTERVAL s, snapped to
// the nearest inter-word silence so the flash never lands mid-word. Returns
// ascending beat times (timeline seconds); [] when the span is too short.
export function planAvatarBeats(seg, words, {
  interval = BEAT_INTERVAL, minEdge = BEAT_MIN_EDGE,
  window = BEAT_SNAP_WINDOW, minGap = BEAT_MIN_GAP } = {}) {
  const gaps = [];
  for (let i = 0; i < words.length - 1; i++) {
    const g = words[i + 1].start - words[i].end;
    if (g >= minGap) gaps.push(+((words[i].end + words[i + 1].start) / 2).toFixed(3));
  }
  const beats = [];
  const lo = seg.start + minEdge, hi = seg.end - minEdge;
  for (let t = seg.start + interval; t <= hi; t += interval) {
    let best = null;
    for (const g of gaps) {
      if (g < lo || g > hi || Math.abs(g - t) > window) continue;
      if (best === null || Math.abs(g - t) < Math.abs(best - t)) best = g;
    }
    if (best !== null && (beats.length === 0 || best - beats[beats.length - 1] >= interval / 2)) beats.push(best);
  }
  return beats;
}
```

Splitting helper (also export, also unit-test): `splitAvatarSegments(segments, words)` maps each avatar segment through `planAvatarBeats` and returns the new segment list where a beat-carrying avatar segment `{id:'s01', start, end}` becomes `[{...,'id':'s01', sub:0, start, end:b1, flashOut:true, punch:1.0}, {id:'s01', sub:1, start:b1, end:b2, flashIn:true, flashOut:true, punch:1.08}, ...]` (last sub has no `flashOut`; punch alternates by `sub` parity). Non-avatar segments pass through untouched.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Test gate (boss merge gate) | `bash scripts/check.sh` (from `pipelines/video/visuals-flow/`) | exit 0, `visuals-flow check OK` |
| Single file | `node --test lib/assemble.test.mjs` | all pass |
| Draft render (verifier only) | `bash steps/090-assemble-run/run.sh test-01 --draft` | final-draft.mp4 in kb-scratch |

## Scope

**In scope**: `pipelines/video/visuals-flow/lib/assemble.mjs`, `pipelines/video/visuals-flow/lib/assemble.test.mjs`, `pipelines/video/visuals-flow/steps/090-assemble-run/README.md` (one "Refresh beats" paragraph).

**Out of scope**: everything else — especially the audio/mux path (NO SFX — owner decision), `lib/avatar-render.mjs`, shot lint rules, `videos/test-01/**` committed artifacts.

## Git workflow

- Branch: `boss/085-assemble-avatar-refresh-beats`
- Commit per step, conventional messages, no AI footers. Do NOT push.

## Steps

### Step 1: planners + unit tests

Add the constants, `planAvatarBeats`, and `splitAvatarSegments` (after `planTransitions`). Unit tests: (a) 60s span → beats near 20/40s snapped to seeded gaps; (b) beat moved to nearest gap, not the raw target; (c) no gap within ±3s → beat dropped; (d) short span → `[]`; (e) beats respect the 8s edges; (f) `splitAvatarSegments` alternates `punch`, sets `flashIn`/`flashOut` correctly, passes screen/graphic segments through.

**Verify**: `node --test lib/assemble.test.mjs` → all pass.

### Step 2: wire into runAssembly + `--beats` flag

Insert `splitAvatarSegments` between `planSegments` and `planTransitions` when `beats === 'on'`; apply the punch filter suffix and the flash overlay per the Design section inside the sub-segment encodes (a sub-segment with overlays composes: base → punch → overlays → flash). Avatar sub-segment source seek: `['-ss', String(sub.start - job.start)]` before `-i job.file`, `-t` = sub duration.

**Verify**: `node --test lib/assemble.test.mjs` — extend the integration test: lengthen the fixture avatar clip to 60s (lavfi), assert the whip+beats run produces the expected sub-segment `.ts` count, each probes to its planned duration ±0.05, final duration/resolution/audio probes unchanged.

### Step 3: `--beats off` regression + assembly.md + docs

`--beats off` integration assertion: segment structure identical to 084-only behavior. `assemblyMd`: beat-split sub-segments appear as their own base-track rows (id `s01.1`, `s01.2`, …) — update the format test. Add the README paragraph.

**Verify**: `bash scripts/check.sh` → exit 0.

## Test plan

All in `lib/assemble.test.mjs` per its conventions (node:test, lavfi fixtures, ffprobe assertions): Step 1 unit list, Step 2 integration extension, Step 3 regression.

## Done criteria

- [ ] `bash scripts/check.sh` exits 0.
- [ ] New unit tests for `planAvatarBeats`/`splitAvatarSegments` pass.
- [ ] Integration: beat sub-segments present with correct durations; final duration within 0.5s of total; audio probe unchanged (no audio edits anywhere in the diff).
- [ ] `--beats off` structurally identical to plan-084 output.
- [ ] `plans/README.md` row 085 updated to DONE.

## STOP conditions

- Plan 084 not landed (drift check shows no `planTransitions` in assemble.mjs) — stop, wrong ordering.
- Any audio-path change becomes necessary — stop (owner explicitly deferred SFX).
- Concat/duration probes fail after 5 fix attempts — stop and report.

## Maintenance notes

- When the owner later wants SFX (whoosh on whips, click on flashes), it is ONE change: mix delayed samples into the existing vo.mp3 mux in the final pass — both 084 and 085 expose their event times (`planTransitions`/beats), so the SFX plan needs no re-encode of segments.
- Taste knobs are the constants block; tuning after the owner watches a draft is a constants-only edit.
- Verifier: render test-01 `--draft`, scrub to a beat inside the longest span, inspect flash + punch alternation (render+inspect gate; agy never self-certifies visuals).
