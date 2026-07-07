# Rulebook — 020 segment-into-beats

Chop the script into an ordered list of **beats**. A beat = one idea that becomes
one voice clip and one scene (1 beat = 1 clip = 1 scene — the alignment that makes
audio sync automatic).

## Input → Output
`videos/<slug>/script.md` → `videos/<slug>/beats.md`

## Rules
- **The beat text IS the narration** — these exact words get spoken (step 040 TTSes them). Don't summarize; use the script's actual sentences, lightly split/merged so each beat is one clean spoken thought.
- **One idea per beat.** Usually one sentence; split a long compound sentence, or merge two tiny fragments, so a beat is ~1–4 seconds of speech.
- **Target ~6 beats per minute** of intended video (a 5-min script ≈ ~30 beats). More beats = more scene cuts.
- **Keep delivery order.** Number them 1..N.
- Don't drop content — every word of the script lands in some beat.

## Format (`beats.md`)
One beat per line, numbered:
```
1. Google built a model that can look at a photo and tell you what's in it.
2. Then, right before releasing it, they tore out its eyes and ears.
3. ...
```
(`NN. text` — this exact format is what 030/040 parse.)

## Then
Proceed to 030 (TTS-ready lines).
