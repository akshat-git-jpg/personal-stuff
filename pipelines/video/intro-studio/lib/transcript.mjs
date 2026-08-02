import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveWorkdir } from './workdir.mjs';

const HYPERFRAMES = process.env.HYPERFRAMES_VERSION ? `hyperframes@${process.env.HYPERFRAMES_VERSION}` : 'hyperframes@0.7.62';

// The transcript contract, shared with the rest of the repo:
// a flat array of { text, start, end }, one entry per WORD, times in seconds.
export function validateTranscript(words) {
  const errs = [];
  if (!Array.isArray(words)) return ['transcript is not an array'];
  if (words.length === 0) errs.push('transcript is empty');
  words.forEach((w, i) => {
    if (typeof w?.text !== 'string' || !w.text.length) errs.push(`word ${i}: missing text`);
    if (!Number.isFinite(w?.start) || !Number.isFinite(w?.end)) errs.push(`word ${i}: non-numeric start/end`);
    else if (w.end < w.start) errs.push(`word ${i}: end before start`);
    if (i > 0 && Number.isFinite(w?.start) && Number.isFinite(words[i - 1]?.start) && w.start < words[i - 1].start - 0.001) {
      errs.push(`word ${i}: start goes backwards`);
    }
  });
  return errs;
}

export function transcriptText(words) {
  return words.map((w) => w.text).join(' ').replace(/\s+/g, ' ').trim();
}

export function runTranscribe(slug) {
  const workdir = resolveWorkdir(slug);
  const vo = path.join(workdir, 'vo.mp3');
  if (!fs.existsSync(vo)) throw new Error(`missing ${vo} — run the intake step first`);
  const out = path.join(workdir, 'transcript.json');
  const r = spawnSync('npx', ['-y', HYPERFRAMES, 'transcribe', vo, '--output', out], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`transcribe failed (exit ${r.status})`);
  const words = JSON.parse(fs.readFileSync(out, 'utf8'));
  const errs = validateTranscript(words);
  if (errs.length) throw new Error(`transcript failed validation:\n  ${errs.slice(0, 10).join('\n  ')}`);
  return words;
}
