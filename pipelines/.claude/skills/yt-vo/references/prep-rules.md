# Prep rules: turning a final script into VO text

Read this before every `prep`. It turns a finished script into the text the voice
reads. The script itself is never changed: it stays the caption text.

A human reader fixes text silently. They see `HeyGen` and say "hay-jen", they see
`1080p` and say "ten-eighty-pee", they breathe in a 60-word sentence where it makes
sense. **A synthetic voice does none of that.** It reads characters. Every one of
those fixes has to be in the VO text before the engine sees it.

## Where things go

| Text | Where | Who reads it |
|---|---|---|
| The final script | `script.md` and `display_text` in `script.json` | captions, the editor, the owner. Never touched by prep |
| The VO text | `spoken_text` in `script.json`, or `<name>.vo.txt` for a doc | the voice engine |
| Pronunciation | `videos/<slug>/respell.json` (or `--respell` for a doc), and the shared `pipelines/video/tts/respell.json` | applied at synth time, on top of the VO text |

The VO text keeps normal spelling for names (`HeyGen`, not `hay-jen`). The respell
map swaps them in at synth time, so a fix to the shared map reaches every video.

## 1 · Punctuation is the pacing track

Punctuation is the only pacing control that works on every engine.

- **Full stop = a real beat.** Prefer two short sentences over one long one. If a
  sentence runs past ~25 words, split it.
- **Comma = a short breath.** Add them where a human would breathe, even where a
  copy editor would not.
- **Em dashes, en dashes and semicolons: remove them.** Engines treat them
  inconsistently. Convert to a full stop, a comma, or a paragraph break.
- **Ellipses: remove them.** For a deliberate trailing-off, use a full stop and a
  new line.
- **Paragraph break = the longest pause.** One idea per paragraph.
- **No brackets.** They are read out or choked on. Rewrite the sentence.
- **No ALL CAPS for emphasis.** Many engines spell it out letter by letter.

## 2 · Say symbols and numbers in words

- **Symbols:** `&` -> "and", `%` -> "percent", `#` -> "number", `+` -> "plus",
  `/` -> "per" or "slash" as the sense requires.
- **Numbers the way they are said:** `2026` -> "twenty twenty-six", `1,500` ->
  "fifteen hundred", `4K` -> "four K", `$29` -> "twenty-nine dollars".
- A token that recurs and has a fixed reading (`1080p`, `.mp4`) can go in the
  respell map instead.

## 3 · The pronunciation map

`respell.json` maps a problem word to a plain-letters respelling:

```json
{
  "Descript": "dee-script",
  "n8n": "N eight N",
  "API": "A-P-I",
  "1080p": "ten-eighty p",
  ".mp4": "dot em-pee-four"
}
```

- **One key per distinct problem word**, not per occurrence.
- **Cover these every time:** product and brand names, acronyms, file formats,
  version numbers, units, and any non-English word.
- **Respell in plain letters with hyphens.** No IPA, no engine phoneme codes.
- **Spelled-out acronyms are capitals joined by hyphens** (`"D-ID": "D-I-D"`).
  Never `dee eye dee`: the engine pauses between the words and it sounds robotic
  (owner-picked by ear, 2026-09-28).
- **Check the shared `pipelines/video/tts/respell.json` first.** Do not repeat its
  words. A word that will recur across videos goes in the shared map instead.
- Matching is whole-word and case-sensitive, longest key first.
- **Never write a respelling into the VO text.** `hay-jen` typed into
  `spoken_text` gets respelled a second time if the map ever changes.

## 4 · What prep never does

- **Never reword.** Prep changes how a line is said, not what it says. A sentence
  that is wrong or unclear goes back to the script's owner.
- **Never cut or add content.** Same words, same order, made speakable.
- **Never edit `display_text` or `script.md`.** They are the captions.

## Done means

`node lib/vo-prep.mjs` (or `bash run.sh <slug> vo-prep` in yt-script) exits 0. It
reads the VO text after the respell map runs and refuses any dash, semicolon,
ellipsis, symbol, bracket, digit, ALL-CAPS word or open flag. `vo-synth` runs the
same check and will not send a single request until it passes.
