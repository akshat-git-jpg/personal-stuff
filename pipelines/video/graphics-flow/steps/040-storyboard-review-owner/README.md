# 040 · storyboard-review · [OWNER]

- **In:** `videos/<slug>/cues.json`, `videos/<slug>/resolved.json`, `videos/<slug>/vo.mp3`
- **Out:** approved `videos/<slug>/cues.json` (`approved: true`, edits/flags applied)
- **Run:** `bash run.sh <slug>` then open the printed URL
  (equivalent to `node lib/board.mjs <slug>`. Binds `127.0.0.1`; starts at `BOARD_PORT` (default 4322) and walks up to +10 when taken, printing the final URL.)
- **Next:** step 050 renders the approved cues

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
