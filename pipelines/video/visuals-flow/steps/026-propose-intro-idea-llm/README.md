# 026-propose-intro-idea-llm — the intro idea, before any beat exists

Proposes 2-3 competing visual directions for the intro film, one prose page
each — no beats, no timings, no code. Reviewed and approved at
`028-approve-intro-idea-human` before `025-author-intro-film-llm` writes a
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

## Verbs

| Verb | Does |
|---|---|
| `run.sh <slug> intro-idea` | prints the authoring contract (`IDEA-PASS.md`) |

## What consumes the output

`028-approve-intro-idea-human` is the owner gate on `idea.json`. Once approved,
`025-author-intro-film-llm` reads `chosen` and authors beats for that
direction only — see the note added near the top of its `AUTHORING.md`.
