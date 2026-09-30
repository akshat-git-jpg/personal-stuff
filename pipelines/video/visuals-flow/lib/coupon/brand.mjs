// Deterministic ASR fix for the one word every coupon video says: the tool name.
// Whisper hears "EverBee" as "EverBe" or "ever beep"; one or two words within
// edit distance 2 of the name (same first letter) become the name.

const norm = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, '');

export function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

const close = (s, target) => s.length >= 4 && s[0] === target[0] && s !== norm('every')
  && editDistance(s, target) <= Math.min(2, Math.floor(target.length / 3));

// Keeps the last word's trailing punctuation and possessive, so sentence ends survive.
function tail(text) {
  const m = /('s)?[^A-Za-z0-9]*$/.exec(text);
  return m ? m[0] : '';
}

export function fixBrand(words, tool) {
  const target = norm(tool);
  if (target.length < 4) return { words, fixes: 0 };
  const out = [];
  let fixes = 0;
  for (let i = 0; i < words.length; i++) {
    const one = norm(words[i].text.replace(/'s$/i, ''));
    const two = i + 1 < words.length ? norm(words[i].text) + norm(words[i + 1].text.replace(/'s$/i, '')) : null;
    if (two && !close(one, target) && close(two, target) && norm(words[i].text).length >= 3) {
      out.push({ ...words[i], text: tool + tail(words[i + 1].text), end: words[i + 1].end });
      i++; fixes++;
      continue;
    }
    if (one !== target && close(one, target)) {
      out.push({ ...words[i], text: tool + tail(words[i].text) });
      fixes++;
      continue;
    }
    if (one === target && words[i].text.replace(/[^A-Za-z0-9]/g, '') !== tool) {
      out.push({ ...words[i], text: tool + tail(words[i].text) });
      fixes++;
      continue;
    }
    out.push(words[i]);
  }
  return { words: out, fixes };
}

// "everbee-promo-code" -> "Everbee". Pass --tool for real casing (EverBee).
export function toolFromSlug(slug) {
  const base = slug.replace(/-(promo|coupon|discount)-codes?.*$/, '').replace(/-/g, ' ').trim();
  return base.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s+/g, '');
}
