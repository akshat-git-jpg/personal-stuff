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

Out: `videos/<slug>/intro-film/idea.json`

## Give the owner a FRAME per direction, not just a page (owner ask 2026-08-13)

A page of prose is the cheapest possible rejection, which is why this step is
prose-only — but prose is a poor way to judge a **look**, and the owner is
choosing between directions on exactly that. So alongside `idea.json`, write one
image-generation prompt file per competing direction:

```
videos/<slug>/intro-film/idea-previews/<idea-id>.md
```

Use the same format as the new-card look preview: `---` on its own line between
key moments, a `##` heading as a label for the owner (never sent to the
generator), and the prompt body built from the template in
`card-library/DESIGN.md` ("New-card checklist", item 0). Then:

```bash
bash run.sh <slug> previews
```

That pushes them to the `flow-queue` relay; the ZAPI FLOW extension loads them
into its Google Flow queue by itself, so the owner opens Flow and hits generate
with nothing to copy. Format + rules: `tooling/cli/flow-queue/README.md`.

This does not change the gate. `120` still approves `idea.json` — the frames are
there so the owner can SEE each direction before picking one.

## Verbs

| Verb | Does |
|---|---|
| `run.sh <slug> intro-idea` | prints the authoring contract (`IDEA-PASS.md`) |

## What consumes the output

`120-approve-intro-idea-human` is the owner gate on `idea.json`. Once approved,
`130-author-intro-screenplay-llm` reads `chosen` and authors beats for that
direction only — see the note added near the top of its `AUTHORING.md`.
