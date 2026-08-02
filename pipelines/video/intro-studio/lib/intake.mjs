// Split one recorded intro.mp4 into the two materials the film needs:
// vo.mp3 (the voice, for transcription and as the film's audio bed) and
// screen.mp4 (the recording, available to the film as a framed element).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveWorkdir } from './workdir.mjs';

// 16kHz mono keeps whisper happy and the upload small.
export function audioExtractArgs(inFile, outFile) {
  return ['-y', '-i', inFile, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '32k', outFile];
}

// Normalise the recording to 1920x1080 / 30fps so the film composes against a
// known canvas. Letterbox rather than crop — never silently discard picture.
export function screenNormaliseArgs(inFile, outFile) {
  return [
    '-y', '-i', inFile,
    '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30',
    '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    outFile,
  ];
}

export function probeDuration(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffprobe failed on ${file}: ${r.stderr}`);
  const d = parseFloat(String(r.stdout).trim());
  if (!Number.isFinite(d)) throw new Error(`ffprobe gave no duration for ${file}`);
  return d;
}

// The PICTURE's length. A container's duration is the longest stream, and the
// audio encoder pads to its own packet size — so format duration overstates the
// film by tens of milliseconds even when every rendered frame is correct.
export function probeVideoDuration(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const d = parseFloat(String(r.stdout).trim());
  if (r.status === 0 && Number.isFinite(d)) return d;
  return probeDuration(file); // some containers carry no per-stream duration
}

export function probeDimensions(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffprobe failed on ${file}: ${r.stderr}`);
  const [width, height] = String(r.stdout).trim().split(',').map(Number);
  if (!Number.isFinite(width) || !Number.isFinite(height)) throw new Error(`ffprobe gave no dimensions for ${file}`);
  return { width, height };
}

export function runIntake(slug) {
  const workdir = resolveWorkdir(slug);
  const input = path.join(workdir, 'input', 'intro.mp4');
  if (!fs.existsSync(input)) throw new Error(`missing ${input} — put the recorded intro there first`);

  const vo = path.join(workdir, 'vo.mp3');
  const screen = path.join(workdir, 'screen.mp4');

  for (const [label, args] of [['audio', audioExtractArgs(input, vo)], ['screen', screenNormaliseArgs(input, screen)]]) {
    const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`ffmpeg ${label} pass failed (exit ${r.status})`);
  }

  const meta = {
    slug: path.basename(workdir),
    source: 'input/intro.mp4',
    duration: probeDuration(vo),
    videoDuration: probeDuration(screen),
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(workdir, 'intake.json'), JSON.stringify(meta, null, 2));
  return meta;
}
