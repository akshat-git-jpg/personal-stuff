import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const videosDir = path.join(import.meta.dirname, '..', 'pipelines', 'video', 'visuals-flow', 'videos');
const resolveScript = path.join(import.meta.dirname, '..', 'pipelines', 'video', 'visuals-flow', 'lib', 'resolve.mjs');

const videos = fs.readdirSync(videosDir).filter(f => fs.statSync(path.join(videosDir, f)).isDirectory());

for (const v of videos) {
  console.log(`Resolving ${v}...`);
  const res = spawnSync(process.execPath, [resolveScript, v], { stdio: 'inherit', cwd: path.join(import.meta.dirname, '..', 'pipelines', 'video', 'visuals-flow') });
  if (res.status !== 0) {
    console.error(`Failed to resolve ${v}`);
    process.exit(1);
  }
}
