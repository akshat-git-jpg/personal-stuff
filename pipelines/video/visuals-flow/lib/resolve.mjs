import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from './workdir.mjs';

export function normWord(w) { return w.toLowerCase().replace(/[^a-z0-9']/g, ''); }

// Forward-only phrase matcher over normalized words. Shared by the cue
// resolver and the shot resolver — one matching semantics, one place.
export function findPhrase(W, phrase, from) {
  const p = phrase.split(/\s+/).map(normWord).filter(Boolean);
  if (p.length < 3) return { err: `anchor has fewer than 3 words: "${phrase}"` };
  for (let i = from; i <= W.length - p.length; i++) {
    let ok = true;
    for (let j = 0; j < p.length; j++) if (W[i + j].n !== p[j]) { ok = false; break; }
    if (ok) return { idx: i, start: W[i].start, len: p.length };
  }
  return { err: `anchor not found (searching forward from word ${from}): "${phrase}"` };
}

// Schema validation against catalog.json contracts — catches wrong-shaped
// variables/beats BEFORE anything renders (the "undefined on screen" class).
// A catalog type description containing "optional" marks that field optional.
export function validateCues(cues, catalog, cardLibraryRoot) {
  const bySlug = Object.fromEntries(catalog.cards.map((c) => [c.slug, c]));
  const errors = [];
  const regPath = cardLibraryRoot ? path.join(cardLibraryRoot, 'logos', 'registry.json') : null;
  const registry = regPath && fs.existsSync(regPath) ? JSON.parse(fs.readFileSync(regPath, 'utf8')) : {};
  for (const cue of cues) {
    const cat = bySlug[cue.card];
    if (!cat || cue.flagged) continue; // unknown cards error in resolveCues; flagged cues are parked
    const beats = cue.beats ?? [];
    const vars = cue.variables ?? {};
    if (cat.kind === 'single' && beats.length > 0) {
      errors.push(`${cue.id}: ${cue.card} is a single card — beats must be empty`);
    }
    if (cat.kind === 'beat') {
      if (beats.length === 0) errors.push(`${cue.id}: ${cue.card} is a beat card — needs at least 1 beat`);
      if (cat.max_beats && beats.length > cat.max_beats) {
        errors.push(`${cue.id}: ${beats.length} beats exceeds max_beats ${cat.max_beats} for ${cue.card} — split into two cues or trim`);
      }
      const shape = cat.beat_shape ?? {};
      beats.forEach((b, i) => {
        const r = b.reveal;
        if (!r || typeof r !== 'object' || Object.keys(r).length === 0) {
          errors.push(`${cue.id} beat ${i + 1}: reveal must be a non-empty object (shape: ${Object.keys(shape).join(', ')})`);
          return;
        }
        for (const [k, desc] of Object.entries(shape)) {
          if (!(k in r) && !String(desc).toLowerCase().includes('optional')) {
            errors.push(`${cue.id} beat ${i + 1}: reveal missing required field "${k}"`);
          }
        }
        if (cat.max_reveal_chars) {
          for (const [k, v] of Object.entries(r)) {
            if (typeof v === 'string' && v.length > cat.max_reveal_chars) {
              errors.push(`${cue.id} beat ${i + 1}: reveal.${k} is ${v.length} chars, max ${cat.max_reveal_chars} — summarize harder`);
            }
          }
        }
        // Cross-field width contract: score rows must carry exactly one value per product.
        if (Array.isArray(r.values) && Array.isArray(vars.products) && r.values.length !== vars.products.length) {
          errors.push(`${cue.id} beat ${i + 1}: values has ${r.values.length} entries but products has ${vars.products.length} — must match 1:1`);
        }
      });
    }
    for (const [k, desc] of Object.entries(cat.variables ?? {})) {
      const optional = String(desc).toLowerCase().includes('optional');
      if (!(k in vars)) {
        if (!optional) errors.push(`${cue.id}: missing variable "${k}" (${desc}) — the card would silently show its default content`);
        continue;
      }
      if (String(desc).toLowerCase().includes('array')) {
        if (!Array.isArray(vars[k]) || vars[k].length === 0) {
          errors.push(`${cue.id}: variable "${k}" must be a non-empty array (${desc})`);
        }
      }
    }
    const refs = new Set();
    if (typeof vars.logo === 'string') refs.add(vars.logo);
    for (const s of vars.productLogos ?? []) if (typeof s === 'string') refs.add(s);
    for (const b of beats) if (typeof b.reveal?.logo === 'string') refs.add(b.reveal.logo);
    
    if (cardLibraryRoot) {
      for (const slug of refs) {
        const entry = registry[slug];
        if (!entry || !entry.file) {
          errors.push(`${cue.id}: unknown logo slug "${slug}" — run card-library/scripts/fetch-logo.mjs`);
        }
      }
    }
  }
  return errors;
}

export function resolveCues(cues, words, catalog, cardLibraryRoot) {
  const W = words.map((x) => ({ ...x, n: normWord(x.text) })).filter((x) => x.n);
  const bySlug = Object.fromEntries(catalog.cards.map((c) => [c.slug, c]));
  const errors = [...validateCues(cues, catalog, cardLibraryRoot)];
  const out = [];
  let cursor = 0;
  let lastFullframe = null;
  const findFrom = (phrase, from) => findPhrase(W, phrase, from);
  for (const cue of cues) {
    const cat = bySlug[cue.card];
    if (!cat) { errors.push(`${cue.id}: unknown card "${cue.card}"`); continue; }
    if (cue.flagged) continue; // flagged cues are skipped, not errors
    const a = findFrom(cue.anchor, cursor);
    if (a.err) { errors.push(`${cue.id}: ${a.err}`); continue; }
    cursor = a.idx + a.len;
    const lead = cue.lead ?? 0.5;
    const hold = cue.hold ?? 3.0;
    const start = Math.max(0, a.start - lead);
    const beats = [];
    let failed = false;
    for (const b of cue.beats ?? []) {
      const m = findFrom(b.anchor, cursor);
      if (m.err) { errors.push(`${cue.id} beat: ${m.err}`); failed = true; break; }
      cursor = m.idx + m.len;
      beats.push({ ...b.reveal, at: +(m.start - start).toFixed(2) });
    }
    if (failed) continue;
    const duration = beats.length ? +(beats[beats.length - 1].at + hold).toFixed(2) : cat.default_duration;
    if (cat.placement === 'fullframe' && lastFullframe && start < lastFullframe.start + lastFullframe.duration) {
      errors.push(`${cue.id}: overlaps previous fullframe cue ${lastFullframe.id} (${start} < ${(lastFullframe.start + lastFullframe.duration).toFixed(2)})`);
      continue;
    }
    const entry = {
      id: cue.id, card: cue.card, placement: cat.placement,
      start: +start.toFixed(2), duration,
      variables: { ...cue.variables, ...(beats.length ? { beats } : {}) },
    };
    out.push(entry);
    if (entry.placement === 'fullframe') lastFullframe = entry;
  }
  return { resolved: out, errors };
}


async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('usage: node lib/resolve.mjs <slug-or-path>');
    process.exit(1);
  }
  const workdir = resolveWorkdir(arg);
  const cardLibraryRoot = path.resolve(import.meta.dirname, '..', '..', 'card-library');
  const cuesPath = path.join(workdir, 'cues.json');
  const transcriptPath = path.join(workdir, 'transcript.json');
  const catalogPath = path.join(cardLibraryRoot, 'catalog.json');

  const cuesFile = JSON.parse(fs.readFileSync(cuesPath, 'utf8'));
  const words = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

  const { resolved, errors } = resolveCues(cuesFile.cues, words, catalog, cardLibraryRoot);

  if (errors.length) {
    for (const e of errors) console.error(e);
    process.exit(1);
  }

  fs.writeFileSync(
    path.join(workdir, 'resolved.json'),
    JSON.stringify({ video: cuesFile.video, offset: cuesFile.offset ?? 0, resolved }, null, 2),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
