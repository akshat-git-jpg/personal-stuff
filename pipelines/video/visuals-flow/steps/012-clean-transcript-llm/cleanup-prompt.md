# Transcript cleanup pass

You are given the raw ASR output of a voiceover as a numbered word list, each
word with a `start`/`end` time in seconds. Whisper's punctuation is a prosody
guess, not a proofread, and step 090 burns these words onto the video
VERBATIM as captions — so return a cleaned word list that reads like an
edited transcript, not a raw ASR dump.

**Fix punctuation only** — commas, periods, question marks, sentence
boundaries. Punctuation attaches to the word it follows (e.g. `clips,` not
`clips ,`).

**Fix brand names** to their official spelling. If the ASR split one brand
across two words, merge them into ONE output word whose `start` is the first
word's `start` and whose `end` is the second word's `end`.

**Trim leading discourse fillers** where a sentence opens with one ("Now,",
"So,", "Right,", "Okay,"). Drop the filler word entirely — never leave an
empty string in its place.

**Fix spec and product terms** to their real form, using `lib/lexicon.json`.
This is the same class of fix as a brand name, not a grammar rewrite: when the
ASR renders "1080p" as "10 ATP" or "one-click" as "one clip", the caption is
not showing what the speaker said — it is showing a mis-hearing of it. Correct
these the same way you correct brands, merging split words into ONE output word
that spans both timings. The `confusables` map in the lexicon lists the ones
already seen; apply the same judgment to spec tokens it does not yet list
(resolutions, frame rates, file formats, plan tiers, feature names). When you
are unsure whether a token is a mis-hearing or genuinely what was said, LEAVE
IT and note it — the suspect gate will surface it for a second opinion.

**Change nothing else.** Do not rewrite grammar, reorder words, or tighten
phrasing. The caption must still read as what the speaker said — a caption
that visibly differs from the audio reads as a subtitling error, which is a
worse defect than the punctuation this pass fixes.

**Never invent a word.** Output length must be ≤ input length (fillers and
brand merges only ever remove or combine words, never add).

**Every output word keeps a `start`/`end` from the input word(s) it came
from** — a merged word spans both; every other word keeps its own timing
unchanged.

## Output contract

Return a JSON array of `{ "text": string, "start": number, "end": number }`,
in the same order as the input, and nothing else — no prose, no markdown
fences, no trailing commentary. The result is validated by
`checkTimingIntegrity()` before it is written to `transcript.json`; a result
that fails the check (backwards timeline, invented words, empty text, a span
outside the source) is rejected and the raw ASR transcript is kept instead.

## Input

The input is the numbered word list from the target video's
`transcript.json` (or its `transcript.<engine>-raw.bak.json` backup),
formatted as `{{TRANSCRIPT_WORDS}}`.
