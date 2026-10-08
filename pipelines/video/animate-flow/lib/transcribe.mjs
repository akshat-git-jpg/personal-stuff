// 020: word-level transcript. Reuses the Groq transcriber's CLI as-is; local whisper is the fallback.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { TRANSCRIBE_GROQ, workdirOf, mediaDirOf, writeJson } from './paths.mjs';
import { readRunConfig } from './run-config.mjs';
import { HYPERFRAMES, npxArgs, npxSpawnOpts } from './kit.mjs';

export function transcribe(slug) {
  const workdir = workdirOf(slug);
  readRunConfig(workdir);
  const media = mediaDirOf(slug);
  if (!fs.existsSync(path.join(media, 'vo.mp3'))) throw new Error(`missing ${path.join(media, 'vo.mp3')}: run intake first`);
  const out = path.join(workdir, 'transcript.json');
  let engine = null;
  if (process.env.GROQ_API_KEY) {
    const r = spawnSync(process.execPath, [TRANSCRIBE_GROQ, media, '--out', out], { stdio: 'inherit' });
    if (r.status === 0) engine = { engine: 'groq', model: 'whisper-large-v3-turbo' };
    else console.error('groq transcription failed; falling back to local whisper');
  } else {
    console.error('GROQ_API_KEY not set; using local whisper (slower, weaker on product names)');
  }
  if (!engine) {
    const r = spawnSync('npx', npxArgs(['-y', HYPERFRAMES, 'transcribe', 'vo.mp3', '--json', '-m', 'small.en']), npxSpawnOpts({ cwd: media, stdio: 'inherit' }));
    if (r.status !== 0) throw new Error('local whisper failed too');
    fs.copyFileSync(path.join(media, 'transcript.json'), out);
    engine = { engine: 'whisper', model: 'small.en' };
  }
  const words = JSON.parse(fs.readFileSync(out, 'utf8'));
  if (!Array.isArray(words) || !words.length) throw new Error('transcript has no words');
  writeJson(path.join(workdir, 'transcript-meta.json'), { ...engine, words: words.length, createdAt: new Date().toISOString() });
  return { words: words.length, ...engine };
}
