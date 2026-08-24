import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';

const scale = process.env.SCALE ? parseFloat(process.env.SCALE) : 0.5;
const out = process.env.OUT || 'out/bb_film_1080.mp4';
const id = process.env.COMP || 'BusinessBrainFilm';

const entry = process.env.ENTRY || 'src/index.ts';
const serveUrl = await bundle({ entryPoint: path.resolve(entry), onProgress: () => {} });

// Google Fonts loads flake under parallel tabs; retry the whole select+render up to 3x.
let lastErr;
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    const composition = await selectComposition({ serveUrl, id, timeoutInMilliseconds: 120000 });
    console.log('rendering', id, composition.width * scale + 'x' + composition.height * scale, 'frames', composition.durationInFrames, 'attempt', attempt);
    await renderMedia({
      composition, serveUrl, codec: 'h264', crf: process.env.CRF ? parseInt(process.env.CRF) : 20, scale,
      concurrency: process.env.CONC ? parseInt(process.env.CONC) : 6, timeoutInMilliseconds: 120000,
      frameRange: process.env.FRAMES ? process.env.FRAMES.split('-').map(Number) : undefined,
      outputLocation: out,
      chromiumOptions: process.env.GL ? { gl: process.env.GL, ignoreCertificateErrors: false } : undefined,
      onProgress: ({ renderedFrames }) => { if (renderedFrames % 300 === 0) console.log('frame', renderedFrames, '/', composition.durationInFrames); },
    });
    console.log('DONE', out);
    process.exit(0);
  } catch (e) {
    lastErr = e;
    console.log('attempt', attempt, 'failed:', String(e?.message || e).slice(0, 200));
  }
}
throw lastErr;
