# 120 - the voiceover

**[RUN]** &nbsp; Not wired yet.

NOT WIRED. `script.vo.txt` is the intended input for the `yt-vo` skill and the TTS hub at `pipelines/video/tts`. Nothing in this skill runs it today.

**Reads:** `script.vo.txt`

**Writes:** `voiceover audio`

---

## Not wired

`script.vo.txt` is written and ready, but no step here consumes it.

When it is wired, it goes through the `yt-vo` skill (source:
`pipelines/.claude/skills/yt-vo`) and the voice registry in
`pipelines/video/tts`.

Do not improvise a TTS call from this skill.
