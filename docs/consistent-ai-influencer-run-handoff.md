# consistent-ai-influencer — visuals-flow run handoff

Written 2026-08-03, updated 2026-08-04. The owner asked for the whole video "till
final render", with the **new intro flow** (`intro: film`), **HeyGen 3 / girl-1**,
and source from their Drive folder. **Steps 005 through 025 are done and
committed, including the delivered intro film.** Everything from 030 on — the
body cue pass, the conclusion, cards, shots, renders, sound, assembly — is
untouched. Start at "What remains, in order".

## Read this first: the run is NOT in the primary working directory

The primary checkout (`/Users/kbtg/codebase/personal-stuff`) is on branch
`chore/boss-hardening-2026-08-02`, which is **47 commits behind `main`** and
carries a large *uncommitted* `visuals-flow` → `visuals-flow` rename in its
index. That tree predates plans 185/186/187, so it has no `--intro film`, no
`025-author-intro-film-llm`, and no `introOwnedByFilm` stand-down. Running the
video there would have silently used the old card-based intro — the one thing
the owner explicitly ruled out.

So this run lives in a second checkout of `main`, created with plain
`git worktree` and **nothing in the primary tree was touched**:

```
/Users/kbtg/codebase/personal-stuff/.claude/worktrees/vf-ai-influencer
  branch: run/vf-ai-influencer   (off origin/main)
  run dir: pipelines/video/visuals-flow/videos/consistent-ai-influencer
```

Two consequences for whoever picks this up:

1. The pipeline folder is still called `visuals-flow` here, because the rename
   has not landed on `main`. The `visuals-flow` skill text refers to
   `visuals-flow/`; on `main` that path does not exist yet.
2. When the boss-hardening rename eventually lands, this video's folder moves
   with it. Nothing in the artifacts hardcodes the pipeline path.

Branch `run/vf-ai-influencer` holds the run. `git log --oneline` there shows the commits.

## Kickoff config (step 005)

```json
{ "engine": "heygen3", "review": "express", "intro": "film",
  "drive_folder": "1w2QOStUwCd0nBUsK8BsC8hFyieUH6Elw",
  "drive_account": "kushalbakliwal25@gmail.com" }
```

`express` waives the 037 card-plan and 080 storyboard board approvals. It does
**not** waive the new-card look-preview (any `status: "new"` card stops the flow
for the owner's Gemini/Flow prompt verdict) and it does **not** waive 120.

Drive folder is *"How to Create a Consistent AI Influencer that Gets Sponsors
(Full Course) @ g1"*. `Input/` held INTRO/BODY/CONCLUSION.mp4; `Output/` was
empty, so this is a first run.

## What is done

| Step | State | Notes |
|---|---|---|
| 005 | done | config above; `src/` pulled from Drive; `screen.mp4` + `vo.mp3` built by concatenating intro→body→conclusion (1230.4s) |
| 010 | done | Groq `whisper-large-v3-turbo`, 4062 words → 4005 after cleanup |
| 015 | done | `confirmed: true`. intro 0–90.7s, body 90.7–1171.1s, conclusion 1171.1–1230.4s |
| 020 | done | `concept.json`, lint green, 99.3% narration coverage |
| 025 | **done — film delivered** | `intro-film/out/intro.mp4`, 90.700s, 1920x1080, h264+aac, film gate pass, no frozen stretch over 2s |

### Source layout

`src/{intro,body,conclusion}.mp4` are all 1920x1080 / 30fps / h264 + aac 48k, so
`screen.mp4` is a stream-copy concat. `vo.mp3` is its audio. The convention was
confirmed against `best-ai-video-generator`, whose `src/` durations sum to its
`screen.mp4` length to within 5ms.

### Transcript cleanup — what was actually wrong

Whisper dropped punctuation for roughly 3500 words in the middle, so this was a
heavy pass, not a proofread. 141 token-level changes, each verified against a
word-by-word LCS diff before applying. Real garbles that would otherwise have
been burned into the captions:

`open art` / `open orange interface` → OpenArt · `seed dream` → Seedream ·
`the lower training` → **LoRA** · `once that model is strange` → trained ·
`content back` → content bank · `the same space` / `consistent phase outputs` →
face (3 places) · `enhanced pumps` → enhanced prompts · `in painting` →
inpainting · `copy cup` → coffee cup · `a status character` → the *Set as
Character* button · `you can turn a custom model` → train · `ad influencer` → AI
influencer · `equality holds up` → quality.

The second-opinion re-transcription independently corroborated LoRA (it heard
"laura"), Seedream ("z-dream"), Flux ("flunks") and Happy Horse.

**Four phrases were deliberately left as spoken**, because any fix would be a
guess and a caption that differs from the audio is a worse defect than an odd
phrase. The owner may want to overdub or cut around them:

- ~42s — "the exact process of **flooding** that consistency from scratch"
- ~995s — "when a **font** or a sponsor comes on board, the workflow is **passed**"
- ~1045s — "you can deliver whatever **poor mental** campaign it needs"
- ~1055s — "you have all of these in just **as a pound of** one minute to two minutes"

The suspect gate also flags 15 rare proper nouns; all are UI labels and product
names that were capitalised on purpose (Angelica, Filipina, Nano Banana, Flux,
Grok Imagine, LoRA, Annotate, Area Edit, Media…). Nothing there needs action.

### 015 — one boundary corrected by hand

The demo-vs-narration heuristic ended the step-6 demo at 905s. The product-swap
demonstration actually runs to ~1000s — everything up to "we landed a deal with
Sunshine Coffee" is on-screen work, and the sponsor pitch after it is pure talk.
That stretch is now one `demo` block, so graphics do not get placed over live
demo footage.

### 020 — the concept

- **Thesis**: an AI influencer only becomes sponsorable when the same face
  survives every post, so the work that matters is locking one character model,
  not generating more images.
- **Frame**: casting versus contracting — most people re-cast their influencer on
  every generate; you audition once and sign that face to a contract.
- **Through-line** `the-character-card`: one portrait card holding the anchor
  image. Opens as an empty frame with faces flickering through it, gets sealed
  when the model trains, is stamped out into every scenario, and ends as the
  asset a brand is buying.
- 5 register spans, 3 real dark↔light flips. Two adjacent spans are both `light`
  on purpose: the video has one genuine problem→solution turn plus a short
  tension pocket at "before you approach a single sponsor, you need a content
  bank". Padding it with fake flips would have gamed the coverage gate without
  changing a frame.

### 025 — the intro film

12 beats over the measured 90.7s intro, gapless, every clause verbatim from the
transcript. `lint-screenplay` exits 0, and that was mutation-tested (nudging
b03's `t_start` to 16.5 correctly raised E2 + E3) so the green is real.

The arc is `hook · stakes · turn · stakes×3 · mech×2 · scope×2 · tease · button`
— a deliberate departure from `DEFAULT_ARC`, recorded in `deviation_reason` on
every beat. Reason: this intro states the stakes *before* the fix, and the
default order would put the tool on screen before establishing why a sponsor
cares. Beats are sized 3.7–11.7s so no beat trips W4 and the 3-frames-per-beat
review actually covers each one.

`film/index.html` notes for whoever edits it:

- One GSAP timeline registered as `window.__timelines['intro']`. Every element is
  persistent (no `class="clip"`), so `carries` is honoured literally — the card
  in beat 12 is the same DOM node that flickers in beat 1.
- GSAP comes from the jsdelivr CDN, matching `card-library`'s cards.
  **Not** the vendored `assets/gsap.min.js` that intro-studio's poc-01 used —
  vf2's `linkFilmMedia` only stages `vo.mp3` and `avatar.mp4`, so a vendored copy
  would be an untracked build artifact.
- The OpenArt logo is inlined as a base64 data URI (22.4 KB). The real
  `card-library/logos/openart.png` is above the project root, and any path that
  traverses up is a hyperframes lint error — which silently disables the layout
  and contrast passes entirely (see `film-assets.mjs`).
- `--hero-size: 140px` over `--body-size: 48px` = 2.92×, mid-band per DESIGN.md's
  "land in the middle of the band" rule.
- Presenter geometry follows `shot-constants`: `panel` is the 28%-width
  bottom-right inset at 32px, `full` is an inset 900×770 leading the lower left
  so the hero band and card zone stay clear. TASTE T5 — `full` means the
  presenter *leads* the frame, not covers it. Nothing overlaps the panel zone at
  any beat, which is what keeps T3 (text never crosses a graphic) true.
- The flickering faces are CSS silhouettes of five different builds, not stock
  photos.

## Step 025 is missing its render glue — read before touching the intro again

Three defects in the shipped pipeline, all on `main`, none specific to this video:

1. **`lib/intro-film/review-film.mjs` has no CLI entry block** (no
   `if (import.meta.url === ...)`), but `run.sh` line 265 runs it as a script. So
   `run.sh <slug> intro-review` imports the module and **exits 0 having done
   nothing**. The pass TASTE.md calls the only real gate silently does not run.
2. **`lib/intro-film/film-gate.mjs` has no CLI entry block either**, and
   `run.sh` line 269 runs it the same way. `run.sh <slug> intro-render` therefore
   runs the 027 approval check and then a no-op, and reports success.
3. **Nothing anywhere renders the film.** There is no code path producing
   `intro-film/renders/intro-film.mp4` or `intro-film/out/intro.mp4`, and
   `runGate()` only *judges* a file that must already exist. Meanwhile
   `assemble.mjs:1006` hard-requires `intro-film/out/intro.mp4` and its error
   message names `run.sh <slug> intro-render` as the way to produce it.

Net effect: **no `intro: film` video can be assembled through the documented
interface.** Plans 185/186/187 landed the authoring step, the review libs, the
gate logic, the approval gate and the assembly splice — but not the wiring
between HTML and mp4.

This run worked around it by calling the shipped code directly, which is the
recipe to reuse until it is fixed properly:

```bash
# review (what run.sh intro-review should do)
node -e "import('./lib/intro-film/review-film.mjs').then(m=>m.runReview('<slug>'))"

# render (no shipped equivalent; same pinned renderer review-film uses).
# NOTE: -o must be a FILENAME. `-o renders` is treated as an extensionless
# output file and the audio mux dies with "Unable to choose an output format".
cd videos/<slug>/intro-film
npx -y hyperframes@0.7.88 render film --fps 30 --format mp4 --quality high \
  -o renders/intro-film.mp4

# gate (what run.sh intro-render should do), then deliver
node -e "import('./lib/intro-film/film-gate.mjs').then(m=>console.log(m.runGate('<slug>')))"
cp videos/<slug>/intro-film/renders/intro-film.mp4 videos/<slug>/intro-film/out/intro.mp4
```

The proper fix is a plan: add the two CLI entry blocks and a real render step
wired into `run.sh intro-render` ahead of the gate, with delivery to `out/`.

### What the film gate caught that nothing else did

The first render failed `G2 5.7s of frozen picture (max 3s)`. The presenter clip
IS advancing — panel crops at 19s and 21s differ — but the avatar is only ~8% of
the frame, so during a long hold the whole-frame delta falls under
`freezedetect`'s `n=0.003` threshold. Fixed with a continuous ambient light pass
(6 x 15.1s = 90.6s) plus a drifting glow, which is what DESIGN.md means by "long
holds need a visible loop, not a breathe". Second render: gate pass, zero frozen
stretches over 2s.

## Resolved: the avatar clip

`avatar.mp4` does not exist yet. The intro film needs ONE clip covering the whole
90.7s intro, and `linkFilmMedia` looks for it at
`videos/consistent-ai-influencer/avatar.mp4`.

Submitted on girl-1 / Avatar III, and the meter diff confirmed it is free
(`credits +0  seconds +0  ✓ UNLIMITED`):

```
video_id 40069c1150fc4791bc5aa7117d2c40c0
title    consistent-ai-influencer-intro-film
audio    videos/consistent-ai-influencer/intro-vo.mp3   (vo.mp3 trimmed to 90.7s, gitignored)
```

It queued for ~16 minutes at 0% before processing, then completed. Downloaded to
`videos/consistent-ai-influencer/avatar.mp4` (1920x1080, 90.69s, 24 MB).

**Do not skip reading the review frames on any future change.** TASTE T9 exists because a whole
beat's device was 2px at 20% opacity, passed every mechanical check, and was
invisible on screen through three review passes. The specific things to check
here: the silhouette flicker reads as *different people* and not as noise; the
seal arc is legible at 1080p; the seven step rows all sit inside the frame after
the b10 lift; and the avatar panel never sits on a step row.

Also worth a look: girl-1 is a **template** render, so `avatar.mp4` arrives as a
fully composed 1920×1080 frame with its own background, not a bare presenter.
That is exactly what the rest of the pipeline expects, but inside an authored
film it means the `panel` inset shows a picture-in-picture of another
composition. If the owner dislikes it, the fix is a plain photo-avatar render
(`generate-from-audio --avatar …`) rather than a template, which would need an
`avatar_id` for the girl character added to `pipelines/video/heygen/registry.json`
(today girl-1 carries only a `template_id`).

## What remains, in order

1. **030 cue pass (body only)** — the big one. `bash run.sh consistent-ai-influencer cue-pass`
   prints the assembly. Budget from `plan-skeleton`: cue band **31–82**, 24
   fullframe slots, 4 overlays/min, per-card caps fullframe=3 / stat-hit=3 at 90s
   spacing. **Slots 1–3 sit inside the intro (28.5s, 57s, 85.5s) and must be left
   alone** — `plan-skeleton.mjs` was not part of plan 187's stand-down, so it
   still offers intro slots even when the film owns the intro. Body cues start at
   the 184s slot.
3. **035 zone pass** — with `intro: film` this authors the **conclusion only**,
   and the positional link-CTA recount means the conclusion should now take
   `link-in-description/link-scrim` (the film owns the first description mention
   at ~85s). Verify that, it is the exact bug plan 187 was written to prevent.
4. **validate → card-plan (037, waived) → 038** if anything is `status: "new"`.
   A new card **stops the flow** for the owner's prompt verdict even in express.
5. **audit → 060 shot pass** with `engineMode: "test"` (must match
   `engine: heygen3` or avatar-render refuses) and girl-1.
6. **090 render → 100 avatar batch → sound → mix → 110 assemble** (the assembler
   splices `intro-film/out/intro.mp4` over the intro span automatically —
   `introOwnedByFilm` is live in `assemble.mjs` on `main`).
7. **120** — open the board. Never waived, in any mode.

## Documentation drift found along the way

`steps/025-author-intro-film-llm/README.md` still says *"What consumes the
output: Nothing yet… Making the pipeline consume it … is a separate plan."* That
separate plan is 187, which **has landed** — `assemble.mjs` and
`export-timeline.mjs` both splice the film now. The README is stale and will
mislead the next reader into hand-splicing the intro. Worth a one-line fix.
