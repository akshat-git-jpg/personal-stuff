import { describe, it, expect } from 'vitest';
import { FRAME_ZOOMS, DEFAULT_FRAME_ZOOM, stepZoom, canZoom, zoomSpan, zoomLabel } from '../src/lib/frameZoom';

describe('frameZoom', () => {
  it('steps in and out through every level', () => {
    expect(stepZoom(1, 1)).toBe(2);
    expect(stepZoom(2, 1)).toBe(3);
    expect(stepZoom(1, -1)).toBe(0.5);
  });

  // A control that runs off its own scale is worse than no control: the frame
  // vanishes or the strip blows out, and nothing on screen says why.
  it('clamps at both ends instead of falling off the scale', () => {
    expect(stepZoom(3, 1)).toBe(3);
    expect(stepZoom(0.5, -1)).toBe(0.5);
    expect(canZoom(3, 1)).toBe(false);
    expect(canZoom(0.5, -1)).toBe(false);
    expect(canZoom(1, 1)).toBe(true);
    expect(canZoom(1, -1)).toBe(true);
  });

  // A zoom value left over from an older build must not send the button the
  // wrong way — indexOf returns -1, and -1 + 1 is a legal index into the array.
  it('treats an unknown level as the default', () => {
    expect(stepZoom(1.75, 1)).toBe(stepZoom(DEFAULT_FRAME_ZOOM, 1));
    expect(stepZoom(1.75, -1)).toBe(stepZoom(DEFAULT_FRAME_ZOOM, -1));
  });

  // The strip is a 3-column grid. A span outside 1..3 either collapses the
  // frame or overflows the row.
  it('spans between one and three columns at every level', () => {
    for (const z of FRAME_ZOOMS) {
      const span = zoomSpan(z);
      expect(span).toBeGreaterThanOrEqual(1);
      expect(span).toBeLessThanOrEqual(3);
      expect(Number.isInteger(span)).toBe(true);
    }
    expect(zoomSpan(0.5)).toBe(1);   // below 1x it still owns a cell, half-filled
    expect(zoomSpan(3)).toBe(3);
  });

  it('labels every level readably', () => {
    expect(zoomLabel(0.5)).toBe('½×');
    expect(zoomLabel(1)).toBe('1×');
    expect(zoomLabel(3)).toBe('3×');
  });
});
