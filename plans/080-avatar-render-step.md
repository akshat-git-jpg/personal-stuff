---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui:
deploy:
needs: ["078 (schema/resolver/lint)", "079 (board approve gate for shots)"]
---

# Plan 080: Avatar render step (080) — VO slices → HeyGen 3 template jobs → clips + avatar manifest

## Summary

- **Problem statement**: an approved shot plan (plans 078/079) produces no clips. The design (docs/specs/2026-07-18-avatar-shot-plan-design.md) says approved spans drive avatar generation: full-screen span slices + a contiguous corner track, rendered via HeyGen templates, landing as editor-ready clips with place-at timecodes.
- **Goals**:
  - `lib/avatar-render.mjs` — gates (approved / fresh / lint-clean / engineMode=test), ffmpeg audio prep, submit + download verbs wrapping the `heygen-web` CLI, `avatar-jobs.json` job manifest, `avatar-manifest.md` for the editor.
  - `steps/080-avatar-render-run/` — README + run.sh.
  - Offline tests (CLI stubbed via env var); zero live HeyGen calls in any test or verify.
- **Executor proposed**: `agy` (Gemini 3.1 Pro High, agy default) — owner-directed; all commands, shapes, and constants inlined.
- **Done criteria** (terse): check.sh green incl. avatar-render tests; submit/download logic proven against a stub CLI; gates refuse unapproved/stale/production.
- **Stop conditions** (terse): NEVER invoke the real heygen-web in tests/verification; auth or ToS-adjacent questions → stop.
- **Test / verification for success**: `node --test lib/avatar-render.test.mjs` via check.sh with `HEYGEN_WEB_BIN` pointing at a fixture stub.
- **Open points for plan readiness**: none (the live pilot on test-01 is deliberately owner-run, after this lands).

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b40a207..HEAD -- pipelines/video/visuals-flow/lib pipelines/video/visuals-flow/steps pipelines/video/visuals-flow/scripts/check.sh`
> Expect only 077–079 changes (rename, shots libs, board); anything else → report first.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (external CLI boundary; mitigated by stub-tested seams + owner-run live pilot)
- **Depends on**: 078, 079
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `b40a207`, 2026-07-18

## Why this matters

This is the step that turns the shot plan into deliverables: the paid-attention moments (full-screen host) and the always-on corner track, as files the editor drops at manifest timecodes — the same contract graphics clips already honor. It reuses tutorial-pipeline-1's proven submit/download pattern and the heygen-web CLI so no new HeyGen surface is invented.

## Current state

- `tooling/cli/heygen-web/heygen-web.mjs` — the CLI (repo-root relative: `tooling/cli/heygen-web/`). Verified command shapes (from `src/cli/help.mjs`, HAR-verified 2026-07-09):
  - `auth-check` → exit 0 = session live.
  - `generate-from-template --template <slug-or-id> --audio <file> [--title T]` → submits a template render over the audio; prints JSON incl. `video_id`; **auto-appends a row to `pipelines/video/heygen/RENDERS.md`**.
  - `status <video_id>` → one-shot status JSON (no polling loop).
  - `download <video_id> [--out file.mp4]`.
  - `--template` accepts a slug from `pipelines/video/heygen/registry.json` (e.g. `girl-1`) or a raw id.
  - Standing rules (its CLAUDE.md): **Avatar III only**; ToS-grey → never live-call in tests/automation loops; media never in the repo — download to `~/kb-scratch/video/heygen/<pipeline>/`.
- Pacing prior art: `pipelines/youtube/tutorial-pipeline-1/steps/030-submit-avatar-renders-run/run.py` — `PACING = {min_gap: 45, max_gap: 150, settle_every: 5, settle_gap: 600}` (seconds between submits; long settle every 5th). Submit-only step; downloads are a separate later step with ONE attempt per pending job.
- From 078/079 in `pipelines/video/visuals-flow/`: `lib/resolve-shots.mjs` (`resolveShots`), `lib/lint-shots.mjs` (`lintShots`), `shots.json` (`approved`, `engineMode`, spans with anchors), `shots.resolved.json` (`{video, offset, engineMode, spans:[{id,kind,start,end,duration,note}]}`), board approve gate.
- Gate pattern to mirror: `lib/render.mjs` lines 111–132 — refuse `approved !== true` without `--force`; recompute + canon-compare for staleness; `--force` warns and proceeds.
- Manifest pattern to mirror: `lib/render.mjs` `manifestMd` (lines 59–78) — derived from files on disk, `mmss(start + offset)` place-at column, offset note. **Deviation decided 2026-07-18**: avatar clips get their OWN `avatar-manifest.md` — `render.mjs` overwrites `manifest.md` from disk on every run, so appending an avatar section there would be clobbered; two derived-from-disk manifests can't fight.
- `videos/<slug>/` media rules: `vo.mp3`, `slices/`, `renders/` are gitignored; text artifacts committed. Avatar audio slices go under `slices-avatar/` (gitignore: add alongside `slices/` in the flow's `.gitignore`); downloaded clips go OUTSIDE the repo per media policy (below).
- `scripts/check.sh` — add the new test file to the `node --test` line.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Flow gate | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exit 0 |
| New tests | `node --test lib/avatar-render.test.mjs` | all pass, no network |
| ffmpeg present | `ffmpeg -version` | exit 0 (already required by step 010) |

## Scope

**In scope**:
- New: `lib/avatar-render.mjs`, `lib/avatar-render.test.mjs`, `steps/080-avatar-render-run/README.md`, `steps/080-avatar-render-run/run.sh`.
- Edits: `scripts/check.sh` (test line), the flow's `.gitignore` (`slices-avatar/`), `PIPELINE.md` (080 flow-table row + `avatar-jobs.json`/`avatar-manifest.md` layout lines), `plans/README.md` (080 row).

**Out of scope**:
- Any change to `tooling/cli/heygen-web/` (if a needed flag is missing, STOP and report).
- HeyGen 4 / `engineMode: "production"` (validation error until the owner flips it — design doc).
- Running a live submit/download (owner-run pilot AFTER merge).
- `manifest.md`, graphics render, board.

## Git workflow

- Branch: `advisor/080-avatar-render-step`
- Commit per step: `feat(visuals-flow): avatar render — <step summary>` — no AI footers. Do NOT push.

## Steps

### Step 1: `lib/avatar-render.mjs` — constants, gates, audio prep (pure parts exported)

```js
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { resolveShots } from './resolve-shots.mjs';
import { lintShots } from './lint-shots.mjs';
import { mmss } from './render.mjs';

// HeyGen 3 per-render length ceiling is unverified (design doc open question
// #1) — 300s is known-safe from tutorial-pipeline-1 renders. Raise only after
// a longer live render proves out; corner chunks are contiguous either way.
export const CORNER_CHUNK = 300;           // s
export const PACING = { minGap: 45, maxGap: 150, settleEvery: 5, settleGap: 600 }; // tutorial-pipeline-1 anti-ban pacing
const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..', '..', '..');
export const HEYGEN_WEB = process.env.HEYGEN_WEB_BIN
  ?? `node ${path.join(REPO_ROOT, 'tooling', 'cli', 'heygen-web', 'heygen-web.mjs')}`;
export const MEDIA_ROOT = path.join(os.homedir(), 'kb-scratch', 'video', 'heygen', 'visuals-flow');

// Contiguous corner chunks covering [0, T): [{id:'corner-01', start, end}, …]
export function planCornerChunks(totalDuration, chunk = CORNER_CHUNK) {
  const out = [];
  for (let i = 0, n = 1; i < totalDuration; i += chunk, n++) {
    out.push({ id: `corner-${String(n).padStart(2, '0')}`, start: +i.toFixed(2), end: +Math.min(i + chunk, totalDuration).toFixed(2) });
  }
  return out;
}

// The full job list for a video: one job per avatar-full span + corner chunks.
export function planJobs(shotsResolved, totalDuration) {
  const spanJobs = shotsResolved.spans.map((s) => ({ id: s.id, kind: 'avatar-full', start: s.start, end: s.end }));
  const cornerJobs = planCornerChunks(totalDuration).map((c) => ({ ...c, kind: 'corner' }));
  return [...spanJobs, ...cornerJobs].map((j) => ({ ...j, duration: +(j.end - j.start).toFixed(2) }));
}

export function avatarManifestMd(video, jobs, offset = 0) {
  const done = jobs.filter((j) => j.file);
  const rows = done.sort((a, b) => a.start - b.start).map((j) =>
    `| ${mmss(j.start + offset)} | ${path.basename(j.file)} | ${j.duration}s | ${j.kind} |`);
  return [
    `# ${video} — avatar manifest`,
    '',
    `Corner chunks are contiguous — drop them in sequence from ${mmss(offset)}; the editor cuts the corner during avatar-full spans.`,
    '',
    '| place at | file | duration | kind |',
    '|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}
```

Gates (in `main`, before any submit — mirror `render.mjs` order):
1. `shots.json` `approved !== true` and no `--force` → stderr `refusing to render: shots.json approved=false — review on the board or pass --force`, exit 1.
2. Freshness: `resolveShots(shotsFile, words)`; errors OR `JSON.stringify(recomputed.spans) !== JSON.stringify(shotsResolved.spans)` → refuse as stale (`re-run node lib/resolve-shots.mjs <slug>`), `--force` warns and proceeds.
3. `lintShots({shotsResolved, resolvedCues, words})` errors (needs `resolved.json` — fullframe-collision is the cue-drift catch) → refuse, list errors. No force bypass for lint errors.
4. `shotsFile.engineMode !== 'test'` → hard error quoting the design doc (no force bypass).
5. `--submit` additionally requires `auth-check` exit 0 via the CLI → else `auth expired — recapture cURLs (tooling/cli/heygen-web/CLAUDE.md)`, exit 1.

Audio prep (during `--submit`, before submitting): `slices-avatar/<id>.mp3` per job —
spans: `ffmpeg -y -i vo.mp3 -ss <start> -to <end> -c copy slices-avatar/<id>.mp3`; corner chunks: same command per chunk (explicit -ss/-to per chunk, NOT `-f segment` — keeps ids deterministic). Skip existing files.

**Verify**: `node -e "import('./lib/avatar-render.mjs').then(m => console.log(m.planCornerChunks(650).length))"` → `3`.

### Step 2: submit + download verbs

CLI: `node lib/avatar-render.mjs <slug-or-path> --template <slug> --submit [--force]` and `node lib/avatar-render.mjs <slug-or-path> --download`.

- **`--submit`** (template REQUIRED — no default; the owner names the registry slug at run time): run gates, prep audio, then for each job not already in `avatar-jobs.json` with a `video_id`: sleep per PACING (random `minGap..maxGap`s between submits, `settleGap` every `settleEvery`th — skip all sleeping when `process.env.AVATAR_RENDER_NO_PACING === '1'`, the test hook), then `spawnSync` the CLI: `generate-from-template --template <template> --audio slices-avatar/<id>.mp3 --title <video>__<id>`. Parse the JSON stdout for `video_id` + `status`. After each submit, rewrite `avatar-jobs.json`:
  ```json
  { "video": "<slug>", "template": "<slug>", "engineMode": "test",
    "jobs": [{ "id": "s01", "kind": "avatar-full", "start": 61.2, "end": 118.4, "duration": 57.2,
               "audio": "slices-avatar/s01.mp3", "video_id": "…", "status": "submitted",
               "submitted_at": "<ISO date>" }] }
  ```
  (Re-running submit is idempotent: jobs with a `video_id` are skipped, so a mid-run failure resumes.) A submit whose stdout has no `video_id` records `status: "failed"` and CONTINUES to the next job; exit 1 at the end if any failed.
- **`--download`**: no gates beyond `avatar-jobs.json` existing. For each job with a `video_id` and no `file`: `status <video_id>`; if the JSON says completed, `download <video_id> --out <MEDIA_ROOT>/<slug>/<id>.mp4`, record `file` in avatar-jobs.json; else print `pending: <id>` and continue (ONE attempt, no polling — re-run later, tutorial-pipeline-1 semantics). After the loop, write `avatar-manifest.md` via `avatarManifestMd(video, jobs, offset)` (offset from `shots.resolved.json`). Exit 0 even with pending jobs (their manifest rows appear on a later run); exit 1 only on a download that errored.

**Verify**: `node lib/avatar-render.mjs 2>&1 | head -2` → usage line mentioning `--submit`/`--download`, exit 1.

### Step 3: step folder + wiring

**`steps/080-avatar-render-run/README.md`**:

```markdown
# 080 · avatar-render  ·  [RUN]  (submit + download are separate invocations)

Turn the approved shot plan into avatar clips: one HeyGen 3 TEMPLATE render per
full-screen span + contiguous corner chunks covering the whole VO. Test mode
only (`engineMode: "test"`) — the HeyGen 4 production path does not exist yet
(design doc `docs/specs/2026-07-18-avatar-shot-plan-design.md`).

- **In:** approved `shots.json` + fresh `shots.resolved.json` + `resolved.json` + `vo.mp3`
- **Out:** `avatar-jobs.json` (committed) · clips in `~/kb-scratch/video/heygen/visuals-flow/<slug>/` (media policy — never in the repo; RENDERS.md rows auto-appended on submit) · `avatar-manifest.md` (committed)
- **Run:** `bash run.sh <slug> --template <registry-slug> --submit` → wait for HeyGen → `bash run.sh <slug> --download` (re-run until no `pending:` lines)
- **Rules:** live HeyGen calls are owner-run only (ToS-grey — heygen-web CLAUDE.md); anti-ban pacing is built in; template slug comes from `pipelines/video/heygen/registry.json`.
```

**`run.sh`** (mirror other steps' thin wrappers): `#!/usr/bin/env bash`, `set -euo pipefail`, `cd "$(dirname "$0")/../.."`, `exec node lib/avatar-render.mjs "$@"`.

Wiring: add `avatar-render.test.mjs` to `scripts/check.sh`; add `slices-avatar/` to the flow `.gitignore` next to `slices/`; PIPELINE.md — flow-table row
`| \`080-avatar-render-run\` | [RUN] | approved \`shots.resolved.json\` + \`vo.mp3\` → HeyGen template jobs → \`avatar-jobs.json\` + clips (kb-scratch) + \`avatar-manifest.md\` |`
and layout lines for `avatar-jobs.json` (committed) / `avatar-manifest.md` (committed) / `slices-avatar/` (gitignored).

**Verify**: `bash steps/080-avatar-render-run/run.sh 2>&1 | head -2` → the usage line (proves wiring), exit 1.

### Step 4: offline tests — `lib/avatar-render.test.mjs`

Stub the CLI: write a fixture script `lib/fixtures/heygen-web-stub.mjs` (tracked) that inspects `process.argv` and prints canned JSON: `auth-check`→exit 0; `generate-from-template`→`{"video_id":"vid-<n>","status":"submitted"}` (n from a counter file in the temp dir); `status`→`{"status":"completed"}`; `download`→writes an empty file at the `--out` path, prints `{}`. Tests run the real `avatar-render.mjs` CLI via `spawnSync(process.execPath, …)` with `HEYGEN_WEB_BIN="node lib/fixtures/heygen-web-stub.mjs"`, `AVATAR_RENDER_NO_PACING=1`, and a temp workdir (synthetic `transcript.json`/`shots.json`/`shots.resolved.json`/`resolved.json`; a tiny silent `vo.mp3` generated once via `ffmpeg -f lavfi -i anullsrc -t 700 -q:a 9 vo.mp3` in a before-hook). Override `MEDIA_ROOT` for tests via env `AVATAR_MEDIA_ROOT` (add that env hook in Step 1's constant: `process.env.AVATAR_MEDIA_ROOT ?? …`).

Cases:
1. `planCornerChunks(650)` → 3 chunks, contiguous, last ends 650; `planJobs` merges spans + corners.
2. Unapproved shots.json → submit exits 1 with `approved=false` in stderr; `--force` proceeds.
3. `engineMode: "production"` → exits 1 even with `--force`.
4. Stale `shots.resolved.json` (edit a span time) → exits 1 mentioning stale.
5. Lint gate: a span overlapping a fullframe cue in `resolved.json` → exits 1 with `E2`.
6. Happy submit: avatar-jobs.json written with video_ids for every span + chunk; slices exist in `slices-avatar/`; re-running submit submits nothing new (idempotent — assert stub call count via the counter file).
7. Happy download: files land under the overridden media root, `file` recorded, `avatar-manifest.md` written with `place at` honoring a non-zero `offset`.
8. `avatarManifestMd` unit: pending jobs (no `file`) excluded; rows sorted by start.

**Verify**: `bash scripts/check.sh` → exit 0 including the new file; confirm zero network by the stub being the only "CLI" invoked (grep test output for `heygen-web.mjs` absence is unnecessary — HEYGEN_WEB_BIN override is asserted in case 6).

## Test plan

Step 4 — the full verb surface against a stub CLI in temp workdirs; ffmpeg is exercised for real (silent fixture audio). The live pilot (test-01, template slug chosen by the owner) is explicitly NOT part of this plan's verification.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow && bash scripts/check.sh` exits 0 (incl. avatar-render tests).
- [ ] All 5 gates provably refuse (test-asserted); `--force` bypasses only approval/staleness, never lint/engineMode.
- [ ] Submit is idempotent; download is one-attempt-per-run; avatar-manifest.md derives from job state and honors `offset`.
- [ ] No test or verify step touches the network or the real heygen-web CLI.
- [ ] PIPELINE.md row + layout lines added; `plans/README.md` row for 080 flipped to DONE.

## STOP conditions

- ANY urge to live-test against HeyGen — the pilot is owner-run, full stop.
- A needed heygen-web flag/command that doesn't exist (e.g. download output naming misbehaves) — report; do not edit that CLI under this plan.
- ffmpeg slice commands producing wrong durations on the fixture (>0.5s off vs the span) — report; do not swap slicing strategies unilaterally.
- Anything requiring a change to plans 078/079's landed surfaces.

## Maintenance notes

- The production flip (full-screen → HeyGen 4) touches: `resolve-shots.mjs` engineMode validation, this file's engine routing, and heygen-web's Avatar III-only rule + unimplemented heygen4 path — an OWNER-initiated future plan, never a drive-by.
- `CORNER_CHUNK` is the design doc's open question #1 — after the owner's first live pilot proves a longer ceiling, raising it changes chunk count only (ids stay `corner-NN`).
- RENDERS.md rows are appended by the CLI at submit; after download, the owner (or a future fold) fills the filename column — same convention as tutorial-pipeline-1.
- `avatar-jobs.json` holds HeyGen video_ids — committed on purpose (text, reviewable, resume-able), matching the committed-text/gitignored-media house rule.
