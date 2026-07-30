import { describe, it, expect } from 'vitest';
import { validateImageFile, savePayloadFeedback } from '../src/lib/feedback';

describe('feedback lib', () => {
  it('validateImageFile', () => {
    expect(validateImageFile({ type: 'image/png', size: 100 })).toBeNull();
    expect(validateImageFile({ type: 'text/plain', size: 100 })).toBe('not an image');
    expect(validateImageFile({ type: 'image/jpeg', size: 7 * 1024 * 1024 })).toBe('image too large (max 6MB)');
  });

  it('savePayloadFeedback', () => {
    const state1 = { texts: { 'r1': 'foo' }, images: {}, dirty: false };
    expect(savePayloadFeedback(state1)).toEqual({ feedback: { 'r1': 'foo' } });

    const state2 = { texts: { 'r1': 'foo' }, images: { 'r1': 'data:image/png;base64,...', 'r2': null }, dirty: true };
    expect(savePayloadFeedback(state2)).toEqual({
      feedback: { 'r1': 'foo' },
      feedbackImages: { 'r1': 'data:image/png;base64,...', 'r2': null }
    });
  });
});
