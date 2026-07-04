# Step 030 — clean and fix transcript (Claude applies this)

Input: the raw transcript from step 1 (`<id>.transcript.txt` / `.json`).
Output: a final, TTS-ready transcript that the voice step speaks cleanly.

This is the LLM step. There's no script to run — Claude reads the raw transcript and
applies the rules below, then writes `<id>.final.txt`. (These rules were the
`tts-transcript-prep` skill; they live here now so the tool is self-contained.)

## The one rule that matters
Clean for SPEECH-correctness, not text-correctness. The reader is a synth, not a person.
"Written correct" does not mean "spoken correct." For every line ask: how will the engine
vocalize this? — not: is the text right?

## 1. Numbers / symbols / units — the #1 cause of failures (do this first)
TTS engines run a hidden digit-to-words normalizer that is brittle, especially on English
(IndexTTS-2 ships Chinese number logic and mangles English numerics, e.g. "100 AI models"
→ "one thousand models"). Never trust it. Pre-spell everything:

- Cardinals: `100` → `one hundred`, `240` → `two hundred forty`
- Version strings (highest risk — digits next to dots): `Flux 1.1` → `Flux one point one`;
  `Kling 1.2.7` → `Kling one-two-seven`; `Veo 3.1` → `Veo three point one`
- Resolutions/units: `720p` → `seven-twenty p`, `1080p` → `ten-eighty p`, `4K` → `four K`,
  `16 by 9` → `sixteen by nine`
- Symbols: `&`→`and`, `%`→`percent`, `$`→`dollars`, `/`→`per`/`slash`, `@`→`at`, `#`→`number`
- URLs/handles: `openart.ai` → `open art dot A I`
- Money/dates/times/ranges: write exactly as spoken (`$9/mo` → `nine dollars a month`)
- Number-dense lines are landmines. Normalize each by hand and re-read in your head.

## 2. Brand / proper names — verify, then map
ASR mishears names and TTS re-mangles them. For each name, in this order:
1. **In `../../shared/pronunciation-map.md`?** Apply that spelling.
2. **Not in the map, or unsure it's right?** **Web-search to verify** the real product/
   feature name and its correct spelling before you commit a fix. Don't guess from the ASR.
3. **Search inconclusive?** Only then **flag it for the human** (the tutorial maker).

Once verified, **add a row to `../../shared/pronunciation-map.md`** so the next video gets it for free.
The map only gets smarter over time.

## 3. Stutters / duplications / mistakes — delete
Freestyle recordings and ASR both double things. Remove repeated phrases ("…great tool,
and it's a great tool…"), self-corrections, and restarts. Say it once, cleanly. This is the
core value of regenerating from text — don't carry the flaw forward.

## 4. Punctuation = prosody
The engine pauses and intones on punctuation. Add commas for breath, periods to end every
sentence, em-dashes for asides, `?` for real questions. Break run-ons into real sentences.
Missing terminal punctuation = rushed, flat delivery.

## 5. Fillers (umms) — trim, don't rewrite
Cut `um/uh/like/you know` and dead repetition. Keep edits LIGHT: heavy rewriting changes
length (breaks the editor's later sync) and can change meaning. Fix correctness and flow,
don't re-author.

## 6. Structure / timestamps — not needed here
You regenerate the whole voice with TTS, which makes its own timing, so the original Whisper
timestamps don't carry over. Edit the text freely — no need to preserve segment boundaries.
(Only matters for dubbing pipelines that keep the original audio.)

## Checklist
1. [ ] Every number/version/unit/symbol spelled out as spoken
2. [ ] All names fixed via `../../shared/pronunciation-map.md` (and new names added to it)
3. [ ] Stutters, duplications, restarts removed
4. [ ] Punctuation added; run-ons split; every sentence terminated
5. [ ] Fillers trimmed lightly

---
*Verifying the result (round-trip ASR on the generated audio) is a **Voice Maker** step — it
happens after TTS, not here.*
