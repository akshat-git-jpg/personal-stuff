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
