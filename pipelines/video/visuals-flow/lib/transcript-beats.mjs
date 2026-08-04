import { normWord } from './resolve.mjs';

export function transcriptBeats(cue, cat, W, anchorIdx, start) {
  const listKey = cat.beat_items;
  if (!listKey) return { err: 'catalog beat_items missing' };
  
  const items = cue.variables?.[listKey];
  if (!items || !Array.isArray(items) || items.length === 0) {
    return { err: `variables.${listKey} is missing or empty` };
  }

  const labelKey = Object.keys(cat.beat_shape || {})[0];
  if (!labelKey) return { err: 'catalog beat_shape is empty' };

  const LOOKAHEAD = 40;
  const beats = [];
  let cursor = anchorIdx;

  for (const item of items) {
    const labelRaw = String(item[labelKey] ?? '').trim();
    const lNorm = labelRaw.split(/\s+/).map(normWord).filter(Boolean);
    if (!lNorm.length) {
      return { err: `item missing ${labelKey}` };
    }

    let found = -1;
    for (let i = cursor; i < Math.min(cursor + LOOKAHEAD, W.length - lNorm.length + 1); i++) {
      let ok = true;
      for (let j = 0; j < lNorm.length; j++) {
        const wn = W[i + j].n ?? normWord(W[i + j].word ?? W[i + j].text ?? '');
        if (wn !== lNorm[j]) {
          ok = false;
          break;
        }
      }
      if (ok) {
        found = i;
        break;
      }
    }

    if (found < 0) {
      return { err: `item "${labelRaw}" not found in the transcript within ${LOOKAHEAD} words of the expected position` };
    }

    beats.push({
      [labelKey]: item[labelKey],
      at: +(W[found].start - start).toFixed(2)
    });
    cursor = found + 1; // "first match after the cursor wins", advance cursor
  }

  return { beats, cursor };
}
