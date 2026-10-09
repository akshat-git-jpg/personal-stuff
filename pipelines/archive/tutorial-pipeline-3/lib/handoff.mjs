import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import url from 'node:url';
import { parseArgs } from 'node:util';
import { run } from './exec.mjs';
import { durationOf } from './ffmeta.mjs';
import { planTimeline, GAP_S } from './concat-plan.mjs';

export async function handoff(slug, opts = {}) {
  const root = opts.root || '.';
  const outDir = opts.out || path.join(root, '..', '..', 'video', 'visuals-flow', 'videos', slug);
  const runner = opts.runner || run;

  const reportPath = path.join(root, 'videos', slug, 'intake-report.md');
  const reportMd = await fs.readFile(reportPath, 'utf8');
  const lines = reportMd.trim().split('\n');
  const lastLine = lines[lines.length - 1];
  if (!lastLine.startsWith('RESULT: PASS')) {
    throw new Error(`intake-report.md does not end with RESULT: PASS`);
  }

  const scriptPath = path.join(root, 'videos', slug, 'script.json');
  const script = JSON.parse(await fs.readFile(scriptPath, 'utf8'));

  const audioDir = path.join(root, 'videos', slug, 'audio');
  const recDir = path.join(root, 'videos', slug, 'recordings');
  await fs.mkdir(outDir, { recursive: true });

  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'handoff-'));
  
  try {
    const audioDur = {};
    const clips = {};
    let recFiles = [];
    try {
      recFiles = await fs.readdir(recDir);
    } catch(e) {}

    for (const sec of script.sections) {
      const wavPath = path.join(audioDir, `${sec.id}.wav`);
      audioDur[sec.id] = await durationOf(wavPath, runner);

      if (sec.demo) {
        const match = recFiles.find(f => f.match(new RegExp(`^${sec.id}\\.(mp4|mov)$`)));
        if (match) clips[sec.id] = path.join(recDir, match);
      }
    }

    const { audio, video } = planTimeline(script.sections, audioDur, clips);

    // Audio
    const gapPath = path.join(tmpdir, 'gap.wav');
    await runner('ffmpeg', [
      '-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', GAP_S.toString(), gapPath
    ]);

    let audioConcatContent = '';
    for (const a of audio) {
      const inWav = path.join(audioDir, `${a.id}.wav`);
      const normWav = path.join(tmpdir, `${a.id}_norm.wav`);
      await runner('ffmpeg', [
        '-y', '-i', inWav, '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', normWav
      ]);
      audioConcatContent += `file '${normWav}'\n`;
      if (a.gapAfter > 0) {
        audioConcatContent += `file '${gapPath}'\n`;
      }
    }

    const audioConcatList = path.join(tmpdir, 'audio_concat.txt');
    await fs.writeFile(audioConcatList, audioConcatContent);

    const voMp3 = path.join(outDir, 'vo.mp3');
    await runner('ffmpeg', [
      '-y', '-f', 'concat', '-safe', '0', '-i', audioConcatList, '-c:a', 'libmp3lame', '-q:a', '2', voMp3
    ]);

    // Video
    let videoConcatContent = '';
    let totalDuration = 0;

    for (const v of video) {
      totalDuration += v.span;
      const segOut = path.join(tmpdir, `seg_${v.id}.mp4`);
      const vf = 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30';

      if (v.source.type === 'clip') {
        const vDur = await durationOf(v.source.path, runner);
        const deficit = Math.max(0, v.span - vDur);
        
        await runner('ffmpeg', [
          '-y', '-i', v.source.path,
          '-t', v.span.toString(),
          '-vf', `${vf},tpad=stop_mode=clone:stop_duration=${deficit}`,
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-an',
          segOut
        ]);
      } else {
        const framePng = path.join(tmpdir, `frame_${v.id}.png`);
        if (v.source.frame === 'last') {
          await runner('ffmpeg', [
            '-y', '-sseof', '-0.1', '-i', v.source.clipPath, '-frames:v', '1', framePng
          ]);
        } else {
          await runner('ffmpeg', [
            '-y', '-i', v.source.clipPath, '-frames:v', '1', framePng
          ]);
        }
        
        await runner('ffmpeg', [
          '-y', '-loop', '1', '-t', v.span.toString(), '-i', framePng,
          '-vf', vf,
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-an',
          segOut
        ]);
      }
      
      videoConcatContent += `file '${segOut}'\n`;
    }

    const videoConcatList = path.join(tmpdir, 'video_concat.txt');
    await fs.writeFile(videoConcatList, videoConcatContent);

    const screenMp4 = path.join(outDir, 'screen.mp4');
    await runner('ffmpeg', [
      '-y', '-f', 'concat', '-safe', '0', '-i', videoConcatList, '-c', 'copy', screenMp4
    ]);

    console.log(`vo.mp3: ${voMp3}`);
    console.log(`screen.mp4: ${screenMp4}`);
    console.log(`total duration: ${totalDuration.toFixed(3)}s`);

  } finally {
    await fs.rm(tmpdir, { recursive: true, force: true });
  }
}

const isMain = typeof process !== 'undefined' && import.meta.url.startsWith('file:') && url.fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      root: { type: 'string', short: 'd' },
      out: { type: 'string' }
    },
    allowPositionals: true
  });
  
  if (positionals.length === 0) {
    console.error("Usage: node lib/handoff.mjs <slug> [--root d] [--out <dir>]");
    process.exit(1);
  }

  const slug = positionals[0];
  const root = values.root || '.';
  try {
    await handoff(slug, { root, out: values.out });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
