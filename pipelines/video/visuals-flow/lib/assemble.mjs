import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { mmss, planRender } from './render.mjs';
import { resolveCues } from './resolve.mjs';

const EPS = 0.05;
export const CANVAS = { w: 1920, h: 1080, fps: 30 };
export const ASSEMBLE_MEDIA_ROOT = process.env.ASSEMBLE_MEDIA_ROOT
  ?? path.join(os.homedir(), 'kb-scratch', 'video', 'visuals-flow');

// Base-track plan: screen segments + replacements (avatar-full spans,
// fullframe graphics), contiguous from 0 to total. Throws on overlap —
// lint-shots E2 guarantees clean data, so overlap means corrupt inputs.
export function planSegments({ resolved, avatarJobs, total }) {
  const repl = [];
  for (const c of resolved.filter((c) => c.placement === 'fullframe')) {
    repl.push({ kind: 'graphic', id: c.id, start: c.start,
      end: Math.min(+(c.start + c.duration).toFixed(3), total) });
  }
  for (const j of avatarJobs.filter((j) => j.kind === 'avatar-full')) {
    repl.push({ kind: 'avatar', id: j.id, start: j.start,
      end: Math.min(j.end, total) });
  }
  repl.sort((a, b) => a.start - b.start);
  for (let i = 1; i < repl.length; i++) {
    if (repl[i].start < repl[i - 1].end - EPS) {
      throw new Error(`overlapping base segments: ${repl[i - 1].id} ends ${repl[i - 1].end}, ${repl[i].id} starts ${repl[i].start}`);
    }
  }
  const segments = [];
  let t = 0;
  let n = 0;
  for (const r of repl) {
    const start = Math.max(r.start, t); // clamp sub-EPS underlap
    if (start > t + EPS) {
      n++;
      segments.push({ kind: 'screen', id: `screen-${String(n).padStart(2, '0')}`, start: t, end: start });
    }
    segments.push({ ...r, start });
    t = Math.max(t, r.end);
  }
  if (total > t + EPS) {
    n++;
    segments.push({ kind: 'screen', id: `screen-${String(n).padStart(2, '0')}`, start: t, end: total });
  }
  return segments;
}

// Committed EDL — doubles as editor documentation.
export function assemblyMd(video, segments, overlays, total, outPath) {
  const seg = segments.map((s) =>
    `| ${mmss(s.start)} | ${mmss(s.end)} | ${s.kind} | ${s.id} |`);
  const ov = overlays.map((o) =>
    `| ${mmss(o.start)} | ${mmss(o.end)} | ${path.basename(o.file)} |`);
  return [
    `# ${video} — assembly`,
    '',
    `Master timeline = voiceover (${total.toFixed(1)}s starts at 00:00.0; any editor-timeline offset is NOT applied here). Audio: vo.mp3 throughout — screen and avatar audio muted. Hard cuts, no transitions.`,
    '',
    `Output: ${outPath}`,
    '',
    '## Base track',
    '',
    '| from | to | source | id |',
    '|---|---|---|---|',
    ...seg,
    '',
    '## Overlays (composited on top)',
    '',
    '| at | until | file |',
    '|---|---|---|',
    ...ov,
    '',
  ].join('\n');
}

function parseArgs(argv) {
  const opts = { workdir: null, screen: null, screenOffset: 0, out: null, keepTemp: false, force: false };
  const rest = [...argv];
  opts.workdir = rest.shift();
  while (rest.length) {
    const a = rest.shift();
    if (a === '--screen') opts.screen = rest.shift();
    else if (a === '--screen-offset') opts.screenOffset = parseFloat(rest.shift());
    else if (a === '--out') opts.out = rest.shift();
    else if (a === '--keep-temp') opts.keepTemp = true;
    else if (a === '--force') opts.force = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  return opts;
}

function resolveWorkdir(arg) {
  if (arg.includes('/') || fs.existsSync(arg)) return path.resolve(arg);
  const pipelineRoot = path.resolve(import.meta.dirname, '..');
  return path.join(pipelineRoot, 'videos', arg);
}

export function runAssembly({ workdir, video = 'it', resolved, avatarJobs, total, screen, screenOffset = 0, out, keepTemp = false }) {
  const segments = planSegments({ resolved, avatarJobs, total });
  const renderDir = path.join(workdir, 'renders');
  const overlays = resolved.filter(c => c.placement === 'overlay').map(c => {
    return { id: c.id, start: c.start, end: c.start + c.duration, file: path.join(renderDir, planRender(c).outFile) };
  });

  const tmpDir = path.join(workdir, 'assembly-tmp');
  fs.mkdirSync(tmpDir, { recursive: true });

  const VF = `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p`;

  const concatLines = [];
  let segIndex = 1;
  for (const seg of segments) {
    const segFileStr = `seg-${String(segIndex).padStart(3, '0')}-${seg.id}.ts`;
    const segFile = path.join(tmpDir, segFileStr);
    concatLines.push(`file '${segFileStr}'`);
    segIndex++;

    const dur = seg.end - seg.start;
    let spawnArgs = [];
    if (seg.kind === 'screen') {
      spawnArgs = [
        '-y', '-ss', String(seg.start + screenOffset), '-to', String(seg.end + screenOffset),
        '-i', screen, '-vf', `${VF},tpad=stop_mode=clone:stop_duration=30`,
        '-t', String(dur), '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-f', 'mpegts', segFile
      ];
    } else if (seg.kind === 'avatar') {
      const job = avatarJobs.find(j => j.id === seg.id);
      spawnArgs = [
        '-y', '-i', job.file, '-vf', `${VF},tpad=stop_mode=clone:stop_duration=30`,
        '-t', String(dur), '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-f', 'mpegts', segFile
      ];
    } else if (seg.kind === 'graphic') {
      const cue = resolved.find(c => c.id === seg.id);
      const clipFile = path.join(renderDir, planRender(cue).outFile);
      spawnArgs = [
        '-y', '-i', clipFile, '-vf', `${VF},tpad=stop_mode=clone:stop_duration=30`,
        '-t', String(dur), '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-f', 'mpegts', segFile
      ];
    }

    const res = spawnSync('ffmpeg', spawnArgs, { encoding: 'utf8' });
    if (res.status !== 0) {
      console.error(res.stderr);
      process.exit(1);
    }
  }

  fs.writeFileSync(path.join(tmpDir, 'concat.txt'), concatLines.join('\n') + '\n');
  const baseRes = spawnSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c', 'copy', 'base.mp4'], { cwd: tmpDir, encoding: 'utf8' });
  if (baseRes.status !== 0) {
    console.error(baseRes.stderr);
    process.exit(1);
  }

  const finalArgs = ['-y', '-i', path.join(tmpDir, 'base.mp4')];
  overlays.sort((a, b) => a.start - b.start);
  for (const o of overlays) {
    finalArgs.push('-itsoffset', String(o.start), '-i', o.file);
  }
  finalArgs.push('-i', path.join(workdir, 'vo.mp3'));

  if (overlays.length > 0) {
    let filterComplex = '';
    let lastV = '0:v';
    for (let i = 0; i < overlays.length; i++) {
      const o = overlays[i];
      const nextV = `v${i + 1}`;
      filterComplex += `[${lastV}][${i + 1}:v]overlay=eof_action=pass:enable='between(t,${o.start},${o.end})'[${nextV}];`;
      lastV = nextV;
    }
    filterComplex = filterComplex.slice(0, -1);
    finalArgs.push('-filter_complex', filterComplex);
    finalArgs.push('-map', `[${lastV}]`, '-map', `${overlays.length + 1}:a`);
  } else {
    finalArgs.push('-map', '0:v', '-map', '1:a');
  }

  fs.mkdirSync(path.dirname(out), { recursive: true });

  finalArgs.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-t', String(total), '-movflags', '+faststart', out);
  
  const finalRes = spawnSync('ffmpeg', finalArgs, { encoding: 'utf8' });
  if (finalRes.status !== 0) {
    console.error(finalRes.stderr);
    process.exit(1);
  }

  const probeRes = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out], { encoding: 'utf8' });
  const actualTotal = parseFloat(probeRes.stdout);
  if (Math.abs(actualTotal - total) > 0.5) {
    console.error(`mismatched duration: ${actualTotal} != ${total}`);
    process.exit(1);
  }

  const streamProbe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', out], { encoding: 'utf8' });
  if (streamProbe.stdout.trim() !== '1920x1080') {
    console.error(`mismatched video resolution: ${streamProbe.stdout.trim()} != 1920x1080`);
    process.exit(1);
  }

  const audioProbe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', out], { encoding: 'utf8' });
  if (!audioProbe.stdout.includes('audio')) {
    console.error('mismatched audio: missing audio stream');
    process.exit(1);
  }

  const assemblyMdContent = assemblyMd(video, segments, overlays, total, out);
  fs.writeFileSync(path.join(workdir, 'assembly.md'), assemblyMdContent);

  if (!keepTemp) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log(`assembled: ${out} (${mmss(total)})`);
  return;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.workdir) {
    console.error('usage: node lib/assemble.mjs <slug-or-path> [--screen <path>] [--screen-offset <sec>] [--out <path>] [--keep-temp] [--force]');
    process.exit(1);
  }
  const workdir = resolveWorkdir(opts.workdir);
  const cuesPath = path.join(workdir, 'cues.json');
  
  const cuesFile = JSON.parse(fs.readFileSync(cuesPath, 'utf8'));
  if (cuesFile.approved !== true && !opts.force) {
    console.error('refusing to render: cues.json approved=false — review on the board (node lib/board.mjs <slug>) or pass --force');
    process.exit(1);
  }

  const resolvedPath = path.join(workdir, 'resolved.json');
  const { video, resolved } = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));

  const cardLibraryRoot = path.resolve(import.meta.dirname, '..', '..', 'card-library');
  const words = JSON.parse(fs.readFileSync(path.join(workdir, 'transcript.json'), 'utf8'));
  const catalog = JSON.parse(fs.readFileSync(path.join(cardLibraryRoot, 'catalog.json'), 'utf8'));
  const recomputed = resolveCues(cuesFile.cues, words, catalog, cardLibraryRoot);
  const fresh = recomputed.errors.length === 0
    && JSON.stringify(recomputed.resolved) === JSON.stringify(resolved);
  if (!fresh && !opts.force) {
    console.error('resolved.json is stale or cues.json no longer resolves — re-run node lib/resolve.mjs <slug>');
    process.exit(1);
  }

  const shotsPath = path.join(workdir, 'shots.json');
  const avatarJobsPath = path.join(workdir, 'avatar-jobs.json');
  let avatarJobs = [];
  if (fs.existsSync(shotsPath)) {
    const shotsFile = JSON.parse(fs.readFileSync(shotsPath, 'utf8'));
    if (shotsFile.approved !== true && !opts.force) {
      console.error('shots.json approved=false');
      process.exit(1);
    }
    if (!fs.existsSync(avatarJobsPath)) {
      console.error('run "download the avatar videos" first');
      process.exit(1);
    }
    const avatarJobsFile = JSON.parse(fs.readFileSync(avatarJobsPath, 'utf8'));
    avatarJobs = avatarJobsFile.jobs.filter(j => j.kind === 'avatar-full');
    const missing = avatarJobs.filter(j => !j.file || !fs.existsSync(j.file));
    if (missing.length > 0) {
      const missingIds = missing.map(j => j.id).join(', ');
      console.error(`run "download the avatar videos" first. missing: ${missingIds}`);
      process.exit(1);
    }
  }

  const voPath = path.join(workdir, 'vo.mp3');
  const screen = opts.screen ?? path.join(workdir, 'screen.mp4');
  if (!fs.existsSync(voPath)) {
    console.error(`missing file: ${voPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(screen)) {
    console.error(`missing file: ${screen}`);
    process.exit(1);
  }

  const renderDir = path.join(workdir, 'renders');
  const missingRenders = resolved.filter(c => !fs.existsSync(path.join(renderDir, planRender(c).outFile)));
  if (missingRenders.length > 0) {
    const missingIds = missingRenders.map(c => c.id).join(', ');
    console.error(`run node lib/render.mjs first. missing renders: ${missingIds}`);
    process.exit(1);
  }

  const probeVo = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', voPath], { encoding: 'utf8' });
  const total = parseFloat(probeVo.stdout);

  const probeScreen = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', screen], { encoding: 'utf8' });
  const screenDuration = parseFloat(probeScreen.stdout);
  const segments = planSegments({ resolved, avatarJobs, total });
  const lastScreen = segments.findLast(s => s.kind === 'screen');
  if (lastScreen && screenDuration + opts.screenOffset < lastScreen.end - 2.0) {
    console.warn('warning: screen source duration + offset is more than 2s short of the last screen segment end');
  }

  const out = opts.out ?? path.join(ASSEMBLE_MEDIA_ROOT, video, 'final.mp4');
  runAssembly({ workdir, video, resolved, avatarJobs, total, screen, screenOffset: opts.screenOffset, out, keepTemp: opts.keepTemp });
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
