# Avatar / screen-recording shot plan for visuals-flow (GFX-07)

Date: 2026-07-18 (brainstormed with owner; all open questions resolved)
Status: approved design, awaiting implementation plan via `orchestrate`
Extends: `docs/specs/2026-07-17-motion-graphics-beat-sync-design.md` (the graphics half of the same per-video flow)
Renames: `pipelines/video/graphics-flow/` → `pipelines/video/visuals-flow/` (owner-picked; the folder now plans everything on screen, not just graphics)

## Problem

graphics-flow proved the beat-synced graphics loop end to end (test-01, 2026-07-18).
But graphics are one layer of a final-workflow video — the rest of the screen is a
host avatar and screen recording, and today nothing decides which shows when. GFX-07
(the deliberately-unscheduled next phase): decide per stretch of the video whether
avatar video or screen recording shows, with durations — and, per the owner's scope
call in this session, **also render the avatar clips**, not just plan them.

The tutorial pipelines solved a pre-TTS version of this (tutorial-pipeline-2 steps
060/130): avatar blocks chosen from the script by word-count estimate because no audio
existed yet. Here the VO already exists with word timestamps and the graphics cues are
already approved — so the shot plan can be exact-time and graphics-aware.

## Decisions (owner-confirmed 2026-07-18)

| Decision | Choice | Why |
|---|---|---|
| Output scope | Plan **+ avatar render** | Approved spans drive generation: VO slices → HeyGen jobs → clips in the editor manifest. Screen recording stays human-captured; the plan only marks where it shows. |
| Visual model | Corner avatar baseline + full-screen spans | Same grammar as tutorial-pipeline-2: a corner avatar rides over screen recording the whole video; the plan picks only the full-screen host moments. A human is always on screen. |
| Decider | Separate LLM pass (Sonnet), running **after cue approval** | Owner delegated; taken for the long view: the proven 020 cue pass stays untouched, the two rulebooks evolve independently through the 060 fold loop, and the shot pass reads `resolved.json` so it can plan around fullframe cards (which would hide a paid full-screen avatar). |
| Data home | `shots.json`, a sibling of `cues.json` (+ immutable `shots.llm.json` snapshot) | `cues.json` is a stable three-consumer contract; avatar work must not be able to break the graphics flow. Same snapshot/edit-delta convention as cues. |
| Span addressing | Transcript anchors (verbatim phrases), not raw timecodes | Exactly how cues work — reuses the resolver, board display, and staleness machinery; LLMs quote phrases reliably and invent floats badly; anchors survive small VO shifts. |
| Review surface | The existing board (localhost:4322) | `buildSegments()` in `lib/board.mjs` was built with this seam — shot spans become the third segment kind. Feedback lifecycle, lint banner, and approve gate come for free; owner reviews the whole video on one timeline. |
| Corner track | **One full-length render** (owner overrode the in-parts proposal) | Editor drops one file at 0:00 and forgets it. If HeyGen's per-render ceiling forces chunking, chunks are contiguous (nothing skipped) and the manifest gives drop-at timecodes. Duplicate-host moments during full-screen spans are the editor's cut, by design. |
| Engines | **Test mode (current default): every span renders on HeyGen 3 via template.** Production mode: full-screen spans switch to HeyGen 4; corner stays HeyGen 3 | HeyGen 4 is metered (~$1/min). The owner flips the flag **only by explicit request** once satisfied and working on a real production video — nothing auto-switches. Spec it like the render gate: a named `engineMode` field, `"test"` until then. |
| Generation path | Template-based via `heygen-web generate-from-template --audio <slice>` | HAR-verified in tutorial-pipeline-1 (steps 030/040 submit + poll + download); character/template ids resolve from `video/heygen/registry.json`, never hardcoded. |
| Home | Inside the (renamed) visuals-flow pipeline | Everything the shot pass touches lives there: transcript, approved cues, resolver, lint pattern, board, fold loop. The render step is a thin hub consumer, which is the heygen hub's intended contract. |

## Architecture

Two new steps and one extended surface, mirroring the graphics conventions 1:1:

```
010 transcribe ──► 020 cue pass ──► 030 resolve+lint ──► 040 board (cues approved)
                                                              │
                          ┌───────────────────────────────────┘
                          ▼
                070 shot pass [LLM, Sonnet]
                  transcript.json + resolved.json + shot rulebook
                  → shots.json (snapshot → shots.llm.json)
                          │
                          ▼
                030-style resolve + lint (reused lib, shot rules)
                  → shots.resolved.json
                          │
                          ▼
                040 board, same server: shot spans = third segment kind
                  owner feedback → feedback.json (same lifecycle) → approve
                          │
                          ▼
                080 avatar render [RUN]
                  slice vo.mp3 per span (ffmpeg, exact times)
                  + full-length corner slice (= whole vo.mp3)
                  → heygen-web generate-from-template (submit → poll → download)
                  → ~/kb-scratch/video/heygen/visuals-flow/<slug>/ + RENDERS.md rows
                  → avatar-manifest.md (place-at honors `offset`)

050 graphics render and 080 avatar render are independent; 060 feedback-fold
(Opus) folds BOTH rulebooks — shot-plan feedback joins the same
never-repeat-a-mistake loop.
```

Step numbering note: 060 keeps its name (feedback-fold) even though 070/080 run
before it chronologically per video; the fold step is cross-video, not a flow stage.
The implementation plan may renumber if it's cheap; not load-bearing.

## shots.json schema (drafted here; README of the flow becomes the single home, same rule as cues.json)

```json
{
  "video": "test-01",
  "approved": false,
  "engineMode": "test",
  "spans": [
    {
      "id": "s01",
      "kind": "avatar-full",
      "from_anchor": "I put five of the biggest",
      "to_anchor": "so let's get into it",
      "note": "intro — front-load",
      "flagged": false
    }
  ]
}
```

- `from_anchor` / `to_anchor` — verbatim transcript phrases (≥3 words, garbled ASR
  quoted verbatim, same rule as cues). The span runs from the first word of
  `from_anchor` to the last word of `to_anchor`; the resolver snaps to word
  timestamps and emits absolute `start`/`end` in `shots.resolved.json`.
- `kind` — `"avatar-full"` only, for now. Everything not covered by a span is
  implicitly screen-rec + corner avatar (the baseline needs no rows). The enum
  exists so future kinds (e.g. explicit b-roll marks) are additive.
- `engineMode` — `"test"` (all spans → HeyGen 3 template) or `"production"`
  (avatar-full → HeyGen 4, corner → HeyGen 3). Default `"test"`; flipped only on
  explicit owner instruction.
- `flagged` — mirrors cues: the LLM marks a span it wants but can't place cleanly.
- The corner track is not a span — it's a standing output of step 080 (full VO length).

## Shot rulebook (step 070) — seeded from tutorial-pipeline-2's 060 rulebook

Ported with the estimation machinery deleted (real timestamps exist):

- **Knobs as config, not prose**: `AVATAR_FULL_CAP` (hard ceiling, from the HeyGen 4
  limit — matters in production mode), `AVATAR_FULL_TARGET`, `AVATAR_DISTRIBUTION`
  (default U-curve: heavy intro + overview, lean demo middle, heavy verdict/wrap/outro).
- **Placement priority**: intro/overview → conclusion/summary → per-tool verdicts
  (shrinking) → pricing wrap → last-resort mid-demo beats.
- **Graphics-aware**: never propose an avatar-full span overlapping a fullframe cue.
  Overlay cards MAY play over a full-screen avatar (lower-thirds etc.) — only
  fullframe conflicts are violations.
- Fix-loop identical to 020: resolve + lint, errors fed back, ≤3 rounds.

## Lint rules (named constants, `lint-shots` alongside `lint-cues.mjs`)

Errors: span overlaps a fullframe cue; spans overlap each other; anchor unresolved;
span below minimum length (tiny HeyGen jobs are waste); total avatar-full over
`AVATAR_FULL_CAP`.
Warnings: distribution shape off the U-curve (front/back share thresholds); total
under target; span not starting near a sentence boundary.

## Render step (080) contracts

- Refuses unapproved `shots.json` or stale `shots.resolved.json` (`--force` exists) —
  mirrors 050. Staleness also covers the cues: if `cues.json` changed after shot
  approval, that's stale (shot plan was made against those cues).
- Media policy: clips land in `~/kb-scratch/video/heygen/visuals-flow/<slug>/`, one
  `RENDERS.md` row each; never in the repo. Avatar clips get their own
  `avatar-manifest.md` derived from job state (same derive-from-disk spirit as
  graphics), place-at timecodes honoring `offset` — a separate file because
  `render.mjs` rewrites `manifest.md` from disk on every graphics run and would
  clobber an appended section (decided during plan authoring, plan 080).
- Submit → poll → download reuses tutorial-pipeline-1's proven pattern
  (030/040 steps) via `heygen-web`; anti-ban rules in that CLI's CLAUDE.md apply.

## Rename mechanics (part of the same plan)

`git mv pipelines/video/graphics-flow pipelines/video/visuals-flow` + update every
reference: `pipelines/CLAUDE.md` folder map, root `CLAUDE.md` routing hits (if any),
`INTEGRATION.md` self-references, `HANDOFF.md`, `plans/README.md` GFX rows,
`tests/TESTS.md`, card-library cross-links, and a dated `decisions.md` entry. The
GFX-nn backlog prefix stays (it's an id, not a path).

## First test

test-01 already has an approved, rendered cue set and a word-timestamped transcript —
it's the shot-plan pilot. Run 070 → board review → 080 in test mode (HeyGen 3
everywhere), hand the avatar clips + avatar-manifest.md to the editor along with the
graphics renders already pending handoff.

## Open questions for the implementation plan (verify, don't guess)

1. HeyGen 3 per-render length ceiling → corner-track chunk size (contiguous chunks
   if needed; invisible to the design).
2. Which `registry.json` slug/template this channel's host uses (owner confirms at
   pilot time — the render step takes `--template <slug>` with no default).
3. Whether `heygen-web` needs a new subcommand for long-audio corner renders or the
   template path already accepts them.

Recon facts recorded 2026-07-18 (they narrow scope, not change it): `heygen-web`'s
standing hard rule is **Avatar III only** (its CLAUDE.md), and
`generate-from-audio --engine heygen4` is an unimplemented `[TODO]` in the CLI.
So test mode is the only implementable mode today — exactly the owner's gate. The
production flip (full-screen → HeyGen 4) therefore requires, when the owner asks
for it: implementing the HeyGen 4 path in `heygen-web` AND amending that CLI's
Avatar III-only rule. Until then `engineMode: "production"` is a validation error,
not a dormant code path.

## What this is NOT

- Not screen-recording capture automation — recording stays human; the plan only
  marks where screen-rec shows (and the editor already gets narration context from
  the transcript).
- Not b-roll/zoom planning (tutorial-pipeline-2 step 130 vocabulary beyond
  avatar-full is out of scope until a real video demands it).
- Not final assembly — the editor still owns the timeline; every output is clips +
  manifest timecodes, same contract as graphics.
