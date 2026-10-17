import { describe, expect, it } from 'vitest';
import { cardAt, clock, comments, groupLines, lineAt, partAt, pinNumbers, sayingAt, tickStep, zoomWindow } from './review';
import type { Word } from './api';

const words: Word[] = [
  [0, 0.4, 'Hello'], [0.4, 0.8, 'there.'], [1, 1.3, 'This'], [1.3, 1.6, 'is'], [1.6, 2, 'n8n.'],
  [5, 5.4, 'After'], [5.4, 5.8, 'a'], [5.8, 6.2, 'pause'],
];

describe('review helpers', () => {
  it('formats clocks', () => {
    expect(clock(2116.86)).toBe('35:16');
    expect(clock(2116.86, true)).toBe('35:16.86');
    expect(clock(5.5, true)).toBe('0:05.50');
  });

  it('groups words into lines on punctuation and pauses', () => {
    const lines = groupLines(words);
    expect(lines.map((l) => l.text)).toEqual(['Hello there.', 'This is n8n.', 'After a pause']);
    expect(lineAt(lines, 1.2)).toBe(1);
    expect(lineAt(lines, -1)).toBe(-1);
  });

  it('quotes what was said near a time', () => {
    expect(sayingAt(words, 1.5)).toBe('Hello there. This is n8n.');
    expect(sayingAt(words, 50)).toBe('');
  });

  it('finds the part and card at a time', () => {
    expect(partAt([{ name: 'Intro', start: 0 }, { name: 'n8n', start: 3 }], 4)).toBe(1);
    const cards = [{ id: 'c1', card: 'a', start: 10, duration: 4 }, { id: 'c2', card: 'b', start: 20, duration: 4 }];
    expect(cardAt(cards, 12)?.id).toBe('c1');
    expect(cardAt(cards, 18)?.id).toBe('c2');
    expect(cardAt(cards, 16.5)).toBeNull();
  });

  it('reads only final-cut comment keys, in time order', () => {
    const list = comments({ 'final-v2:1': { text: 'b', t: 9 }, 'final-v1:0': { text: 'a', t: 2 }, c05: { text: 'tile' }, _global: { text: 'n' } });
    expect(list.map((c) => c.key)).toEqual(['final-v1:0', 'final-v2:1']);
    expect(list[1].version).toBe('v2');
  });

  it('numbers pins within each version', () => {
    const list = comments({ 'final-v1:0': { text: 'a', t: 1 }, 'final-v2:0': { text: 'b', t: 2 }, 'final-v1:1': { text: 'c', t: 3 } });
    expect([...pinNumbers(list).entries()]).toEqual([['final-v1:0', 1], ['final-v2:0', 1], ['final-v1:1', 2]]);
  });

  it('zooms around a point and stays inside the video', () => {
    expect(zoomWindow([0, 100], 0.5, 50, 100)).toEqual([25, 75]);
    expect(zoomWindow([0, 100], 0.5, 0, 100)).toEqual([0, 50]);
    expect(zoomWindow([0, 100], 4, 50, 100)).toEqual([0, 100]);
    expect(tickStep(2169, 1200)).toBe(300);
  });
});
