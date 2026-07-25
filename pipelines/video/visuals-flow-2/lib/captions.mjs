export const CAP_MAX_WORDS = 6;
export const CAP_MAX_CHARS = 32;
export const CAP_GAP_SPLIT = 0.6;
export const CAP_TAIL = 0.4;
export const CAP_FONT_PX = 44;
export const CAP_Y_FRAC = 0.87;

// Brands seen across videos so far. This wants to become per-video config
// rather than a growing global — see the note in tests/TESTS.md (2026-07-25).
export const CAP_ACCENT_LEXICON = [
  'heygen', 'openart', 'higgsfield', 'synthesia', 'arcads',
  'submagic', 'opusclip',
];

// Brands the speaker says as SEVERAL words. markKeyword() tests one word at a
// time, so "Opus Clips" never matched and only single-word brands lit up —
// owner v2:1 2026-07-25: "why only Submagic is coloured and not Opus Clips".
// Every word of the phrase gets highlighted, and the words stay SEPARATE so the
// caption still reads exactly as spoken.
export const CAP_ACCENT_PHRASES = [
  ['opus', 'clips'],
  ['opus', 'clip'],
];

// Indices of words belonging to a multi-word brand phrase.
export function phraseAccentIndices(words) {
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const hit = new Set();
  for (let i = 0; i < words.length; i++) {
    for (const phrase of CAP_ACCENT_PHRASES) {
      if (i + phrase.length > words.length) continue;
      if (phrase.every((p, k) => norm(words[i + k].text ?? words[i + k].word) === p)) {
        for (let k = 0; k < phrase.length; k++) hit.add(i + k);
      }
    }
  }
  return hit;
}

// Whisper writes brand names phonetically ("Higgs Field", "Hey Gen"), and the
// mis-spelling then burns into the captions — owner v2:9 2026-07-24, "Spelling
// mistake". One lexicon drives both the correction and the highlight so a new
// brand only has to be declared once.
export const CAP_SPELLING_FIXES = [
  [/\bhiggs\s+field\b/gi, 'Higgsfield'],
  [/\bhey\s+gen\b/gi, 'HeyGen'],
  [/\bopen\s+art\b/gi, 'OpenArt'],
  [/\bsynthesi(?:a|er)\b/gi, 'Synthesia'],
  [/\bar\s*cads\b/gi, 'Arcads'],
  [/\bsome\s+magic\b/gi, 'Submagic'],   // test-03: Groq heard the brand as two real words
  [/\bsub\s+magic\b/gi, 'Submagic'],
];

export function fixSpelling(text) {
  if (!text) return text;
  let out = String(text);
  for (const [re, to] of CAP_SPELLING_FIXES) out = out.replace(re, to);
  return out;
}

// Words that are ALL-CAPS by convention rather than for emphasis. Highlighting
// these lit up almost every caption in an AI-tools video, which is what the
// owner read as "random words highlighted" (v2:9).
export const CAP_CAPS_STOPWORDS = new Set(['ai', 'ui', 'ux', 'api', 'hd', 'id', 'ok', 'pc', 'tv', 'us', 'it', 'a', 'i']);

export function markKeyword(text, lexicon = CAP_ACCENT_LEXICON) {
  if (!text) return false;
  const t = text.replace(/[.,!?;:]+$/, '');
  if (lexicon.includes(t.toLowerCase())) return true;      // brand names
  // Only figures that carry weight: money, percentages, and numbers of 2+
  // digits. Highlighting every "5" and "3" in a five-tool comparison is noise.
  if (/[$%€£]/.test(t)) return true;
  if (/\d{2,}/.test(t)) return true;
  // ALL-CAPS emphasis, minus the conventional acronyms above.
  if (t.length >= 2 && t === t.toUpperCase() && /[A-Z]/.test(t) && !CAP_CAPS_STOPWORDS.has(t.toLowerCase())) return true;
  return false;
}

export function assEscape(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\n/g, '\\N');
}

export function hexToAssBgr(hex) {
  const c = hex.replace('#', '');
  if (c.length === 3) {
    return c[2]+c[2]+c[1]+c[1]+c[0]+c[0];
  }
  return c.substring(4, 6) + c.substring(2, 4) + c.substring(0, 2);
}

export function formatAssText(words, keywordColor = '#fb923c') {
  const bgr = hexToAssBgr(keywordColor).toUpperCase();
  return words.map(w => w.hl ? `{\\1c&H${bgr}&}${assEscape(w.text)}{\\1c&HFFFFFF&}` : assEscape(w.text)).join(' ');
}

// Whisper splits one-word brands into two ("Higgs Field"). Merge the pair back
// into a single word, spanning both timings, BEFORE chunking — otherwise the
// correction would change the word count mid-chunk and desync the highlight.
export function mergeBrandWords(words) {
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const next = words[i + 1];
    if (next) {
      const wt = w.text || w.word || '';
      const nt = next.text || next.word || '';
      const trailing = (nt.match(/[.,!?;:]+$/) || [''])[0];
      const joined = fixSpelling(`${wt} ${nt.slice(0, nt.length - trailing.length)}`);
      if (!joined.includes(' ')) {
        out.push({ ...w, text: joined + trailing, start: w.start, end: next.end });
        i++;
        continue;
      }
    }
    out.push({ ...w, text: fixSpelling(w.text || w.word || '') });
  }
  return out;
}

export function planCaptions(rawWords, opts = {}) {
  if (!rawWords || rawWords.length === 0) return [];
  const words = mergeBrandWords(rawWords);

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
      words: (() => {
        const accent = phraseAccentIndices(chunkWords);
        return chunkWords.map((w, k) => {
          const wt = fixSpelling(w.text || w.word || '');
          return { text: wt, hl: markKeyword(wt) || accent.has(k) };
        });
      })(),
      start: +(start).toFixed(3),
      end: +(end).toFixed(3)
    });
  }

  return out;
}
