---
executor: agy
model:
test_cmd: bash pipelines/video/visuals-flow/scripts/check.sh
ui: true
deploy:
needs: [land after 089, before 091 — all three rewrite the runAssembly encode loop]
---

# Plan 090: Burned-in captions on screen segments (step 090 assemble)

## Summary

- **Problem statement**: The reference video (owner-supplied, 2026-07-19) burns a single small caption line onto every screen-recording stretch; our screen segments have no captions even though word-level timestamps exist for the whole VO.
- **Goals**:
  - `lib/captions.mjs`: `planCaptions(words, opts)` — deterministic word grouping into caption chunks (≤6 words / ≤32 chars, split at ≥0.6s gaps), unit-tested.
  - `lib/caption-render.py` (system `python3` + Pillow — verified installed): renders one transparent PNG strip per chunk (white text, Helvetica, subtle shadow).
  - `runAssembly` overlays chunk PNGs on SCREEN segments only, gated by `enable='between(t,…)'`; `--captions on|off`, default `on`.
- **Executor proposed**: agy (Gemini 3.1 Pro High) — fully inlined; verifier inspects a captioned frame (render+inspect gate).
- **Done criteria** (terse): `check.sh` exit 0 incl. new tests; integration proves caption pixels present on a screen segment and absent on avatar/graphic segments; `--captions off` structurally identical to pre-plan.
- **Stop conditions** (terse): `python3 -c "import PIL"` fails; changes needed outside in-scope files.
- **Test / verification for success**: planner unit tests + PNG-existence + pixel-diff integration assertion; visual inspection.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat cd858ab..HEAD -- pipelines/video/visuals-flow/lib pipelines/video/visuals-flow/scripts/check.sh` — plan 089's assemble changes WILL appear (it lands first); anything else is drift.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: 089 landed
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `cd858ab`, 2026-07-19

## Why this matters

Captions on screen recordings are baseline grammar in the reference channel (single line, bottom-center, present through virtually all screen segments) and a known retention/accessibility win. The transcript already carries word timestamps, so this is deterministic and costs zero LLM tokens. Constraint discovered 2026-07-19: this machine's ffmpeg 8.1.1 is built WITHOUT libfreetype/libass — `drawtext` and `subtitles` filters do not exist — so text is rendered to PNGs by Pillow (available in system `python3`; `/System/Library/Fonts/Helvetica.ttc` exists) and composited with plain `overlay`, which needs no text support.

## Current state (verified at cd858ab, `pipelines/video/visuals-flow/`)

- `lib/assemble.mjs` — after 089: per-segment encode loop; screen segments encode with `seekArgs = ['-ss', String(seg.start + screenOffset + startTrim), '-to', …]`; segments with overlays/flash build a `-filter_complex` chain where extra files are added as inputs (`inputs.push('-i', o.file)`) and composited with `overlay=eof_action=pass:enable='between(t,at,until)'` in segment-local time (see the `L` loop). Caption overlays reuse exactly this pattern.
- `parseArgs` (line ~223) — flag style to copy (`--transitions`/`--beats` validation).
- Environment (verified 2026-07-19): `ffmpeg -filters` has NO `drawtext`, NO `subtitles`; `python3 -c "import PIL"` succeeds; `/System/Library/Fonts/Helvetica.ttc` exists. The `pipelines/venv` does NOT exist on this machine — use system `python3`.
- Test conventions: `lib/feedback-status.test.mjs` for a pure-function suite; `lib/assemble.test.mjs` for lavfi integration. `scripts/check.sh` holds the explicit `node --test` file list — append the new test file.

## Design (decided — do not re-litigate)

- Constants in `lib/captions.mjs`: `CAP_MAX_WORDS = 6`, `CAP_MAX_CHARS = 32`, `CAP_GAP_SPLIT = 0.6`, `CAP_TAIL = 0.4` (seconds a chunk lingers after its last word when the next chunk hasn't started), `CAP_FONT_PX = 44` (at 1080p; scale by `h/1080`), `CAP_Y_FRAC = 0.87`.
- **planCaptions(words, opts)** (pure, exported): walk words in order; start a new chunk when adding a word would exceed `CAP_MAX_WORDS`/`CAP_MAX_CHARS`, or the gap to the previous word ≥ `CAP_GAP_SPLIT`. Chunk `start` = first word start; `end` = min(last word end + `CAP_TAIL`, next chunk start). Returns `[{i, text, start, end}]`.
- **caption-render.py** (stdin JSON `{outDir, width, fontPx, chunks:[{i,text}]}`): for each chunk render `cap-<i>.png` — RGBA, transparent, tight height (~2.2×fontPx), text centered horizontally in `width` px; white fill, black stroke `max(2, fontPx//16)` px (Pillow `stroke_width`/`stroke_fill`), font `ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', fontPx)`. Prints the count rendered. No network, no deps beyond Pillow.
- **Wiring in runAssembly** (when `captions === 'on'`): once per run, `planCaptions(words)` → filter to chunks intersecting any screen segment → spawnSync `python3 lib/caption-render.py` writing into `assembly-tmp/captions/` at `width = Math.round(w*0.86)`, `fontPx = Math.round(44*h/1080)`. Then, per SCREEN segment, add each intersecting chunk as an extra input composited AFTER existing overlays/flash steps: `overlay=(main_w-overlay_w)/2:${Math.round(h*CAP_Y_FRAC)}-overlay_h:enable='between(t,${chunk.start - seg.start - startTrim},${chunk.end - seg.start - startTrim})'` (clamp negative starts to 0; drop chunks whose window ends ≤0 or starts ≥ encoded dur). Avatar and graphic segments get NO captions (matches the reference).
- **Pre-flight** in `main()` when captions on: `spawnSync('python3', ['-c', 'import PIL'])` — non-zero → exit 1 with `captions need Pillow: python3 -m pip install pillow (or run with --captions off)`.
- `--captions on|off` default `on`, validated like `--transitions`. `assembly.md` header sentence notes `Captions burned on screen segments.` when on.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Test gate (boss merge gate) | `bash scripts/check.sh` (from `pipelines/video/visuals-flow/`) | exit 0, `visuals-flow check OK` |
| Pillow present | `python3 -c "import PIL; print('ok')"` | `ok` |
| Single file | `node --test lib/captions.test.mjs lib/assemble.test.mjs` | all pass |
| Draft render (verifier only) | `bash steps/090-assemble-run/run.sh test-01 --draft` | final-draft.mp4 with captions |

## Scope

**In scope**: `pipelines/video/visuals-flow/lib/captions.mjs` (new), `lib/caption-render.py` (new), `lib/captions.test.mjs` (new), `lib/assemble.mjs`, `lib/assemble.test.mjs`, `scripts/check.sh` (append test file), `steps/090-assemble-run/README.md` (one paragraph).

**Out of scope**: transcript generation, `lib/transcript-text.mjs`, the board, avatar/graphic segment styling, any ffmpeg reinstall (the Pillow route exists precisely to avoid it).

## Git workflow

- Branch: `boss/090-assemble-burned-captions`
- Commit per step, conventional messages, no AI footers. Do NOT push.

## Steps

### Step 1: planCaptions + unit tests

`lib/captions.mjs` + `lib/captions.test.mjs` (conventions of `feedback-status.test.mjs`): chunking by word cap, char cap, gap split; `CAP_TAIL` vs next-chunk clamp; empty words → `[]`. Append the test file to `scripts/check.sh`.

**Verify**: `node --test lib/captions.test.mjs` → all pass.

### Step 2: caption-render.py

As designed; test by invoking it directly with 2 chunks into a temp dir and assert both PNGs exist and are non-empty (do this inside `captions.test.mjs` via `spawnSync`, skipped when `python3 -c "import PIL"` fails — mirror the ffmpeg skip pattern in `assemble.test.mjs:96`).

**Verify**: `node --test lib/captions.test.mjs` → all pass (render case not skipped on this machine).

### Step 3: wire into runAssembly + flag + README

Per Design. Integration test additions to `assemble.test.mjs`: with a words fixture placing one chunk inside the screen segment, (a) captions PNG dir non-empty; (b) extract a frame from the captioned window of the final output (`ffmpeg -ss <t> -frames:v 1`) and one from an uncaptioned avatar window, assert the caption-region crops differ (`ffprobe`/`signalstats` mean luma of the bottom strip differs by ≥2) — pixel-level proof without text rendering in ffmpeg; (c) `--captions off` → no captions dir, segment count unchanged.

**Verify**: `bash scripts/check.sh` → exit 0, `visuals-flow check OK`.

## Test plan

Steps 1–3 as above; everything deterministic and offline.

## Done criteria

- [ ] `bash scripts/check.sh` exits 0 (new suite included in the gate).
- [ ] Integration: caption pixels present on screen-segment frames, absent on avatar frames; `--captions off` regression holds; duration/resolution/audio probes unchanged.
- [ ] `plans/README.md` row 090 updated to DONE.

## STOP conditions

- Pillow import fails on this machine — stop and report (do NOT pip-install anything yourself).
- Helvetica.ttc missing or Pillow cannot load it — stop and report the font error; do not substitute a downloaded font.
- Caption overlays push any segment encode over ffmpeg's input limits or fail on `videotoolbox` — stop after 5 fix attempts.

## Maintenance notes

- If ffmpeg is ever reinstalled with libfreetype/libass, `drawtext`/ASS subtitles can replace the PNG route — `planCaptions` output maps 1:1 onto ASS events, so only the wiring changes.
- Caption look constants live at the top of `captions.mjs`; the reference look is: single line, small, bottom-center, white with dark edge, no background box.
- Chunks are computed from the full transcript once — a future corner-bubble plan must not cover the caption strip (bubble is top-right; captions bottom-center — compatible).
