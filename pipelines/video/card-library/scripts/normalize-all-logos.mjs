import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { normalizeFile } from './normalize-logo.mjs';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const registryPath = path.join(root, 'logos', 'registry.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

console.log("Normalizing all logos...");
let changedCount = 0;

for (const [slug, entry] of Object.entries(registry)) {
  if (!entry.file) continue;
  
  const pngPath = path.join(root, 'logos', entry.file);
  const tmpRaw = path.join(root, 'logos', `${slug}.raw.tmp`);
  const tmpOut = path.join(root, 'logos', `${slug}.out.tmp.png`);
  
  try {
    const beforeStats = fs.statSync(pngPath);
    const { bg, dark, mark_ratio } = normalizeFile(pngPath, tmpRaw, tmpOut);
    const outStats = fs.statSync(tmpOut);
    
    const beforeBuf = fs.readFileSync(pngPath);
    const afterBuf = fs.readFileSync(tmpOut);
    
    if (beforeBuf.equals(afterBuf)) {
      console.log(`${slug.padEnd(15)} : unchanged`);
      fs.unlinkSync(tmpOut);
      
      // Update registry anyway to ensure metadata is present
      if (!entry.normalized) {
        entry.normalized = true;
        entry.bg = '#' + bg.map(v => v.toString(16).padStart(2, '0')).join('');
        entry.dark = dark;
        entry.mark_ratio = mark_ratio;
        changedCount++;
      }
    } else {
      fs.renameSync(tmpOut, pngPath);
      console.log(`${slug.padEnd(15)} : updated (${beforeStats.size} -> ${outStats.size} bytes)`);
      changedCount++;
      
      entry.normalized = true;
      entry.bg = '#' + bg.map(v => v.toString(16).padStart(2, '0')).join('');
      entry.dark = dark;
      entry.mark_ratio = mark_ratio;
    }
  } catch (err) {
    console.error(`Failed on ${slug}:`, err.message);
  } finally {
    if (fs.existsSync(tmpRaw)) fs.unlinkSync(tmpRaw);
    if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
  }
}

if (changedCount > 0) {
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');
}
