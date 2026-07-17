import fs from 'node:fs';
import path from 'node:path';

export function normWord(w) { return w.toLowerCase().replace(/[^a-z0-9']/g, ''); }

export function resolveCues(cues, words, catalog) {
  const W = words.map((x) => ({ ...x, n: normWord(x.text) })).filter((x) => x.n);
  const bySlug = Object.fromEntries(catalog.cards.map((c) => [c.slug, c]));
  const errors = [];
  const out = [];
  let cursor = 0;
  const findFrom = (phrase, from) => {
    const p = phrase.split(/\s+/).map(normWord).filter(Boolean);
    if (p.length < 3) return { err: `anchor has fewer than 3 words: "${phrase}"` };
    for (let i = from; i <= W.length - p.length; i++) {
      let ok = true;
      for (let j = 0; j < p.length; j++) if (W[i + j].n !== p[j]) { ok = false; break; }
      if (ok) return { idx: i, start: W[i].start };
    }
    return { err: `anchor not found (searching forward from word ${from}): "${phrase}"` };
  };
  for (const cue of cues) {
    const cat = bySlug[cue.card];
    if (!cat) { errors.push(`${cue.id}: unknown card "${cue.card}"`); continue; }
    if (cue.flagged) continue; // flagged cues are skipped, not errors
    const a = findFrom(cue.anchor, cursor);
    if (a.err) { errors.push(`${cue.id}: ${a.err}`); continue; }
    cursor = a.idx + 1;
    const lead = cue.lead ?? 0.5;
    const hold = cue.hold ?? 3.0;
    const start = Math.max(0, a.start - lead);
    const beats = [];
    let failed = false;
    for (const b of cue.beats ?? []) {
      const m = findFrom(b.anchor, cursor);
      if (m.err) { errors.push(`${cue.id} beat: ${m.err}`); failed = true; break; }
      cursor = m.idx + 1;
      beats.push({ ...b.reveal, at: +(m.start - start).toFixed(2) });
    }
    if (failed) continue;
    const duration = beats.length ? +(beats[beats.length - 1].at + hold).toFixed(2) : cat.default_duration;
    const prev = out[out.length - 1];
    if (prev && cat.placement === 'fullframe' && prev.placement === 'fullframe' && start < prev.start + prev.duration) {
      errors.push(`${cue.id}: overlaps previous fullframe cue ${prev.id} (${start} < ${(prev.start + prev.duration).toFixed(2)})`);
      continue;
    }
    out.push({
      id: cue.id, card: cue.card, placement: cat.placement,
      start: +start.toFixed(2), duration,
      variables: { ...cue.variables, ...(beats.length ? { beats } : {}) },
    });
  }
  return { resolved: out, errors };
}

function resolveWorkdir(arg) {
  if (arg.includes('/') || fs.existsSync(arg)) return path.resolve(arg);
  const pipelineRoot = path.resolve(import.meta.dirname, '..');
  return path.join(pipelineRoot, 'videos', arg);
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

  const { resolved, errors } = resolveCues(cuesFile.cues, words, catalog);

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
