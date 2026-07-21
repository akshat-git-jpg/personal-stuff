import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const logosDir = path.join(__dirname, '..', 'logos');
const registryPath = path.join(logosDir, 'registry.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

let hasError = false;

for (const [slug, entry] of Object.entries(registry)) {
  if (!entry.file) continue;

  const filePath = path.join(logosDir, entry.file);
  
  if (!fs.existsSync(filePath)) {
    console.error(`Error: ${slug} references file ${entry.file} which does not exist`);
    hasError = true;
    continue;
  }
  
  if (!entry.normalized) {
    console.error(`Error: ${slug} is missing normalized: true`);
    hasError = true;
  }
  
  try {
    const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', filePath], { encoding: 'utf8' });
    const wMatch = out.match(/pixelWidth:\s*(\d+)/);
    const hMatch = out.match(/pixelHeight:\s*(\d+)/);
    if (!wMatch || !hMatch || wMatch[1] !== '256' || hMatch[1] !== '256') {
      console.error(`Error: ${slug} is not 256x256 (got ${wMatch?.[1]}x${hMatch?.[1]})`);
      hasError = true;
    }
  } catch (err) {
    console.error(`Error: Failed to check dimensions for ${slug}: ${err.message}`);
    hasError = true;
  }
  
  const ratio = entry.mark_ratio;
  if (ratio === undefined || ratio < 0.68 || ratio > 0.76) {
    console.error(`Error: ${slug} has mark ratio ${ratio} outside 0.72 ± 0.04`);
    hasError = true;
  }
}

if (hasError) {
  process.exit(1);
} else {
  console.log('logos ok');
}
