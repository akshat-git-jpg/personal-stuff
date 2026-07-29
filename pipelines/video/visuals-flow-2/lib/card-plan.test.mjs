import test from 'node:test';
import assert from 'node:assert';
import {
  buildCardPlan,
  partOf,
  appendCardPlanFeedback,
  feedbackKeyPrefix,
  summarize,
  renderOutline,
} from './card-plan.mjs';

const structure = [
  { part: 'intro', start: 0, end: 10 },
  { part: 'body', start: 10, end: 200 },
  { part: 'conclusion', start: 200, end: 310 },
];

test('card-plan builder logic', async (t) => {
  await t.test('sections cues by their declared zone, body by default', () => {
    const cues = [
      { id: 'c01', card: 'foo', zone: 'intro', anchor: 'welcome back' },
      { id: 'c02', card: 'bar', anchor: 'first up' },
      { id: 'c03', card: 'baz', zone: 'conclusion', anchor: 'so that is it' },
    ];
    const sections = buildCardPlan({ structure, cues, catalogCards: [{ slug: 'foo' }, { slug: 'bar' }, { slug: 'baz' }] });

    assert.deepStrictEqual(sections.map((s) => s.part), ['intro', 'body', 'conclusion']);
    assert.strictEqual(sections[0].items[0].id, 'c01');
    assert.strictEqual(sections[1].items[0].id, 'c02');
    assert.strictEqual(sections[2].items[0].id, 'c03');
    // spans come from `structure` when it is present
    assert.strictEqual(sections[0].start, 0);
    assert.strictEqual(sections[2].end, 310);
  });

  await t.test('a card missing from the catalog is reported NEW', () => {
    // This is the case the old zone plan could never see. resolve.mjs refuses
    // unknown cards and writes no resolved.json, so a plan built from
    // resolved.json could only ever show cards that already existed.
    const cues = [
      { id: 'c01', card: 'foo' },
      { id: 'c02', card: 'race/cost-race', propose: { does: 'bars race as cost climbs', kind: 'beat', beats: 3 } },
    ];
    const sections = buildCardPlan({ structure, cues, catalogCards: [{ slug: 'foo' }] });
    const body = sections.find((s) => s.part === 'body');

    assert.strictEqual(body.items[0].status, 'existing');
    assert.strictEqual(body.items[1].status, 'new');
    assert.strictEqual(body.items[1].proposal.does, 'bars race as cost climbs');
    assert.strictEqual(body.items[1].proposal.beats, 3);
    assert.deepStrictEqual(summarize(sections), { cues: 2, existing: 1, toBuild: 1, flagged: 0 });
  });

  await t.test('a legacy one-line `fix` note still reads as a proposal', () => {
    const sections = buildCardPlan({
      structure,
      cues: [{ id: 'c01', card: 'nope', fix: 'needs a bar race' }],
      catalogCards: [],
    });
    assert.deepStrictEqual(sections[0].items[0].proposal, { does: 'needs a bar race' });
  });

  await t.test('works with no structure at all (body-only video)', () => {
    const sections = buildCardPlan({
      structure: null,
      cues: [{ id: 'c01', card: 'foo' }],
      catalogCards: [{ slug: 'foo' }],
    });
    assert.strictEqual(sections.length, 1);
    assert.strictEqual(sections[0].part, 'body');
    assert.strictEqual(sections[0].start, undefined);
  });

  await t.test('empty sections are dropped', () => {
    const sections = buildCardPlan({
      structure,
      cues: [{ id: 'c01', card: 'foo', zone: 'intro' }],
      catalogCards: [{ slug: 'foo' }],
    });
    assert.deepStrictEqual(sections.map((s) => s.part), ['intro']);
  });

  await t.test('an unrecognised zone value falls back to body', () => {
    assert.strictEqual(partOf({ zone: 'outro' }), 'body');
    assert.strictEqual(partOf({}), 'body');
    assert.strictEqual(partOf({ zone: 'intro' }), 'intro');
  });

  await t.test('an identical rebuild does not invalidate approval', () => {
    const cues = [{ id: 'c01', card: 'foo', zone: 'intro' }];
    const a = buildCardPlan({ structure, cues, catalogCards: [{ slug: 'foo' }] });
    const b = buildCardPlan({ structure, cues, catalogCards: [{ slug: 'foo' }] });
    assert.strictEqual(JSON.stringify(a) === JSON.stringify(b), true);
  });

  await t.test('adding a cue invalidates approval', () => {
    const before = buildCardPlan({ structure, cues: [{ id: 'c01', card: 'foo' }], catalogCards: [{ slug: 'foo' }] });
    const after = buildCardPlan({
      structure,
      cues: [{ id: 'c01', card: 'foo' }, { id: 'c02', card: 'foo' }],
      catalogCards: [{ slug: 'foo' }],
    });
    assert.strictEqual(JSON.stringify(before) !== JSON.stringify(after), true);
  });

  await t.test('building the proposed card invalidates approval', () => {
    // status flips new -> existing once 038 lands the card, so the owner is
    // asked again rather than the plan silently going stale.
    const cues = [{ id: 'c01', card: 'race/cost-race' }];
    const before = buildCardPlan({ structure, cues, catalogCards: [] });
    const after = buildCardPlan({ structure, cues, catalogCards: [{ slug: 'race/cost-race' }] });
    assert.strictEqual(JSON.stringify(before) !== JSON.stringify(after), true);
  });
});

test('card-plan feedback capture', async (t) => {
  await t.test('routes zone items and body items to different key spaces', () => {
    // The key is what 130 routes on: zone lessons must never edit the body
    // rulebook, and the reverse (owner 2026-07-29).
    assert.strictEqual(feedbackKeyPrefix('intro'), 'zone-intro:');
    assert.strictEqual(feedbackKeyPrefix('conclusion'), 'zone-conclusion:');
    assert.strictEqual(feedbackKeyPrefix('body'), 'card-body:');
  });

  await t.test('appends with an incrementing key and snapshots cue context', () => {
    let fb = { items: {} };
    fb = appendCardPlanFeedback(fb, 'intro', { text: 'too many text slates', cue: 'c01', card: 'slate/stat-hit' });
    fb = appendCardPlanFeedback(fb, 'intro', { text: 'open on motion' });
    fb = appendCardPlanFeedback(fb, 'body', { text: 'wrong card for this clause', cue: 'c09', card: 'foo' });

    assert.deepStrictEqual(Object.keys(fb.items), ['zone-intro:1', 'zone-intro:2', 'card-body:1']);
    assert.strictEqual(fb.items['zone-intro:1'].zone, 'intro');
    assert.deepStrictEqual(fb.items['zone-intro:1'].context, { cue: 'c01', card: 'slate/stat-hit' });
    assert.strictEqual(fb.items['zone-intro:2'].context, undefined);
    assert.strictEqual(fb.items['card-body:1'].part, 'body');
    assert.strictEqual(fb.items['card-body:1'].zone, undefined);
  });

  await t.test('does not collide with storyboard or final-cut keys', () => {
    let fb = { items: { c01: { text: 'existing storyboard item' }, 'final-3': { text: 'final cut item' } } };
    fb = appendCardPlanFeedback(fb, 'body', { text: 'new' });
    assert.strictEqual(Object.keys(fb.items).length, 3);
    assert.ok(fb.items['card-body:1']);
    assert.ok(fb.items.c01);
    assert.ok(fb.items['final-3']);
  });

  await t.test('rejects an unknown part', () => {
    assert.throws(() => appendCardPlanFeedback({}, 'outro', { text: 'x' }), /unknown plan part/);
  });
});

test('card-plan outline', async (t) => {
  await t.test('marks NEW cards and shows the anchor and spec', () => {
    const sections = buildCardPlan({
      structure,
      cues: [
        { id: 'c01', card: 'foo', zone: 'intro', anchor: 'welcome back', placement: 'fullframe' },
        { id: 'c02', card: 'race/cost-race', anchor: 'it adds up', placement: 'fullframe', propose: { does: 'bars race as cost climbs' } },
      ],
      catalogCards: [{ slug: 'foo' }],
    });
    const out = renderOutline(sections);

    assert.match(out, /INTRO {2}0:00–0:10/);
    assert.match(out, /NEW c02/);
    assert.match(out, /@ "it adds up"/);
    assert.match(out, /→ bars race as cost climbs/);
    // an existing card is not marked NEW
    assert.doesNotMatch(out, /NEW c01/);
  });
});
