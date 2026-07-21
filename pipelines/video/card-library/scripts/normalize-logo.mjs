import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const CANVAS = 256;
const MARK_RATIO = 0.72;
const MARK_MAX = Math.round(CANVAS * MARK_RATIO); // 184
const DARK_LUMA = 0.25;

export function markBBox(pngPath, tmpRaw) {
  execFileSync('ffmpeg', ['-v', 'error', '-i', pngPath, '-f', 'rawvideo', '-pix_fmt', 'rgba', tmpRaw, '-y']);
  const b = fs.readFileSync(tmpRaw);
  const n = Math.round(Math.sqrt(b.length / 4));
  const W = n, H = n;                     // favicons are square; assert below
  if (W * H * 4 !== b.length) throw new Error(`${pngPath}: not square (${b.length} bytes)`);
  const at = (x, y) => b.subarray((y * W + x) * 4, (y * W + x) * 4 + 4);
  const corner = at(0, 0);
  const hasAlpha = (() => { for (let i = 3; i < b.length; i += 4) if (b[i] < 250) return true; return false; })();
  const isMark = (p) => hasAlpha
    ? p[3] > 16
    : (Math.abs(p[0] - corner[0]) + Math.abs(p[1] - corner[1]) + Math.abs(p[2] - corner[2])) > 40;

  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (isMark(at(x, y))) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  }
  if (x1 < 0) throw new Error(`${pngPath}: no mark detected`);
  return { W, H, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, hasAlpha, bg: [corner[0], corner[1], corner[2]] };
}

export function normalizeFile(pngPath, tmpRaw, tmpOut) {
  const box = markBBox(pngPath, tmpRaw);
  
  const NEUTRAL = [0x12, 0x15, 0x1c];
  const bg = box.hasAlpha ? NEUTRAL : box.bg;
  const hex = '0x' + bg.map(v => v.toString(16).padStart(2, '0')).join('');
  
  const L = (0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2]) / 255;
  const dark = L < DARK_LUMA;
  
  const maxDim = Math.max(box.w, box.h);
  if (box.W === CANVAS && box.H === CANVAS && !box.hasAlpha && maxDim >= 174 && maxDim <= 194) {
    if (pngPath !== tmpOut) {
      fs.copyFileSync(pngPath, tmpOut);
    }
    return { bg, dark, mark_ratio: maxDim / CANVAS };
  }

  execFileSync('ffmpeg', ['-v', 'error', '-i', pngPath, '-f', 'lavfi', '-i', `color=c=${hex}:s=${CANVAS}x${CANVAS}`,
    '-filter_complex', `[0:v]crop=${box.w}:${box.h}:${box.x}:${box.y},scale=w=${MARK_MAX}:h=${MARK_MAX}:force_original_aspect_ratio=decrease[fg];[1:v][fg]overlay=(W-w)/2:(H-h)/2`,
    '-frames:v', '1', tmpOut, '-y']);
    
  return { bg, dark, mark_ratio: MARK_RATIO };
}

if (process.argv[1] && process.argv[1].endsWith('normalize-logo.mjs')) {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Usage: node normalize-logo.mjs <slug>");
    process.exit(1);
  }
  
  const root = path.join(__dirname, '..');
  const registryPath = path.join(root, 'logos', 'registry.json');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const entry = registry[slug];
  
  if (!entry) {
    console.error(`Slug ${slug} not found in registry`);
    process.exit(1);
  }
  
  if (!entry.file) {
    console.error(`Slug ${slug} has no file in registry`);
    process.exit(1);
  }
  
  const pngPath = path.join(root, 'logos', entry.file);
  const tmpRaw = path.join(root, 'logos', `${slug}.raw.tmp`);
  const tmpOut = path.join(root, 'logos', `${slug}.out.tmp.png`);
  
  try {
    const { bg, dark, mark_ratio } = normalizeFile(pngPath, tmpRaw, tmpOut);
    fs.renameSync(tmpOut, pngPath);
    
    entry.normalized = true;
    entry.bg = '#' + bg.map(v => v.toString(16).padStart(2, '0')).join('');
    entry.dark = dark;
    entry.mark_ratio = mark_ratio;
    
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');
    console.log(`Normalized ${slug}`);
  } catch (err) {
    console.error(`Failed to normalize ${slug}:`, err.message);
    process.exit(1);
  } finally {
    if (fs.existsSync(tmpRaw)) fs.unlinkSync(tmpRaw);
    if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
  }
}
