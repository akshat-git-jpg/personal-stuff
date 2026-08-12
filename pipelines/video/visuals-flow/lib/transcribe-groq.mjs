// Groq fast-path transcription: vo.mp3 -> transcript.json (word-level timestamps)
// Same output contract as `npx hyperframes transcribe` (flat [{text,start,end}]),
// ~30-60s for a 30-min VO vs ~8 min local. Step 010's run.sh calls this when
// GROQ_API_KEY is set and falls back to local whisper when it fails.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { resolveWorkdir } from './workdir.mjs';
import { pathToFileURL } from 'node:url';

// Exported so the guard is unit-testable without an API call. Mutates `words`
// in place (clamping) and returns the verdict.
export function clampAndJudge(words) {
  let clamped = 0;
  let displaced = 0;
  let worstOverlap = 0;
  for (let i = 1; i < words.length; i++) {
    const overlap = words[i - 1].start - words[i].start;
    if (overlap <= 0) continue;
    if (overlap > worstOverlap) worstOverlap = overlap;
    if (overlap <= 1.0) {
      words[i].start = words[i - 1].start;
      if (words[i].end < words[i].start) words[i].end = words[i].start;
      clamped++;
      displaced += overlap;
    }
  }
  const runtime = words.length ? words[words.length - 1].end - words[0].start : 0;
  const displacedShare = runtime > 0 ? displaced / runtime : 0;
  const poisoned = worstOverlap > 1.0 || displacedShare > 0.02;
  return { clamped, displaced, worstOverlap, displacedShare, poisoned };
}

const MODEL = 'whisper-large-v3-turbo';


async function main() {
  const args = process.argv.slice(2);
  const workdirArg = args[0];
  if (!workdirArg) {
    console.error('usage: node lib/transcribe-groq.mjs <slug-or-path> [--out <file>]');
    process.exit(1);
  }
  const outFlag = args.indexOf('--out');
  if (outFlag !== -1 && !args[outFlag + 1]) {
    console.error('--out needs a file path');
    process.exit(1);
  }
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
  // whisper-large-v3-turbo word timestamps carry occasional small jitter: a word
  // starting slightly BEFORE its predecessor (test-02: 61 of 5543 words, all
  // ≤0.52s). That is noise, not poison — clamp it.
  //
  // Poison is a timeline that cannot be TRUSTED, which is a question of
  // magnitude, not of how many small jitters occurred. The old guard capped the
  // COUNT at 2% of words and rejected a good transcript at 129/5974 = 2.16% —
  // by nine words. The fallback to local small.en then burned four wrong words
  // onto screen as captions (best-ai-video-generator, 2026-08-02). Every one of
  // those 129 was inside the ≤1.0s window this loop already absorbs.
  //
  // So measure the damage instead: the worst single backwards jump, and the
  // share of total runtime displaced by all of them.
  const { clamped, displaced, worstOverlap, displacedShare, poisoned } = clampAndJudge(words);
  if (poisoned) {
    console.error(
      `transcript rejected: worst backwards jump ${worstOverlap.toFixed(2)}s, ` +
      `${(displacedShare * 100).toFixed(2)}% of runtime displaced across ${clamped} clamped word(s) ` +
      `— timestamps look poisoned`
    );
    process.exit(1);
  }
  let prevStart = -Infinity;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const bad =
      typeof w.start !== 'number' || typeof w.end !== 'number' ||
      !Number.isFinite(w.start) || !Number.isFinite(w.end) ||
      w.start < 0 || w.end < w.start || w.start < prevStart;
    if (bad) {
      console.error(`transcript rejected: word[${i}] has invalid timing (start=${w.start}, end=${w.end}, prevStart=${prevStart})`);
      process.exit(1);
    }
    prevStart = w.start;
  }
  fs.writeFileSync(outPath, JSON.stringify(words));
  console.log(JSON.stringify({ ok: true, engine: 'groq', model: MODEL, wordCount: words.length, clampedWords: clamped, displacedShare: +displacedShare.toFixed(5), worstOverlap: +worstOverlap.toFixed(3), durationSeconds: words[words.length - 1].end, transcriptPath: outPath }));
}

// pathToFileURL, not `file://${argv[1]}`: on Windows argv[1] is a backslash
// path, so naive string concatenation never matches import.meta.url.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
