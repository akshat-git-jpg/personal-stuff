import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import { parseArgs } from 'node:util';
import { loadEnv } from './env.mjs';

export async function pullAudio(script, opts, fetchImpl) {
  const UI_URL = process.env.VO_UI_URL;
  const ADMIN_TOKEN = process.env.VO_UI_ADMIN_TOKEN;

  const audioDir = path.join(opts.root, 'videos', opts.slug, 'audio');
  await fs.mkdir(audioDir, { recursive: true });

  for (const section of script.sections) {
    if (!section.tts || !section.tts.locked) {
      throw new Error(`Section ${section.id} is not locked`);
    }

    const reqUrl = `${UI_URL}/api/admin/audio/${opts.slug}/${section.id}`;
    const res = await fetchImpl(reqUrl, {
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch audio for ${section.id}: ${res.status}`);
    }

    const buffer = await res.arrayBuffer();
    await fs.writeFile(path.join(audioDir, `${section.id}.wav`), Buffer.from(buffer));
  }
}

const isMain = typeof process !== 'undefined' && import.meta.url.startsWith('file:') && url.fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      root: { type: 'string', short: 'd' }
    },
    allowPositionals: true
  });
  
  if (positionals.length === 0) {
    console.error("Usage: node lib/pull-audio.mjs <slug> [--root d]");
    process.exit(1);
  }

  const slug = positionals[0];
  const root = values.root || '.';
  loadEnv(root);
  const scriptPath = path.join(root, 'videos', slug, 'script.json');
  const script = JSON.parse(await fs.readFile(scriptPath, 'utf8'));

  await pullAudio(script, { root, slug }, fetch);
}
