# 130-author-intro-screenplay-llm — the intro as one authored film

**OFF by default.** This step only runs when the video's `run-config.json` says
`"intro": "film"`. Opt in with:

```
bash run.sh <slug> configure --intro film
```

Every video that has not opted in behaves exactly as it did before this step
existed. The `intro-*` verbs refuse with an opt-in message.

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
splice over the intro span automatically when `introOwnedByFilm()` is true.
