// Logo copies under moments/<id>/assets/ are gitignored; restore any the composition names from the logo registry.
import fs from 'node:fs';
import path from 'node:path';
import { LOGOS_DIR } from './paths.mjs';

export function referencedAssets(html) {
  return [...new Set([...html.matchAll(/["'(]assets\/([A-Za-z0-9._-]+)["')]/g)].map((m) => m[1]))];
}

// Returns the names it could not restore (not a registry logo), so the caller can report them.
export function restoreAssets(dir, { logos = LOGOS_DIR } = {}) {
  const html = path.join(dir, 'index.html');
  if (!fs.existsSync(html)) return [];
  const missing = [];
  for (const name of referencedAssets(fs.readFileSync(html, 'utf8'))) {
    const dest = path.join(dir, 'assets', name);
    if (fs.existsSync(dest)) continue;
    const src = path.join(logos, name);
    if (!fs.existsSync(src)) { missing.push(name); continue; }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
  return missing;
}
