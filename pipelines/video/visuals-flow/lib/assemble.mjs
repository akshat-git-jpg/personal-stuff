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

// Map each overlay onto the segment(s) it intersects, in segment-local time.
// trimStart = seconds into the overlay clip where this segment's slice begins
// (non-zero only when an overlay crosses a segment boundary).
export function planSegmentOverlays(segments, overlays) {
  return segments.map((seg) => {
    const local = [];
    for (const o of overlays) {
      const s = Math.max(o.start, seg.start);
      const e = Math.min(o.end, seg.end);
      if (e - s > 0.01) {
        local.push({
          id: o.id,
          file: o.file,
          trimStart: +Math.max(seg.start - o.start, 0).toFixed(3),
          at: +(s - seg.start).toFixed(3),
          until: +(e - seg.start).toFixed(3),
        });
      }
    }
    return local;
  });
}

export const TRANSITION_DUR = 0.4;

// Whip transitions at screen<->avatar boundaries. Returns [{at, direction,
// fromIdx, toIdx}] in timeline order. Skips: short neighbors, overlay
// straddle, t=0/t=total edges (planSegments guarantees contiguity, so a
// boundary is simply segments[i].end === segments[i+1].start).
export function planTransitions(segments, overlays, { duration = TRANSITION_DUR } = {}) {
  const half = duration / 2;
  const out = [];
  for (let i = 0; i < segments.length - 1; i++) {
    const a = segments[i], b = segments[i + 1];
    const pair = `${a.kind}>${b.kind}`;
    if (pair !== 'screen>avatar' && pair !== 'avatar>screen') continue;
    if (a.end - a.start < 1.0 || b.end - b.start < 1.0) continue;
    const at = a.end;
    if (overlays.some((o) => o.start < at + half && o.end > at - half)) continue;
    out.push({ at, direction: pair === 'screen>avatar' ? 'left' : 'right', fromIdx: i, toIdx: i + 1 });
  }
  return out;
}

// One settings object per run — every segment MUST use identical encoder
// params so the concat stream-copy is valid.
export function encoderArgs({ encoder, draft }) {
  if (encoder === 'videotoolbox') {
    return ['-c:v', 'h264_videotoolbox', '-b:v', draft ? '4M' : '12M', '-pix_fmt', 'yuv420p'];
  }
  return draft
    ? ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28']
    : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18'];
}

export function detectEncoder() {
  const res = spawnSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8' });
  return (res.stdout || '').includes('h264_videotoolbox') ? 'videotoolbox' : 'x264';
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
  const opts = { workdir: null, screen: null, screenOffset: 0, out: null, draft: false, encoder: null, keepTemp: false, force: false, transitions: 'whip' };
  const rest = [...argv];
  opts.workdir = rest.shift();
  while (rest.length) {
    const a = rest.shift();
    if (a === '--screen') opts.screen = rest.shift();
    else if (a === '--screen-offset') opts.screenOffset = parseFloat(rest.shift());
    else if (a === '--out') opts.out = rest.shift();
    else if (a === '--draft') opts.draft = true;
    else if (a === '--encoder') {
      const e = rest.shift();
      if (e !== 'x264' && e !== 'videotoolbox') throw new Error('--encoder must be x264 or videotoolbox');
      opts.encoder = e;
    }
    else if (a === '--transitions') {
      const t = rest.shift();
      if (t !== 'whip' && t !== 'none') throw new Error('--transitions must be whip or none');
      opts.transitions = t;
    }
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

export function runAssembly({ workdir, video = 'it', resolved, avatarJobs, total, screen, screenOffset = 0, out, draft = false, encoder = detectEncoder(), keepTemp = false, transitions = 'whip' }) {
  const segments = planSegments({ resolved, avatarJobs, total });
  const renderDir = path.join(workdir, 'renders');
  const overlays = resolved.filter(c => c.placement === 'overlay').map(c => {
    return { id: c.id, start: c.start, end: c.start + c.duration, file: path.join(renderDir, planRender(c).outFile) };
  });

  const tmpDir = path.join(workdir, 'assembly-tmp');
  fs.mkdirSync(tmpDir, { recursive: true });

  const { w, h } = draft ? { w: 1280, h: 720 } : { w: CANVAS.w, h: CANVAS.h };
  const VF = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p`;
  const ENC = encoderArgs({ encoder, draft });
  const segOverlays = planSegmentOverlays(segments, overlays);

  const trans = transitions === 'whip' ? planTransitions(segments, overlays) : [];
  const half = TRANSITION_DUR / 2;

  const concatLines = [];
  let segIndex = 1;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const L = segOverlays[i];
    const segFileStr = `seg-${String(segIndex).padStart(3, '0')}-${seg.id}.ts`;
    const segFile = path.join(tmpDir, segFileStr);
    concatLines.push(`file '${segFileStr}'`);
    segIndex++;

    let startTrim = 0;
    let endTrim = 0;
    const tOut = trans.find(t => t.fromIdx === i);
    const tIn = trans.find(t => t.toIdx === i);
    if (tOut) endTrim = half;
    if (tIn) startTrim = half;

    const dur = seg.end - seg.start - startTrim - endTrim;
    let spawnArgs = [];
    let src = '';
    let seekArgs = [];

    if (seg.kind === 'screen') {
      seekArgs = ['-ss', String(seg.start + screenOffset + startTrim), '-to', String(seg.end + screenOffset - endTrim)];
      src = screen;
    } else if (seg.kind === 'avatar') {
      const job = avatarJobs.find(j => j.id === seg.id);
      src = job.file;
      if (startTrim > 0) seekArgs = ['-ss', String(startTrim)];
    } else if (seg.kind === 'graphic') {
      const cue = resolved.find(c => c.id === seg.id);
      src = path.join(renderDir, planRender(cue).outFile);
    }

    if (L && L.length > 0) {
      let chain = `[0:v]${VF},tpad=stop_mode=clone:stop_duration=30[b0];`;
      const inputs = [];
      for (const o of L) inputs.push('-i', o.file);
      
      let lastV = 'b0';
      for (let j = 0; j < L.length; j++) {
        const o = L[j];
        const oj = `o${j}`;
        const nextV = `b${j + 1}`;
        const adjustedAt = +(o.at - startTrim).toFixed(3);
        const adjustedUntil = +(o.until - startTrim).toFixed(3);
        chain += `[${j + 1}:v]trim=start=${o.trimStart},setpts=PTS-STARTPTS+${adjustedAt}/TB,scale=${w}:${h}[${oj}];`;
        chain += `[${lastV}][${oj}]overlay=eof_action=pass:enable='between(t,${adjustedAt},${adjustedUntil})'[${nextV}];`;
        lastV = nextV;
      }
      chain = chain.slice(0, -1); // remove trailing semicolon

      spawnArgs = [
        '-y', ...seekArgs, '-i', src, ...inputs,
        '-filter_complex', chain, '-map', `[${lastV}]`,
        '-t', String(dur), '-an', ...ENC, '-f', 'mpegts', segFile
      ];
    } else {
      spawnArgs = [
        '-y', ...seekArgs, '-i', src,
        '-vf', `${VF},tpad=stop_mode=clone:stop_duration=30`,
        '-t', String(dur), '-an', ...ENC, '-f', 'mpegts', segFile
      ];
    }

    const res = spawnSync('ffmpeg', spawnArgs, { encoding: 'utf8' });
    if (res.status !== 0) {
      console.error(res.stderr);
      process.exit(1);
    }

    if (tOut) {
      const transFileStr = `seg-${String(segIndex).padStart(3, '0')}-trans-${segments[tOut.fromIdx].id}-${segments[tOut.toIdx].id}.ts`;
      const transFile = path.join(tmpDir, transFileStr);
      concatLines.push(`file '${transFileStr}'`);
      segIndex++;

      let sliceA, sliceB;
      const b = tOut.at;
      if (segments[tOut.fromIdx].kind === 'screen') {
        sliceA = ['-ss', String(b - half + screenOffset), '-to', String(b + screenOffset), '-i', screen];
      } else {
        const j = avatarJobs.find(j => j.id === segments[tOut.fromIdx].id);
        sliceA = ['-ss', String(b - half - j.start), '-to', String(b - j.start), '-i', j.file];
      }
      if (segments[tOut.toIdx].kind === 'screen') {
        sliceB = ['-ss', String(b + screenOffset), '-to', String(b + half + screenOffset), '-i', screen];
      } else {
        const j = avatarJobs.find(j => j.id === segments[tOut.toIdx].id);
        sliceB = ['-ss', '0', '-to', String(half), '-i', j.file];
      }

      const chainTrans =
        `[0:v]${VF},tpad=stop_mode=clone:stop_duration=1[a];` +
        `[1:v]${VF},tpad=start_mode=clone:start_duration=${half}[b];` +
        `[a][b]xfade=transition=slide${tOut.direction}:duration=${TRANSITION_DUR}:offset=0[x];` +
        `[x]tmix=frames=3[v]`;
      const spawnArgsTrans = ['-y', ...sliceA, ...sliceB,
        '-filter_complex', chainTrans, '-map', '[v]',
        '-t', String(TRANSITION_DUR), '-an', ...ENC, '-f', 'mpegts', transFile];
      
      const resTrans = spawnSync('ffmpeg', spawnArgsTrans, { encoding: 'utf8' });
      if (resTrans.status !== 0) {
        console.error(resTrans.stderr);
        process.exit(1);
      }
    }
  }

  const voPath = path.join(workdir, 'vo.mp3');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'concat.txt'), concatLines.join('\n') + '\n');
  
  const finalArgs = [
    '-y', '-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-i', path.resolve(voPath),
    '-map', '0:v', '-c:v', 'copy', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k',
    '-t', String(total), '-movflags', '+faststart', out
  ];
  const finalRes = spawnSync('ffmpeg', finalArgs, { cwd: tmpDir, encoding: 'utf8' });
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
  if (streamProbe.stdout.trim() !== `${w}x${h}`) {
    console.error(`mismatched video resolution: ${streamProbe.stdout.trim()} != ${w}x${h}`);
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
    console.error('usage: node lib/assemble.mjs <slug-or-path> [--screen <path>] [--screen-offset <sec>] [--out <path>] [--draft] [--encoder x264|videotoolbox] [--keep-temp] [--force]');
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

  const out = opts.out ?? path.join(ASSEMBLE_MEDIA_ROOT, video, opts.draft ? 'final-draft.mp4' : 'final.mp4');
  runAssembly({ workdir, video, resolved, avatarJobs, total, screen, screenOffset: opts.screenOffset, out, draft: opts.draft, encoder: opts.encoder ?? detectEncoder(), keepTemp: opts.keepTemp, transitions: opts.transitions });
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
