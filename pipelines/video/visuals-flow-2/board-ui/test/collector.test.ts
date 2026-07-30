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
