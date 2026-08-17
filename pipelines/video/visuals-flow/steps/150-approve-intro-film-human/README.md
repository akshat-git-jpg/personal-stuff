# 150 · approve the intro film · [OWNER]

The owner's approval of the bespoke intro film authored at
`130-author-intro-screenplay-llm` and reviewed at `140-review-intro-frames-run`.
It exists only for videos whose `run-config.json` carries `intro: "film"` — a
`cards` video never reaches this gate.

Split out of the old `140-review-intro-frames-run` folder (plan 199): that
folder held a cheap review, this approval gate, and a 67-second render all as
sibling verbs. The review is now its own prior step (140) and the render is its
own step (160).

**160 runs BEFORE this gate, not after.** Rendering is how the owner gets a film
to watch, so `render-film.mjs` carries no approval check on purpose — gating it
behind approval deadlocked the review. Approval is enforced downstream instead,
by `requireIntroApproved()` in `lib/assemble.mjs`: an unapproved film can be
rendered and watched, but never cut into the video. See
`steps/160-render-intro-film-run/README.md`.

- **In:** `videos/<slug>/intro-film/screenplay.json`, the review renders under
  `videos/<slug>/intro-film/review/`, and `intro-film/out/intro.mp4` from 160
- **Out:** `approved: true` in `intro-film/screenplay.json`
- **Where:** the **Intro** tab of the board
- **Waivable:** no — and since plan 194 removed express review, no gate in this
  pipeline is waivable at all. A film nobody has watched must not reach a cut.

## What you judge

The film as a film: does the opening hold, does the type read at speed, does it
land on the video's through-line. It is one bespoke composition, not a sequence
of cards, so there is no per-cue review here — you either approve the
screenplay or send notes back to 130.

## You judge two artifacts, and the board serves both

Run both before approving — 140 for the stills, then 160 for the mp4:

```bash
bash run.sh <slug> intro-review    # 140 — ~15s: 37 stills + the mechanical findings
bash run.sh <slug> intro-render    # 160 — ~67s: intro-film/out/intro.mp4
```

The Intro tab then serves `/intro-frames` and `/intro-video` side by side
(`lib/board.mjs`). They answer different questions and neither replaces the
other:

| Artifact | Answers |
|---|---|
| the stills in `review/` | is the DESIGN right — each frame is printed under the beat's `stage` line, so intent and picture can be read against each other, and `REVIEW.md` lists what the machine caught (occlusion, overflow, contrast, runtime errors) |
| `out/intro.mp4` | does it WORK IN MOTION — pacing, holds, whether the type reads at speed |
