import { normWord } from './resolve.mjs';

// Expand a word-sync card's sentence into per-word beats, timed from the
// transcript. The LLM supplies `text` + an optional `accent` phrase; every
// per-word time is DERIVED here, because hand-anchoring 12 words per sentence
// is not viable (that is the whole reason `kind: "word-sync"` exists).
//
// W: normalized word list from resolveCues ({ n, text, start }).
// anchorIdx: index in W where the cue's anchor matched — the anchor IS the
//   opening of the sentence, so word matching starts AT it, not after it.
// start: the card's absolute start time (anchor start minus lead).
// Returns { beats, cursor } or { err }.
export function wordSyncBeats(cue, W, anchorIdx, start) {
  const sentence = String(cue.variables?.text ?? '').trim();
  const sWords = sentence.split(/\s+/).filter(Boolean);
  if (!sWords.length) return { err: 'word-sync card requires variables.text' };

  const sNorm = sWords.map(normWord);
  if (!sNorm.some(Boolean)) return { err: 'variables.text has no matchable words' };

  // Locate the accent phrase inside the sentence, by normalized words.
  const accentRaw = String(cue.variables?.accent ?? '').trim();
  const aNorm = accentRaw.split(/\s+/).map(normWord).filter(Boolean);
  let aStart = -1;
  if (aNorm.length) {
    for (let i = 0; i + aNorm.length <= sNorm.length; i++) {
      let ok = true;
      for (let k = 0; k < aNorm.length; k++) if (sNorm[i + k] !== aNorm[k]) { ok = false; break; }
      if (ok) { aStart = i; break; }
    }
    if (aStart < 0) return { err: `accent phrase "${accentRaw}" does not appear in text "${sentence}"` };
  }

  // Walk the transcript forward, matching each sentence word. A small lookahead
  // absorbs transcription noise (filler words the sentence omits) without
  // letting a wrong match run away.
  const LOOKAHEAD = 8;
  const beats = [];
  let wi = anchorIdx;
  for (let i = 0; i < sWords.length; i++) {
    const n = sNorm[i];
    if (!n) continue;
    let found = -1;
    for (let j = wi; j < Math.min(wi + LOOKAHEAD, W.length); j++) {
      if (W[j].n === n) { found = j; break; }
    }
    if (found < 0) {
      return { err: `word "${sWords[i]}" not found in the transcript within ${LOOKAHEAD} words of the expected position — text must quote the voiceover verbatim` };
    }
    beats.push({
      text: sWords[i],
      accent: aStart >= 0 && i >= aStart && i < aStart + aNorm.length,
      at: +(W[found].start - start).toFixed(2)
    });
    wi = found + 1;
  }
  return { beats, cursor: wi };
}
