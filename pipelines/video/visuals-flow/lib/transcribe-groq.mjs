// Groq fast-path transcription: vo.mp3 -> transcript.json (word-level timestamps)
// Same output contract as `npx hyperframes transcribe` (flat [{text,start,end}]),
// ~30-60s for a 30-min VO vs ~8 min local. Step 010's run.sh calls this when
// GROQ_API_KEY is set and falls back to local whisper when it fails.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { resolveWorkdir } from './workdir.mjs';

const MODEL = 'whisper-large-v3-turbo';


async function main() {
  const args = process.argv.slice(2);
  const workdirArg = args[0];
  if (!workdirArg) {
    console.error('usage: node lib/transcribe-groq.mjs <slug-or-path> [--out <file>]');
    process.exit(1);
  }
  const outFlag = args.indexOf('--out');
  const workdir = resolveWorkdir(workdirArg);
  const outPath = outFlag !== -1 ? path.resolve(args[outFlag + 1]) : path.join(workdir, 'transcript.json');
  const voPath = path.join(workdir, 'vo.mp3');
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) { console.error('GROQ_API_KEY not set'); process.exit(2); }
  if (!fs.existsSync(voPath)) { console.error(`missing ${voPath}`); process.exit(1); }

  // Groq caps uploads at 25MB; 16kHz mono 32kbps is all whisper needs.
  const small = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'groq-tx-')), 'vo-16k.mp3');
  const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', voPath, '-ac', '1', '-ar', '16000', '-b:a', '32k', small]);
  if (ff.status !== 0) { console.error('ffmpeg downsample failed'); process.exit(1); }

  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(small)], { type: 'audio/mpeg' }), 'vo.mp3');
  form.append('model', MODEL);
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  fs.rmSync(path.dirname(small), { recursive: true, force: true });
  if (!res.ok) {
    console.error(`groq api ${res.status}: ${(await res.text()).slice(0, 300)}`);
    process.exit(3);
  }
  const data = await res.json();
  if (!Array.isArray(data.words) || data.words.length === 0) {
    console.error('groq response has no words[] — cannot build word timestamps');
    process.exit(3);
  }
  const words = data.words.map((w) => ({
    text: String(w.word).trim(),
    start: +(+w.start).toFixed(2),
    end: +(+w.end).toFixed(2),
  }));
  fs.writeFileSync(outPath, JSON.stringify(words));
  console.log(JSON.stringify({ ok: true, engine: 'groq', model: MODEL, wordCount: words.length, durationSeconds: words[words.length - 1].end, transcriptPath: outPath }));
}

main();
