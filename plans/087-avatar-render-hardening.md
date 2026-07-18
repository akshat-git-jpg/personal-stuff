---
executor: agy
model:
test_cmd: bash pipelines/video/visuals-flow/scripts/check.sh
ui:
deploy:
needs: [land before 088 — 088 touches the same file for resolveWorkdir dedupe]
---

# Plan 087: avatar-render hardening — array-form spawns, slice verification, guards

## Summary

- **Problem statement**: `lib/avatar-render.mjs` interpolates data-derived values (`--template`, job title from the `video` field, `video_id`, output paths) into `shell: true` command strings at 4 sites — spaces corrupt paid HeyGen jobs, shell metacharacters could execute; the VO audio slice's ffmpeg result is unchecked and uses `-c copy` (frame-boundary-imprecise cuts) right before paid submits; an empty transcript crashes with a raw TypeError.
- **Goals**: array-form `spawnSync` everywhere (no `shell: true`); verify each slice (exit status + file exists) before it can be submitted; re-encode slices for sample-accurate cuts; empty-transcript guard; slug/template allowlist as defense in depth.
- **Executor proposed**: agy (Gemini 3.1 Pro High) — mechanical, fully inlined, strong test net.
- **Done criteria** (terse): `check.sh` exit 0; `grep -n "shell: true" lib/avatar-render.mjs` → no matches; new regression tests pass.
- **Stop conditions** (terse): any behavior change to pacing, idempotency, or the jobs-file flush logic; any live HeyGen call from tests.
- **Test / verification for success**: extended `lib/avatar-render.test.mjs` against the existing `lib/fixtures/heygen-web-stub.mjs` — zero live network.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 88c6943..HEAD -- pipelines/video/visuals-flow/lib/avatar-render.mjs pipelines/video/visuals-flow/lib/avatar-render.test.mjs`

## Status

- **Priority**: P1 (touches paid submits)
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (but must land BEFORE 088)
- **Category**: security
- **Difficulty**: standard
- **Planned at**: commit `88c6943`, 2026-07-18

## Why this matters

Step 080 drives LIVE HeyGen submits — the one paid, rate-limited, owner-gated operation in the pipeline. A malformed slug or template silently corrupting the command line means burned quota and wrong-audio jobs; a failed ffmpeg slice currently submits a job pointing at a nonexistent audio file. The fixes are mechanical but sit on the money path, so they get their own small plan with regression tests.

## Current state (excerpts verified at 88c6943, `pipelines/video/visuals-flow/`)

- `lib/avatar-render.mjs:12-13`:
  ```js
  export const HEYGEN_WEB = process.env.HEYGEN_WEB_BIN
    ?? `node ${path.join(REPO_ROOT, 'tooling', 'cli', 'heygen-web', 'heygen-web.mjs')}`;
  ```
  A command STRING (binary + arg), which is why every call site uses `shell: true`.
- The four shell sites:
  - `:121` — `spawnSync(HEYGEN_WEB, ['auth-check'], { shell: true, encoding: 'utf8' })`
  - `:165-168` — `` const title = `${shotsResolved.video}__${job.id}`; … const cmd = `${HEYGEN_WEB} generate-from-template --template ${opts.template} --audio ${audioPath} --title ${title}`; spawnSync(cmd, { shell: true, encoding: 'utf8', cwd: workdir }) ``
  - `:236` — `` spawnSync(`${HEYGEN_WEB} status ${job.video_id}`, { shell: true, … }) ``
  - `:241` — `` spawnSync(`${HEYGEN_WEB} download ${job.video_id} --out ${outFile}`, { shell: true, … }) `` where `outFile = path.join(outDir, `${job.id}.mp4`)` and `outDir = path.join(MEDIA_ROOT, jobsData.video)`.
- The unchecked slice, `:139-145`:
  ```js
  for (const job of jobs) {
    const audioPath = path.join(slicesDir, `${job.id}.mp3`);
    if (!fs.existsSync(audioPath)) {
      const voPath = path.join(workdir, 'vo.mp3');
      spawnSync('ffmpeg', ['-y', '-i', voPath, '-ss', String(job.start), '-to', String(job.end), '-c', 'copy', audioPath]);
    }
  }
  ```
  No status check; `-c copy` cuts on mp3 frame boundaries (tens of ms off), while the board's slicer and transcribe-groq both re-encode.
- `:130` — `const totalDuration = words[words.length - 1].end;` — no empty guard (`lint-cues.mjs:20` has the guard pattern to copy).
- Tests: `lib/avatar-render.test.mjs` (209 lines) already runs submit/download flows against `lib/fixtures/heygen-web-stub.mjs` via the `HEYGEN_WEB_BIN` env override, with `AVATAR_RENDER_NO_PACING=1`. Follow its conventions exactly. NOTE: the stub is wired through `HEYGEN_WEB_BIN` as a string today — keep that env contract working (see Step 1).

## Design (decided)

- New helper at the top of `avatar-render.mjs`:
  ```js
  // HEYGEN_WEB_BIN stays a string for env/tests ("node /path/x.mjs" or a bare
  // binary); split ONCE here, never re-parsed by a shell.
  export function heygenArgv() {
    const parts = HEYGEN_WEB.split(' ').filter(Boolean);
    return { bin: parts[0], pre: parts.slice(1) };
  }
  ```
  Every call becomes `spawnSync(bin, [...pre, 'generate-from-template', '--template', opts.template, '--audio', audioPath, '--title', title], { encoding: 'utf8', cwd: workdir })` — NO `shell` option. (The split-on-space contract is acceptable because the repo path contains no spaces and the env override is owner-controlled; the allowlist below covers the data-derived parts.)
- Allowlist guard before submit: `const SAFE = /^[A-Za-z0-9._-]+$/;` — validate `shotsResolved.video`, `opts.template`, and each `job.id`; on failure print which value and exit 1. On download, validate `jobsData.video` and `job.video_id` with the same pattern.
- Slice verification + precise cut: replace the slice loop body with a re-encode and a check:
  ```js
  const res = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', voPath,
    '-ss', String(job.start), '-to', String(job.end), '-c:a', 'libmp3lame', '-q:a', '2', audioPath]);
  if (res.status !== 0 || !fs.existsSync(audioPath)) {
    console.error(`slice failed for ${job.id} — aborting before any submit`);
    process.exit(1);
  }
  ```
  (Slicing happens before the submit loop, so exiting here burns nothing.)
- Empty-transcript guard before `:130`: `if (!Array.isArray(words) || words.length === 0) { console.error('empty transcript.json — nothing to submit'); process.exit(1); }`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Test gate (boss merge gate) | `bash scripts/check.sh` (from `pipelines/video/visuals-flow/`) | exit 0, `visuals-flow check OK` |
| Single file | `node --test lib/avatar-render.test.mjs` | all pass |
| No shell spawns left | `grep -n "shell: true" lib/avatar-render.mjs` | no output, exit 1 |

## Scope

**In scope**: `pipelines/video/visuals-flow/lib/avatar-render.mjs`, `pipelines/video/visuals-flow/lib/avatar-render.test.mjs`, `lib/fixtures/heygen-web-stub.mjs` ONLY if the argv change requires a stub tweak.

**Out of scope**: pacing constants/logic (`PACING`, the sleep), the per-submit + final jobs-file flush semantics (regression-protected from the 2026-07-18 incidents — do not restructure), `resolveWorkdir` (plan 088 dedupes it), all other lib modules, anything in `steps/`.

## Git workflow

- Branch: `boss/087-avatar-render-hardening`
- Commit per step, conventional messages, no AI footers. Do NOT push.

## Steps

### Step 1: heygenArgv + convert the 4 spawn sites

Add the helper; convert `:121`, `:167-168`, `:236`, `:241` to array form (args exactly as listed in Design — `cwd` options unchanged). Run the existing test file to prove the stub contract still works.

**Verify**: `node --test lib/avatar-render.test.mjs` → all pass; `grep -c "shell: true" lib/avatar-render.mjs` → 0.

### Step 2: guards

Add the empty-transcript guard, the SAFE allowlist checks (submit + download paths), and the slice verification/re-encode. Order inside `main()` stays otherwise identical.

**Verify**: `node --test lib/avatar-render.test.mjs` → all pass.

### Step 3: regression tests

Add to `lib/avatar-render.test.mjs`, following its stub/env conventions: (a) a video slug containing a space or `;` → exit 1 before any stub invocation; (b) empty `transcript.json` → exit 1 with the message; (c) slice failure (point vo.mp3 at a nonexistent file for one case) → exit 1 before submit; (d) happy path still submits and the slice file ffprobes to the span duration ±0.05s (re-encode precision — the old `-c copy` could not guarantee this).

**Verify**: `bash scripts/check.sh` → exit 0, `visuals-flow check OK`.

## Test plan

Step 3's four regression cases in `lib/avatar-render.test.mjs`; everything runs against the stub — zero live HeyGen calls.

## Done criteria

- [ ] `bash scripts/check.sh` exits 0.
- [ ] `grep -n "shell: true" lib/avatar-render.mjs` → empty.
- [ ] New regression tests pass, including the ±0.05s slice-duration probe.
- [ ] `plans/README.md` row 087 updated to DONE.

## STOP conditions

- Any test attempts a real network call (stub not engaged) — stop immediately.
- The stub contract can't be preserved without changing test semantics — stop and report.
- Any change wanted to pacing or jobs-file flush behavior — stop (incident-protected code).

## Maintenance notes

- The `-c copy` → re-encode change means slices regenerate slightly different bytes; existing `slices-avatar/` caches are keyed by existence only, so delete a video's `slices-avatar/` before its next submit if exact cuts matter for it (test-01's pilot is done — no action needed).
- If `HEYGEN_WEB_BIN` ever needs a path with spaces, replace the split-on-space contract with an env pair (bin + prefix args) — one helper to change.
