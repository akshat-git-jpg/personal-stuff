# 115 · author the intro cut list · [LLM]

The simple flow's authoring step (plan 220). Runs only when `run-config.json`
has `introMode: "simple"` — the default for a new video since plan 218/220
(decisions.md 2026-08-22). A video set to `introMode: "complex"` skips this
step entirely and walks the bespoke-film track (110-160) instead.

The design decision that makes this flow fast: **the authoring model writes a
cut list, not a composition.** It picks a card slug per beat from the locked
kit of 7 (`../intro-kit/kit.json`) and fills that card's variables. It never
invents a treatment, never writes HTML, and never proposes competing
directions — that is the whole difference from the complex flow, where
authoring a bespoke Hyperframes film IS the step.

## In → out

| In | From |
|---|---|
| `transcript.json` | `020-transcribe-run`, already through its quality pass |
| `segments.json` | `040-split-narration-demo-run` — the measured intro span |
| `concept.json` | `050-choose-concept-llm` — the through-line |
| `../intro-kit/kit.json` | plan 219's locked 7-card kit (the schema) |

Out: `videos/<slug>/intro-simple/cutlist.json`

## Verbs

| Verb | Does |
|---|---|
| `run.sh <slug> intro-simple` | prints `SIMPLE-PASS.md`, the authoring contract |

Read `SIMPLE-PASS.md` in this folder before authoring — it is blunt on
purpose: no continuity requirement between beats, every on-screen word comes
from `transcript.json` via `introWords()`, and the pacing lint
(`lib/intro-kit/lint-cutlist.mjs`, codes S1-S7) is a gate, not a suggestion.

## What consumes the output

`125-approve-intro-simple-human` is the owner's gate on it,
`135-render-intro-simple-run` turns an approved cut list into
`intro-film/out/intro.mp4` — the same output path the complex flow's
160/440 write to, so `assemble.mjs` and `export-timeline.mjs` stay mode-blind.
