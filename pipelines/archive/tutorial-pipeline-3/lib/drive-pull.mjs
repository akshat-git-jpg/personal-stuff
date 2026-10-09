import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import { parseArgs } from 'node:util';
import { run } from './exec.mjs';

export function planDownloads(listing, sections) {
  const ignored = [];
  const fetches = [];
  const missing = [];
  
  const parsed = listing.trim().split('\n').filter(Boolean).map(line => {
    const [id, name, mimeType] = line.split('\t');
    return { id, name, mimeType };
  });

  const demoSecIds = new Set(sections.filter(s => s.demo).map(s => s.id));
  
  for (const { id, name } of parsed) {
    const m = name.match(/^(s\d{2})\.(mp4|mov)$/);
    if (m) {
      fetches.push({ id, name, secId: m[1] });
    } else {
      ignored.push(name);
    }
  }

  for (const secId of demoSecIds) {
    if (!fetches.some(f => f.secId === secId)) {
      missing.push(secId);
    }
  }

  return { fetches, missing, ignored };
}

export async function pullRecordings(slug, root, runner = run) {
  const driveJsonPath = path.join(root, 'videos', slug, 'drive.json');
  const driveConf = JSON.parse(await fs.readFile(driveJsonPath, 'utf8'));
  const folderId = driveConf.folder_id;
  const account = driveConf.account;

  const scriptPath = path.join(root, 'videos', slug, 'script.json');
  const script = JSON.parse(await fs.readFile(scriptPath, 'utf8'));

  const listCmd = path.join(root, '..', '..', 'tooling', 'cli', 'drive', 'pp-drive');
  const { stdout: listing } = await runner(listCmd, ['list-folder', folderId, '--account', account]);

  const plan = planDownloads(listing, script.sections);
  
  for (const ignoredName of plan.ignored) {
    console.log(`ignored: ${ignoredName}`);
  }

  const recDir = path.join(root, 'videos', slug, 'recordings');
  await fs.mkdir(recDir, { recursive: true });

  for (const file of plan.fetches) {
    const outPath = path.join(recDir, file.name);
    await runner(listCmd, ['download', file.id, '--out', outPath, '--account', account]);
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
    console.error("Usage: node lib/drive-pull.mjs <slug> [--root d]");
    process.exit(1);
  }

  const slug = positionals[0];
  const root = values.root || '.';

  await pullRecordings(slug, root);
}
