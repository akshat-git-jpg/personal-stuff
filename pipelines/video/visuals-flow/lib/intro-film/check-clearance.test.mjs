// Tests for the T13/T14 clearance gate.
//
// The geometry is pure and tested without a browser; ONE integration test drives
// the real Chrome over the committed clean fixture, because a gate proven only
// against hand-made boxes has never proven it can measure a page.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MIN_CLEARANCE_PX, separation, pairFinding, frameFindings, sweepFindings,
  severityOf, runClearance,
} from './check-clearance.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const box = (x, y, w, h, text = false, sel = `#b${x}-${y}`) => ({ sel, x, y, w, h, text });

// ---- 1. separation ---------------------------------------------------------

test('separation reports 8px on the y axis for boxes stacked in one column', () => {
  const a = box(100, 100, 200, 50);
  const b = box(100, 158, 200, 50);
  assert.deepEqual(separation(a, b), { dx: 0, dy: 8 });
});

test('separation is symmetric', () => {
  const a = box(100, 100, 200, 50);
  const b = box(100, 158, 200, 50);
  assert.deepEqual(separation(a, b), separation(b, a));
});

// ---- 2. low_clearance ------------------------------------------------------

test('pairFinding reports low_clearance with the real gap when one box has text', () => {
  const text = box(100, 100, 200, 50, true, '#sub');
  const dev = box(100, 158, 200, 50, false, '#device');
  const f = pairFinding(text, dev);
  assert.equal(f.code, 'low_clearance');
  assert.equal(f.gap, 8);
});

test('low_clearance needs text: two graphics 8px apart are not a finding', () => {
  // T13 is a rule about TEXT clearance. Two decorative bands close together are
  // a composition choice, not a defect.
  assert.equal(pairFinding(box(100, 100, 200, 50), box(100, 158, 200, 50)), null);
});

// ---- 3. threshold boundary -------------------------------------------------

test(`exactly MIN_CLEARANCE_PX (${MIN_CLEARANCE_PX}px) passes — the boundary is inclusive`, () => {
  const text = box(100, 100, 200, 50, true, '#sub');
  const dev = box(100, 150 + MIN_CLEARANCE_PX, 200, 50, false, '#device');
  assert.equal(separation(text, dev).dy, MIN_CLEARANCE_PX);
  assert.equal(pairFinding(text, dev), null);
});

test('one pixel under the threshold fails', () => {
  const text = box(100, 100, 200, 50, true, '#sub');
  const dev = box(100, 150 + MIN_CLEARANCE_PX - 1, 200, 50, false, '#device');
  assert.equal(pairFinding(text, dev).code, 'low_clearance');
});

// ---- 4. containment --------------------------------------------------------

test('containment is never a finding — a background enclosing its text', () => {
  const bg = box(0, 0, 1920, 1080, false, '#bg');
  const text = box(120, 300, 500, 52, true, '#sub');
  assert.equal(pairFinding(bg, text), null);
  assert.equal(pairFinding(text, bg), null, 'and symmetrically');
});

// ---- 5. diagonal neighbours ------------------------------------------------

test('diagonal neighbours are not a finding even when both gaps are small', () => {
  // Offset on BOTH axes: the eye does not read these as touching.
  const text = box(100, 100, 200, 50, true, '#sub');
  const dev = box(310, 158, 200, 50, false, '#device');
  const { dx, dy } = separation(text, dev);
  assert.ok(dx > 0 && dy > 0, 'fixture must actually be diagonal');
  assert.equal(pairFinding(text, dev), null);
});

// ---- 6. text_intersect, symmetric — the b11 regression ---------------------

test('text_intersect fires on partial intersection regardless of z-order', () => {
  // The b11 defect: a measuring rule drawn UNDER a subtitle, striking it
  // through. hyperframes' text_occluded only fires on text covered BY
  // something, so it passed. Both argument orders must report.
  const text = box(100, 300, 400, 52, true, '#sub');
  const rule = box(300, 330, 400, 20, false, '#rule');
  const { dx, dy } = separation(text, rule);
  assert.ok(dx === 0 && dy === 0, 'fixture must actually intersect');

  const forward = pairFinding(text, rule);
  const reverse = pairFinding(rule, text);
  assert.equal(forward.code, 'text_intersect');
  assert.equal(reverse.code, 'text_intersect', 'asymmetric implementation would miss the b11 case');
  assert.equal(forward.gap, 0);
  assert.equal(reverse.gap, 0);
});

test('two intersecting graphics with no text are not text_intersect', () => {
  assert.equal(pairFinding(box(100, 300, 400, 52), box(300, 330, 400, 20)), null);
});

// ---- text-block classification (the `textish` rule) ------------------------

test('two text blocks 28px apart are type rhythm, not a defect', () => {
  // Consecutive rows of one list. Holding these to the 40px device minimum
  // reported the film's own typography as broken — 24 of the 38 errors on
  // consistent-ai-influencer were this single shape restated.
  const rowA = { sel: '#s3', x: 100, y: 100, w: 400, h: 40, text: false, textish: true };
  const rowB = { sel: '#s4', x: 100, y: 168, w: 400, h: 40, text: false, textish: true };
  assert.equal(separation(rowA, rowB).dy, 28);
  assert.equal(pairFinding(rowA, rowB), null);
});

test('a text-block wrapper against a device IS still a finding', () => {
  // The wrapper carries no glyphs of its own, so keying on own-text alone would
  // miss this — a device 12px off a text block is exactly T13's shape.
  const block = { sel: '#s3', x: 100, y: 100, w: 400, h: 40, text: false, textish: true };
  const dev = { sel: '#sweep', x: 100, y: 152, w: 400, h: 40, text: false, textish: false };
  const f = pairFinding(block, dev);
  assert.equal(f.code, 'low_clearance');
  assert.equal(f.gap, 12);
});

test('two devices close together are not T13 business', () => {
  const a = { sel: '#d1', x: 100, y: 100, w: 200, h: 50, text: false, textish: false };
  const b = { sel: '#d2', x: 100, y: 158, w: 200, h: 50, text: false, textish: false };
  assert.equal(pairFinding(a, b), null);
});

test('boxes without a textish field fall back to own-text', () => {
  // Keeps the pure geometry usable from a caller that only knows about `text`.
  const text = box(100, 100, 200, 50, true, '#sub');
  const dev = box(100, 158, 200, 50, false, '#device');
  assert.equal(pairFinding(text, dev).code, 'low_clearance');
});

test('frameFindings walks every pair once', () => {
  const boxes = [
    box(0, 0, 1920, 1080, false, '#bg'),
    box(100, 100, 200, 50, true, '#sub'),
    box(100, 158, 200, 50, false, '#device'),
  ];
  const found = frameFindings(boxes);
  assert.equal(found.length, 1);
  assert.equal(found[0].code, 'low_clearance');
});

// ---- 7. sweep / corridor (T14) ---------------------------------------------

test('sweepFindings flags a static box sitting inside a travelling box union', () => {
  // #trav sweeps left-to-right across three samples; #device is parked in the
  // corridor it crosses. This is T14's exact shape.
  const perSample = [
    [{ sel: '#trav', x: 0, y: 500, w: 100, h: 100, text: false },
     { sel: '#device', x: 400, y: 520, w: 80, h: 60, text: false }],
    [{ sel: '#trav', x: 450, y: 500, w: 100, h: 100, text: false },
     { sel: '#device', x: 400, y: 520, w: 80, h: 60, text: false }],
    [{ sel: '#trav', x: 900, y: 500, w: 100, h: 100, text: false },
     { sel: '#device', x: 400, y: 520, w: 80, h: 60, text: false }],
  ];
  const out = sweepFindings(perSample);
  assert.equal(out.length, 1);
  assert.equal(out[0].code, 'corridor_conflict');
  assert.equal(out[0].a, '#trav');
  assert.equal(out[0].b, '#device');
});

test('a static enclosing the corridor is scenery, not a conflict', () => {
  // #bg encloses every traveller union. Reporting it would bury real findings.
  const perSample = [
    [{ sel: '#bg', x: 0, y: 0, w: 1920, h: 1080, text: false },
     { sel: '#trav', x: 0, y: 500, w: 100, h: 100, text: false }],
    [{ sel: '#bg', x: 0, y: 0, w: 1920, h: 1080, text: false },
     { sel: '#trav', x: 900, y: 500, w: 100, h: 100, text: false }],
  ];
  assert.deepEqual(sweepFindings(perSample), []);
});

test('distinct elements sharing a selector fabricate a traveller that does not exist', () => {
  // Regression for the selector scheme. The first version indexed within-parent
  // only, so every row of a list was named 'span.n[0]'. sweepFindings keys by
  // selector, so two DIFFERENT static elements collapsed into one key, their
  // union spanned the distance between them, and that union looked exactly like
  // one object sweeping the frame — a phantom traveller crossing real scenery.
  // Nothing here moves, so the correct answer is always "no conflict".
  const rows = (sel1, sel2) => ([
    [{ sel: sel1, x: 100, y: 100, w: 80, h: 40, text: true },
     { sel: sel2, x: 900, y: 100, w: 80, h: 40, text: true },
     { sel: '#device', x: 500, y: 105, w: 60, h: 30, text: false }],
    [{ sel: sel1, x: 100, y: 100, w: 80, h: 40, text: true },
     { sel: sel2, x: 900, y: 100, w: 80, h: 40, text: true },
     { sel: '#device', x: 500, y: 105, w: 60, h: 30, text: false }],
  ]);

  // Unique names: two parked labels and a parked device. No travellers at all.
  assert.deepEqual(sweepFindings(rows('#s1 > span.n[0]', '#s2 > span.n[0]')), []);

  // Collided names: the same immobile layout now reports a corridor conflict
  // against #device, purely as an artifact of the naming. This is the bug the
  // path-based selector removes — asserted here so a future "simplification"
  // back to within-parent indexing fails loudly instead of silently lying.
  const phantom = sweepFindings(rows('span.n[0]', 'span.n[0]'));
  assert.equal(phantom.length, 1);
  assert.equal(phantom[0].code, 'corridor_conflict');
  assert.equal(phantom[0].b, '#device');
});

test('a static clear of the corridor is not a conflict', () => {
  const perSample = [
    [{ sel: '#trav', x: 0, y: 500, w: 100, h: 100, text: false },
     { sel: '#device', x: 400, y: 900, w: 80, h: 60, text: false }],
    [{ sel: '#trav', x: 900, y: 500, w: 100, h: 100, text: false },
     { sel: '#device', x: 400, y: 900, w: 80, h: 60, text: false }],
  ];
  assert.deepEqual(sweepFindings(perSample), []);
});

test('corridor_conflict is advisory, the other two are errors', () => {
  assert.equal(severityOf('corridor_conflict'), 'warning');
  assert.equal(severityOf('low_clearance'), 'error');
  assert.equal(severityOf('text_intersect'), 'error');
});

// ---- 8. integration over the committed clean fixture -----------------------

// Teardown is registered BEFORE the assert, and force-closes. LESSONS
// 2026-07-31: a node:test file that opens a process and asserts before teardown
// hangs the runner forever with no output.
let browserForTeardown = null;
test.after(async () => {
  if (browserForTeardown) { try { await browserForTeardown.close(); } catch {} }
});

test('the committed clean fixture reports zero errors in a real browser', { timeout: 240000 }, async () => {
  const { launch } = await import('./cdp.mjs');
  browserForTeardown = await launch();
  const r = await runClearance(
    path.join(HERE, 'fixtures', 'clearance-clean'),
    { browser: browserForTeardown },
  );
  assert.equal(r.errorCount, 0, `expected a clean fixture, got: ${JSON.stringify(r.findings)}`);
  assert.equal(r.threshold, MIN_CLEARANCE_PX);
  assert.ok(r.samples.length >= 1, 'must actually sample something');
  assert.ok(r.ok);
});
