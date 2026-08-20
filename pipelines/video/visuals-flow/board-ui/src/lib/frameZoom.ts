// Zoom for the Intro tab's review frames, measured in COLUMNS of the 3-up frame
// strip rather than in CSS scale. A review frame is a 1920-wide still rendered
// into a third of a column, so anything the automated check cannot catch — a
// wrong glyph, a hairline seam, bad kerning — is unreadable at 1×. Scaling the
// image instead would mean panning inside its own cell to reach the part you
// zoomed for; spanning columns keeps the whole frame on screen at every level.

export const FRAME_ZOOMS = [0.5, 1, 2, 3];
export const DEFAULT_FRAME_ZOOM = 1;

/** Next level in `dir` (+1 in, -1 out), clamped at both ends. */
export function stepZoom(current: number, dir: number): number {
  const i = FRAME_ZOOMS.indexOf(current);
  // An unknown level (a stale value from a future build) reads as the default
  // rather than jumping to 0.5 — indexOf returns -1, and -1 + dir is a valid
  // index for dir=+1, so a bare index bump would silently zoom the wrong way.
  const from = i === -1 ? FRAME_ZOOMS.indexOf(DEFAULT_FRAME_ZOOM) : i;
  const next = Math.min(FRAME_ZOOMS.length - 1, Math.max(0, from + dir));
  return FRAME_ZOOMS[next];
}

export function canZoom(current: number, dir: number): boolean {
  return stepZoom(current, dir) !== current;
}

/** Grid columns a frame occupies. Below 1× it still owns one cell, half-filled. */
export function zoomSpan(zoom: number): number {
  return Math.max(1, Math.round(zoom));
}

export function zoomLabel(zoom: number): string {
  return zoom < 1 ? '½×' : `${zoom}×`;
}
