# visuals-flow handoff (2026-07-18, post end-to-end run)

For the next session picking this up. Everything below was true and verified on
2026-07-18 (evening). Read PIPELINE.md first if you have never seen this
pipeline; read this doc for where things actually stand and what is open.
**The owner's stated next phase is the avatar/screen-recording shot plan —
see Open items #1.**

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

## Model routing (owner-decided, do not re-litigate)

- 020 cue pass: Sonnet (agy/Gemini approved as a free alternate to trial).
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
- Only open action: editor handoff of `renders/` + `manifest.md`, then fold
  whatever the editor reports (GFX-06 will get its shape from that).

## In flight

Nothing. Plans 062–076 all boss-landed as of 2026-07-18 (PRs #19–#33).
Backlog registry: `plans/README.md` → "visuals-flow backlog" (GFX-01..06
hygiene) + "visuals-flow PRODUCT backlog" (GFX-07..12 roadmap).

## Open items (canonical list = GFX rows in plans/README.md)

1. **Avatar/screen-recording shot plan** (`GFX-07`, the owner's next phase —
   START WITH A BRAINSTORM/DESIGN SESSION via `orchestrate`, schema was
   deliberately never invented): decide per stretch of the video whether
   avatar video or screen recording shows, plus layout hints, with durations.
   The board was built for this: `buildSegments()` in `lib/board.mjs` is the
   seam; shot spans become a third segment kind (or gap attributes) in the
   same timeline — gap blocks are deliberately untyped today. Prior art:
   `pipelines/youtube/tutorial-pipeline-1/` and `-2/` (avatar-block plans,
   segment maps). New machinery that helps: feedback lifecycle + lint are in
   place, so the shot plan can get its own review/lint pass on the same board.
2. **Editor handoff + feedback intake** (`GFX-09` done for render; `GFX-06`
   open): give the editor `renders/` + `manifest.md`, fold what comes back.
3. **Global play-through on the board** (`GFX-08`, owner-deferred).
4. **agy cue-pass trial** (`GFX-11`): unblocked — lint is the objective rubric half.
5. **Density calibration**: not a task; the 060 fold loop + Convergence
   metrics do this across the first few real videos.
6. **Aesthetic visual QC beyond overflow** (`GFX-10`): open problem, revisit
   only with a cheap mechanism.
7. **visuals-flow operating skill** (`GFX-12`): thin run/board/fold trigger
   router; write now that 069–076 landed; check overlap with
   `video-and-tts-reference` first.

## How to run (quick reference)

```
cd pipelines/video/visuals-flow
node lib/feedback-status.mjs                       # MUST exit 0 before any new cue pass
bash steps/010-transcribe-run/run.sh <slug-or-path>
# 020: Sonnet session with steps/020-cue-pass-llm/cue-pass-prompt.md
#      (+ catalog.json + transcript text) -> videos/<slug>/cues.json,
#      then snapshot to cues.llm.json after the fix-loop converges
node lib/resolve.mjs <slug>
node lib/lint-cues.mjs <slug>                      # errors -> feed back to 020, <=3 rounds
node lib/board.mjs [<slug>]                        # review at :4322, Save/Approve (+ /calibrate)
node lib/render.mjs <slug> [--quality draft]       # refuses unapproved/stale; --force exists
node lib/edit-delta.mjs <slug>                     # owner-edit diff for the fold
bash scripts/check.sh                              # flow gate
(cd ../card-library && bash scripts/beat-smoke.sh) # card gate
```

Test log, folded lessons, convergence metrics: `tests/TESTS.md`. Per-video data
convention: `videos/<slug>/` (text committed, media gitignored).
