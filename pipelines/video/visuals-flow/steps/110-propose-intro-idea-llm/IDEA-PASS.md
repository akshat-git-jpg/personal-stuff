## Your job

Propose 2-3 competing visual DIRECTIONS for `<slug>`'s intro film, one page
each, and write them to `videos/<slug>/intro-film/idea.json`. You are choosing
and rejecting an IDEA here — not writing beats, not deciding timings, not
touching code. That happens at `130-author-intro-screenplay-llm`, and only after the
owner has approved one of the directions you propose.

**Why this step exists**: the intro's visual idea used to be invented inside
the screenplay pass, at the same time as every beat and timing. The owner's
only checkpoint was after a full composition had been built and encoded. On
2026-08-07 that produced a seal drawn as a progressively-filling accent
arc — the screenplay had asked for *"an arc that is clearly incomplete by the
end of the beat"*, which is the construction every loading spinner uses. A
one-page idea gate would have cost a minute to reject; instead it cost a build,
an encode and a round of owner review. Text is the cheapest thing to reject in
this pipeline.

## Inputs

- **`transcript.json`** — word-level timings from `010-transcribe-run`. Use
  `introWords()` from `lib/intro-film/inputs.mjs`.
- **`segments.json`** — the measured intro span from `015-map-segments-run`.
  Use `introSpan()`.
- **`concept.json`** — the video's `throughline` and `registers` from
  `020-choose-concept-llm`. Every direction must enact the throughline; quote
  it.

## What each direction must carry

- **The central object** — the one thing on stage that carries the film, and
  what it IS (a card, a frame, a column). One noun.
- **Its arc** — how that object transforms across the intro's beats, in three
  to five clauses. This is the idea; everything else is decoration.
- **The motif vocabulary** — the two or three visual moves the film is allowed
  to reuse, named.
- **How it enacts the through-line** from `concept.json`, quoted.
- **What it deliberately does NOT do** — the nearest obvious treatment it
  rejects, and why.

## The one prohibition that exists to catch a specific defect

> **Never propose a form whose meaning is "not finished".** A dashed outline
> means "drop content here". A grey figure means "no avatar set". An arc
> filling a ring means "loading". These are the agreed signs for *nothing is
> here yet*, and used as final art they tell the viewer the film is unfinished
> whatever you intended. This includes a gesture deliberately left incomplete
> for a later beat to finish: **every visual form of "incomplete" is a
> placeholder or a wait state** — that is what incomplete means. If a beat
> needs a payoff, give the later beat a NEW object to deliver, never the
> completion of a half-drawn one. (Owner, three times on one film: dashed
> sponsor wells and grey silhouettes 2026-08-06, the drawing seal 2026-08-07.
> See `TASTE-INTRO.md` T12.)

## Output shape — `intro-film/idea.json`

```json
{
  "video": "<slug>",
  "chosen": null,
  "directions": [
    {
      "id": "a",
      "name": "<3-5 words>",
      "central_object": "<one noun>",
      "arc": ["<clause>", "<clause>", "<clause>"],
      "motifs": ["<move>", "<move>"],
      "enacts_throughline": "<how, quoting concept.json>",
      "rejects": "<the obvious treatment this refuses, and why>"
    }
  ]
}
```

Write 2 or 3 `directions`, each genuinely different — not the same idea in
different colours. `chosen` and `approved` are set by the owner at the next
step (`120-approve-intro-idea-human`), never by you.

## Never in scope here

`catalog.json`, `card-plan.json`, `cues.json`, or any card template — same
prohibition as the film-authoring step, for the same reason: the intro keeps
full creative freedom, and a catalog in scope quietly turns proposing into
picking.
