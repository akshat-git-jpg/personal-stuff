import { describe, it, expect } from 'vitest';
import { tabForHash, urlForTab, urlForVideo, videoFromSearch, visibleTabs, TABS } from '../src/lib/router';

describe('router', () => {
  it('tabForHash returns correct tab for known hashes and run for unknown', () => {

    expect(tabForHash('#storyboard')).toBe('storyboard');
    expect(tabForHash('#final-cut')).toBe('final-cut');
    expect(tabForHash('')).toBe('run');
    expect(tabForHash('#unknown')).toBe('run');
  });

  // calibrate is reachable by hash but deliberately has no button (plan 193's
  // single TAB_TABLE must still route it, not just render it out of TABS).
  it('tabForHash routes #calibrate even though calibrate has no button', () => {
    expect(tabForHash('#calibrate')).toBe('calibrate');
    expect(TABS.some((t) => t.id === 'calibrate')).toBe(false);
  });

  // The button row reads in the order the film plays: the intro is the first
  // thing on screen, so it sits second, right after Run (owner decision
  // 2026-08-07). Order is a product decision, not an accident of the table.
  it('TABS renders Run, Intro, Storyboard, Final Cut in that order', () => {
    expect(TABS.map((t) => t.id)).toEqual(['run', 'intro', 'storyboard', 'final-cut']);
  });

  it('urlForTab keeps ?video=x', () => {
    expect(urlForTab('storyboard', { pathname: '/app/', search: '?video=test-01' }))
      .toBe('/app/?video=test-01#storyboard');
  });

  it('urlForVideo keeps hash and encodes slugs', () => {
    expect(urlForVideo('test 01', { pathname: '/app/', hash: '#storyboard' }))
      .toBe('/app/?video=test%2001#storyboard');
  });

  it('videoFromSearch extracts video param', () => {
    expect(videoFromSearch('?video=test-01')).toBe('test-01');
    expect(videoFromSearch('?other=1')).toBe(null);
  });

  // The derivation plan 193 is named for: a tab whose step does not apply to
  // this video is not rendered, in table order, regardless of the applicable
  // list's order.
  it('visibleTabs filters to the applicable ids, preserving table order', () => {
    const applicable = ['final-cut', 'run']; // deliberately out of TABS order
    expect(visibleTabs(TABS, applicable)).toEqual([
      { id: 'run', label: 'Run' },
      { id: 'final-cut', label: 'Final Cut' },
    ]);
  });

  it('visibleTabs drops intro when the applicable list omits it', () => {
    const applicable = ['run', 'storyboard', 'final-cut'];
    expect(visibleTabs(TABS, applicable).some((t) => t.id === 'intro')).toBe(false);
  });
});
