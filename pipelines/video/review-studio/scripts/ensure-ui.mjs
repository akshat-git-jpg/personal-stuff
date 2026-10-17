// Builds the UI when dist is missing or older than its sources, so one Start button is enough.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const UI = path.resolve(import.meta.dirname, '..', 'ui');
const DIST = path.join(UI, 'dist', 'index.html');

function newest(dir) {
  let t = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    t = Math.max(t, e.isDirectory() ? newest(p) : fs.statSync(p).mtimeMs);
  }
  return t;
}

const srcTime = Math.max(newest(path.join(UI, 'src')), fs.statSync(path.join(UI, 'package-lock.json')).mtimeMs);
if (fs.existsSync(DIST) && fs.statSync(DIST).mtimeMs >= srcTime) process.exit(0);

// Vite 8 needs Node 22; the Mac default is 20, so prefer Homebrew's node@22 when it exists.
const env = { ...process.env };
const node22 = ['/opt/homebrew/opt/node@22/bin', '/usr/local/opt/node@22/bin'].find((d) => fs.existsSync(d));
if (Number(process.versions.node.split('.')[0]) < 22 && node22) env.PATH = `${node22}${path.delimiter}${env.PATH}`;
const npm = (args) => {
  console.log(`review-studio: npm ${args.join(' ')}`);
  const r = spawnSync('npm', args, { cwd: UI, env, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
if (!fs.existsSync(path.join(UI, 'node_modules', 'vite'))) npm(['ci', '--no-audit', '--no-fund']);
npm(['run', 'build']);
