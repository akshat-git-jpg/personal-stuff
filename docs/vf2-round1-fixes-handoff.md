# visuals-flow — Final Cut round-1 fixes, handoff (2026-07-24)

Owner tests in a fresh session from here. Everything below is committed and
pushed to `main`. Working dir for all commands: `pipelines/video/visuals-flow/`.

## Where things stand

- **test-01 draft versions** (board → Final Cut tab → version picker, all at
  `~/kb-scratch/video/visuals-flow/test-01/versions/`):
  - v1: the original round-1 draft the owner reviewed (17 comments)
  - v2: all 17 v1 comments fixed (new cards, remaps, no Ken Burns)
  - v3: v2 comments fixed (heading style, em dashes stripped, statement card motion)
  - v4: audible SFX (silent-kit fix) + owner template notes applied (5 cards
    deleted, table-rows recolored, icon-pills aligned, cinematic-float text
    bigger) — **this is current**. (An SFX-only cut between v3 and v4 failed
    mid-run because templates were deleted underneath it; both fixes landed
    together in v4.)
- **Board**: `bash run.sh test-01 board` → Storyboard + Final Cut tabs.
  A board is usually already running at `http://localhost:4322/#final-cut`.
- **Card gallery**: `cd ../card-library && npm run serve` (owner runs it at
  `http://localhost:4331`). Now grouped by family with a sticky jump nav.
- **All owner comments** (17 on v1, 3 on v2) are marked fixed with per-comment
  notes — visible as green check-offs in the Final Cut comments panel.

## What to test in the new session

1. Open the Final Cut tab, pick **v4** (the newest render — there is no v5), watch with sound. Expect: audible
   whooshes/pops synced to card entrances and beats, no Ken Burns zoom on
   screen segments, no em dashes anywhere on cards, "Top 5 AI Video Tools
   Comparison" title with logo+name chips that keep moving all 10s.
2. Transport bar: Play/Pause, scrubber, −5s/+5s, frame stepping, speed, mute.
   Keyboard: Space, arrows (±5s), Shift+arrows (frame), and typing any letter
   pauses + focuses the comment box. Enter sends a comment; Shift+Enter is a
   newline; pasting a screenshot attaches it.
3. Comments from **3:05 to the end** have never been reviewed — that stretch
   needs owner eyes (spotlight "4K pick" card, tip-banner, ending).
4. Template notes: gallery → Notes button on any card → saved to
   `card-library/card-notes.json`. The session phrase to act on them is
   **"apply my template notes"**. This round's 8 notes are marked done with
   green resolutions.

## Card library (now 59 cards)

Deleted this session (owner rulings): `enacted/stack-builder`,
`overlay/label-plate`, `overlay/callout`, `overlay/arrow-label`,
`overlay/spotlight-click`, `enacted/verdict-scale`, `enacted/price-meter`,
`enacted/connect-nodes`.

New: `overlay/keyword-pop` — the workhorse overlay (compact corner pill,
optional brand kicker + one short phrase; legible over white and black).

Reworked: `title/title-aurora-wave` (logo+name chips, symmetric, motion fills
the hold), `enacted/pipeline-flow` (no traveling dot, REQUIRED per-step icon
from a 28-icon inline set), `overlay/stat-hit` (dark plate, reads on light
footage), `statement/keyword-statement` (post-settle life: word float + glow
pulse), `comparison/table-rows` (accent header, zebra rows, `*good` / `!bad`
cell pills), `checklist/icon-pills` (rows left-aligned), `title/title-cinematic-float`
(112px title).

## Machine gates added (cannot regress)

- **E9 overlay-over-graphic** — lint error if an overlay overlaps a fullframe
  card's extended span. Overlays sit on footage only.
- **E10 no-dash-copy** — lint error on any em/en dash in rendered card text
  (owner: reads as machine-written). Metadata fields are exempt.
- **SFX audibility** — `build-mix` hard-fails if effects were planned but the
  SFX bus peaks under −35 dB. Root cause this round: `gen-sfx-kit.sh`
  synthesized samples at −27..−66 dBFS peak, so every mix shipped silent
  effects while the master LUFS check passed. The kit now peak-normalizes
  every sample to −3 dBFS. If a machine has never run the kit:
  `bash scripts/gen-sfx-kit.sh`.
- **Screen segments stay static** — integration test fails if Ken Burns (or
  any zoom) reappears on screen segments. `lib/effects/drift.mjs` is deleted.
- **pipeline-flow icons required** — catalog enum, resolve fails without one.

## Routing/copy rules folded (cue-rules.mjs → prompt, drift-gated)

- **R_COPY**: headings read like real headings (Title Case, no comma
  constructions like "5 AI video tools, compared"); never an em dash in any
  rendered text — use ":", "·", or words.
- **R_KINETIC**: a sentence enumerating 3+ items routes to a list card
  (icon-pills / bullet-points), never kinetic-sentence.
- **R_OVERLAY_ON_FOOTAGE**: overlays never overlap fullframe spans (E9's rule).
- Callout/arrow-label references replaced by keyword-pop everywhere.

## Avatar layer — not run yet, and now cheaper to test

Owner rule recorded (decisions.md + the visuals-flow skill guardrail): **HeyGen
Avatar III is free (unlimited mode) — sessions may submit it for TEST renders
without per-run approval.** Metered features (Avatar IV, generative credits)
and production renders remain owner-gated.

To add the avatar layer to test-01: `bash run.sh test-01 shot-pass` → avatar
spans + modes (full / panel / stage) appear on the Storyboard for composition
approval → submit Avatar III renders → `bash run.sh test-01 cut` composites
them automatically.

## Known open items / watchlist

- **3:05→end of test-01** never reviewed by the owner.
- **c13 (Higgsfield stack)** is now icon-pills after connect-nodes was deleted;
  fine, but if the owner wants a bespoke "product capability" device, that is
  a flywheel candidate.
- Lint warnings tuned out but visible on every run: W1 (c13→c14 10.3s gap),
  W3 (23 cues vs [8,20] band), W7 (21.6s bare stretch), W4 (1-word list
  labels). All advisory; retune via the 060 fold if they keep nagging.
- Stale `effects.json` override `whip-reg-45.9` prints an "ignoring unknown
  id" warning at assemble — harmless leftover from the before-after card
  removal; delete the instance from `videos/test-01/effects.json` to silence.
- Fix-list not yet planned: word-sync audit-gate exemption codification,
  master.wav living in the repo workdir instead of kb-scratch, title-aurora
  lightbar overflow badge at 9.9s (cosmetic), fill-gauge dark drain look.
- `run.sh` status line still prints ANSI-colored "approved" text (display
  only); the cut verb's approval check was made color-proof (exit-code based).

## Session plumbing worth knowing

- rtk hook colorizes captured node output — never string-compare command
  substitution output in run.sh; use exit codes (bug found in the cut verb).
- Board comment keys are `final-<version>:<n>` in `videos/test-01/feedback.json`;
  fix statuses go to `claude_status.json` via
  `node lib/post-status.mjs test-01 '<json>'` (statuses: fixed/skipped/question).
- The board polls `/status` every 2.5s, so check-offs appear live.
