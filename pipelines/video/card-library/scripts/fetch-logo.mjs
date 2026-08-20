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

/* sz=256, not 128. normalize scales the mark to 184px on a 256 canvas, so a
   128px favicon is UPSCALED and the tile is a blur that passes every other
   check — that is exactly how flowise, n8n and heygen all shipped soft
   (2026-08-19). Google serves at most 256 and often less, which is why the
   sharpness assertion below still has to exist. */
const url = `https://www.google.com/s2/favicons?domain=${domain}&sz=256`;
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
    
    // Normalize logo
    const { normalizeFile, sharpness, SHARPNESS_MIN } = await import('./normalize-logo.mjs');
    const tmpRaw = path.join(logosDir, `${slug}.raw.tmp`);
    const tmpOut = path.join(logosDir, `${slug}.out.tmp.png`);
    let normMeta;
    try {
      normMeta = normalizeFile(filePath, tmpRaw, tmpOut);
      if (fs.existsSync(tmpOut)) fs.renameSync(tmpOut, filePath);
    } catch (err) {
      console.error(`Error: Normalization failed for ${slug} - ${err.message}`);
      process.exit(1); // keep the raw file for inspection
    } finally {
      if (fs.existsSync(tmpRaw)) fs.unlinkSync(tmpRaw);
      if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
    }
    
    /* Refuse here rather than letting a soft mark into the registry: this is the
       last moment anyone is looking at this logo, and the next person to see it
       is the owner, in a rendered 1920 frame. */
    {
      const tmp = path.join(logosDir, `${slug}.sharp.tmp`);
      let s;
      try { s = sharpness(filePath, tmp); } finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
      if (s < SHARPNESS_MIN) {
        console.error(`Error: ${slug}'s favicon is too small — the normalized mark scores ${s.toFixed(0)}, `
          + `under ${SHARPNESS_MIN}, which means it was upscaled and will read as a blur on screen.
`
          + `Source the mark at 256px or larger by hand (the vendor's GitHub repo, app icon, or org `
          + `avatar), key its ground off, drop it at logos/${fileName}, and run:
`
          + `  node scripts/normalize-logo.mjs ${slug}
`
          + `then set source: "manual" and a dated "verified" note in registry.json.`);
        process.exit(1);
      }
    }

    registry[slug] = {
      domain, file: fileName, source: 'favicon',
      normalized: true,
      bg: '#' + normMeta.bg.map(v => v.toString(16).padStart(2, '0')).join(''),
      dark: normMeta.dark,
      mark_ratio: normMeta.mark_ratio
    };
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n', 'utf8');
    console.log(`Successfully fetched and normalized logo for ${slug}`);
  } catch (err) {
    console.error(`Error: Network failed - ${err.message}`);
    registry[slug] = { domain, file: null, source: 'favicon' };
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n', 'utf8');
    process.exit(1);
  }
}

downloadLogo();
