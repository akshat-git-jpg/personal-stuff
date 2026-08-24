# Editor: TALKING-HEAD — the designed motion-graphics treatment (= explainer / YouTube video)

> **Skills-dir note (Claude Code + Codex):** paths below written as `~/.claude/skills/...` are for Claude
> Code. On Codex the skills live in `~/.agents/skills/...` — swap `.claude` → `.agents` wherever you see it.

> 🎯 **AUTHOR IN FULL CREATIVITY MODE.** This treatment is governed by
> [creative-standard.md](creative-standard.md) — read its 10 laws + the design-spec screenplay method +
> the device library + the v1 self-audit BEFORE the first render. That is what makes v1 already creative,
> instead of a flat first pass that needs nine rounds of "make it more visual."
>
> **This is THE treatment for explainer / YouTube / talking-head videos, in all three formats.** Pick the
> format adapter for the shape you're shipping — [short.md](short.md) (9:16), [longform.md](longform.md)
> (16:9 multi-min), [intro.md](intro.md) (≤~40s hook) — each reads THIS file + creative-standard and adds
> only what's format-specific. This file is the HOW (engine, cut, sound, mix); the format files are the SHAPE.

> **USE EXACTLY THIS (designed flagship = Flavor B, the default when it must look designed):**
> engine → `~/.claude/skills/loop-studio/core/engine/remotion/` · styling → reuse `src/bb2/` (registers, Marker, concept
> library) · ideate → write a `src/bb2/design_actN.json` screenplay FIRST · sound → `build_sfx.py` · mix/master
> → `build_v<N>.sh` (frame-exact stitch, −14 LUFS) · quality gate → `video-taste`. **Reuse it; never re-copy
> the engine or invent a new look.** (Flavor A below = the lighter b-roll cover.)

Use when the spine is a single talking head to camera. Two flavors:
- **A) Head + b-roll** (lighter): cover the VO with b-roll / screenshots / light BESPOKE graphics. Faster.
- **B) Motion-graphics explainer** (flagship): the head is composited INTO hand-authored Remotion scenes
  with a full design system. This is the **proven BusinessBrain / "stop building second brains" run
  (v7 → v26, SHIPPED)** — the reference quality bar. Reach for B for a flagship explainer that must look designed.

Head sources: **recorded** → cut with **`core/engine/cut/`** (the mandatory cutter — see below); **AI** →
`avatar-video` (Fish s2.1 → HeyGen) or Higgsfield (memory `project_ai_avatar_pipeline`). BusinessBrain used a
**real recorded head** — an aligned continuous take.

## Cutting a raw recorded head — THE method (mandatory, `core/engine/cut/METHOD.md`)
**Never freestyle the cut and never write your own transcript-collapse logic** — that leaks retakes on glued
footage (proven in a 2026-07-15 bake-off; naive auto-cutters failed on every ASR model). The ONE approved way:
```bash
# CUT = the cut engine in your skills dir (Claude Code: ~/.claude/skills · Codex: ~/.agents/skills)
CUT=~/.claude/skills/loop-studio/core/engine/cut; [ -d ~/.agents/skills/loop-studio/core/engine/cut ] && CUT=~/.agents/skills/loop-studio/core/engine/cut
python3 "$CUT/cut.py" prep   <RAW.mp4> <WORKDIR>              # transcribe(literal)+forced-align, prints timed transcript
#  → YOU author <WORKDIR>/keepers.json: keep the ONE clean COMPLETE take per line (the LAST good take),
#    drop every earlier attempt/fragment/filler, snap cuts into the gaps. Rules: core/engine/cut/METHOD.md.
python3 "$CUT/cut.py" render <RAW.mp4> <WORKDIR>/keepers.json <OUT.mp4>
python3 "$CUT/cut.py" verify <OUT.mp4>                        # re-transcribes; FAILS on any repeat — not done until clean
```
The transcription model is interchangeable and defaults to LOCAL (no API key). **Take-selection is the craft** —
that judgment step is what makes it Descript-grade. Result on the reference file: 250s of retakes → 50s, zero
repeats, every sentence complete.

Always: read `core/brand/brand-book.md` + `video-taste` (`universal.md` + `by-subject.md` + this file)
BEFORE the first render; run the `video-feedback` loop after; **fold every general lesson back into `video-taste`.**

---
# Flavor B — the motion-graphics explainer (BusinessBrain, proven v7→v26)

**This is the finetuned styling + method. Start every new flagship HERE — do NOT start from scratch.**
The look, the sound, and the review discipline were tuned over ~26 review rounds; the accumulated *judgment*
lives in `video-taste`, the reusable *craft* lives in the engine below, and the *ideation method* is the
design-spec screenplay. A new video reuses all three and only hand-authors its own scenes.

## The engine — SINGLE SOURCE OF TRUTH (reference it; never copy it — copies drift)
`~/.claude/skills/loop-studio/core/engine/remotion/` — a Remotion 4 project. This is the ONE authoritative location.
(A previous "preserved copy" of these scripts inside `core/engine/talking-head/` silently drifted to ~30% of
the real `build_sfx.py`. Lesson: reference the live engine, never mirror it. See that dir's `README.md`.)
- `render-film.mjs` — Node render API (bundle + selectComposition + renderMedia, 3 retries, non-TTY safe).
  `SCALE=1 COMP=Act1 OUT=out/Act1.mp4 node render-film.mjs` (SCALE=1 → 1080p acts; SCALE=1 on the 4K intro
  comp → 4K; SCALE=2 → 4K acts). Don't use the CLI in a loop (progress bar breaks non-TTY; stills flake on fonts).
- `src/Root.tsx` — comp registry + durations (Act1–4 @1920×1080, BusinessBrainIntro @3840×2160, 30fps).
  **Durations are LOCKED to the baked VO — never change them when restyling.**
- `src/Act1.tsx … Act4.tsx`, `src/BusinessBrainIntro.tsx` — per-beat scenes, HAND-AUTHORED (bespoke JSX timed
  to the VO; no generic template — this is the craft, and the cost).
- `src/bb2/` — **THE DESIGN SYSTEM (the reusable styling):**
  - `scene.tsx` — FootageLayer (full / lime-offset panel / hidden), Card, two-layer Marker wipe, FileGraphic,
    the REGISTERS: `DarkBg` (raisin void + grid) for problems, `LightBg` (white worksheet) for solutions.
  - `concepts.tsx` — the ENACTED concept library: `Win` (real app/Claude window), `FolderOfFiles`,
    `DatabaseHolds` (cylinder that fills), `NumbersMove` (tabular). Concepts DO their idea and read in <1s.
  - `engine.tsx` — palette (raisin + Neo-Lime `#CFFF05`, ONE accent), fonts (Space Grotesk / JetBrains Mono /
    Playfair), EASE curves, MOVE/SNAP/POP timing.
  - `design_act2.json … design_act4.json` — **the SCREENPLAY / DESIGN SPEC (the ideation artifact) — see below.**
- `build_sfx.py` — the sound-design engine: `SIG` (structural hits/transitions), `POPRUNS` (per-element
  enumeration pops grouped into runs with timbre-by-meaning + `pop_semi` melodic contour), drone bed.
- `detect_events.py` — frame-diff event detector (drives the SFX pass off the CURRENT render).
- `build_v<N>.sh` — the mix + stitch + master pipeline (latest: **build_v26.sh**).
- `public/` — `footage/actN.mp4`, `intros/businessbrain/`, `logos/` (REAL brand marks in REAL colour: claude
  clay-orange, chatgpt, youtube, supabase, brand-*, lucide-*-<silver|lime|dim|dark>, markdown/folder-macos),
  `assets/`, `sfx2/` (curated kit + `es_*` Epidemic, all normalised to −1 dBFS), `music/`.

## Ideate FIRST — the design-spec screenplay (this is where the styling decisions are made)
Before any JSX, author a **design spec per act** (see `src/bb2/design_actN.json`). One row per beat:
```
{ id, start, end, narration,
  mode: "full" | "panel" | "hidden",           // how the footage/head sits
  object: "what is on canvas",
  action: "what it DOES (enacted), which register, what dims/lights on which spoken word",
  continuity: "what carries over from the previous beat",
  copy: { headline, marker, mono_label },       // words on screen; marker = the ONE lime-wiped word
  sync: [ { at, event } ] }                      // frame-accurate cues timed to the VO
```
This is the reusable ideation method: decide register (dark=problem / light=solution), the enacted object,
the ONE marker word, and the sync beats — in words — before writing code. Reuse the proven vocabulary above.

## Build a new flagship (the pipeline)
1. **VO** — continuous recorded take → cut (`core/engine/cut/`, the mandatory method above) → per-act voice baked into each comp as `<Audio>`.
2. **Ideate** — write `design_actN.json` per the schema above.
3. **Author** scenes (`ActN.tsx`) from the spec: registers switch dark↔light per `liteWins`; footage composites
   in 3 modes via the `skf` keyframer; concepts ENACTED, never labelled. Durations LOCKED to the VO.
   **Worked example of spec→JSX — read `src/LSAct1.tsx` (or `src/Act1.tsx`) next to its `design_*.json`** to
   see exactly how a beat's `object`/`action`/`sync` becomes JSX: the `skf` footage keyframer, `liteWins`
   register switches, and sync-timed pops. Don't invent the mapping — mirror how the reference act does it.
4. **Render** per comp via `render-film.mjs`.
5. **Sound** — `detect_events.py` (events off the CURRENT render) → `build_sfx.py`. Variance model (in
   `video-taste`): timbre-by-meaning ACROSS runs + melodic `pop_semi` contour WITHIN a run (accumulation rises,
   loss falls, counters tick steady); hits ≤0.18–0.24, accents 0.08–0.13; **verify in the STEM**, not the mix.
6. **Mix + master** — `build_v<N>.sh`: voice centered (`pan=stereo|c0=c1|c1=c1`) + studio chain; music looped
   from its SUSTAINED CORE + sidechain-ducked; sfx bus; the "answer-it" splice (`asplit` the voice bus — a reused
   ffmpeg label silently DROPS audio). **FRAME-EXACT stitch:** trim each segment's audio to its exact video frame
   length, concat video + audio as two matched streams, mux once → `loudnorm I=-14`. **Verify the container:**
   `V.duration == A.duration`, both `start_time == 0` (a native player exposes a mismatch a browser hides).
7. **Deliver + review** — `~/Downloads/<Project>_FULL_v<N>.mp4`; `video-feedback` (`make_review.py`; ALWAYS paste
   the localhost URL; on "feedback done" read `feedback_latest.txt`, fix, `post_status.py` to check off live).
   **Iterate cheaply: re-render ONLY the changed act; re-mix; re-stitch.**
8. **Learn** — fold every general lesson into `video-taste` BEFORE regenerating.

## The quality bar is `video-taste` (binding gate — read it, don't re-derive it)
`video-taste/universal.md` carries every hard-won rule from v7→v26, so a note given once never returns:
CONTRAST (never lime-on-white / grey-on-dark), nothing overlaps, ONE focal point, real logos in real colour,
enacted-not-labelled, **a product's output must look like the REAL product UI** (a Claude answer = the real
Claude chat window, not a stylized receipt), the **SFX variance model** + transient-on-beat timing + "too loud =
lower per-hit GAINS not the bus" + "more SFX = per-element pops on enumerations", **frame-exact A/V container sync**,
music loop-from-core, verify-in-STEM, flashback-from-raw-source. Read it before authoring and RE-READ before every re-render.

## Config knobs
Comp durations (locked to VO) · register windows `liteWins` · footage `skf` keyframes · the `design_actN.json`
spec · `build_sfx.py` `SIG`/`POPRUNS` · music swells + duck thresholds + master target in `build_v<N>.sh`.

## `video.json`
`{ mode:"talking-head", flavor:"explainer|broll", aspect:"16:9", head:"recorded|avatar",
   brand:"buildloop", engine:"~/.claude/skills/loop-studio/core/engine/remotion", quality_bar:"video-taste" }`

---
# Flavor A — head + b-roll (the lighter recipe)
1. **Source the head:** record+cut (`core/engine/cut/`, the mandatory method above), or generate (`avatar-video` / Higgsfield).
2. **Read the core:** `core/brand/brand-book.md` + `video-taste`.
3. **Cover** the VO with b-roll / screenshots / light bespoke graphics from the engine — NOT template vizzes.
   Brand overlays (lower-thirds, logo, end-screen) from the brand book.
4. **Review loop** (`video-feedback`) → fix + check off + ask if vague. 5. **Learn** → `video-taste`.
