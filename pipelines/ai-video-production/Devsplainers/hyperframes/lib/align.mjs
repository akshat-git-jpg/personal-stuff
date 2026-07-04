#!/usr/bin/env node
// align.mjs — the single source of truth for per-scene A/V timing.
// For each rendered scene it pairs the silent scene MP4 with its VO clip and sets
//   T = max(video_len, vo_len)
// so the video track and audio track are cut to the SAME per-scene length. Both the
// stitch step (190) and the concat-vo step (200) read this, so they can never drift.
//
// In:  videos/<slug>/renders/scenes/sNN-*.mp4  +  videos/<slug>/audio/beatNN.trim.wav
// Out: writes videos/<slug>/renders/align.json AND prints one TSV row per scene:
//        n <TAB> mp4 <TAB> wav <TAB> video_len <TAB> vo_len <TAB> T
//
// Usage: node lib/align.mjs --video <slug>
import { readdirSync, existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HF = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const slug = args[args.indexOf('--video') + 1];
if (!slug || slug.startsWith('--')) { console.error('align: --video <slug> required'); process.exit(2); }

const vdir = join(HF, 'videos', slug);
const scnDir = join(vdir, 'renders', 'scenes');
const audDir = join(vdir, 'audio');
if (!existsSync(scnDir)) { console.error(`align: no per-scene renders: ${scnDir} (run step 180 first)`); process.exit(2); }

const probe = (f) => {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]);
  const d = parseFloat(String(r.stdout).trim());
  return Number.isFinite(d) ? d : 0;
};

const mp4s = readdirSync(scnDir).filter((f) => /^s\d+.*\.mp4$/.test(f)).sort();
if (mp4s.length === 0) { console.error('align: no scene mp4s found'); process.exit(1); }

const plan = [];
for (const mp4 of mp4s) {
  const n = parseInt(basename(mp4).match(/^s(\d+)/)[1], 10);
  const pad = String(n).padStart(2, '0');
  let wav = join(audDir, `beat${pad}.trim.wav`);
  if (!existsSync(wav)) wav = join(audDir, `beat${pad}.wav`);
  const mp4Abs = join(scnDir, mp4);
  const video = probe(mp4Abs);
  const vo = existsSync(wav) ? probe(wav) : 0;         // no VO → silence for the scene
  const T = Math.max(video, vo);
  plan.push({ n, mp4: mp4Abs, wav: existsSync(wav) ? wav : '', video: +video.toFixed(3), vo: +vo.toFixed(3), T: +T.toFixed(3) });
}

writeFileSync(join(vdir, 'renders', 'align.json'), JSON.stringify(plan, null, 2) + '\n');
// stderr summary (won't pollute the TSV on stdout)
const total = plan.reduce((a, p) => a + p.T, 0);
console.error(`align: ${plan.length} scenes, total ${total.toFixed(2)}s  (freeze-extended: ${plan.filter(p => p.T - p.video > 0.05).length})`);
for (const p of plan) process.stdout.write(`${p.n}\t${p.mp4}\t${p.wav}\t${p.video}\t${p.vo}\t${p.T}\n`);
