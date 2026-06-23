---
name: tts-transcript-prep
description: "Convert a human/ASR transcript (e.g. Whisper output) into a TTS-ready script so an engine like IndexTTS-2, Chatterbox, OmniVoice speaks it cleanly — no mispronounced numbers, versions, units, brand names; no stutters; natural prosody. Use BEFORE synthesizing any voiceover from a transcript. Trigger phrases: prep transcript for tts, clean transcript for voiceover, fix transcript pronunciation, tts-ready script, normalize transcript for speech, make transcript speakable."
author: "akshat-git-jpg"
user-invocable: true
argument-hint: "<transcript file or segments.json>"
metadata:
  version: 1.0.0
---

# TTS transcript prep

Turn a transcript meant for a HUMAN reader into one meant for a TTS ENGINE.

## The one rule that matters
**Clean for SPEECH-correctness, not text-correctness.** The reader is a synth, not a person.
"Written correct" ≠ "spoken correct". Every token that *looks* fine but *sounds* wrong is your
job. Ask of each line: "how will the engine VOCALIZE this?" — not "is the text right?"

## 1. Numbers / symbols / units — the #1 cause of failures (do this first)
TTS engines run a hidden digit→words normalizer. It is **brittle, especially on English**
(IndexTTS-2 and other Chinese-origin models ship `cn2an` — Chinese number logic — and routinely
mangle English numerics, e.g. "100 AI models" → "one thousand models"). **Never trust it.
Pre-spell everything:**

- Cardinals: `100` → `one hundred`, `240` → `two hundred forty`
- **Version strings (highest risk — digits next to dots):** `Flux 1.1` → `Flux one point one`;
  `Kling 1.2.7` → `Kling one-two-seven`; `Veo 3.1` → `Veo three point one`
- Resolutions/units: `720p` → `seven-twenty p`, `1080p` → `ten-eighty p`, `4K` → `four K`,
  `16 by 9` → `sixteen by nine`, `9 by 16` → `nine by sixteen`
- Symbols: `&`→`and`, `%`→`percent`, `$`→`dollars`, `/`→`per`/`slash`, `@`→`at`, `#`→`number`/`hashtag`
- URLs/handles: `openart.ai` → `open art dot A I`
- Money/dates/times/ranges/ordinals: write exactly as spoken (`$9/mo` → `nine dollars a month`).
- **Number-dense lines are landmines.** When several numbers/versions sit together, normalize each
  by hand and re-read the line aloud in your head.

## 2. Brand / proper names — respell phonetically when the engine slips
ASR mishears them and TTS re-mangles them. Keep a small fix-map and apply it everywhere
(both cases): `Hagen`→`HeyGen`, `Higgs Field`→`Higgsfield`, `Soro`→`Sora`, `Clang`→`Kling`,
`Vue/View`→`Veo`, `Open Art`→`OpenArt`. If a correctly-spelled name still mispronounces, respell
it phonetically (`Veo` → `Vay-oh` only if needed). Acronyms: decide letters-vs-word —
`L&D` → `L and D`, leave `HR`, `AI`, `HD` if the engine says them right.

## 3. Stutters / duplications — delete
Recordings and ASR both double things. Remove repeated sentences/phrases ("…great tool, and it's
a great tool…") and self-corrections. Say it **once**, cleanly. This is the core value of
regenerating from text — don't carry the flaw forward.

## 4. Punctuation = prosody
The engine pauses and intones on punctuation. Add commas for breath, periods to end every
sentence, em-dashes for asides, `?` for real questions (lifts intonation), `…` sparingly. Break
run-ons into real sentences. Missing terminal punctuation = rushed, flat delivery.

## 5. Fillers — trim, don't rewrite
Cut harmful `um/uh/like/you know` and dead repetition. But keep edits LIGHT: heavy rewriting
changes length (breaks sync) and can change meaning. Fix correctness and flow, don't re-author.

## 6. Preserve structure for synced pipelines
If a downstream step anchors audio to timestamps (video dubbing), **edit text in place per
segment — keep every timestamp.** To drop a duplicate, blank that segment's text (the assembler
absorbs the gap); don't delete/reorder segments. Apply global find-replace for names, per-id
overrides for stutters/garbled lists.

## 7. VERIFY the output — the step people skip (and I once did)
Structural checks (duration, streams, sync math) **cannot catch a mispronunciation.** Add an
acoustic gate:
- **Round-trip ASR:** re-transcribe the GENERATED audio with Whisper, diff against your input
  text. Numbers and names that drifted ("one thousand" vs "100") pop out immediately.
- **Spot-listen the number-dense / name-dense chunks** specifically.
Never call a voiceover "done" on structural green-lights alone.

## Checklist
1. [ ] Every number/version/unit/symbol spelled out as spoken (don't trust the engine)
2. [ ] Brand/proper names fixed everywhere + phonetic respell if still wrong
3. [ ] Stutters & duplications removed
4. [ ] Punctuation added for pauses + intonation; run-ons split; every sentence terminated
5. [ ] Fillers trimmed lightly (length preserved for sync)
6. [ ] Timestamps/segment structure preserved if a sync step needs them
7. [ ] After synth: round-trip ASR diff + spot-listen the risky chunks
