// Cut a short review clip around a moment of the latest final, so a fix is checked in seconds, not a full watch.
// usage: node lib/preview.mjs <slug> <at-seconds> [--pad 6]  →  ~/Downloads/<slug>-preview-<mmss>.mp4
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function previewArgs(src, at, pad, out) {
  const from = Math.max(0, at - pad);
  return ['-v', 'error', '-y', '-ss', String(from), '-i', src, '-t', String(pad * 2), '-c:v', 'libx264', '-crf', '18', '-c:a', 'aac', out];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [slug, atArg, ...rest] = process.argv.slice(2);
  const at = Number(atArg);
  if (!slug || !Number.isFinite(at)) { console.error('usage: node lib/preview.mjs <slug> <at-seconds> [--pad 6]'); process.exit(1); }
  const pad = rest[0] === '--pad' ? Number(rest[1]) : 6;
  const src = path.join(os.homedir(), 'kb-scratch', 'video', 'visuals-flow', slug, 'final.mp4');
  if (!fs.existsSync(src)) { console.error(`no final yet: ${src}`); process.exit(1); }
  const mmss = `${String(Math.floor(at / 60)).padStart(2, '0')}${String(Math.floor(at % 60)).padStart(2, '0')}`;
  const out = path.join(os.homedir(), 'Downloads', `${slug}-preview-${mmss}.mp4`);
  const r = spawnSync('ffmpeg', previewArgs(src, at, pad, out), { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
  console.log(out);
}
