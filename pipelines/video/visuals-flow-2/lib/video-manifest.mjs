import fs from 'node:fs';
import path from 'node:path';

export const MANIFEST_DEFAULTS = { base: 'screen', aspect: '16:9', brand: 'default', music: '' };

export function loadVideoManifest(workdir) {
  const p = path.join(workdir, 'video.json');
  if (!fs.existsSync(p)) return { ...MANIFEST_DEFAULTS };
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  const m = { ...MANIFEST_DEFAULTS, ...raw };
  if (!['screen', 'none'].includes(m.base)) throw new Error(`video.json base must be "screen"|"none", got "${m.base}"`);
  if (m.aspect !== '16:9') throw new Error('video.json aspect: only "16:9" is supported (longform-only, decisions.md 2026-07-24)');
  return m;
}
