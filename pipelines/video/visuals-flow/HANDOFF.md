# visuals-flow handoff (2026-07-18, post assembly session — POC complete)

For the next session picking this up. Everything below was true and verified on
2026-07-18 (late night, second pass). Read PIPELINE.md first if you have never
seen this pipeline; read this doc for where things actually stand and what is
open. **Operate this flow via the `visuals-flow` skill (verb router).**
**The POC is COMPLETE end to end**: test-01 went VO → cues → renders → avatar
clips → **assembled final.mp4** (step 090, plans 082+083, PRs #39/#40) the
same night. Owner verdict: successful and decent; next phase is tightening
rules and adding capabilities via new-session brainstorms.

## What this is

Beat-synced motion graphics for final-workflow videos. One VO mp3 in, a folder
of rendered clips plus an editor manifest out. Graphics reveal their content at
the exact second the voiceover speaks each point. One LLM call per video;
everything else is scripts. Design spec: `docs/specs/2026-07-17-motion-graphics-beat-sync-design.md`.
Decisions log entries: decisions.md 2026-07-17 and 2026-07-18.
Caller contract for other pipelines: `INTEGRATION.md`.

## State: proven end to end

- **The full flow ran on real content**: test-01, a 32-min "5 AI video tools"
  comparison (`videos/test-01/`). 010 transcribe → 020 cue pass (Sonnet) →
  030 resolve → 040 owner board review (two feedback rounds, all folded) →
  050 render: **18/18 clips rendered 2026-07-18, ffprobe-verified,
  `manifest.md` written, owner-approved.** Pending only: hand `renders/` +
  `manifest.md` to the human editor and collect their reaction (feeds GFX-06).
- **010 transcribe**: Groq whisper-large-v3-turbo fast path (22s for 32 min,
  correct brand spellings), local whisper fallback. Accepts vo.mp4/mov/mkv/m4a/
  wav, extracts vo.mp3 itself, slug-or-path arg. NOTE: test-01's transcript is
  from the LOCAL engine with garbled names ("Heigen"); anchors quote the
  garbles verbatim by design — leave test-01's transcript alone.
- **020 cue pass**: prompt = `steps/020-cue-pass-llm/cue-pass-prompt.md` +
  catalog + transcript. Convention since plan 076: the final LLM output is
  snapshotted to `cues.llm.json` (committed, immutable) BEFORE owner edits —
  `lib/edit-delta.mjs` diffs it against the approved cues.json at fold time.
  Fix-loop: resolve + lint, errors fed back, ≤3 rounds (020 README).
- **030 resolve + lint**: anchor matching, schema validation, non-adjacent
  fullframe overlap, cursor past whole anchor phrases. `lib/lint-cues.mjs`
  machine-enforces the rubric: stat-hit cap/spacing, repetition cap
  (structural cards exempt — see catalog `structural: true`), exclusion zones
  as errors; density cadence/count/word-count as warnings.
- **040 board** (localhost:4322, binds 127.0.0.1, walks ports when taken):
  full-script timeline, live card previews, per-block feedback boxes with the
  full lifecycle (`{text, added, context, applied?, folded?}` — folded items
  are read-only history; unload warns on unsaved feedback), lint results in
  the Save banner (dismissable), DOM-overflow badges on tiles, `/calibrate`
  page rendering every beat card at its declared caps. Save resets `approved`
  when cues actually change (key-order-insensitive compare).
- **050 render**: refuses unapproved (`--force` to override) or stale
  `resolved.json`; staged per-cue renders (data-duration rewrite in a temp
  copy — the ONLY way to set duration), mp4 fullframe / transparent mov
  overlay, ffprobe duration checks, `manifest.md` derived from files on disk
  (so `--only` re-renders never clobber it), pinned hyperframes version.
- **060 feedback-fold** exercised twice on 2026-07-18: 9 owner items captured →
  applied to test-01 AND folded into rules (see TESTS.md "Folded lessons" +
  "Convergence"). Pre-flight: `node lib/feedback-status.mjs` exits 1 while any
  item is unprocessed — run it before ANY new cue pass.
- **card-library**: 42 cards, 11 beat cards. persona-match rebuilt as the
  finale card (gold winner chips); section-counter-scale gained an optional
  logo slot; ALL logos render muted per DESIGN.md's "Tool logos" rule
  (saturate .5, small); section openers carry `structural: true`.
- **070 shot pass** (avatar phase, landed 2026-07-18): after cue approval,
  an LLM pass proposes full-screen avatar spans (`shots.json`, anchored like
  cues; snapshot `shots.llm.json`). `lib/resolve-shots.mjs` + `lib/lint-shots.mjs`
  enforce: ≤300s TOTAL full-screen (E4, no force bypass — the owner's hard
  5-min HeyGen 4 rule), no fullframe-card collisions (E2), ≥12s spans (E3),
  U-curve (W3) and ≤300s host-less cadence gaps (W4 — owner rule, see the
  step's RULEBOOK Learnings row).
- **Board shot lane**: separate labeled minimap lanes (graphics / avatar) with
  a color legend — orange fullframe, sky-blue overlay, violet avatar; shot
  blocks are editable JSON + feedback boxes; "Approve graphics" and "Approve
  shots" are separate gates (owner questioned, then kept: one review sitting,
  two flags — editing cues auto-un-approves shots).
- **080 avatar render**: submit + download verbs over the heygen-web CLI
  (HeyGen 3 templates only; `engineMode: "test"` is the only implementable
  mode — production/HeyGen 4 is a validation error until the owner flips it).
  tp-1 anti-ban pacing, idempotent `avatar-jobs.json`, one-attempt downloads,
  `avatar-manifest.md` (separate from manifest.md on purpose — render.mjs
  rewrites that from disk). `--spans-only` skips the corner track.
- **090 assemble** (plans 082+083, landed 2026-07-18, PRs #39/#40):
  deterministic final-video build — screen recording base track (VO-aligned,
  `videos/<slug>/screen.mp4`, owner-provided, gitignored), avatar spans +
  fullframe graphics swapped in at exact times, overlays composited INSIDE the
  intersecting segment encodes (single-encode path — the final pass is a
  stream-copy concat + vo.mp3 audio mux), hard cuts, `h264_videotoolbox`
  auto-detect (x264 fallback, `--encoder` override), `--draft` = 720p preview
  to `final-draft.mp4`. Output `~/kb-scratch/video/visuals-flow/<slug>/final.mp4`
  + committed `assembly.md` (EDL). Editor handoff bundle unchanged — final.mp4
  is an ADDITIONAL output; per video the owner ships it or hands the bundle
  over. Timings on test-01 (32 min, M2 Pro): old two-pass path ~17 min;
  new draft path 4m23s. Design decisions: decisions.md 2026-07-18 (two
  entries: assembly step, speed pass).

## Where the rules live (five surfaces)

1. `steps/020-cue-pass-llm/RULEBOOK.md` + `cue-pass-prompt.md`: selection
   judgment (density, routing, structural consistency, step-narration,
   pricing consolidation, caps, anchors, brand spelling). Edit BOTH together.
2. `card-library/DESIGN.md`: palette, typography, motion, capacity honesty,
   muted-logo treatment, gold-chip winner pattern.
3. `card-library/catalog.json`: machine-enforced per-card contracts
   (+ `structural` flag). Prefer encoding a lesson here over prose.
4. `lib/lint-cues.mjs`: quantitative selection rules (caps, spacing, zones,
   density) as named constants at the top of the file.
5. `tests/TESTS.md`: findings log, "Folded lessons" provenance, "Convergence"
   metrics (llm vs approved cue counts per video — watch `edited`/`typed` fall).
6. `steps/070-shot-pass-llm/RULEBOOK.md` + `shot-pass-prompt.md` (edit BOTH
   together) + `lib/lint-shots.mjs` constants: the avatar-span equivalents of
   1 and 4. The owner's standing avatar rules live here: ≤5 min total
   full-screen (hard), ≤5 min host-less cadence gaps, U-curve shape.

## Model routing (owner-decided, do not re-litigate)

- 020 cue pass: Sonnet (agy/Gemini approved as a free alternate to trial).
- 070 shot pass: Sonnet-class or better, run in-session via the `visuals-flow`
  skill (pilot ran on Fable 2026-07-18; it's form-filling like 020).
- 080 avatar submits: LIVE HeyGen, owner-run only, owner names the template
  slug (pilot: `girl-1`). HeyGen 3 only — the heygen-web hard rule.
- Novel-card authoring + card redesigns: Opus-class. Antigravity only under
  the recorded render-plus-visual-inspection mitigation (decisions.md 2026-07-07).
- **060 feedback-fold: Opus-class ONLY.** Trigger: owner says "fold the feedback".
- Plan execution (boss): default agy per `tooling/boss/data/rules.md`;
  claude-p sonnet for taste-judged/tricky. Visual output always rendered and
  inspected before landing.

## Immediate state of test-01

- cues.json: 18 cues, `approved: true`, rendered. v2→final owner edits are
  measurable via `node lib/edit-delta.mjs test-01` (baseline `cues.llm.json`).
- feedback.json: 9 items, all `applied` + `folded`. `feedback-status` exits 0.
- **Shot plan: 9 avatar-full spans, 247.7s/300s, lint clean, `approved: true`
  (2026-07-18). Owner approved the LLM output with ZERO edits** (shots.llm.json
  == shots.json — a perfect convergence data point).
- **Avatar pilot COMPLETE 2026-07-18**: `girl-1`, `--spans-only`, HeyGen 3.
  All 9 clips submitted (s03 needed one idempotent retry — transient),
  downloaded to `~/kb-scratch/video/heygen/visuals-flow/test-01/`, durations
  ffprobe-match the spans (±30ms), `avatar-manifest.md` written with place-at
  timecodes. Meter baseline saved (`usage --save`) so the next run's
  free-render proof is a `usage --diff`. Two step bugs found by the pilot are
  fixed + regression-tested (jobs-file flush on retry; swallowed CLI output —
  see TESTS.md folded lessons).
- **ASSEMBLED 2026-07-18 (step 090)**: screen recording built from
  `videos/test-01/src/{intro,body,conclusion}.mp4` (concat re-encode to 30fps
  — durations sum to VO ±0.11s, recorded live by the tutorial maker so
  VO-aligned by construction) → `videos/test-01/screen.mp4`. Full assembly ran
  clean: `~/kb-scratch/video/visuals-flow/test-01/final.mp4` (32:07.6,
  1080p30, AAC, 222.6M, duration == VO exactly) + `final-draft.mp4` (720p,
  4m23s via the 083 speed path) + committed `assembly.md` EDL.
- **Next test-01 actions are OWNER actions**: (a) WATCH final.mp4 — no human
  has seen the full cut; there is no automated final-video QC (final-workflow
  open problem #3). Feedback goes into the board boxes → fold. (b) Decide the
  route: ship final.mp4 as-is, or editor pass (bundle = `renders/` +
  `manifest.md` + avatar clips + `avatar-manifest.md` + `assembly.md`;
  reaction feeds GFX-06).

## In flight

Nothing. Plans 062–083 all boss-landed 2026-07-18 (PRs #19–#40; #39 = step 090
assemble, #40 = the speed pass), the avatar pilot ran to completion (9/9
clips), and test-01 was assembled + speed-validated the same night.
Backlog registry: `plans/README.md` → "visuals-flow backlog" (GFX-01..06
hygiene) + "visuals-flow PRODUCT backlog" (GFX-07..15 roadmap).

## Open items (canonical list = GFX rows in plans/README.md)

**Owner verdict on the POC (2026-07-18): successful, output decent. Direction:
keep improving — tighten rules, add capabilities — via new-session
brainstorms.** Standing next steps in priority order:

1. **Owner QC watch of test-01 final.mp4** + route decision (ship vs editor) —
   see "Immediate state" above. Whatever the watch surfaces becomes board
   feedback → the 060 fold.
2. **Editor handoff + feedback intake** (`GFX-06` open) if the editor route is
   chosen; fold what comes back.
3. **Video #2 end-to-end** — exercises convergence metrics + the fold loop on
   fresh content; the flow is now two owner sittings (approve graphics,
   approve shots) plus the HeyGen green-light and the QC watch.
4. **Title/thumbnail packaging loop** — highest-ROI NEW build per
   personal-stuff-frontier (Front 1 #2); brainstorm via `orchestrate` when the
   owner asks.
5. **Corner avatar track** — owner-DEFERRED (spans-only). When it lands, it
   composites through `planSegmentOverlays` (see plan 083 maintenance notes),
   not a new pass.
6. **Global play-through on the board** (`GFX-08`, owner-deferred).
7. **agy cue-pass trial** (`GFX-11`): unblocked — lint is the objective rubric half.
8. **Density calibration**: not a task; the 060 fold loop + Convergence
   metrics do this across the first few real videos.
9. **Aesthetic visual QC beyond overflow** (`GFX-10`): open problem, revisit
   only with a cheap mechanism.
10. **edit-delta for shots** (`GFX-13`): fold into the first post-pilot touch
    (note: pilot v1 had ZERO owner edits, so there was nothing to diff yet).

## How to run (quick reference)

```
cd pipelines/video/visuals-flow
node lib/feedback-status.mjs                       # MUST exit 0 before any new cue pass
bash steps/010-transcribe-run/run.sh <slug-or-path>
# 020: Sonnet session with steps/020-cue-pass-llm/cue-pass-prompt.md (the prompt only;
#      RULEBOOK.md is the 060 fold's archive). Fill placeholders with catalog.json +
#      `node lib/transcript-text.mjs <slug>` output (never raw transcript.json)
#      -> videos/<slug>/cues.json, then snapshot to cues.llm.json after the
#      fix-loop converges
node lib/resolve.mjs <slug>
node lib/lint-cues.mjs <slug>                      # errors -> feed back to 020, <=3 rounds
node lib/board.mjs [<slug>]                        # review at :4322, Save/Approve (+ /calibrate)
node lib/render.mjs <slug> [--quality draft]       # refuses unapproved/stale; --force exists
node lib/edit-delta.mjs <slug>                     # owner-edit diff for the fold
# 070 (after cues approved): Sonnet session with steps/070-shot-pass-llm/shot-pass-prompt.md
#      (the prompt only). Inputs: fullframe cue times + `node lib/transcript-text.mjs <slug>`
#      output -> videos/<slug>/shots.json, snapshot shots.llm.json
node lib/resolve-shots.mjs <slug>                  # anchors -> shots.resolved.json
node lib/lint-shots.mjs <slug>                     # budget/overlap/U-curve; errors -> back to 070
#      then board: review shot lane, "Approve shots"
bash steps/080-avatar-render-run/run.sh <slug> --template <registry-slug> --submit [--spans-only]  # OWNER-RUN (live HeyGen; --spans-only skips the corner track)
bash steps/080-avatar-render-run/run.sh <slug> --download                            # re-run until no "pending:"
# 090 (needs videos/<slug>/screen.mp4, VO-aligned, owner-provided):
bash steps/090-assemble-run/run.sh <slug> [--draft] [--encoder x264|videotoolbox]    # -> kb-scratch final.mp4 (+ assembly.md EDL); --draft = 720p final-draft.mp4
bash scripts/check.sh                              # flow gate
(cd ../card-library && bash scripts/beat-smoke.sh) # card gate
```

Test log, folded lessons, convergence metrics: `tests/TESTS.md`. Per-video data
convention: `videos/<slug>/` (text committed, media gitignored).
