#!/usr/bin/env node
/* measure-durations.mjs — step 060. Measure each trimmed VO clip and emit the
   timing manifest that scene durations flow from. Run from project root:
     node lib/measure-durations.mjs --video <slug>
   Reads videos/<slug>/audio/beatNN.trim.wav (falls back to beatNN.wav).
   Writes videos/<slug>/durations.json = [{ "n": N, "dur": <seconds> }].  */
import { readdirSync, existsSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const a = process.argv.slice(2);
const vi = a.indexOf('--video');
const VIDEO = vi >= 0 ? a[vi + 1] : 'test';
const audioDir = join(ROOT, 'videos', VIDEO, 'audio');
if (!existsSync(audioDir)) { console.error(`no audio dir: videos/${VIDEO}/audio`); process.exit(2); }

// prefer *.trim.wav; fall back to raw beatNN.wav when a trimmed one is absent
const all = readdirSync(audioDir).filter((f) => /^beat\d+(\.trim)?\.wav$/.test(f));
const byBeat = new Map();
for (const f of all) {
  const n = Number(f.match(/beat(\d+)/)[1]);
  const isTrim = f.includes('.trim.');
  if (!byBeat.has(n) || isTrim) byBeat.set(n, f); // trim wins
}
if (!byBeat.size) { console.error('no beat*.wav files found'); process.exit(2); }

const rows = [...byBeat.keys()].sort((x, y) => x - y).map((n) => {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', join(audioDir, byBeat.get(n))], { encoding: 'utf8' });
  return { n, dur: Number(parseFloat(out).toFixed(2)) };
});
const outPath = join(ROOT, 'videos', VIDEO, 'durations.json');
writeFileSync(outPath, JSON.stringify(rows, null, 2) + '\n');
const total = rows.reduce((s, r) => s + r.dur, 0).toFixed(1);
console.log(`wrote videos/${VIDEO}/durations.json — ${rows.length} beats, ${total}s total`);
