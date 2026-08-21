// TASTE-INTRO T13/T14 enforcement — clearance, not non-overlap.
//
// WHAT THIS EXISTS TO CATCH, and why nothing else does:
//
// Every layout check in this pipeline tests for OVERLAP — a strictly positive
// box intersection. The owner rejects on CLEARANCE: two things that do not
// touch, but sit close enough to read as one broken object. On 2026-08-15
// hyperframes `check` sampled the best-no-code-automation-tool intro film 464
// times, including all six defect timestamps the owner had reported, and
// returned ZERO layout findings. A sub sat 8px off a gate lintel, a measuring
// rule was drawn THROUGH a subtitle, and a label overflowed a fixed column —
// all three passed.
//
// The subtitle case is the one that defines the shape here. hyperframes'
// `text_occluded` only fires on text COVERED BY something; `#rule` painted
// BEHIND `.sub` and struck it through, so the checker saw text on top of a
// graphic — not its defect shape — and passed. Hence `text_intersect` below is
// deliberately symmetric in z-order.
//
// PRIOR ART: an equivalent audit was hand-written into two film compositions
// (see videos/best-no-code-automation-tool/intro-film/film/index.html, whose own
// comment says "Extracting it is plans/-work"). This module is that extraction:
// the same rules, once, tested, and driven over any film.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch } from './cdp.mjs';

// TASTE-INTRO T13: 40px at 1080p. Below this, adjacent bands read as touching.
// This is the OWNER'S RULE, not a tuning knob — it came from three complaints on
// 2026-08-15 where the real gaps were 8px and 16px. Anyone lowering it should be
// able to point at owner feedback saying so.
export const MIN_CLEARANCE_PX = 40;

// Sample phases through the composition, matching review-film's BEAT_PHASES so
// the two passes never disagree about what "sampled" means.
export const DEFAULT_PHASES = [0.25, 0.55, 0.85];

// ---- page-side snippets -----------------------------------------------------

// Seeking must drive BOTH adapters, because films here use GSAP *or* pure CSS.
export const SEEK_JS = (t) => `(() => {
  const tls = window.__timelines || {};
  for (const k of Object.keys(tls)) {
    const tl = tls[k];
    try { tl.pause(); tl.seek ? tl.seek(${t}) : tl.totalTime(${t}); } catch (e) {}
  }
  // CSS-adapter films: pin every running animation to the same instant so a
  // seek is deterministic rather than wall-clock dependent.
  for (const el of document.querySelectorAll('*')) {
    for (const a of (el.getAnimations ? el.getAnimations() : [])) {
      try { a.pause(); a.currentTime = ${t} * 1000; } catch (e) {}
    }
  }
  return true;
})()`;

// Measures every visible element box. Text is measured by its INK, not its box:
// T13 says "measure ink, not boxes" and it is load-bearing — a `.hero` is a
// 1600px nowrap block holding maybe 800px of glyphs, so its element rect would
// collide with half the frame and report nothing true. The Range rect knows the
// real glyph width. Vertically a Range is built from the font's ascent+descent
// rather than the line box, so a 150px hero at line-height:1.0 reports ~180px
// tall and hangs over the box the author positioned — clamp it back to the
// element box, which for these single-line blocks IS the line box. Both of these
// were learned in the in-composition audit this module replaces.
export const MEASURE_JS = `(() => {
  // The selector must be UNIQUE per element, not merely descriptive. A
  // within-parent index alone gave every row of a list the same name
  // ('span.n[0]'), which made findings ambiguous AND corrupted the sweep pass:
  // sweepFindings keys by selector, so several distinct elements collapsing into
  // one key produced a union spanning all of them and reported a phantom
  // traveller. Anchor on the nearest id-bearing ancestor and walk down.
  const sel = (el) => {
    if (el.id) return '#' + el.id;
    const parts = [];
    let cur = el;
    while (cur && !cur.id && cur.parentElement) {
      const p = cur.parentElement;
      const idx = Array.prototype.indexOf.call(p.children, cur);
      const cls = (cur.className && typeof cur.className === 'string')
        ? '.' + cur.className.trim().split(/\\s+/).join('.') : '';
      parts.unshift(cur.tagName.toLowerCase() + cls + '[' + idx + ']');
      cur = p;
    }
    return (cur && cur.id ? '#' + cur.id + ' > ' : '') + parts.join(' > ');
  };
  const ownText = (el) => Array.from(el.childNodes)
    .some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
  // Ink rect for a text-bearing element, clamped vertically to its own box.
  const inkRect = (el, box) => {
    try {
      const range = document.createRange();
      range.selectNodeContents(el);
      const t = range.getBoundingClientRect();
      if (!(t.width > 1 && t.height > 1)) return null;
      const top = Math.max(t.top, box.top), bottom = Math.min(t.bottom, box.bottom);
      if (!(bottom - top > 1)) return null;
      return { x: t.left, y: top, w: t.width, h: bottom - top };
    } catch (e) { return null; }
  };
  // The UNIT an element belongs to: its nearest id-bearing ancestor-or-self,
  // ignoring #root. Authors give ids to the things they think of as objects, so
  // this is the closest available reading of "which object is this part of".
  // Two parts of the SAME object are not competing for space — an icon and its
  // caption, a logo and its wordmark — so pairs inside one unit are skipped.
  const unitOf = (el) => {
    let cur = el;
    while (cur && cur.id !== 'root') {
      if (cur.id) return '#' + cur.id;
      cur = cur.parentElement;
    }
    return '#root';
  };
  const root = document.getElementById('root') || document.body;
  const rootRect = root.getBoundingClientRect();

  const out = [];
  const walk = (el, depth) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    // Below ~0.06 an element reads as absent, so measuring it produces findings
    // about something nobody can see.
    if (parseFloat(cs.opacity) < 0.06) return;
    const r = el.getBoundingClientRect();
    if (r.width > 0.5 && r.height > 0.5) {
      const text = ownText(el);
      const ink = text ? inkRect(el, r) : null;
      const b = ink || { x: r.x, y: r.y, w: r.width, h: r.height };
      // NOTE: no backticks in this comment — it lives inside a template literal.
      //   text    = carries its own glyphs, so it is measured by ink.
      //   textish = has text ANYWHERE in its subtree, so it is a text BLOCK
      //             rather than a device. A row wrapper holds no glyphs itself
      //             but is not competing for space with the row below it — they
      //             are one list on one rhythm. Without this the pass reported a
      //             container against its sibling's child span and restated the
      //             same 28px rhythm 24 times.
      // A near-full-frame element is a BACKDROP, not a device competing for
      // space: everything necessarily sits on it. The old in-composition audit
      // used the same rule (width>=1900 && height>=1060 on a 1920x1080 canvas)
      // because the full-bleed presenter beats otherwise reported every device
      // on screen and drowned the real findings.
      const fullBleed = r.width >= rootRect.width * 0.95
        && r.height >= rootRect.height * 0.95;
      // A BLURRED element has no readable edge, so it cannot form a clearance
      // relationship: T13 is about two things reading as one broken OBJECT, and
      // that needs two edges. The ambient glow in best-no-code-automation-tool
      // is the case that proves it — a 20%-alpha radial gradient under
      // filter:blur(38px), fading to transparent, drifting behind the whole
      // film. Text sitting on it is the design. Measured as a device it produced
      // every single error on that film, all of them false.
      const blurred = /blur\\(/.test(cs.filter || '');
      // A WASH: a gradient that fades to transparent. Its box is a bounding box,
      // not an edge — on the fading side there is nothing for a gap to be
      // measured to. Two of these were the entire error list on
      // best-no-code-automation-tool: the ambient glow (radial, to transparent)
      // and the legibility scrim behind the right-hand text column (linear, to
      // transparent). Both exist SO THAT text can sit on them.
      // A real device — a plate, a bar, a card — has a solid fill, so this does
      // not soften the cases T13 was written from.
      const bgi = cs.backgroundImage || '';
      const wash = /gradient\\(/.test(bgi)
        && (/transparent/.test(bgi) || /rgba\\([^)]*,\\s*0\\s*\\)/.test(bgi));
      out.push({ sel: sel(el), unit: unitOf(el), depth,
        x: b.x, y: b.y, w: b.w, h: b.h, text,
        textish: el.textContent.trim().length > 0, fullBleed, blurred, wash });
    }
    // Do NOT descend into an <svg>. Its paths and circles are strokes of one
    // drawing, not objects on the stage — measuring them compared an icon's own
    // outline against that icon's label and reported the drawing as a defect.
    // The <svg> element itself is already measured above, as one object.
    if (el.tagName.toLowerCase() === 'svg') return;
    for (const c of el.children) walk(c, depth + 1);
  };
  walk(root, 0);
  return out;
})()`;

// ---- pure geometry (unit-testable, no browser) ------------------------------

const contains = (a, b) =>
  a.x <= b.x && a.y <= b.y && a.x + a.w >= b.x + b.w && a.y + a.h >= b.y + b.h;

// Axis separation. 0 on an axis means the boxes share a band on that axis.
export function separation(a, b) {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));
  return { dx, dy };
}

// Pairs the AUTHOR has declared to be one object. This is the only input that
// cannot be derived from the page, because "these two things read as one" is a
// composition decision. The audit this module replaces carried exactly one such
// entry inline — `'#rule|#rlabs'`, commented "the labels are the rule's own
// annotation, read as one object" — which is the proof that a structural rule
// alone cannot cover it: the two have separate ids and separate boxes and are
// still one object.
//
// Declared per film in `<filmDir>/clearance.json`:
//   { "allowedPairs": ["#rule|#rlabs"] }
//
// Keep this list SHORT and give every entry a reason. Widening it to quiet a
// finding is how the gate stops being worth running.
export const pairKey = (a, b) => [a, b].sort().join('|');

export function isAllowedPair(a, b, allowed) {
  if (!allowed || !allowed.size) return false;
  if (allowed.has(pairKey(a, b))) return true;
  // A declared pair covers the two objects' internals too: naming #rule|#rlabs
  // should not leave `#rule > i.mark[2]` vs `#rlabs > span.mlab[2]` reported.
  const unitPart = (s) => String(s).split(' > ')[0];
  return allowed.has(pairKey(unitPart(a), unitPart(b)));
}

export function pairFinding(a, b, allowed = null) {
  // A backdrop is not competing for space. Everything sits on it by definition.
  if (a.fullBleed || b.fullBleed) return null;

  // No edge, no clearance relationship. See `blurred` / `wash` in MEASURE_JS.
  if (a.blurred || b.blurred) return null;
  if (a.wash || b.wash) return null;

  if (isAllowedPair(a.sel, b.sel, allowed)) return null;

  // Two parts of ONE object. An icon and its caption, a logo and its wordmark,
  // a plate and the number on it — these are drawn as a single thing and their
  // internal spacing is the author's composition, not a clearance failure. This
  // is the narrowing that replaces the old audit's hand-written per-film device
  // list: instead of naming the objects for every film, read the objects off the
  // ids the author already wrote.
  //
  // KNOWN COST, accepted deliberately: T13's LangChain case ("its gap to the bar
  // collapsed to 16px while every other row had 113-140px") lives INSIDE one
  // unit, so it is no longer reported. That case is about the INCONSISTENCY
  // across rows — the owner "reads the inconsistency, not the absolute" — which a
  // fixed 40px threshold could never express anyway. Catching it needs a
  // per-column variance check, which is a different gate.
  if (a.unit && b.unit && a.unit === b.unit) return null;

  // An ancestor's box always encloses its child's; a full-bleed background
  // always encloses the text on it. Containment is normal composition, never a
  // defect — and without this suppression every film drowns in
  // background-behind-text noise, which would make the gate useless.
  if (contains(a, b) || contains(b, a)) return null;

  const { dx, dy } = separation(a, b);

  // PARTIAL intersection with text involved. This is the shape hyperframes'
  // text_occluded misses when the GRAPHIC is the thing underneath — exactly how
  // the b11 measuring rule struck through the subtitle and passed.
  if (dx === 0 && dy === 0) {
    if (!a.text && !b.text) return null;
    return { code: 'text_intersect', a: a.sel, b: b.sel, gap: 0 };
  }

  // Diagonal neighbours never read as touching — only flag when the boxes are
  // aligned on one axis and merely close on the other.
  if (dx > 0 && dy > 0) return null;

  const gap = dx === 0 ? dy : dx;

  // The 40px minimum is about a TEXT/DEVICE pair reading as one broken object.
  // Text against text is a different case: an eyebrow, its hero and its sub are
  // one title block on a designed vertical rhythm, and a name beside its value
  // is one row — those legitimately sit 10-30px apart, so holding them to 40px
  // reports the typography as a defect. Checked for intersection only, which the
  // dx===0 && dy===0 branch above already did. This distinction is carried over
  // from the in-composition audit this module replaces; without it the pass
  // reported 36 errors on `consistent-ai-influencer`, a film the owner had
  // already approved, and nearly all of them were its own type rhythm.
  //
  // `textish` (text anywhere in the subtree), not `text`, is the right test: a
  // row wrapper carries no glyphs of its own but is still part of the type
  // block, and comparing it against the next row's span restates a gap that the
  // row-to-row pair already covers.
  const aText = a.textish ?? a.text, bText = b.textish ?? b.text;
  if (aText && bText) return null;
  if (!aText && !bText) return null;   // device vs device is not T13's business

  if (gap >= MIN_CLEARANCE_PX) return null;
  return { code: 'low_clearance', a: a.sel, b: b.sel, gap: Math.round(gap) };
}

// Every pair within one sampled frame.
export function frameFindings(boxes, allowed = null) {
  const out = [];
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const f = pairFinding(boxes[i], boxes[j], allowed);
      if (f) out.push(f);
    }
  return out;
}

// Reads `<filmDir>/clearance.json` if present. Absent means no exceptions, which
// is the correct default: a film earns an exception by declaring one.
export function readAllowedPairs(filmDir) {
  const f = path.join(filmDir, 'clearance.json');
  if (!fs.existsSync(f)) return new Set();
  try {
    const cfg = JSON.parse(fs.readFileSync(f, 'utf8'));
    return new Set((cfg.allowedPairs ?? []).map((p) => {
      const [x, y] = String(p).split('|');
      return pairKey(x, y);
    }));
  } catch (e) {
    throw new Error(`${f} is not readable JSON: ${e.message}`);
  }
}

// T14 — a device parked in a traveller's corridor gets crossed. Union each
// element's boxes across samples; an element whose union is much larger than its
// own box is a TRAVELLER, and a static box inside that union is a conflict.
const areaOf = (r) => r.w * r.h;

// Union every element's box across samples, and split into things that MOVE and
// things that stay put. Shared by the sweep check and by traveller demotion, so
// the two can never disagree about which elements travel.
export function classifyMotion(perSample) {
  const unions = new Map(), last = new Map();
  for (const boxes of perSample) {
    for (const b of boxes) {
      last.set(b.sel, b);
      const u = unions.get(b.sel);
      if (!u) { unions.set(b.sel, { ...b }); continue; }
      const x2 = Math.max(u.x + u.w, b.x + b.w), y2 = Math.max(u.y + u.h, b.y + b.h);
      u.x = Math.min(u.x, b.x); u.y = Math.min(u.y, b.y);
      u.w = x2 - u.x; u.h = y2 - u.y;
    }
  }
  const travellers = [], statics = [];
  for (const [sel, u] of unions) {
    const own = last.get(sel);
    (areaOf(u) > areaOf(own) * 1.5 ? travellers : statics).push({ sel, u, own });
  }
  return { travellers, statics };
}

export const travellerSels = (perSample) =>
  new Set(classifyMotion(perSample).travellers.map((t) => t.sel));

export function sweepFindings(perSample) {
  const { travellers, statics } = classifyMotion(perSample);
  const out = [];
  for (const t of travellers) {
    for (const s of statics) {
      if (s.sel === t.sel || s.sel.startsWith(t.sel)) continue;
      // Containment is suppressed in ONE direction only, and the asymmetry is
      // the whole point of T14. If the STATIC encloses the corridor it is
      // scenery — #root and a full-bleed #bg enclose every traveller's union,
      // and reporting those would bury the real findings. But if the CORRIDOR
      // encloses the static, that is the defect itself: "a device parked in a
      // moving object's corridor will be crossed". Suppressing that direction
      // too (as a symmetric guard would) makes the sweep check unable to report
      // the only thing it exists to report.
      if (contains(s.own, t.u)) continue;
      const { dx, dy } = separation(t.u, s.own);
      if (dx === 0 && dy === 0) {
        out.push({ code: 'corridor_conflict', a: t.sel, b: s.sel, gap: 0 });
      }
    }
  }
  return out;
}

// corridor_conflict is ADVISORY: a traveller may legitimately pass behind
// scenery, so it is a warning. low_clearance and text_intersect are errors.
//
// A finding carrying `advisory` is demoted for the same reason. Anything a
// TRAVELLER is involved in is advisory: a wipe or sweep crosses everything on
// its path by design, and T14 already accepts that a traveller "may legitimately
// pass behind scenery". Left as errors, one full-frame `#sweep` produced ~20 of
// the 68 findings on an approved film — reporting the transition as a defect
// every time it did its job.
//
// Accepts a finding object, or a bare code string for callers that only have one.
export const severityOf = (f) => {
  const code = typeof f === 'string' ? f : f?.code;
  if (typeof f === 'object' && f?.advisory) return 'warning';
  return code === 'corridor_conflict' ? 'warning' : 'error';
};

// ---- the driver -------------------------------------------------------------

// Reads the composition's own duration so a fixture needs no separate config.
async function compositionDuration(browser) {
  const d = await browser.eval(`(() => {
    const r = document.getElementById('root');
    const a = r && r.getAttribute('data-duration');
    return a ? Number(a) : null;
  })()`);
  return Number.isFinite(d) && d > 0 ? d : null;
}

/**
 * Measure a composition at each time and report clearance findings.
 * `times` may be omitted, in which case DEFAULT_PHASES of the composition's own
 * duration are used.
 */
export async function runClearance(filmDir, { times, browser: given } = {}) {
  const html = path.join(filmDir, 'index.html');
  if (!fs.existsSync(html)) throw new Error(`missing ${html}`);

  const allowed = readAllowedPairs(filmDir);
  const browser = given ?? await launch();
  try {
    await browser.goto(html);
    let ts = times;
    if (!ts || !ts.length) {
      const dur = await compositionDuration(browser);
      ts = dur ? DEFAULT_PHASES.map((p) => Number((dur * p).toFixed(2))) : [0];
    }

    const perSample = [], perFrame = [];
    for (const t of ts) {
      await browser.eval(SEEK_JS(t));
      const boxes = await browser.eval(MEASURE_JS);
      perSample.push(boxes);
      for (const f of frameFindings(boxes, allowed)) perFrame.push({ ...f, t });
    }

    // Motion is only knowable ACROSS samples, so demotion happens after the
    // whole sweep is measured rather than per frame.
    const travelling = travellerSels(perSample);
    const findings = perFrame.map((f) => (
      travelling.has(f.a) || travelling.has(f.b)
        ? { ...f, advisory: true, moving: travelling.has(f.a) ? f.a : f.b }
        : f
    ));

    // Sweep is cross-sample by nature, so it carries the whole span, not one t.
    for (const f of sweepFindings(perSample)) findings.push({ ...f, t: null });

    const errorCount = findings.filter((f) => severityOf(f) === 'error').length;
    const warningCount = findings.length - errorCount;
    return {
      ok: errorCount === 0, errorCount, warningCount, findings,
      samples: ts, threshold: MIN_CLEARANCE_PX,
    };
  } finally {
    if (!given) await browser.close();
  }
}

export const formatFinding = (f) =>
  `${f.code} ${f.a} <-> ${f.b} gap=${f.gap}px${f.t == null ? '' : ` @ ${f.t}s`}`;

// ---- CLI --------------------------------------------------------------------

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  const argOf = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : null;
  };
  const dir = argOf('--fixture') ?? argOf('--film');
  const dump = argOf('--dump');

  if (!dir) {
    console.error('usage: node lib/intro-film/check-clearance.mjs --fixture <dir> [--dump <t>]');
    process.exit(1);
  }

  try {
    if (dump != null) {
      // Inspection aid: print every measured box at one instant.
      const browser = await launch();
      try {
        await browser.goto(path.join(dir, 'index.html'));
        await browser.eval(SEEK_JS(Number(dump)));
        console.log(JSON.stringify(await browser.eval(MEASURE_JS), null, 2));
      } finally { await browser.close(); }
      process.exit(0);
    }

    const r = await runClearance(dir);
    for (const f of r.findings) {
      console.error(`${severityOf(f).toUpperCase()} ${formatFinding(f)}`);
    }
    if (r.ok && !r.findings.length) console.log(`clearance ok — 0 findings`);
    else console.log(`clearance: ${r.errorCount} error(s), ${r.warningCount} warning(s) over ${r.samples.length} sample(s)`);
    process.exit(r.errorCount ? 1 : 0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
