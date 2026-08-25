import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';

const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts'), onProgress: () => {} });
const composition = await selectComposition({ serveUrl, id: 'BusinessBrainBody' });
console.log('rendering body', composition.width + 'x' + composition.height);
await renderMedia({
  composition, serveUrl, codec: 'h264', crf: 20, scale: 0.5,
  frameRange: [540, 12929], // 18s -> end (intro covers 0-18s)
  concurrency: 6,
  outputLocation: 'out/bb_body_1080.mp4',
  onProgress: ({ renderedFrames }) => { if (renderedFrames % 300 === 0) console.log('frame', renderedFrames, '/ 12389'); },
});
console.log('DONE');
