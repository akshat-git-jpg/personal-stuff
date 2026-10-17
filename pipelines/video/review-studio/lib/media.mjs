// Timeline thumbnails and the voice waveform, made with ffmpeg once and cached outside the repo.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';

const CACHE = process.env.REVIEW_CACHE ?? path.join(os.homedir(), 'kb-scratch', 'video', 'review-studio-cache');
export const PEAKS_PER_SEC = 10;

function cacheDir(file) {
  const st = fs.statSync(file);
  const id = crypto.createHash('sha1').update(`${file}:${st.size}:${st.mtimeMs}`).digest('hex').slice(0, 16);
  const dir = path.join(CACHE, id);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function run(args, { collect = false } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { stdio: ['ignore', collect ? 'pipe' : 'ignore', 'pipe'] });
    const chunks = [];
    let err = '';
    if (collect) p.stdout.on('data', (d) => chunks.push(d));
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`ffmpeg failed: ${err.trim().slice(0, 300)}`))));
  });
}

const pending = new Map();
function once(key, fn) {
  if (!pending.has(key)) pending.set(key, fn().finally(() => pending.delete(key)));
  return pending.get(key);
}

// One small frame at a whole second.
export function thumbnail(file, sec) {
  const s = Math.max(0, Math.floor(sec));
  const out = path.join(cacheDir(file), `t${s}.jpg`);
  if (fs.existsSync(out)) return Promise.resolve(out);
  return once(out, async () => {
    const tmp = `${out}.${process.pid}.tmp.jpg`;
    await run(['-ss', String(s), '-i', file, '-frames:v', '1', '-vf', 'scale=160:-2', '-q:v', '6', '-y', tmp]);
    fs.renameSync(tmp, out);
    return out;
  });
}

// Loudness peaks, 0-255, PEAKS_PER_SEC per second of audio.
export function peaks(file) {
  const out = path.join(cacheDir(file), 'peaks.json');
  if (fs.existsSync(out)) return Promise.resolve(JSON.parse(fs.readFileSync(out, 'utf8')));
  return once(out, async () => {
    const rate = 4000;
    const pcm = await run(['-i', file, '-vn', '-ac', '1', '-ar', String(rate), '-f', 's16le', '-'], { collect: true });
    const per = rate / PEAKS_PER_SEC;
    const n = Math.floor(pcm.length / 2);
    const data = [];
    for (let i = 0; i < n; i += per) {
      let max = 0;
      for (let j = i; j < Math.min(i + per, n); j++) max = Math.max(max, Math.abs(pcm.readInt16LE(j * 2)));
      data.push(Math.round((max / 32768) * 255));
    }
    const result = { perSec: PEAKS_PER_SEC, data };
    fs.writeFileSync(out, JSON.stringify(result));
    return result;
  });
}
