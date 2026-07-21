import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from './workdir.mjs';

const CAP_STAT_HIT = 3;
const SPACING_STAT_HIT = 90;
const CAP_FULLFRAME = 3;
const ZONE_END = 20;
// Density recalibration 2026-07-21 (owner: "motion graphics more frequent —
// long stretches were bare"). Moderate ~2x: fullframe beat every ~35-60s, floor
// rate 1.0/min, and W6 forbids any interior stretch >50s with no graphic at all
// (fullframe OR overlay). Supersedes the Youri-wave starting numbers per the
// same owner-directive precedent; the 060 fold tunes from here. decisions.md.
const GAP_FULLFRAME_MAX = 60;
const GAP_FULLFRAME_MIN = 35;
const DENSITY_OVERLAY_WINDOW = 60;
const DENSITY_OVERLAY_MAX = 3;
const TARGET_RATE_MIN = 1.0;
const TARGET_RATE_MAX = 1.9;
const BARE_GAP_MAX = 50; // W6: max interior seconds with NO graphic (any placement) before/after any cue
// Dead air is now designed out by the resolver's BEAT_LEAD_IN clamp (plan 116);
// W5 stays as the regression detector for that clamp, not as a style hint.
const FIRST_BEAT_IDLE_MAX = { chrome: 1.2, frame: 2.5 };
const ENDCARD_SLUG_PREFIXES = ['brand/', 'link-in-description/'];

export function lintCues({ cuesFile, resolved, words, catalog, segmentsData }) {
  const errors = [];
  const warnings = [];
  
  const segments = segmentsData?.segments || [];
  const confirmed = segmentsData?.confirmed ?? false;
  if (!segmentsData) {
    warnings.push(`W7 no-segment-map: no segments.json — cadence rules assume the whole video is narration; run 'node lib/segments.mjs <slug> --propose'`);
  }

  const kindAt = (t) => (segments.find(s => t >= s.start && t < s.end) ?? {}).kind ?? 'narration';
  const narrationGap = (start, end) => {
    if (!segmentsData) return end - start;
    let total = end - start;
    for (const s of segments) {
      if (s.kind === 'demo' || s.kind === 'playback') {
        const oStart = Math.max(start, s.start);
        const oEnd = Math.min(end, s.end);
        if (oStart < oEnd) total -= (oEnd - oStart);
      }
    }
    return total;
  };

  
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

  // E5 demo-coverage
  for (const r of sortedResolved) {
    const cat = bySlug[r.card];
    if (!cat || cat.placement !== 'fullframe') continue;
    const k = kindAt(r.start);
    if (k === 'demo' || k === 'playback') {
      const msg = `E5 demo-coverage: ${r.id} (${r.card}, fullframe, ${r.duration}s) starts at ${r.start.toFixed(1)}s inside a ${k} segment — a fullframe card replaces the screen recording. Use an overlay card, or move the cue into a narration stretch.`;
      (confirmed ? errors : warnings).push(msg);
    }
  }


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
  if (T < 40) {
    errors.push(`E4 exclusion zones: video too short for graphics (< 40s)`);
  } else {
    for (const r of sortedResolved) {
      if (r.start + r.duration > T - ZONE_END) {
        if (!ENDCARD_SLUG_PREFIXES.some(prefix => r.card.startsWith(prefix))) {
          errors.push(`E4 exclusion-zones: ${r.id} ends at ${(r.start + r.duration).toFixed(1)}s (maximum ${(T - ZONE_END).toFixed(1)}s, total ${T.toFixed(1)}s)`);
        }
      }
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
    const gap = narrationGap(prev.start, curr.start);
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
  const targetMin = Math.round(TARGET_RATE_MIN * T / 60);
  const targetMax = Math.round(TARGET_RATE_MAX * T / 60);
  const count = sortedResolved.length;
  if (count < targetMin || count > targetMax) {
    warnings.push(`W3 total-count: ${count} cues is outside the scaled band [${targetMin}, ${targetMax}] (rate ${TARGET_RATE_MIN}-${TARGET_RATE_MAX}/min) for a ${(T/60).toFixed(1)}min video`);
  }

  // W6 bare-stretch: no interior stretch should sit longer than BARE_GAP_MAX
  // seconds with NO graphic of any kind (fullframe OR overlay) on screen. This
  // is the direct guard against the "long stretches of video without motion
  // graphics" the owner flagged — punctuate demos/bridges with a lightweight
  // overlay or statement. Only gaps BETWEEN cues are checked; the cold-open
  // (first ~15s) and end-zone (last ZONE_END s, kept graphics-free by E4) are
  // deliberately sparse and are not flagged.
  for (let i = 1; i < sortedResolved.length; i++) {
    const prev = sortedResolved[i - 1];
    const curr = sortedResolved[i];
    const gap = narrationGap(prev.start + prev.duration, curr.start);
    if (gap > BARE_GAP_MAX) {
      warnings.push(`W6 bare-stretch: ${gap.toFixed(1)}s with no graphic between ${prev.id} (ends ${(prev.start + prev.duration).toFixed(1)}s) and ${curr.id} (starts ${curr.start.toFixed(1)}s) — max ${BARE_GAP_MAX}s; punctuate with a lightweight overlay or statement card`);
    }
  }

  // W5 first-beat-idle: a beat card whose first reveal lands long after the
  // card appears shows an empty scaffold — anchor the cue closer to beat 1.
  for (const r of sortedResolved) {
    const ats = (r.variables?.beats ?? []).map((b) => Number(b.at)).filter(Number.isFinite);
    if (!ats.length) continue;
    const firstAt = Math.min(...ats);
    const cat = bySlug[r.card];
    if (!cat) continue;
    const pre = cat.pre_beat_render || 'chrome';
    const limit = FIRST_BEAT_IDLE_MAX[pre] ?? FIRST_BEAT_IDLE_MAX.chrome;
    if (firstAt > limit) {
      const msg = `W5 first-beat-idle: ${r.id} shows its first beat ${firstAt.toFixed(1)}s after the card appears (max ${limit}s) — move the cue anchor closer to the first beat`;
      if (cat.placement === 'fullframe') {
        errors.push(msg);
      } else {
        warnings.push(msg);
      }
    }
  }

  // word-sync validation
  for (const c of rawCues) {
    const cat = bySlug[c.card];
    if (cat && cat.kind === 'word-sync') {
      const text = c.variables?.text;
      if (!text || typeof text !== 'string' || text.trim() === '') {
        errors.push(`${c.id}: word-sync card requires variables.text`);
      } else {
        const wcount = text.trim().split(/\s+/).length;
        if (cat.max_beats && wcount > cat.max_beats) {
          errors.push(`${c.id}: sentence is ${wcount} words, max is ${cat.max_beats} — split it into two cues`);
        }
        const accent = c.variables?.accent;
        if (accent && typeof accent === 'string' && accent.trim() !== '') {
          const normWord = (w) => w.toLowerCase().replace(/[^a-z0-9']/g, '');
          const tNorm = text.trim().split(/\s+/).map(normWord).filter(Boolean);
          const aNorm = accent.trim().split(/\s+/).map(normWord).filter(Boolean);
          if (aNorm.length) {
            let found = false;
            for (let i = 0; i <= tNorm.length - aNorm.length; i++) {
              let ok = true;
              for (let k = 0; k < aNorm.length; k++) {
                if (tNorm[i + k] !== aNorm[k]) { ok = false; break; }
              }
              if (ok) { found = true; break; }
            }
            if (!found) {
              errors.push(`${c.id}: accent phrase "${accent}" does not appear in text`);
            }
          }
        }
      }
      if (c.beats && Array.isArray(c.beats) && c.beats.length > 0) {
        errors.push(`${c.id}: word-sync cards must not author beats — timings are derived from the transcript`);
      }
    }
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
  const segmentsPath = path.join(workdir, 'segments.json');

  const cuesFile = JSON.parse(fs.readFileSync(cuesPath, 'utf8'));
  const resolvedFile = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  const words = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  
  let segmentsData = null;
  if (fs.existsSync(segmentsPath)) {
    segmentsData = JSON.parse(fs.readFileSync(segmentsPath, 'utf8'));
  }

  const { errors, warnings } = lintCues({
    cuesFile,
    resolved: resolvedFile.resolved,
    words,
    catalog,
    segmentsData
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
