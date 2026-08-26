# 120 - the voiceover

**[RUN]** &nbsp; Synthesizes the voiceover section by section, then locks the takes.

Runs the `yt-vo` engine over `script.json` one section at a time via the Modal
`synth_section` endpoint, using `respell.json` for pronunciation. Re-roll a single
section with `--only`, listen, then lock. Wired 2026-08-26 (plan 252); before that
this step did nothing and `script.vo.txt`, its supposed input, had never once been
produced.

**Reads:** `script.json`, `respell.json`

**Writes:** `videos/<key>/audio/<id>.wav`

---

## The commands

```bash
cd pipelines/youtube/yt-script
bash run.sh <key> status              # stage, section count, how many are locked
bash run.sh <key> vo                  # every unlocked section
bash run.sh <key> vo --only s03       # re-roll one
bash run.sh <key> vo --force --only s03   # re-roll one that is already locked
bash run.sh <key> vo-lock             # lock the takes you have listened to
```

`MODAL_TTS_URL` and `MODAL_TTS_TOKEN` come from `pipelines/.env`. The engine,
the voice and the reference clip live in `pipelines/video/tts/` — this step owns
text and collects wavs, and never picks a voice.

## Read the `yt-vo` skill before running this

`pipelines/.claude/skills/yt-vo/SKILL.md` owns what "good" means before a take is
locked, in this order: wrong words -> respell and re-roll; a faint onset "tsh" ->
ignore, the assemble step trims it; racing or dragging -> re-roll, it is
stochastic; flat delivery -> `--emo-text "warm, confident"`.

**Two re-rolls wrong the same way means the text is wrong, not the engine.**

## Fixing a pronunciation

Edit `videos/<key>/respell.json`, then re-roll that section:

```json
{ "HeyGen": "hay-jen", "n8n": "N eight N" }
```

`script.md` keeps the normal spelling. The respell map is applied at synth time
by `deriveSpoken`, and only to sections whose `spoken_text` is still empty — which
is every section until its first synth. After that, `spoken_text` holds the
derived text, so a later respell edit needs a re-roll to take effect.

## There is no unlock

Only a text edit clears a lock, and that resets the take. A locked take is what
the freelancer records against, so swapping it silently desyncs footage that
already exists. Lock when you have actually listened.
