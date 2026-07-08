# 050 · package-and-upload  ·  [RUN]  (last step)

- **In:** step 040's downloaded segment renders + step 010's manifest (for the source folder id)
- **Out:** `output/spokesperson_intro.mp4`, `spokesperson_body.mp4`, `spokesperson_conclusion.mp4`
  — locally AND uploaded into an `output/` subfolder of the source Drive folder (find-or-created;
  mirrors step 010 reading segments from an `input/` subfolder)
- **Run:** `python3 run.py [<video_title>] [--account EMAIL]`
