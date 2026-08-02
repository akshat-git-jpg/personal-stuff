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

## Entry point

- `bash run.sh <slug> status` — artifact table, names the next step
- `bash run.sh <slug> <step>` — dispatch a step

## Gate

`bash scripts/check.sh` — must be green before any commit.
