export const CAP_MAX_WORDS = 6;
export const CAP_MAX_CHARS = 32;
export const CAP_GAP_SPLIT = 0.6;
export const CAP_TAIL = 0.4;
export const CAP_FONT_PX = 44;
export const CAP_Y_FRAC = 0.87;

export const CAP_ACCENT_LEXICON = [
  'heygen', 'openart', 'higgsfield', 'synthesia', 'arcads'
];

export function markKeyword(text, lexicon = CAP_ACCENT_LEXICON) {
  if (!text) return false;
  const t = text.replace(/[.,!?;:]+$/, '');
  if (/[\d$%€£]/.test(t)) return true;                    // numbers, money, percent
  if (lexicon.includes(t.toLowerCase())) return true;      // brand names
  if (t.length >= 2 && t === t.toUpperCase() && /[A-Z]/.test(t)) return true; // ALL-CAPS emphasis
  return false;
}

export function planCaptions(words, opts = {}) {
  if (!words || words.length === 0) return [];

  const chunks = [];
  let currentWords = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    if (currentWords.length > 0) {
      const prevWord = currentWords[currentWords.length - 1];
      const gap = word.start - prevWord.end;

      const currentText = currentWords.map(w => w.text).join(' ');
      const newText = currentText + ' ' + word.text;

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
    const text = chunkWords.map(w => w.text).join(' ').trim();
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
      words: chunkWords.map(w => {
        const wt = w.text || w.word || '';
        return { text: wt, hl: markKeyword(wt) };
      }),
      start: +(start).toFixed(3),
      end: +(end).toFixed(3)
    });
  }

  return out;
}
