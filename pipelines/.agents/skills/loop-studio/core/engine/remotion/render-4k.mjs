import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';

const entry = path.resolve('src/index.ts');
console.log('bundling…');
const serveUrl = await bundle({ entryPoint: entry, onProgress: () => {} });
console.log('selecting composition…');
const composition = await selectComposition({ serveUrl, id: 'BusinessBrainIntro' });
console.log('rendering', composition.width + 'x' + composition.height, composition.durationInFrames, 'frames');
await renderMedia({
  composition,
  serveUrl,
  codec: 'h264',
  crf: 16,
  outputLocation: 'out/BusinessBrainIntro_4K.mp4',
  concurrency: 2,
  onProgress: ({ renderedFrames }) => {
    if (renderedFrames % 60 === 0) console.log('frame', renderedFrames, '/', composition.durationInFrames);
  },
});
console.log('DONE');
