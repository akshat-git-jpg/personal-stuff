import { describe, it, expect } from 'vitest';
import { AUTO_REVIEWED_CARDS, isAutoReviewed, effectiveReviewed } from '../src/lib/reviewDefaults';

const none = new Set<string>();

describe('reviewDefaults', () => {
  it('the routine overlays default to reviewed', () => {
    expect(isAutoReviewed('overlay/lower-third')).toBe(true);
    expect(isAutoReviewed('overlay/stat-hit')).toBe(true);
    expect(isAutoReviewed('overlay/tip-banner')).toBe(true);
  });

  it('anything that needs a decision does NOT default to reviewed', () => {
    expect(isAutoReviewed('section/section-card-flip')).toBe(false);
    expect(isAutoReviewed('enacted/character-card-stamp')).toBe(false);
    expect(isAutoReviewed('prompt/prompt-typing')).toBe(false);
    expect(isAutoReviewed(null)).toBe(false);
    expect(isAutoReviewed(undefined)).toBe(false);
  });

  it('a card with no slug is never auto-reviewed', () => {
    expect(effectiveReviewed({ rid: 'sb:c01', reviewed: none, unreviewed: none })).toBe(false);
  });

  it('an auto-reviewed card starts ticked with nothing stored', () => {
    expect(effectiveReviewed({ rid: 'sb:c02', card: 'overlay/lower-third', reviewed: none, unreviewed: none })).toBe(true);
  });

  // The whole reason the opt-out set exists: without it, absence means both
  // "never touched" and "turned off", so the default re-ticks a card the owner
  // deliberately reopened on every single reload.
  it('an explicit untick beats the default and survives', () => {
    expect(effectiveReviewed({
      rid: 'sb:c02', card: 'overlay/lower-third',
      reviewed: none, unreviewed: new Set(['sb:c02']),
    })).toBe(false);
  });

  it('an explicit untick beats an explicit tick', () => {
    expect(effectiveReviewed({
      rid: 'sb:c02', card: 'overlay/lower-third',
      reviewed: new Set(['sb:c02']), unreviewed: new Set(['sb:c02']),
    })).toBe(false);
  });

  it('a non-default card can still be ticked by hand', () => {
    expect(effectiveReviewed({
      rid: 'sb:c01', card: 'section/section-card-flip',
      reviewed: new Set(['sb:c01']), unreviewed: none,
    })).toBe(true);
  });

  it('the list is the only thing to edit to add a card', () => {
    expect(isAutoReviewed('overlay/brand-new', [...AUTO_REVIEWED_CARDS, 'overlay/brand-new'])).toBe(true);
    expect(isAutoReviewed('overlay/brand-new')).toBe(false);
  });
});
