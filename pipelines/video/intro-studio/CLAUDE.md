# intro-studio — how to operate here

## What this is

A standalone proof of concept. It builds one video's intro as a single
authored Hyperframes composition — one continuous stage, objects that carry
across beats, a colour register that shifts on the story's turn, and the
presenter's face composed INTO the design rather than laid over footage.

## The one hard rule

**Never edit `../visuals-flow-2/` or `../card-library/` from here.** This
pipeline exists so the owner can evaluate a new intro approach with zero risk
to the working pipeline. The two systems meet at exactly one place: this one
emits `videos/<slug>/out/intro.mp4`, and the owner drops that file into their
edit by hand. There is no code path between them.

Reading `../card-library/DESIGN.md` and `../card-library/logos/registry.json` is
not just allowed, it is required — the first film was authored without them and
looked nothing like the channel. The rule is no WRITES, and no card templates
influencing the composition. The design system is the brand, not a template.

## Entry point

- `bash run.sh <slug> status` — artifact table, names the next step
- `bash run.sh <slug> <step>` — dispatch a step

## Review before you render

`bash run.sh <slug> review` is the loop. About two minutes, no encode:

- hyperframes `check` at every transition seam — occluded text, overflow,
  contrast, runtime errors
- `check-film-style` — the DESIGN.md type contract, plus any beat with no
  motion of its own
- one frame at the MIDPOINT of every beat, plus `review/REVIEW.md` pairing each
  frame with the `stage` line it is supposed to satisfy

Render last. Every visual defect found in this pipeline so far was visible in a
still, and reviewing the mp4 instead cost minutes per look.

`check` only works because the composition's media is linked into the project
directory (`lib/film-assets.mjs`). With a `../` asset path, lint errors, the
layout pass never samples, and the report says `layout: ok` from zero samples.
If you ever see a suspiciously clean report, check the sample count.

## Taste

[TASTE.md](TASTE.md) — what the owner has rejected on screen, as numbered rules.
Every piece of feedback lands there. Rules a machine can state also become
checks; the rest are author judgement and will not be caught for you.

## Gate

`bash scripts/check.sh` — must be green before any commit.
