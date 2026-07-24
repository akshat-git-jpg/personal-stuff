---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow-2 && bash scripts/check.sh
ui:
deploy:
needs: [after 135-vf2-coverage-density-headmodes]
---

# Plan 139: v2 sound + mix stage (semantic SFX, ducked music, −14 LUFS, audio lanes)

## Summary

- **Problem statement**: v1 has ZERO audio design — the only audio is `vo.mp3` muxed as the single track. No SFX on reveals/transitions, no music, no loudness master (spec delta E; Loop Studio steal-list #2).
- **Goals**: (1) a synthesized starter SFX kit + drop-in replacement contract; (2) `sfx-plan.mjs` — semantic placement from EXACT event times in resolved.json/effects.json (no frame-diff detection needed) → `sound.json` with its own approval gate; (3) `build-mix.mjs` — VO chain + optional ducked music + SFX bus → `master.wav` at −14 LUFS with a frame-exact A/V check; (4) assemble uses master.wav when present; (5) FCPXML export gains VO / music / SFX lanes.
- **Executor proposed**: agy (Gemini 3.1 Pro High) — owner directive; fully-inlined filtergraphs below.
- **Done criteria**: check.sh green incl. 3 new test files; a lavfi end-to-end mix smoke passes with measured loudness within ±1 LU of −14.
- **Stop conditions**: ffmpeg missing sidechaincompress/loudnorm/rubberband-free pitch chain; any v1/card-library edit.
- **Test / verification for success**: deterministic plan fixtures + one real ffmpeg smoke on synthesized inputs (no committed media).
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. Do NOT
> edit `plans/README.md`; report status in your run summary.
>
> **Drift check (run first)**: `git diff --stat 3bbaa6c..HEAD -- pipelines/video/visuals-flow-2`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: 134; 135 (video.json `music` field; extended durations); independent of 136–138
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `3bbaa6c`, 2026-07-24

## Why this matters

Loop Studio's sound stage is a whole missing layer in v1, and its design is directly portable: sample-based SFX placed by MEANING (timbre per event kind, pitch rising across an accumulation run, steady ticks for counters, a low drone bed), music sidechain-ducked under the voice, everything mastered to −14 LUFS with frame-exact A/V. Their samples were licensed and never shipped — the placement logic is the IP, reimplemented here. One structural improvement over their approach: they frame-diff the rendered video to FIND events; v2 already knows every event's exact time from `resolved.json` (cue starts + `beats[].at`) and `effects.json` (transition/punch instances) — zero detection cost, frame-accurate placement. Owner decisions: music beds are downloaded/royalty-free and swappable later on the timeline; the primary deliverable is the layered FCPXML, so audio must land as LANES, not only a baked master.

## Current state (paths in `pipelines/video/visuals-flow-2/`)

- `resolved.json`: `{video, offset, resolved:[{id, card, placement, start, duration, variables:{..., beats?:[{...,at}]}}]}` — `start` absolute seconds, `beats[].at` relative to start. Cue + beat absolute times = the reveal-event list.
- `effects.json`: `{video, approved, instances:[{id, type, at?/start?/end?, ...}]}` — whip transitions carry `at`; beats (punch-ins) carry `at`; see `lib/effects/*.mjs` `plan()` outputs.
- `segments.json`: demo vs narration spans. `video.json` (plan 135): `music` field = mood string, empty = no music.
- Assemble muxes `vo.mp3` as the sole audio track (`lib/assemble.mjs`; locate with `grep -n "vo.mp3" lib/assemble.mjs`). `lib/export-timeline.mjs` writes the layered FCPXML with VO as the master audio track.
- Approval-gate pattern to copy: `lib/effects-plan.mjs` — regenerates defaults, preserves `enabled` overrides, resets `approved` when canonical content changes.
- kb-scratch root for generated media (never in git): `~/kb-scratch/video/visuals-flow-2/<slug>/`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Gate | `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` | exit 0 |
| ffmpeg has the filters | `ffmpeg -hide_banner -filters 2>/dev/null \| grep -cE "sidechaincompress\|loudnorm\|adelay\|atempo"` | `4` |
| Loudness measure | `ffmpeg -i <wav> -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=summary -f null - 2>&1 \| grep "Input Integrated"` | prints a LUFS number |

## Scope

**In scope** (all in `pipelines/video/visuals-flow-2/`):
- `assets/sfx/` (generated kit + README), `assets/music/README.md`, `scripts/gen-sfx-kit.sh` (new)
- `lib/sound/sfx-plan.mjs`, `lib/sound/build-mix.mjs`, `lib/sound/sound-constants.mjs` (all new) + tests
- `lib/assemble.mjs` (master.wav preference), `lib/export-timeline.mjs` (audio lanes) + tests
- `run.sh` (verbs `sound`, `mix`), `scripts/check.sh`, `PIPELINE.md`, `EFFECTS.md` cross-reference
- `.gitignore` (ignore `assets/sfx/*.wav` — generated; keep READMEs + the gen script tracked)

**Out of scope**: v1, card-library, board playback of the sound lane (plan 140), any network fetching of samples/music (kit is synthesized; real samples are owner drop-ins).

## Git workflow

- Branch: `advisor/139-vf2-sound-mix`. Commit per step. Do NOT push.

## Steps

### Step 1: synthesized starter kit + drop-in contract

`scripts/gen-sfx-kit.sh` — generates 12 wavs into `assets/sfx/` with ffmpeg only (48kHz mono, short, SUBTLE — peak ≤ 0.35). Exact recipes (one `ffmpeg -y -f lavfi ...` per file; tune only envelope numbers if clipping):

| file | recipe core |
|---|---|
| `tick.wav` | `sine=frequency=1800:duration=0.05`, `afade=t=out:st=0.01:d=0.04` |
| `pop.wav` | `sine=frequency=520:duration=0.09`, pitch env via `asetrate=48000*1.4,aresample=48000`, fade out 0.06 |
| `thock.wav` | `sine=frequency=180:duration=0.12` + `anoisesrc=d=0.03:c=pink:a=0.08` mixed, fade 0.1 |
| `whoosh-up.wav` | `anoisesrc=d=0.35:c=pink:a=0.25`, `highpass=f=400,lowpass=f=6000`, `afade=t=in:d=0.15,afade=t=out:st=0.2:d=0.15` |
| `whoosh-down.wav` | same, `areverse` |
| `riser.wav` | `sine=frequency=220:duration=0.8` with `asetrate` ramp trick: generate at 220 then `atempo=0.9` + fade-in 0.6 |
| `success.wav` | two sines 660+990 Hz 0.25s mixed, fade out 0.2 |
| `blip.wav` | `sine=frequency=1200:duration=0.06`, fade 0.05 |
| `impact.wav` | `anoisesrc=d=0.15:c=brown:a=0.5`, `lowpass=f=200`, fade 0.12 |
| `swipe.wav` | `anoisesrc=d=0.2:c=white:a=0.15`, `bandpass=f=2500:w=1200`, fades |
| `drone_low.wav` | `sine=frequency=55:duration=8`, `volume=0.06`, loopable (fade in/out 0.5 each) |
| `tear.wav` | `anoisesrc=d=0.18:c=white:a=0.3`, `highpass=f=1000`, sharp 0.02 fade-in |

`assets/sfx/README.md`: the filenames ARE the contract — drop in real samples with the same names to upgrade (e.g. a purchased kit); regenerate placeholders anytime with the script. `assets/music/README.md`: put beds at `assets/music/<mood>.mp3`; `video.json` `music: "<mood>"` selects one; empty string = no music; the music lane is swappable later in Resolve by design (owner decision 2026-07-24).

**Verify**: `bash scripts/gen-sfx-kit.sh && ls assets/sfx/*.wav | wc -l` → 12; every file >1KB.

### Step 2: sound-constants + the semantic SFX planner

`lib/sound/sound-constants.mjs` (cue-constants style, value+rule):
`POP_CAP: 3` (max pops per run — beyond that, only first/last accents), `MIN_SPACING: 0.35` (s between any two SFX), `HIT_GAIN_DB: -14`, `POP_GAIN_DB: -16`, `DRONE_GAIN_DB: -30`, `RUN_SEMITONES: [0, 4, 7]` (rising major-triad contour), `JITTER_DB: [-0.5, 0, 0.5]` (picked by `index % 3` — deterministic, never Math.random).

`lib/sound/sfx-plan.mjs` — CLI `node lib/sound/sfx-plan.mjs <slug-or-path>`; pure planner exported as `planSfx({resolved, effects, segments, total})` → instances. Rules (each instance `{id, at, sample, semi, gainDb}`):
- **Card entrances**: every fullframe cue start → `whoosh-up` (dark register cues → `whoosh-down`; read `cue.register` when present, default up). Overlay cue start → `blip`.
- **Reveal runs**: each cue's beats form a RUN. Timbre by card family (mapping table, extend as families grow): `enacted/counter-tally` → `tick` steady (semi 0 all); `enacted/price-meter` → `tick`; `enacted/fill-gauge|stack-builder|connect-nodes|pipeline-flow` → `pop` with rising contour `RUN_SEMITONES` cycling; `enacted/race-bars|verdict-scale` → `thock` alternating semi 0/4; `pros-cons/*` and other legacy beat cards → `pop` contour; runs longer than `POP_CAP` keep first `POP_CAP−1` + last. Adjacent runs must not share a sample — if the previous run used `pop`, this run's pop-class becomes `blip` (simple two-way swap).
- **Transitions**: whip instances → `swipe`; register-style transitions (138) → `impact` at 50% gain.
- **Punch-ins** (beats effect instances) → nothing (visual-only; sound on every zoom reads as noise — deliberate).
- **Structural**: video start +0.5s → `riser`; final cue end → `success` (light) — skip when the last register span is dark.
- **Drone**: one `drone_low` instance per narration segment longer than 20s (loop flag `loop:true`, `DRONE_GAIN_DB`).
- **De-clutter**: enforce `MIN_SPACING` — later instance in a collision is dropped (stable, id-ordered); a lone pop in a 10s window is dropped (Loop Studio's lone-pop rule).
- Pitch: `semi` semitones; rendered in the mix via `asetrate=48000*2^(semi/12),aresample=48000,atempo=2^(-semi/12)` (inline this exact chain in build-mix).

Output `videos/<slug>/sound.json` `{video, approved:false, instances:[...]}` using the effects-plan.mjs preserve/approve pattern (`enabled` overrides survive regen; content change resets `approved`).

Tests (`lib/sound/sfx-plan.test.mjs`): fixture with 2 cues (one 4-beat fill-gauge run, one counter) + a whip → asserts timbre mapping, rising contour, POP_CAP trim, MIN_SPACING drop, adjacent-run timbre swap, determinism (two calls → deep-equal).

**Verify**: `node --test lib/sound/sfx-plan.test.mjs` → pass.

### Step 3: the mix (build-mix.mjs)

`lib/sound/build-mix.mjs` — CLI `node lib/sound/build-mix.mjs <slug-or-path>`; exports `buildMixArgs({voPath, instances, musicPath, total, outPath})` returning the full ffmpeg argv (unit-testable), and a thin runner that spawns it. Chain (inline in the code as built filtergraph):
- **VO bus**: `[vo] highpass=f=80, acompressor=threshold=-18dB:ratio=3:attack=15:release=200, alimiter=limit=0.95 [vob]`.
- **SFX bus**: each enabled instance = one input (`-i assets/sfx/<sample>.wav`) with `adelay=<ms>|<ms>`, the pitch chain when `semi≠0`, `volume=<gainDb>dB`; `loop:true` instances use `-stream_loop -1` trimmed to their segment length with 0.5s fades; all `amix=inputs=N:normalize=0 [sfxb]`.
- **Music bus** (only when `video.json` music non-empty and the file exists): `-stream_loop -1 -i assets/music/<mood>.mp3`, `atrim=0:<total>`, `afade=t=in:d=1.5, afade=t=out:st=<total-2>:d=2`, then duck under VO: `[musraw][vob] sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400 [musb]`.
- **Master**: `[vob][musb][sfxb] amix=inputs=3:normalize=0, loudnorm=I=-14:TP=-1.5:LRA=11` → `master.wav` (48k stereo) in the kb-scratch workdir; ALSO bounce `music-ducked.wav` (music bus alone post-duck) and `sfx-bus.wav` for the timeline lanes.
- **Frame-exact check** (after render): ffprobe `master.wav` duration vs `vo.mp3` duration — |Δ| must be ≤ 0.05s, else exit 1 with both numbers (Loop Studio's drift guarantee).

`run.sh`: `sound)` → `node lib/sound/sfx-plan.mjs "$slug"`; `mix)` → refuse unless `sound.json` `approved:true` (same gate semantics as effects.json), then build-mix.

Tests (`lib/sound/build-mix.test.mjs`): argv builder — correct adelay ms, pitch chain present only when semi≠0, music bus omitted when mood empty, loudnorm present exactly once. No ffmpeg spawn in unit tests.

**Verify**: `node --test lib/sound/build-mix.test.mjs` → pass. Then one real smoke: synthesize a 5s fake VO (`ffmpeg -f lavfi -i sine=frequency=300:duration=5 /tmp/vo-smoke.mp3`), 2 instances, run the mixer, then the loudness-measure command from the table on the output → `Input Integrated` between −15 and −13 LUFS; duration check passes.

### Step 4: assemble prefers master.wav; export gains audio lanes

- `lib/assemble.mjs`: at the final mux (locate via `grep -n "vo.mp3" lib/assemble.mjs`), use `<kb-workdir>/master.wav` when it exists, else `vo.mp3` (log which). `assembly.md` states which audio source was used.
- `lib/export-timeline.mjs` (native layered mode): add two audio lanes when the bounces exist — `music` (one clip: `music-ducked.wav`, offset 0) and `sfx` (ONE CLIP PER enabled sound.json instance, each referencing `assets/sfx/<sample>.wav` — copied into the export bundle's media dir like other clips — placed at its `at`, so the editor can nudge/delete individual hits); VO lane unchanged. Follow the existing asset+lane authoring code style in the file; lane names `music`, `sfx`.

Tests: assemble input-selection unit (master present/absent); export-timeline fixture with 2 sfx instances + music → FCPXML contains 2 sfx clips with correct offsets + 1 music clip (string assertions on the generated XML, consistent with `lib/export-timeline.test.mjs`'s existing style).

**Verify**: `node --test lib/assemble.test.mjs lib/export-timeline.test.mjs` → pass.

### Step 5: register + docs + gate

check.sh gains the 3 new test files. `PIPELINE.md`: sound.json schema + the two new verbs in the flow table (sound after effects-plan; mix before assemble). `EFFECTS.md`: pointer line ("audio design lives in lib/sound/ — see PIPELINE.md").

**Verify**: `bash scripts/check.sh` → exit 0.

## Test plan

Pure planner + argv-builder units (deterministic, no media, no network); one lavfi-only ffmpeg smoke proving the real chain + loudness target; ffprobe frame-exact check is part of the runner itself.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` → exit 0
- [ ] `bash scripts/gen-sfx-kit.sh` produces 12 wavs; `git status` shows them ignored
- [ ] Smoke mix measured at −14 ±1 LUFS; duration Δ ≤ 0.05s
- [ ] `grep -n "master.wav" lib/assemble.mjs` → preference wired; `grep -n "sfx" lib/export-timeline.mjs` → lane present
- [ ] `bash run.sh x sound` / `bash run.sh x mix` dispatch correctly (mix refuses unapproved sound.json)

## STOP conditions

- Required ffmpeg filter missing on this machine (the filter-check command from the table returns <4) — report the ffmpeg version.
- The pitch chain (`asetrate`/`atempo`) distorts sample duration so badly the MIN_SPACING model breaks (audible in the smoke) — report, don't switch to rubberband silently.
- Any v1/card-library edit.

## Maintenance notes

- Real samples replace the synthesized kit file-by-file (same names); the plan logic never changes.
- The timbre mapping table in sfx-plan.mjs is the tuning surface for the 060 fold — keep it a data table, not branches.
- Plan 140's board sound-preview reads `sound.json` + `assets/sfx/` directly; keep both shapes stable.
