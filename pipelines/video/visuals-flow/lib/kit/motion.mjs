// Picture-change measures on any video file: dead beats, a motion map, a phone sheet. Numbers only, no judgment.
// Dead beats and the phone sheet are adapted from cth9191/animate (MIT).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const DEAD_BEAT_DEFAULTS = Object.freeze({ maxStill: 4, lag: 0.5, step: 0.25, floor: 0.8, medianFrac: 0.25 });

export function probeVideo(video) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', video], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffprobe failed on ${video}: ${r.stderr}`);
  const j = JSON.parse(r.stdout);
  return { w: j.streams?.[0]?.width, h: j.streams?.[0]?.height, duration: Number(j.format?.duration) };
}

// Small grayscale frames as one raw buffer: what every measure below reads.
export function grayFrames(video, { width = 96, fps = 4, from, to } = {}) {
  const { w: vw, h: vh } = probeVideo(video);
  const w = width, h = Math.max(2, Math.round((width * vh) / vw / 2) * 2);
  const win = [...(from ? ['-ss', String(from)] : []), ...(to ? ['-t', String(+(to - (from || 0)).toFixed(3))] : [])];
  const r = spawnSync('ffmpeg', ['-v', 'error', ...win, '-i', video, '-vf', `fps=${fps},scale=${w}:${h},format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`ffmpeg decode failed on ${video}: ${String(r.stderr).slice(-800)}`);
  const px = w * h;
  return { data: r.stdout, w, h, px, n: Math.floor(r.stdout.length / px), fps, from: from || 0 };
}

export function meanAbsDiff(data, px, a, b) {
  let d = 0;
  for (let i = 0, oa = a * px, ob = b * px; i < px; i++) d += Math.abs(data[oa + i] - data[ob + i]);
  return d / px;
}

// points: [[t, change]] in time order. A run of "still" points at least maxStill long is a dead beat.
// exempt: [[t0, t1]] spans where stillness is intended.
export function deadRuns(points, { maxStill = DEAD_BEAT_DEFAULTS.maxStill, floor = DEAD_BEAT_DEFAULTS.floor, medianFrac = DEAD_BEAT_DEFAULTS.medianFrac, exempt = [], end } = {}) {
  const sorted = points.map((p) => p[1]).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const threshold = Math.max(floor, medianFrac * median);
  const runs = [];
  let r0 = null;
  const last = end ?? (points.length ? points[points.length - 1][0] : 0);
  for (const [t, d] of [...points, [last, Infinity]]) {
    const still = d < threshold && !exempt.some(([a, b]) => t >= a && t < b);
    if (still && r0 === null) r0 = t;
    else if (!still && r0 !== null) {
      if (t - r0 >= maxStill - 1e-6) runs.push({ from: +r0.toFixed(2), to: +t.toFixed(2), seconds: +(t - r0).toFixed(2) });
      r0 = null;
    }
  }
  return { runs, median: +median.toFixed(3), threshold: +threshold.toFixed(3) };
}

// How much the picture changes over `lag` seconds, every `step` seconds; runs of near-zero change are dead beats.
export function deadBeats(video, opts = {}) {
  const o = { ...DEAD_BEAT_DEFAULTS, ...opts };
  const fps = 1 / o.step;
  const g = grayFrames(video, { width: 96, fps });
  const lagN = Math.max(1, Math.round(o.lag / o.step));
  const points = [];
  for (let f = lagN; f < g.n; f++) points.push([+(f * o.step).toFixed(3), meanAbsDiff(g.data, g.px, f, f - lagN)]);
  return { ...deadRuns(points, { ...o, end: g.n * o.step }), maxStill: o.maxStill, sampled: points.length };
}

// Mean frame-to-frame change per grid cell over [from, to]: where the picture moves.
export function motionGrid({ data, w, h, px, n }, { cols = 8, rows = 6 } = {}) {
  const sum = new Float64Array(cols * rows), cnt = new Float64Array(cols * rows);
  for (let f = 1; f < n; f++) {
    for (let y = 0; y < h; y++) {
      const cy = Math.min(rows - 1, Math.floor((y * rows) / h));
      for (let x = 0; x < w; x++) {
        const i = y * w + x, c = cy * cols + Math.min(cols - 1, Math.floor((x * cols) / w));
        sum[c] += Math.abs(data[f * px + i] - data[(f - 1) * px + i]);
        cnt[c]++;
      }
    }
  }
  return Array.from(sum, (s, i) => +(cnt[i] ? s / cnt[i] : 0).toFixed(3));
}

// Cells whose change is at least `frac` of the busiest cell (and above `floor`), with their bounding box in 0-1 fractions.
export function busyCells(grid, { cols = 8, rows = 6, frac = 0.35, floor = 0.6 } = {}) {
  const max = Math.max(0, ...grid);
  if (max < floor) return { cells: [], box: null, max };
  const cells = grid.flatMap((v, i) => (v >= Math.max(floor, frac * max) ? [{ col: i % cols, row: Math.floor(i / cols), v }] : []));
  const box = {
    x0: Math.min(...cells.map((c) => c.col)) / cols, y0: Math.min(...cells.map((c) => c.row)) / rows,
    x1: (Math.max(...cells.map((c) => c.col)) + 1) / cols, y1: (Math.max(...cells.map((c) => c.row)) + 1) / rows,
  };
  return { cells, box, max };
}

export function motionMap(video, { from, to, cols = 8, rows = 6, width = 160, fps = 4, frac, floor } = {}) {
  const g = grayFrames(video, { width, fps, from, to });
  const grid = motionGrid(g, { cols, rows });
  return { cols, rows, grid, ...busyCells(grid, { cols, rows, frac, floor }) };
}

// One frame a second at 360 px wide, tiled: the size people watch at.
export function phoneSheet(video, out, { width = 360, cols = 6, every = 1 } = {}) {
  const { duration } = probeVideo(video);
  const rows = Math.max(1, Math.ceil(duration / every / cols));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', video, '-vf', `fps=1/${every},scale=${width}:-2,tile=${cols}x${rows}`, '-frames:v', '1', '-q:v', '3', out], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`phone sheet failed: ${r.stderr}`);
  return { out, frames: Math.ceil(duration / every), cols, rows };
}
