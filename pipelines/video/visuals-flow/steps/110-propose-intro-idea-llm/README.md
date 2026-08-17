# 110 · propose the intro idea · [LLM]

Proposes 2-3 competing visual directions for the intro film, one prose page
each — no beats, no timings, no code. Reviewed and approved at
`120-approve-intro-idea-human` before `130-author-intro-screenplay-llm` writes a
single beat.

## Why it lives before 025

Before this step, the intro's idea, its beats and every timing were decided in
the same pass. The owner's only checkpoint was after the composition was
built and encoded. See `IDEA-PASS.md` for the incident this step exists to
catch.

## In → out

| In | From |
|---|---|
| `transcript.json` | `010-transcribe-run` |
| `segments.json` | `015-map-segments-run` — the measured intro span |
| `concept.json` | `020-choose-concept-llm` — the through-line to enact |

Out: `videos/<slug>/intro-film/idea.json` +
`videos/<slug>/intro-film/teasers/<id>/index.html` + `<id>.mp4` per direction

## Every direction ships a moving teaser, not a still (2026-08-17)

A page of prose is the cheapest possible rejection, but prose cannot show a
look — three directions described in words all sound reasonable, and the owner
was approving words, then rejecting the finished film ("i dont like the entire
intro. i need to do entire intro again from scratch."). An AI-generated still
(owner ask, 2026-08-13) was the right instinct but the wrong artifact: it is
neither the brand nor the renderer nor the motion.

So alongside `idea.json`, author one real six-second Hyperframes teaser per
direction — the film in miniature, in the REAL composition system:

```
videos/<slug>/intro-film/teasers/<id>/index.html
```

See `IDEA-PASS.md`'s "Every direction ships a teaser" section for the exact
contract (canvas, duration, arc-banner requirement). Then:

```bash
bash run.sh <slug> intro-teasers
```

That lints every direction (refusing to render one at the wrong length, canvas
or arc coverage) and renders each to `<id>.mp4`. `120` cannot approve a
direction whose teaser was never rendered — see `lib/board.mjs`'s
`handleApproveIntroIdea`.

If the owner rejects every direction, the board's `/reject-intro-idea` moves
them into `idea.json`'s `rejected` array with the owner's own note and bumps
`round`. See `IDEA-PASS.md`'s "If the owner rejects every direction" section.

## Verbs

| Verb | Does |
|---|---|
| `run.sh <slug> intro-idea` | prints the authoring contract (`IDEA-PASS.md`) |
| `run.sh <slug> intro-teasers` | lints + renders one 6s teaser per proposed direction |

## What consumes the output

`120-approve-intro-idea-human` is the owner gate on `idea.json`, judged by
watching each direction's teaser. Once approved, `130-author-intro-screenplay-llm`
reads `chosen` and authors beats for that direction only — see the note added
near the top of its `AUTHORING.md`.
