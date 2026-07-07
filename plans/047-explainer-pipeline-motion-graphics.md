---
executor: agy
model:
test_cmd: find pipelines/youtube/explainer-videos-pipeline-1/4-motion-graphics -name "*.md" | xargs -I{} test -s {}
ui: true
deploy:
needs: ["044", "046"]
---

# Plan 047: explainer-videos-pipeline-1 — 4-motion-graphics stage

## Summary

- **Problem statement**: `4-motion-graphics/` is empty. This pipeline needs a
  step that plans timed visual cues from a named competitor channel's
  `video-style-dna.md`, a step that authors and renders those cues as a
  Hyperframes composition timed to the voiceover, and a human review gate.
- **Goals**:
  - `010-plan-visuals-opus/`: rulebook.md — reads `video-style-dna.md` +
    script + the voiceover's timestamped transcript, hard-stops if the named
    channel's video-style-dna.md is missing, produces a timed visual plan
    targeting the voiceover's EXACT total duration.
  - `020-build-graphics-agy/`: rulebook.md — authors a Hyperframes
    composition per the plan and renders it, explicitly skipping the
    interactive preview-approval pause (unattended step; human reviews after,
    at 030), using `hyperframes snapshot` as the pre-render visual smoke test
    instead.
  - `030-review-visuals-human/`: README documenting the human gate.
- **Executor proposed**: `agy` (owner's explicit instruction for this whole
  build — note this is a `tricky`-graded plan under the normal difficulty
  rubric; the owner's override still applies).
- **Done criteria**: all 3 step folders have README.md + rulebook.md; both
  rulebooks name the exact CLI commands (verified against
  `hyperframes-cli`'s own SKILL.md) and the exact hard-stop / duration-target
  contract.
- **Stop conditions**: none beyond per-step specifics (this plan authors
  instructions, it does not run a real Hyperframes build — no channel/topic
  has been named yet).
- **Test / verification for success**: structural check only (every file
  non-empty, required sections present) — this plan's deliverables are prose
  instructions, not code; there is nothing to `py_compile`. `ui: true` in the
  frontmatter because `020`'s eventual real runs produce rendered video that
  must be visually inspected — flagged here so boss's crew brief requires
  that evidence when this pipeline is actually used.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5a11eac..HEAD -- pipelines/youtube/explainer-videos-pipeline-1/4-motion-graphics`
> Expect empty. STOP if `pipelines/youtube/explainer-videos-pipeline-1/3-voiceover/050-make-timestamped-transcript-run/README.md`
> does not exist yet (plan 046 dependency — this plan's rulebooks reference its output path).

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED (creative-composition contract; duration-matching is the
  main correctness risk, mitigated by an explicit target + post-render check).
  **Known, deliberate override**: `020-build-graphics-agy` routes runtime
  graphics-building to the Antigravity CLI, which conflicts with a recorded
  2026-07-05 finding that Antigravity produced poor-quality graphics in a
  prior proof-of-concept (`decisions.md`, "keep Antigravity out of the
  graphics path" — why `tutorial-pipeline-2`'s own 135-build-graphics runs on
  Sonnet instead). Owner was shown this conflict directly and chose to
  proceed with `agy` anyway (2026-07-07) — see the matching `decisions.md`
  entry. Mitigation: the mandatory render + visual inspection in this step's
  rulebook, plus the human review gate at `030`.
- **Depends on**: 044, 046
- **Category**: feature
- **Difficulty**: tricky (real judgment even fully spec'd — a cheap model
  here would normally buy fix-up rounds; owner has explicitly overridden to
  `agy` anyway for this whole build)
- **Planned at**: commit `5a11eac`, 2026-07-07

## Why this matters

This is the pipeline's core creative-visual stage and the one most exposed to
the inverted sync model (voiceover drives timing, not the other way around).
Getting the duration-target contract right here is what lets stage 5's mux
step be a pure assert-and-mux with no retiming math.

## Current state

- `pipelines/youtube/explainer-videos-pipeline-1/4-motion-graphics/` is empty.
- `pipelines/.claude/skills/hyperframes-cli/SKILL.md` (read yourself in full —
  path: `/Users/kbtg/.claude-personal/skills/hyperframes-cli/SKILL.md` or
  wherever it resolves via the `hyperframes-cli` skill in this session) —
  verified command set for the non-interactive/agent path:
  - `npx hyperframes init <name>` (or `--example`/`--non-interactive` in CI —
    non-TTY is auto-detected and requires `--example`)
  - `npx hyperframes lint`, `npx hyperframes validate`, `npx hyperframes inspect`
  - **Visual smoke test (the CI/agent substitute for the interactive
    `preview` pause)**: `npx hyperframes snapshot --at <t1>,<t2>,...` or
    `--frames N` → `snapshots/frame-NN-at-Xs.png`. This is the skill's own
    documented "Minimum Completion Gate" for non-interactive contexts — using
    it instead of `preview` is not a safety bypass, it's the skill's own
    prescribed agent path.
  - `npx hyperframes render --quality high --output <path>` — reports success
    via exit code + stdout only; verify with
    `[ -s "$OUTPUT" ] && ffprobe -i "$OUTPUT" -show_format -v error`.
  - The skill's own text: *"Render is user-gated. Never auto-render once the
    checks pass. Pause at `preview` … render only after they approve."* — this
    applies to INTERACTIVE authoring sessions. `020`'s rulebook must say
    explicitly: this is an unattended pipeline step (no one is at Studio to
    click approve), so it substitutes `snapshot` for `preview` and renders
    immediately after a clean snapshot inspection; human review happens
    afterward at `030`, matching `tutorial-pipeline-2`'s own precedent
    (`135-build-graphics-sonnet` already auto-renders before its human review
    at `140`).
- `pipelines/youtube/tutorial-pipeline-2/5-visuals/130-plan-visuals-sonnet/README.md`
  and `5-visuals/135-build-graphics-sonnet/README.md` (both already read in
  full during design) are the closest exemplars for this stage's two-step
  shape (plan → build), adapted here to `[OPUS]`/`[AGY]` tags and the inverted
  timing model.
- Duration source: `../../3-voiceover/050-make-timestamped-transcript-run/output/<base>.timestamps.json`
  (plan 046's output) — its Groq `segments` array's last entry's `end` field
  (seconds) is the voiceover's total duration. `010`'s plan must target this
  exact number; `020`'s render must hit it within ±0.5s (same tolerance as
  plan 048's mux-step assertion, so a render that already passes here will
  also pass there).
- Default video spec (from the design doc): 1920×1080 @ 30fps, unless the
  named channel's `video-style-dna.md` Identity-snapshot section indicates a
  different aspect ratio (e.g. vertical) — if so, the rulebook must say to
  flag this to the human at `030` rather than silently deviating.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Confirm folder empty before starting | `find pipelines/youtube/explainer-videos-pipeline-1/4-motion-graphics -type f` | zero output |
| Non-empty file check (this plan's own verify) | `find pipelines/youtube/explainer-videos-pipeline-1/4-motion-graphics -name "*.md" \| xargs -I{} test -s {}` | exit 0 for every file |

## Scope

**In scope**:
- `pipelines/youtube/explainer-videos-pipeline-1/4-motion-graphics/010-plan-visuals-opus/{README.md,rulebook.md}`
- `pipelines/youtube/explainer-videos-pipeline-1/4-motion-graphics/020-build-graphics-agy/{README.md,rulebook.md}`
- `pipelines/youtube/explainer-videos-pipeline-1/4-motion-graphics/030-review-visuals-human/README.md`

**Out of scope**:
- Any real Hyperframes project scaffold, composition HTML, or rendered
  MP4/PNG — no channel/topic has been named yet; this plan authors
  instructions only.
- `pipelines/.claude/skills/hyperframes-cli/` or any other hyperframes skill —
  read-only reference, never edit.
- `pipelines/youtube/competitor-styles/` contents.

## Git workflow

- Branch: `boss/047-explainer-motion-graphics`
- Commit: `feat(explainer-pipeline-1): 4-motion-graphics stage (plan-visuals, build-graphics, review)` — no AI footers. Do NOT push.

## Steps

### Step 1: `010-plan-visuals-opus/`

Write `README.md`:

```markdown
# 4/010 · plan-visuals  ·  [OPUS]

Produces a timed visual plan (cue list) from a named competitor channel's
`video-style-dna.md`, the approved script, and the voiceover's timestamped
transcript. Run in a Claude Code session on model **Opus** (`/model opus` first).

- **In:** `--slug <channel>` + `../../3-voiceover/050-make-timestamped-transcript-run/output/<base>.timestamps.json`
  + `../../2-scripting/030-clean-script-for-tts-run/output/<base>.tts-ready.txt`
- **Out:** `output/<base>.visual-plan.md` (timed cues, total duration = voiceover's exact duration)
- **How:** Claude applies `rulebook.md`.
- **Hard-stop:** if `pipelines/youtube/competitor-styles/channels/<slug>/video-style-dna.md`
  does not exist, STOP and tell the user to run yt-style-copy's
  `build-video-style-dna <slug>` first.
- **Next:** step 020 (build-graphics) renders this plan.
```

Write `rulebook.md`:

```markdown
# Rulebook — 4/010 plan-visuals

Run in a Claude Code session on model Opus.

1. Take `--slug <channel>` from the operator.
2. Check `pipelines/youtube/competitor-styles/channels/<slug>/video-style-dna.md`
   exists. If not, STOP and tell the operator: "No video-style-dna.md for
   '<slug>'. Run yt-style-copy build-video-style-dna <slug> first (requires
   video-metrics.json to be non-empty), then re-run this step." Do not proceed.
3. Read the voiceover's total duration: the LAST segment's `end` value in
   `../../3-voiceover/050-make-timestamped-transcript-run/output/<base>.timestamps.json`.
   This exact number (seconds) is your target — the plan's cues must sum to
   it, not approximate it.
4. Read the approved script
   (`../../2-scripting/030-clean-script-for-tts-run/output/<base>.tts-ready.txt`)
   and the timestamped transcript's segments for wording-to-timestamp alignment.
5. Read `video-style-dna.md`'s sections: Cut pacing (cuts-per-minute — this
   sets how many cues you plan, roughly `duration_minutes * cuts_per_minute`),
   B-roll patterns, On-screen text & captions, Motion graphics & animation,
   Framing & composition, Do-not list. Note the Identity-snapshot's visual
   format/aspect-ratio; if it implies anything other than 1920×1080 landscape,
   flag this explicitly in the plan's header for the human to confirm at 030.
6. Write `output/<base>.visual-plan.md`: an ordered list of cues, each with
   `start` / `end` timestamps (matching the voiceover's own segment
   boundaries where natural), an `intent` (what's on screen — kinetic
   typography / stat callout / B-roll-style graphic / transition), and which
   `video-style-dna.md` pattern it imitates (cite the section). The LAST
   cue's `end` must equal the voiceover's total duration from step 3, exactly.
7. Report to the operator: cue count, target duration, and any aspect-ratio
   flag from step 5.
```

**Verify**: `test -s pipelines/youtube/explainer-videos-pipeline-1/4-motion-graphics/010-plan-visuals-opus/rulebook.md && test -s pipelines/youtube/explainer-videos-pipeline-1/4-motion-graphics/010-plan-visuals-opus/README.md && echo ok` → `ok`.

### Step 2: `020-build-graphics-agy/`

Write `README.md`:

```markdown
# 4/020 · build-graphics  ·  [AGY · Antigravity CLI]

Authors and renders the Hyperframes composition per `010`'s visual plan. Runs
via the Antigravity CLI (`agy`) — this is an UNATTENDED step; it renders
without pausing for interactive Studio approval (see rulebook.md for why),
with human review happening afterward at `030`.

- **In:** `../010-plan-visuals-opus/output/<base>.visual-plan.md`
- **Out:** `output/<base>.motion.mp4` (rendered composition, duration exactly
  matching the voiceover) + `output/snapshots/` (the pre-render visual smoke test)
- **How:** follows `rulebook.md`. MUST render and inspect the actual output
  (post-render ffprobe duration check + eyeball the snapshots) before being
  considered done — an unrendered or unchecked composition is not done.
- **Next:** step 030 (human review), then `../../5-final-video-sync/010` muxes this with the voiceover.
```

Write `rulebook.md`:

```markdown
# Rulebook — 4/020 build-graphics

Runs via the Antigravity CLI. This step is UNATTENDED — no one is at Studio
to click approve, so it substitutes `hyperframes snapshot` for the
interactive `preview` pause that hyperframes-cli's own docs describe for
attended authoring sessions (see `hyperframes-cli` SKILL.md's own "Minimum
Completion Gate" for non-interactive contexts — this is the prescribed
agent-mode path, not a bypass of it). Human review happens AFTER render, at
step `030`, matching how `tutorial-pipeline-2`'s `135-build-graphics-sonnet`
already renders before its own human review at `140`.

1. If no Hyperframes project exists yet in this step's folder, scaffold one:
   `npx hyperframes init hf-project --non-interactive --example` inside
   `020-build-graphics-agy/`. Reuse the same `hf-project/` across runs — only
   the composition HTML content changes per video.
2. Read `../010-plan-visuals-opus/output/<base>.visual-plan.md`. Author the
   composition's HTML per the `hyperframes-core` skill's composition
   contract, one scene/sub-composition per cue, using the runtime/animation
   adapter that best fits each cue's intent (see `hyperframes-animation` for
   blueprints — GSAP is the default runtime). Set the project's total
   duration to the plan's target duration exactly (from the plan's last cue's
   `end` timestamp).
3. Static gates: `npx hyperframes lint` and `npx hyperframes validate` — both
   must pass clean before continuing.
4. Visual smoke test (the unattended substitute for `preview`):
   `npx hyperframes snapshot --frames 9` (or `--at <cue-timestamps>` if you
   want one frame per cue instead of an even sample). Inspect every frame in
   `snapshots/` against the visual plan's stated intent per cue — this is the
   actual "look at it" requirement; do not skip it or treat a clean `lint`/
   `validate` as sufficient on its own.
5. Render: `npx hyperframes render --quality high --output ../output/<base>.motion.mp4`.
6. Post-render verification (required, not optional):
   ```bash
   [ -s ../output/<base>.motion.mp4 ] || echo "render produced no output"
   ffprobe -i ../output/<base>.motion.mp4 -show_format -v error
   ```
   Compare the reported duration against the plan's target duration (from
   `010`'s output). If they differ by more than 0.5 seconds, the composition's
   timeline length is wrong — fix the composition's duration setting and
   re-render; do not proceed with a mismatched render (stage 5's mux step
   will hard-fail on it anyway, so catching it here saves a round-trip).
7. Copy the smoke-test snapshots into `output/snapshots/` (keep them — they're
   the evidence the human reviewer at `030` and any later verifier looks at).
8. Report: cue count rendered, final duration vs target, snapshot count, and
   run `npx hyperframes feedback --rating <1-5> --comment "..."` once per the
   hyperframes-cli skill's own convention.
```

**Verify**: `test -s pipelines/youtube/explainer-videos-pipeline-1/4-motion-graphics/020-build-graphics-agy/rulebook.md && test -s pipelines/youtube/explainer-videos-pipeline-1/4-motion-graphics/020-build-graphics-agy/README.md && echo ok` → `ok`.

### Step 3: `030-review-visuals-human/`

Write `README.md`:

```markdown
# 4/030 · review-visuals  ·  [HUMAN]

Watch `../020-build-graphics-agy/output/<base>.motion.mp4` in full (not just
the snapshots) alongside the voiceover.

## Checklist
- [ ] Every cue matches its stated intent from `../010-plan-visuals-opus/output/<base>.visual-plan.md`.
- [ ] No text spilling off-canvas or unstyled elements (the failure modes
      `hyperframes lint`/`validate`/`inspect` catch structurally, but a human
      eye catches the ones that only show up in motion).
- [ ] Overall duration matches the voiceover (already asserted mechanically at
      build time and again at `5-final-video-sync/010` — this is a final
      human sanity check, not the only guardrail).
- [ ] If `010` flagged a non-1920×1080 aspect ratio from the channel's
      video-style-dna.md, confirm that's actually what you want here.

**You approve → proceed to `../../5-final-video-sync/010` (mux-final-video).**

If something's wrong: fix the composition in `../020-build-graphics-agy/hf-project/`
and re-run that step's render (Steps 5–6 of its rulebook) — no need to
re-plan from `010` unless the ISSUE is with the plan itself (wrong cue
timing/intent), not the execution.
```

**Verify**: `test -s pipelines/youtube/explainer-videos-pipeline-1/4-motion-graphics/030-review-visuals-human/README.md && echo ok` → `ok`.

## Test plan

No code in this plan's deliverables (all prose instructions) — verification
is structural (every file exists and is non-empty) plus a careful read-back
confirming the exact CLI commands match `hyperframes-cli`'s own documented
syntax (already verified against the skill's SKILL.md during planning).

## Done criteria

- [ ] All 3 step folders exist with their required files, all non-empty
- [ ] `010`'s rulebook states the exact hard-stop message and the exact
      duration-target source (last segment's `end` in step 046's timestamps.json)
- [ ] `020`'s rulebook states the exact lint/validate/snapshot/render/verify
      command sequence and the explicit render-gate-override rationale
- [ ] `030`'s README gives the human a concrete checklist, not just "review it"

## STOP conditions

- `3-voiceover/050-make-timestamped-transcript-run/README.md` missing (plan
  046 not landed) — this plan's rulebooks reference its exact output path;
  stop and report if absent
- Any file already exists under `4-motion-graphics/` before Step 1 — stop, report, do not overwrite

## Maintenance notes

- If `hyperframes-cli`'s command syntax changes (e.g. `snapshot` flags,
  `render` output flag), update `020`'s rulebook to match — it's the one file
  in this plan with load-bearing exact CLI commands.
- The 0.5s duration tolerance is shared with plan 048's mux-step assertion —
  if that tolerance ever changes, change it in both places (048's `run.py`
  and this plan's rulebook Step 6) so a render that passes here also passes there.
