import fs from 'node:fs';
import path from 'node:path';

// Inlines per-video image assets as data URIs, the same way logos-inline.mjs
// handles brand marks. Cards need this because they are rendered from a
// string of HTML with no stable base URL: the board serves them from /card/,
// the renderer loads them from the card-library folder, and a relative path
// resolves differently in each. A data URI is the only reference that means
// the same thing on both surfaces.
//
// Owner ask, 2026-08-07 (c20): "use the actual generated image instead of
// making this placeholders... I prefer actual images over such placeholders
// or vectors". enacted/character-card-stamp falls back to a flat vector
// portrait when handed no image, and nothing was handing it one.
//
// Generic by file extension rather than by variable name, so any card can take
// an image without new plumbing. Paths resolve inside the video workdir only;
// anything escaping it is ignored rather than read.
const IMAGE_RE = /\.(jpe?g|png|webp)$/i;
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

export function enrichImages(variables, workdir) {
  const missing = [];
  let touched = false;

  const resolveOne = (rel) => {
    const abs = path.resolve(workdir, rel);
    if (path.relative(workdir, abs).startsWith('..')) { missing.push(rel); return null; }
    if (!fs.existsSync(abs)) { missing.push(rel); return null; }
    const ext = path.extname(abs).slice(1).toLowerCase();
    const mime = MIME[ext];
    if (!mime) { missing.push(rel); return null; }
    touched = true;
    return `data:${mime};base64,${fs.readFileSync(abs).toString('base64')}`;
  };

  const walk = (node) => {
    if (typeof node === 'string') {
      if (!IMAGE_RE.test(node) || node.startsWith('data:')) return node;
      return resolveOne(node) ?? node;
    }
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(node)) out[k] = walk(v);
      return out;
    }
    return node;
  };

  const next = walk(variables ?? {});
  return { variables: touched ? next : variables, missing };
}
