import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveWorkdir } from './workdir.mjs';

const MODEL = 'whisper-large-v3-turbo';

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('usage: node lib/transcript-second-opinion.mjs <slug-or-path>');
    process.exit(1);
  }
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    process.exit(2);
  }
  const ffmpegCheck = spawnSync('ffmpeg', ['-version']);
  if (ffmpegCheck.error) {
    process.exit(2);
  }

  const workdir = resolveWorkdir(arg);

  const diffPath = path.join(workdir, 'transcript.diff.json');
  if (!fs.existsSync(diffPath)) {
    console.error('run.sh <slug> clean-transcript  (before any anchor exists — anchors quote the transcript verbatim)');
    process.exit(1);
  }
  const diffData = JSON.parse(fs.readFileSync(diffPath, 'utf8'));

  const suspectsPath = path.join(workdir, 'transcript-suspects.json');
  if (!fs.existsSync(suspectsPath)) {
    process.exit(0);
  }
  const suspects = JSON.parse(fs.readFileSync(suspectsPath, 'utf8'));
  if (suspects.length === 0) {
    process.exit(0);
  }
  
  const transcriptPath = path.join(workdir, 'transcript.json');
  const words = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));
  const duration = words.length ? words[words.length - 1].end : 0;

  const windows = [];
  for (const s of suspects) {
    const start = Math.max(0, s.at - 7);
    const end = Math.min(duration, s.at + 7);
    if (windows.length > 0 && start <= windows[windows.length - 1].end) {
      windows[windows.length - 1].end = Math.max(windows[windows.length - 1].end, end);
      windows[windows.length - 1].suspects.push(s);
    } else {
      windows.push({ start, end, suspects: [s] });
    }
  }

  const voPath = path.join(workdir, 'vo.mp3');
  for (const w of windows) {
    const len = w.end - w.start;
    const tmpFile = path.join(workdir, `tmp-window-${w.start.toFixed(2)}.mp3`);
    spawnSync('ffmpeg', ['-v', 'error', '-ss', w.start.toString(), '-t', len.toString(), '-i', voPath, '-ar', '16000', '-ac', '1', '-b:a', '32k', tmpFile, '-y']);
    
    const form = new FormData();
    form.append('file', new Blob([fs.readFileSync(tmpFile)], { type: 'audio/mpeg' }), 'vo.mp3');
    form.append('model', MODEL);
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'word');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    fs.unlinkSync(tmpFile);
    
    let turboText = '';
    if (res.ok) {
      const data = await res.json();
      turboText = data.text || '';
    } else {
      turboText = '<api error>';
    }
    
    for (const s of w.suspects) {
      const localWords = words.filter(word => word.start >= w.start && word.end <= w.end).map(word => word.text).join(' ');
      const diff = localWords !== turboText ? 'YES' : 'NO';
      console.log(`${s.text} | Local: ${localWords} | Turbo: ${turboText} | Differs: ${diff}`);
      s.secondOpinion = `${s.text} | Local: ${localWords} | Turbo: ${turboText} | Differs: ${diff}`;
    }
  }

  diffData.suspects = suspects;
  fs.writeFileSync(diffPath, JSON.stringify(diffData, null, 2) + '\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
