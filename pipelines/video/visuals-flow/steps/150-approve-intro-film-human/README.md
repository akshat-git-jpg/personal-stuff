# 150 · approve the intro film · [OWNER]

The owner's approval of the bespoke intro film authored at
`130-author-intro-screenplay-llm` and reviewed at `140-review-intro-frames-run`.
It exists only for videos whose `run-config.json` carries `intro: "film"` — a
`cards` video never reaches this gate.

Split out of the old `140-review-intro-frames-run` folder (plan 199): that
folder held a cheap review, this approval gate, and a 67-second render all as
sibling verbs, so nothing stopped rendering a film nobody had reviewed. The
review is now its own prior step (140) and the render is its own step after
approval (160).

- **In:** `videos/<slug>/intro-film/screenplay.json` + the review renders under
  `videos/<slug>/intro-film/review/`
- **Out:** `approved: true` in `intro-film/screenplay.json`
- **Where:** the **Intro** tab of the board
- **Waivable:** no — and since plan 194 removed express review, no gate in this
  pipeline is waivable at all. A film nobody has watched must not reach a cut.

## What you judge

The film as a film: does the opening hold, does the type read at speed, does it
land on the video's through-line. It is one bespoke composition, not a sequence
of cards, so there is no per-cue review here — you either approve the
screenplay or send notes back to 130.

Before approving, run `bash run.sh <slug> intro-review` (140) to build the
review renders, then `bash run.sh <slug> intro-render` (160) once approved.
