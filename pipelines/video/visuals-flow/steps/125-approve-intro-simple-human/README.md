# 125 · approve the intro cut list · [OWNER]

The owner's approval of the simple-flow cut list authored at
`115-author-intro-simple-llm`. Mirrors `150-approve-intro-film-human` in the
complex flow — same door, different file.

**135 runs BEFORE this gate, not after** — same reason 160 runs before 150 in
the complex flow. Rendering is how the owner gets a cut to watch, so
`render-simple.mjs` carries no approval check on purpose (gating it behind
approval deadlocked the review the exact same way it did for the film, owner
report 2026-08-06). Approval is enforced downstream instead, by
`requireIntroApproved()` in `lib/assemble.mjs`: an unapproved cut list can be
rendered and watched, but never cut into the video.

- **In:** `videos/<slug>/intro-simple/cutlist.json`, and `intro-film/out/intro.mp4`
  from 135 (not a declared `consumes` — see the step.json comment on why)
- **Out:** `approved: true` in `intro-simple/cutlist.json`
- **Where:** the **Intro** tab of the board
- **Waivable:** no — a cut nobody has watched must not reach a cut (same rule
  as the complex flow, since plan 194 removed express review entirely).

```bash
bash run.sh <slug> intro-simple-render    # 135 — renders intro-film/out/intro.mp4
```

Then approve on the board's Intro tab.
