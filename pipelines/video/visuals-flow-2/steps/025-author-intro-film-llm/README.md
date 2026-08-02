# 025-author-intro-film-llm — the intro as one authored film

**OFF by default.** This step only runs when the video's `run-config.json` says
`"intro": "film"`. Opt in with:

```
bash run.sh <slug> configure --intro film
```

Every video that has not opted in behaves exactly as it did before this step
existed. The three `intro-*` verbs refuse with an opt-in message.

## What it does

Builds the video's intro as ONE bespoke Hyperframes composition — one continuous
stage, objects that carry across beats, a colour register that shifts on the
story's turn, and the presenter composed INTO the design — instead of a sequence
of cards.

## In → out

| In | From |
|---|---|
| `transcript.json` | `010-transcribe-run`, already through its quality pass |
| `segments.json` | `015-map-segments-run` — the measured intro span |
| `concept.json` | `020-choose-concept-llm` — the through-line and register map |
| `../card-library/DESIGN.md` | the brand contract, read-only |
| `../card-library/logos/registry.json` | real product logos, read-only |

Out: `videos/<slug>/intro-film/out/intro.mp4`

**Never in scope**: `catalog.json`, `card-plan.json`, `cues.json`, or any card
template. See AUTHORING.md — this is the owner's hard constraint and it is
enforced by a test.

## Verbs

| Verb | Does |
|---|---|
| `run.sh <slug> intro-film` | prints the authoring prompt |
| `run.sh <slug> intro-review` | pre-render review: layout/contrast check + 3 frames per beat + `REVIEW.md` |
| `run.sh <slug> intro-render` | renders and gates. The LAST step, not the review step |

## Why it lives here rather than standalone

The standalone POC re-derived its own inputs and paid for it: it transcribed the
intro itself and put four of five product names wrong on screen, and it invented
a visual motif that would have broken the seam into the body. Both inputs already
exist, correct, in this pipeline. That is the whole reason for the move.

## What consumes the output

Nothing yet. The owner drops `intro-film/out/intro.mp4` into the edit by hand,
exactly as with the standalone POC. Making the pipeline consume it — and making
the zone pass, the cue lints and the assembler stand down on the intro span — is
a separate plan, because it changes what a normal video produces.
