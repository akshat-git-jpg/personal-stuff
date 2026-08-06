# 027 · approve intro film · [HUMAN]

The owner's approval of the bespoke intro film authored at
`025-author-intro-film-llm`. It exists only for videos whose `run-config.json`
carries `intro: "film"` — a `cards` video never reaches this gate.

This folder was missing for a while even though the gate was live: the board
already records it (`lib/board.mjs` calls `recordGate(workdir, '027', …)` when
the owner approves the film) and `PIPELINE.md` already listed it. Since
`lib/run-log.mjs` refuses a ledger key that is not a step in the registry, the
board's own write was the one thing keeping the number honest. The folder is
the registry entry.

- **In:** `videos/<slug>/intro-film/screenplay.json` + the review renders under
  `videos/<slug>/intro-film/review/`
- **Out:** `approved: true` in `intro-film/screenplay.json`
- **Where:** the **Intro** tab of the board
- **Waivable:** no. `run-config review=express` waives the 037 and 080 board
  approvals only; a film nobody has watched must not be rendered into a cut.

## What you judge

The film as a film: does the opening hold, does the type read at speed, does it
land on the video's through-line. It is one bespoke composition, not a sequence
of cards, so there is no per-cue review here — you either approve the
screenplay or send notes back to 025.

## The two verbs on this step

    bash run.sh <slug> intro-review    # build/refresh the review renders
    bash run.sh <slug> intro-render    # render the approved film (refuses until approved)

`intro-render` calls `requireIntroApproved()` first, so this gate is enforced in
code and not only on the board.
