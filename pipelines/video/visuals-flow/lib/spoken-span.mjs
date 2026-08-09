import { normWord } from './resolve.mjs';

// How long the presenter actually takes to SAY a piece of card copy.
//
// Some cards animate their text at a rate derived from the clip length, and
// the clip length comes from `catalog.default_duration` — a per-card motion
// constant with no relation to speech. On consistent-ai-influencer that made
// prompt/prompt-typing type a 5.5s dictated prompt over 10.95s: at the moment
// the voice finished the whole prompt, 56% of it was on screen (owner c04/c16/
// c24, 2026-08-07, "audio is not syncing with the text being typed").
//
// The card copy is a near-verbatim of the spoken words but not an exact one
// (c24's card drops "in her hand"), so this aligns loosely: it walks the
// transcript forward from the cue anchor, allows the transcript to carry words
// the card omits, and skips a card token that has no match nearby. The span is
// the first matched word's start to the last matched word's end.
export function spokenSpan(W, fromIdx, text, opts = {}) {
  const skip = opts.skip ?? 6;
  const minCoverage = opts.minCoverage ?? 0.6;
  const tokens = String(text ?? '').split(/\s+/).map(normWord).filter(Boolean);
  if (tokens.length < 3) return null;

  let cursor = Math.max(0, fromIdx);
  let firstIdx = -1;
  let lastIdx = -1;
  let matched = 0;

  for (const tok of tokens) {
    let hit = -1;
    const limit = Math.min(W.length, cursor + skip + 1);
    for (let k = cursor; k < limit; k++) {
      if (W[k].n === tok) { hit = k; break; }
    }
    if (hit === -1) continue;
    if (firstIdx === -1) firstIdx = hit;
    lastIdx = hit;
    matched++;
    cursor = hit + 1;
  }

  // Too little of the copy was found in the narration to trust the span — the
  // caller keeps its old duration-derived behaviour rather than animating to a
  // number built from noise.
  if (firstIdx === -1 || matched / tokens.length < minCoverage) return null;

  const start = W[firstIdx].start;
  const end = W[lastIdx].end ?? W[lastIdx].start;
  const seconds = +(end - start).toFixed(2);
  if (!(seconds > 0)) return null;
  return { start, end, seconds, matched, total: tokens.length };
}
