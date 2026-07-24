import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveWorkdir } from '../workdir.mjs';

export function buildMixArgs({ voPath, instances, musicPath, total, outPath, workdir }) {
  let args = ['-y', '-hide_banner', '-loglevel', 'error'];
  
  args.push('-i', voPath);
  let inputIdx = 1;
  
  let hasMusic = !!musicPath;
  if (hasMusic) {
    args.push('-stream_loop', '-1', '-i', musicPath);
    inputIdx++;
  }

  let sfxStartIndex = inputIdx;
  for (const inst of instances) {
    if (inst.loop) {
      args.push('-stream_loop', '-1');
    }
    args.push('-i', `assets/sfx/${inst.sample}.wav`);
    inputIdx++;
  }

  let fg = [];

  // 1. VO
  fg.push(`[0:a] highpass=f=80, acompressor=threshold=-18dB:ratio=3:attack=15:release=200, alimiter=limit=0.95 [vob_raw]`);
  
  let voMixPad = '[vob_raw]';
  if (hasMusic) {
    fg.push(`[vob_raw] asplit=2 [vob_sc][vob_mix]`);
    voMixPad = '[vob_mix]';
    
    fg.push(`[1:a] atrim=0:${total}, afade=t=in:d=1.5, afade=t=out:st=${Math.max(0, total - 2)}:d=2 [musraw]`);
    fg.push(`[musraw][vob_sc] sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400 [musb_raw]`);
    fg.push(`[musb_raw] asplit=2 [musb_mix][musb_out]`);
  }

  // 2. SFX
  let sfxOuts = [];
  instances.forEach((inst, i) => {
    let pad = `[${sfxStartIndex + i}:a]`;
    let chain = [];
    
    let ms = Math.floor(inst.at * 1000);
    chain.push(`adelay=delays=${ms}:all=1`);
    
    if (inst.semi !== 0) {
      const rate = Math.round(48000 * Math.pow(2, inst.semi / 12));
      const tempo = Math.pow(2, -inst.semi / 12);
      chain.push(`asetrate=${rate},aresample=48000,atempo=${tempo.toFixed(4)}`);
    }

    if (inst.loop && inst.end) {
      const len = inst.end - inst.at;
      chain.push(`atrim=0:${len},afade=t=in:d=0.5,afade=t=out:st=${Math.max(0, len - 0.5)}:d=0.5`);
    }
    
    chain.push(`volume=${inst.gainDb}dB`);
    
    fg.push(`${pad} ${chain.join(', ')} [sfx_${i}]`);
    sfxOuts.push(`[sfx_${i}]`);
  });

  if (sfxOuts.length > 0) {
    fg.push(`${sfxOuts.join('')} amix=inputs=${sfxOuts.length}:normalize=0 [sfxb_raw]`);
    fg.push(`[sfxb_raw] asplit=2 [sfxb_mix][sfxb_out]`);
  } else {
    fg.push(`anullsrc=r=48000:cl=stereo [sfxb_raw]`);
    fg.push(`[sfxb_raw] asplit=2 [sfxb_mix][sfxb_out]`);
  }

  // 3. Mix
  let mixInputs = [voMixPad, '[sfxb_mix]'];
  if (hasMusic) mixInputs.push('[musb_mix]');
  
  fg.push(`${mixInputs.join('')} amix=inputs=${mixInputs.length}:normalize=0, loudnorm=I=-14:TP=-1.5:LRA=11 [master]`);

  args.push('-filter_complex', fg.join('; '));
  
  args.push('-map', '[master]', '-ar', '48000', '-ac', '2', outPath);
  
  if (hasMusic) {
    args.push('-map', '[musb_out]', '-ar', '48000', '-ac', '2', path.join(workdir, 'music-ducked.wav'));
  }
  
  args.push('-map', '[sfxb_out]', '-ar', '48000', '-ac', '2', path.join(workdir, 'sfx-bus.wav'));
  
  return args;
}

// Audibility gate: a planned-but-silent SFX bus shipped in test-01 (samples
// were generated ~30 dB too quiet; every LUFS check passed because loudnorm
// only watches the master). If effects were planned, the bus must be audible.
export function sfxBusPeakDb(busPath) {
  const p = spawnSync('ffmpeg', ['-i', busPath, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = (p.stderr || '').match(/max_volume:\s*(-?[\d.]+) dB/);
  return m ? parseFloat(m[1]) : null;
}
export const SFX_BUS_MIN_PEAK_DB = -35;

export function runMix({ voPath, instances, musicPath, total, outPath, workdir }) {
  const args = buildMixArgs({ voPath, instances, musicPath, total, outPath, workdir });

  const child = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (child.status !== 0) {
    console.error(`ffmpeg failed with status ${child.status}`);
    process.exit(1);
  }

  if (instances.length > 0) {
    const peak = sfxBusPeakDb(path.join(workdir, 'sfx-bus.wav'));
    if (peak === null || peak < SFX_BUS_MIN_PEAK_DB) {
      console.error(`SFX bus is inaudible (peak ${peak ?? 'unreadable'} dB < ${SFX_BUS_MIN_PEAK_DB} dB) with ${instances.length} planned effects — regenerate the kit (scripts/gen-sfx-kit.sh) or check sample gain staging`);
      process.exit(1);
    }
  }

  const probeMix = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', outPath], { encoding: 'utf8' });
  const probeVo = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', voPath], { encoding: 'utf8' });
  
  const mixDur = parseFloat(probeMix.stdout.trim());
  const voDur = parseFloat(probeVo.stdout.trim());
  
  if (Math.abs(mixDur - voDur) > 0.05) {
    console.error(`Frame-exact check failed: mix=${mixDur}, vo=${voDur}`);
    process.exit(1);
  }
}

function main() {
  if (process.argv.length < 3 || !process.argv[1].endsWith('build-mix.mjs')) return;
  const slug = process.argv[2];
  const workdir = resolveWorkdir(slug);

  const soundPath = path.join(workdir, 'sound.json');
  if (!fs.existsSync(soundPath)) {
    console.error('missing sound.json');
    process.exit(1);
  }
  const soundData = JSON.parse(fs.readFileSync(soundPath, 'utf8'));


  const voPath = path.join(workdir, 'vo.mp3');
  const probeVo = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', voPath], { encoding: 'utf8' });
  const total = parseFloat(probeVo.stdout.trim());

  let musicPath = null;
  const videoPath = path.join(workdir, 'video.json');
  if (fs.existsSync(videoPath)) {
    const videoData = JSON.parse(fs.readFileSync(videoPath, 'utf8'));
    if (videoData.music) {
      const candidate = path.join(process.cwd(), 'assets', 'music', `${videoData.music}.mp3`);
      if (fs.existsSync(candidate)) {
        musicPath = candidate;
      }
    }
  }

  const outPath = path.join(workdir, 'master.wav');
  runMix({ 
    voPath, 
    instances: soundData.instances.filter(i => i.enabled !== false), 
    musicPath, 
    total, 
    outPath, 
    workdir 
  });
  console.log(`wrote ${outPath}`);
}

main();
