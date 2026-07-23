---
executor: agy
model:
test_cmd: cd pipelines/youtube/tutorial-pipeline-3 && bash scripts/check.sh
ui:
deploy:
needs: [129, 130, 132]
---

# Plan 133: tutorial-pipeline-3 intake QC + handoff to visuals-flow

## Summary

- **Problem statement**: after plan 132, locked audio lives in the Worker and the
  freelancer uploads per-section recordings to Drive — but nothing pulls them,
  checks them, or builds the `vo.mp3` + `screen.mp4` pair that visuals-flow's
  assembly expects.
- **Goals**:
  - `pull-audio` (locked wavs from the Worker) and `pull-recordings` (clips from
    Drive via the `pp-drive` CLI).
  - Intake QC gate 1 (mechanical: presence, duration vs audio, resolution) writing
    `intake-report.md` + updating `recording.status`; filmstrip contact sheets for
    the gate-2 session read.
  - Handoff builder: concat locked section audio (0.35 s inter-section gap) →
    `vo.mp3`; build the VO-aligned `screen.mp4` (clips trimmed/padded to span;
    talk sections freeze-filled) — both written into
    `pipelines/video/visuals-flow/videos/<slug>/`.
- **Executor proposed**: agy (Gemini 3.1 Pro High — agy default). Timeline planning
  logic and ffmpeg recipes are inlined; the executor places and wires.
- **Done criteria** (terse): `scripts/check.sh` exit 0 including a real-ffmpeg
  integration test on generated fixtures; QC rules provably enforced.
- **Stop conditions** (terse): no live Drive/Worker HTTP calls; ffmpeg/ffprobe
  missing locally; drift check fails.
- **Test / verification for success**: node:test suites (pure planners + injected
  exec/fetch) + one integration test that runs real ffmpeg on tiny lavfi-generated
  fixtures in a temp dir.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in the
> "STOP conditions" section occurs, stop and report. When done, update the status
> row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ff940f0..HEAD -- pipelines/youtube/tutorial-pipeline-3/lib/pull-audio.mjs pipelines/youtube/tutorial-pipeline-3/lib/intake-qc.mjs pipelines/youtube/tutorial-pipeline-3/lib/concat-plan.mjs pipelines/youtube/tutorial-pipeline-3/lib/handoff.mjs`
> Expected: none of these files exist yet. Also confirm deps:
> `ls pipelines/youtube/tutorial-pipeline-3/lib/pull-ui.mjs` must succeed (plan 132
> landed), else STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (ffmpeg timeline math; mitigated by the pure planner + integration test)
- **Depends on**: 129, 130, 132
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `ff940f0`, 2026-07-23

## Why this matters

This plan closes the loop: recordings come back, get checked mechanically (bounce
lists instead of conversations), and the pipeline emits exactly the two artifacts
visuals-flow already consumes (`videos/<slug>/vo.mp3` and `screen.mp4`, both
gitignored media there). The freeze-fill rule for talk sections is what makes the
screen spine continuous so avatar/graphics can cover those spans downstream.

## Current state

- Pipeline (plans 129/130/132): `videos/<slug>/script.json` contract in
  PIPELINE.md; `lib/state.mjs` state rules; `lib/env.mjs` (`loadEnv`),
  `lib/pull-ui.mjs` (admin state GET pattern with injected fetch); `run.sh` verb
  `case`; `scripts/check.sh` explicit `node --test` list (APPEND only).
- Worker admin audio endpoint (plan 132): `GET ${VO_UI_URL}/api/admin/audio/<slug>/<id>`
  with `Authorization: Bearer ${VO_UI_ADMIN_TOKEN}` → wav bytes (409 if unlocked).
- Drive CLI: `pp-drive` (source `tooling/cli/drive/`), relevant subcommands, all
  taking `--account EMAIL`:
  - `list-folder ID` → tab-separated `id, name, mimeType` per child
  - `download ID --out PATH` → prints `saved <path>`
- visuals-flow expects (its PIPELINE.md): `videos/<slug>/vo.mp3` (input voiceover,
  gitignored) and `videos/<slug>/screen.mp4` (VO-aligned screen recording,
  gitignored). Its transcribe step accepts `vo.mp3` directly.
- ffmpeg + ffprobe are required local tools (visuals-flow already depends on them).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Gate | `cd pipelines/youtube/tutorial-pipeline-3 && bash scripts/check.sh` | exit 0 |
| ffmpeg present | `ffmpeg -version && ffprobe -version` | exit 0 (else STOP) |
| Duration probe | `ffprobe -v error -show_entries format=duration -of csv=p=0 <file>` | float seconds |
| Height probe | `ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 <file>` | integer |

## Scope

**In scope** (all under `pipelines/youtube/tutorial-pipeline-3/` unless noted):
- `lib/exec.mjs` + `lib/exec.test.mjs` (tiny promisified execFile wrapper — the
  injectable seam every module below uses)
- `lib/pull-audio.mjs` + `lib/pull-audio.test.mjs`
- `lib/drive-pull.mjs` + `lib/drive-pull.test.mjs`
- `lib/ffmeta.mjs` + `lib/ffmeta.test.mjs`
- `lib/intake-qc.mjs` + `lib/intake-qc.test.mjs`
- `lib/filmstrip.mjs` + `lib/filmstrip.test.mjs`
- `lib/concat-plan.mjs` + `lib/concat-plan.test.mjs`
- `lib/handoff.mjs` + `lib/handoff.integration.test.mjs`
- `steps/060-intake-qc/README.md`, `steps/070-handoff-visuals/README.md`
- EDIT `run.sh` (verbs: `pull-audio`, `pull-recordings`, `qc`, `handoff`)
- EDIT `scripts/check.sh` (append the eight test files)
- EDIT `PIPELINE.md` (document `videos/<slug>/drive.json` and the handoff outputs)

**Out of scope**: `pipelines/video/visuals-flow/` code (we only WRITE media files
into its `videos/<slug>/` at runtime — no code or doc changes there),
`tooling/cli/drive/` (consumed as-is), `apps/tutorial-vo/`.

## Git workflow

- Branch: `advisor/133-tp3-intake-qc-handoff`
- Commit per step. Do NOT push.

## Design decisions (obey; do not re-decide)

- **Inter-section gap**: `GAP_S = 0.35` seconds of silence after every section
  except the last. Constant lives ONLY in `lib/concat-plan.mjs`.
- **Audio normalization**: every section wav is first transcoded to a temp
  `pcm_s16le, 44100 Hz, mono` wav (`ffmpeg -i in.wav -ar 44100 -ac 1 -c:a
  pcm_s16le out.wav`) so the concat demuxer is safe; gap = one generated
  `gap.wav` via `ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 0.35 ...`.
  `vo.mp3` is the concat encoded `-c:a libmp3lame -q:a 2`.
- **Section span** on the video timeline = normalized audio duration + GAP_S
  (no gap after the last section).
- **screen.mp4 recipe**: canvas 1920x1080, 30 fps, yuv420p, h264 (libx264,
  `-preset veryfast -crf 18`), no audio track. Per section, in id order:
  - demo, clip present: `-i clip` with filter
    `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30`,
    trimmed to span; if the clip is shorter than span (possible only within QC
    slack), extend with `tpad=stop_mode=clone:stop_duration=<deficit>`.
  - non-demo (talk): a freeze frame held for the whole span. Freeze source =
    LAST frame of the nearest preceding demo section's clip; if none precedes,
    FIRST frame of the nearest following demo section's clip. Extract with
    `ffmpeg -sseof -0.1 -i clip -frames:v 1` (last) / `-i clip -frames:v 1`
    (first), then loop it: `-loop 1 -t <span> -i frame.png` + the same
    scale/pad/fps filter.
  - Segments are encoded individually to temp files then joined with the concat
    demuxer (`-f concat -safe 0 -c copy`) — identical encode settings make this
    safe.
- **QC gate 1 rules** (per demo section): clip file `recordings/<id>.mp4` or
  `.mov` exists (exactly one; both → error); video duration ≥ audio duration;
  video duration ≤ audio duration + 20 s; height ≥ 1080. Pass → status
  `"received"`, fail → status `"re-record"` with reasons in the report.
- **`videos/<slug>/drive.json`** (committed): `{ "folder_id": "...",
  "account": "email@..." }` — written by the owner when creating the Drive
  folder; `pull-recordings` requires it.
- **intake-report.md format**: header (`# Intake QC — <slug> — <ISO date>`), a
  table `| section | clip | video s | audio s | height | verdict | issues |`,
  then `RESULT: PASS` or `RESULT: FAIL (n sections)` as the last line.

## Steps

### Step 1: `lib/exec.mjs` + `lib/ffmeta.mjs` + tests

`exec.mjs`: `export async function run(cmd, args, opts)` — promisified
`child_process.execFile`, returns `{ stdout, stderr }`, throws with stderr in the
message on non-zero. `ffmeta.mjs`: `durationOf(file, runner = run)` and
`heightOf(file, runner = run)` using the ffprobe commands from the table above,
parsing to Number and validating finiteness. Unit tests inject a fake runner;
plus one real-ffprobe case inside the integration test (Step 6), not here.

**Verify**: `node --test lib/exec.test.mjs lib/ffmeta.test.mjs` → pass.

### Step 2: `lib/pull-audio.mjs` + `lib/drive-pull.mjs` + tests

- `pull-audio.mjs`: `node lib/pull-audio.mjs <slug> [--root d]` — loads
  script.json; for every LOCKED section GETs
  `${VO_UI_URL}/api/admin/audio/<slug>/<id>` (Bearer `VO_UI_ADMIN_TOKEN`, via
  `loadEnv`) and writes `videos/<slug>/audio/<id>.wav`. Errors if any section is
  unlocked (the handoff needs the complete VO). Export `pullAudio(script, opts,
  fetchImpl)` for tests (mock fetch returning bytes).
- `drive-pull.mjs`: `node lib/drive-pull.mjs <slug> [--root d]` — reads
  `drive.json`; `pp-drive list-folder <folder_id> --account <account>`; for each
  child whose name matches `^s\d{2}\.(mp4|mov)$`, `pp-drive download <id> --out
  videos/<slug>/recordings/<name>`. Skips names that don't match (report them as
  `ignored:` lines). Export `planDownloads(listing, sections)` pure (which files
  to fetch / which are missing / which ignored) + CLI wrapper with injected
  runner. Tests: listing parse (tab-separated), matching, missing-demo detection,
  ignored extras.

**Verify**: `node --test lib/pull-audio.test.mjs lib/drive-pull.test.mjs` → pass.

### Step 3: `lib/intake-qc.mjs` + tests

Pure core: `checkSection({ id, demo, audioDur, clip: { path, videoDur, height } |
null })` → `{ verdict: "pass" | "fail" | "skip", issues: string[] }` implementing
gate-1 rules (skip = non-demo). Report builder `buildReport(slug, rows)` →
markdown string per the format above. CLI: `node lib/intake-qc.mjs <slug>
[--root d]` — probes via ffmeta, writes `intake-report.md`, updates each demo
section's `recording.status` in script.json (only that field — never touch
tts/version), exits 0 on RESULT: PASS else 1. Tests: each rule trips
individually (too short, too long, 720p, missing, duplicate ext); report last
line; non-demo skipped; status writes verified on a temp fixture.

**Verify**: `node --test lib/intake-qc.test.mjs` → pass.

### Step 4: `lib/filmstrip.mjs` + tests

`filmstrip(slug, { root, runner })`: for each received demo clip, run
`ffmpeg -y -i <clip> -vf "fps=1/8,scale=320:-1,tile=5x4" -frames:v 1
videos/<slug>/qc/<id>.png`. Unit test asserts the exact argv built per clip
(injected runner records calls); actual pixels are covered by the integration
test.

**Verify**: `node --test lib/filmstrip.test.mjs` → pass.

### Step 5: `lib/concat-plan.mjs` + tests

Pure planner (no I/O):

```js
export const GAP_S = 0.35;
// sections: [{id, demo}], audioDur: {id: seconds}, clips: {id: path|null}
// -> { audio: [{id, wav, gapAfter}], video: [{id, span, source}] }
// source: {type:"clip", path} | {type:"freeze", from:"prev"|"next", clipPath, frame:"last"|"first"}
export function planTimeline(sections, audioDur, clips) { ... }
export function sectionSpan(audioDurSeconds, isLast) { return audioDurSeconds + (isLast ? 0 : GAP_S); }
```

Freeze resolution exactly per the design decision (prev demo's last frame, else
next demo's first frame; a script with zero demo sections → throw). Tests:
spans include/exclude gap correctly; talk-before-first-demo freezes from next;
talk-between-demos freezes from prev; totals sum to Σ(audio) + GAP_S × (n−1)
within 1e-9; zero-demo throws.

**Verify**: `node --test lib/concat-plan.test.mjs` → pass.

### Step 6: `lib/handoff.mjs` + integration test

`node lib/handoff.mjs <slug> [--root d] [--out <dir>]` — default out dir:
`../../video/visuals-flow/videos/<slug>/` resolved from the pipeline root
(mkdir -p). Pipeline: require `intake-report.md` last line `RESULT: PASS` (else
exit 1); normalize audio → build `vo.mp3` per the audio recipe; execute the
`planTimeline` video plan per the screen.mp4 recipe (temp segment encodes →
concat demuxer); print both output paths + total duration; clean temp dir.

`lib/handoff.integration.test.mjs` — REAL ffmpeg, all inside `mkdtemp`:
generate fixtures — two 3 s clips (`ffmpeg -f lavfi -i
testsrc=size=1280x720:rate=30 -t 3`), three wavs (2 s, 1.5 s, 2 s sine via
`-f lavfi -i sine=frequency=440`), a 3-section script fixture (s01 talk, s02
demo, s03 demo); run the handoff build with `--out <tmp>`; assert with ffprobe:
`vo.mp3` duration ≈ 2 + 0.35 + 1.5 + 0.35 + 2 (± 0.15 s), `screen.mp4` duration
≈ same (± 0.25 s), height = 1080, and nb_streams has no audio. Keep total test
runtime under ~30 s.

**Verify**: `node --test lib/handoff.integration.test.mjs` → pass.

### Step 7: step docs + wiring

- `steps/060-intake-qc/README.md`: run order — `run.sh <slug> pull-audio` →
  `pull-recordings` → `qc`; on FAIL send the freelancer the failing section ids +
  issues from intake-report.md (that list IS the bounce message); gate 2 = a
  Claude session reads `videos/<slug>/qc/*.png` against each section's
  `notes` and records verdicts at the bottom of intake-report.md (append a
  `## Gate 2 (session)` section); after everything passes, set each section
  `qc-passed` and `node lib/set-stage.mjs <slug> recorded` then `qc-passed`.
- `steps/070-handoff-visuals/README.md`: `run.sh <slug> handoff`, what lands in
  visuals-flow, and the pointer: from here operate visuals-flow per its
  PIPELINE.md (transcribe → cues → shots → assembly).
- `run.sh`: add the four verbs. `scripts/check.sh`: append the eight test files.
- `PIPELINE.md`: document `drive.json`, `intake-report.md`, and the handoff
  outputs under the videos layout.

**Verify**: `bash scripts/check.sh` → exit 0, `tutorial-pipeline-3 check OK`.

## Test plan

Seven unit suites (injected runner/fetch, temp fixtures, no network) + one real
ffmpeg/ffprobe integration suite on lavfi-generated media in a temp dir. All via
`scripts/check.sh` (= test_cmd).

## Done criteria

- [ ] `cd pipelines/youtube/tutorial-pipeline-3 && bash scripts/check.sh` → exit 0.
- [ ] Integration test proves vo.mp3/screen.mp4 durations, 1080 height, no audio
      stream on screen.mp4.
- [ ] intake-qc rules each provably trip; report format matches the spec.
- [ ] `run.sh` dispatches all four new verbs; docs in both step READMEs.
- [ ] No live HTTP call and no `pp-drive` invocation occurred during execution.

## STOP conditions

- `ffmpeg`/`ffprobe` not on PATH.
- Any live call to the Worker, Drive, or `pp-drive` — tests use injected seams
  only.
- Plan-132 files missing (`lib/pull-ui.mjs`).
- Integration test cannot pass within tolerance after 3 attempts — report the
  measured durations instead of loosening tolerances.

## Maintenance notes

- GAP_S is the one timing constant the whole handoff hangs on; it lives only in
  concat-plan.mjs. If it changes, already-recorded videos must be rebuilt, never
  mixed.
- visuals-flow is a consumer here via files only; if its `videos/<slug>/` layout
  changes, only `lib/handoff.mjs`'s out-dir logic cares.
- Gate 2 stays a session read by design (one LLM call per video, matching the
  repo's one-call-per-pass architecture); do not automate scoring into code.
