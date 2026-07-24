import fs from 'node:fs';
import path from 'node:path';

// Walks variables for logo references and inlines them as data URIs under
// variables.__logos. References: variables.logo, variables.productLogos[],
// variables.platforms[].logo (title chip cards), beats[].logo (beats live
// inside variables after resolve). Missing slugs are returned in `missing` —
// callers decide loud vs lenient.
export function enrichLogos(variables, cardLibraryRoot) {
  const regPath = path.join(cardLibraryRoot, 'logos', 'registry.json');
  const registry = fs.existsSync(regPath) ? JSON.parse(fs.readFileSync(regPath, 'utf8')) : {};
  const refs = new Set();
  if (typeof variables.logo === 'string') refs.add(variables.logo);
  for (const s of variables.productLogos ?? []) if (typeof s === 'string') refs.add(s);
  for (const p of variables.platforms ?? []) if (typeof p?.logo === 'string') refs.add(p.logo);
  for (const b of variables.beats ?? []) if (typeof b.logo === 'string') refs.add(b.logo);
  for (const side of [variables.left, variables.right]) {
    if (typeof side?.logo === 'string') refs.add(side.logo);
  }
  const logos = {};
  const logoDark = {};
  const missing = [];
  for (const slug of refs) {
    const entry = registry[slug];
    if (!entry || !entry.file) { missing.push(slug); continue; }
    const file = path.join(cardLibraryRoot, 'logos', entry.file);
    if (!fs.existsSync(file)) { missing.push(slug); continue; }
    // SVG logos are transparent by construction (best on the dark cards); PNG
    // for the favicon-fetched ones. Mime follows the file extension.
    const mime = entry.file.toLowerCase().endsWith('.svg') ? 'image/svg+xml' : 'image/png';
    logos[slug] = `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
    if (entry.dark) logoDark[slug] = true;
  }
  return { variables: refs.size ? { ...variables, __logos: logos, __logoDark: logoDark } : variables, missing };
}
