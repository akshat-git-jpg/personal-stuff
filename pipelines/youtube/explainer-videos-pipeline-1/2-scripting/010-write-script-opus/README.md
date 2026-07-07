# 2/010 · write-script  ·  [OPUS]

Clones a named competitor channel's script voice for this video's topic, via
the `yt-style-copy` skill's `write-script` verb. Run in a Claude Code session
on model **Opus** (`/model opus` first) — this is the pipeline's highest-
judgment creative step.

- **In:** `--slug <channel>` + `--topic "..."` (topic also read from
  `../../0-input/010-create-drive-folders-run/output/<base>.manifest.json`)
- **Out:** `output/<base>.script.md` (copied from yt-style-copy's own output
  location — see rulebook.md for the exact copy step)
- **How:** Claude applies `rulebook.md`.
- **Hard-stop:** if `pipelines/youtube/competitor-styles/channels/<slug>/script-style-dna.md`
  does not exist, STOP and tell the user to run yt-style-copy's
  `build-script-style-dna <slug>` first. Never auto-trigger it.
- **Next:** step 020 (human review) reads `output/<base>.script.md`.
