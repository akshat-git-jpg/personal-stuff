---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui:
deploy:
needs: []
---

# Plan 082: visuals-flow step 090 — assemble the final video

## Summary

- **Problem statement**: The pipeline produces every ingredient of a finished
  video (VO-aligned screen recording, rendered graphics with exact timecodes,
  full-screen avatar clips with exact spans) but stops at an editor handoff
  bundle. Placement is fully deterministic, so the final video can be built by
  script — today a human editor redoes mechanical work the manifests already
  specify.
- **Goals**:
  - New `lib/assemble.mjs` + `steps/090-assemble-run/` — deterministic ffmpeg
    assembly: screen base track, avatar spans and fullframe graphics swapped in
    at their exact times, transparent overlays composited, `vo.mp3` as the only
    audio. Hard cuts everywhere. Output `final.mp4` (kb-scratch) +
    committed `assembly.md` (the EDL).
  - The existing editor handoff bundle is unchanged — `final.mp4` is an
    additional output (owner decision 2026-07-18: per video, ship it directly
    or let the editor rebuild from the bundle).
  - Unit + fixture-based integration tests wired into `scripts/check.sh`;
    docs + skill verb updated.
- **Executor proposed**: agy (Gemini 3.1 Pro High, agy default) — fully-inlined
  standard build.
- **Done criteria** (terse): `bash scripts/check.sh` green including new
  `lib/assemble.test.mjs`; fixture assembly produces a 1920x1080 mp4 of the
  expected duration with an audio stream; docs/skill/gitignore edits present.
- **Stop conditions** (terse): never run against real `videos/test-01/` media;
  no HeyGen calls; red baseline before changes = stop.
- **Test / verification for success**: `node --test` unit tests on the pure
  segment planner + an ffmpeg integration test on tiny lavfi-generated fixtures
  inside `lib/.test-tmp/` (all writes stay inside the repo).
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 48de7af..HEAD -- pipelines/video/visuals-flow pipelines/.claude/skills/visuals-flow`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (ffmpeg concat/overlay subtleties — mitigated by the fixture test)
- **Depends on**: 080 (landed 2026-07-18)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `48de7af`, 2026-07-18

## Why this matters

visuals-flow already computes, to the tenth of a second, where every graphic
and avatar span belongs; the manifests exist only so a human can place files on
a timeline by hand. Assembling by script closes the loop: one command turns the
approved artifacts into an uploadable video, while the editor bundle stays
available for videos the owner wants humanly polished. Owner decisions
(2026-07-18, this session): screen recording is already VO-aligned (recorded
live by the tutorial maker), audio is `vo.mp3` throughout (screen and avatar
clips muted — avatar clips were lipsynced to VO slices anyway), hard cuts only,
and the output serves both as a shippable video and an editor draft.

## Current state

All paths below are relative to `pipelines/video/visuals-flow/` unless rooted.

- `lib/render.mjs` — **exemplar for CLI shape and conventions**: `parseArgs` /
  `resolveWorkdir(slug-or-path)` / approval gate / staleness recompute
  (lines 120–132) / `planRender(cue)` naming (`<mmss-digits>-<id>-<card>.mp4|mov`,
  `overlay` ⇒ `.mov`, else `.mp4`) / ffprobe duration check / exports `mmss()`.
- `lib/avatar-render.mjs` — `MEDIA_ROOT` env-override pattern
  (`AVATAR_MEDIA_ROOT` ?? `~/kb-scratch/video/heygen/visuals-flow`); download
  verb writes each job's absolute clip path into `avatar-jobs.json` as
  `job.file` (`<MEDIA_ROOT>/<video>/<jobId>.mp4`).
- `videos/<slug>/resolved.json` — `{ video, offset, resolved: [...] }`; each
  resolved cue has `id`, `card`, `placement` (`fullframe`|`overlay`), `start`,
  `duration` (absolute seconds, VO timeline).
- `videos/<slug>/avatar-jobs.json` — `{ video, template, engineMode, jobs: [...] }`;
  each job: `id`, `kind` (`avatar-full` | `corner`), `start`, `end`, `duration`,
  `video_id`, and (once downloaded) `file` (absolute path).
- `videos/<slug>/shots.json` — has `approved` flag (board gate).
- Renders live in `videos/<slug>/renders/` named per `planRender`. Fullframe
  clips are opaque mp4; overlays are transparent mov.
- `lib/lint-shots.mjs` guarantees avatar spans never collide with fullframe
  cards (E2), so base-track replacements can only overlap if data is corrupt —
  the planner treats overlap as a hard error.
- `scripts/check.sh` — `node --test` over an explicit file list, then
  `check-rulebook.mjs`. Add the new test file to the list (never a directory
  arg — LESSONS 2026-07-09: `node --test <dir>` fails on node 22).
- `.gitignore` (pipeline-local) — media patterns per line; `lib/.test-tmp/` is
  already ignored (tests may write there).
- Existing tests to imitate: `lib/render.test.mjs` (pure-function tests),
  `lib/avatar-render.test.mjs` (offline, no live calls).
- Step folders each have `README.md` + thin `run.sh`; match
  `steps/080-avatar-render-run/run.sh`'s shape.
- Skill source: `pipelines/.claude/skills/visuals-flow/SKILL.md` (the copy at
  `.claude/skills/visuals-flow` is a symlink — edit the source only).
- `PIPELINE.md` — flow table + `videos/<slug>/` layout block (edits inlined in
  Step 6).
- The corner avatar track is owner-deferred (spans-only pilot); assembly
  handles `avatar-full` jobs only and ignores `corner` jobs.
- Top-level `offset` in cues.json shifts *editor-timeline* timecodes in
  manifests. Assembly always builds the pure VO timeline (00:00 = VO start) and
  ignores `offset`; `assembly.md` states this.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Baseline + merge gate | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exit 0, `visuals-flow check OK` |
| Run one test file | `cd pipelines/video/visuals-flow && node --test lib/assemble.test.mjs` | exit 0 |
| ffmpeg present | `ffmpeg -version \| head -1` | `ffmpeg version 8.x` |
| Probe a file | `ffprobe -v error -show_entries format=duration -of csv=p=0 <file>` | seconds as float |

## Scope

**In scope** (the only files to touch):
- `pipelines/video/visuals-flow/lib/assemble.mjs` (new)
- `pipelines/video/visuals-flow/lib/assemble.test.mjs` (new)
- `pipelines/video/visuals-flow/steps/090-assemble-run/README.md` (new)
- `pipelines/video/visuals-flow/steps/090-assemble-run/run.sh` (new)
- `pipelines/video/visuals-flow/scripts/check.sh` (add one test file to the list)
- `pipelines/video/visuals-flow/.gitignore` (two new lines)
- `pipelines/video/visuals-flow/PIPELINE.md` (flow row + layout lines)
- `pipelines/.claude/skills/visuals-flow/SKILL.md` (new verb section)
- `plans/README.md` (status row on completion)

**Out of scope** (do not touch):
- `videos/test-01/` — real pilot data mid-flight; never assemble it, never edit it.
- `lib/render.mjs`, `lib/avatar-render.mjs`, `lib/board.mjs`, lint/resolve libs —
  read-only exemplars.
- `../card-library/` — read-only asset hub.
- `HANDOFF.md`, `INTEGRATION.md`, `EDITOR-STYLE-GUIDE.md` — session-owned docs,
  updated outside this plan.
- Anything HeyGen: no submits, no downloads, no `heygen-web` calls.

## Git workflow

- Branch: `advisor/082-assemble-final-video`
- Commits per step, conventional style, e.g.
  `feat(visuals-flow): lib/assemble.mjs — deterministic final-video assembly` —
  no AI footers. Do NOT push.

## Steps

### Step 1: `lib/assemble.mjs` — pure planning core

Create `lib/assemble.mjs`. Module constants and the two pure exported functions
first (they get unit-tested directly):

```js
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { mmss, planRender } from './render.mjs';

const EPS = 0.05;
export const CANVAS = { w: 1920, h: 1080, fps: 30 };
export const ASSEMBLE_MEDIA_ROOT = process.env.ASSEMBLE_MEDIA_ROOT
  ?? path.join(os.homedir(), 'kb-scratch', 'video', 'visuals-flow');

// Base-track plan: screen segments + replacements (avatar-full spans,
// fullframe graphics), contiguous from 0 to total. Throws on overlap —
// lint-shots E2 guarantees clean data, so overlap means corrupt inputs.
export function planSegments({ resolved, avatarJobs, total }) {
  const repl = [];
  for (const c of resolved.filter((c) => c.placement === 'fullframe')) {
    repl.push({ kind: 'graphic', id: c.id, start: c.start,
      end: Math.min(+(c.start + c.duration).toFixed(3), total) });
  }
  for (const j of avatarJobs.filter((j) => j.kind === 'avatar-full')) {
    repl.push({ kind: 'avatar', id: j.id, start: j.start,
      end: Math.min(j.end, total) });
  }
  repl.sort((a, b) => a.start - b.start);
  for (let i = 1; i < repl.length; i++) {
    if (repl[i].start < repl[i - 1].end - EPS) {
      throw new Error(`overlapping base segments: ${repl[i - 1].id} ends ${repl[i - 1].end}, ${repl[i].id} starts ${repl[i].start}`);
    }
  }
  const segments = [];
  let t = 0;
  let n = 0;
  for (const r of repl) {
    const start = Math.max(r.start, t); // clamp sub-EPS underlap
    if (start > t + EPS) {
      n++;
      segments.push({ kind: 'screen', id: `screen-${String(n).padStart(2, '0')}`, start: t, end: start });
    }
    segments.push({ ...r, start });
    t = Math.max(t, r.end);
  }
  if (total > t + EPS) {
    n++;
    segments.push({ kind: 'screen', id: `screen-${String(n).padStart(2, '0')}`, start: t, end: total });
  }
  return segments;
}

// Committed EDL — doubles as editor documentation.
export function assemblyMd(video, segments, overlays, total, outPath) {
  const seg = segments.map((s) =>
    `| ${mmss(s.start)} | ${mmss(s.end)} | ${s.kind} | ${s.id} |`);
  const ov = overlays.map((o) =>
    `| ${mmss(o.start)} | ${mmss(o.end)} | ${path.basename(o.file)} |`);
  return [
    `# ${video} — assembly`,
    '',
    `Master timeline = voiceover (${total.toFixed(1)}s starts at 00:00.0; any editor-timeline offset is NOT applied here). Audio: vo.mp3 throughout — screen and avatar audio muted. Hard cuts, no transitions.`,
    '',
    `Output: ${outPath}`,
    '',
    '## Base track',
    '',
    '| from | to | source | id |',
    '|---|---|---|---|',
    ...seg,
    '',
    '## Overlays (composited on top)',
    '',
    '| at | until | file |',
    '|---|---|---|',
    ...ov,
    '',
  ].join('\n');
}
```

**Verify**: `cd pipelines/video/visuals-flow && node -e "import('./lib/assemble.mjs').then(m => console.log(typeof m.planSegments, typeof m.assemblyMd))"` → `function function`

### Step 2: `lib/assemble.mjs` — CLI, gates, ffmpeg passes

Append the CLI to the same file. Copy `parseArgs`/`resolveWorkdir`/`main`
structure from `lib/render.mjs` (same guard
`import.meta.url === \`file://${process.argv[1]}\``).

Usage line (printed on missing workdir, exit 1):
`usage: node lib/assemble.mjs <slug-or-path> [--screen <path>] [--screen-offset <sec>] [--out <path>] [--keep-temp] [--force]`

Flags: `--screen` (default `<workdir>/screen.mp4`), `--screen-offset` (float
seconds added to screen-source trim points, default 0 — for a recording that
starts before the VO), `--out` (default
`<ASSEMBLE_MEDIA_ROOT>/<video>/final.mp4`), `--keep-temp`, `--force`.

`main()` order — every gate prints the exact message and exits 1 (all
bypassable by `--force` EXCEPT missing files, which never are):

1. Read `cues.json`; require `approved === true` (message mirrors render.mjs).
2. Staleness gate: recompute with `resolveCues` exactly as `render.mjs`
   lines 120–132 (same imports, same message).
3. If `shots.json` exists: require `approved === true` AND `avatar-jobs.json`
   exists; collect `avatarJobs` = jobs with `kind === 'avatar-full'`. Every one
   must have `job.file` set and existing on disk — else exit 1 listing missing
   ids with `run "download the avatar videos" first`. If `shots.json` does not
   exist, `avatarJobs = []` (graphics-only assembly is valid).
4. Require `vo.mp3` and the screen file to exist (never force-bypassable).
5. For every resolved cue, require `renders/<planRender(cue).outFile>` to
   exist — else exit 1 listing missing ids with `run node lib/render.mjs first`.
6. `total` = ffprobe duration of `vo.mp3` (reuse render.mjs's ffprobe
   invocation shape). If the screen source's duration + screen-offset is more
   than 2s short of the last screen segment's end, print a `warning:` (tpad
   covers the gap) — not an error.
7. `segments = planSegments(...)`; `overlays` = resolved cues with
   `placement === 'overlay'` mapped to
   `{ id, start, end: start + duration, file: renders/<outFile> }`.
8. Encode each segment to `<workdir>/assembly-tmp/seg-<NNN>-<id>.ts`
   (NNN = 3-digit index). Shared video filter
   `VF = scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p`:
   - screen: `ffmpeg -y -ss <start+screenOffset> -to <end+screenOffset> -i <screen> -vf "<VF>,tpad=stop_mode=clone:stop_duration=30" -t <end-start> -an -c:v libx264 -preset veryfast -crf 18 -f mpegts <seg>`
   - avatar / graphic (clip plays from its own 0):
     `ffmpeg -y -i <clipFile> -vf "<VF>,tpad=stop_mode=clone:stop_duration=30" -t <end-start> -an -c:v libx264 -preset veryfast -crf 18 -f mpegts <seg>`
   (tpad clone absorbs clips slightly shorter than the span; `-t` truncates
   longer ones — HeyGen clip durations drift by fractions of a second.)
   Use `spawnSync('ffmpeg', [...], { encoding: 'utf8' })` array form; on
   nonzero status print stderr and exit 1.
9. Write `assembly-tmp/concat.txt` (`file 'seg-....ts'` per line, segment
   order) and concat: `ffmpeg -y -f concat -safe 0 -i concat.txt -c copy base.mp4`
   (cwd = assembly-tmp).
10. Final pass — inputs: `base.mp4`, then per overlay (sorted by start)
    `-itsoffset <start> -i <overlayFile>`, then `vo.mp3`. With K overlays,
    filter_complex chains
    `[0:v][1:v]overlay=eof_action=pass:enable='between(t,<s1>,<e1>)'[v1];[v1][2:v]overlay=eof_action=pass:enable='between(t,<s2>,<e2>)'[v2];…`,
    map `[vK]` + `<K+1>:a`. With zero overlays, no filter_complex; map `0:v` +
    `1:a`. Always: `-c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -t <total> -movflags +faststart <out>`
    (mkdir -p the out dir first).
11. Post-check with ffprobe: `<out>` duration within 0.5s of `total`, video
    stream `1920x1080`, an audio stream present
    (`ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0` → `audio`).
    Any miss: print what mismatched, exit 1.
12. Write `<workdir>/assembly.md` via `assemblyMd`, rm -rf `assembly-tmp`
    unless `--keep-temp`, print `assembled: <out> (<mmss(total)>)`, exit 0.

**Verify**: `cd pipelines/video/visuals-flow && node lib/assemble.mjs` → usage
line, exit 1. Then `node lib/assemble.mjs no-such-video` → a missing-file gate
message, exit 1.

### Step 3: `lib/assemble.test.mjs` — unit + fixture integration tests

Create the test file following `lib/render.test.mjs` conventions
(`node:test` + `node:assert/strict`). All temp output under `lib/.test-tmp/`
(already gitignored — never write outside the repo).

Unit tests (pure, no ffmpeg):
- `planSegments` with `total=100`, one fullframe cue `{start:10, duration:5}`,
  one avatar job `{start:40, end:60}` → 5 segments
  `screen[0,10] graphic[10,15] screen[15,40] avatar[40,60] screen[60,100]`;
  assert contiguity (each `start` === previous `end`) and exact bounds.
- Replacement at t=0 (avatar `{start:0, end:20}`) → no leading screen segment.
- Replacement ending at `total` → no trailing screen segment.
- Overlapping replacements (graphic `[10,20]`, avatar `[15,30]`) → throws
  `/overlapping base segments/`.
- Sub-EPS underlap (avatar starts 0.03s before previous end) → clamped, no throw.
- `avatarJobs: []` → screen + graphics only. `corner` jobs ignored.
- `assemblyMd` output contains the header, the total, one base row per
  segment, one overlay row per overlay.

Integration test (ffmpeg; skip cleanly with a logged message if
`spawnSync('ffmpeg', ['-version'])` fails — matches the offline-safe spirit of
`avatar-render.test.mjs`):
- Build a fake workdir in `lib/.test-tmp/assemble-it/`:
  - `vo.mp3`: `ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=mono -t 8 -q:a 9 vo.mp3`
  - `screen.mp4`: `ffmpeg -y -f lavfi -i color=c=blue:s=1920x1080:r=30 -t 8 -pix_fmt yuv420p screen.mp4`
  - avatar clip `s01.mp4` (red, 2s, same recipe) in `.test-tmp/assemble-it/media/`
  - fullframe render (green, 2s) + overlay mov with alpha:
    `ffmpeg -y -f lavfi -i color=c=black@0.0:s=1920x1080:r=30,format=yuva420p -t 1 -c:v qtrle ov.mov`
  - `cues.json` `{video:'it', approved:true, offset:0, cues:[]}` won't resolve
    against a transcript — so for the integration test call the internal
    pipeline directly instead: export a
    `runAssembly({ workdir, resolved, avatarJobs, total, screen, out, keepTemp })`
    function from `assemble.mjs` that implements steps 6–12 above (main()
    becomes gates → `runAssembly`). The test invokes `runAssembly` with
    hand-built `resolved` (fullframe green at `[2,4]`, overlay at `[5,6]`),
    `avatarJobs` (`s01` at `[6,8]`, `file` = the red clip), `total: 8`.
  - Name the render files per `planRender` so step 5's existence checks and
    the runAssembly file lookups agree.
- Assert: exit/return ok; `final.mp4` exists; ffprobe duration `8 ± 0.5`;
  resolution `1920x1080`; audio stream present; `assembly.md` written with 5
  base rows + 1 overlay row.

Add the file to `scripts/check.sh`'s `node --test` list (file list form, not a
directory).

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/assemble.test.mjs` → all pass.

### Step 4: step folder `steps/090-assemble-run/`

`run.sh` — same shape as `steps/080-avatar-render-run/run.sh` but delegating to
`node lib/assemble.mjs "$@"`. `README.md`:

```markdown
# 090-assemble-run [RUN]

Deterministic final-video assembly. Master timeline = the voiceover; the
VO-aligned screen recording is the base track; avatar-full clips and fullframe
graphics replace it at their exact spans; transparent overlays composite on
top; vo.mp3 is the only audio. Hard cuts, no transitions. The editor handoff
bundle (renders/ + manifest.md + avatar clips + avatar-manifest.md) is
unchanged — final.mp4 is an additional output.

In: videos/<slug>/{screen.mp4, vo.mp3, resolved.json, renders/, avatar-jobs.json (clips downloaded)}
Out: ~/kb-scratch/video/visuals-flow/<slug>/final.mp4 + videos/<slug>/assembly.md

    bash steps/090-assemble-run/run.sh <slug> [--screen <path>] [--screen-offset <sec>] [--out <path>] [--keep-temp] [--force]

Gates: cues approved + fresh, shots approved with every avatar-full job
downloaded (skipped when shots.json absent), all renders present. screen.mp4
is owner-provided and never committed.
```

**Verify**: `bash pipelines/video/visuals-flow/steps/090-assemble-run/run.sh` → usage line, exit 1.

### Step 5: `.gitignore` additions

Append to `pipelines/video/visuals-flow/.gitignore` under the per-video media
comment:

```
videos/*/screen.mp4
videos/*/assembly-tmp/
```

**Verify**: `cd pipelines/video/visuals-flow && /usr/bin/grep -c "screen.mp4\|assembly-tmp" .gitignore` → `2`

### Step 6: `PIPELINE.md` — flow row + layout

Add to the flow table after the `080-avatar-render-run` row:

```
| `090-assemble-run` | [RUN] | `screen.mp4` + `vo.mp3` + `renders/` + avatar clips (`avatar-jobs.json`) → `final.mp4` (kb-scratch) + `assembly.md` |
```

Add to the `videos/<slug>/` layout block after `avatar-manifest.md`:

```
  screen.mp4       # VO-aligned screen recording (owner-provided) — gitignored
  assembly.md      # step 090 output, the assembly EDL — committed
```

**Verify**: `/usr/bin/grep -c "090-assemble" pipelines/video/visuals-flow/PIPELINE.md` → `1`

### Step 7: skill verb (edit the SOURCE file only)

Append to `pipelines/.claude/skills/visuals-flow/SKILL.md` (the
`.claude/skills/visuals-flow` copy is a symlink — do not touch it), after the
"download the avatar videos" verb:

```markdown
## Verb: "assemble the video" / "build the final video"

1. Requires: cues approved + rendered (`renders/` complete), shots approved
   with ALL avatar clips downloaded (every `avatar-jobs.json` job has `file`),
   and the VO-aligned screen recording at `videos/<slug>/screen.mp4` (ask the
   owner for it if missing — it is never committed). Graphics-only videos
   (no shots.json) assemble fine.
2. `bash steps/090-assemble-run/run.sh <slug>` — gates, segment planning, and
   the ffmpeg passes are the step's own. Output:
   `~/kb-scratch/video/visuals-flow/<slug>/final.mp4` + committed
   `assembly.md` (the EDL).
3. The editor handoff bundle is unchanged; final.mp4 is an additional output —
   per video the owner ships it directly or hands the bundle to the editor.
```

**Verify**: `/usr/bin/grep -c "assemble the video" pipelines/.claude/skills/visuals-flow/SKILL.md` → `1`

### Step 8: merge gate + status row

Run the full gate; update this plan's row in `plans/README.md` to
`IN PROGRESS`→`DONE` per WORKFLOW.md. Also `git add` this plan file and the
prompt/run-log files if untracked (executors under-stage orchestrator docs —
LESSONS 2026-07-05).

**Verify**: `cd pipelines/video/visuals-flow && bash scripts/check.sh` → exit 0, `visuals-flow check OK`

## Test plan

- Unit: `planSegments` (contiguity, edge placement, overlap throw, EPS clamp,
  empty avatar list, corner-job exclusion) + `assemblyMd` shape — pure, fast.
- Integration: `runAssembly` end-to-end on lavfi-generated 8s fixtures inside
  `lib/.test-tmp/` — asserts duration/resolution/audio/EDL. Skips (with log)
  when ffmpeg is unavailable.
- Gate: `bash scripts/check.sh` (this is `test_cmd`).

## Done criteria

- [ ] `cd pipelines/video/visuals-flow && bash scripts/check.sh` → exit 0 with
      `lib/assemble.test.mjs` in the list.
- [ ] `node lib/assemble.mjs` (no args) prints the usage line, exit 1.
- [ ] Integration test produced a `final.mp4` fixture asserted at 1920x1080,
      ~8s, with an audio stream, plus a well-formed `assembly.md`.
- [ ] `.gitignore`, `PIPELINE.md`, and skill SOURCE file edits present
      (Steps 5–7 verifies).
- [ ] `git status` clean of stray scratch files outside `lib/.test-tmp/`.

## STOP conditions

- `bash scripts/check.sh` red BEFORE any change → stop and report (baseline broken).
- NEVER run assembly (or any step) against `videos/test-01/` — its media is
  incomplete mid-pilot and its committed JSON must not change. Verification is
  the fixture test only.
- No HeyGen commands of any kind (`heygen-web`, submits, downloads).
- The overlay-with-alpha fixture fails to composite after 2 fix attempts →
  stop and report the ffmpeg stderr (don't switch codecs/approach unilaterally).
- Any need to modify out-of-scope files (render.mjs, board, lint, card-library)
  → stop and report.

## Maintenance notes

- The corner avatar track (deferred by the owner) will need a third layer in
  the final pass when it lands: corner clips composited like overlays but
  scaled/positioned — extend the overlay chain, not the base track.
- Future flow change (tutorial-pipeline-2 style, screen NOT VO-aligned) will
  need a placement manifest for screen segments; `planSegments` is the seam —
  screen fills would come from a list instead of "whatever replacements leave".
- `offset` (editor-timeline shift) is deliberately ignored here; if a cold-open
  intro is ever prepended by script, apply it as a leading segment, not via
  offset.
- BGM was explicitly NOT chosen (owner picked plain vo.mp3, 2026-07-18); a
  ducked music bed would slot into the final pass's audio map.
