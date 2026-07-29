// Tests for the zone quality bar (W15/W16/W17/W19) and the W18 stillness
// helpers. Each case is built from the test-03 measurements that motivated the
// rule, so a future edit that weakens one fails against the real defect rather
// than against an invented fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import { lintCues } from './lint-cues.mjs';
import { ZONE_CONSTANTS } from './zone-constants.mjs';
import { mergeIntervals, subtractIntervals, parseFreezeLog, stillRuns, checkZoneStillness } from './stillness.mjs';
import { appendZoneFeedback } from './zone-plan.mjs';

const INTRO_END = 117.6; // test-03's measured intro

function words(total = 300) {
  const out = [];
  for (let t = 0; t < total; t += 0.5) out.push({ text: 'w', start: t, end: t + 0.5 });
  return out;
}

// Minimal catalog: every card the cases below reference.
const catalog = {
  cards: [
    { slug: 'enacted/promise-split', placement: 'fullframe', default_duration: 6, variants: ['a'] },
    { slug: 'enacted/bad-clip-montage', placement: 'fullframe', default_duration: 6, variants: ['a'] },
    { slug: 'title/title-versus', placement: 'fullframe', default_duration: 6, variants: ['a'] },
    { slug: 'statement/keyword-statement', placement: 'fullframe', default_duration: 6, variants: ['a'] },
  ],
};

const structure = [
  { part: 'intro', start: 0, end: INTRO_END },
  { part: 'body', start: INTRO_END, end: 280 },
  { part: 'conclusion', start: 280, end: 300 },
];

// Builds the lint inputs directly — resolve.mjs is exercised by its own tests,
// and going through it here would make these cases depend on anchor matching.
function lint(resolved, { rawCues = null } = {}) {
  const cues = rawCues ?? resolved.map((r) => ({ id: r.id, card: r.card, anchor: 'w', zone: r.zone }));
  return lintCues({
    cuesFile: { video: 't', cues },
    resolved,
    words: words(),
    catalog,
    segmentsData: { segments: [], structure, confirmed: true },
    manifest: { base: 'screen' },
    conceptData: null,
  });
}

const cue = (id, start, card, extra = {}) => ({
  id, start, duration: 6, card, placement: 'fullframe', variables: { variant: 'a' }, ...extra,
});

test('W15 zone-gap fires on the 45.7s hole that passed the body limit', () => {
  // test-03's real intro shape: c03 at 39.6 -> c06 at 85.2.
  const resolved = [
    cue('z1', 0.6, 'enacted/promise-split'),
    cue('z2', 15.3, 'enacted/bad-clip-montage'),
    cue('z3', 39.6, 'statement/keyword-statement'),
    cue('z4', 85.2, 'title/title-versus'),
  ];
  const { warnings } = lint(resolved);
  const w15 = warnings.filter((w) => w.startsWith('W15'));
  // Both intro gaps break the zone cap: 24.3s (z2->z3) and 45.6s (z3->z4).
  // Only the second one broke the body's 45s limit, which is the whole point.
  assert.equal(w15.length, 2, warnings.join('\n'));
  assert.ok(w15.some((w) => /45\.6s/.test(w)), w15.join('\n'));
  assert.ok(w15.some((w) => /24\.3s/.test(w)), w15.join('\n'));
  assert.ok(ZONE_CONSTANTS.ZONE_GAP_FULLFRAME_MAX.value < 45);
});

test('W15 zone-gap measures from the zone opening, not just card to card', () => {
  const resolved = [
    cue('z1', 30, 'enacted/promise-split'),
    cue('z2', 45, 'enacted/bad-clip-montage'),
  ];
  const { warnings } = lint(resolved);
  const w15 = warnings.filter((w) => w.startsWith('W15'));
  assert.equal(w15.length, 1, warnings.join('\n'));
  assert.match(w15[0], /before its first fullframe/);
});

test('W16 zone-motion fires on test-03s 1-enacted-of-4 intro', () => {
  const resolved = [
    cue('z1', 0.6, 'enacted/promise-split'),
    cue('z2', 15, 'title/title-versus'),
    cue('z3', 30, 'statement/keyword-statement'),
    cue('z4', 45, 'title/title-versus'),
  ];
  const { warnings } = lint(resolved);
  const w16 = warnings.filter((w) => w.startsWith('W16'));
  assert.equal(w16.length, 1, warnings.join('\n'));
  assert.match(w16[0], /1 enacted card\(s\) of 4/);
});

test('W16 zone-motion needs 2 enacted even when the fraction is satisfied', () => {
  // 1 of 2 clears the 50% fraction but not the floor of 2.
  const resolved = [
    cue('z1', 5, 'enacted/promise-split'),
    cue('z2', 20, 'title/title-versus'),
  ];
  const { warnings } = lint(resolved);
  assert.equal(warnings.filter((w) => w.startsWith('W16')).length, 1, warnings.join('\n'));
});

test('W16 zone-motion is silent when half are enacted and there are at least 2', () => {
  const resolved = [
    cue('z1', 5, 'enacted/promise-split'),
    cue('z2', 20, 'enacted/bad-clip-montage'),
    cue('z3', 35, 'title/title-versus'),
    cue('z4', 50, 'statement/keyword-statement'),
  ];
  const { warnings } = lint(resolved);
  assert.deepEqual(warnings.filter((w) => w.startsWith('W16')), []);
});

test('W17 zone-rate does NOT fire on test-03s intro, which was already dense', () => {
  // 7 cues over 117.6s = 3.57/min. The whole point: density was never the
  // defect, so the rate floor must not flag the very intro that was rejected.
  const resolved = [0.6, 15.3, 39.6, 53.6, 72.3, 85.2, 109.9].map((t, i) =>
    cue(`z${i + 1}`, t, i % 2 ? 'enacted/promise-split' : 'enacted/bad-clip-montage'));
  const { warnings } = lint(resolved);
  assert.deepEqual(warnings.filter((w) => w.startsWith('W17')), [], warnings.join('\n'));
});

test('W17 zone-rate fires on a genuinely thin zone', () => {
  const resolved = [
    cue('z1', 5, 'enacted/promise-split'),
    cue('z2', 20, 'enacted/bad-clip-montage'),
  ];
  const { warnings } = lint(resolved);
  const w17 = warnings.filter((w) => w.startsWith('W17'));
  assert.equal(w17.length, 1, warnings.join('\n'));
  assert.match(w17[0], /1\.02\/min|min 3\.0/);
});

test('W19 zone-authorship catches a body cue that wandered into the intro', () => {
  const resolved = [cue('c1', 40, 'enacted/promise-split')];
  const { warnings } = lint(resolved, { rawCues: [{ id: 'c1', card: 'enacted/promise-split', anchor: 'w' }] });
  const w19 = warnings.filter((w) => w.startsWith('W19'));
  assert.equal(w19.length, 1, warnings.join('\n'));
  assert.match(w19[0], /carries no zone field but anchors inside the intro/);
});

test('W19 zone-authorship catches a zone cue whose anchor landed in the body', () => {
  const resolved = [cue('z1', 200, 'enacted/promise-split')];
  const { warnings } = lint(resolved, {
    rawCues: [{ id: 'z1', card: 'enacted/promise-split', anchor: 'w', zone: 'intro' }],
  });
  const w19 = warnings.filter((w) => w.startsWith('W19'));
  assert.equal(w19.length, 1, warnings.join('\n'));
  assert.match(w19[0], /declares zone "intro" but its anchor resolves to body/);
});

test('W19 stays silent for a correctly tagged zone cue and an untagged body cue', () => {
  const resolved = [cue('z1', 40, 'enacted/promise-split'), cue('c1', 200, 'enacted/bad-clip-montage')];
  const { warnings } = lint(resolved, {
    rawCues: [
      { id: 'z1', card: 'enacted/promise-split', anchor: 'w', zone: 'intro' },
      { id: 'c1', card: 'enacted/bad-clip-montage', anchor: 'w' },
    ],
  });
  assert.deepEqual(warnings.filter((w) => w.startsWith('W19')), []);
});

test('zone lints never fire on a workdir with no measured structure', () => {
  const res = lintCues({
    cuesFile: { video: 't', cues: [{ id: 'c1', card: 'title/title-versus', anchor: 'w' }] },
    resolved: [cue('c1', 40, 'title/title-versus')],
    words: words(),
    catalog,
    segmentsData: { segments: [], confirmed: true },
    manifest: { base: 'screen' },
    conceptData: null,
  });
  assert.deepEqual(res.warnings.filter((w) => /^W1[5-9]/.test(w)), []);
});

// ---- W18 stillness helpers ----

test('subtractIntervals removes card and avatar coverage from a zone', () => {
  assert.deepEqual(subtractIntervals(0, 100, [[10, 20], [50, 60]]), [[0, 10], [20, 50], [60, 100]]);
});

test('mergeIntervals collapses an overlapping card and avatar span', () => {
  assert.deepEqual(mergeIntervals([[10, 30], [20, 40], [50, 55]]), [[10, 40], [50, 55]]);
});

test('parseFreezeLog reads ffmpeg freezedetect output and closes an open freeze', () => {
  const log = [
    '[freezedetect @ 0x1] lavfi.freezedetect.freeze_start: 12.5',
    '[freezedetect @ 0x1] lavfi.freezedetect.freeze_end: 33.0',
    '[freezedetect @ 0x1] lavfi.freezedetect.freeze_start: 80.0',
  ].join('\n');
  assert.deepEqual(parseFreezeLog(log, 100), [[12.5, 33.0], [80.0, 100]]);
});

test('W18 reports the 20s still run test-03 actually had', () => {
  const runs = stillRuns({ zoneStart: 0, zoneEnd: 117.6, freezes: [[45, 65]], covered: [] });
  assert.equal(runs.length, 1);
  assert.deepEqual(runs[0], [45, 65]);
});

test('W18 ignores a still stretch that a fullframe card is covering', () => {
  const runs = stillRuns({ zoneStart: 0, zoneEnd: 117.6, freezes: [[45, 65]], covered: [[40, 70]] });
  assert.deepEqual(runs, []);
});

test('W18 ignores a still stretch under an avatar span', () => {
  const runs = stillRuns({ zoneStart: 0, zoneEnd: 100, freezes: [[10, 40]], covered: [[5, 45]] });
  assert.deepEqual(runs, []);
});

test('W18 reports only the uncovered remainder of a partially covered freeze', () => {
  // Freeze 10-40; a card covers 10-25. The exposed 25-40 is 15s > 8s cap.
  const runs = stillRuns({ zoneStart: 0, zoneEnd: 100, freezes: [[10, 40]], covered: [[10, 25]] });
  assert.equal(runs.length, 1);
  assert.deepEqual(runs[0], [25, 40]);
});

test('checkZoneStillness reports not-applicable when there is no footage', () => {
  const { checked, warnings } = checkZoneStillness({
    workdir: '/nope', structure, resolved: [], footage: null,
  });
  assert.equal(checked, false);
  assert.deepEqual(warnings, []);
});

// ---- 070 gate feedback ----

test('appendZoneFeedback tags the zone and numbers keys per zone', () => {
  let fb = appendZoneFeedback({}, 'intro', { text: 'promise card is weak', cue: 'z1', card: 'title/title-versus' });
  fb = appendZoneFeedback(fb, 'intro', { text: 'second note' });
  fb = appendZoneFeedback(fb, 'conclusion', { text: 'needs the CTA earlier' });
  assert.deepEqual(Object.keys(fb.items).sort(), ['zone-conclusion:1', 'zone-intro:1', 'zone-intro:2']);
  assert.equal(fb.items['zone-intro:1'].zone, 'intro');
  assert.equal(fb.items['zone-intro:1'].context.cue, 'z1');
  // A zone-level note carries no cue context — it is about the whole zone.
  assert.equal(fb.items['zone-intro:2'].context, undefined);
});

test('appendZoneFeedback never collides with storyboard or final-cut keys', () => {
  const fb = appendZoneFeedback({ items: { c05: { text: 'x' }, 'final-v1:1': { text: 'y' } } }, 'intro', { text: 'z' });
  assert.ok(fb.items.c05, 'storyboard item survived');
  assert.ok(fb.items['final-v1:1'], 'final-cut item survived');
  assert.ok(fb.items['zone-intro:1'], 'zone item added');
});
