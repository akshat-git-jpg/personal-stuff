#!/usr/bin/env node
// Reference video -> design system: frames, contact sheets, palette, then a staged `claude -p` writes DESIGN.md + tokens.json.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseSceneLog } from '../../visuals-flow/lib/reference-moments.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DS_ROOT = path.resolve(HERE, '..');
export const SCRATCH_ROOT = path.join(os.homedir(), 'kb-scratch', 'video', 'design-systems');

export const DEFAULTS = {
  frames: 48,
  perSheet: 24,        // 6x4 grid
  cols: 6,
  cellWidth: 400,
  scene: 0.3,          // hard-cut threshold
  motionFloor: 0.01,   // change scores below this count as still
  bursts: 3,           // motion strips around the strongest cuts
  burstFrames: 8,
  burstFps: 10,
  maxCommitBytes: 500 * 1024,
  model: 'opus',
  maxTurns: 40,
};

const USAGE = `Usage: from-reference.mjs <youtube-url | video-file> --name <slug>
       [--start S] [--end E] [--crop W:H:X:Y] [--frames N] [--scene T]
       [--no-author] [--author-only] [--model opus] [--force]

  --start/--end  slice to study (seconds or m:ss / h:mm:ss)
  --crop         ffmpeg crop of the source, to isolate the motion canvas from UI chrome
  --no-author    stop after the contact sheets (no claude -p)
  --author-only  re-run only the authoring step on existing sheets`;

export function parseTime(v) {
  if (v === undefined || v === null || v === '') return undefined;
  const s = String(v).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  const m = s.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
  if (!m) throw new Error(`bad time: ${v}`);
  return (Number(m[1] || 0) * 3600) + Number(m[2]) * 60 + Number(m[3]);
}

export function isUrl(s) {
  return /^https?:\/\//i.test(s);
}

export function parseArgs(argv) {
  const out = { ...DEFAULTS, author: true, authorOnly: false, force: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    switch (a) {
      case '--name': out.name = val(); break;
      case '--start': out.start = parseTime(val()); break;
      case '--end': out.end = parseTime(val()); break;
      case '--crop': out.crop = val(); break;
      case '--frames': out.frames = Number(val()); break;
      case '--scene': out.scene = Number(val()); break;
      case '--model': out.model = val(); break;
      case '--no-author': out.author = false; break;
      case '--author-only': out.authorOnly = true; break;
      case '--force': out.force = true; break;
      case '-h': case '--help': out.help = true; break;
      default:
        if (a.startsWith('--')) throw new Error(`unknown flag: ${a}`);
        rest.push(a);
    }
  }
  if (out.help) return out;
  if (rest.length !== 1) throw new Error('give exactly one source (url or file)');
  out.source = rest[0];
  if (!out.name || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(out.name)) throw new Error('--name must be a kebab-case slug');
  if (out.name === 'default' || out.name === 'tools') throw new Error(`--name ${out.name} is reserved`);
  if (out.start !== undefined && out.end !== undefined && out.end <= out.start) throw new Error('--end must be after --start');
  if (out.crop && !/^\d+:\d+:\d+:\d+$/.test(out.crop)) throw new Error('--crop must be W:H:X:Y');
  if (!Number.isInteger(out.frames) || out.frames < 8 || out.frames > 96) throw new Error('--frames must be 8-96');
  return out;
}

export function pathsFor(name, root = DS_ROOT, scratch = SCRATCH_ROOT) {
  const work = path.join(scratch, name);
  const dir = path.join(root, name);
  return {
    dir,
    reference: path.join(dir, 'reference'),
    design: path.join(dir, 'DESIGN.md'),
    tokens: path.join(dir, 'tokens.json'),
    work,
    video: path.join(work, 'source.mp4'),
    frames: path.join(work, 'frames'),
    sheets: path.join(work, 'sheets'),
    stage: path.join(work, 'stage'),
  };
}

// Uniform grid plus scene cuts (nudged past the cut), thinned to `target` with a minimum gap.
export function selectFrameTimes({ duration, sceneTimes = [], target = DEFAULTS.frames, settle = 0.3 }) {
  if (!(duration > 0)) return [];
  const minGap = duration / (target * 2);
  const end = Math.max(0, duration - 0.05);
  const cuts = [...new Set(sceneTimes.map((t) => Math.min(end, t + settle)))]
    .filter((t) => t >= 0 && t <= end)
    .sort((a, b) => a - b)
    .map((t) => ({ t, kind: 'scene' }));

  const keptCuts = [];
  for (const c of cuts) {
    if (!keptCuts.length || c.t - keptCuts[keptCuts.length - 1].t >= minGap) keptCuts.push(c);
  }
  let scenes = keptCuts;
  const sceneBudget = Math.floor(target / 2);
  if (scenes.length > sceneBudget) scenes = evenPick(scenes, sceneBudget);

  const need = target - scenes.length;
  const grid = [];
  for (let i = 0; i < need * 2; i++) grid.push({ t: ((i + 0.5) * duration) / (need * 2), kind: 'uniform' });
  const fill = grid.filter((g) => scenes.every((s) => Math.abs(s.t - g.t) >= minGap));
  const picked = [...scenes, ...evenPick(fill, need)].sort((a, b) => a.t - b.t);
  return picked.map((p) => ({ t: round3(p.t), kind: p.kind }));
}

export function evenPick(list, n) {
  if (n <= 0) return [];
  if (list.length <= n) return list.slice();
  const out = [];
  for (let i = 0; i < n; i++) out.push(list[Math.floor(((i + 0.5) * list.length) / n)]);
  return out;
}

// Motion strips go where frames change most WITHOUT a hard cut (morphs, wipes, floods), spaced apart.
export function pickBursts(scores, { count = DEFAULTS.bursts, duration, cut = DEFAULTS.scene, span = 0.8, minApart = 2 }) {
  const soft = scores.filter((s) => s.score < cut);
  const windows = soft.map((s) => {
    const start = Math.max(0, Math.min(duration - span, s.t - span / 3));
    const activity = soft.filter((o) => o.t >= start && o.t <= start + span).reduce((a, o) => a + o.score, 0);
    return { start: round3(start), activity: round3(activity) };
  });
  windows.sort((a, b) => b.activity - a.activity || a.start - b.start);
  const out = [];
  for (const w of windows) {
    if (out.length >= count) break;
    if (out.every((o) => Math.abs(o.start - w.start) >= minApart)) out.push(w);
  }
  return out.sort((a, b) => a.start - b.start);
}

// Sheet layout: frame i -> sheet number and 1-based cell.
export function layoutSheets(count, perSheet = DEFAULTS.perSheet) {
  const sheets = Math.ceil(count / perSheet);
  return Array.from({ length: count }, (_, i) => ({ sheet: Math.floor(i / perSheet) + 1, cell: (i % perSheet) + 1, of: sheets }));
}

// Dominant colors from raw rgb24 pixels: 4-bit buckets, averaged, merged when close.
export function dominantColors(buf, { top = 12, mergeDist = 28 } = {}) {
  const bins = new Map();
  const n = Math.floor(buf.length / 3);
  for (let i = 0; i < n; i++) {
    const r = buf[i * 3], g = buf[i * 3 + 1], b = buf[i * 3 + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const e = bins.get(key) || { r: 0, g: 0, b: 0, c: 0 };
    e.r += r; e.g += g; e.b += b; e.c++;
    bins.set(key, e);
  }
  const ranked = [...bins.values()]
    .map((e) => ({ r: e.r / e.c, g: e.g / e.c, b: e.b / e.c, c: e.c }))
    .sort((a, b) => b.c - a.c);
  const merged = [];
  for (const e of ranked) {
    const near = merged.find((m) => Math.hypot(m.r - e.r, m.g - e.g, m.b - e.b) < mergeDist);
    if (near) {
      const c = near.c + e.c;
      near.r = (near.r * near.c + e.r * e.c) / c;
      near.g = (near.g * near.c + e.g * e.c) / c;
      near.b = (near.b * near.c + e.b * e.c) / c;
      near.c = c;
    } else merged.push({ ...e });
  }
  return merged
    .sort((a, b) => b.c - a.c)
    .slice(0, top)
    .map((m) => ({ hex: toHex(m.r, m.g, m.b), share: round3(m.c / n) }));
}

export function toHex(r, g, b) {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

export function fmtTime(t) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

const round3 = (x) => Math.round(x * 1000) / 1000;

// ---------- side effects below ----------

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: opts.encoding ?? 'utf8', maxBuffer: 1 << 28, ...opts });
  if (r.error) throw new Error(`${cmd} failed to start: ${r.error.message}`);
  if (r.status !== 0 && !opts.allowFail) {
    throw new Error(`${cmd} exited ${r.status}\n${String(r.stderr || '').slice(-1500)}`);
  }
  return r;
}

function probeSize(file) {
  const r = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file]);
  const [width, height] = r.stdout.trim().split(',').map(Number);
  return { width, height };
}

function probeDuration(file) {
  const r = run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]);
  return Number(r.stdout.trim());
}

// Android client is the fallback: the default web client 403s on this Mac when the PO-token plugin breaks.
const YT_CLIENTS = [null, 'android', 'web_embedded'];

function download(opts, p) {
  const stamp = JSON.stringify({ source: opts.source, start: opts.start ?? null, end: opts.end ?? null });
  const stampFile = `${p.video}.json`;
  if (fs.existsSync(p.video) && fs.existsSync(stampFile) && fs.readFileSync(stampFile, 'utf8') === stamp) {
    console.log(`reuse ${p.video}`);
    return;
  }
  const base = [
    '--no-update', '-q', '--no-warnings', '--no-playlist',
    '-f', 'bv*[height<=480][height>=360]/b[height<=480][height>=360]/bv*[height<=720]/b',
    '--force-overwrites', '-o', p.video,
  ];
  if (opts.start !== undefined || opts.end !== undefined) {
    base.push('--download-sections', `*${opts.start ?? 0}-${opts.end ?? 'inf'}`, '--force-keyframes-at-cuts');
  }
  for (const client of YT_CLIENTS) {
    const args = client ? [...base, '--extractor-args', `youtube:player_client=${client}`] : base;
    console.log(`yt-dlp${client ? ` (${client} client)` : ''} ...`);
    const r = run('yt-dlp', [...args, opts.source], { allowFail: true });
    if (r.status === 0 && fs.existsSync(p.video)) {
      fs.writeFileSync(stampFile, stamp);
      return;
    }
    console.log(`  failed: ${String(r.stderr).trim().split('\n').pop()}`);
  }
  throw new Error('yt-dlp could not download the video with any client');
}

function sourceVideo(opts, p) {
  if (isUrl(opts.source)) {
    download(opts, p);
    return { file: p.video, offset: opts.start ?? 0, sliced: true };
  }
  const file = path.resolve(opts.source);
  if (!fs.existsSync(file)) throw new Error(`no such file: ${file}`);
  return { file, offset: opts.start ?? 0, sliced: false };
}

// Window args for ffmpeg input: a local file is sliced at read time.
function windowArgs(src, opts) {
  if (src.sliced) return [];
  const a = [];
  if (opts.start !== undefined) a.push('-ss', String(opts.start));
  if (opts.end !== undefined) a.push('-to', String(opts.end));
  return a;
}

function vf(opts, extra) {
  return [opts.crop ? `crop=${opts.crop}` : null, ...extra].filter(Boolean).join(',');
}

// Change score of every frame above a low floor; hard cuts are the ones >= opts.scene.
function detectScenes(src, opts) {
  const r = run('ffmpeg', ['-hide_banner', ...windowArgs(src, opts), '-i', src.file, '-an',
    '-vf', vf(opts, [`select='gt(scene,${opts.motionFloor})'`, 'metadata=print']), '-f', 'null', '-'], { allowFail: true });
  return parseSceneLog(String(r.stderr));
}

function extractFrame(src, opts, t, label, out, width) {
  const ss = src.sliced ? t : (opts.start ?? 0) + t;
  const text = label.replace(/:/g, '\\:');
  run('ffmpeg', ['-v', 'error', '-y', '-ss', String(ss), '-i', src.file, '-frames:v', '1',
    '-vf', vf(opts, [`scale=${width}:-2`, `drawtext=text='${text}':x=6:y=6:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=4`]),
    '-q:v', '3', out]);
}

function tile(pattern, start, count, cols, out) {
  const rows = Math.ceil(count / cols);
  run('ffmpeg', ['-v', 'error', '-y', '-start_number', String(start), '-i', pattern,
    '-frames:v', '1', '-vf', `tile=${cols}x${rows}:padding=4:color=black`, '-q:v', '4', out]);
}

function measurePalette(dir) {
  const r = run('ffmpeg', ['-v', 'error', '-i', path.join(dir, 'f-%03d.jpg'),
    '-vf', 'scale=96:-2:flags=area', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { encoding: 'buffer' });
  return dominantColors(r.stdout);
}

function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function buildReference(opts, p) {
  fs.mkdirSync(p.work, { recursive: true });
  const src = sourceVideo(opts, p);
  const full = probeDuration(src.file);
  const duration = src.sliced ? full : Math.min(full, opts.end ?? full) - (opts.start ?? 0);
  if (!(duration > 1)) throw new Error(`slice too short: ${duration}s`);
  console.log(`studying ${duration.toFixed(1)}s from ${fmtTime(src.offset)}`);

  const scores = detectScenes(src, opts);
  const cuts = scores.filter((s) => s.score >= opts.scene);
  const times = selectFrameTimes({ duration, sceneTimes: cuts.map((s) => s.t), target: opts.frames });
  console.log(`${cuts.length} hard cuts, ${times.length} frames`);

  rmrf(p.frames); rmrf(p.sheets);
  fs.mkdirSync(p.frames, { recursive: true });
  fs.mkdirSync(p.sheets, { recursive: true });

  const layout = layoutSheets(times.length);
  const frames = times.map((ft, i) => {
    const abs = round3(src.offset + ft.t);
    const file = `f-${String(i + 1).padStart(3, '0')}.jpg`;
    extractFrame(src, opts, ft.t, fmtTime(abs), path.join(p.frames, file), opts.cellWidth);
    return { i: i + 1, t: abs, kind: ft.kind, ...layout[i], file };
  });

  const sheets = [];
  const nSheets = layout.length ? layout[layout.length - 1].sheet : 0;
  for (let s = 1; s <= nSheets; s++) {
    const inSheet = frames.filter((f) => f.sheet === s);
    const file = `sheet-${s}.jpg`;
    tile(path.join(p.frames, 'f-%03d.jpg'), inSheet[0].i, inSheet.length, opts.cols, path.join(p.sheets, file));
    sheets.push({ file, kind: 'overview', from: inSheet[0].t, to: inSheet[inSheet.length - 1].t, frames: inSheet.length });
  }

  // One motion sheet: each row is a short high-fps strip across a strong cut, read left to right.
  const bursts = pickBursts(scores, { count: opts.bursts, duration, cut: opts.scene });
  if (bursts.length) {
    const bdir = path.join(p.frames, 'bursts');
    fs.mkdirSync(bdir, { recursive: true });
    let k = 0;
    const rows = [];
    for (const b of bursts) {
      for (let j = 0; j < opts.burstFrames; j++) {
        const t = b.start + j / opts.burstFps;
        extractFrame(src, opts, t, `${fmtTime(src.offset + t)}`, path.join(bdir, `b-${String(++k).padStart(3, '0')}.jpg`), 320);
      }
      rows.push({ start: round3(src.offset + b.start), fps: opts.burstFps, frames: opts.burstFrames, activity: b.activity });
    }
    const file = 'motion-1.jpg';
    tile(path.join(bdir, 'b-%03d.jpg'), 1, k, opts.burstFrames, path.join(p.sheets, file));
    sheets.push({ file, kind: 'motion', rows });
  }

  const palette = measurePalette(p.frames);

  fs.mkdirSync(p.reference, { recursive: true });
  for (const f of fs.readdirSync(p.reference)) if (/^(sheet|motion)-\d+\.jpg$/.test(f)) fs.rmSync(path.join(p.reference, f));
  for (const sh of sheets) {
    const from = path.join(p.sheets, sh.file);
    sh.bytes = fs.statSync(from).size;
    sh.committed = sh.bytes <= opts.maxCommitBytes;
    if (sh.committed) fs.copyFileSync(from, path.join(p.reference, sh.file));
    else sh.scratchPath = from;
  }

  const index = {
    name: opts.name,
    source: isUrl(opts.source) ? opts.source : path.basename(opts.source),
    slice: { start: opts.start ?? 0, end: opts.end ?? round3(src.offset + duration) },
    sourceSize: probeSize(src.file),
    crop: opts.crop ?? null,
    duration: round3(duration),
    scratch: p.work.replace(os.homedir(), '~'),
    sceneThreshold: opts.scene,
    sheets,
    palette,
    frames: frames.map(({ i, t, kind, sheet, cell }) => ({ i, t, kind, sheet, cell })),
  };
  fs.writeFileSync(path.join(p.reference, 'frames.json'), JSON.stringify(index, null, 2) + '\n');
  for (const sh of sheets) console.log(`  ${sh.file}  ${(sh.bytes / 1024).toFixed(0)}KB  ${sh.committed ? 'reference/' : 'scratch only'}`);
  return index;
}

// The author session sees only this folder: sheets, the index and the prompt. Nothing from the repo.
export function stageFiles(p, index, promptText) {
  rmrf(p.stage);
  fs.mkdirSync(p.stage, { recursive: true });
  for (const sh of index.sheets) fs.copyFileSync(path.join(p.sheets, sh.file), path.join(p.stage, sh.file));
  fs.writeFileSync(path.join(p.stage, 'frames.json'), JSON.stringify(index, null, 2) + '\n');
  fs.writeFileSync(path.join(p.stage, 'PROMPT.md'), promptText);
}

export function renderPrompt(template, index) {
  return template
    .replaceAll('{{NAME}}', index.name)
    .replaceAll('{{SHEETS}}', index.sheets.map((s) => `- ${s.file} (${s.kind})`).join('\n'));
}

function author(opts, p) {
  const indexFile = path.join(p.reference, 'frames.json');
  if (!fs.existsSync(indexFile)) throw new Error(`no ${indexFile}; run without --author-only first`);
  const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
  for (const sh of index.sheets) {
    if (!fs.existsSync(path.join(p.sheets, sh.file))) throw new Error(`missing sheet ${sh.file} in ${p.sheets}`);
  }
  const template = fs.readFileSync(path.join(HERE, 'author-design-system.md'), 'utf8');
  stageFiles(p, index, renderPrompt(template, index));

  const claude = process.env.DS_CLAUDE_CMD || 'claude';
  console.log(`authoring in ${p.stage} (claude -p, ${opts.model}) ...`);
  const r = run(claude, ['-p', 'Read PROMPT.md in the current directory and do exactly what it says.',
    '--model', opts.model, '--max-turns', String(opts.maxTurns),
    '--output-format', 'json', '--dangerously-skip-permissions',
    '--tools', 'Read,Write,Edit,Glob', '--strict-mcp-config'], { cwd: p.stage, allowFail: true });
  fs.writeFileSync(path.join(p.work, 'author-run.json'), String(r.stdout || '') + String(r.stderr || ''));

  const design = path.join(p.stage, 'DESIGN.md');
  const tokens = path.join(p.stage, 'tokens.json');
  if (!fs.existsSync(design) || !fs.existsSync(tokens)) {
    throw new Error(`author session did not write DESIGN.md + tokens.json (exit ${r.status}); log: ${path.join(p.work, 'author-run.json')}`);
  }
  JSON.parse(fs.readFileSync(tokens, 'utf8'));
  fs.copyFileSync(design, p.design);
  fs.copyFileSync(tokens, p.tokens);
  console.log(`wrote ${p.design}\nwrote ${p.tokens}`);
}

export async function main(argv = process.argv.slice(2)) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    console.error(`${e.message}\n\n${USAGE}`);
    return 2;
  }
  if (opts.help) { console.log(USAGE); return 0; }
  const p = pathsFor(opts.name);
  if (!opts.authorOnly) {
    if (fs.existsSync(p.design) && !opts.force) {
      console.error(`${p.design} exists; pass --force to rebuild`);
      return 1;
    }
    buildReference(opts, p);
  }
  if (opts.author || opts.authorOnly) author(opts, p);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().then((code) => process.exit(code), (e) => { console.error(e.message); process.exit(1); });
}
