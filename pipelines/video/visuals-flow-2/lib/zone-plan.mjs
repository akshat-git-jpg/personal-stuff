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
