# 120 - the voiceover

**[RUN]** &nbsp; Preps a VO copy with yt-vo, synthesizes it section by section, then locks the takes.

Hands the final script to the `yt-vo` skill. Its `prep` writes a VO copy into each
section's `spoken_text` (punctuation, numbers, pronunciation) plus `respell.json`.
`script.md` and `display_text` are never touched: they are the captions. Then the
engine runs one section at a time via the Modal `synth_section` endpoint. Re-roll a single
section with `--only`, listen, then lock. Wired 2026-08-26 (plan 252); before that
this step did nothing and `script.vo.txt`, its supposed input, had never once been
produced.

**Reads:** `script.json`

**Writes:** `spoken_text` in `script.json`, `respell.json`, `videos/<key>/audio/<id>.wav`

---

## The commands

```bash
cd pipelines/youtube/yt-script
bash run.sh <key> status              # stage, section count, how many are locked
bash run.sh <key> vo-prep --seed      # start the VO copy from the final script
bash run.sh <key> vo-prep             # check the VO copy; repeat until it exits 0
bash run.sh <key> vo                  # every unlocked section
bash run.sh <key> vo --only s03       # re-roll one
bash run.sh <key> vo --force --only s03   # re-roll one that is already locked
bash run.sh <key> vo-lock             # lock the takes you have listened to
```

`MODAL_TTS_URL` and `MODAL_TTS_TOKEN` come from `pipelines/.env`. The engine,
the voice and the reference clip live in `pipelines/video/tts/` — this step owns
text and collects wavs, and never picks a voice.

## Read the `yt-vo` skill before running this

Its `prep` section and `references/prep-rules.md` say how to write the VO copy.
`vo` refuses to send anything until `vo-prep` passes.

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

The map is applied to `spoken_text` at synth time, every time, so `spoken_text`
keeps normal spelling and an edit to the map reaches the next take.

## There is no unlock

Only a text edit clears a lock, and that resets the take. A locked take is what
the freelancer records against, so swapping it silently desyncs footage that
already exists. Lock when you have actually listened.
