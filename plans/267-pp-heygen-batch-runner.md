<!-- boss frontmatter -->
---
executor: agy
model:
test_cmd: bash tooling/cli/pp-heygen-batch/test-pp-heygen-batch.sh
ui:
deploy:
needs: []
needs_plans: [266]
needs_prs: []
touches:
  - tooling/cli/pp-heygen-batch/pp-heygen-batch
  - tooling/cli/pp-heygen-batch/pp-heygen-batch.mjs
  - tooling/cli/pp-heygen-batch/lib/timings.mjs
  - tooling/cli/pp-heygen-batch/lib/slice.mjs
  - tooling/cli/pp-heygen-batch/lib/heygen.mjs
  - tooling/cli/pp-heygen-batch/lib/pool.mjs
  - tooling/cli/pp-heygen-batch/lib/drive.mjs
  - tooling/cli/pp-heygen-batch/lib/whisper.py
  - tooling/cli/pp-heygen-batch/test-pp-heygen-batch.sh
  - tooling/cli/pp-heygen-batch/test/timings.test.mjs
  - tooling/cli/pp-heygen-batch/test/pool.test.mjs
  - tooling/cli/pp-heygen-batch/test/slice.test.mjs
  - tooling/cli/pp-heygen-batch/test/heygen.test.mjs
  - tooling/cli/pp-heygen-batch/test/fixtures/selections.json
  - tooling/cli/pp-heygen-batch/test/fixtures/words-s01.json
  - tooling/cli/pp-heygen-batch/test/fixtures/usage-full.json
  - tooling/cli/pp-heygen-batch/test/fixtures/usage-empty.json
  - tooling/cli/pp-heygen-batch/README.md
  - tooling/cli/pp-heygen-batch/CLAUDE.md
  - .claude/allow-main-writes.list
  - tooling/cli/pp-land/verify-map.tsv
  - pipelines/video/heygen/CLAUDE.md

mutation_apply:
mutation_command:
mutation_expect:
mutation_cwd:
mutation_timeout:
---

# Plan 267: pp-heygen-batch runner (voiceover -> avatar clips -> Drive)

## Summary

- **Problem statement**: The editor's queue file (`videos/<key>/heygen-selections.json`, produced by plan 266) has nothing to consume it. Without a runner, the tool saves selections and stops. The runner is the load-bearing half — everything mechanical happens here.
- **Goals**:
  - New CLI `pp-heygen-batch <video-key>` in `tooling/cli/pp-heygen-batch/` that reads the queue and produces one HeyGen mp4 per selection.
  - Auto-computes word-level timestamps for each section wav on first use, cached to `videos/<key>/audio/<id>.words.json` (mlx-whisper primary, faster-whisper fallback).
  - Slices each section wav to per-selection wavs via `ffmpeg` and the cached word timings.
  - Calls `tooling/cli/heygen-web` (`generate-from-template` for template slugs, `generate-from-audio` for photo-avatar slugs), one at a time, with 10–30 s random jitter.
  - Pre-checks the HeyGen `/1200` pool via `heygen-web usage`'s stdout JSON; refuses to start if the sum of Avatar IV seconds requested exceeds `seconds_remain`.
  - Downloads mp4s to `~/kb-scratch/video/heygen/pp-heygen-batch/<key>/renders/<video-key>-sel-<NN>.mp4`.
  - Uploads all mp4s to Drive at `HeyGen batches / <channel-slug> / <video-key> / <yyyy-mm-dd-hh-mm> /` via `pp-drive` with `--account kushalbakliwal25@gmail.com`.
  - Prints the Drive folder share link on stdout as the last line.
- **Decisions confirmed** (Step 2.5):
  - Split into how many plans -> plan B of 2 (this = runner; plan 266 = desk UI)
  - Drive account -> `kushalbakliwal25@gmail.com`
  - Drive folder shape -> `HeyGen batches / <channel-slug> / <video-key> / <yyyy-mm-dd-hh-mm> /`
  - Whisper engine -> mlx-whisper primary, faster-whisper fallback
  - RENDERS.md write on main-write wall -> add `pipelines/video/heygen/RENDERS.md` to `.claude/allow-main-writes.list`
  - mp4 output naming -> `<video-key>-sel-<NN>.mp4`
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — standard difficulty; every intelligence-heavy step (text-to-word alignment, JSON parsing) has an inlined snippet in the plan.
- **Done criteria** (terse): `bash tooling/cli/pp-heygen-batch/test-pp-heygen-batch.sh` exits 0; every helper module has a unit test using fixtures (no live HeyGen or Drive calls).
- **Stop conditions** (terse): live HeyGen or Drive calls in a test — STOP; a downgrade of Avatar IV to III to skate under the pool cap — STOP.
- **Test / verification for success**: `node --test` unit tests over the four helper modules, driven by JSON fixtures.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If anything in the "STOP conditions" section occurs, stop and report. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 86266059..HEAD -- tooling/cli/pp-heygen-batch/ tooling/cli/pp-land/verify-map.tsv .claude/allow-main-writes.list pipelines/video/heygen/CLAUDE.md`

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: plan 266 (needs the queue file it produces)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `86266059`, 2026-09-04

## Why this matters

The half of the pipeline that saves the freelancer time is the automation, not the UI. This plan is where 30 minutes of manual click-and-download turns into one command. It also stays fully local: the HeyGen cookie never leaves the owner's Mac; a freelancer's tool never touches it. The `/1200` pool pre-check keeps HeyGen's real cost visible before a batch runs, so a freelancer's careless selection cannot silently overshoot the monthly cap.

## Current state

### `tooling/cli/heygen-web/` CLI shape

Verified 2026-09-04 against `tooling/cli/heygen-web/src/cli/dispatch.mjs` and `tooling/cli/heygen-web/src/workflows/generate.mjs`.

Relevant verbs:

- `node heygen-web.mjs generate-from-template --template <template_id|slug> --audio <file> --engine heygen3|heygen4 [--title T] [--no-meter-check]`
- `node heygen-web.mjs generate-from-audio --avatar <avatar_id|slug> --audio <file> --engine heygen3|heygen4 [--orientation landscape|portrait] [--title T] [--no-meter-check]`
- `node heygen-web.mjs status <video_id>` — prints JSON with `progress` (0–100) and `eta`.
- `node heygen-web.mjs download <video_id> --res 1080p [--out <path>]` — polls until COMPLETED, writes the MP4.
- `node heygen-web.mjs usage [--save] [--diff]` — prints JSON snapshot to stdout with fields: `seconds_consumed`, `seconds_limit`, `seconds_remain`, `credits`, `free_credit_remain`. Human summary on stderr.
- `node heygen-web.mjs limits` — prints `data` JSON on stdout with `remain` (seconds remaining in the current pool).
- `node heygen-web.mjs auth-check` — exit 0 = live.

Absolute path from repo root: `tooling/cli/heygen-web/heygen-web.mjs`.

The CLI already auto-appends a row to `pipelines/video/heygen/RENDERS.md` on submit via `src/cli/render-log.mjs`. This is intentional and stays — the runner does not disable it.

### `pipelines/video/heygen/registry.json` shape

Verified 2026-09-04. Keys are slugs. Each entry has one or both of `template_id` and `avatar_id`:

```json
{
  "girl-1": { "template_id": "7629dffbebe141eb8f701630948bd707", "description": "..." },
  "specs-man": { "template_id": "403f1f8c49d64c58bd3168f99a58bb0a", "image": "characters/specs-man/source.jpeg" },
  "some-photo-avatar": { "avatar_id": "abcdef...", "image": "characters/.../source.jpeg" }
}
```

Rule the runner enforces: if the resolved entry has `template_id`, dispatch is `generate-from-template --template <slug>`; if it has `avatar_id`, dispatch is `generate-from-audio --avatar <slug>`; if it has neither, error out with a clear message naming the slug.

### `config/channels.json` and profile lookup

Chain:
- `channel = channelOf(video_key, videos_json)` from `pipelines/video-registry/lib/registry.mjs`.
- `profile = profileFor(channel, channels_json)` from `config/profiles.mjs`.
- `avatar_slug = profile.avatar_slug` — for `agrollo`, this is `girl-1`.

`config/channels.json` has one channel today (`agrollo`); the runner reads the profile through `profileFor` — do not hardcode the slug.

### VO wavs

Path: `pipelines/youtube/yt-script/videos/<key>/audio/<section_id>.wav` (e.g. `audio/s01.wav`). Confirmed by `pipelines/video/tts/lib/vo-synth.mjs:81`. Durations are NOT stored in `script.json`; derive them from the wav via `ffprobe` when needed, or from the last word's end time in the words JSON.

### Whisper choices

Owner runs on Apple Silicon. Two paths:

1. **mlx-whisper** (fast on Apple Silicon) — usable as a Python library or CLI. If installed, prefer it.
2. **faster-whisper large-v3, int8** — used elsewhere in the repo (`pipelines/video/CLAUDE.md`), CPU-viable, ~1.4× realtime.

Both produce a per-word timing list with `start`/`end` in seconds. Wire an env-var override `PP_HEYGEN_BATCH_WHISPER=mlx|faster` to force one path when both are installed.

### `pp-drive` CLI

`tooling/cli/drive/pp-drive` — wrapper for `pp_drive.py`. Every subcommand requires `--account <email>`.

- `pp-drive ensure-folder "<NAME>" [--parent <parent_id>|root] --account <email>` — prints the folder id on stdout. Idempotent.
- `pp-drive upload <FILE> --parent <folder_id> [--name <n>] [--overwrite] --account <email>` — prints `<file_id>  uploaded|skipped ...`.
- Share link: `https://drive.google.com/drive/folders/<folder_id>`.

### `.claude/allow-main-writes.list`

Verified 2026-09-04. Contains file paths that the `no-writes-in-main` wall (plan 265) is allowed to pass through. This runner writes to `pipelines/video/heygen/RENDERS.md` via the CLI it wraps, so the file must be in the allow-list — the runner itself never targets main, but the wall is triggered by ANY tracked-file write initiated by the session, whether from a subprocess or a direct edit.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Unit tests | `bash tooling/cli/pp-heygen-batch/test-pp-heygen-batch.sh` | exit 0, all node --test suites pass |
| Node --test one file | `node --test tooling/cli/pp-heygen-batch/test/timings.test.mjs` | exit 0 |
| Smoke run (manual, needs live HeyGen) | `pp-heygen-batch <video-key>` | exits 0, prints Drive folder link on last line |
| Dry-run (no HeyGen calls) | `pp-heygen-batch <video-key> --dry-run` | exits 0, prints planned selections + pool math |
| Auth check | `node tooling/cli/heygen-web/heygen-web.mjs auth-check` | exit 0 |

## Scope

**In scope**:
- `tooling/cli/pp-heygen-batch/pp-heygen-batch` (bash wrapper — routes to node).
- `tooling/cli/pp-heygen-batch/pp-heygen-batch.mjs` (Node entry point, verbs + orchestration).
- Four helper modules under `lib/`:
  - `timings.mjs` — cache management, word list → time-range mapping.
  - `slice.mjs` — ffmpeg wrapper to produce per-selection wavs.
  - `heygen.mjs` — resolve slug -> verb + flags; dispatch to heygen-web CLI; poll status; download mp4.
  - `pool.mjs` — read `heygen-web usage` JSON; total requested seconds; pass/fail verdict.
  - `drive.mjs` — call `pp-drive ensure-folder` and `pp-drive upload`; return folder id + share link.
- `lib/whisper.py` — Python helper called by `timings.mjs` when the cache is missing.
- One test-runner shell script and four `node --test` suites over fixtures. NO live HeyGen or Drive calls in tests.
- Fixtures under `test/fixtures/` for words, selections, and usage JSON.
- README and CLAUDE.md in the tool folder.
- Update `.claude/allow-main-writes.list` — add `pipelines/video/heygen/RENDERS.md`.
- Update `tooling/cli/pp-land/verify-map.tsv` — add row for `tooling/cli/pp-heygen-batch/`.
- Update `pipelines/video/heygen/CLAUDE.md` — one paragraph pointing at the new tool.

**Out of scope**:
- Any change to `tooling/cli/heygen-web/` (the runner USES it; adding a flag there is a separate plan).
- Any change to `config/channels.json` or `pipelines/video/heygen/registry.json`.
- The desk UI — plan 266.
- Auto trigger (Slack listener, ntfy webhook). The runner is manual invocation; the desk saves the queue, the owner runs the CLI.
- fal-lipsync path (parked by owner).
- Any change to `pipelines/youtube/yt-script/lib/beats.mjs` or `script.json` shape.
- Editing `apps/yt-script-desk/` beyond what plan 266 already does.

## Git workflow

- Branch: `work/plan-267-pp-heygen-batch-runner` (created by pp-work)
- Commit: `feat(pp-heygen-batch): voiceover slice + heygen-web dispatch + drive upload` — no AI footers. Do NOT push.

## Steps

### Step 1: Scaffold the tool folder + wrapper

Create the folder tree and the bash wrapper.

```bash
mkdir -p tooling/cli/pp-heygen-batch/lib
mkdir -p tooling/cli/pp-heygen-batch/test/fixtures
```

Write `tooling/cli/pp-heygen-batch/pp-heygen-batch` (mode 755):

```bash
#!/usr/bin/env bash
# Wrapper — dispatches to the Node entry.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$DIR/pp-heygen-batch.mjs" "$@"
```

`chmod +x tooling/cli/pp-heygen-batch/pp-heygen-batch`.

Write a minimal `pp-heygen-batch.mjs` that prints help + accepts `<video-key>` and `--dry-run`. Verbs and orchestration are wired in later steps.

**Verify**: `tooling/cli/pp-heygen-batch/pp-heygen-batch --help` prints usage; exit 0.

### Step 2: `lib/pool.mjs` — pool pre-check

Purpose: given a list of selections, and the current `heygen-web usage` snapshot, decide whether the batch fits.

Function signature and exact behavior:

```js
// Input: selections is a HeygenSelection[] from the queue file.
// Input: sectionDurations is a Map<section_id, number> (seconds per section, from ffprobe or word list).
// Input: usage is the parsed JSON from `heygen-web usage` stdout (a UsageSnapshot).
//
// Output: { ok: boolean, requestedIvSec: number, poolRemain: number, reason: string | null }
export function checkPool(selections, sectionDurations, usage) {
  // Only Avatar IV selections draw from the pool. III is unlimited.
  // For each IV selection, we don't know the exact seconds until the runner
  // slices. So we UPPER-BOUND by the source section's duration — if all IV
  // selections together fit within seconds_remain, we can start.
  //
  // This is intentionally conservative: sums never exceed reality. The
  // final per-submit meter check (`usage --diff`) is the authoritative gate.
  //
  // Refuse silently downgrading IV to III. If ivSum > poolRemain, we STOP.
  const ivSelections = selections.filter((s) => s.engine === 'heygen4')
  const requestedIvSec = ivSelections.reduce((n, s) => {
    const d = sectionDurations.get(s.section_id) ?? 0
    return n + d
  }, 0)
  const poolRemain = usage?.seconds_remain ?? 0
  const ok = requestedIvSec <= poolRemain
  return {
    ok,
    requestedIvSec,
    poolRemain,
    reason: ok ? null : `Requested ~${requestedIvSec}s of Avatar IV but pool has ${poolRemain}s left. Refusing to submit. Reduce IV selections or wait for next month.`,
  }
}
```

Also `readUsageSnapshot(execFn)` that runs `heygen-web.mjs usage` and returns the parsed stdout JSON. `execFn` is `child_process.execFile` — inject it so tests can pass a fake.

**Verify**: `node --test tooling/cli/pp-heygen-batch/test/pool.test.mjs` — expected: all cases pass.

Test cases in `test/pool.test.mjs`:
1. All III selections + empty pool -> `ok: true`, `requestedIvSec: 0`.
2. One IV selection with section duration 10s and pool 20s -> `ok: true`, `requestedIvSec: 10`.
3. Two IV selections summing to 30s, pool 20s -> `ok: false`, reason mentions 30 and 20.
4. Mixed III + IV where IV alone fits -> `ok: true`.
5. `usage` is `null` -> treat as `seconds_remain: 0`, refuse if any IV present.

### Step 3: `lib/timings.mjs` — word timings

Purpose: for each section wav in the batch, ensure `videos/<key>/audio/<id>.words.json` exists; compute it via `lib/whisper.py` if not; then map a selection's `text` to a `[start_sec, end_sec]` slice on that wav.

Function signatures:

```js
export async function ensureWords(videoKey, sectionId, opts = {}) {
  // opts.wavPath: override — defaults to pipelines/youtube/yt-script/videos/<key>/audio/<id>.wav
  // opts.cachePath: override — defaults to same folder, <id>.words.json
  // opts.pythonBin: override — defaults to python3 in pipelines/venv or system python3.
  // opts.engine: 'mlx' | 'faster' | undefined (auto)
  // Reads existing cache if present. Otherwise:
  //   - Runs lib/whisper.py <wav> <cache> [--engine mlx|faster]
  //   - Parses the JSON output.
  // Returns: { words: [{start, end, word}] , duration_sec }
}

export function rangeForText(text, words) {
  // text: verbatim spoken text of one selection (from selections.json)
  // words: array of {start, end, word} from ensureWords()
  //
  // Strategy: normalize both to lowercase words-only; find the LONGEST
  // matching contiguous run of words. If no exact contiguous match, do a
  // greedy alignment tolerating up to 2 skipped words in the transcript
  // (whisper sometimes drops a filler word). If still no match, throw
  // `RangeNotFound(text)`.
  //
  // Returns: { start_sec, end_sec, matched_words: number }
}
```

Inlined normalization + alignment (the intelligence-heavy bit — do not rewrite):

```js
function normalize(s) {
  return s.toLowerCase().replace(/[^\w\s']/g, '').split(/\s+/).filter(Boolean)
}

export function rangeForText(text, words) {
  const target = normalize(text)
  if (target.length === 0) throw new Error('rangeForText: empty text')
  const transcriptWords = words.map((w) => normalize(w.word)[0] ?? '').filter(Boolean)
  // (Rebuild an index from filtered transcriptWords back to their `words` entries.)
  const indexMap = []
  words.forEach((w, i) => {
    const n = normalize(w.word)[0]
    if (n) indexMap.push(i)
  })
  // Greedy scan: for each start position, count how many target words are
  // hit within a sliding window that tolerates 2 skips.
  const MAX_SKIP = 2
  let best = { hits: 0, startIdx: -1, endIdx: -1 }
  for (let i = 0; i <= transcriptWords.length - target.length; i++) {
    let hits = 0
    let ti = i
    let skips = 0
    for (let ki = 0; ki < target.length && ti < transcriptWords.length; ) {
      if (transcriptWords[ti] === target[ki]) { hits++; ti++; ki++ }
      else if (skips < MAX_SKIP) { skips++; ti++ }
      else break
    }
    if (hits > best.hits) best = { hits, startIdx: i, endIdx: ti - 1 }
    if (best.hits === target.length) break
  }
  if (best.hits < Math.floor(target.length * 0.8)) {
    throw new Error(`rangeForText: text not found in section (matched ${best.hits}/${target.length} words)`)
  }
  const startWord = words[indexMap[best.startIdx]]
  const endWord = words[indexMap[best.endIdx]]
  return { start_sec: startWord.start, end_sec: endWord.end, matched_words: best.hits }
}
```

**Verify**: `node --test tooling/cli/pp-heygen-batch/test/timings.test.mjs` — expected: pass.

Test cases in `test/timings.test.mjs`, all against `test/fixtures/words-s01.json` (a hand-authored word list of ~30 words):
1. Exact match — target text present verbatim in the words list. Assert `start_sec` and `end_sec` come from the first/last matched word.
2. Trailing punctuation ignored — target is `"hello world."`, words `[{word:'hello'},{word:'world'}]`. Assert same match.
3. Case-insensitive match.
4. One-word skip tolerated — target `"the quick brown fox"`, words carry an extra filler between quick and brown. Assert match still succeeds.
5. Too many misses — target `"totally unrelated sentence here"` in a wav about avatars. Assert `Error` with message `not found`.
6. `ensureWords` reads a cached JSON when present without spawning python (mock `execFileSync` to throw if called).

### Step 4: `lib/whisper.py` — the Python side

Create `tooling/cli/pp-heygen-batch/lib/whisper.py`. Two engines. Select via CLI arg `--engine mlx|faster`. Default: try mlx-whisper first, fall back on ImportError.

Reference the template at `pipelines/.claude/skills/hyperframes-helper/templates/transcribe-whisper.py` — mirror the output shape. Emit exactly:

```json
{
  "duration_sec": 12.34,
  "words": [
    {"start": 0.24, "end": 0.51, "word": "Perfect"},
    {"start": 0.55, "end": 0.98, "word": "face."}
  ]
}
```

Include the trailing punctuation on the `word` field — the JS normalizer strips it during matching.

Both engines produce word-level timestamps. Write to the target path with atomic temp-file + os.rename.

**Verify**: `python3 tooling/cli/pp-heygen-batch/lib/whisper.py --help` prints usage; exit 0. `python3 -c "import mlx_whisper" || python3 -c "from faster_whisper import WhisperModel"` — one succeeds on the executor's Mac. If BOTH fail, STOP and report; the tool cannot function without either.

### Step 5: `lib/slice.mjs` — ffmpeg slicing

Purpose: given a source wav and a `[start, end]` range in seconds, write a sliced wav to a target path.

```js
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export function sliceWav(sourceWav, startSec, endSec, outPath, opts = {}) {
  const duration = endSec - startSec
  if (duration <= 0) throw new Error(`sliceWav: non-positive duration ${duration}`)
  mkdirSync(dirname(outPath), { recursive: true })
  const args = [
    '-y',
    '-loglevel', 'error',
    '-i', sourceWav,
    '-ss', String(startSec.toFixed(3)),
    '-t', String(duration.toFixed(3)),
    '-c', 'copy',    // -c copy avoids re-encoding for a wav; keeps sample accuracy adequate for HeyGen
    outPath,
  ]
  const bin = opts.ffmpegBin ?? 'ffmpeg'
  execFileSync(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] })
}

export function probeDurationSec(wav, opts = {}) {
  const bin = opts.ffprobeBin ?? 'ffprobe'
  const args = ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', wav]
  const out = execFileSync(bin, args, { encoding: 'utf8' })
  return parseFloat(out.trim())
}
```

**Verify**: `node --test tooling/cli/pp-heygen-batch/test/slice.test.mjs` — expected: pass.

Test cases (mock `execFileSync` via injectable `ffmpegBin`/`ffprobeBin` — use a shell no-op like `true` and assert the CALL was made with the expected args):
1. `sliceWav('/tmp/s01.wav', 1.0, 3.5, '/tmp/out.wav')` — assert `execFileSync` called with `-ss 1.000` and `-t 2.500`.
2. `sliceWav('/tmp/s01.wav', 5.0, 4.0, ...)` — throws.
3. `probeDurationSec` parses a string output like `"12.345\n"` into `12.345`.

### Step 6: `lib/heygen.mjs` — slug resolution + dispatch

Purpose: turn a HeygenSelection into a completed mp4 on disk.

Functions:

```js
export function resolveSlugToVerb(slug, registryJson) {
  // Returns { verb: 'generate-from-template' | 'generate-from-audio', flag: string, value: string }
  const entry = registryJson[slug]
  if (!entry) throw new Error(`heygen: unknown slug ${slug}`)
  if (entry.template_id) return { verb: 'generate-from-template', flag: '--template', value: slug }
  if (entry.avatar_id)  return { verb: 'generate-from-audio', flag: '--avatar', value: slug }
  throw new Error(`heygen: registry entry for ${slug} has neither template_id nor avatar_id`)
}

export async function submitOne({ selection, wavSlice, slug, engineFlag, heygenWebBin, execFn }) {
  // engineFlag: 'heygen3' | 'heygen4'
  // Calls the CLI, parses stdout JSON for { video_id }.
  const { verb, flag, value } = resolveSlugToVerb(slug, registryJson)
  const args = [heygenWebBin, verb, flag, value, '--audio', wavSlice, '--engine', engineFlag, '--title', selection.id]
  const stdout = execFn('node', args)
  const parsed = JSON.parse(stdout)
  if (!parsed.video_id) throw new Error(`heygen: no video_id in response`)
  return parsed.video_id
}

export async function waitForCompletion(videoId, { heygenWebBin, execFn, pollSec = 15, maxSec = 1800 }) {
  const t0 = Date.now()
  while (true) {
    const stdout = execFn('node', [heygenWebBin, 'status', videoId])
    const status = JSON.parse(stdout)
    if (status.progress >= 100 || status.status === 'COMPLETED' || status.status === 'ready') return status
    if (status.status === 'FAILED' || status.status === 'error') throw new Error(`heygen: submit ${videoId} FAILED`)
    if ((Date.now() - t0) / 1000 > maxSec) throw new Error(`heygen: timeout waiting on ${videoId}`)
    await sleep(pollSec * 1000)
  }
}

export async function downloadOne(videoId, outPath, { heygenWebBin, execFn }) {
  execFn('node', [heygenWebBin, 'download', videoId, '--res', '1080p', '--out', outPath])
}
```

`execFn` is `child_process.execFileSync` in production and a fake in tests.

**Verify**: `node --test tooling/cli/pp-heygen-batch/test/heygen.test.mjs` — expected: pass.

Test cases:
1. `resolveSlugToVerb('girl-1', {girl-1:{template_id:'X'}})` -> `generate-from-template`.
2. `resolveSlugToVerb('some-photo', {'some-photo':{avatar_id:'Y'}})` -> `generate-from-audio`.
3. `resolveSlugToVerb('bogus', {...})` throws.
4. `submitOne` with a fake `execFn` returning `'{"video_id":"abc"}\n'` returns `"abc"`. Asserts the `args` array had `--engine heygen4` when engineFlag was `heygen4`.
5. `waitForCompletion` with a fake `execFn` that returns COMPLETED on the first poll — returns immediately, does not sleep.
6. `waitForCompletion` with a FAILED status — throws.

### Step 7: `lib/drive.mjs` — Drive upload

Purpose: create the batch folder in Drive and upload every mp4 into it.

```js
import { execFileSync } from 'node:child_process'

export function ensureFolderChain(names, { account, execFn, ppDriveBin = 'pp-drive' }) {
  // names: ['HeyGen batches', channel, videoKey, timestamp]
  // Creates each folder inside its parent, returns the deepest folder id.
  let parent = 'root'
  for (const name of names) {
    const stdout = execFn(ppDriveBin, ['ensure-folder', name, '--parent', parent, '--account', account])
    parent = stdout.trim().split(/\s+/)[0]
    if (!parent) throw new Error(`drive: ensure-folder returned no id for "${name}"`)
  }
  return parent
}

export function uploadFile(filePath, folderId, { account, execFn, ppDriveBin = 'pp-drive' }) {
  const stdout = execFn(ppDriveBin, ['upload', filePath, '--parent', folderId, '--overwrite', '--account', account])
  return stdout.trim()
}

export function folderShareLink(folderId) {
  return `https://drive.google.com/drive/folders/${folderId}`
}
```

No unit test file for drive.mjs by itself — the pool test file covers its helper contract via `test/heygen.test.mjs`'s injected fakes. If time allows, add `test/drive.test.mjs` with two cases (chain creation, share link format).

### Step 8: `pp-heygen-batch.mjs` — orchestration

Wire the helpers into one command:

```
pp-heygen-batch <video-key> [--dry-run] [--engine mlx|faster] [--drive-account <email>]
```

Order of operations:

1. Parse args. Load `.env` from repo root only if `pp-drive` needs Google creds via env (check `pp-drive` requirements; if it manages its own auth, do NOT double-load).
2. Read `pipelines/youtube/yt-script/videos/<key>/heygen-selections.json`. Fail with a clear message if absent.
3. Read `pipelines/video-registry/videos.json`, `config/channels.json`, `pipelines/video/heygen/registry.json`.
4. Resolve channel and avatar slug: `channel = channelOf(key, vreg)`, `profile = profileFor(channel, channels)`, `slug = profile.avatar_slug`.
5. For each unique `section_id` in the queue: `probeDurationSec` the wav; build a `sectionDurations` Map.
6. Call `readUsageSnapshot(execFn)` (`heygen-web.mjs usage`). Call `checkPool(selections, sectionDurations, usage)`.
7. If `!checkPool.ok`, print the reason and exit non-zero. STOP condition: do not silently downgrade Avatar IV to III.
8. If `--dry-run`, print a table of `id | section | engine | duration_upper_bound_sec` and pool math, then exit 0.
9. Otherwise, for each selection, in queue order:
   - `ensureWords(key, section_id)` to load or compute words.
   - `rangeForText(sel.text, words)` to get `[start_sec, end_sec]`.
   - Slice: `sliceWav(<source_wav>, start, end, ~/kb-scratch/video/heygen/pp-heygen-batch/<key>/slices/<sel.id>.wav)`.
   - `submitOne(...)` — get `video_id`.
   - `waitForCompletion(video_id)`.
   - `downloadOne(video_id, ~/kb-scratch/video/heygen/pp-heygen-batch/<key>/renders/<key>-<sel.id>.mp4)`.
   - Random 10–30 second sleep.
10. `ensureFolderChain(['HeyGen batches', channel, key, timestamp])`, get `folderId`.
11. For each rendered mp4, `uploadFile(path, folderId)`.
12. Print `folderShareLink(folderId)` as the last stdout line.

Fail-fast: any HeyGen 4xx or the pool cap being hit mid-batch aborts, prints what completed and what did not, and exits non-zero. Nothing on `~/kb-scratch/` is cleaned up on failure — those files stay for debugging.

**Verify**: `pp-heygen-batch --dry-run <a-fixture-key>` — with fixture selections file in a temp `videos/` root, exits 0 and prints the planned table.

### Step 9: Allow-list update

Edit `.claude/allow-main-writes.list`. Append one line:

```
pipelines/video/heygen/RENDERS.md
```

This lets the `heygen-web` CLI's `src/cli/render-log.mjs` continue auto-appending rows without the wall reverting them.

**Verify**: `cat .claude/allow-main-writes.list | grep -c 'RENDERS.md'` returns `1`.

### Step 10: verify-map row

Edit `tooling/cli/pp-land/verify-map.tsv`. Append:

```
tooling/cli/pp-heygen-batch/	bash tooling/cli/pp-heygen-batch/test-pp-heygen-batch.sh
```

TAB-separated. Mirror the neighboring `tooling/cli/pp-work/` row exactly.

**Verify**: `bash tooling/cli/pp-land/test-pp-land.sh` — exit 0.

### Step 11: Test-runner shell script

Write `tooling/cli/pp-heygen-batch/test-pp-heygen-batch.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Run every unit test suite in the folder.
for f in test/*.test.mjs; do
  node --test "$f"
done

# Sanity: CLI wrapper --help returns 0.
./pp-heygen-batch --help > /dev/null

echo "ok: pp-heygen-batch tests passed"
```

`chmod +x`.

**Verify**: `bash tooling/cli/pp-heygen-batch/test-pp-heygen-batch.sh` — exit 0.

### Step 12: Documentation

`tooling/cli/pp-heygen-batch/README.md`:

```markdown
# pp-heygen-batch

Reads `videos/<key>/heygen-selections.json` (produced by the yt-script desk in
avatar mode, plan 266), slices the per-section wavs to each selection's spoken
range, calls HeyGen via `tooling/cli/heygen-web`, downloads mp4s, and uploads
them to Drive.

Runs entirely on the owner's Mac. The HeyGen cookie stays local.

## Usage

    pp-heygen-batch <video-key> [--dry-run] [--engine mlx|faster]

Prints the Drive folder share link on the last line of stdout.

## Pool safety

Refuses to start if the sum of Avatar IV seconds requested exceeds the
`/1200` monthly pool remaining (read from `heygen-web usage`). Never
downgrades IV to III to fit — it stops.

## Dependencies

- `node`, `python3` with `mlx-whisper` or `faster-whisper`, `ffmpeg`, `ffprobe`.
- `tooling/cli/heygen-web/heygen-web.mjs` on the same repo checkout.
- `pp-drive` in `PATH` and authenticated for the target Google account
  (`kushalbakliwal25@gmail.com` by default).
```

`tooling/cli/pp-heygen-batch/CLAUDE.md`:

```markdown
# pp-heygen-batch — operate-doc

Runner half of the HeyGen batch pipeline (plans 266 + 267). Reads the desk's
queue file and produces avatar clips.

## Where things live

- Queue in: `pipelines/youtube/yt-script/videos/<key>/heygen-selections.json`
- Slices out: `~/kb-scratch/video/heygen/pp-heygen-batch/<key>/slices/<sel.id>.wav`
- Renders out: `~/kb-scratch/video/heygen/pp-heygen-batch/<key>/renders/<key>-<sel.id>.mp4`
- Word timings cache: `pipelines/youtube/yt-script/videos/<key>/audio/<id>.words.json`
- Drive: `HeyGen batches / <channel-slug> / <video-key> / <yyyy-mm-dd-hh-mm> /`

## Hard rules

- Never downgrade IV to III to fit the pool. STOP instead.
- Never disable the heygen-web meter check. The `⚠️NOT-free` verdict on an IV
  submit is the audit trail.
- Never edit `pipelines/video/heygen/registry.json` or `config/channels.json`
  as a side effect of a run.

## Not this tool's job

- The selection UI — that is `apps/yt-script-desk`'s avatar mode.
- The auto trigger — a freelancer runs the desk; the owner runs this CLI.
- fal-lipsync — parked by owner.
```

Append to `pipelines/video/heygen/CLAUDE.md`, at the end of "How to generate":

```markdown
- **Batch avatar clips for one video from selected script ranges:**
  `tooling/cli/pp-heygen-batch <video-key>`. Reads
  `videos/<key>/heygen-selections.json` (produced by the yt-script desk's
  avatar mode, plans 266/267), slices the section wavs, dispatches to
  heygen-web per selection, and uploads mp4s to Drive. Refuses if the sum of
  Avatar IV seconds requested exceeds the `/1200` monthly pool remaining.
```

**Verify**: `grep -c 'pp-heygen-batch' pipelines/video/heygen/CLAUDE.md` returns at least `1`.

## Test plan

- All logic under `lib/*.mjs` is tested with `node --test` against JSON fixtures. No live HeyGen or Drive calls.
- Live smoke test is manual, off the executor's path: the owner runs `pp-heygen-batch <a-real-key>` on a video with one small IV selection and confirms a Drive link.
- No changes to `pipelines/`. No changes to the desk (plan 266 owns those).

## Done criteria

- [ ] `bash tooling/cli/pp-heygen-batch/test-pp-heygen-batch.sh` exits 0.
- [ ] All four `test/*.test.mjs` suites pass with the fixtures in `test/fixtures/`.
- [ ] `tooling/cli/pp-land/verify-map.tsv` includes the row for this tool.
- [ ] `.claude/allow-main-writes.list` includes `pipelines/video/heygen/RENDERS.md`.
- [ ] `pipelines/video/heygen/CLAUDE.md` has the "Batch avatar clips" bullet.
- [ ] `README.md` and `CLAUDE.md` exist in the tool folder.
- [ ] Commit `feat(pp-heygen-batch): voiceover slice + heygen-web dispatch + drive upload` on branch `work/plan-267-pp-heygen-batch-runner`.
- [ ] Manual smoke NOT required for merge (this is a real-cost operation; owner will smoke it after landing).

## STOP conditions

- **A test wants to be relaxed to pass.** If the pool refuses a batch and a test needs to weaken the refusal to `warn instead of error`, STOP — the strict refusal is by design (per Step 2.5 decisions).
- **A live HeyGen or Drive call in a test.** Every test must run against a fixture or a stubbed `execFn`. No hitting the real APIs from a test — those calls cost credits or hit Drive quotas.
- **The `heygen-web usage` JSON shape has changed.** If `seconds_remain` is not a top-level field on the stdout JSON, STOP and report — the CLI's shape has drifted since 2026-09-04. Do NOT invent a new field name.
- **Silent Avatar IV -> III downgrade.** If any code path decides to change a selection's engine from IV to III to fit the pool, STOP. That decision belongs to the editor at selection time, not the runner.
- **`mlx-whisper` and `faster-whisper` both missing on the machine.** STOP; the runner cannot function.
- **`ffmpeg` or `ffprobe` missing.** STOP.
- **`rangeForText` can't find a selection's text in the whisper words.** Log the mismatch, skip that one selection with a clear message, continue with the rest — a partial batch is better than none. But if MORE than half the selections fail this way, STOP: something is wrong with the alignment or the queue file's `text` field.
- **`heygen-web auth-check` returns non-zero at start.** STOP — the cookie is dead. The runner is not authorized to recapture it.

## Maintenance notes

- If Avatar IV pricing or the pool size changes on HeyGen's side, the `usage` snapshot's field names may shift. `lib/pool.mjs` is the one place to touch — `checkPool` reads `seconds_remain` by name.
- If a future selection lets the editor pick multiple avatar characters per selection, `resolveSlugToVerb` becomes a per-selection call, not per-run. The chain `channel -> slug` still holds at the run level as the default.
- Word-timings cache is keyed by section id and stays in the video folder (`videos/<key>/audio/*.words.json`). Deleting the cache is safe — the next run recomputes.
- If the runner ever needs to be triggered from the desk without the owner running it manually, the Step 2.5 "Manual now, auto later" decision applies: build a small ntfy/webhook listener as a separate tool, do not embed one here.

