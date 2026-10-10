import test from 'node:test';
import assert from 'node:assert/strict';
import { textCutOff, crowding, finishedFrames, emptyBand, coversBusy, settledTimes, weakestMoment, unfinishedText } from './frame-checks.mjs';
import { probeTimes } from './review-frames.mjs';

const canvas = { w: 1920, h: 1080 };
const B = (x0, y0, x1, y1) => ({ x0, y0, x1, y1 });
const T = (sel, box, extra = {}) => ({ sel, text: sel, box, font: 48, op: 1, mid: [], ...extra });
const G = (sel, box, extra = {}) => ({ sel, tag: 'div', box, op: 1, ...extra });
const at = (t, texts = [], graphics = []) => ({ t, texts, graphics });
const run = (from, to, f) => { const s = []; for (let t = from; t <= to + 1e-9; t += 0.25) s.push(f(+t.toFixed(2))); return s; };

test('text cut off by the frame comes from the hyperframes report, once per string', () => {
  const report = { layout: { findings: [{ code: 'canvas_overflow', selector: '#a', text: 'Hello', time: 1 }, { code: 'canvas_overflow', selector: '#a', text: 'Hello', time: 2 }, { code: 'content_overlap', selector: '#b' }] } };
  const f = textCutOff(report);
  assert.equal(f.length, 1);
  assert.match(f[0].message, /"Hello" is cut off by the frame edge/);
});

test('peer icons piled on each other for long enough are crowding; a passing transient and a line through them are not', () => {
  const held = run(0, 2, (t) => at(t, [], [G('#chip1', B(100, 100, 190, 190)), G('#hop', B(130, 120, 240, 230)), G('#thread', B(0, 150, 1000, 154))]));
  const f = crowding(held, canvas);
  assert.equal(f.length, 1);
  assert.match(f[0].message, /#chip1 and #hop pile on each other/);
  const blip = run(0, 0.25, (t) => at(t, [], [G('#a', B(100, 100, 190, 190)), G('#b', B(130, 120, 220, 210))]));
  assert.deepEqual(crowding(blip, canvas), []);
  const badge = run(0, 2, (t) => at(t, [], [G('#logo', B(100, 100, 300, 300)), G('#badge', B(260, 90, 320, 150))]));
  assert.deepEqual(crowding(badge, canvas), []);
});

test('a graphic wedged beside hero type is flagged; one attached to it is a lockup', () => {
  const hero = T('#h', B(180, 80, 1080, 260), { font: 150, text: 'One platform' });
  const wedged = crowding(run(0, 1, (t) => at(t, [hero], [G('#chip', B(1290, 110, 1380, 200))])), canvas);
  assert.match(wedged[0].message, /#chip is wedged 210px beside the heading "One platform"/);
  const lockup = crowding(run(0, 1, (t) => at(t, [hero], [G('#tag', B(1100, 100, 1300, 260))])), canvas);
  assert.deepEqual(lockup, []);
});

test('a graphic colliding with text is crowding; a panel behind the text is not', () => {
  const s = run(0, 1, (t) => at(t, [T('#label', B(100, 100, 400, 150))], [G('#icon', B(350, 90, 450, 190)), G('#panel', B(50, 50, 600, 400))]));
  const f = crowding(s, canvas);
  assert.equal(f.length, 1);
  assert.match(f[0].message, /#icon collides with the text/);
});

test('half-revealed text on the first or last frame fails; a scale pulse does not', () => {
  const first = at(0, [T('#a', B(0, 0, 10, 10), { op: 0 })], [G('#bg2', B(0, 0, 100, 100))]);
  const last = at(4.7, [T('#w1', B(0, 0, 10, 10), { op: 0.73, mid: ['opacity'] }), T('#q', B(0, 0, 10, 10), { mid: ['scale'] })]);
  const f = finishedFrames(first, last, { canvas });
  assert.equal(f.length, 1);
  assert.match(f[0].message, /"#w1" is half-revealed on the last frame \(mid-opacity/);
  assert.equal(unfinishedText(last).length, 1);
  const empty = finishedFrames(at(0), at(4), { kind: 'takeover', canvas });
  assert.match(empty[0].message, /empty stage/);
  assert.deepEqual(finishedFrames(at(0), at(4), { kind: 'overlay', canvas }), []);
});

test('a takeover that leaves the top of the frame empty is flagged with where the band is', () => {
  const s = run(0, 4, (t) => at(t, [T('#hero', B(170, 400, 960, 600))], [G('#scale', B(1080, 350, 1780, 790))]));
  const r = emptyBand(s, canvas, { duration: 4 });
  assert.equal(r.coverage, 0.41);
  assert.match(r.findings[0].message, /spans 41% of the height and leaves 32% empty at the top/);
  const full = run(0, 4, (t) => at(t, [T('#hero', B(170, 120, 960, 400))], [G('#grid', B(100, 420, 1800, 960))]));
  assert.deepEqual(emptyBand(full, canvas, { duration: 4 }).findings, []);
});

test('an overlay on the recording busy region fails; one beside it passes', () => {
  const busy = { cols: 4, rows: 2, cells: [{ col: 0, row: 0 }, { col: 1, row: 0 }], box: { x0: 0, y0: 0, x1: 0.5, y1: 0.5 } };
  const on = coversBusy([at(1, [], [G('#card', B(0, 0, 900, 500))])], canvas, busy);
  assert.equal(on.findings[0].severity, 'error');
  assert.match(on.findings[0].message, /covers \d+% of where the recording moves \(x 0%-50%, y 0%-50%/);
  assert.deepEqual(coversBusy([at(1, [], [G('#card', B(1000, 600, 1900, 1000))])], canvas, busy).findings, []);
  assert.deepEqual(coversBusy([], canvas, null).findings, []);
});

test('stills move to the nearest instant with nothing half-revealed', () => {
  const s = [at(0), at(0.25, [T('#a', B(0, 0, 1, 1), { mid: ['opacity'] })]), at(0.5)];
  assert.deepEqual(settledTimes(s, [0.3]), [{ t: 0.5, settled: true, wanted: 0.3 }]);
});

test('the weakest moment weighs errors over warnings and counts dead seconds', () => {
  const w = weakestMoment({ m01: { errors: [], warnings: ['a', 'b'] }, m02: { errors: ['x'], warnings: [] }, m03: { errors: [], warnings: [], deadSeconds: 9 } });
  assert.equal(w.id, 'm03');
  assert.equal(weakestMoment({ m01: { errors: [], warnings: [] } }), null);
  const shared = 'lint/google_fonts_import @0s: fonts';
  const w2 = weakestMoment({ m01: { errors: [], warnings: [shared, 'layout/x @1s: a', 'layout/x @2s: a'] }, m02: { errors: [], warnings: [shared, 'crowding: #a and #b pile on each other (1.00-2.00s)'] }, m03: { errors: [], warnings: [shared] } });
  assert.equal(w2.id, 'm02');
  assert.equal(w2.reason, 'crowding: #a and #b pile on each other (1.00-2.00s)');
  assert.equal(weakestMoment({ m01: { errors: [], warnings: [shared] }, m02: { errors: [], warnings: [shared] } }), null);
});

test('probe instants cover every quarter second and the exact last frame', () => {
  assert.deepEqual(probeTimes(1, 30), [0, 0.25, 0.5, 0.75, 0.967]);
});
