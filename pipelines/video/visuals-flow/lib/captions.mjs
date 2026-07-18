export const CAP_MAX_WORDS = 6;
export const CAP_MAX_CHARS = 32;
export const CAP_GAP_SPLIT = 0.6;
export const CAP_TAIL = 0.4;
export const CAP_FONT_PX = 44;
export const CAP_Y_FRAC = 0.87;

export function planCaptions(words, opts = {}) {
  if (!words || words.length === 0) return [];

  const chunks = [];
  let currentWords = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    if (currentWords.length > 0) {
      const prevWord = currentWords[currentWords.length - 1];
      const gap = word.start - prevWord.end;

      const currentText = currentWords.map(w => w.word).join(' ');
      const newText = currentText + ' ' + word.word;

      if (
        currentWords.length >= CAP_MAX_WORDS ||
        newText.length > CAP_MAX_CHARS ||
        gap >= CAP_GAP_SPLIT
      ) {
        chunks.push([...currentWords]);
        currentWords = [];
      }
    }

    currentWords.push(word);
  }

  if (currentWords.length > 0) {
    chunks.push([...currentWords]);
  }

  const out = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunkWords = chunks[i];
    const text = chunkWords.map(w => w.word).join(' ').trim();
    const start = chunkWords[0].start;
    const endRaw = chunkWords[chunkWords.length - 1].end + CAP_TAIL;

    let end = endRaw;
    if (i < chunks.length - 1) {
      const nextStart = chunks[i + 1][0].start;
      if (end > nextStart) {
        end = nextStart;
      }
    }
    
    out.push({
      i,
      text,
      start: +(start).toFixed(3),
      end: +(end).toFixed(3)
    });
  }

  return out;
}
