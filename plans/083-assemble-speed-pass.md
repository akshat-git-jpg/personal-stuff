---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui:
deploy:
needs: []
---

# Plan 083: assemble speed pass — single-encode overlays, hardware encoder, --draft

## Summary

- **Problem statement**: Step 090 assembly (plan 082, landed at `83aafcc`)
  encodes every frame of the video twice: a segment pass, then a full-length
  final pass that exists only to composite ~50s of overlays onto a ~32-min
  timeline and mux audio. A 32-min video takes ~15+ min to assemble on an
  M2 Pro; there is also no fast preview mode.
- **Goals**:
  - Composite each overlay INTO the segment(s) it intersects during the
    segment pass; the final pass becomes a stream-copy concat + audio mux
    (seconds). One encode per frame.
  - Encoder selection: auto-detect `h264_videotoolbox` (Apple hardware
    encoder, ~5–10x faster than libx264 here) with libx264 fallback and a
    `--encoder` override. Tests always force x264 (host-agnostic).
  - `--draft` flag: 1280x720 fast preview, default output name
    `final-draft.mp4` so a draft never clobbers a ship render.
- **Executor proposed**: agy (Gemini 3.1 Pro High, agy default) — fully-inlined
  standard rework of one file + its tests.
- **Done criteria** (terse): `bash scripts/check.sh` green; integration test
  proves single-pass (no `base.mp4` in temp) incl. a boundary-crossing
  overlay; draft integration produces 1280x720 `final-draft.mp4`.
- **Stop conditions** (terse): never assemble real `videos/test-01/`; no
  videotoolbox dependence in tests; concat stream-copy failing after 2 fix
  attempts = stop, don't reintroduce the re-encode silently.
- **Test / verification for success**: extended `lib/assemble.test.mjs`
  (unit + lavfi fixtures in `lib/.test-tmp/`), gated by `scripts/check.sh`.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 06a3317..HEAD -- pipelines/video/visuals-flow pipelines/.claude/skills/visuals-flow`

## Status

- **Priority**: P2
- **Effort**: S-M
- **Risk**: MED (ffmpeg concat stream-copy + per-segment filter_complex — both
  covered by the integration fixtures)
- **Depends on**: 082 (landed, PR #39)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `06a3317`, 2026-07-18

## Why this matters

Assembly works (test-01 produced a verified 32:07 final.mp4 on 2026-07-18) but
the two-pass design wastes most of its runtime re-encoding frames that already
exist just to composite 10 short overlays and add audio. Overlays only touch
seconds of timeline; compositing them where they land — inside the segment
encodes — makes the final pass a remux. Hardware encoding then multiplies the
remaining (single) encode pass. Target: a 32-min video assembles in ~3–5 min
standard, ~2 min draft. YouTube re-encodes every upload, so "clean at a
generous bitrate" is the quality bar — archival CRF via software x264 buys
nothing visible downstream.

## Current state

All paths relative to `pipelines/video/visuals-flow/` unless rooted. Read
`lib/assemble.mjs` in full before editing (311 lines at `06a3317`).

- `lib/assemble.mjs` structure today:
  - `planSegments({resolved, avatarJobs, total})` (lines 16–49) — pure,
    unchanged by this plan.
  - `assemblyMd(...)` (lines 52–77) — unchanged.
  - `parseArgs` (lines 79–93) — flags: `--screen`, `--screen-offset`, `--out`,
    `--keep-temp`, `--force`. This plan adds `--draft` and `--encoder`.
  - `runAssembly({workdir, video, resolved, avatarJobs, total, screen,
    screenOffset, out, keepTemp})` (lines 101–219) — the rework target:
    - Builds `overlays` from resolved overlay cues via
      `planRender(c).outFile` (lines 104–106).
    - Segment loop (lines 115–149): every segment encodes with
      `-vf "${VF},tpad=stop_mode=clone:stop_duration=30" -t <dur> -an
      -c:v libx264 -preset veryfast -crf 18 -f mpegts` where
      `VF = scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p`.
      Screen segments add `-ss <start+screenOffset> -to <end+screenOffset>`
      before `-i`.
    - Concat to `base.mp4` with `-c copy` (line 152).
    - Final pass (lines 158–189): re-encodes ALL of base.mp4 with
      `-itsoffset`-shifted overlay inputs chained through
      `overlay=eof_action=pass:enable='between(t,S,E)'`, maps vo.mp3,
      `-c:v libx264 -preset medium -crf 18` — **this whole pass is what we
      delete**.
    - Post-checks (lines 191–208): duration ±0.5s of total, resolution
      hardcoded `1920x1080`, audio stream present. Resolution becomes
      parametric (draft).
    - On any ffmpeg failure it prints stderr and `process.exit(1)` — keep
      that behavior.
  - `main()` (lines 221–306) — gates (approval, staleness, avatar files,
    renders, vo/screen existence), then computes `out` default
    `<ASSEMBLE_MEDIA_ROOT>/<video>/final.mp4` and calls `runAssembly`.
- `lib/assemble.test.mjs` (125 lines) — exemplar to extend: unit tests on
  `planSegments`/`assemblyMd`, one ffmpeg integration test with lavfi
  fixtures under `lib/.test-tmp/assemble-it/` (blue screen, red avatar,
  green fullframe, transparent qtrle overlay, 8s silence), file names follow
  `planRender` (`0002-c1-green.mp4`, `0005-o1-black.mov`). Integration skips
  when ffmpeg is absent.
- `scripts/check.sh` already runs `lib/assemble.test.mjs` — no edit needed
  unless you add a new test FILE (don't; extend the existing one).
- ffmpeg 8.1.1 on the dev machine; `h264_videotoolbox` exists on macOS only —
  the VPS lacks it, hence auto-detect + x264-forced tests.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Baseline + merge gate | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exit 0, `visuals-flow check OK` |
| One test file | `cd pipelines/video/visuals-flow && node --test lib/assemble.test.mjs` | all pass |
| Encoder listing | `ffmpeg -hide_banner -encoders \| /usr/bin/grep videotoolbox` | lists `h264_videotoolbox` on macOS (may be empty elsewhere — that's the fallback case) |

## Scope

**In scope** (the only files to touch):
- `pipelines/video/visuals-flow/lib/assemble.mjs`
- `pipelines/video/visuals-flow/lib/assemble.test.mjs`
- `pipelines/video/visuals-flow/steps/090-assemble-run/README.md`
- `pipelines/.claude/skills/visuals-flow/SKILL.md`
- `plans/README.md` (status row on completion)

**Out of scope** (do not touch):
- `videos/test-01/` — real data; never assemble it, never edit it.
- `lib/render.mjs` and every other lib/step — read-only.
- `.gitignore`, `PIPELINE.md` — already correct for this change.

## Git workflow

- Branch: `advisor/083-assemble-speed-pass`
- Commits per step, conventional style, e.g.
  `feat(visuals-flow): assemble — overlay-in-segment single-encode path` —
  no AI footers. Do NOT push.

## Steps

### Step 1: pure helpers — `planSegmentOverlays`, `encoderArgs`, `detectEncoder`

Add to `lib/assemble.mjs` (exported, near `planSegments`):

```js
// Map each overlay onto the segment(s) it intersects, in segment-local time.
// trimStart = seconds into the overlay clip where this segment's slice begins
// (non-zero only when an overlay crosses a segment boundary).
export function planSegmentOverlays(segments, overlays) {
  return segments.map((seg) => {
    const local = [];
    for (const o of overlays) {
      const s = Math.max(o.start, seg.start);
      const e = Math.min(o.end, seg.end);
      if (e - s > 0.01) {
        local.push({
          id: o.id,
          file: o.file,
          trimStart: +Math.max(seg.start - o.start, 0).toFixed(3),
          at: +(s - seg.start).toFixed(3),
          until: +(e - seg.start).toFixed(3),
        });
      }
    }
    return local;
  });
}

// One settings object per run — every segment MUST use identical encoder
// params so the concat stream-copy is valid.
export function encoderArgs({ encoder, draft }) {
  if (encoder === 'videotoolbox') {
    return ['-c:v', 'h264_videotoolbox', '-b:v', draft ? '4M' : '12M', '-pix_fmt', 'yuv420p'];
  }
  return draft
    ? ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28']
    : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18'];
}

export function detectEncoder() {
  const res = spawnSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8' });
  return (res.stdout || '').includes('h264_videotoolbox') ? 'videotoolbox' : 'x264';
}
```

**Verify**: `cd pipelines/video/visuals-flow && node -e "import('./lib/assemble.mjs').then(m => console.log(typeof m.planSegmentOverlays, typeof m.encoderArgs, m.detectEncoder()))"` → `function function` + `videotoolbox` or `x264`

### Step 2: rework `runAssembly` to the single-encode path

`runAssembly` gains options `draft = false` and `encoder` (default
`detectEncoder()`). Changes, in order:

1. Canvas becomes parametric:
   `const { w, h } = draft ? { w: 1280, h: 720 } : { w: CANVAS.w, h: CANVAS.h };`
   `const VF = \`scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p\`;`
   `const ENC = encoderArgs({ encoder, draft });`
2. Compute `overlays` as today, then
   `const segOverlays = planSegmentOverlays(segments, overlays);`
3. Segment loop: keep source/`-ss`/`-to` selection per kind exactly as today,
   but build the command differently depending on `segOverlays[i]`:
   - **No overlays for this segment** (most segments): as today but with
     `...ENC` replacing the hardcoded `-c:v libx264 -preset veryfast -crf 18`:
     `['-y', ...(screen ? ['-ss', ..., '-to', ...] : []), '-i', src, '-vf', `${VF},tpad=stop_mode=clone:stop_duration=30`, '-t', String(dur), '-an', ...ENC, '-f', 'mpegts', segFile]`
   - **With overlays**: extra inputs + filter_complex instead of `-vf`.
     For local overlays `L[0..k-1]` (overlay j is input j+1):

     ```
     [0:v]${VF},tpad=stop_mode=clone:stop_duration=30[b0];
     [1:v]trim=start=${L[0].trimStart},setpts=PTS-STARTPTS+${L[0].at}/TB,scale=${w}:${h}[o0];
     [b0][o0]overlay=eof_action=pass:enable='between(t,${L[0].at},${L[0].until})'[b1];
     [2:v]trim=start=${L[1].trimStart},setpts=PTS-STARTPTS+${L[1].at}/TB,scale=${w}:${h}[o1];
     [b1][o1]overlay=eof_action=pass:enable='between(t,${L[1].at},${L[1].until})'[b2];
     …
     ```

     Args: `['-y', ...(seek args for screen), '-i', src, ...L.flatMap(o => ['-i', o.file]), '-filter_complex', chain, '-map', `[b${k}]`, '-t', String(dur), '-an', ...ENC, '-f', 'mpegts', segFile]`
     (the `scale=${w}:${h}` on each overlay branch keeps 1080p overlay movs
     canvas-sized in draft mode; join chain parts with `;`).
4. Delete the `base.mp4` concat AND the whole final overlay pass
   (old lines 152–189). Replace with ONE remux (cwd `tmpDir`):

   ```
   ffmpeg -y -f concat -safe 0 -i concat.txt -i <absolute voPath> \
     -map 0:v -c:v copy -map 1:a -c:a aac -b:a 192k \
     -t <total> -movflags +faststart <out>
   ```

   (`voPath = path.join(workdir, 'vo.mp3')` — compute it inside `runAssembly`;
   mkdir the out dir before, as today.)
5. Post-checks: duration and audio checks unchanged; resolution check expects
   `` `${w}x${h}` `` instead of hardcoded `1920x1080`.
6. `assemblyMd` call unchanged (overlays still listed; base rows unchanged).

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/assemble.test.mjs` → existing integration test still passes (it exercises the new path end-to-end).

### Step 3: CLI — `--draft`, `--encoder`, draft out-name

- `parseArgs`: add `draft: false`, `encoder: null`; parse `--draft` (boolean)
  and `--encoder` (value; accept only `x264` or `videotoolbox`, else
  `throw new Error('--encoder must be x264 or videotoolbox')`).
- Usage line becomes:
  `usage: node lib/assemble.mjs <slug-or-path> [--screen <path>] [--screen-offset <sec>] [--out <path>] [--draft] [--encoder x264|videotoolbox] [--keep-temp] [--force]`
- `main()`: default out becomes
  `path.join(ASSEMBLE_MEDIA_ROOT, video, opts.draft ? 'final-draft.mp4' : 'final.mp4')`;
  pass `draft: opts.draft` and `encoder: opts.encoder ?? detectEncoder()`
  through to `runAssembly`.

**Verify**: `cd pipelines/video/visuals-flow && node lib/assemble.mjs` → new usage line, exit 1. `node lib/assemble.mjs x --encoder nope` → the encoder error.

### Step 4: tests

Extend `lib/assemble.test.mjs` (same file — check.sh already lists it):

Unit (pure):
- `planSegmentOverlays`: overlay fully inside one segment → one entry with
  `trimStart 0`, correct `at`/`until`; overlay `[1.5, 2.5]` across segments
  `[0,2]` and `[2,4]` → entry in BOTH (first: `at 1.5, until 2, trimStart 0`;
  second: `at 0, until 0.5, trimStart 0.5`); overlay outside a segment →
  empty list; <10ms sliver intersection → dropped.
- `encoderArgs`: x264 standard → contains `libx264` + `veryfast`; x264 draft →
  `ultrafast`; videotoolbox standard → `h264_videotoolbox` + `12M`; draft →
  `4M`. `detectEncoder()` returns `'x264'` or `'videotoolbox'` (don't assert
  which — host-dependent).

Integration (all forced to `encoder: 'x264'` for host-agnostic runs; same
lavfi fixture style; keep runtime small):
- Move the overlay in the existing fixture from `[5,6]` to `[5.5, 6.5]` so it
  CROSSES the screen→avatar boundary at 6.0 (rename the render to
  `0005-o1-black.mov` stays valid — `planRender` uses start 5.5 → `0005`).
  Adjust the existing assertions accordingly.
- Run with `keepTemp: true` and assert `assembly-tmp/` contains NO
  `base.mp4` (single-pass proof) and ≥5 `.ts` segments; then clean up.
- New draft test: same fixture, `draft: true`, out `final-draft.mp4` → exists,
  probes `1280x720`, duration `8 ± 0.5`, audio present.

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/assemble.test.mjs` → all pass.

### Step 5: docs

`steps/090-assemble-run/README.md` — update the usage line to match Step 3's,
and append:

```markdown
Speed: overlays are composited inside the segment encodes and the final pass
is a stream-copy remux — one encode per frame. The encoder auto-selects
h264_videotoolbox (Apple hardware) when available, libx264 otherwise;
`--encoder` overrides. `--draft` renders a 1280x720 preview to
`final-draft.mp4` (never clobbers `final.mp4`).
```

`pipelines/.claude/skills/visuals-flow/SKILL.md` (SOURCE file — the
`.claude/skills/` copy is a symlink, don't touch it): in the
"assemble the video" verb, append one line to item 2:

```markdown
   For a fast placement check first, add `--draft` (720p preview,
   `final-draft.mp4`); re-run without it for the ship render.
```

**Verify**: `/usr/bin/grep -c "draft" pipelines/video/visuals-flow/steps/090-assemble-run/README.md` → ≥1; `/usr/bin/grep -c "draft" pipelines/.claude/skills/visuals-flow/SKILL.md` → ≥1

### Step 6: merge gate + status row

Run the full gate; flip this plan's row in `plans/README.md`. `git add` the
plan/prompt/run-log docs if untracked.

**Verify**: `cd pipelines/video/visuals-flow && bash scripts/check.sh` → exit 0, `visuals-flow check OK`

## Test plan

Covered in Step 4: pure unit tests for the overlay mapper and encoder args;
x264-forced integration fixtures proving the single-encode path (no base.mp4),
boundary-crossing overlay compositing, and the draft profile. Gate:
`bash scripts/check.sh` (the `test_cmd`).

## Done criteria

- [ ] `cd pipelines/video/visuals-flow && bash scripts/check.sh` → exit 0.
- [ ] Integration proves single-pass: with `keepTemp: true`, `assembly-tmp/`
      has no `base.mp4`; final output probes green (duration/resolution/audio).
- [ ] Boundary-crossing overlay fixture passes.
- [ ] Draft run produces `final-draft.mp4` at 1280x720.
- [ ] Usage line, step README, and skill verb mention `--draft`/`--encoder`.
- [ ] `git status` clean of stray files outside `lib/.test-tmp/`.

## STOP conditions

- `bash scripts/check.sh` red BEFORE any change → stop (broken baseline).
- NEVER assemble real `videos/test-01/` or edit anything under `videos/`.
- Tests must pass with `encoder: 'x264'` on a machine WITHOUT videotoolbox —
  if you find yourself special-casing videotoolbox in tests, stop.
- Concat stream-copy (`-c:v copy` from the .ts segments) producing a broken
  mp4 after 2 fix attempts → stop and report ffmpeg stderr; do NOT quietly
  reintroduce a full re-encode final pass.
- Any need to touch out-of-scope files → stop and report.

## Maintenance notes

- The identical-encoder-params-per-run invariant is what makes the stream-copy
  concat legal — any future per-segment quality tweak must re-encode the
  concat instead.
- The corner avatar track (owner-deferred) should composite like overlays —
  through `planSegmentOverlays` with a position, not a new pass.
- Draft mode is a preview profile, not a contract: thresholds (720p, 4M/28crf)
  can drift without notice; nothing downstream may depend on draft output.
