// 050's measured checks: judgments on the kit's box probe of a composition, the hyperframes check report and
// the screen recording's motion map. Pure functions; review-frames.mjs gathers the inputs.
// Text-on-text overlap and text spilling out of its box are the hyperframes check's job and are not repeated here.

export const CHECK_LIMITS = Object.freeze({
  minOpacity: 0.3,        // below this a box is not "on screen" for layout purposes
  backdropFrac: 0.5,      // a box over half the canvas is a background, not content
  smallGraphicFrac: 0.04, // icons and tiles: graphics under 4% of the canvas
  crowdOverlap: 0.2,      // two small graphics overlapping by this share of the smaller one crowd each other
  thinLine: 12,           // a box thinner than this is a line or rule, never a crowding peer
  peerRatio: 2.5,         // peers: the larger is at most 2.5x the area of the smaller
  heroFont: 96,           // hero type: font-size at or above this
  attachGap: 0.4,         // a graphic within 0.4 font-sizes of hero type is attached to it
  clearGap: 1.5,          // and one beyond 1.5 font-sizes is clear of it
  textHit: 0.05,          // a graphic covering this share of a text box collides with it
  crowdHold: 0.75,        // a collision must last this long to count (passing transients are fine)
  partialLow: 0.1, partialHigh: 0.9,
  fullFrom: 0.4,          // empty-band check looks at the frame from 40% of the moment on (built up)
  minCoverage: 0.55,      // a takeover's content should span at least 55% of the frame height
  maxBand: 0.3,           // and leave no empty horizontal band taller than 30% of it
  busyCover: 0.25,        // an overlay may cover at most 25% of the recording's busy region
});
const L = CHECK_LIMITS;
const REVEAL_PROPS = new Set(['opacity', 'autoAlpha', 'clipPath', 'text', 'width', 'height', 'drawSVG', 'strokeDashoffset']);

const area = (b) => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);
const inter = (a, b) => area({ x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) });
const clipTo = (b, w, h) => ({ x0: Math.max(0, b.x0), y0: Math.max(0, b.y0), x1: Math.min(w, b.x1), y1: Math.min(h, b.y1) });
const insideFrac = (a, b) => (area(a) ? inter(a, b) / area(a) : 0); // share of a inside b

// Visible boxes that make up the picture: text, and graphics that are not the backdrop.
export function contentBoxes(sample, { w, h }) {
  const canvas = w * h;
  const texts = sample.texts.filter((x) => x.op >= L.minOpacity).map((x) => ({ ...x, box: clipTo(x.box, w, h) })).filter((x) => area(x.box) > 0);
  const graphics = sample.graphics.filter((g) => g.op >= L.minOpacity && area(g.box) < L.backdropFrac * canvas)
    .map((g) => ({ ...g, box: clipTo(g.box, w, h) })).filter((g) => area(g.box) > 0);
  return { texts, graphics };
}

// Text cut off by the frame edge. hyperframes measures it (canvas_overflow) but files it as info, so it is surfaced here.
export function textCutOff(report) {
  const seen = new Map();
  for (const f of report?.layout?.findings ?? []) {
    if (f.code !== 'canvas_overflow') continue;
    const k = `${f.selector}|${f.text}`;
    const t = f.time ?? f.firstSeen ?? 0;
    if (!seen.has(k)) seen.set(k, { severity: 'error', check: 'text-cut-off', message: `"${String(f.text ?? '').slice(0, 40)}" is cut off by the frame edge (${f.selector})`, at: t });
  }
  return [...seen.values()];
}

// Graphics colliding with text, or small graphics piled on each other, held long enough to read as a layout.
export function crowding(samples, canvas) {
  const total = canvas.w * canvas.h;
  const open = new Map(), found = [];
  const step = samples.length > 1 ? samples[1].t - samples[0].t : 0.25;
  const close = (k, end) => {
    const o = open.get(k);
    if (o && end - o.from >= L.crowdHold - 1e-6) found.push({ severity: 'warning', check: 'crowding', message: `${o.what} (${o.from.toFixed(2)}-${end.toFixed(2)}s)`, at: o.from });
    open.delete(k);
  };
  for (const s of samples) {
    const { texts, graphics } = contentBoxes(s, canvas);
    const hits = new Map();
    for (const tx of texts) for (const g of graphics) {
      if (insideFrac(tx.box, g.box) >= 0.9 || insideFrac(g.box, tx.box) >= 0.9) continue; // a backdrop panel, or an inline icon
      if (inter(tx.box, g.box) / area(tx.box) >= L.textHit) hits.set(`t|${tx.sel}|${g.sel}`, `${g.sel} collides with the text "${tx.text.slice(0, 30)}"`);
    }
    // Peers only: similar-size icons or tiles, not a line running through them or a badge stuck on a logo.
    const small = graphics.filter((g) => area(g.box) < L.smallGraphicFrac * total && Math.min(g.box.x1 - g.box.x0, g.box.y1 - g.box.y0) >= L.thinLine);
    for (let i = 0; i < small.length; i++) for (let j = i + 1; j < small.length; j++) {
      const a = small[i], b = small[j];
      if (insideFrac(a.box, b.box) >= 0.9 || insideFrac(b.box, a.box) >= 0.9) continue;
      const [lo, hi] = [area(a.box), area(b.box)].sort((x, y) => x - y);
      if (hi / lo > L.peerRatio) continue;
      if (inter(a.box, b.box) / lo >= L.crowdOverlap) hits.set(`g|${a.sel}|${b.sel}`, `${a.sel} and ${b.sel} pile on each other`);
    }
    // Beside hero type a graphic is either attached to it (a lockup) or clear of it, not wedged in between.
    for (const tx of texts.filter((x) => x.font >= L.heroFont)) for (const g of graphics) {
      if (area(g.box) >= L.smallGraphicFrac * total || insideFrac(g.box, tx.box) >= 0.9 || insideFrac(tx.box, g.box) >= 0.9) continue;
      const rowShare = Math.max(0, Math.min(tx.box.y1, g.box.y1) - Math.max(tx.box.y0, g.box.y0)) / Math.min(tx.box.y1 - tx.box.y0, g.box.y1 - g.box.y0);
      if (rowShare < 0.5) continue;
      const gap = Math.max(g.box.x0 - tx.box.x1, tx.box.x0 - g.box.x1);
      if (gap > L.attachGap * tx.font && gap < L.clearGap * tx.font) hits.set(`h|${tx.sel}|${g.sel}`, `${g.sel} is wedged ${Math.round(gap)}px beside the heading "${tx.text.slice(0, 30)}" (attach it within ${Math.round(L.attachGap * tx.font)}px or clear it by ${Math.round(L.clearGap * tx.font)}px)`);
    }
    for (const k of [...open.keys()]) if (!hits.has(k)) close(k, s.t);
    for (const [k, what] of hits) if (!open.has(k)) open.set(k, { from: s.t, what });
  }
  const end = samples.length ? samples[samples.length - 1].t + step : 0;
  for (const k of [...open.keys()]) close(k, end);
  return found;
}

// Text that is part-way in: partly transparent, or under a reveal tween at this instant.
export function unfinishedText(sample) {
  return sample.texts.filter((x) => x.op >= 0.02).flatMap((x) => {
    const reveal = (x.mid ?? []).filter((p) => REVEAL_PROPS.has(p));
    if (reveal.length || (x.op > L.partialLow && x.op < L.partialHigh)) return [{ ...x, how: reveal.length ? `mid-${reveal.join('+')}` : `opacity ${x.op}` }];
    return [];
  });
}

// A cut lands on a finished frame: nothing half-revealed on the first or the last frame.
export function finishedFrames(first, last, { kind = 'takeover', canvas } = {}) {
  const out = [];
  for (const [label, s] of [['first', first], ['last', last]]) {
    if (!s) continue;
    for (const x of unfinishedText(s)) out.push({ severity: 'error', check: 'finished-frame', message: `"${x.text.slice(0, 30)}" is half-revealed on the ${label} frame (${x.how}, ${x.sel})`, at: s.t });
  }
  if (first && kind === 'takeover' && canvas) {
    const { texts, graphics } = contentBoxes(first, canvas);
    if (!texts.length && !graphics.length) out.push({ severity: 'warning', check: 'finished-frame', message: 'the first frame is an empty stage: the cut from the recording lands on nothing', at: first.t });
  }
  return out;
}

// Merged [y0, y1] spans covered by any box.
function spans(boxes) {
  const s = boxes.map((b) => [b.y0, b.y1]).sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [a, b] of s) {
    if (out.length && a <= out[out.length - 1][1]) out[out.length - 1][1] = Math.max(out[out.length - 1][1], b);
    else out.push([a, b]);
  }
  return out;
}

// A takeover owns the frame: its built-up picture should span the height, not leave a big empty band.
export function emptyBand(samples, canvas, { duration } = {}) {
  const from = (duration ?? (samples.at(-1)?.t ?? 0)) * L.fullFrom;
  // The built-up frame: the sample from `fullFrom` on whose content spans the most height.
  const cover = (bs) => spans(bs).reduce((n, [a, b]) => n + (b - a), 0);
  let boxes = [];
  for (const s of samples.filter((x) => x.t >= from)) {
    const { texts, graphics } = contentBoxes(s, canvas);
    const bs = [...texts, ...graphics].map((x) => x.box);
    if (bs.length && cover(bs) > cover(boxes)) boxes = bs;
  }
  if (!boxes.length) return { findings: [{ severity: 'warning', check: 'empty-band', message: 'nothing on screen in the second half of the moment' }], coverage: 0, band: null };
  const sp = spans(boxes);
  const gaps = [[0, sp[0][0]], ...sp.slice(1).map((s, i) => [sp[i][1], s[0]]), [sp.at(-1)[1], canvas.h]];
  const band = gaps.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a));
  const coverage = +(sp.reduce((n, [a, b]) => n + (b - a), 0) / canvas.h).toFixed(2);
  const bandFrac = +((band[1] - band[0]) / canvas.h).toFixed(2);
  const where = band[0] <= 1 ? 'at the top' : band[1] >= canvas.h - 1 ? 'at the bottom' : `between ${Math.round(band[0])} and ${Math.round(band[1])}px`;
  const findings = [];
  if (coverage < L.minCoverage || bandFrac >= L.maxBand) {
    findings.push({ severity: 'warning', check: 'empty-band', message: `the built-up frame spans ${Math.round(coverage * 100)}% of the height and leaves ${Math.round(bandFrac * 100)}% empty ${where} (limits: span >= ${Math.round(L.minCoverage * 100)}%, band < ${Math.round(L.maxBand * 100)}%)` });
  }
  return { findings, coverage, band: { y0: Math.round(band[0]), y1: Math.round(band[1]), frac: bandFrac } };
}

// An overlay must not sit on the part of the recording the voice is talking about (where it moves).
export function coversBusy(samples, canvas, busy) {
  if (!busy?.cells?.length) return { findings: [], covered: 0 };
  const boxes = samples.flatMap((s) => {
    const { texts, graphics } = contentBoxes(s, canvas);
    return [...texts, ...graphics].map((x) => x.box);
  });
  const cw = canvas.w / busy.cols, ch = canvas.h / busy.rows;
  let covered = 0;
  for (const c of busy.cells) {
    const cell = { x0: c.col * cw, y0: c.row * ch, x1: (c.col + 1) * cw, y1: (c.row + 1) * ch };
    // Coarse: the most any one box covers this cell.
    covered += Math.max(0, ...boxes.map((b) => inter(b, cell) / area(cell)));
  }
  const frac = +(covered / busy.cells.length).toFixed(2);
  const findings = frac > L.busyCover
    ? [{ severity: 'error', check: 'covers-busy', message: `the overlay covers ${Math.round(frac * 100)}% of where the recording moves (x ${pct(busy.box.x0)}-${pct(busy.box.x1)}, y ${pct(busy.box.y0)}-${pct(busy.box.y1)} of the frame); move it off that region` }]
    : [];
  return { findings, covered: frac };
}
const pct = (f) => `${Math.round(f * 100)}%`;

// Review stills at settled instants: the nearest sample to each target with no text mid-reveal.
export function settledTimes(samples, targets) {
  return targets.map((t) => {
    const ok = samples.filter((s) => !unfinishedText(s).length);
    if (!ok.length) return { t, settled: false };
    const best = ok.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
    return { t: best.t, settled: true, wanted: t };
  });
}

// The moment with the most to fix. Errors weigh 3, each distinct warning 1, dead seconds 0.5 each.
// A warning every moment shares (a lint note on the house template) says nothing about which is weakest.
const MEASURED = /^(\[[^\]]+\] )?(text-cut-off|crowding|finished-frame|empty-band|covers-busy):/;
const warnKey = (w) => w.replace(/ @[\d.]+s/, '').replace(/\(\d[\d.]*-[\d.]+s\)/, '').trim();
export function weakestMoment(entries) {
  const list = Object.entries(entries);
  const keysOf = (e) => new Set((e.warnings ?? []).map(warnKey));
  const shared = list.length > 1 ? [...keysOf(list[0][1])].filter((k) => list.every(([, e]) => keysOf(e).has(k))) : [];
  let best = null;
  for (const [id, e] of list) {
    const warns = [...keysOf(e)].filter((k) => !shared.includes(k));
    const dead = e.deadSeconds ?? 0;
    const measured = (e.warnings ?? []).filter((w) => MEASURED.test(w) && !shared.includes(warnKey(w)));
    // Measured findings break ties: they are about the picture, not the code.
    const score = 3 * (e.errors?.length ?? 0) + warns.length + 0.5 * dead + 0.1 * measured.length;
    if (score > 0 && (!best || score > best.score)) {
      const reason = e.errors?.[0] ?? measured[0] ?? (dead ? `${dead}s of the cut with nothing new on screen` : warns[0]);
      best = { id, score, reason: dead && !e.errors?.length ? `${reason}; ${dead}s with nothing new on screen` : reason };
    }
  }
  return best;
}
