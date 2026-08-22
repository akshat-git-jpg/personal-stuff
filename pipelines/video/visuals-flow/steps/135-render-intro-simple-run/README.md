# 135 · render the intro cut list · [RUN]

Turns an intro-simple/cutlist.json into `intro-film/out/intro.mp4` — the same
output path the complex flow's 160/440 write to (see
`lib/intro-film/approve.mjs`'s `APPROVAL_FILE` comment for why the path keeps
the word "film" even on the simple flow).

Refuses to render a cut list that fails its own pacing lint
(`lib/intro-kit/lint-cutlist.mjs`, codes S1-S7) — rendering an unlinted cut
list is how a bad intro reaches the owner. No approval check here on purpose,
mirroring 160: rendering is how the owner GETS a cut to watch, and gating it
behind approval deadlocked the review (see `steps/125-approve-intro-simple-human/README.md`).

- **In:** `videos/<slug>/intro-simple/cutlist.json`
- **Out:** `intro-film/out/intro.mp4`
- **Run:** `bash run.sh <slug> intro-simple-render`

Before a real avatar.mp4 exists, this renders against a static stand-in image
(the same convention the complex flow uses) — `445-rerender-intro-simple-run`
swaps in the real avatar clip once it downloads.

Cheap check first: `bash run.sh <slug> intro-simple-lint` prints the S1-S7
pacing report without rendering anything.
