# PIPELINE — Devsplainers-clone motion-graphics

Turns a topic into a rendered, **narrated** explainer in the Devsplainers style.
Fully atomic: **each step does exactly one job.** `SPEC.md` is the *why* (design
system + decisions); this file is the *how* (run order).

Shared design system lives in `kit/` (built once). Shared scripts live in `lib/`.
Per-video artifacts live under `videos/<slug>/`; every step takes `--video <slug>`.

## Who does what — and what it costs
The goal: **Opus is the brain only where it sets quality; the token-heavy grind
runs on your Antigravity subscription; everything mechanical is a free
deterministic script.** Four actors:

| Actor | Tag | What it does | Opus tokens |
|---|---|---|---|
| **Opus** | `[OPUS · critical]` | writes the script (010) and the storyboard (080) — nothing else | the only real spend |
| **Antigravity** | `[ANTIGRAVITY]` | the grind: beats, tts-lines, static build, motion build, thumbnail | **zero** (your sub) |
| **Run** | `[RUN · free]` | deterministic scripts: TTS, trim, measure, manifest, scaffold, verify, render, stitch, mux | **zero** (no LLM) |
| **Human** | `[HUMAN · gate]` | listen/approve at 5 review gates | — |

**Only 2 of 23 steps use Opus.** Verification is deterministic (`verify-all.mjs`),
so scene quality is gated with **no** Opus tokens — you just say "done," a script
says pass/fail, and only failures cost anything.

## Two mechanics you asked about
- **Which step runs a server?** Exactly one: **110**. It starts the preview
  gallery (`lib/serve.mjs`, http://localhost:4321) and leaves it up through the
  review gates (140/170). Stop it after 170.
- **How does a step "give a prompt to Antigravity"?** Every `[ANTIGRAVITY]` step
  is handed off with one command:
  `node lib/handoff.mjs <step> --video <slug>` — it fills the slug into that
  step's prompt, copies it to your clipboard, and focuses Antigravity. You press
  **⌘V + Enter**. No API, no screenshots, no permissions, no Opus tokens.

## The timing spine (why sync just works)
**1 beat = 1 VO clip = 1 scene.** Beats (020) drive per-beat VO (040); each
clip's measured length (060) is the scene's target length (090); stitch (190) and
concat-VO (200) both cut scene *i* to that same length, so the mux (210) lays clip
*i* exactly under scene *i* — zero drift.

## The flow (run top to bottom)

| # | Step | Actor | In → Out | Special |
|---|------|-------|----------|---------|
| 010 | write-script | OPUS | brief → `script.md` | |
| 020 | segment-into-beats | ANTIGRAVITY | `script.md` → `beats.md` | ⌨ handoff |
| 030 | write-tts-lines | ANTIGRAVITY | `beats.md` → `tts-lines.md` | ⌨ handoff |
| 040 | synthesize-voice-over | RUN | `tts-lines.md` → `audio/beatNN.wav` | Kokoro (local) |
| 050 | trim-silence | RUN | `audio/*.wav` → `*.trim.wav` | |
| 060 | measure-durations | RUN | `*.trim.wav` → `durations.json` | timing spine |
| 070 | review-voice-over | HUMAN | listen → redo bad beats (→040) | ✋ gate |
| 080 | write-storyboard | OPUS | `beats.md`+`durations.json` → `storyboard.md` (+```scenes block) | |
| 090 | write-scenes-manifest | RUN | `storyboard.md`+`durations.json` → `scenes.json` | parse (no LLM) |
| 100 | review-storyboard | HUMAN | approve the plan | ✋ gate |
| 110 | scaffold-scene-folders | RUN | `scenes.json` → `scenes/sNN-*/` | 🖥 **server** + ⌨ emits 120 prompt |
| 120 | build-static-scenes | ANTIGRAVITY | storyboard+kit → static `index.html`/scene | ⌨ handoff |
| 130 | verify-static-scenes | RUN | scenes → pass/fail | gate (no LLM) |
| 140 | review-static-scenes | HUMAN | lock the look | ✋ gate → emits 150 prompt |
| 150 | build-motion-scenes | ANTIGRAVITY | approved scenes → GSAP timeline/scene | ⌨ handoff |
| 160 | verify-motion-scenes | RUN | scenes → pass/fail | gate (no LLM) |
| 170 | review-motion-scenes | HUMAN | approve motion (play mode) | ✋ gate |
| 180 | render-scenes | RUN | scenes → `renders/scenes/sNN.mp4` (silent) | |
| 190 | stitch-scenes | RUN | `sNN.mp4`+`durations.json` → `<slug>.silent.mp4` | |
| 200 | concat-voice-over | RUN | `*.trim.wav`+`durations.json` → `<slug>.vo.wav` | |
| 210 | mux-audio-video | RUN | silent video + VO → `<slug>_final.mp4` | |
| 220 | review-final-video | HUMAN | watch with audio → approve | ✋ gate |
| 230 | create-thumbnail | ANTIGRAVITY | hero beat + kit → `<slug>_thumb.png` (1280×720) | ⌨ handoff |

```
brief
  │ 010 write script          [OPUS]        ← the only two Opus steps
  │ 020 segment into beats     [ANTIGRAVITY] ⌨
  │ 030 write tts lines        [ANTIGRAVITY] ⌨
  │ 040 synthesize voice over  [RUN]  Kokoro → audio/beatNN.wav
  │ 050 trim silence           [RUN]
  │ 060 measure durations      [RUN]  → durations.json (timing spine)
  │ 070 review voice over       [HUMAN] ✋ (redo loop)
  │ 080 write storyboard       [OPUS]        ← durations are measured, not guessed
  │ 090 write scenes manifest  [RUN]  parse (no LLM)
  │ 100 review storyboard       [HUMAN] ✋
  │ 110 scaffold scene folders [RUN]  🖥 starts server + ⌨ emits 120 prompt
  │ 120 build static scenes    [ANTIGRAVITY] ⌨   ← heavy grind, your sub
  │ 130 verify static scenes   [RUN]  gate (no LLM)
  │ 140 review static scenes    [HUMAN] ✋ lock look → ⌨ emits 150 prompt
  │ 150 build motion scenes    [ANTIGRAVITY] ⌨   ← heavy grind, your sub
  │ 160 verify motion scenes   [RUN]  gate (no LLM)
  │ 170 review motion scenes    [HUMAN] ✋
  │ 180 render scenes          [RUN]   → per-scene silent MP4
  │ 190 stitch scenes          [RUN]   → one silent video (aligned to VO)
  │ 200 concat voice over      [RUN]   → one VO track (padded to scenes)
  │ 210 mux audio + video      [RUN]   → <slug>_final.mp4
  │ 220 review final video      [HUMAN] ✋
  │ 230 create thumbnail       [ANTIGRAVITY] ⌨ → <slug>_thumb.png
  ▼
ship (video + thumbnail)
```

## Layout
```
hyperframes/
  SPEC.md  PIPELINE.md
  kit/                     ← shared design system, built once
  lib/                     ← shared scripts:
                             handoff (clipboard→Antigravity), serve (gallery),
                             scaffold-scenes, scenes-manifest, verify, verify-all,
                             tts-kokoro, trim-silence, measure-durations,
                             render-scenes, stitch-video, concat-vo, mux
  steps/<NNN-name-actor>/  ← one job each: README.md + (rulebook.md | run.mjs | run.sh)
                             actor suffix = who runs it (-claude/opus, -antigravity, -run, -human)
  videos/<slug>/           ← script.md beats.md tts-lines.md audio/ durations.json
                             storyboard.md scenes.json scenes/ renders/
```

## Conventions
- **×10 numbering** — drop a `045-…` between steps without renumbering.
- **One job per step** — a step transforms one input into one output; reviewing and doing are never combined.
- **Actor suffix names the executor** — `-claude` (Opus) / `-antigravity` / `-run` / `-human`.
- **Antigravity steps** ship their paste-ready prompt as `rulebook.md`; hand it off with `node lib/handoff.mjs <step> --video <slug>`.
- **`kit/` is built once**; steps never edit it. Shared code lives in `lib/`; `[RUN]` steps are thin wrappers over it.
- **Multi-video** — outputs are keyed by `<slug>` under `videos/`, not stored per step.

## Implementation status
- **Actor split (current):** only **010** and **080** are Opus. **020, 030, 120,
  150, 230** are Antigravity (handoff via `lib/handoff.mjs`). **090** is now a
  deterministic parser (`lib/scenes-manifest.mjs`), not Opus authoring.
- **040 (Kokoro TTS)** needs a one-time `pip install kokoro soundfile` (first run
  also downloads the ~350 MB model). Installed + verified on the `test` video.
- **`videos/test/`** is the worked reference: 12 scenes built static+motion and
  assembled into `renders/test_final.mp4` with synced Kokoro voice-over (proves
  180–210 end-to-end).
- **A/V alignment (done, in the split flow):** `lib/align.mjs` is the single source
  of truth — per scene it sets `T = max(scene_len, VO_len)`. Step **190** freeze-
  extends short scenes' last frame to `T`; step **200** pads each VO clip with
  trailing silence to the same `T`. Both read the same plan, so video and audio are
  equal length per scene and overall → mux is drift-free. Verified reproducing the
  94.81s synced `test_final.mp4` through the split 190→200→210.
- **Production-run readiness:** every RUN step wraps a `lib/` script; scaffold (110)
  authors each scene at its measured VO length (`data-duration=dur`); 110 prints the
  server + Antigravity-handoff commands; all 5 Antigravity steps hand off via
  `lib/handoff.mjs`. A fresh video needs only the one-time `pip install kokoro
  soundfile` before step 040.
