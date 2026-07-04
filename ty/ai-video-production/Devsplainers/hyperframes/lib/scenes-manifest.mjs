#!/usr/bin/env node
// scenes-manifest.mjs — build videos/<slug>/scenes.json deterministically (no LLM).
// Zips the storyboard's scene list with the measured VO durations.
//
// Input:
//   videos/<slug>/storyboard.md   — must contain a fenced ```scenes block, one
//                                    "NN slug" per line (NN = beat/scene number,
//                                    slug = kebab-case scene id). Step 080 emits it.
//   videos/<slug>/durations.json  — [{n,dur}] from step 060 (the timing spine).
//
// Output:
//   videos/<slug>/scenes.json     — [{n,slug,dur}], one per scene, in order.
//
// Usage:  node lib/scenes-manifest.mjs --video <slug>

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HF = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const slug = args[args.indexOf('--video') + 1];
if (!slug || slug.startsWith('--')) { console.error('scenes-manifest: --video <slug> required'); process.exit(1); }

const vdir = join(HF, 'videos', slug);
const sb = readFileSync(join(vdir, 'storyboard.md'), 'utf8');
const durs = JSON.parse(readFileSync(join(vdir, 'durations.json'), 'utf8'));

// pull the ```scenes fenced block
const m = sb.match(/```scenes\s*\n([\s\S]*?)```/);
if (!m) {
  console.error('scenes-manifest: storyboard.md has no ```scenes block.');
  console.error('  Add one in step 080, e.g.:');
  console.error('    ```scenes');
  console.error('    01 hook-sees-hears');
  console.error('    02 eyes-ears-removed');
  console.error('    ```');
  process.exit(1);
}

const rows = m[1].split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
  const mm = l.match(/^(\d+)\s+([a-z0-9][a-z0-9-]*)$/i);
  if (!mm) { console.error(`scenes-manifest: bad scenes line: "${l}" (want "NN slug")`); process.exit(1); }
  return { n: parseInt(mm[1], 10), slug: mm[2].toLowerCase() };
});

const durByN = new Map(durs.map((d) => [d.n, d.dur]));
const scenes = rows.map((r) => {
  if (!durByN.has(r.n)) { console.error(`scenes-manifest: no duration for scene ${r.n} in durations.json`); process.exit(1); }
  return { n: r.n, slug: r.slug, dur: durByN.get(r.n) };
});

if (scenes.length !== durs.length) {
  console.error(`scenes-manifest: WARNING — ${scenes.length} scenes vs ${durs.length} durations (a beat was dropped/merged upstream).`);
}

writeFileSync(join(vdir, 'scenes.json'), JSON.stringify(scenes, null, 2) + '\n');
console.log(`wrote videos/${slug}/scenes.json — ${scenes.length} scenes, ${scenes.reduce((a, s) => a + s.dur, 0).toFixed(1)}s total`);
