---
executor: agy
model:
test_cmd: cd pipelines/video/intro-studio && bash scripts/check.sh
ui:
deploy:
needs: ["depends on 180 and 181. LAST plan of the batch — runs the gate on a fresh checkout."]
---

# Plan 182: intro-studio — compose, render, critique, deliver

## Summary

- **Problem statement**: With the materials stage (180) and the approved screenplay (181) in place, nothing yet turns a screenplay into a finished `intro.mp4`. And per the repo's own hard-won lesson, a graphics pipeline whose gate only checks "did the render succeed" ships visually broken output under green tests — three times in one day on 2026-07-19, and twelve card stubs on 2026-07-24.
- **Goals**:
  - Land the authoring guide for the composition, with the Hyperframes constraints that silently produce black frames spelled out.
  - Land the render step against the pinned `hyperframes@0.7.62`.
  - Land a **pixel-level gate**: extract frames from the actual render and assert motion, coverage and duration — never trust an exit code as proof a video looks right.
  - Land the taste rubric `INTRO-BAR.md`, the one-retry-on-failure critique loop, and delivery to `out/intro.mp4`.
  - Register intro-studio in `pipelines/CLAUDE.md`.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — owner's explicit choice. `INTRO-BAR.md` is taste content that `tooling/boss/data/rules.md` would route to `claude-p`/`sonnet`; compensations are a structural gate over the rubric file and a fully-inlined rubric body in this plan, so the executor transcribes rather than composes.
- **Done criteria** (terse — full list below): `bash scripts/check.sh` exits 0 on a **fresh checkout**; a fixture composition renders to a real mp4 whose extracted frames prove motion; the film gate rejects a deliberately frozen video; nothing under visuals-flow changes.
- **Stop conditions** (terse — full list below): editing visuals-flow or card-library; weakening a gate assertion; accepting "file exists / mp4 > 0 bytes" as proof; a critique loop that runs more than one retry.
- **Test / verification for success**: a real Hyperframes render of a committed 3-second fixture composition, then ffmpeg frame extraction with assertions that consecutive frames DIFFER (motion) and are not uniformly black — the exact check that would have caught the 2026-07-24 card-stub batch.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 802e7078..HEAD -- pipelines/video/intro-studio pipelines/video/visuals-flow`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans 180 and 181
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `802e7078`, 2026-08-02

## Why this matters

This is the plan that produces the artifact the owner actually judges. Everything before it is preparation.

Two lessons from this repo's own history shape it. First, on 2026-07-19 the render-and-inspect gate passed three visually broken effects in a single day — a pink flash from a yuv-space blend, blank captions from a wrong field name, zero motion from a dead zoompan expression — because inspection trusted "render succeeded". Second, on 2026-07-24 a crew shipped all twelve enacted cards as 76-line title-only stubs and every gate passed, because existence checks are content-blind. The recorded conclusion was explicit: extract frames from the rendered output and LOOK, and never accept "file exists / mp4 > 0 bytes" as proof of device code.

So this plan's gate is deliberately pixel-level. It renders, pulls frames, and asserts things that are false when the composition is a stub or frozen: consecutive frames must differ, the picture must not be uniformly black, and the duration must match the intro to within a frame.

The critique loop is capped at one retry by owner decision. That is a cost choice, not an oversight — the owner reviews the result regardless, and a loop that grinds is worse than one that hands over an honest near-miss.

## Current state

After plans 180 and 181, `pipelines/video/intro-studio/` has:

- `lib/workdir.mjs` — `resolveWorkdir(slug)`, `rootDir()`
- `lib/intake.mjs` — `runIntake`, `probeDuration(file)`; `intake.json`'s `duration` is the intro's authoritative length
- `lib/transcript.mjs` — `validateTranscript`, `transcriptText`
- `lib/avatar.mjs` — `checkAvatarClip(slug)`; the avatar is ONE clip covering the whole intro, at `videos/<slug>/avatar.mp4`
- `lib/screenplay-schema.mjs` — `INTENTS`, `REGISTERS`, `FACE_MODES`, `TRANSITIONS`, `DEFAULT_ARC`, `followsDefaultArc`, `normaliseClause`
- `lib/lint-screenplay.mjs` — `lintScreenplay(...)` and a CLI
- `lib/check-prompt.mjs` — structural gate over the authoring prompt
- `run.sh` with `status`, `intake`, `avatar-check`, `screenplay`, `lint`; `author`, `render`, `critique`, `deliver` still print `not built yet`
- `scripts/check.sh` with an explicit test-file list

**Hyperframes facts this plan depends on.** These are the constraints that silently produce black or frozen frames, taken from the `hyperframes-core` skill (`references/variables-and-media.md`, `composition-patterns.md`, `data-attributes.md`). Inline them into the authoring guide verbatim — an executor or an authoring session that guesses here produces a composition that renders blank and passes a naive gate:

- **`<video>` and `<audio>` MUST be direct children of the host composition root (`index.html`).** Never inside a sub-composition `<template>` or a wrapper `<div>` — the runtime only registers and drives media at root level, and a nested `<video>` renders blank/black.
- **Clips must also be direct children of the composition root.** A clip nested inside a wrapper `<div>` is not registered.
- **`class="clip"` is required on visible timed elements** (`<div>`, `<img>`, …). Without it the runtime keeps the element visible for the whole composition.
- **Audio always lives on a separate `<audio>` element**, even when the source file is the same. The `<video>` is `muted`; the `<audio>` carries sound.
- **Every `id` must be unique across the assembled page.** Duplicate `<video>`/`<img>` ids render incorrectly.
- `data-start`, `data-duration`, `data-track-index` drive timing; `data-media-start` is an offset INTO the source media (this is how the film shows a later part of the avatar clip without trimming the file).
- `<video>` may omit `data-duration` to use the media's intrinsic length.

Version pin, matching `pipelines/video/visuals-flow/lib/render.mjs`:

```js
const HYPERFRAMES = process.env.HYPERFRAMES_VERSION ? `hyperframes@${process.env.HYPERFRAMES_VERSION}` : 'hyperframes@0.7.62';
```

Stillness detection technique, proven in `pipelines/video/visuals-flow/lib/stillness.mjs` — **read that file for reference, do not import or edit it**:

> Method: ffmpeg's `freezedetect` over the span. `freeze_start` and `freeze_end` arrive on separate stderr lines; an unterminated freeze runs to the end.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Test gate | `cd pipelines/video/intro-studio && bash scripts/check.sh` | exit 0, `intro-studio check OK` |
| Render a composition | `npx -y hyperframes@0.7.62 render <dir> --output <file>` | exit 0, mp4 written |
| Frame extract | `ffmpeg -y -i <mp4> -vf fps=2 <dir>/f_%04d.png` | exit 0, PNGs written |
| Frame mean luma | `ffprobe -v error -f lavfi -i "movie=<mp4>,signalstats" -show_entries frame_tags=lavfi.signalstats.YAVG -of csv=p=0` | one float per frame |
| Freeze detect | `ffmpeg -i <mp4> -vf freezedetect=n=0.003:d=2 -map 0:v -f null - 2>&1` | `freeze_start`/`freeze_end` lines |
| Fresh-checkout gate | see Step 9 | exit 0 |
| Scope check | `git diff --stat 802e7078..HEAD -- pipelines/video/visuals-flow pipelines/video/card-library` | EMPTY |

**If `npx hyperframes render` flags differ from `--output`**, run `npx -y hyperframes@0.7.62 render --help`, use the real flags, and record them in `steps/040-render-run/README.md`. Do not substitute another renderer.

## Scope

**In scope**:
- `pipelines/video/intro-studio/lib/render-film.mjs`, `lib/frames.mjs`, `lib/film-gate.mjs`, `lib/check-rubric.mjs` and their tests
- `pipelines/video/intro-studio/lib/fixtures/film-fixture/` — a committed 3-second composition used by the render test
- `pipelines/video/intro-studio/steps/030-author-film-llm/`, `steps/040-render-run/`, `steps/050-critique-llm/`, `steps/060-deliver-run/`
- `pipelines/video/intro-studio/run.sh`, `scripts/check.sh`, `scripts/test-run-sh.sh`
- `pipelines/CLAUDE.md` — ONE row registering intro-studio in the folder map
- `plans/README.md` — the 182 row

**Out of scope** (looks related, do NOT touch):
- `pipelines/video/visuals-flow/**` — including `lib/stillness.mjs` and `lib/render.mjs`, both of which this plan reads as reference only
- `pipelines/video/card-library/**`
- Any wiring of intro-studio's output INTO visuals-flow. The handoff is a file the owner moves by hand; automating it is a future plan and doing it here breaks the POC's central constraint.
- `lib/lint-screenplay.mjs`, `lib/screenplay-schema.mjs` — landed by 177, do not refactor

## Git workflow

- Branch: `advisor/182-intro-studio-compose-render-critique`
- Commit per step: `feat(intro-studio): <step summary>` — no AI footers. Do NOT push.

## Steps

### Step 1: `steps/030-author-film-llm/AUTHORING.md`

Write the guide a Claude session follows to turn `screenplay.json` into `film/index.html`. Required `##` headings (asserted in Step 8):

- `## Your job` — read the approved `screenplay.json` and write ONE Hyperframes composition at `videos/<slug>/film/index.html` covering the whole intro. One file, one continuous timeline. You are not assembling templates; there is no card catalog here and nothing to pick from.
- `## The canvas` — 1920x1080, 30fps, duration exactly `intake.json`'s `duration`.
- `## Hard Hyperframes rules` — transcribe the seven bullets from this plan's "Current state" section verbatim. Lead with the `<video>`-must-be-a-direct-child-of-root rule and state its symptom: the video renders blank/black while everything appears to succeed.
- `## The materials` — `../vo.mp3` (the voice, on a root `<audio>`), `../screen.mp4` (the recording, available as a framed element when a beat wants it, not as a default backdrop), `../avatar.mp4` (ONE clip covering the whole intro, muted, positioned by the beat's `face` value: `full` = full-frame, `panel` = docked, `none` = hidden). Because the avatar clip runs the full length, `data-media-start` is never needed to keep lip-sync — show it at its natural time offset.
- `## Beat by beat` — for each screenplay beat, honour `t_start`/`t_end` exactly, put the beat's `stage` on screen, respect its `register` as the colour world, and **implement `carries` literally**: the named object from the named earlier beat must be the SAME element, transformed — not a new element that resembles it. State that recreating the object instead of transforming it is the defect this whole system exists to prevent.
- `## Brand` — read `brand.json` from the pipeline root for palette and type tokens.
- `## What good looks like` — something is moving at every second; the register visibly changes at the turn; the final beat resolves into a clean hand-off rather than fading out to nothing.

**Verify**: `grep -c '^## ' pipelines/video/intro-studio/steps/030-author-film-llm/AUTHORING.md` → `7`

### Step 2: `lib/render-film.mjs`

```js
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveWorkdir } from './workdir.mjs';
import { probeDuration } from './intake.mjs';

const HYPERFRAMES = process.env.HYPERFRAMES_VERSION ? `hyperframes@${process.env.HYPERFRAMES_VERSION}` : 'hyperframes@0.7.62';

export function renderArgs(filmDir, outFile) {
  return ['-y', HYPERFRAMES, 'render', filmDir, '--output', outFile];
}

export function renderFilm(slug) {
  const workdir = resolveWorkdir(slug);
  const filmDir = path.join(workdir, 'film');
  const index = path.join(filmDir, 'index.html');
  if (!fs.existsSync(index)) throw new Error(`missing ${index} — run the author step first`);
  const outDir = path.join(workdir, 'renders');
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, 'intro-film.mp4');
  const r = spawnSync('npx', renderArgs(filmDir, out), { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`hyperframes render failed (exit ${r.status})`);
  if (!fs.existsSync(out) || fs.statSync(out).size === 0) throw new Error('render produced no output');
  return { file: out, duration: probeDuration(out) };
}
```

Write `lib/render-film.test.mjs` asserting `renderArgs` puts the dir and output in the right slots and honours `HYPERFRAMES_VERSION`. No network in this file.

**Verify**: `cd pipelines/video/intro-studio && node --test lib/render-film.test.mjs` → exit 0

### Step 3: `lib/frames.mjs` — extract frames and measure them

This is the module that makes the gate see pixels. Write:

```js
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Pull one frame every `fps` seconds of output into dir, as PNGs.
export function extractFrames(video, dir, fps = 2) {
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) if (f.startsWith('f_')) fs.rmSync(path.join(dir, f));
  const r = spawnSync('ffmpeg', ['-y', '-i', video, '-vf', `fps=${fps}`, path.join(dir, 'f_%04d.png')], { stdio: 'pipe' });
  if (r.status !== 0) throw new Error(`frame extract failed: ${r.stderr}`);
  return fs.readdirSync(dir).filter((f) => f.startsWith('f_')).sort();
}

// Per-frame average luma. A composition that renders black gives ~0 for every
// frame — the exact signature of the "<video> nested in a wrapper" bug.
export function frameLuma(video) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-f', 'lavfi', '-i', `movie=${video},signalstats`,
    '-show_entries', 'frame_tags=lavfi.signalstats.YAVG', '-of', 'csv=p=0'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`signalstats failed: ${r.stderr}`);
  return String(r.stdout).trim().split('\n').map(Number).filter(Number.isFinite);
}

// Parse ffmpeg freezedetect stderr into [start,end] pairs. freeze_start and
// freeze_end arrive on separate lines; an unterminated freeze runs to `until`.
export function parseFreezeLog(stderr, until) {
  const out = [];
  let open = null;
  for (const line of String(stderr).split('\n')) {
    const s = line.match(/freeze_start:\s*([0-9.]+)/);
    const e = line.match(/freeze_end:\s*([0-9.]+)/);
    if (s) open = parseFloat(s[1]);
    else if (e && open !== null) { out.push([open, parseFloat(e[1])]); open = null; }
  }
  if (open !== null) out.push([open, until]);
  return out;
}

export function detectFreezes(video, duration, { noise = 0.003, minDur = 2 } = {}) {
  const r = spawnSync('ffmpeg', ['-i', video, '-vf', `freezedetect=n=${noise}:d=${minDur}`, '-map', '0:v', '-f', 'null', '-'],
    { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] });
  return parseFreezeLog(r.stderr, duration);
}

export function longestFreeze(freezes) {
  return freezes.reduce((m, [s, e]) => Math.max(m, e - s), 0);
}
```

Write `lib/frames.test.mjs` for the PURE functions only: `parseFreezeLog` (paired lines, an unterminated freeze running to `until`, no freezes → `[]`, multiple freezes) and `longestFreeze` (empty → 0, picks the max). No ffmpeg in this file.

**Verify**: `cd pipelines/video/intro-studio && node --test lib/frames.test.mjs` → exit 0

### Step 4: `lib/film-gate.mjs` — the machine-checkable half of the critique

```js
import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from './workdir.mjs';
import { probeDuration } from './intake.mjs';
import { frameLuma, detectFreezes, longestFreeze } from './frames.mjs';

export const GATE = {
  DURATION_TOLERANCE: 0.05,   // seconds — the render must match the intro to ~a frame
  MAX_FREEZE: 3.0,            // seconds — no stretch this long may sit motionless
  MIN_MEAN_LUMA: 4,           // below this the picture is effectively black
  MIN_LUMA_RANGE: 6,          // the whole film at one luma means nothing is happening
};

// Pure so it is unit-testable without ffmpeg. Callers gather the measurements.
export function judge({ renderDuration, introDuration, luma, freezes }) {
  const failures = [];
  if (Math.abs(renderDuration - introDuration) > GATE.DURATION_TOLERANCE) {
    failures.push(`G1 duration ${renderDuration.toFixed(2)}s != intro ${introDuration.toFixed(2)}s`);
  }
  const worst = longestFreeze(freezes);
  if (worst > GATE.MAX_FREEZE) failures.push(`G2 ${worst.toFixed(1)}s of frozen picture (max ${GATE.MAX_FREEZE}s)`);
  if (!luma.length) failures.push('G3 no frames measured');
  else {
    const mean = luma.reduce((a, b) => a + b, 0) / luma.length;
    if (mean < GATE.MIN_MEAN_LUMA) failures.push(`G3 mean luma ${mean.toFixed(1)} — the render is black`);
    const range = Math.max(...luma) - Math.min(...luma);
    if (range < GATE.MIN_LUMA_RANGE) failures.push(`G4 luma range ${range.toFixed(1)} — nothing changes across the film`);
  }
  return { pass: failures.length === 0, failures };
}

export function runGate(slug) {
  const workdir = resolveWorkdir(slug);
  const video = path.join(workdir, 'renders', 'intro-film.mp4');
  if (!fs.existsSync(video)) throw new Error(`missing ${video} — run the render step first`);
  const introDuration = JSON.parse(fs.readFileSync(path.join(workdir, 'intake.json'), 'utf8')).duration;
  const renderDuration = probeDuration(video);
  return judge({ renderDuration, introDuration, luma: frameLuma(video), freezes: detectFreezes(video, renderDuration) });
}
```

Write `lib/film-gate.test.mjs` against `judge` with one case per code, each asserting the code fires on its bad input AND is absent from a clean input:

- clean: `{ renderDuration: 8.4, introDuration: 8.4, luma: [10,40,90,30], freezes: [] }` → `pass: true`, `failures: []`
- `G1`: `renderDuration: 9.0` against `introDuration: 8.4`
- `G2`: `freezes: [[1, 6]]` (a 5s freeze)
- `G3` black: `luma: [0,1,0,1]`
- `G3` empty: `luma: []`
- `G4`: `luma: [50,51,50,52]`

**Verify**: `cd pipelines/video/intro-studio && node --test lib/film-gate.test.mjs` → exit 0, 6 passing

### Step 5: The render round-trip — the test that catches stubs

Commit a minimal composition at `lib/fixtures/film-fixture/index.html`: 1920x1080, 3 seconds, no external media (so the test needs no fixture mp4), containing at least one element that visibly MOVES across the full 3 seconds and a background that changes luma — for example a light bar animating across a dark field. Follow the hard Hyperframes rules: `class="clip"` on the timed elements, clips as direct children of the root, unique ids.

Write `lib/render.roundtrip.test.mjs` that:

1. Renders the fixture with `npx -y hyperframes@0.7.62 render lib/fixtures/film-fixture --output .test-tmp/film/out.mp4`.
2. Asserts the mp4 exists and `probeDuration` is within 0.15s of 3.0.
3. Runs `extractFrames` at `fps=2` and asserts at least 5 PNGs.
4. **Asserts consecutive frames DIFFER** — compare PNG byte lengths and content hashes across the extracted frames and require at least 3 distinct hashes. Identical frames throughout is the signature of a stub or a frozen composition, which is exactly what shipped green on 2026-07-24.
5. Asserts `frameLuma` gives a range above `GATE.MIN_LUMA_RANGE` and a mean above `GATE.MIN_MEAN_LUMA`.
6. **Negative control**: generate a deliberately frozen 5-second video with `ffmpeg -y -f lavfi -i color=c=gray:s=320x180:d=5 -r 30 .test-tmp/film/frozen.mp4`, run `detectFreezes` + `judge` on it, and assert the gate FAILS with `G2` and `G4`. A gate that has never been observed to fail is not a gate.
7. Cleans `.test-tmp/film` in `test.after` — guaranteed teardown, never at the end of the test body.

Skip with a clear `t.skip()` message when `ffmpeg` is absent or the network is unavailable for `npx`. **Never turn the skip into a silent pass.**

Timeouts: give this file a generous per-test timeout (npx + a real render is slow). Do not lower the assertions to make it fast.

**Verify**: `cd pipelines/video/intro-studio && node --test lib/render.roundtrip.test.mjs` → exit 0, and the negative control reports `G2` and `G4`

### Step 6: `steps/050-critique-llm/INTRO-BAR.md` — the taste rubric

Transcribe this rubric into the file. Each line is a checkbox the critiquing session scores against the contact sheet, answering PASS or FAIL with a one-line reason. Required `##` headings: `## How to use this`, `## The bar`, `## Verdict`.

`## How to use this` — the session reads `qc/contact-sheet.jpg` (and the individual frames in `qc/frames/` when it needs a closer look) alongside `screenplay.json`. Score every line. Any FAIL means the film fails.

`## The bar`:

- [ ] **Continuity** — for every beat whose screenplay entry has a non-null `carries`, the named object is visibly the same thing transformed, not a new element that resembles it. This is the single most important line.
- [ ] **Register** — the colour world visibly changes where the screenplay says it turns. A viewer should notice the shift without being told.
- [ ] **Motion** — something is moving in every second of the film. No dead stretch.
- [ ] **The face lands early** — the presenter is on screen within the first two beats, and reads as a person rather than a floating cut-out.
- [ ] **Typography** — no clipped, overflowing or overlapping text at any frame; no text too small to read at 1080p.
- [ ] **The hand-off** — the final beat resolves into a clean, deliberate exit rather than fading to nothing.
- [ ] **Not a slideshow** — moving through the contact sheet, the film reads as one continuous piece rather than a series of unrelated full-screen graphics. If you can point at the seams between beats, it fails.

`## Verdict` — emit `PASS` or `FAIL` plus at most three concrete issues, each naming the beat id and what to change. On FAIL, the authoring step gets ONE retry with those issues; the second render goes to the owner regardless of its verdict.

Write `lib/check-rubric.mjs` on the pattern of 181's `check-prompt.mjs`: assert the three `##` headings and all seven bar lines are present, exit 1 listing what is missing, else print `rubric OK`.

**Verify**: `cd pipelines/video/intro-studio && node lib/check-rubric.mjs` → exit 0, `rubric OK`

### Step 7: `lib/contact-sheet.mjs` and the remaining step READMEs

`lib/contact-sheet.mjs` exports `buildContactSheet(slug, { fps = 2, columns = 6 })`: extract frames into `videos/<slug>/qc/frames/`, then tile them into `videos/<slug>/qc/contact-sheet.jpg` with

```
ffmpeg -y -i qc/frames/f_%04d.png -vf "scale=480:-1,tile=<columns>x<rows>" -frames:v 1 qc/contact-sheet.jpg
```

computing `rows = Math.ceil(frameCount / columns)`. Export the argv builder as a pure function `contactSheetArgs(pattern, out, columns, rows)` and unit-test it in `lib/contact-sheet.test.mjs`.

Write the step READMEs:

- `steps/040-render-run/README.md` — the render command, where output lands, the real `hyperframes render` flags as confirmed in Step 2.
- `steps/050-critique-llm/README.md` — build the contact sheet, run `node lib/film-gate.mjs <slug>` for the machine checks, then score `INTRO-BAR.md` against the sheet. **State the loop cap explicitly: one retry on failure, then it goes to the owner regardless.**
- `steps/060-deliver-run/README.md` — copy the passing render to `out/intro.mp4` and print the absolute path. This is the handoff: the owner drops that file into their edit by hand. No code writes into visuals-flow.

**Verify**: `cd pipelines/video/intro-studio && node --test lib/contact-sheet.test.mjs && ls steps/ | wc -l` → exit 0 and `8`

### Step 8: Wire `run.sh`, `check.sh`, and register the pipeline

Replace the remaining `not built yet` stubs in `run.sh`:

- `author` — print `steps/030-author-film-llm/AUTHORING.md` with `{{SLUG}}` substituted, and **exit 1 with a clear message when `screenplay.json` is absent or its top-level `approved` is not `true`** (181's owner gate).
- `render` — `renderFilm(slug)`, print the output path and duration.
- `critique` — `buildContactSheet(slug)`, then `runGate(slug)`; print each failure, exit 1 when the gate fails. Print the path to the contact sheet so the session can read it.
- `deliver` — refuse unless `renders/intro-film.mp4` exists and `runGate` passes; then copy to `out/intro.mp4` and print the absolute path.

Add to `scripts/check.sh`'s explicit test list: `lib/render-film.test.mjs lib/frames.test.mjs lib/film-gate.test.mjs lib/contact-sheet.test.mjs lib/render.roundtrip.test.mjs`. Add `node lib/check-rubric.mjs` after `node lib/check-prompt.mjs`.

Extend `scripts/test-run-sh.sh`: `run.sh <slug> author` exits 1 when the screenplay is unapproved; `run.sh <slug> deliver` exits 1 when there is no render.

Add ONE row to `pipelines/CLAUDE.md`'s folder map, immediately after the `video/visuals-flow/` row, matching the existing format:

```
| &nbsp;&nbsp;&nbsp;&nbsp;[`video/intro-studio/`](video/intro-studio/CLAUDE.md) | Intro POC — builds a video's intro as ONE bespoke authored composition (screenplay → single Hyperframes film → mp4) instead of a card sequence. Standalone: hands off an mp4, touches nothing in visuals-flow | Node + Claude steps |
```

**Verify**: `cd pipelines/video/intro-studio && bash scripts/check.sh` → exit 0; `grep -c "video/intro-studio/" pipelines/CLAUDE.md` → `1`

### Step 9: Fresh-checkout gate — the batch's last act

Crews verify inside worktrees carrying their own build artifacts, so build-order and gitignored-artifact dependencies only surface on a pristine tree (LESSONS 2026-07-31, where `check.sh` passed only because crews had built by hand). This is the last plan of the batch, so it runs the gate clean:

```bash
cd "$(mktemp -d)" && git clone --depth 1 --branch advisor/182-intro-studio-compose-render-critique \
  /Users/kbtg/codebase/personal-stuff fresh && cd fresh/pipelines/video/intro-studio && bash scripts/check.sh
```

Record the result in the commit message for this step. If it fails while the working-tree run passes, the difference IS the bug — fix it rather than reporting the working-tree result.

**Verify**: the fresh-clone command above → exit 0, `intro-studio check OK`

### Step 10: Register the plan row

Add the 182 row to `plans/README.md`, status `DONE`.

**Verify**: `grep -c "182-intro-studio-compose-render-critique" plans/README.md` → `1`

## Test plan

- Pure-function units: `render-film.test.mjs` (argv), `frames.test.mjs` (freeze-log parsing), `film-gate.test.mjs` (six judge cases), `contact-sheet.test.mjs` (argv).
- `render.roundtrip.test.mjs` — a REAL render of the committed fixture, frame extraction, distinct-frame-hash assertion, luma range assertion, and a negative control proving the gate fails on a frozen video.
- Structural gates: `check-prompt.mjs` (from 177) and `check-rubric.mjs`.
- Driver smoke: `scripts/test-run-sh.sh`.
- Fresh-checkout run of the full gate.
- Every test creating dirs or processes tears down in `test.after`.

## Done criteria

- [ ] `cd pipelines/video/intro-studio && bash scripts/check.sh` exits 0 and prints `intro-studio check OK`
- [ ] The same command exits 0 **from a fresh clone** (Step 9)
- [ ] `node --test lib/render.roundtrip.test.mjs` renders a real mp4, finds ≥3 distinct frame hashes, and its negative control reports `G2` and `G4`
- [ ] `node --test lib/film-gate.test.mjs` reports 6 passing
- [ ] `node lib/check-rubric.mjs` exits 0
- [ ] `bash run.sh demo author` exits 1 when `screenplay.json` is missing or unapproved
- [ ] `bash run.sh demo deliver` exits 1 when there is no render
- [ ] `git diff --stat 802e7078..HEAD -- pipelines/video/visuals-flow pipelines/video/card-library` prints NOTHING
- [ ] `pipelines/CLAUDE.md` carries exactly one `video/intro-studio/` row
- [ ] `plans/README.md` carries the 182 row

## STOP conditions

- **Any change to a file under `pipelines/video/visuals-flow/` or `pipelines/video/card-library/`** — `lib/stillness.mjs` and `lib/render.mjs` are read as reference only.
- **Any code that writes into visuals-flow's tree**, including "helpfully" copying `out/intro.mp4` into a `videos/<slug>/` there. The handoff is manual by design.
- **A gate assertion fails and the tempting fix is to weaken, swap or delete it** — including lowering `MAX_FREEZE`, raising `DURATION_TOLERANCE`, or dropping the distinct-frame-hash check to get the round trip green. Fix the code or the fixture. Softening an assertion is a STOP.
- **Accepting "the file exists" or "the mp4 is larger than 0 bytes" as proof the render is correct.** That exact reasoning shipped twelve stub cards through green gates on 2026-07-24.
- The critique loop is specified at ONE retry. Implementing an unbounded or multi-round loop is a STOP — it is an owner cost decision, not a tuning parameter.
- `npx hyperframes render` cannot render the fixture at all — report the real error and `--help` output rather than swapping in another renderer or stubbing the round trip.

## Maintenance notes

- `GATE`'s four thresholds are first guesses calibrated on nothing but reasoning. Expect to move them once real intros exist — but move them from measured output the owner has judged, never to make a red test green.
- The distinct-frame-hash assertion in the round trip is the highest-value test in this pipeline. It is the one check that would have caught both recorded failure classes (blank renders, stub compositions). Do not weaken it for speed.
- The rubric's "Not a slideshow" line is the closing of the loop back to why this pipeline exists. If real intros start passing every other line and failing that one, the screenplay pass (plan 181) is where the fix belongs, not here.
- When the owner is satisfied with the POC, wiring the film into visuals-flow is a small separate plan: emit one cue with `kind: "film"` spanning the intro, since assemble already treats a fullframe graphic segment as the base layer. Nothing in this batch anticipates that work.
