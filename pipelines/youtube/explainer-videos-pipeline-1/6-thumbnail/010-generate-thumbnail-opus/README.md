# 6/010 · generate-thumbnail  ·  [OPUS]

Generates a YouTube thumbnail (1280×720 JPG) styled per a named competitor
channel's `video-style-dna.md` "Thumbnail style" section, via a Hyperframes
snapshot. Run in a Claude Code session on model **Opus** (`/model opus` first).

- **In:** `--slug <channel>` (independent choice from `2-scripting` and
  `4-motion-graphics`'s own slugs — by design, confirmed in the pipeline design doc)
- **Out:** `output/<base>.thumbnail.jpg` (1280×720)
- **How:** Claude applies `rulebook.md`.
- **Hard-stop:** if `pipelines/youtube/competitor-styles/channels/<slug>/video-style-dna.md`
  does not exist, STOP and tell the user to run yt-style-copy's
  `build-video-style-dna <slug>` first.
- **Next:** step 7-upload/010 packages this alongside the final MP4.
