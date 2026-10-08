import { normWord } from '../resolve.mjs';

// Coupon-code videos follow one fixed script shape, so the edit is a rule table
// over the transcript: no LLM, no review. Same words in, same plan out.
//
//   before/after price   -> no card: the screen already shows it (owner removed deal-stamp 2026-09-30)
//   "hey guys" .. first "description" sentence   -> full-screen avatar (s01)
//   every "description" mention (20s apart)       -> link-in-description pill
//   the code itself      -> never on screen: it changes, the description does not (owner 2026-09-30)
//   "that's it" .. end   -> full-screen avatar (s02)
//   "subscribe"          -> like-subscribe
//   everything else      -> screen recording with the avatar bubble

export const COUPON_RULES = {
  AVATAR: 'helen-office',  // default coupon presenter (owner 2026-10-09); --avatar overrides
  TRANSITION_GUARD: 0.6,   // s kept clear of cards around an avatar cut
  CARD_GAP: 0.3,           // s between two overlays
  MAX_SLIP: 2.5,           // s a card may move off its trigger before it is dropped
  PILL_MIN_GAP: 20,        // s between two link pills
  DUR: {
    'link-in-description/link-in-description': 4,
    'like-subscribe/like-subscribe': 5,
  },
};

const INTRO_OPENERS = [['hey', 'guys'], ['hi', 'guys'], ['hello', 'guys'], ['hey', 'everyone'], ['hi', 'everyone']];
const OUTRO_OPENERS = [["that's", 'it'], ['thats', 'it']];
const CODE_RE = /^[A-Z]{2,}[A-Z0-9]*\d[A-Z0-9]*$/;

const isEnd = (w) => /[.!?]["')\]]*$/.test(w.text);
const clean = (t) => t.replace(/^[^\w$]+|[^\w%]+$/g, '');

function indexWords(words) {
  return words.map((w, i) => ({ ...w, i, n: normWord(w.text) })).filter((w) => w.n);
}

function findSeq(W, seq, from = 0, to = W.length) {
  for (let i = from; i <= Math.min(to, W.length) - seq.length; i++) {
    if (seq.every((s, j) => W[i + j].n === s)) return i;
  }
  return -1;
}

function findLastSeq(W, seq) {
  for (let i = W.length - seq.length; i >= 0; i--) {
    if (seq.every((s, j) => W[i + j].n === s)) return i;
  }
  return -1;
}

function sentenceStart(W, k) {
  let i = k;
  while (i > 0 && !isEnd(W[i - 1])) i--;
  return i;
}

function sentenceEnd(W, k) {
  let i = k;
  while (i < W.length - 1 && !isEnd(W[i])) i++;
  return i;
}

// A verbatim anchor of >= 3 words starting at k (findPhrase needs 3).
function anchorAt(W, k, len = 4) {
  const s = Math.max(0, Math.min(k, W.length - 3));
  return W.slice(s, Math.min(W.length, s + len)).map((w) => w.text).join(' ');
}

// A verbatim anchor ending on word k.
function anchorEndingAt(W, k, len = 4) {
  const e = Math.max(k, 2);
  return W.slice(Math.max(0, e - len + 1), e + 1).map((w) => w.text).join(' ');
}

// Shortest anchor (3..8 words) at word k that the forward matcher lands on exactly.
export function uniqueAnchor(W, k, cursor, endAnchored = false) {
  for (let len = 3; len <= 8; len++) {
    const s = endAnchored ? k - len + 1 : k;
    if (s < cursor || s < 0 || s + len > W.length) continue;
    const seq = W.slice(s, s + len).map((w) => w.n);
    if (findSeq(W, seq, cursor) === s) {
      return { s, len, text: W.slice(s, s + len).map((w) => w.text).join(' ') };
    }
  }
  return null;
}

export function findCode(words) {
  const counts = new Map();
  for (const w of words) {
    const t = clean(w.text);
    if (CODE_RE.test(t)) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  let best = null;
  for (const [code, n] of counts) if (!best || n > best.n) best = { code, n };
  return best?.code ?? null;
}

// Place a card at or AFTER its trigger, never before: a CTA must not appear before
// its words are spoken (owner 2026-09-30). Clashes push it later; null = drop it.
export function place(trigger, dur, { cuts, taken, total }) {
  const { TRANSITION_GUARD: G, CARD_GAP, MAX_SLIP } = COUPON_RULES;
  let s = Math.max(0, trigger);
  for (let pass = 0; pass < 6; pass++) {
    let moved = false;
    for (const b of cuts) {
      if (s < b + G && s + dur > b - G) { s = b + G; moved = true; }
    }
    for (const t of taken) {
      if (s < t.end + CARD_GAP && s + dur > t.start - CARD_GAP) { s = t.end + CARD_GAP; moved = true; }
    }
    if (!moved) break;
  }
  if (s - trigger > MAX_SLIP || s + dur > total) return null;
  const clash = cuts.some((b) => s < b + G && s + dur > b - G)
    || taken.some((t) => s < t.end + CARD_GAP && s + dur > t.start - CARD_GAP);
  return clash ? null : +s.toFixed(2);
}

// The ASR often runs "...copy the code and that's it you've..." as one sentence.
// The avatar spans must start on a sentence, so close the sentence before each opener.
export function markOpenerBreaks(words) {
  const out = words.map((w) => ({ ...w }));
  const W = indexWords(out);
  const openers = [];
  for (const o of INTRO_OPENERS) { const i = findSeq(W, o); if (i >= 0) openers.push(i); }
  for (const o of OUTRO_OPENERS) {
    let i = findLastSeq(W, o);
    if (i >= 0 && W[i - 1]?.n === 'and') i -= 1;
    if (i >= 0) openers.push(i);
  }
  let marks = 0;
  for (const i of openers) {
    if (i <= 0) continue;
    const prev = out[W[i - 1].i];
    if (!/[.!?]["')\]]*$/.test(prev.text)) {
      prev.text = prev.text.replace(/[,;:]$/, '') + '.';
      const cur = out[W[i].i];
      cur.text = cur.text.charAt(0).toUpperCase() + cur.text.slice(1);
      marks++;
    }
  }
  return { words: out, marks };
}

export function planCoupon(words, { video, avatar = COUPON_RULES.AVATAR, total: audioTotal = null } = {}) {
  const W = indexWords(words);
  const errors = [];
  const notes = [];
  if (W.length === 0) return { errors: ['empty transcript'] };
  // Cards may run to the end of the audio, which outlasts the last word.
  const total = Math.max(W[W.length - 1].end, audioTotal ?? 0);

  let intro = -1;
  for (const o of INTRO_OPENERS) {
    const i = findSeq(W, o);
    if (i >= 0 && (intro < 0 || i < intro)) intro = i;
  }
  if (intro < 0) errors.push('no intro opener found ("hey guys" / "hi guys" / "hey everyone")');

  let introEnd = -1;
  if (intro >= 0) {
    const d = W.findIndex((w, k) => k > intro && w.n.includes('description'));
    if (d < 0) errors.push('no "description" sentence after the intro opener, so the first avatar span has no end');
    else introEnd = sentenceEnd(W, d);
  }

  let outro = -1;
  for (const o of OUTRO_OPENERS) outro = Math.max(outro, findLastSeq(W, o));
  if (outro >= 0 && W[outro - 1]?.n === 'and') outro -= 1;
  if (outro < 0) errors.push('no outro opener found ("that\'s it")');
  if (outro >= 0 && introEnd >= 0 && outro <= introEnd) errors.push('outro opener comes before the intro span ends');

  const code = findCode(words);
  if (errors.length) return { errors, notes };

  // resolve-shots walks one forward cursor over from/to anchors, same as cues.
  const a1 = uniqueAnchor(W, intro, 0);
  const b1 = a1 && uniqueAnchor(W, introEnd, a1.s + a1.len, true);
  const a2 = b1 && uniqueAnchor(W, outro, b1.s + b1.len);
  const b2 = a2 && uniqueAnchor(W, W.length - 1, a2.s + a2.len, true);
  if (!b2) return { errors: ['could not build unique avatar span anchors'], notes };
  const spans = [
    { id: 's01', purpose: 'avatar-full', mode: 'full', from_anchor: a1.text, to_anchor: b1.text,
      note: 'coupon template: intro, from the greeting to the first link-in-description line', flagged: false },
    { id: 's02', purpose: 'avatar-full', mode: 'full', from_anchor: a2.text, to_anchor: b2.text,
      note: 'coupon template: outro, from "that\'s it" to the end', flagged: false },
  ];
  const s01 = { start: W[intro].start, end: W[introEnd].end };
  const s02 = { start: W[outro].start, end: total };
  const cuts = [s01.start, s01.end, s02.start].filter((t) => t > 0.5);

  const candidates = [];
  let lastPill = -Infinity;
  W.forEach((w, k) => {
    if (!w.n.includes('description')) return;
    if (w.start - lastPill < COUPON_RULES.PILL_MIN_GAP) return;
    lastPill = w.start;
    // Up on the word "link" when the sentence says it before "description", else on "description".
    let t = k;
    for (let j = k - 1; j >= Math.max(sentenceStart(W, k), k - 6); j--) if (W[j].n === 'link' || W[j].n === 'links') t = j;
    candidates.push({ card: 'link-in-description/link-in-description', k, anchorEnd: true, trigger: W[t].start, variables: {} });
  });

  const subK = W.findLastIndex((w) => w.n.startsWith('subscribe'));
  if (subK >= 0) {
    // Up where the call to action starts ("don't forget to hit the subscribe"), not before it.
    let t = subK;
    for (let j = subK - 1; j >= Math.max(sentenceStart(W, subK), subK - 5); j--) {
      if (['dont', "don't", 'forget', 'hit', 'smash', 'click', 'press'].includes(W[j].n)) t = j;
    }
    candidates.push({ card: 'like-subscribe/like-subscribe', k: subK, anchorEnd: true, trigger: W[t].start, variables: {} });
  }
  else notes.push('no "subscribe" line, so no subscribe card');

  // Earlier triggers win a clash.
  candidates.sort((a, b) => a.trigger - b.trigger);
  const taken = [];
  const kept = [];
  for (const c of candidates) {
    const dur = COUPON_RULES.DUR[c.card];
    const at = place(c.trigger, dur, { cuts, taken, total });
    if (at === null) { notes.push(`dropped ${c.card} at ${c.trigger.toFixed(1)}s: no clear slot near its line`); continue; }
    taken.push({ start: at, end: at + dur });
    kept.push({ ...c, at, dur });
  }
  // The resolver matches anchors forward in cue order, so walk the same cursor
  // and grow each anchor until its first match is its own line.
  kept.sort((a, b) => a.k - b.k);
  let cursor = 0;
  const ordered = [];
  for (const c of kept) {
    const a = uniqueAnchor(W, c.k, cursor, c.anchorEnd);
    if (!a) { notes.push(`dropped ${c.card}: no unique anchor for its line`); continue; }
    cursor = a.s + a.len;
    ordered.push({ id: `c${String(ordered.length + 1).padStart(2, '0')}`, card: c.card, anchor: a.text,
      lead: +(W[a.s].start - c.at).toFixed(2), hold: c.dur, register: 'dark',
      variables: c.variables, beats: [], flagged: false });
  }

  return {
    errors: [], notes, code,
    cues: { video, approved: true, approvedNote: 'coupon template: rule-planned, no review by owner rule (2026-09-30)', cues: ordered, spans: [] },
    shots: { video, approved: true, engineMode: 'test', approvedNote: 'coupon template: Avatar III only (owner rule 2026-09-30)',
      intro_host_waived: 'coupon template: the before/after price opens the video and the host enters at the greeting (owner rule 2026-09-30)',
      spans },
    avatarPlan: { video, character: avatar, model: 'heygen3', approved: true, approvedNote: `coupon template: ${avatar} on Avatar III (owner rule 2026-09-30)` },
    timeline: { s01, s02, total },
  };
}
