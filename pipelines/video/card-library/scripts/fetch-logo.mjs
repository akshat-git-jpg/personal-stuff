import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';

const [, , slug, domain] = process.argv;
if (!slug || !domain) {
  console.error('Usage: node scripts/fetch-logo.mjs <slug> <domain>');
  process.exit(1);
}

const logosDir = path.join(import.meta.dirname, '..', 'logos');
const registryPath = path.join(logosDir, 'registry.json');

if (!fs.existsSync(logosDir)) {
  fs.mkdirSync(logosDir, { recursive: true });
}

let registry = {};
if (fs.existsSync(registryPath)) {
  registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

if (registry[slug] && registry[slug].source === 'manual') {
  console.error(`Error: Refusing to overwrite manual logo for ${slug}`);
  process.exit(1);
}

const url = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
const fileName = `${slug}.png`;
const filePath = path.join(logosDir, fileName);

async function downloadLogo() {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Error: Failed to fetch favicon. Status code: ${res.status}`);
      registry[slug] = { domain, file: null, source: 'favicon' };
      fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n', 'utf8');
      process.exit(1);
    }
    const fileStream = fs.createWriteStream(filePath, { flags: 'w' });
    await finished(Readable.fromWeb(res.body).pipe(fileStream));
    
    registry[slug] = { domain, file: fileName, source: 'favicon' };
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n', 'utf8');
    console.log(`Successfully fetched logo for ${slug}`);
  } catch (err) {
    console.error(`Error: Network failed - ${err.message}`);
    registry[slug] = { domain, file: null, source: 'favicon' };
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n', 'utf8');
    process.exit(1);
  }
}

downloadLogo();
