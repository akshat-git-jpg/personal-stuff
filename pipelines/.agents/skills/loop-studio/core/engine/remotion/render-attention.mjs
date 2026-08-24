/**
 * render-attention.mjs — renders the ATTENTION overlay with a real alpha channel
 * (ProRes 4444) so it can be composited over the untouched 4K source by ffmpeg.
 *
 *   OUT=out/att_overlay.mov [FRAMES=a-b] node render-attention.mjs
 */
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';

const out = process.env.OUT || 'out/att_overlay.mov';
const serveUrl = await bundle({ entryPoint: path.resolve('src/attention/index.ts'), onProgress: () => {} });
const composition = await selectComposition({ serveUrl, id: 'AttentionOverlay', timeoutInMilliseconds: 120000 });

const frameRange = process.env.FRAMES ? process.env.FRAMES.split('-').map(Number) : undefined;
console.log('rendering', composition.width + 'x' + composition.height, 'frames',
  frameRange ? frameRange.join('-') : composition.durationInFrames);

await renderMedia({
  composition, serveUrl,
  scale: process.env.SCALE ? parseFloat(process.env.SCALE) : 1,
  codec: 'prores', proResProfile: '4444',
  imageFormat: 'png', pixelFormat: 'yuva444p10le',   // alpha survives
  concurrency: process.env.CONC ? parseInt(process.env.CONC) : 6,
  timeoutInMilliseconds: 120000,
  frameRange,
  outputLocation: out,
  onProgress: ({ renderedFrames }) => {
    if (renderedFrames % 300 === 0) console.log('frame', renderedFrames, '/', composition.durationInFrames);
  },
});
console.log('DONE', out);
