// 010: name the video through the registry, copy the sources into the media folder, write run-config.json.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { VREG, workdirOf, mediaDirOf, designSystemDir } from './paths.mjs';
import { writeRunConfig, RECIPE } from './run-config.mjs';
import { ffmpeg, probeDuration } from './media.mjs';

// The registry mints a new key or returns the existing one; the key, not the name, names the workdir.
export function ensureKey(name, title, { run = spawnSync } = {}) {
  const r = run(process.execPath, [VREG, 'ensure', name, ...(title ? ['--title', title] : [])], { encoding: 'utf8' });
  const key = String(r.stdout ?? '').trim();
  if (r.status !== 0 || !key) throw new Error(`vreg ensure ${name} failed: ${String(r.stderr ?? '').trim()}`);
  return key;
}

export function parseCanvas(s) {
  if (!s) return undefined;
  const m = /^(\d+)x(\d+)(?:@(\d+))?$/.exec(s);
  if (!m) throw new Error(`--canvas must look like 1920x1080 or 1080x1920@30 (got "${s}")`);
  return { w: Number(m[1]), h: Number(m[2]), ...(m[3] ? { fps: Number(m[3]) } : {}) };
}

// Input-side trim: -ss/-t before -i, so ffmpeg seeks the source and every output starts at 0.
export function trimArgs({ from, to }) {
  const out = [];
  if (from) out.push('-ss', String(from));
  if (to) out.push('-t', String(+(to - (from || 0)).toFixed(3)));
  return out;
}

export function intake({ name, title, audio, screen = null, designSystem = 'default', canvas, from, to }) {
  if (!audio || !fs.existsSync(audio)) throw new Error(`--audio is required and must exist (got ${audio})`);
  if (screen && !fs.existsSync(screen)) throw new Error(`--screen ${screen} does not exist`);
  if (to !== undefined && !(to > (from || 0))) throw new Error('--to must be after --from');
  designSystemDir(designSystem);
  const key = ensureKey(name, title);
  const workdir = workdirOf(key);
  const media = mediaDirOf(key);
  fs.mkdirSync(workdir, { recursive: true });
  fs.mkdirSync(media, { recursive: true });

  const win = trimArgs({ from, to });
  // audio.wav feeds the final mux; vo.mp3 is what the transcriber reads.
  ffmpeg([...win, '-i', audio, '-vn', '-c:a', 'pcm_s16le', path.join(media, 'audio.wav')], 'audio copy');
  ffmpeg(['-i', path.join(media, 'audio.wav'), '-c:a', 'libmp3lame', '-q:a', '2', path.join(media, 'vo.mp3')], 'vo.mp3');
  if (screen) {
    if (win.length) ffmpeg([...win, '-i', screen, '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', path.join(media, 'screen.mp4')], 'screen trim');
    else fs.copyFileSync(screen, path.join(media, 'screen.mp4'));
  }
  const total = +probeDuration(path.join(media, 'audio.wav')).toFixed(3);
  const cfg = {
    template: RECIPE,
    video: key,
    title: title ?? key,
    designSystem,
    ...(canvas ? { canvas } : {}),
    source: {
      audio: 'audio.wav',
      screen: screen ? 'screen.mp4' : null,
      from: path.basename(audio) + (screen ? ` + ${path.basename(screen)}` : ''),
      ...(from || to ? { window: { from: from ?? 0, to: to ?? null } } : {}),
    },
    total,
    created: new Date().toISOString().slice(0, 10),
  };
  writeRunConfig(workdir, cfg);
  return { key, workdir, media, total };
}
