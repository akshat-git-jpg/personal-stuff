// Resolve a slug (or a path) to the per-video working directory.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function resolveWorkdir(slugOrPath) {
  if (!slugOrPath) throw new Error('resolveWorkdir: slug or path required');
  if (slugOrPath.includes('/')) return path.resolve(slugOrPath);
  return path.join(ROOT, 'videos', slugOrPath, 'intro-film');
}

export function ensureWorkdir(slugOrPath) {
  const dir = resolveWorkdir(slugOrPath);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export const rootDir = () => ROOT;
