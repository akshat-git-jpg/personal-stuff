import { describe, it, expect } from 'vitest';
import { validateImageFile, savePayloadFeedback, feedbackRounds } from '../src/lib/feedback';

describe('feedback lib', () => {
  it('validateImageFile', () => {
    expect(validateImageFile({ type: 'image/png', size: 100 })).toBeNull();
    expect(validateImageFile({ type: 'text/plain', size: 100 })).toBe('not an image');
    expect(validateImageFile({ type: 'image/jpeg', size: 7 * 1024 * 1024 })).toBe('image too large (max 6MB)');
  });

  it('savePayloadFeedback', () => {
    const state1 = { texts: { 'r1': 'foo' }, images: {}, dirty: false, version: 0 };
    expect(savePayloadFeedback(state1)).toEqual({ feedback: { 'r1': 'foo' } });

    const state2 = { texts: { 'r1': 'foo' }, images: { 'r1': 'data:image/png;base64,...', 'r2': null }, dirty: true, version: 3 };
    expect(savePayloadFeedback(state2)).toEqual({
      feedback: { 'r1': 'foo' },
      feedbackImages: { 'r1': 'data:image/png;base64,...', 'r2': null }
    });
  });
});

describe('feedbackRounds', () => {
  it('no item yet: box binds to the base key', () => {
    expect(feedbackRounds('c20', {})).toEqual({ folded: [], activeKey: 'c20' });
  });

  it('unfolded round 1: box keeps editing the base item', () => {
    const items = { c20: { text: 'wip' } };
    expect(feedbackRounds('c20', items)).toEqual({ folded: [], activeKey: 'c20' });
  });

  it('folded round 1: history shown, box binds to #2', () => {
    const items = { c20: { text: 'old', folded: '2026-07-31' } };
    const r = feedbackRounds('c20', items);
    expect(r.activeKey).toBe('c20#2');
    expect(r.folded.map((f) => f.key)).toEqual(['c20']);
  });

  it('two folded rounds: box binds to #3, both shown', () => {
    const items = {
      c20: { text: 'r1', folded: '2026-07-31' },
      'c20#2': { text: 'r2', folded: '2026-08-02' },
    };
    const r = feedbackRounds('c20', items);
    expect(r.activeKey).toBe('c20#3');
    expect(r.folded.map((f) => f.key)).toEqual(['c20', 'c20#2']);
  });

  it('folded round 1 with unfolded round 2 in progress: box stays on #2', () => {
    const items = {
      c20: { text: 'r1', folded: '2026-07-31' },
      'c20#2': { text: 'wip round 2' },
    };
    const r = feedbackRounds('c20', items);
    expect(r.activeKey).toBe('c20#2');
    expect(r.folded.map((f) => f.key)).toEqual(['c20']);
  });
});
