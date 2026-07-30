import { describe, it, expect, beforeEach } from 'vitest';
import { loadReviewed, saveReviewed } from '../src/lib/reviewed';

// Mock localStorage
const mockStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: mockStorage
});

describe('reviewed lib', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('load and save', () => {
    expect(loadReviewed('v1').size).toBe(0);

    const s = new Set(['cp:1', 'cp:2']);
    saveReviewed('v1', s);

    const loaded = loadReviewed('v1');
    expect(loaded.size).toBe(2);
    expect(loaded.has('cp:1')).toBe(true);
    
    // different video
    expect(loadReviewed('v2').size).toBe(0);
  });
});
