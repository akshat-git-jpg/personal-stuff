# 4/010 · plan-visuals  ·  [OPUS]

Produces a timed visual plan (cue list) from a named competitor channel's
`video-style-dna.md`, the approved script, and the voiceover's timestamped
transcript. Run in a Claude Code session on model **Opus** (`/model opus` first).

- **In:** `--slug <channel>` + `../../3-voiceover/050-make-timestamped-transcript-run/output/<base>.timestamps.json`
  + `../../2-scripting/030-clean-script-for-tts-run/output/<base>.tts-ready.txt`
- **Out:** `output/<base>.visual-plan.md` (timed cues, total duration = voiceover's exact duration)
- **How:** Claude applies `rulebook.md`.
- **Hard-stop:** if `pipelines/youtube/competitor-styles/channels/<slug>/video-style-dna.md`
  does not exist, STOP and tell the user to run yt-style-copy's
  `build-video-style-dna <slug>` first.
- **Next:** step 020 (build-graphics) renders this plan.
