---
executor: agy
model:
test_cmd: bash pipelines/video/visuals-flow/scripts/check.sh
ui:
deploy:
needs: []
---

# Plan 102: assembly speed pass 2 — parallel encodes, segment cache, libass captions, bare draft (GFX-17)

## Summary

- **Problem statement**: The effects layer took the 32-min test-01 draft assembly from 4m23s back to 15+ min: segments encode sequentially while videotoolbox leaves the CPU idle, every re-draft re-encodes ~40 unchanged segments, and the captions module feeds one looped PNG input per caption chunk into each screen segment's filter graph (120 overlay nodes on the worst segment).
- **Goals**: (1) concurrent segment encodes (`--jobs`, default 3); (2) content-keyed segment cache so re-drafts only encode changed segments; (3) captions burned via one `subtitles=` (libass) filter with ASS color tags replacing the PNG-per-chunk pipeline (keyword highlight preserved); (4) `--bare` draft tier (captions+drift off) for placement checks.
- **Executor proposed**: agy (Gemini 3.1 Pro High) — standard, fully inlined.
- **Done criteria** (terse): check.sh green; warm re-draft ≤ 1/3 of cold time on test-01; `--jobs 1` and `--jobs 3` produce identical concat lists; ASS captions show the keyword color in a rendered-pixel probe.
- **Stop conditions** (terse): ffmpeg lacks the `subtitles` filter → stop; no filter-chain changes outside the captions swap.
- **Test / verification for success**: unit tests (pool ordering, cache key, ASS generation) + timed cold/warm benchmark + pixel probe.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6f4ccdf..HEAD -- pipelines/video/visuals-flow/lib/assemble.mjs pipelines/video/visuals-flow/lib/effects/captions.mjs pipelines/video/visuals-flow/lib/captions.mjs pipelines/video/visuals-flow/lib/caption-render.py pipelines/video/visuals-flow/steps/090-assemble-run`

## Status

- **Priority**: P1
- **Effort**: M-L
- **Risk**: MED (encode path, but no visual-look changes except caption rasterization engine)
- **Depends on**: none (095–101 landed; plan against `6f4ccdf`)
- **Category**: dx
- **Difficulty**: standard
- **Planned at**: commit `6f4ccdf`, 2026-07-19

## Why this matters

The owner's iteration loop is draft → watch → tweak an effect → re-draft. At
15 min per draft that loop is dead. Parallelism + caching turn re-drafts into
~1–2 min; the libass swap removes the dominant per-segment filter cost and
keeps 096's keyword highlighting. Everything here also transfers unchanged to
any future remote runner (GFX-18).

## Current state

- `lib/assemble.mjs` (~line 385–545): a serial `for` loop builds each
  segment's ffmpeg args and runs `spawnSync('ffmpeg', …)`; whip/flash boundary
  encodes (`whipMod.boundarySegments` → `extraSegments`) run inline in the
  same loop; `concatLines` accumulates `.ts` names in order; after the loop
  the concat + vo.mp3 mux runs. Temp dir: `videos/<slug>/assembly-tmp/`.
- CLI: `parseArgs` (~line 239) already has per-effect flags
  (`--captions on|off`, `--drift on|off`, `--beats`, `--transitions`,
  `--effects`, `--bubble`), `--draft`, `--encoder`, `--keep-temp`, `--force`.
- Captions today: `planCaptions(words)` (lib/captions.mjs) emits chunks with
  `words: [{text, hl}]` (plan 096); assemble spawns `lib/caption-render.py`
  (PIL) to rasterize `cap-<i>.png` per chunk (~line 355–380); the
  `lib/effects/captions.mjs` module's `contribute` adds ONE looped `-i` PNG
  input + one overlay node per chunk intersecting the segment (worst observed:
  120 inputs on a 202s screen segment).
- Caption look constants (keep identical): centered, `yFrac 0.87` (bottom
  anchor at `round(h*0.87) - text_height`), font px scaled `fontPx * h/1080`
  (base 44), white text, black outline (`stroke = max(2, fontPx//16)`),
  Helvetica, accent `#FB923C` for `hl` words.
- Encoders: `h264_videotoolbox` (HW, low CPU use — parallel-friendly) with
  x264 fallback (`detectEncoder`). Draft = 720p / 4M.
- Timings (M2 Pro, 32-min test-01): pre-effects draft 4m23s; with effects
  15+ min.
- `.gitignore` in `pipelines/video/visuals-flow/` ignores per-video media;
  confirm `assembly-tmp/` is ignored and add `assembly-cache/` beside it.
- Tests live per-module (`lib/*.test.mjs`), run via `scripts/check.sh`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Flow gate | `bash pipelines/video/visuals-flow/scripts/check.sh` | exit 0 |
| libass probe | `ffmpeg -hide_banner -filters 2>/dev/null | /usr/bin/grep -c " subtitles "` | ≥ 1 |
| Cold benchmark | `cd pipelines/video/visuals-flow && rm -rf videos/test-01/assembly-cache && time bash steps/090-assemble-run/run.sh test-01 --draft` | completes; note wall time |
| Warm benchmark | `cd pipelines/video/visuals-flow && time bash steps/090-assemble-run/run.sh test-01 --draft` | ≤ 1/3 of cold wall time |

## Scope

**In scope**:
- `pipelines/video/visuals-flow/lib/assemble.mjs`
- `pipelines/video/visuals-flow/lib/effects/captions.mjs`
- `pipelines/video/visuals-flow/lib/captions.mjs` (ASS text-escaping helper only; chunking/marking untouched)
- `pipelines/video/visuals-flow/lib/caption-render.py` (DELETED)
- `pipelines/video/visuals-flow/lib/assemble.test.mjs`, `lib/captions.test.mjs` (new/updated cases)
- `pipelines/video/visuals-flow/.gitignore` (assembly-cache)
- `pipelines/video/visuals-flow/steps/090-assemble-run/run.sh` + `README.md` (flag passthrough + usage)

**Out of scope**:
- Any filter-chain change other than the captions swap (whip/flash/drift/beat/bubble chains byte-identical).
- Card renders (050), board, cue/shot surfaces, remote/VPS execution (GFX-18).

## Git workflow

- Branch: `advisor/102-assembly-speed-pass-2`
- Commit per step: `feat(visuals-flow): <step>` / `perf(visuals-flow): <step>` — no AI footers. Do NOT push.

## Steps

### Step 1: job queue + worker pool

Refactor the segment loop into two phases:

1. **Plan phase** (pure): iterate segments exactly as today, but instead of
   `spawnSync`, push `{ outFile, argsAfterY, label }` onto `jobs[]` (one job
   per segment AND per whip/flash extraSegment; `concatLines` is fully built
   here, in order, unchanged).
2. **Execute phase**: run the pool —

```js
async function runPool(jobs, jobsN) {
  let i = 0; let failed = null;
  async function worker() {
    while (i < jobs.length && !failed) {
      const job = jobs[i++];
      const res = await new Promise((resolve) => {
        const p = spawn('ffmpeg', job.argsAfterY, { stdio: ['ignore', 'ignore', 'pipe'] });
        let err = ''; p.stderr.on('data', (d) => { err += d; });
        p.on('close', (code) => resolve({ code, err }));
      });
      if (res.code !== 0) failed = { job, err: res.err };
    }
  }
  await Promise.all(Array.from({ length: jobsN }, worker));
  if (failed) { console.error(`ffmpeg failed for ${failed.job.label}\n${failed.err.slice(-2000)}`); process.exit(1); }
}
```

CLI: `--jobs N` (integer 1–8, default 3); `parseArgs` addition mirrors the
existing flag style. `runAssembly` accepts `jobs = 3`. Keep `spawnSync` ONLY
for the final concat/mux and the caption/probe one-offs.

**Verify**: `bash pipelines/video/visuals-flow/scripts/check.sh` → exit 0; then `cd pipelines/video/visuals-flow && node lib/assemble.mjs videos/test-01 --draft --jobs 1 --keep-temp` and `--jobs 3 --keep-temp` → the two runs' `assembly-tmp/concat.txt` are byte-identical (`diff` exits 0).

### Step 2: segment cache

1. `cacheDir = path.join(workdir, 'assembly-cache')`; add `assembly-cache/`
   to the visuals-flow `.gitignore` line group that ignores `assembly-tmp/`.
2. Cache key per job, computed in the plan phase:

```js
import { createHash } from 'node:crypto';
function jobKey(args) {
  const h = createHash('sha1');
  for (const a of args) {
    h.update(a); h.update(' ');
    if (fs.existsSync(a) && fs.statSync(a).isFile()) {
      const st = fs.statSync(a);
      h.update(`${st.size}:${Math.floor(st.mtimeMs)}`);
    }
  }
  return h.digest('hex');
}
```

   (Every input path, seek time, filter chain, and encoder arg is IN `args`,
   so the key covers them; file size+mtime covers content drift of sources,
   renders, caption .ass files, and corner clips.)
3. Execute phase: on hit (`assembly-cache/<key>.ts` exists) copy it to the
   job's tmp outFile and skip ffmpeg; on miss encode then copy the result
   into the cache. At run start prune cache files older than 14 days. Log
   one line: `segments: <hits> cached, <misses> encoded (jobs=<N>)`.
4. `--no-cache` flag to bypass (used by the cold benchmark).

**Verify**: run the draft twice; second run's log shows `0 encoded` (all
cached) and wall time ≤ 1/3 of the first; `git status --short` shows no
tracked changes from cache dirs.

### Step 3: libass captions (replaces the PNG pipeline)

1. Probe once at assemble start when captions are on:
   `ffmpeg -hide_banner -filters` output must contain the `subtitles` filter;
   otherwise exit with a clear error (STOP condition — do not silently skip).
2. In assemble's caption block (~line 355–380): replace the python spawn with
   ASS generation — for each SEGMENT that intersects caption chunks, write
   `assembly-tmp/captions/seg-<id>.ass` with segment-local times
   (same arithmetic as the current effects/captions.mjs lines 32–39,
   including `startTrim`). ASS skeleton (inline verbatim):

```
[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Helvetica,{FONTPX},&H00FFFFFF,&H00000000,&H00000000,1,{OUTLINE},0,2,40,40,{MARGINV},1

[Events]
Format: Layer, Start, End, Style, Text
Dialogue: 0,{start},{end},Cap,,0,0,0,,{text}
```

   with `FONTPX = round(44 * h/1080)`, `OUTLINE = max(2, Math.floor(FONTPX/16))`,
   `MARGINV = h - Math.round(h * 0.87)` (bottom margin ≈ the current yFrac
   anchor), times as `H:MM:SS.cc`. Per-word text: hl words wrapped as
   `{\1c&H3C92FB&}word{\1c&HFFFFFF&}` (ASS colors are BGR: `#FB923C` →
   `&H3C92FB&`). Escape `{`, `}`, `\` and newlines in caption text (add a
   small exported `assEscape(text)` in `lib/captions.mjs` so it's unit-testable).
3. `lib/effects/captions.mjs` `contribute`: replace the inputs/overlay-chain
   with a single vf fragment
   `subtitles=filename='<escaped abs path>'` appended to the segment's chain
   (colons and quotes in the path must be escaped per ffmpeg filter syntax:
   `\\:` for `:`). No `-loop` inputs remain.
4. Delete `lib/caption-render.py`. Update `lib/captions.test.mjs`: replace the
   PNG pixel test with (a) `assEscape` cases, (b) an ASS-generation fixture
   asserting the Dialogue lines, times, and the `&H3C92FB&` tag around the hl
   word; keep (c) a rendered-pixel probe: 2s `color=c=black` clip + the
   fixture .ass via `subtitles=`, extract 1 frame, assert >50 pixels within
   tolerance of (251,146,60) — same PIL/one-liner technique the old test used,
   file kept inside the repo and deleted.

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/captions.test.mjs` → exit 0; `/usr/bin/grep -rn "caption-render" lib/ steps/` → no hits.

### Step 4: --bare tier + docs + benchmark

1. `--bare` flag: shorthand that forces `captions='off'`, `drift='off'`
   (error if combined with explicit `--captions on`/`--drift on`). Pass
   through `steps/090-assemble-run/run.sh` like `--draft` is.
2. `steps/090-assemble-run/README.md`: usage table gains `--jobs`,
   `--no-cache`, `--bare`; one paragraph on the cache (where it lives, how to
   bust it).
3. Benchmark (record numbers in the PR body): cold draft (`--no-cache`),
   warm draft, and `--bare` draft on test-01 — wall times + the
   cached/encoded log line.

**Verify**: warm ≤ 1/3 cold; `--bare` < warm; all three commands exit 0.

## Test plan

Unit: pool ordering (concat parity `--jobs 1` vs `--jobs 3`), `jobKey`
stability + sensitivity (same args → same key; touched source mtime → new
key), `assEscape`, ASS fixture lines, rendered-pixel accent probe.
Integration: check.sh; cold/warm/bare benchmarks on test-01 with numbers in
the PR. Visual: extract one frame at a caption moment from the warm draft and
attach it (caption look must match the old PNG look: centered, bottom,
white/orange, outlined).

## Done criteria

- [ ] check.sh exit 0
- [ ] Concat parity: `--jobs 1` vs `--jobs 3` concat.txt byte-identical
- [ ] Warm re-draft ≤ 1/3 cold on test-01 (numbers in PR)
- [ ] `caption-render.py` gone; no PNG caption path remains
- [ ] Pixel probe: accent-colored pixels present via `subtitles=` render
- [ ] Caption frame attached; look matches the previous style (position/size/outline/accent)
- [ ] `.gitignore` covers `assembly-cache/`; no cache/tmp files tracked

## STOP conditions

- `subtitles` filter absent from the installed ffmpeg — stop and report (owner installs libass-enabled ffmpeg; do not vendor one).
- Any need to alter non-caption filter chains to make the pool work — stop.
- Concat parity fails (ordering bug) — stop after 2 fix attempts with the diff.
- Benchmarks must run with no other heavy processes; if another assembly is running, stop and report.

## Maintenance notes

- The cache key hashes the FULL ffmpeg args; any constant change in an effect module naturally busts affected segments only — that's the designed behavior, don't add manual versioning.
- GFX-18 (VPS async assemble) reuses this code path unchanged; `--jobs` should default from an env (`ASSEMBLE_JOBS`) there — left out here deliberately.
- Reference timings to beat live in this plan's Current state block.
