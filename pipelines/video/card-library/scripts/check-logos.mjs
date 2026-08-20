import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { execFileSync } from 'node:child_process';
import { sharpness, SHARPNESS_MIN } from './normalize-logo.mjs';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const logosDir = path.join(__dirname, '..', 'logos');
const registryPath = path.join(logosDir, 'registry.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

/* ffprobe, not sips. sips is macOS-only, so on the Windows box every dimension
   check threw and this gate has never once run there — which is how a blurred
   flowise.png reached a rendered intro on 2026-08-19. A gate that only runs on
   one machine is not a gate. ffprobe is already a hard dependency of
   normalize-logo.mjs, so nothing new is required. */
function dimensions(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height',
    '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim().split('\n')[0];
  const [w, h] = out.split(',').map(Number);
  return { w, h };
}

/* The defect the dimension check cannot see: a 256x256 tile whose mark was
   upscaled from a 128px favicon is exactly 256x256 and correct by every other
   measure — and reads as a blur on a 1920 frame. Owner, 2026-08-19, on flowise:
   "the blue frame around it looks really old ... don't you have any basic
   knowledge of designing". The measurement lives in normalize-logo.mjs, which
   already owns raw-pixel work; fetch-logo.mjs refuses on the same number, so a
   soft mark cannot enter the registry OR survive in it.
   Measured across the twelve marks here, the three known-blurred ones scored
   48, 63 and 67 and every sharp one scored 84 or above. Do not lower it. */

let hasError = false;
const err = (m) => { console.error(`Error: ${m}`); hasError = true; };

for (const [slug, entry] of Object.entries(registry)) {
  if (!entry.file) continue;

  const filePath = path.join(logosDir, entry.file);

  if (!fs.existsSync(filePath)) {
    err(`${slug} references file ${entry.file} which does not exist`);
    continue;
  }

  if (!entry.normalized) err(`${slug} is missing normalized: true`);

  try {
    const { w, h } = dimensions(filePath);
    if (w !== 256 || h !== 256) err(`${slug} is not 256x256 (got ${w}x${h})`);
  } catch (e) {
    err(`Failed to check dimensions for ${slug}: ${e.message}`);
  }

  try {
    const tmp = path.join(logosDir, `.sharp-${slug}.tmp`);
    let s;
    try { s = sharpness(filePath, tmp); } finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
    if (s < SHARPNESS_MIN) {
      if (entry.sharpness_exempt) {
        console.warn(`Warning: ${slug} scores ${s.toFixed(0)} (< ${SHARPNESS_MIN}) — exempt: ${entry.sharpness_exempt}`);
      } else {
        err(`${slug} looks upscaled — edge sharpness ${s.toFixed(0)} is under ${SHARPNESS_MIN}. `
          + `It was almost certainly built from a favicon smaller than 256px. Re-source the mark at `
          + `256px or larger (the vendor's repo, app icon, or org avatar), key its ground off, and `
          + `re-run normalize-logo.mjs. Do NOT lower this number.`);
      }
    }
  } catch (e) {
    err(`Failed to measure sharpness for ${slug}: ${e.message}`);
  }

  const ratio = entry.mark_ratio;
  if (ratio === undefined || ratio < 0.68 || ratio > 0.76) {
    err(`${slug} has mark ratio ${ratio} outside 0.72 ± 0.04`);
  }
}

if (hasError) process.exit(1);
console.log(`logos ok — ${Object.keys(registry).length} marks`);
