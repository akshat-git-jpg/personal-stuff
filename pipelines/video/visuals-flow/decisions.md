# Decisions

- **2026-08-17**: Gate 120 (approve the intro idea) now judges 6-second MOVING
  teasers, not a page of prose. Prose was the cheapest thing to reject, but it
  is a poor way to judge a **look**: three directions described in words all
  sound reasonable, so the owner was approving words and then rejecting the
  finished 130 build — "i dont like the entire intro. i need to do entire
  intro again from scratch." Every direction 110 proposes now ships a real
  Hyperframes teaser (real DESIGN.md tokens, real logos, real renderer, real
  motion — `lib/intro-film/teasers.mjs`), and `handleApproveIntroIdea` refuses
  to approve a direction whose teaser was never rendered.
  - **The teaser compresses the ARC, not beat one.** Three directions' opening
    beats can look nearly identical while their arcs differ completely, and the
    arc IS the direction (`idea.json`'s own framing: "everything else is
    decoration"). One visual moment per arc clause, each opened by a
    `/* --- mN : <clause> --- */` banner in order; banner count must equal arc
    clause count.
  - **The fixed 6 seconds is not a knob.** The whole value of the gate is that
    every direction is judged on identical terms — a direction allowed more
    screen time than its rivals would win on runtime rather than on merit.
  - **Rejecting all directions is now a first-class round, not silence.**
    `/reject-intro-idea` moves the rejected directions into `idea.json`'s
    `rejected` array with the owner's own words (quoted, never paraphrased) and
    bumps `round`; 110 reads it back so round 2 cannot re-propose what round 1
    was rejected for. Capped at `MAX_IDEA_ROUNDS = 3` as a backstop — the board
    reports `exhausted: true` past that, and 110's contract is what STOPs.
  - **The Google Flow image-preview path was removed from 110** (an
    AI-generated still, added 2026-08-13, was the right instinct with the
    wrong artifact — neither the brand, the renderer, nor the motion) but
    **deliberately kept for 240's new-card gate**, where approving a still IS
    the right artifact: the frames themselves become the visual contract the
    card is built to match, not a preview of motion the card doesn't have.

- **2026-08-17**: `screenplay.json` and `film/index.html` are now machine-checked against each other, and the per-beat banner comment is the contract that makes it possible. Nothing tied the two files together: `lint-screenplay.mjs` validates the screenplay against itself and the transcript and never opens the composition, while `review-film.mjs` and `render-film.mjs` only assert `index.html` exists. That gap is dangerous specifically because 140 reads beat times from the screenplay and screenshots the composition — a timing changed in one file and not the other does not yield a visibly broken film, it yields a review that samples the wrong moments, prints each frame under a stage line it never covered, and provokes fixes to frames that were never wrong. `lib/intro-film/check-film-sync.mjs` compares the root's `data-duration` against the screenplay span and every beat banner's id/intent/t_start/t_end against its beat, positionally so a reorder cannot pass; `runReview` fails on it BEFORE sampling. The banner convention was already being followed by the authored films, so this promoted an existing habit to an enforced contract at zero authoring cost (documented in the 130 AUTHORING.md).
  - **Fixed alongside**: the 150 README claimed 160 renders "once approved". The code says the opposite and does so on purpose — `render-film.mjs` carries no approval check because rendering is how the owner gets a film to watch, and approval is enforced downstream by `requireIntroApproved()` in `assemble.mjs`. The README now documents 160-then-gate, and that the Intro tab serves the stills and the mp4 side by side because they answer different questions (design vs motion).

- **2026-08-08**: Eight defects found during the consistent-ai-influencer run were fixed at the mechanism rather than per-video. They share a shape: a gate whose answer nothing reads, a check that fires after the fact instead of preventing the defect, and a doc that undercounts the owner's gates are all the same bug — the owner ends up being the test harness.
  - **The character approved at gate 420 is now the render template.** `run.sh` defaulted `--template` to `specs-man` and the submit path never read `avatar-plan.character`, so the board pick was decorative. `avatar-render` now refuses a `--template` that disagrees with the approval, and `run.sh` passes none. Caught one command before a metered Avatar IV batch would have rendered a different presenter than the intro film.
  - **Five verbs did not record themselves** (230/330/440/450/460). Sessions hand-wrote ledger entries five separate times instead of fixing the wrapper, so the board told the owner steps were `todo` after they had run. All five wrapped, plus a `scripts/test-run-sh.sh` guard that fails when any step-backed verb does not dispatch through `record_step`.
  - **410 inferred "done" from a single render file**, so a 5-card verification render painted the board green over a 57-card plan. It now requires every resolved cue to have a clip.
  - **W18 zone-still read avatar coverage from `avatar-jobs.json`** (written at 430) while running at 330, so it reported planned host spans as static frame at the exact gate where the owner approves. It falls back to the planned spans now.
  - **Sound could be scheduled into silence.** The planner placed the structural-end effect at the last CUE's end, and a cue can outlast the voiceover; `build-mix`'s final `amix` was unbounded, so that late effect lengthened the master and failed the frame-exact gate. The planner clamps to the measured VO, and the master is pinned with `atrim`+`apad`.
  - **`checklist/checklist` declared `side: true` with capacity measured at 1920 only** and clipped its heading and last item at 1200. It auto-fits both widths now; the catalog records what was actually measured. Capacities on a side-capable card must be measured at BOTH widths.
  - **The operating skill described "three owner gates" numbered 037/080/120** — stale numbers, one gate deleted by plan 195, three real gates missing. There are SIX human steps; the skill lists them and `ls steps/ | grep human` is the check. Stale step cross-references repointed across 10 step docs.

- **2026-07-24**: Owner requested captions default-on; visuals-flow currently relies on sidecar .ass for web players or explicit `--captions` hardsubs. No muxed subtitle track is generated yet.

- **2026-07-25**: Review model = TWO owner gates, neither skippable at any video
  length. This REAFFIRMS the owner's confirmed 2026-07-24 process (root
  decisions.md, third entry that day) rather than replacing it — the visuals-flow SKILL.md
  had been quoting the FIRST 2026-07-24 entry ("short videos may skip the
  storyboard"), which the owner superseded the same day. Sessions followed the
  stale skill text and drove short videos straight to the cut.
  **Gate 1 = Storyboard (plan review, first)**: the owner finalises avatar
  placement AND avatar variation per span, motion-graphics placement, card
  choice, and on-card text before anything renders. The shot pass (070) moves
  BEFORE the storyboard gate so avatar spans are on the board at review time.
  **Gate 2 = Final Cut (output review)**: the assembled draft must contain
  everything the final video will have — graphics, avatar, effects, sound,
  captions.
  **Why**: the previous rule let short videos skip the storyboard and go
  straight to the cut. Measured on test-01, the expensive comments ("remove this
  template" x4, "overlay on top of motion graphics", "should have been a list
  card") were all card-choice/placement calls — plan-class defects caught only
  after full renders, each costing a re-render and re-cut. Plan defects are
  cheap on a storyboard and expensive in a final cut.
  **Known gap at time of decision**: per-span avatar variation is NOT
  implemented. `lib/resolve-shots.mjs` accepts only `kind: "avatar-full"`;
  `avatar-panel` derives from a video-level `head_layout`; the corner bubble is
  automatic over all screen segments; side view has no HeyGen id (fal-lipsync
  flow only); and there is no mode where the avatar shares a frame with a card.
  Gate 1 cannot offer the variation choice until those modes exist.

- **2026-07-30**: The gate numbering above is superseded. There are **THREE**
  human gates, not two, and gate 1 is no longer the storyboard:
  **Gate 1 = 037 card plan** (which cards, EXISTING vs NEW-to-build, body and
  zones together — approved before anything is built or rendered),
  **Gate 2 = 080 storyboard** (composition, with the real cards playing),
  **Gate 3 = 120 final cut** (motion and sound, judged on the assembled draft).
  The 2026-07-25 entry's reasoning still holds in full — plan defects are cheap
  on a storyboard and expensive in a final cut — 037 just pushes the cheapest
  class of them (wrong card, or a card that should exist and doesn't) one step
  earlier still, to before the card is built. `070-approve-intro-outro-human`
  was absorbed into 037 and deleted: it was this gate scoped to the zones only,
  which left the body's build-vs-reuse call unmade by anybody.
  See the root `decisions.md` entry of the same date for the full rationale.

- **2026-07-31**: The review board UI is a **React/Vite SPA** (`board-ui/`,
  plans 169–174), served as a locally-built bundle by the same
  `lib/board.mjs` Node server — owner decision 2026-07-30, chosen over
  componentizing the server-rendered template strings in place. One shared
  sticky header owns tabs + the single video picker + a right-aligned action
  slot holding every gate approve (Final Cut's approve moved there from the
  Comments panel); secondary controls live in a second header row. The legacy
  server-rendered pages are deleted: `/` serves the SPA, `/list` and
  `/calibrate` 302 to `/#storyboard` / `/#calibrate`. Server data/gate/media
  routes are unchanged (`/api/board-data` is the SPA's contract, plan 169).
  Rendered-truth gate: `scripts/board-ui-smoke.mjs` (real server + headless
  Chrome + a `probe=layout` meta) runs inside `scripts/check.sh` and asserts
  the chrome's y-position is identical on every tab. `board-ui/dist` is
  gitignored; `steps/080-approve-storyboard-human/run.sh` rebuilds it when
  stale. Tab hash + `?video=` URL semantics are unchanged and regression-pinned.

- **2026-08-06**: **Every "watch it, pause, comment on a moment" review step
  mounts ONE component** — `board-ui/src/components/ReviewSurface.tsx`, styled
  by `ReviewSurface.css`. Final Cut (gate 120) and Intro (gate 027) were two
  ~400-line near-copies sharing only `lib/fcTransport`'s time math, and the cost
  was exactly what duplication predicts: the copy that was not Final Cut shipped
  with no screenshot attach and no comment edit, its media listeners never
  attached (dead transport, clock frozen at 00:00:00), and the two tabs drifted
  apart visually — while Final Cut's own edit/delete POSTed `{items}` to `/save`,
  which writes `cues.json`, so every Final Cut comment edit was silently
  discarded and polluted `cues.json` with an `items` key.
  A NEW STEP ADDS NO CODE HERE: mount `<ReviewSurface>` with your `namespace`,
  `postUrl` and slots (`belowPlayer`, `panelTop`, `panelBottom`), and add the
  namespace to `REVIEW_NAMESPACES` in `lib/board.mjs` to get edit + delete.
  Nothing in the component may branch on which step is using it. Server routes
  are step-agnostic: `/feedback-edit` and `/feedback-delete` (the `-final-`
  spellings remain as aliases). A comment carries **several** screenshots —
  `item.images[]`, served at `/feedback-image/<key>/<n>`; the pre-2026-08-06
  scalar `item.image` stays readable forever via `itemImages()`, because a
  review comment is a record, not a cache. Pinned by `board-ui-smoke.mjs`,
  which asserts both tabs render the same surface markers.

- **2026-08-03**: A **portrait (9:16) HeyGen render is a first-class avatar
  source**, not a file to be rescued. HeyGen can render landscape but frames it
  worse (camera further back, flatter angle), so the owner keeps the portrait
  performance and the pipeline absorbs the aspect mismatch. Approved fullframe
  treatment: a **rounded card, 720x1000, radius 36, inset right at x=1140,y=40**
  over the warm brand radial, with a blurred rounded-rect drop shadow; the clip
  is `scale=720:1280, crop=720:1000:0:157` (keeps 78% of source height). Crop
  offset is derived, not hand-tuned: `cropY = 370*(cardW/1080) - 90` holds her
  head at a constant 90px of headroom for any card width. The 1140px to her left
  is a content zone (headline or card), which is why right-anchored beat
  centred: centring leaves two unusable 600px strips. Rejected with evidence: a true
  fill crop (cuts across the eyebrows at ANY vertical offset, so 9:16 can never
  fill 16:9 with the subject intact), a blurred self-backdrop (her out-of-focus
  hair reads as a one-sided grey smudge), and mirrored side-fill (two blurry
  human shapes flanking her). **Blocking prerequisite:** `planPanelGeometry` /
  `planSideGeometry` accept `srcAspect` and no caller passes it.
  `assemble.mjs:696,704` and `export-timeline.mjs:250,259` all take the 16/9
  default, so a portrait source is stretched 3.16x wide before cropping. Related
  finding: side mode's 720x1080 column loses only 16% of a PORTRAIT source but
  62.5% of a landscape one, so portrait is the better input there too. Full
  write-up incl. ffmpeg gotchas: `docs/specs/2026-08-03-portrait-avatar-in-landscape-design.md`.

- **2026-08-06**: **One renderer pin per role, single-sourced — and the two roles
  are NOT unified.** `lib/renderer-constants.mjs` now owns both hyperframes pins;
  four files used to hardcode their own and two of them disagreed by 26 patch
  versions with nothing on screen to reveal it: `lib/render.mjs` (every graphics
  card, step 090) and `steps/010-transcribe-run/run.sh` on `0.7.62`, the intro
  film's render AND review pair on `0.7.88`, and step 038's README telling you to
  lint a new card against `@latest`. So a card could be built and linted on one
  renderer, rendered on a second, and sit in the same timeline as an intro
  rendered on a third. `HYPERFRAMES_VERSION` now overrides BOTH pins together —
  it previously moved only the card renderer, which is precisely the "green review
  on one version, ship on another" failure `render-film.mjs`'s own comment warns
  about. **The 0.7.62/0.7.88 split is deliberately PRESERVED, not tidied away**:
  moving cards to 0.7.88 re-renders all 42 catalog cards on a renderer nobody has
  frame-verified them against, and the house rule since 2026-07-19 is that a
  visual change is verified by extracting and LOOKING at frames — a render+inspect
  gate passed three visually-broken effects in one day. Unification is an owner
  call with a frame-verification pass attached. `lib/renderer-constants.test.mjs`
  fails if any `lib/` source hardcodes a pin again, and asserts step 010's bash
  pin (which cannot import) still matches the card version.

- **2026-08-06**: **`srcAspect` reaches the geometry planners; the fixtures that
  hid it are the lesson.** `planPanelGeometry`/`planSideGeometry` accepted
  `srcAspect` from the day they were written and no caller ever passed it, so
  every panel/side composite took the 16/9 default and a portrait 9:16 HeyGen
  render was stretched 3.16x wide before cropping. The 2026-08-03 entry above
  made portrait a first-class source AND named this the blocking prerequisite; it
  still shipped. It survived because the integration fixtures composite
  solid-colour clips — a blue rectangle stretched 3.16x is still a blue
  rectangle, so no test could see it (the fixture-blindness lesson of
  2026-07-19). `probeSrcAspect(file)` (memoised, 16/9 fallback so an unreadable
  clip cannot kill an assembly) now feeds all four call sites.
  `lib/src-aspect.test.mjs` asserts shape RATIOS rather than pixel values, and —
  because every planner-level test passes `srcAspect` explicitly and would stay
  green while the real bug persisted — one test pins the CALL SITES as source.
  Mutation-verified: dropping the argument fails it with the exact line.

- **2026-08-06**: **`scripts/check.sh` FINDS its tests instead of listing them.**
  The hand-typed list had drifted to 39 of 50 `lib/` test files: `segments`,
  `plan-skeleton`, `cue-rules`, `side-mode`, `versions`, `motif`,
  `transcript-beats`, `post-status`, `regression-cards` and both rulebook
  checkers were on disk, passing, and never run by the gate. `regression-cards`
  is the one that mattered — it asserts the `intro: "cards"` default path is
  untouched, the exact isolation property the owner asks for. Now
  `find lib -name '*.test.mjs'` (not a glob, so a new `lib/<subdir>/` cannot
  re-orphan anything); the gate went 649 → 665 tests. Do not reintroduce a list.

- **2026-08-06**: **The step list is a REGISTRY, not six hand-kept copies.**
  Every step now declares itself in `steps/<slug>/step.json` (number, title,
  actor, verbs, consumes/produces, gate, tab, waivable, external, optional,
  requires.intro); the non-step commands live in `steps/_verbs.json`.
  `run.sh` derives its usage list, its step folder paths (`step_slug`) and its
  `status` next-hint from it, `lib/run-log.mjs` takes its valid ledger keys from
  it, and `PIPELINE.md`'s step table is generated from it by
  `scripts/gen-pipeline-table.mjs` (`--check` runs first in `scripts/check.sh`).
  **Why**: the list was encoded in six places that had to be edited in lockstep,
  and two lib modules resolved step FOLDER NAMES at runtime
  (`build-prompt.mjs`, `check-rulebook.mjs`, plus the shot/zone pair), so
  renumbering a step to insert one before it broke running code with nothing to
  catch it — the same failure mode that already destroyed this file's old→new
  mapping table. The `status` next-hint was the live symptom: a fixed `if/elif`
  over artifact probes with no awareness of the intro film, so on an
  `intro: "film"` video the `next:` line never once named 025 or 027.
  `steps/027-approve-intro-film-human/` was created here — the board had been
  recording that gate (`lib/board.mjs` `recordGate(workdir, '027', …)`) against
  a folder that did not exist.
  This is decisions.md 2026-08-06's "A NEW STEP ADDS NO CODE HERE" applied to
  the step list: create the folder, write `step.json`, regenerate the table.
  `scripts/test-run-sh.sh` was rewritten to match — it drives every verb with
  `VF_DRY_RUN=1` and compares the dispatched command to a table, replacing three
  `grep '<literal>' run.sh` source-text pins that failed on any correct rename
  while catching nothing (and had already bent `run.sh` into keeping a function
  so "the command reads literally ... to the grep that pins it").
  Mutation-verified: blanking one step's `produces` fails the gate with `E-REG`.

- **2026-08-07**: The board's tab row reads in play order — **Run · Intro · Card
  Plan · Storyboard · Final Cut** — and **no tab may cap the width of the review
  surface it mounts**. Order comes only from `TAB_TABLE` in
  `board-ui/src/lib/router.ts` (pinned by a router unit test); size comes only
  from `.rs-container` / `.rs-video-container` in
  `board-ui/src/components/ReviewSurface.css`. `.intro-tab`'s
  `max-width: 1000px` was deleted; the player now spans the window and is
  bounded by viewport height, with `.rs-video-container`'s `max-width` derived
  from that height budget through the 16:9 frame so the box is always exactly
  the film's aspect (let it go wider and `object-fit` pillarboxes the film, which
  offsets the click-to-pin marker — the marker is placed as a % of that box).
  **Why**: Intro and Final Cut mount the SAME `<ReviewSurface>` and share one
  stylesheet, yet the owner saw a visibly smaller film on Intro — the wrapper,
  not the component, was the difference. Same class of drift as the 2026-08-06
  private `.intro-*` copies of the review-surface rules, one level up.
  Gated in `scripts/board-ui-smoke.mjs`: the intro-film fixture renders at a
  pinned 1600px window and the surface must span it. Measuring the player
  against `.rs-main` is NOT enough — a wrapper shrinks the surface and its
  column together, and the first version of this gate passed green with the
  1000px cap put back. Mutation-verified against that exact regression.

- **2026-08-20**: **Every mp4 this board serves goes through one function,
  `serveMediaFile()` in `lib/board.mjs`, and that function's contract is
  surviving an aborted request — not serving a happy one.** `/intro-video`,
  `/intro-teaser` and `/video/<label>` carried three near-identical copies of
  the range logic; they are now one call each. The helper destroys its
  `fs.ReadStream` when the response closes, listens for `error` on both ends,
  and answers an unsatisfiable range with **416, never a `RangeError`**.
  `main()` also installs `uncaughtException` / `unhandledRejection` handlers
  that log and stay up, and the per-request `.catch()` checks `res.headersSent`
  before writing (setting a status after a 206 throws INSIDE the catch, which
  is an unhandled rejection, which ends the process).
  **Why**: the owner reported the Final Cut player frozen at 04:08 with Play
  doing nothing however many times he pressed it. The element was fine — the
  board process had **died**, so the bytes behind it had no server. A `<video>`
  aborts every open range request on each seek, pause and resume (measured: 11
  requests to `/video/v2` in eight cycles, all `net::ERR_ABORTED`), and
  `stream.pipe()` does not destroy the source when the destination dies, so
  each abort stranded an open handle on a 160MB file — 210 aborted requests
  leaked 125 OS handles, 307 → 432, never released. After the fix the same load
  moves the count 242 → 241. Gated in `lib/board.test.mjs`: `parseRange` covers
  open-ended, suffix and past-EOF forms, and one test aborts 40 range requests
  mid-body then asserts the board still serves.
  **The lesson worth keeping**: a local tool that dies is indistinguishable from
  a frozen UI, so the board now also SAYS when it is gone — `App.tsx`'s liveness
  probe no longer gates itself on a `?video=` the URL need not carry (on those
  URLs a dead server showed no banner at all), and `<ReviewSurface>` shows
  "Waiting for video data…" when the element is playing but starved.

- **2026-08-20**: **`:root` declares `color-scheme: dark`** in
  `board-ui/src/theme.css`. **Why**: native controls are painted by the
  platform, not by our stylesheet. With no `color-scheme`, Chrome paints a
  `<select>`'s popup WHITE while the options inherit the page's near-white
  `--text`, so the playback-speed picker's numbers were invisible (owner report).
  Declared once at the root rather than on the one select, because the video
  picker and the version picker are the same control with the same failure.
  Found alongside it: `--fg` and `--hover` were used by `ReviewSurface.css` but
  **never defined anywhere**, so five colour rules and both hover states were
  inert. `--fg` is now spelled `--text` at its call sites; `--hover` has a value.

- **2026-08-20 (second report, same day)**: **The Final Cut player's "it pauses
  by itself and then will not resume" was a KEYBOARD dead end, not a media or
  server fault.** Three things compounded in
  `board-ui/src/components/ReviewSurface.tsx`:
  (1) the type-to-comment feature fires on **any** single character anywhere on
  the page, so a stray keystroke stops the film;
  (2) the `focus()` it then calls lands on a composer that is still `disabled`
  (`canComment` needs `paused`, which has not flushed yet), so the keystroke
  disappears into an unfocused box on the far side of the screen and the pause
  has **no visible cause**;
  (3) once that box holds text, `Space` types into it instead of driving the
  transport, and clicking the frame pins instead of resuming — leaving the Play
  button as the only exit, which is why the owner was reloading the page.
  Fixed: `Escape` blurs the composer and returns control to the player; the
  in-composer transport check is `inputText.trim() === ''`, not `=== ''`, so a
  box holding only spaces never swallows `Space` again; and a `wantComposerFocus`
  ref re-fires the focus once the composer is genuinely enabled.
  **Why it matters beyond this bug**: the first fix that day was real (the board
  process was crashing on aborted range requests) but it was **not this**. Both
  failures present identically — a frame frozen mid-play with an inert Play
  button — so "the video is stuck" is never enough to act on. Ask which of the
  three it is: server gone (red banner), starved of bytes ("Waiting for video
  data…"), or **keystrokes going somewhere else** (composer focused). Each now
  says so on screen.
  **Still open, owner's call**: clicking a PAUSED frame pins a note rather than
  resuming, which is what a person instinctively tries first. Left as-is because
  click-to-pin is a documented, deliberate feature — changing it needs a decision,
  not a patch.

- **2026-08-20 (third and actual root cause)**: **The Final Cut player stopping
  "by itself" was Chrome's HARDWARE H.264 decoder failing —
  `PIPELINE_ERROR_DECODE` — not the board, not the server, not the file.**
  Proven by the player's flight recorder (`board-ui/src/lib/playerDiag.ts`,
  `POST /diag` → `videos/<slug>/player-diag.log`): the `pause` event arrives with
  **no `pause() CALLED` stack before it**, so no app code paused it, and
  `MediaError.code === 3` is set. Afterwards `play()` resolves and even fires
  `playing` while `currentTime` never moves — which is exactly "I press play and
  nothing happens" — and only reloading the page rebuilds the pipeline.
  Deterministic at t≈2111.8s of `v2.mp4`; A/B settled it: with hardware decoding
  the decoder dies every approach, with `--disable-accelerated-video-decode` the
  same seeks play through cleanly. The stream is not at fault — Constrained
  Baseline, 720p, no B-frames, keyframes every 8.3s, monotonic timestamps,
  `ffmpeg -err_detect +explode` decodes it silently — and the server is not at
  fault either: 48 sampled ranges plus the whole tail are byte-exact.
  **Why it took three attempts**: every headless repro passed `--disable-gpu`,
  which forces SOFTWARE decoding, so the harness could never hit the bug the
  owner was hitting on every session. **A repro harness that disables the
  subsystem under suspicion cannot exonerate it.** Drop `--disable-gpu` when
  reproducing anything about media playback.
  The player now recovers by itself: on `MEDIA_ERR_DECODE` it reloads the element
  and restores the position, and the retry budget is spent by REAL PROGRESS
  (`currentTime` clearing the bad frame by 2s), never by the `playing` event — a
  reloaded element fires `playing` and then dies on the same frame, which made
  the first version loop forever. After three failures it stops and names the
  cause on screen rather than silently seeking past the frame, because skipping
  footage without telling the reviewer is worse than stopping.
