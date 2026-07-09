# 040 · download-avatar-renders  ·  [RUN]

- **In:** step 030's HeyGen manifest (needs real `video_id`s)
- **Out:** `output/videos/intro.mp4`, `body.mp4`, `conclusion.mp4`
- **Run:** `python3 run.py [<video_title>] [--buffer SECONDS]`
- **Next:** step 050 packages + uploads the 3 files back to Drive

No status polling: for each pending segment this waits once — the segment's own clip duration
(from step 020's audio manifest) plus a fixed render buffer (default 60s) — then makes exactly ONE
`heygen-web download` attempt. Already-downloaded segments are skipped, so re-running only retries
whatever's still pending.
