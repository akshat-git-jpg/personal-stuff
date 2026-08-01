# 080 · approve storyboard · [HUMAN]

**MANDATORY GATE 2 — never skipped by a session's judgment; waivable ONLY by
the owner's own kickoff choice** (step 005, `run-config review=express`, owner
decision 2026-08-01 — express runs unattended to the final cut). In full-review
mode this holds as written (owner decision
2026-07-25, decisions.md; renumbered 2026-07-30 when the 037 card plan became
gate 1). This is the COMPOSITION review — 037 already settled *which cards*, so
this gate is about how the plan sits on the timeline: the owner finalises avatar
placement and variation, motion-graphics placement, on-card text, and any final
card swap BEFORE anything renders. 037 decided build-vs-reuse from a list; here
the real card plays in an iframe, which is the first time it can be judged. The earlier "≤10 min videos may skip this and go
straight to the cut" rule is revoked — it pushed card-choice errors into the
Final Cut, where each one costs a full re-render.

The shot pass (060) runs BEFORE this step, so avatar spans are on the board when
the owner reviews. Both `cues.json` and `shots.json` must come out approved.

- **In:** `videos/<slug>/cues.json`, `videos/<slug>/resolved.json`, `videos/<slug>/shots.json`, `videos/<slug>/shots.resolved.json`, `videos/<slug>/vo.mp3`
- **Out:** approved `videos/<slug>/cues.json` AND `videos/<slug>/shots.json` (`approved: true`, edits/flags applied)
- **Run:** `bash run.sh <slug>` then open the printed URL
  (equivalent to `node lib/board.mjs <slug>`. Binds `127.0.0.1`; starts at `BOARD_PORT` (default 4322) and walks up to +10 when taken, printing the final URL.)
- **Next:** step 090 renders the approved cues, then 100 renders the approved avatar spans

One tile per cue: the real card, playing in an iframe, scrubbed by that cue's
VO slice. Edit a cue's fragment JSON or flag it (no card fits), hit Save —
edits re-run through the same resolver step 040 uses, so a bad anchor reports
inline instead of silently drifting. Approve when the storyboard looks right.

Every tile also self-checks for layout overflow at each beat: a red
`OVERFLOW @ <seconds>` badge on the tile header means the card's real DOM
exceeded the 1920x1080 canvas at that second — no vision model, just a
bounding-rect sweep. The `calibrate` link renders every beat card filled to
its declared `max_beats`/`max_reveal_chars` caps so those numbers can be
visually verified (or fixed) in one page.
