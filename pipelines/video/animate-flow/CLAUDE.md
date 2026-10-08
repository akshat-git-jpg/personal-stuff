# animate-flow — how to operate here

The free-design video-edit recipe. For each moment worth a graphic, a model designs a custom
hyperframes motion graphic in a swappable design system; the kit assembles the cut; the owner
comments on it; the lessons land in `TASTE-ANIMATE.md`. The opposite of visuals-flow's
template recipe, which picks pre-built cards.

Operate it through the `yt-animate` skill (verbs) and `yt-animate-feedback` (the fold).
Steps, inputs and outputs: [PIPELINE.md](PIPELINE.md).

## The one rule: judgment isolation

This recipe's judgment must never be shaped by another recipe's, and the other way round.

- **By construction.** 030 and 040 run `claude -p` from a sealed stage outside the repo
  (`~/kb-scratch/video/animate-flow/<slug>/stage/<step>/`) holding only that step's inputs, with
  `--setting-sources project`. No repo `CLAUDE.md`, skill or memory is reachable. `sealStage()`
  refuses to start a run if any staged path or authored text names something this recipe bans,
  and writes `stage-manifest.json`, the record of what the model could see.
- **By test.** `visuals-flow/recipe-isolation.json` scope `animate` bans the template recipe's
  judgment files from this folder, the two skills and `design-systems/`; the template and
  intro scopes ban this recipe's taste. `lib/imports.test.mjs` pins the only code this recipe
  takes from visuals-flow.
- **Feedback** for an animate video folds into `TASTE-ANIMATE.md` or the design system, never
  anywhere else (090).

## What it reuses, and why that is safe

| From | What | Why it carries no taste |
|---|---|---|
| `visuals-flow/lib/kit/` (via `lib/kit.mjs`) | edit plan, assembly core, hyperframes check/snapshot/render, version registry | the kit's own gate keeps recipe judgment out of it |
| `visuals-flow/lib/transcribe-groq.mjs` (spawned) | audio to timed words | speech recognition only |
| `visuals-flow/recipe-isolation.json` (read) | the banned-name list `sealStage()` checks | one list for the test and the stage |
| `card-library/logos/` (staged) | brand logo files and registry | brand facts, not card templates |

## Where things live

| What | Where |
|---|---|
| Text artifacts (committed) | `videos/<slug>/`: run-config, transcript, moments, `moments/<id>/index.html`, feedback |
| Media, stages, renders, cuts | `~/kb-scratch/video/animate-flow/<slug>/` (`ANIMATE_MEDIA_ROOT` overrides) |
| Design systems | `pipelines/video/design-systems/<name>/` (shared, swappable per run) |

## Run

`bash run.sh <slug> <verb>` or, on any OS, `node lib/run.mjs <slug> <verb>`. Node >= 22 (for
hyperframes), ffmpeg, and the `claude` CLI on PATH (`ANIMATE_CLAUDE_CMD` overrides).

Gate: `bash scripts/check.sh`.

## Not in v1 (on purpose)

Captions, transitions, avatar, take-cutting and vertical output. The kit supports a vertical
canvas (`--canvas 1080x1920`) and an avatar clip kind; wiring them in is a later step.
