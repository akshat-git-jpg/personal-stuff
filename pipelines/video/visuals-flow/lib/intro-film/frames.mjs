import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Pull one frame every `fps` seconds of output into dir, as PNGs.
export function extractFrames(video, dir, fps = 2) {
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) if (f.startsWith('f_')) fs.rmSync(path.join(dir, f));
  const r = spawnSync('ffmpeg', ['-y', '-i', video, '-vf', `fps=${fps}`, path.join(dir, 'f_%04d.png')], { stdio: 'pipe' });
  if (r.status !== 0) throw new Error(`frame extract failed: ${r.stderr}`);
  return fs.readdirSync(dir).filter((f) => f.startsWith('f_')).sort();
}

// A path inside a lavfi filtergraph is NOT a plain argument. lavfi parses ':'
// as an option separator and '\' as an escape, so a Windows absolute path is
// read as the filename "C" plus junk options and every call dies with
// "Failed to avformat_open_input 'C'". The escaping is two-level (filter
// argument, then filtergraph), hence the DOUBLE backslash before the colon.
//
// This silently killed frameLuma on Windows: the caller catches the throw and
// downgrades it to a warning, so a check that exists to catch an all-black
// render has never once run on this machine. Surfaced 2026-08-15 by the first
// successful intro-render on Windows.
//
// Same defect still lives at 5 sites in lib/assemble.test.mjs and 1 in
// lib/render-fx.test.mjs (which is why "Integration: ffmpeg fx clip" fails
// here). Those are on the body/assembly track and are recorded debt, not fixed
// from an intro fold.
export function lavfiPath(p) {
  return String(p).replace(/\\/g, '/').replace(/^([A-Za-z]):/, '$1\\\\:');
}

// Per-frame average luma. A composition that renders black gives ~0 for every
// frame — the exact signature of the "<video> nested in a wrapper" bug.
export function frameLuma(video) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-f', 'lavfi', '-i', `movie=${lavfiPath(video)},signalstats`,
    '-show_entries', 'frame_tags=lavfi.signalstats.YAVG', '-of', 'csv=p=0'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`signalstats failed: ${r.stderr}`);
  return String(r.stdout).trim().split('\n').map(Number).filter(Number.isFinite);
}

// Parse ffmpeg freezedetect stderr into [start,end] pairs. freeze_start and
// freeze_end arrive on separate lines; an unterminated freeze runs to `until`.
export function parseFreezeLog(stderr, until) {
  const out = [];
  let open = null;
  for (const line of String(stderr).split('\n')) {
    const s = line.match(/freeze_start:\s*([0-9.]+)/);
    const e = line.match(/freeze_end:\s*([0-9.]+)/);
    if (s) open = parseFloat(s[1]);
    else if (e && open !== null) { out.push([open, parseFloat(e[1])]); open = null; }
  }
  if (open !== null) out.push([open, until]);
  return out;
}

export function detectFreezes(video, duration, { noise = 0.003, minDur = 2 } = {}) {
  const r = spawnSync('ffmpeg', ['-i', video, '-vf', `freezedetect=n=${noise}:d=${minDur}`, '-map', '0:v', '-f', 'null', '-'],
    { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] });
  return parseFreezeLog(r.stderr, duration);
}

export function longestFreeze(freezes) {
  return freezes.reduce((m, [s, e]) => Math.max(m, e - s), 0);
}
