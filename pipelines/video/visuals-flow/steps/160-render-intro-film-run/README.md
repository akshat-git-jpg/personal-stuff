# 160 · render the intro film · [RUN]

The 67-second encode of the approved intro screenplay, split out of the old
`027-approve-intro-film-human` folder (plan 199) so a session cannot render a
film nobody reviewed by treating rendering and approval as sibling verbs.

No approval check runs here on purpose — rendering is how the owner GETS a
film to watch, and gating it behind approval deadlocked the review (see
`lib/intro-film/approve.mjs`). The approval gate is enforced downstream, at
assembly (`requireIntroApproved()` in `lib/assemble.mjs`), so an unapproved
film can be rendered and watched but never cut into the video.

- **In:** `videos/<slug>/intro-film/screenplay.json`
- **Out:** `intro-film/out/intro.mp4`
- **Run:** `bash run.sh <slug> intro-render`
