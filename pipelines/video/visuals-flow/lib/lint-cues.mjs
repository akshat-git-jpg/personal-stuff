import fs from 'node:fs';
import path from 'node:path';

const CAP_STAT_HIT = 3;
const SPACING_STAT_HIT = 90;
const CAP_FULLFRAME = 3;
const ZONE_START = 15;
const ZONE_END = 20;
const GAP_FULLFRAME_MAX = 180;
const GAP_FULLFRAME_MIN = 45;
const DENSITY_OVERLAY_WINDOW = 60;
const DENSITY_OVERLAY_MAX = 2;
const TARGET_TOTAL_MIN = 18;
const TARGET_TOTAL_MAX = 28;

export function lintCues({ cuesFile, resolved, words, catalog }) {
  const errors = [];
  const warnings = [];
  
  if (!words || words.length === 0) {
    return { errors, warnings };
  }
  
  const T = words[words.length - 1].end;
  const bySlug = Object.fromEntries(catalog.cards.map((c) => [c.slug, c]));
  
  // Create a fast lookup for cue definition
  const rawCues = (cuesFile.cues || []).filter(c => !c.flagged);
  const byId = Object.fromEntries(rawCues.map((c) => [c.id, c]));
  
  // Filter resolved to only those in byId (unflagged)
  const validResolved = resolved.filter(r => byId[r.id]);
  
  // Sort resolved by start time just to be safe
  const sortedResolved = [...validResolved].sort((a, b) => a.start - b.start);

  // E1 stat-hit-cap
  const statHits = sortedResolved.filter(r => r.card === 'overlay/stat-hit');
  if (statHits.length > CAP_STAT_HIT) {
    const ids = statHits.map(r => r.id).join(', ');
    errors.push(`E1 stat-hit-cap: ${statHits.length} stat-hits used (max ${CAP_STAT_HIT}): ${ids}`);
  }
  
  // E2 stat-hit-spacing
  for (let i = 1; i < statHits.length; i++) {
    const prev = statHits[i - 1];
    const curr = statHits[i];
    const diff = curr.start - prev.start;
    if (diff < SPACING_STAT_HIT) {
      errors.push(`E2 stat-hit-spacing: ${curr.id} starts ${diff.toFixed(1)}s after ${prev.id} (minimum ${SPACING_STAT_HIT}s)`);
    }
  }

  // E3 card-repetition — structural cards (catalog `structural: true`, e.g.
  // section openers used once per compared item) are exempt: consistency
  // across parallel items beats variety (owner rule 2026-07-18).
  const fullframeCounts = {};
  for (const r of sortedResolved) {
    const cat = bySlug[r.card];
    if (cat && cat.placement === 'fullframe' && !cat.structural) {
      fullframeCounts[r.card] = fullframeCounts[r.card] || { count: 0, ids: [] };
      fullframeCounts[r.card].count++;
      fullframeCounts[r.card].ids.push(r.id);
    }
  }
  for (const [card, data] of Object.entries(fullframeCounts)) {
    if (data.count > CAP_FULLFRAME) {
      errors.push(`E3 card-repetition: fullframe card ${card} used ${data.count} times (max ${CAP_FULLFRAME}): ${data.ids.join(', ')}`);
    }
  }

  // E4 exclusion-zones
  for (const r of sortedResolved) {
    if (r.start < ZONE_START) {
      errors.push(`E4 exclusion-zones: ${r.id} starts at ${r.start.toFixed(1)}s (minimum ${ZONE_START}s)`);
    }
    if (r.start + r.duration > T - ZONE_END) {
      errors.push(`E4 exclusion-zones: ${r.id} ends at ${(r.start + r.duration).toFixed(1)}s (maximum ${(T - ZONE_END).toFixed(1)}s, total ${T.toFixed(1)}s)`);
    }
  }

  // W1 fullframe-cadence
  const fullframes = sortedResolved.filter(r => {
    const cat = bySlug[r.card];
    return cat && cat.placement === 'fullframe';
  });
  for (let i = 1; i < fullframes.length; i++) {
    const prev = fullframes[i - 1];
    const curr = fullframes[i];
    const gap = curr.start - prev.start;
    if (gap > GAP_FULLFRAME_MAX) {
      warnings.push(`W1 fullframe-cadence: ${curr.id} starts ${gap.toFixed(1)}s after ${prev.id} (maximum gap ${GAP_FULLFRAME_MAX}s)`);
    }
    if (gap < GAP_FULLFRAME_MIN) {
      warnings.push(`W1 fullframe-cadence: ${curr.id} starts ${gap.toFixed(1)}s after ${prev.id} (minimum gap ${GAP_FULLFRAME_MIN}s)`);
    }
  }

  // W2 overlay-density
  const overlays = sortedResolved.filter(r => {
    const cat = bySlug[r.card];
    return cat && cat.placement !== 'fullframe'; // Treat anything not fullframe as overlay
  });
  for (let i = 0; i < overlays.length; i++) {
    const windowStart = overlays[i].start;
    const windowEnd = windowStart + DENSITY_OVERLAY_WINDOW;
    let inWindow = [];
    for (let j = i; j < overlays.length; j++) {
      if (overlays[j].start <= windowEnd) {
        inWindow.push(overlays[j].id);
      } else {
        break;
      }
    }
    if (inWindow.length > DENSITY_OVERLAY_MAX) {
      warnings.push(`W2 overlay-density: ${inWindow.length} overlays start within ${DENSITY_OVERLAY_WINDOW}s window starting at ${windowStart.toFixed(1)}s (max ${DENSITY_OVERLAY_MAX}): ${inWindow.join(', ')}`);
      // Skip ahead to avoid duplicate warnings for the same dense cluster
      i += inWindow.length - 1;
    }
  }

  // W3 total-count
  const minCues = Math.floor(TARGET_TOTAL_MIN * (T / 1800));
  const maxCues = Math.ceil(TARGET_TOTAL_MAX * (T / 1800));
  const count = sortedResolved.length;
  if (count < minCues || count > maxCues) {
    warnings.push(`W3 total-count: ${count} cues is outside the scaled bounds [${minCues}, ${maxCues}] for a ${(T/60).toFixed(1)}min video`);
  }

  // W4 reveal-wordcount
  for (const c of rawCues) {
    if (c.beats) {
      c.beats.forEach((b, i) => {
        if (b.reveal && typeof b.reveal.text === 'string') {
          const wcount = b.reveal.text.trim().split(/\s+/).length;
          if (b.reveal.text.trim() === '') return;
          if (wcount > 6 || wcount === 1) {
            warnings.push(`W4 reveal-wordcount: ${c.id} beat ${i + 1} reveal text has ${wcount} words (target 2-6): "${b.reveal.text}"`);
          }
        }
      });
    }
  }

  return { errors, warnings };
}

function resolveWorkdir(arg) {
  if (arg.includes('/') || fs.existsSync(arg)) return path.resolve(arg);
  const pipelineRoot = path.resolve(import.meta.dirname, '..');
  return path.join(pipelineRoot, 'videos', arg);
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('usage: node lib/lint-cues.mjs <slug-or-path>');
    process.exit(1);
  }
  const workdir = resolveWorkdir(arg);
  const cardLibraryRoot = path.resolve(import.meta.dirname, '..', '..', 'card-library');
  const cuesPath = path.join(workdir, 'cues.json');
  const resolvedPath = path.join(workdir, 'resolved.json');
  const transcriptPath = path.join(workdir, 'transcript.json');
  const catalogPath = path.join(cardLibraryRoot, 'catalog.json');

  const cuesFile = JSON.parse(fs.readFileSync(cuesPath, 'utf8'));
  const resolvedFile = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  const words = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

  const { errors, warnings } = lintCues({
    cuesFile,
    resolved: resolvedFile.resolved,
    words,
    catalog
  });

  for (const w of warnings) {
    console.log(w);
  }

  if (errors.length > 0) {
    for (const e of errors) {
      console.error(e);
    }
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
