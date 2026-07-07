---
executor: agy
model:
test_cmd: find pipelines/youtube/explainer-videos-pipeline-1/6-thumbnail -name "*.md" | xargs -I{} test -s {}
ui: true
deploy:
needs: ["044"]
---

# Plan 049: explainer-videos-pipeline-1 — 6-thumbnail stage

## Summary

- **Problem statement**: `6-thumbnail/` is empty. This pipeline needs a step
  that generates a YouTube thumbnail styled per a named competitor channel's
  `video-style-dna.md` "Thumbnail style" section, via a Hyperframes snapshot
  (there is no generic "render one frame" mode — `snapshot` is the mechanism).
- **Goals**: `010-generate-thumbnail-opus/`: rulebook.md — hard-stops if the
  named channel's video-style-dna.md is missing, authors a short/single-frame
  Hyperframes composition styled per its Thumbnail-style section, snapshots
  it, converts to a 1280×720 JPG.
- **Executor proposed**: `agy` (owner's explicit instruction for this whole build).
- **Done criteria**: step folder has README.md + rulebook.md, non-empty, with
  the exact `snapshot`-based mechanism (not a nonexistent "render frame" mode)
  and the exact hard-stop contract.
- **Stop conditions**: none beyond per-step specifics (this plan authors
  instructions only — no channel/topic has been named yet).
- **Test / verification for success**: structural check (files exist,
  non-empty); no code to `py_compile` — this is a rulebook, not a script.
  `ui: true` because its real runs produce an image a human must look at.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5a11eac..HEAD -- pipelines/youtube/explainer-videos-pipeline-1/6-thumbnail`
> Expect empty.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW-MED (creative-composition contract, same class of risk as
  plan 047's build-graphics but much smaller surface — one static frame, not
  a timed sequence)
- **Depends on**: 044 (only needs the pipeline scaffold + manifest contract;
  independent of the voiceover/motion-graphics stages — can run any time
  after `0-input`)
- **Category**: feature
- **Difficulty**: tricky (real creative judgment even fully spec'd; owner's
  agy override still applies)
- **Planned at**: commit `5a11eac`, 2026-07-07

## Why this matters

The thumbnail is independently styleable from the video itself (a separate
`--slug` choice, confirmed by design) and is the single most viewed asset for
a YouTube video before a click — getting the exact rendering mechanism right
(snapshot, not a nonexistent render-frame mode) avoids the executor guessing
at a CLI flag that doesn't exist.

## Current state

- `pipelines/youtube/explainer-videos-pipeline-1/6-thumbnail/` is empty.
- `pipelines/.claude/skills/hyperframes-cli/SKILL.md` (already read in full
  during plan 047's authoring) confirms: there is no generic "render one
  static frame" command. The mechanism is
  `npx hyperframes snapshot --at <t>` (or `--frames N`), which "loads the
  project the same way `render` does … but only captures the timestamps you
  request" — output lands at `snapshots/frame-NN-at-Xs.png`. This plan's
  rulebook must use `snapshot`, never invent a "render --frame" flag.
- `pipelines/.claude/skills/yt-style-copy/SKILL.md` (already read in full) —
  `build-video-style-dna`'s synthesized `video-style-dna.md` includes a
  **"Thumbnail style"** section: "composition/color/text patterns across the
  reviewed videos' frames" — this is the exact section this step's rulebook
  reads from. There is no separate thumbnail-suggestion verb in
  `yt-style-copy` (owner decision, this batch: defer that enhancement to
  later — this plan does not depend on it or wait for it).
- Same hard-stop policy as plans 045/047: if `video-style-dna.md` is missing
  for the named channel, stop and name the `build-video-style-dna` verb —
  never auto-trigger it.
- Target output: 1280×720 JPG (YouTube's standard thumbnail spec) — the
  Hyperframes snapshot produces a PNG at the project's own canvas
  resolution; convert with ffmpeg if the project canvas isn't already
  1280×720.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Confirm folder empty before starting | `find pipelines/youtube/explainer-videos-pipeline-1/6-thumbnail -type f` | zero output |
| Non-empty file check (this plan's own verify) | `find pipelines/youtube/explainer-videos-pipeline-1/6-thumbnail -name "*.md" \| xargs -I{} test -s {}` | exit 0 for every file |

## Scope

**In scope**:
- `pipelines/youtube/explainer-videos-pipeline-1/6-thumbnail/010-generate-thumbnail-opus/{README.md,rulebook.md}`

**Out of scope**:
- A real Hyperframes composition, snapshot, or JPG file — no channel/topic
  named yet; this plan authors instructions only.
- The deferred `yt-style-copy` thumbnail-suggestion verb — explicitly out of
  scope for this batch (owner: "ignore thumbnail part for now, we will do later").
- `pipelines/.claude/skills/hyperframes-cli/` or `yt-style-copy/` — read-only reference.

## Git workflow

- Branch: `boss/049-explainer-thumbnail`
- Commit: `feat(explainer-pipeline-1): 6-thumbnail stage (generate-thumbnail via Hyperframes snapshot)` — no AI footers. Do NOT push.

## Steps

### Step 1: `010-generate-thumbnail-opus/`

Write `README.md`:

```markdown
# 6/010 · generate-thumbnail  ·  [OPUS]

Generates a YouTube thumbnail (1280×720 JPG) styled per a named competitor
channel's `video-style-dna.md` "Thumbnail style" section, via a Hyperframes
snapshot. Run in a Claude Code session on model **Opus** (`/model opus` first).

- **In:** `--slug <channel>` (independent choice from `2-scripting` and
  `4-motion-graphics`'s own slugs — by design, confirmed in the pipeline design doc)
- **Out:** `output/<base>.thumbnail.jpg` (1280×720)
- **How:** Claude applies `rulebook.md`.
- **Hard-stop:** if `pipelines/youtube/competitor-styles/channels/<slug>/video-style-dna.md`
  does not exist, STOP and tell the user to run yt-style-copy's
  `build-video-style-dna <slug>` first.
- **Next:** step 7-upload/010 packages this alongside the final MP4.
```

Write `rulebook.md`:

```markdown
# Rulebook — 6/010 generate-thumbnail

Run in a Claude Code session on model Opus.

1. Take `--slug <channel>` from the operator.
2. Check `pipelines/youtube/competitor-styles/channels/<slug>/video-style-dna.md`
   exists. If not, STOP and tell the operator: "No video-style-dna.md for
   '<slug>'. Run yt-style-copy build-video-style-dna <slug> first, then
   re-run this step." Do not proceed.
3. Read `video-style-dna.md`'s **"Thumbnail style"** section (composition,
   color, text patterns) and its `frames/exemplars/` directory (representative
   frame images already saved from that channel's own videos) for visual reference.
4. If no Hyperframes project exists yet in this step's folder, scaffold one:
   `npx hyperframes init hf-project --non-interactive --example` inside
   `010-generate-thumbnail-opus/`. Reuse the same `hf-project/` across runs.
5. Author a SHORT composition (a few seconds is enough — you only need one
   good frame) at 1280×720 canvas, matching the Thumbnail-style section's
   composition/color/text patterns, using this video's topic/title text and
   the pipeline's own brand voice — do not copy the competitor's specific
   claims or text verbatim, only the STYLE (composition, color grading, text
   treatment), per the same style-vs-facts guardrail `yt-style-copy` itself
   enforces for scripts.
6. Static gates: `npx hyperframes lint` and `npx hyperframes validate` — both
   must pass clean.
7. Snapshot the frame you want (there is no generic "render one frame" mode —
   `snapshot` is the mechanism): `npx hyperframes snapshot --at 1.0` (adjust
   the timestamp to whichever moment in your short composition looks best).
   Output lands at `snapshots/frame-01-at-1.0s.png`.
8. Eyeball the snapshot. If the canvas isn't already 1280×720, convert:
   `ffmpeg -y -i snapshots/frame-01-at-1.0s.png -vf scale=1280:720 ../output/<base>.thumbnail.jpg`
   (if it's already 1280×720, a plain format conversion is enough — same command works either way).
9. Verify: `[ -s ../output/<base>.thumbnail.jpg ]` and confirm its dimensions
   with `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 ../output/<base>.thumbnail.jpg`
   — expect `1280,720`.
10. Report to the operator: the slug used, the composition idea, and the
    final image path.
```

**Verify**: `test -s pipelines/youtube/explainer-videos-pipeline-1/6-thumbnail/010-generate-thumbnail-opus/rulebook.md && test -s pipelines/youtube/explainer-videos-pipeline-1/6-thumbnail/010-generate-thumbnail-opus/README.md && echo ok` → `ok`.

## Test plan

No code in this plan's deliverable (a rulebook, not a script). Verification
is structural (files exist, non-empty) plus a careful confirmation that the
rulebook's CLI commands (`init`, `lint`, `validate`, `snapshot`, `ffmpeg`
scale) are all real, already-verified commands — no invented flags.

## Done criteria

- [ ] `010-generate-thumbnail-opus/{README.md,rulebook.md}` exist, both non-empty
- [ ] Rulebook uses `hyperframes snapshot`, never a nonexistent "render frame" flag
- [ ] Rulebook states the exact hard-stop message naming `build-video-style-dna`
- [ ] Rulebook states the exact 1280×720 output contract and its ffprobe verification command

## STOP conditions

- Any file already exists under `6-thumbnail/` before Step 1 — stop, report, do not overwrite

## Maintenance notes

- When the deferred `yt-style-copy` thumbnail-suggestion verb (owner:
  "we will do later") eventually lands, this rulebook's Step 3 should be
  updated to consume its structured suggestions instead of reading the
  Thumbnail-style prose section directly — track that as a follow-up plan,
  not a silent edit to this one.
- If `hyperframes-cli`'s `snapshot` command syntax changes, update Step 7 here.
