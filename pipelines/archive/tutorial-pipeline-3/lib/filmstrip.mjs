import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import { parseArgs } from 'node:util';
import { run } from './exec.mjs';

export async function filmstrip(slug, { root, runner = run }) {
  const scriptPath = path.join(root, 'videos', slug, 'script.json');
  const script = JSON.parse(await fs.readFile(scriptPath, 'utf8'));

  const recDir = path.join(root, 'videos', slug, 'recordings');
  const qcDir = path.join(root, 'videos', slug, 'qc');
  await fs.mkdir(qcDir, { recursive: true });

  const recFiles = await fs.readdir(recDir).catch(e => {
    if (e.code === 'ENOENT') return [];
    throw e;
  });

  for (const sec of script.sections) {
    if (sec.demo && (sec.recording.status === 'received' || sec.recording.status === 'qc-passed')) {
      const clipName = recFiles.find(f => f.match(new RegExp(`^${sec.id}\\.(mp4|mov)$`)));
      if (!clipName) continue; // Should not happen if status is received

      const clipPath = path.join(recDir, clipName);
      const outPath = path.join(qcDir, `${sec.id}.png`);

      await runner('ffmpeg', [
        '-y',
        '-i', clipPath,
        '-vf', 'fps=1/8,scale=320:-1,tile=5x4',
        '-frames:v', '1',
        outPath
      ]);
    }
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
    console.error("Usage: node lib/filmstrip.mjs <slug> [--root d]");
    process.exit(1);
  }

  const slug = positionals[0];
  const root = values.root || '.';
  await filmstrip(slug, { root });
}
