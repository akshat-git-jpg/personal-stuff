# 040 · storyboard-review · [OWNER]

**MANDATORY GATE 1 — never skipped, at any video length** (owner decision
2026-07-25, decisions.md). This is the PLAN review: the owner finalises avatar
placement and variation, motion-graphics placement, card choice, and on-card
text BEFORE anything renders. The earlier "≤10 min videos may skip this and go
straight to the cut" rule is revoked — it pushed card-choice errors into the
Final Cut, where each one costs a full re-render.

The shot pass (070) runs BEFORE this step, so avatar spans are on the board when
the owner reviews. Both `cues.json` and `shots.json` must come out approved.

- **In:** `videos/<slug>/cues.json`, `videos/<slug>/resolved.json`, `videos/<slug>/shots.json`, `videos/<slug>/shots.resolved.json`, `videos/<slug>/vo.mp3`
- **Out:** approved `videos/<slug>/cues.json` AND `videos/<slug>/shots.json` (`approved: true`, edits/flags applied)
- **Run:** `bash run.sh <slug>` then open the printed URL
  (equivalent to `node lib/board.mjs <slug>`. Binds `127.0.0.1`; starts at `BOARD_PORT` (default 4322) and walks up to +10 when taken, printing the final URL.)
- **Next:** step 050 renders the approved cues, then 080 renders the approved avatar spans

One tile per cue: the real card, playing in an iframe, scrubbed by that cue's
VO slice. Edit a cue's fragment JSON or flag it (no card fits), hit Save —
edits re-run through the same resolver step 030 uses, so a bad anchor reports
inline instead of silently drifting. Approve when the storyboard looks right.

Every tile also self-checks for layout overflow at each beat: a red
`OVERFLOW @ <seconds>` badge on the tile header means the card's real DOM
exceeded the 1920x1080 canvas at that second — no vision model, just a
bounding-rect sweep. The `calibrate` link renders every beat card filled to
its declared `max_beats`/`max_reveal_chars` caps so those numbers can be
visually verified (or fixed) in one page.
