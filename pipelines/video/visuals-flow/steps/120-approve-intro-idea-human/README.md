# 120 · approve the intro idea · [OWNER]

Gate on `intro-film/idea.json`. Reviewed on the board's Intro tab, above the
beat-level review that runs at 027 once a film actually exists.

- **In:** `intro-film/idea.json` — 2-3 directions from `026-propose-intro-idea-llm`
- **Out:** `idea.json` gets both `chosen: "<id>"` and `approved: true`, written
  in one operation. An approval with no `chosen` is meaningless — the board
  refuses a POST with no id.
- **Next:** `025-author-intro-film-llm`, which reads `chosen` and writes beats
  for that direction only.

## Why this is a separate gate from 027

027 gates a rendered film — beats, timings, motion, all built. 028 gates a
page of prose, before any of that exists. Rejecting a direction here costs a
re-run of the idea pass; rejecting after 027 costs a build and an encode. The
whole point of moving the idea out of the screenplay pass is that this gate is
cheap to fail.
