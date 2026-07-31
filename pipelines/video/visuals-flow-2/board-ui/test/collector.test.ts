import { expect, test, describe } from 'vitest';
import { collectCues, collectSpans, buildSavePayload, TileModel } from '../src/lib/collector';
import { spliceShotBlocks } from '../src/lib/splice';

describe('collector', () => {
  test('collectCues happy path with omission rules', () => {
    const tiles: TileModel[] = [
      {
        id: 'c1',
        card: 'CardA',
        lead: 0.5,
        fragJson: JSON.stringify({ anchor: 'hello', hold: 2, variables: {}, beats: [] }),
        flagged: false,
        note: 'this is a note'
      },
      {
        id: 'c2',
        card: 'CardB',
        lead: '',
        fragJson: JSON.stringify({ anchor: 'world' }),
        flagged: true,
        note: ''
      }
    ];

    const res = collectCues(tiles);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.cues).toEqual([
        {
          id: 'c1',
          card: 'CardA',
          anchor: 'hello',
          hold: 2,
          variables: {},
          beats: [],
          flagged: false,
          lead: 0.5,
          note: 'this is a note'
        },
        {
          id: 'c2',
          card: 'CardB',
          anchor: 'world',
          hold: undefined,
          variables: undefined,
          beats: undefined,
          flagged: true
        }
      ]);
    }
  });

  test('collectCues broken JSON', () => {
    const tiles: TileModel[] = [
      {
        id: 'c3',
        card: 'CardC',
        lead: '',
        fragJson: '{ invalid json',
        flagged: false,
        note: ''
      }
    ];

    const res = collectCues(tiles);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.broken.length).toBe(1);
      expect(res.broken[0]).toMatch(/^c3: /);
    }
  });

  test('collectSpans', () => {
    const res1 = collectSpans([{ id: 's1', fragJson: '{"start": 10}' }]);
    expect(res1).toEqual({ ok: true, spans: [{ start: 10 }] });

    const res2 = collectSpans([{ id: 's2', fragJson: '{ broken' }]);
    expect(res2.ok).toBe(false);
    if (!res2.ok) {
      expect(res2.broken.length).toBe(1);
      expect(res2.broken[0]).toMatch(/^s2: /);
    }
  });

  test('buildSavePayload conditional fields', () => {
    const p1 = buildSavePayload({
      video: 'vid',
      approved: false,
      cues: [],
      feedback: {}
    });
    expect(p1).toEqual({ video: 'vid', approved: false, cues: [], feedback: {} });
    expect('spans' in p1).toBe(false);
    expect('effects' in p1).toBe(false);
    expect('feedbackImages' in p1).toBe(false);

    const p2 = buildSavePayload({
      video: 'vid',
      approved: true,
      cues: [],
      feedback: {},
      spans: [{ id: 's1' }],
      effects: [{ id: 'e1', enabled: true }],
      feedbackImages: { 'ref1': 'data:image/png' }
    });
    expect(p2).toEqual({
      video: 'vid',
      approved: true,
      cues: [],
      feedback: {},
      spans: [{ id: 's1' }],
      effects: [{ id: 'e1', enabled: true }],
      feedbackImages: { 'ref1': 'data:image/png' }
    });
  });

  test('spliceShotBlocks', () => {
    const blocks = [{ start: 2, isShot: false }, { start: 5, isShot: false }];
    const spans = [{ id: 's1', start: 3, origSpan: { mode: 'panel' } }];
    const spliced = spliceShotBlocks(blocks, spans);
    expect(spliced.length).toBe(3);
    expect(spliced[0].start).toBe(2);
    expect(spliced[1].isShot).toBe(true);
    expect(spliced[1].start).toBe(3);
    expect(spliced[2].start).toBe(5);
  });
});

// ---- store-owned edit models (timeline-mode data-loss regression) ----------
// Save must send one model PER SOURCE CUE regardless of what is mounted or
// edited: the server replaces cues.json's list wholesale, so a partial list
// destroys the cues it omits (found 2026-07-31: timeline mode with one docked
// tile saved a single cue).
import { defaultFrag, buildTileModels, buildSpanModels } from '../src/lib/collector';

describe('buildTileModels', () => {
  const cues = [
    { id: 'c01', card: 'a/b', anchor: 'first words', hold: 2, variables: { t: 'x' }, beats: [{ at: 1 }], flagged: false },
    { id: 'c02', card: 'c/d', anchor: 'second words', lead: 0.5, note: 'why' },
    { id: 'c03', card: 'e/f', anchor: 'third words', flagged: true },
  ];

  test('returns one model per cue with zero edits — edits overlay, never filter', () => {
    const models = buildTileModels(cues, {});
    expect(models.map(m => m.id)).toEqual(['c01', 'c02', 'c03']);
    expect(models[1].lead).toBe(0.5);
    expect(models[1].note).toBe('why');
    expect(models[2].flagged).toBe(true);
  });

  test('an unedited cue round-trips through collectCues without change', () => {
    const models = buildTileModels(cues, {});
    const res = collectCues(models);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.cues[0]).toEqual({
        id: 'c01', card: 'a/b', anchor: 'first words', hold: 2,
        variables: { t: 'x' }, beats: [{ at: 1 }], flagged: false,
      });
      expect(res.cues[1].lead).toBe(0.5);
      expect(res.cues[1].note).toBe('why');
    }
  });

  test('edits overlay only their cue; the rest still come from the source list', () => {
    const models = buildTileModels(cues, {
      c02: { fragJson: defaultFrag({ ...cues[1], anchor: 'EDITED' }), flagged: true },
    });
    expect(models).toHaveLength(3);
    expect(JSON.parse(models[1].fragJson).anchor).toBe('EDITED');
    expect(models[1].flagged).toBe(true);
    expect(JSON.parse(models[0].fragJson).anchor).toBe('first words');
  });
});

describe('buildSpanModels', () => {
  test('one model per file span, edited or not', () => {
    const spans = [{ id: 's1', start: 1 }, { id: 's2', start: 9 }];
    const models = buildSpanModels(spans, { s2: '{"id":"s2","start":10}' });
    expect(models.map(m => m.id)).toEqual(['s1', 's2']);
    expect(JSON.parse(models[0].fragJson)).toEqual({ id: 's1', start: 1 });
    expect(JSON.parse(models[1].fragJson).start).toBe(10);
  });
});
