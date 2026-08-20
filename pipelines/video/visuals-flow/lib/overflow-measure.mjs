// The canvas-bounds overflow measurement, in ONE place. board.mjs injects it into
// its preview iframe; card-library/scripts/overflow-probe.mjs injects it into a
// headless page. Two copies would drift, and the copy that drifts is the gate.
export const CANVAS = { W: 1920, H: 1080, TOL: 2 };

// Source text of a function evaluated INSIDE the page. Keep it dependency-free
// and ES5-safe: it is stringified, not bundled.
export const MEASURE_OVERFLOW_SRC = `
function __measureOverflow() {
  const W = 1920, H = 1080, TOL = 2;
  const offenders = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    // Full-bleed cover: an element extending past (or to) ALL FOUR edges is a
    // deliberate bleed (parallax backgrounds set inset:-10%), not clipped
    // content — kinetic-sentence's #bg painted a red OVERFLOW badge on a
    // perfectly fine card (owner report 2026-07-31). Nothing readable can be
    // lost off an edge the element already covers, so skip it.
    if (r.left <= TOL && r.top <= TOL && r.right >= W - TOL && r.bottom >= H - TOL) continue;
    if (r.right > W + TOL || r.bottom > H + TOL || r.left < -TOL || r.top < -TOL) {
      offenders.push((el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : '')));
      if (offenders.length >= 5) break;
    }
  }
  // No document-scroll fallback: every scroll overflow is caused by an element
  // the loop above already sees, and the scroll metric cannot tell a bleed
  // from a clip — it is what kept flagging full-bleed backgrounds after the
  // element loop learned the difference.
  return { broken: offenders.length > 0, offenders };
}
`;

// Text sitting ON another element's artwork. The intro film has had a clearance
// audit since 2026-08-15; the CARD LIBRARY has never had one, which is the whole
// answer to the owner's 2026-08-20 question about a heading over a gauge:
// "Why the words 'why they win' are overlapping on the graphic? I have given
// similar kind of feedback before also. Why this is happening again."
// It happened again because nothing could see it. Overflow only catches content
// leaving the CANVAS; two elements colliding inside it is invisible to every
// gate the library has.
//
// Deliberately narrow, so it can be trusted rather than muted:
//   - only TEXT is the victim — that is what becomes unreadable;
//   - measured by INK (a Range over the text node), never the element box, or
//     every wide nowrap heading would report against half the card;
//   - an ancestor or descendant never counts, so a chip's own background and
//     any wrapper are excluded by construction;
//   - the other element must actually PAINT — a background, a border, an image
//     or an SVG. Invisible layout wrappers are the main source of false hits.
//   - real intersection only, not a clearance band. Cards are denser than the
//     intro film and a 40px minimum would fire everywhere; overlap is the thing
//     the owner can see.
export const MEASURE_CLEARANCE_SRC = `
function __measureClearance() {
  const hits = [];
  const name = (el) => el.id ? '#' + el.id
    : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string'
        ? '.' + el.className.split(' ').filter(Boolean)[0] : '');
  const visible = (el) => {
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.15;
  };
  const paints = (el) => {
    if (el.tagName === 'IMG' || el.tagName === 'SVG' || el.tagName === 'CANVAS') return true;
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor || '';
    const hasBg = bg && bg !== 'transparent' && !/rgba\\(\\s*0\\s*,\\s*0\\s*,\\s*0\\s*,\\s*0\\s*\\)/.test(bg);
    const hasImg = cs.backgroundImage && cs.backgroundImage !== 'none';
    const hasBorder = parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0;
    return !!(hasBg || hasImg || hasBorder);
  };
  // A text leaf: an element with its own non-empty text, not just wrapping more.
  const texts = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    let own = '';
    for (const n of el.childNodes) if (n.nodeType === 3) own += n.nodeValue;
    if (!own.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(el);
    const r = range.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    texts.push({ el: el, r: r });
  }
  const solids = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || !paints(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    if (r.width >= 1900 && r.height >= 1060) continue;   // full-bleed ground
    solids.push({ el: el, r: r });
  }
  for (const t of texts) {
    for (const s of solids) {
      if (t.el === s.el) continue;
      if (t.el.contains(s.el) || s.el.contains(t.el)) continue;
      const ox = Math.min(t.r.right, s.r.right) - Math.max(t.r.left, s.r.left);
      const oy = Math.min(t.r.bottom, s.r.bottom) - Math.max(t.r.top, s.r.top);
      if (ox <= 0 || oy <= 0) continue;
      // Ignore a hairline graze; report anything a reader would notice.
      const covered = (ox * oy) / (t.r.width * t.r.height);
      if (covered < 0.04) continue;
      hits.push(name(t.el) + ' ("' + (t.el.textContent || '').trim().slice(0, 32)
        + '") sits on ' + name(s.el) + ' — ' + Math.round(covered * 100) + '% covered');
      if (hits.length >= 5) return { broken: true, hits: hits };
    }
  }
  return { broken: hits.length > 0, hits: hits };
}
`;
