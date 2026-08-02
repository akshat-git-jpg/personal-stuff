import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { extractFrames } from './frames.mjs';
import { resolveWorkdir } from './workdir.mjs';

export function contactSheetArgs(pattern, out, columns, rows) {
  return ['-y', '-i', pattern, '-vf', `scale=480:-1,tile=${columns}x${rows}`, '-frames:v', '1', out];
}

export function buildContactSheet(slug, { fps = 2, columns = 6 } = {}) {
  const workdir = resolveWorkdir(slug);
  const video = path.join(workdir, 'renders', 'intro-film.mp4');
  if (!fs.existsSync(video)) throw new Error(`missing ${video} — run the render step first`);
  
  const qcDir = path.join(workdir, 'qc');
  const framesDir = path.join(qcDir, 'frames');
  const pngs = extractFrames(video, framesDir, fps);
  if (pngs.length === 0) throw new Error('no frames extracted');
  
  const rows = Math.ceil(pngs.length / columns);
  const out = path.join(qcDir, 'contact-sheet.jpg');
  const pattern = path.join(framesDir, 'f_%04d.png');
  
  const r = spawnSync('ffmpeg', contactSheetArgs(pattern, out, columns, rows), { stdio: 'pipe' });
  if (r.status !== 0) throw new Error(`contact sheet failed: ${r.stderr}`);
  return out;
}
