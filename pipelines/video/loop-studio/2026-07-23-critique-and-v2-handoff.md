# visuals-flow v2 — Loop Studio critique + handoff (2026-07-23)

**Why this exists:** the owner bought Loop Studio ($97, build-loop.ai) to benchmark it against
visuals-flow, wants to fold the good parts into visuals-flow or build a "v2", and will brainstorm
it in a fresh session. This doc is the cold-start context for that brainstorm: what Loop Studio
is, how it compares, the ranked steal-list, the open questions, and the running state from the
session that produced it. Pair it with a `superpowers:brainstorming` sitting; the actual plan
should go through `orchestrate` per repo routing.

---

## 1. What happened in the session that wrote this

1. Installed Loop Studio (5 video-edit skills + a Remotion engine) into the personal account.
2. The engine could not render a single frame out of the box; found and fixed three fresh-install
   blockers, proved the toolchain with a self-contained render.
3. Built a first real short from a HeyGen "avatar-3" talking-head clip (7s, 9:16) to see the
   product's actual output quality end to end.
4. Read visuals-flow's internals (PIPELINE.md, HANDOFF.md, the 7 rule surfaces, the effects layer,
   the Resolve handoff) and produced the critique in section 5.

Full install details are also in personal-account memory: `loop-studio-install.md`.

---

## 2. Loop Studio — what it actually is

A set of Claude/Codex **skills** wrapped around a **Remotion 4** engine. Installed at
`~/.claude-personal/skills/` (loop-studio, video-taste, video-feedback, broll-ingest, vox-edit).
Engine: `~/.claude-personal/skills/loop-studio/core/engine/remotion/`.

Its philosophy is the opposite of visuals-flow: **bespoke per-beat authoring, no templates.**
- You write a per-act "design spec screenplay" (`design_actN.json`): one row per spoken clause with
  mode/object/action/continuity/marker-word/sync.
- Then you HAND-AUTHOR each scene in a Remotion design system (`src/bb2/`: registers, a Marker
  wipe, an enacted "concept library" where a database is a cylinder that fills, a Claude answer is
  the real Claude window).
- Then a sound pass (`build_sfx.py` reads frame-diff events → semantic SFX), then a mix/master
  (`build_v<N>.sh`: sidechain ducking, frame-exact A/V, -14 LUFS).
- Then a review loop via the `video-feedback` skill: a frame.io-style tool to scrub the FINAL mp4,
  drop timestamped + point-pinned comments, and tick each note off live as it's fixed.
- Taste compounds in `video-taste/` (a long prose memory, grows every review round).
- Brand is one `brand.json` that re-skins every scene (per-owner swappable).
- Also ships a Descript-grade **cut engine** (`core/engine/cut/`): forced-align + best-of-many-takes
  selection for raw recorded heads.

The core creative doctrine (`editors/creative-standard.md`): understand the WHOLE video's one idea +
a recurring through-line FIRST, then make **every spoken clause an enacted picture that DOES the
idea** (not a labelled card), gated by a falsifiable v1 self-audit that checks pixels not intent.

### The 3 fresh-install fixes (all in `core/engine/remotion/`; vendor updates OVERWRITE these, so they recur)
1. Missing brand plates: generated `public/brand/{grid-light,grid-dark,riso}.png` (the bundle denies
   media, but the motion path references `staticFile('brand/*.png')`).
2. Google-fonts request explosion: bare `loadFont()` in `src/bb/fonts.ts`, `src/bb/brandfonts.ts`,
   `src/bb2/engine.tsx` pulled every weight × every subset (hundreds of requests) → blew the
   `delayRender("fonts")` timeout on a cold cache. Fixed with `loadFont(undefined, {subsets:["latin"],
   ignoreTooManyRequestsWarning:true})`.
3. Real blocker: `src/motion/kit.tsx:28` has a MODULE-LEVEL `delayRender("fonts",{timeoutInMs:7000})`
   (effective 5000ms — Remotion subtracts 2000) whose async clear-timers don't fire during headless
   webpack-startup eval, hanging EVERY render through the main entry (kit is imported transitively).
   Fixed by adding a synchronous `finish()` clear.

### Working render recipe (reproduce)
```
cd ~/.claude-personal/skills/loop-studio/core/engine/remotion
npx remotion render src/index.ts <CompId> out/<name>.mp4 --timeout=120000 --concurrency=2 [--scale=0.5]
```
- Self-contained smoke comp = `InkTest` (brand-icon card, no author media). Most shipped bb2 comps
  reference the author's unshipped footage/music and won't render as-is.
- Doctor: `python3 core/engine/ls_platform.py` (reports healthy). Deps installed: ffmpeg/node/npm
  (pre-existing via brew), mlx-whisper (model cached), Remotion node_modules built.

---

## 3. The short built (proof of output quality)

`Avatar3Short` — the HeyGen avatar-3 head as a finished 1080×1920 branded short (7.1s, with audio).
Full-frame head + word-timed karaoke captions (lime marker on "unlimited") + an enacted terminal
beat typing `$ loop avatar --generate --download` on "command line" + BuildLoop palette/fonts.
- New files: `remotion/src/Avatar3Short.tsx`, `remotion/src/avatar3_words.json`, registered in
  `remotion/src/Root.tsx`; render + project at `remotion/projects/avatar3-short/`.
- Two self-audit v2 items left (not done): beat 3 "generated and downloaded" has no unique enacted
  graphic (only caption); the top eyebrow clips on the right edge.

This is what "$97 of bespoke authoring" produces: one good 7s short, from a session of work + three
bug fixes. Contrast with visuals-flow's one-LLM-call, near-free, many-videos model.

---

## 4. visuals-flow current architecture (the thing we're upgrading)

Read `pipelines/video/visuals-flow/PIPELINE.md` + `HANDOFF.md` for the real detail. Summary:
- Input one VO mp3 → transcribe (Groq) → segments → **one** LLM cue pass (pick a card from the
  42-card `card-library` catalog, fill variables, anchor to a transcript phrase) → deterministic
  resolve (anchor→time) → owner storyboard board (localhost:4322) → batch render → shot pass
  (avatar spans) → HeyGen avatar render → assemble → **native layered Resolve/FCPXML export** →
  filmstrip QC → feedback-fold (Opus, "never repeat a mistake").
- "Everything except the cue pass is scripted and costs zero tokens. One LLM call per video."
- Rules live across 7 surfaces (cue-pass-prompt, cue-constants, lint-cues, catalog.json, DESIGN.md,
  RULEBOOK.md, shot-pass+lint-shots). Machine-enforced by a linter + convergence metrics + edit-delta.
- Effects layer: pluggable `lib/effects/*.mjs`, per-video `effects.json`, `EFFECTS.md` rulebook, and
  an `analyze reference <url>` verb that reverse-engineers effect moments from any YouTube video.
- Proven end-to-end on test-01 (32-min video). Operated via the `visuals-flow` skill (verb router).

---

## 5. The critique (Loop Studio vs visuals-flow)

**Verdict:** visuals-flow is the more mature PRODUCTION system; Loop Studio has a higher CRAFT
ceiling plus a few layers visuals-flow lacks. The owner's pipeline made the smarter bet for a
multi-channel money operation. Don't regress its strengths.

### What visuals-flow already does BETTER (keep these in v2)
- Cost/determinism: one model call vs authoring every scene by hand.
- Machine-enforced rules: cue-constants + linter + convergence metrics + edit-delta. Loop Studio's
  "taste" is a prose doc a model reads, not a rubric a linter fails you on.
- Editor handoff: native layered Resolve/FCPXML where every effect is a copyable clip. Loop Studio
  outputs a flat mp4.
- Storyboard review BEFORE render (cheap iteration). Loop Studio only reviews after a full render.
- Reference auto-analysis (`analyze reference url`). Loop Studio only learns from owner feedback.

### What Loop Studio does BETTER — ranked steal-list
1. **Final-video reviewer.** Scrub the finished mp4, drop timestamped + point-pinned comments, watch
   the to-do list check off live as each is fixed. Fills visuals-flow's own open problem #3 ("no
   automated final-video QC"). Cleanest steal. (Their impl: `video-feedback/scripts/make_review.py`
   + a served `review.html`.)
2. **Sound + mix layer.** `build_sfx.py` reads events off the render → semantic SFX (pitch rises as
   things accumulate, timbre by meaning); `build_v<N>.sh` ducks music under voice, masters to -14
   LUFS, frame-exact A/V. visuals-flow's effects are all VISUAL (whip/flash/drift/captions); there
   is no audio design or loudness master anywhere. A whole missing stage.
3. **"Enacted, not labelled" + a v1 self-check.** Every idea = a picture that DOES the idea (DB =
   cylinder that fills; a product's output = the real product UI). visuals-flow cards mostly REVEAL
   content (pros/cons chips, tables, stat hits) = closer to labelling. Fix without dropping
   templates: add an "enacted device" card class + one "is it enacted?" check in the cue-pass rubric.
4. **Whole-video concept + through-line pass.** Name the one core idea + a recurring motif BEFORE
   authoring, so a video feels written rather than locally anchored. visuals-flow's cue pass is
   per-anchor. A cheap concept/throughline pre-pass would make videos cohere.

### Skip
- Their cut engine (forced-align, best-of-takes): visuals-flow is VO-first on TTS, no messy takes.
- Full bespoke per-scene authoring: it's exactly what makes Loop Studio slow and visuals-flow a
  business. Don't trade the scale/cost/determinism advantage away.

---

## 6. Candidate v2 shape (input for the brainstorm, not a decision)

Most likely winning shape: **keep the card/scale/zero-token bet, bolt on the missing layers.** In
rough priority: (1) final-video reviewer, (2) sound + mix layer, (3) enacted-device card class +
enact-check, (4) whole-video throughline pre-pass. A two-track option (cheap card pipeline for
volume + a bespoke "hero video" track for flagship uploads) is worth weighing if craft on hero
uploads matters more than uniform cost.

---

## 7. Open questions for the brainstorm (answer these first)

1. **v2 direction:** keep cards + bolt on layers (recommended), OR run two tracks (cards for volume
   + a bespoke hero track), OR go fully bespoke (gives up the cost/scale advantage)?
2. **Which missing layer first:** final-video reviewer / sound+mix / enacted-device cards /
   whole-video throughline pass? (Can be more than one.)
3. **Cost tolerance per video:** stay near-zero (new layers must be scripted/deterministic, no extra
   model passes), OR a couple more LLM passes OK, OR spend real tokens on hero videos only?
4. **Primary deliverable:** is the human-editor Resolve handoff still the main output, or is
   auto-shipped final.mp4 becoming primary? (Changes where the reviewer + sound layer plug in.)

---

## 8. Running state / artifacts from the session

- Loop Studio installed + working (section 2). Memory: `loop-studio-install.md`.
- Two local review servers were started this session (may be stopped by now; re-serve from the
  review folder's `serve.py` if needed):
  - Smoke render review: `~/Downloads/LoopStudio-Smoke-Review/` (was on :8929).
  - Avatar3Short review: `~/Downloads/Avatar3-Short-Review/` (was on :9136).
- The short: `~/.claude-personal/skills/loop-studio/core/engine/remotion/out/avatar3short.mp4` and
  `.../projects/avatar3-short/renders/avatar3-short_v1.mp4`.
- Nothing committed to git this session; all Loop Studio edits live under `~/.claude-personal/skills/`
  (outside this repo). Only new file inside this repo is this handoff.

---

## 9. What to read first next session

- This doc.
- `pipelines/video/visuals-flow/PIPELINE.md` + `HANDOFF.md` (current pipeline).
- Loop Studio doctrine: `~/.claude-personal/skills/loop-studio/editors/creative-standard.md` and
  `editors/talking-head.md` (the enacted-graphics + sound + mix method worth mining).
- Loop Studio reviewer to copy: `~/.claude-personal/skills/video-feedback/`.
- Loop Studio sound: `~/.claude-personal/skills/loop-studio/core/engine/remotion/build_sfx.py` +
  `build_v26.sh`.
