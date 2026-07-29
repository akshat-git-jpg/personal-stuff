import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from './workdir.mjs';

// The intro and conclusion get approved on their own, before anything renders
// (owner 2026-07-28). The build-vs-reuse call is cheapest here — after that it
// is paid for in renders and re-cuts.
export const ZONE_PARTS = ['intro', 'conclusion'];

export function buildZonePlan({ structure, resolved, cues, catalogSlugs }) {
  const bySlug = new Set(catalogSlugs);
  const cueById = Object.fromEntries((cues ?? []).map((c) => [c.id, c]));
  const zones = [];
  for (const part of ZONE_PARTS) {
    const span = (structure ?? []).find((s) => s.part === part);
    if (!span) continue;
    const items = (resolved ?? [])
      .filter((r) => r.start >= span.start && r.start < span.end)
      .sort((a, b) => a.start - b.start)
      .map((r) => {
        const cue = cueById[r.id] ?? {};
        const exists = bySlug.has(r.card);
        return {
          id: r.id,
          at: +r.start.toFixed(2),
          card: r.card,
          status: exists ? 'existing' : 'new',
          placement: r.placement ?? null,
          flagged: cue.flagged === true,
          // R_CHOOSING puts a proposed new card's one-line spec in `fix`.
          proposal: cue.fix ?? null,
        };
      });
    zones.push({ part, start: span.start, end: span.end, items });
  }
  return zones;
}

// Feedback given AT the 070 gate. Until 2026-07-29 this gate was binary —
// zone-plan.json carried `approved: true|false` and nothing else — so rejecting
// a proposed intro card recorded no reason anywhere, and the same card came
// back on the next video. Owner: intro/conclusion rules, guidelines and
// execution are separate from the body's, so these items are tagged `zone` and
// the 130 fold routes them to steps/035-place-intro-outro-llm/RULEBOOK.md ONLY.
//
// Keys are `zone-<part>:<n>` so they never collide with the storyboard's
// cue-keyed items or the Final Cut's `final-*` ones, and so feedback-status
// counts them like any other pending item.
export function appendZoneFeedback(fb, part, item) {
  const out = { ...(fb ?? {}) };
  out.items = { ...(out.items ?? {}) };
  const prefix = `zone-${part}:`;
  const next = Object.keys(out.items)
    .filter((k) => k.startsWith(prefix))
    .reduce((max, k) => Math.max(max, parseInt(k.slice(prefix.length), 10) || 0), 0) + 1;
  out.items[`${prefix}${next}`] = {
    zone: part,
    text: String(item?.text ?? '').trim(),
    added: new Date().toISOString().slice(0, 10),
    ...(item?.cue ? { context: { cue: item.cue, card: item.card ?? null } } : {}),
  };
  out.updated = new Date().toISOString().slice(0, 10);
  return out;
}

export function summarize(zones) {
  const items = zones.flatMap((z) => z.items);
  return {
    cues: items.length,
    existing: items.filter((i) => i.status === 'existing').length,
    toBuild: items.filter((i) => i.status === 'new').length,
    flagged: items.filter((i) => i.flagged).length,
  };
}

function main() {
  const arg = process.argv[2];
  if (!arg) { console.error('usage: node lib/zone-plan.mjs <slug-or-path>'); process.exit(1); }
  const workdir = resolveWorkdir(arg);
  const read = (f) => JSON.parse(fs.readFileSync(path.join(workdir, f), 'utf8'));
  const segments = read('segments.json');
  if (!segments.structure) {
    console.error('no `structure` in segments.json — this workdir predates the intro/body/conclusion convention; run the segments step first');
    process.exit(1);
  }
  const resolvedFile = read('resolved.json');
  const cuesFile = read('cues.json');
  const catalogPath = path.resolve(import.meta.dirname, '..', '..', 'card-library', 'catalog.json');
  const cat = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const catalogSlugs = (cat.cards ?? cat).map((c) => c.slug);

  const zones = buildZonePlan({
    structure: segments.structure,
    resolved: resolvedFile.resolved,
    cues: cuesFile.cues,
    catalogSlugs,
  });

  const outPath = path.join(workdir, 'zone-plan.json');
  const prev = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : {};
  // Any change to the plan invalidates a previous approval — the owner
  // approved a specific set of cards, not the file's existence.
  const changed = JSON.stringify(prev.zones ?? null) !== JSON.stringify(zones);
  const out = {
    video: path.basename(workdir),
    approved: changed ? false : (prev.approved === true),
    zones,
  };
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
  const s = summarize(zones);
  console.log(`zone plan: ${s.cues} cues across ${zones.length} zones — ${s.existing} existing, ${s.toBuild} to build, ${s.flagged} flagged`);
  console.log(`approved: ${out.approved} -> ${outPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
