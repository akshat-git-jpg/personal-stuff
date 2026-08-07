# 140 · review intro frames · [RUN]

The pre-render review pass for the bespoke intro film, split out of the old
`027-approve-intro-film-human` folder (plan 199) so a review always happens
before the approval gate (150) rather than as a sibling verb rendering could
skip.

Rendering the film to inspect it costs minutes and is the wrong artifact to
review: hyperframes can seek and screenshot without encoding, so this pass
does the whole design review before a single frame is encoded — three sample
frames per beat, each paired with that beat's `stage` line.

- **In:** `videos/<slug>/intro-film/screenplay.json` (from 130)
- **Out:** `intro-film/review/REVIEW.md` + stills, `intro-film/review/check.json`
- **Run:** `bash run.sh <slug> intro-review`

Refresh this after any change to the screenplay — the owner reviews on the
board's Intro tab before approving at 150.
