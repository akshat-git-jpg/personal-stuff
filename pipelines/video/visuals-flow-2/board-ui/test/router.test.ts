import { describe, it, expect } from 'vitest';
import { tabForHash, urlForTab, urlForVideo, videoFromSearch } from '../src/lib/router';

describe('router', () => {
  it('tabForHash returns correct tab for known hashes and run for unknown', () => {
    expect(tabForHash('#card-plan')).toBe('card-plan');
    expect(tabForHash('#storyboard')).toBe('storyboard');
    expect(tabForHash('#final-cut')).toBe('final-cut');
    expect(tabForHash('')).toBe('run');
    expect(tabForHash('#unknown')).toBe('run');
  });

  it('urlForTab keeps ?video=x', () => {
    expect(urlForTab('card-plan', { pathname: '/app/', search: '?video=test-01' }))
      .toBe('/app/?video=test-01#card-plan');
  });

  it('urlForVideo keeps hash and encodes slugs', () => {
    expect(urlForVideo('test 01', { pathname: '/app/', hash: '#storyboard' }))
      .toBe('/app/?video=test%2001#storyboard');
  });

  it('videoFromSearch extracts video param', () => {
    expect(videoFromSearch('?video=test-01')).toBe('test-01');
    expect(videoFromSearch('?other=1')).toBe(null);
  });
});
