import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from './workdir.mjs';
import { wordSyncBeats } from './kinetic-sentence.mjs';
import { CUE_CONSTANTS } from './cue-constants.mjs';
import { loadVideoManifest } from './video-manifest.mjs';

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

const ROLE_DEFAULTS = {
  heading:    { max_words: 7,  noTerminalPeriod: true,  maxCommas: 1 },
  sentence:   { max_words: 18 },
  label:      { max_words: 5,  noTerminalPeriod: true },
  descriptor: { max_words: 6,  noTerminalPeriod: true },
  value:      { mustContainDigit: true },
  logo_slug:  {},
  icon_name:  {},
  free:       {},
};

// Validate one value against one contract entry. Returns an array of message
// strings (empty = valid). `path` is a human-readable location like
// `left.stats[0].label` so an error points at the exact slot.
export function validateVariable(path, value, spec) {
  const out = [];
  if (spec === undefined) return out;

  if (typeof spec === 'string') {
    out.push(`${path}: string-form variable contract is unsupported — migrate catalog to object form`);
    return out;
  }

  const t = spec.type;
  const actual = Array.isArray(value) ? 'array' : typeof value;
  if (t && actual !== t) {
    out.push(`${path}: expected ${t}, got ${actual} (${JSON.stringify(value)?.slice(0, 40)})`);
    return out; // shape is wrong; further checks would be noise
  }

  if (Array.isArray(spec.enum) && !spec.enum.includes(value)) {
    out.push(`${path}: "${value}" is not one of ${spec.enum.join(' | ')}`);
  }

  if (t === 'string') {
    const rule = { ...(ROLE_DEFAULTS[spec.role] ?? {}), ...spec };
    const words = String(value).trim().split(/\s+/).filter(Boolean);
    if (rule.max_words && words.length > rule.max_words) {
      out.push(`${path}: ${words.length} words exceeds max_words ${rule.max_words} for role "${spec.role}" — "${value}"`);
    }
    if (rule.max_chars && String(value).length > rule.max_chars) {
      out.push(`${path}: ${String(value).length} chars exceeds max_chars ${rule.max_chars}`);
    }
    if (rule.noTerminalPeriod && /\.\s*$/.test(String(value))) {
      out.push(`${path}: role "${spec.role}" must not end in a period — "${value}" reads as a sentence, not a ${spec.role}`);
    }
    if (rule.maxCommas !== undefined && (String(value).match(/,/g) ?? []).length > rule.maxCommas) {
      out.push(`${path}: role "${spec.role}" allows at most ${rule.maxCommas} comma — "${value}" reads as a list, not a heading`);
    }
    if (rule.mustContainDigit && !/[0-9]/.test(String(value))) {
      out.push(`${path}: role "value" must carry a number — "${value}"`);
    }
  }

  if (t === 'object' && spec.shape && value && typeof value === 'object') {
    for (const [k, sub] of Object.entries(spec.shape)) {
      if (!(k in value)) {
        if (sub.required !== false) out.push(`${path}.${k}: missing required field`);
        continue;
      }
      out.push(...validateVariable(`${path}.${k}`, value[k], sub));
    }
  }

  if (t === 'array' && spec.item_shape && Array.isArray(value)) {
    value.forEach((el, i) => {
      for (const [k, sub] of Object.entries(spec.item_shape)) {
        if (!(k in el)) {
          if (sub.required !== false) out.push(`${path}[${i}].${k}: missing required field`);
          continue;
        }
        out.push(...validateVariable(`${path}[${i}].${k}`, el[k], sub));
      }
    });
  }

  return out;
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
    for (const [k, spec] of Object.entries(cat.variables ?? {})) {
      const isRequired = spec.required !== false;
      if (!(k in vars)) {
        if (isRequired) errors.push(`${cue.id}: missing variable "${k}" — the card would silently show its default content`);
        continue;
      }
      for (const msg of validateVariable(k, vars[k], spec)) errors.push(`${cue.id}: ${msg}`);
    }
    for (const [i, b] of (cue.beats ?? []).entries()) {
      for (const [k, spec] of Object.entries(cat.beat_shape ?? {})) {

        if (!(k in (b.reveal ?? {}))) {
          if (spec.required !== false) errors.push(`${cue.id} beat ${i + 1}: missing reveal field "${k}"`);
          continue;
        }
        for (const msg of validateVariable(`beat ${i + 1}.${k}`, b.reveal[k], spec)) {
          errors.push(`${cue.id}: ${msg}`);
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
    const BEAT_LEAD_IN = 0.6; // s a beat card is on screen before its first reveal

    const a = findFrom(cue.anchor, cursor);
    if (a.err) { errors.push(`${cue.id}: ${a.err}`); continue; }
    cursor = a.idx + a.len;
    const lead = cue.lead ?? 0.5;
    const hold = cue.hold ?? 3.0;
    let start = Math.max(0, a.start - lead);

    const beats = [];
    let failed = false;
    if (cat.kind === 'word-sync') {
      const r = wordSyncBeats(cue, W, a.idx, start);
      if (r.err) { errors.push(`${cue.id}: ${r.err}`); continue; }
      beats.push(...r.beats);
      cursor = r.cursor;
    } else {
      // Resolve every beat anchor to an ABSOLUTE time first — the cue anchor is
      // advisory for beat cards (owner decision 2026-07-21): it fixes ordering,
      // the first beat fixes placement. This makes dead air structurally
      // impossible instead of merely lint-detectable.
      const abs = [];
      for (const b of cue.beats ?? []) {
        const m = findFrom(b.anchor, cursor);
        if (m.err) { errors.push(`${cue.id} beat: ${m.err}`); failed = true; break; }
        cursor = m.idx + m.len;
        abs.push({ reveal: b.reveal, at: m.start });
      }
      if (!failed) {
        if (abs.length) start = Math.max(0, +(abs[0].at - BEAT_LEAD_IN).toFixed(2));
        for (const x of abs) beats.push({ ...x.reveal, at: +(x.at - start).toFixed(2) });
      }
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

// Post-pass: kill hold-expiry gaps (spec delta C). Fullframe exposure extends
// to the next base event: always on base:none (up to HOLD_EXTEND_CAP, else E7
// in lint), and only across gaps <= GAP_ABSORB on base:screen.
export function extendExposure(resolved, { base, total }) {
  const fulls = resolved.filter((c) => c.placement === 'fullframe');
  const out = resolved.map((c) => ({ ...c }));
  const byId = Object.fromEntries(out.map((c) => [c.id, c]));
  for (let i = 0; i < fulls.length; i++) {
    const cur = byId[fulls[i].id];
    const end = cur.start + cur.duration;
    const nextStart = i + 1 < fulls.length ? fulls[i + 1].start : total;
    const gap = +(nextStart - end).toFixed(2);
    if (gap <= 0) continue;
    const maxExtend = CUE_CONSTANTS.HOLD_EXTEND_CAP.value;
    const wanted = base === 'none' ? gap : (gap <= CUE_CONSTANTS.GAP_ABSORB.value ? gap : 0);
    const grant = Math.min(wanted, maxExtend);
    if (grant > 0) cur.duration = +(cur.duration + grant).toFixed(2);
  }
  return out;
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

  const manifest = loadVideoManifest(workdir);
  const extended = extendExposure(resolved, { base: manifest.base, total: words[words.length-1].end + 1.0 });

  fs.writeFileSync(
    path.join(workdir, 'resolved.json'),
    JSON.stringify({ video: cuesFile.video, offset: cuesFile.offset ?? 0, resolved: extended }, null, 2),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
