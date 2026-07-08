# 040 · download-avatar-renders  ·  [HUMAN] gate + [RUN] download

- **In:** step 030's HeyGen manifest (needs real `video_id`s — check HeyGen yourself first)
- **Out:** `output/videos/intro.mp4`, `body.mp4`, `conclusion.mp4`
- **Run:** `python3 download.py [<video_title>]` then `python3 check.py [<video_title>]`
- **Next:** step 050 packages + uploads the 3 files back to Drive

`heygen-web download <video_id>` is fully wired for real (unlike step 030's submit) — this step
works today for any job that has a real `video_id`.
