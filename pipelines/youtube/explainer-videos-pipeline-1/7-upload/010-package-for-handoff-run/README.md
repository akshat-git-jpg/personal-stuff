# 7/010 · package-for-handoff  ·  [RUN]  (final step)

Copies the final MP4 + thumbnail into the topic's `output/` folder that
`0-input/010` already created. **Not a real YouTube API upload** — pure
local/Drive packaging, mirroring `tutorial-pipeline-2`'s step 170 pattern.

- **Run:** `python3 run.py [<base>] [--drive] [--overwrite]`
- **Pulls from:** `5-final-video-sync/010` (final MP4), `6-thumbnail/010` (thumbnail)
- **Out:** both files copied into `0-input`'s local `output/<base>/output/`;
  with `--drive`, also uploaded into the matching Drive folder (folder ids
  read from `0-input`'s manifest — this step never creates folders).
- **Then:** upload `output/<base>/output/` to YouTube by hand.

Mechanical copy only — no transforms. Re-run anytime (e.g. after a thumbnail redo).
