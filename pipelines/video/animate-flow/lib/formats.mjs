// Output formats. 16:9 is the main cut; 9:16 and 1:1 are laid out again, never cropped from it.
// In 9:16 and 1:1 the screen recording sits in a band across the middle and graphics lay out around it.
export const MAIN_FORMAT = '16:9';
export const FORMATS = Object.freeze({
  '16:9': { w: 1920, h: 1080, suffix: '' },
  '9:16': { w: 1080, h: 1920, suffix: '--9x16' },
  '1:1': { w: 1080, h: 1080, suffix: '--1x1' },
});

// Where the 16:9 recording lands inside a format's frame (pixels), scaled to the full width.
export function recordingBand(format) {
  const f = FORMATS[format];
  if (!f) throw new Error(`unknown format ${format}`);
  const h = Math.round((f.w * 9) / 16 / 2) * 2;
  const y = Math.round((f.h - h) / 2 / 2) * 2;
  return { x: 0, y, w: f.w, h };
}

export function formatCanvas(format, main) {
  if (format === MAIN_FORMAT) return main;
  return { w: FORMATS[format].w, h: FORMATS[format].h, fps: main.fps };
}

// moments/<id>/ holds the main composition; other formats sit beside it as moments/<id>--9x16/.
export const formatDirName = (id, format) => `${id}${FORMATS[format].suffix}`;
// The stage folder an author writes a format's composition into.
export const stageCompositionName = (format) => `composition${FORMATS[format].suffix.replace('--', '-')}`;
