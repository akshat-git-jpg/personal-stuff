# 010 · resolve-drive-input  ·  [RUN]  (first step)

- **In:** a Drive folder link (`--drive-link`), e.g. `https://drive.google.com/drive/folders/<id>`
- **Out:** `output/intro.mp4`, `output/body.mp4`, `output/conclusion.mp4` +
  `output/<title>.input-manifest.json` (folder id, detected type, file paths)
- **Run:** `python3 run.py --drive-link "<link>" [--account EMAIL]`
- **Next:** step 020 extracts audio from the 3 downloaded segments

The folder name must end in ` @ g1` or ` @ g2` (case-insensitive) — that suffix selects which avatar
mapping (`shared/avatar_mapping.py`) later steps use. `intro.mp4`/`body.mp4`/`conclusion.mp4` are
read from an `input/` subfolder of the linked folder if one exists, else from the folder itself
(flat fallback, for folders that don't use the subfolder convention).
