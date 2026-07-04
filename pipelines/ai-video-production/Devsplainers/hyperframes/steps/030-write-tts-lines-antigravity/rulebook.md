# Rulebook — 030 write-tts-lines

Make each beat read correctly through TTS. Same beats, same numbers — only the
*spelling* changes so the voice pronounces things right.

## Input → Output
`videos/<slug>/beats.md` → `videos/<slug>/tts-lines.md`

## Fixes to apply
- **Acronyms:** spell out how they should sound — "RAG" → "rag" (if said as a word) or "R A G" (if spelled). "API" → "A P I".
- **Numbers/versions:** write them as spoken — "Gemma 4 12B" → "Gemma four, twelve billion"; "$0" → "zero dollars"; "1/8s" → "one eighth of a second".
- **Symbols:** "→" → "becomes"; "×" → "times"; "%" → "percent".
- **Coined terms / brand names:** respell phonetically only if TTS mangles them (say them out loud to check) — otherwise leave alone.
- **Pacing:** add commas for natural pauses; split a sentence that runs long. Keep it natural — don't over-punctuate.
- Do **not** change meaning or add/remove content.

## Format (`tts-lines.md`)
Same numbered format, one beat per line — parsed by step 040:
```
1. Google built a model that can look at a photo and tell you what's in it.
2. This is Gemma four, twelve billion.
```

## Then
Proceed to 040 (synthesize voice-over). Tip: skim once by reading aloud — if a
line trips you, it'll trip the TTS.
