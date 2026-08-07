# 130 · author the intro screenplay · [LLM]

**Always on.** Every video's intro is a bespoke film — there is no opt-in and no
alternative (owner decision 2026-08-07, plan 194: *"i want film only.., basically
intro is bespook"*). The `run-config.json` `intro` field, the `--intro` flag and
the catalog-cards intro flow it selected are all gone.

Reads the direction approved at `120-approve-intro-idea-human` and writes the
beats that enact it. The idea is already decided by the time you get here.

## What it does

Authors the video's intro as ONE bespoke Hyperframes composition — one continuous
stage, objects that carry across beats, a colour register that shifts on the
story's turn, and the presenter composed INTO the design — instead of a sequence
of cards.

## In → out

| In | From |
|---|---|
| `transcript.json` | `020-transcribe-run`, already through its quality pass |
| `segments.json` | `040-split-narration-demo-run` — the measured intro span |
| `concept.json` | `050-choose-concept-llm` — the through-line and register map |
| `../card-library/DESIGN.md` | the brand contract, read-only |
| `../card-library/logos/registry.json` | real product logos, read-only |

Out: `videos/<slug>/intro-film/screenplay.json`

**Never in scope**: `catalog.json`, `card-plan.json`, `cues.json`, or any card
template. See AUTHORING.md — this is the owner's hard constraint and it is
enforced by a test.

## Verbs

| Verb | Does |
|---|---|
| `run.sh <slug> intro-film` | prints the authoring prompt |

Review (`intro-review`, 140), approval (150) and the render itself
(`intro-render`, 160) are separate steps downstream — splitting them out is
what stops a film nobody reviewed from reaching render.

## Why it lives here rather than standalone

The standalone POC re-derived its own inputs and paid for it: it transcribed the
intro itself and put four of five product names wrong on screen, and it invented
a visual motif that would have broken the seam into the body. Both inputs already
exist, correct, in this pipeline. That is the whole reason for the move.

## What consumes the output

`140-review-intro-frames-run` renders stills against `intro-film/screenplay.json`
for review, `150-approve-intro-film-human` is the owner's gate on it, and
`160-render-intro-film-run` is what turns the approved screenplay into
`intro-film/out/intro.mp4` — which `assemble.mjs` and `export-timeline.mjs`
splice over the intro span automatically — the span comes from `introSpan()`
(`lib/intro-modes.mjs`), which reads the measured intro part from
`segments.json`. There is no longer a predicate to satisfy: the film owns the
intro on every video.
