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
