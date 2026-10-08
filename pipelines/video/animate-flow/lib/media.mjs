// ffmpeg/ffprobe calls, argument arrays only so paths with spaces work on every OS.
import { spawnSync } from 'node:child_process';

export function ffmpeg(args, label = 'ffmpeg') {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error(`${label}: ffmpeg not found (${r.error.message})`);
  if (r.status !== 0) throw new Error(`${label} failed:\n${String(r.stderr).slice(-1500)}`);
}

export function probeDuration(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const d = parseFloat(r.stdout);
  if (!Number.isFinite(d)) throw new Error(`cannot read the duration of ${file}`);
  return d;
}

// Trim args for an optional [from, to] window, in seconds.
export function windowArgs({ from, to } = {}) {
  return [...(from ? ['-ss', String(from)] : []), ...(to ? ['-to', String(to)] : [])];
}
