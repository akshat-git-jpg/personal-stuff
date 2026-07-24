import fs from 'node:fs';
import path from 'node:path';
import { CUE_CONSTANTS, ENDCARD_SLUG_PREFIXES } from './cue-constants.mjs';

// A fullframe "slot" is a window in which placing exactly one fullframe cue
// keeps W1 satisfied. Slots are laid only across narration time, because a
// fullframe inside demo/playback is a hard error (lint E5, plan 117).
export function buildSlots(segments, total, C) {
  const MIN = C.GAP_FULLFRAME_MIN.value;   // 35
  const MAX = C.GAP_FULLFRAME_MAX.value;   // 60
  const endZone = total - C.ZONE_END.value;

  // Narration runs, trimmed to the end zone.
  const runs = segments
    .filter(s => s.kind === 'narration')
    .map(s => ({ start: s.start, end: Math.min(s.end, endZone) }))
    .filter(s => s.end - s.start > 0);

  // Walk narration time as one continuous axis: demo/playback stretches are
  // skipped, not counted, so a long demo never manufactures a cadence debt.
  const slots = [];
  let carried = 0;        // narration seconds accumulated since the last slot
  const TARGET = (MIN + MAX) / 2;  // 47.5 — aim mid-band so both bounds hold
  for (const run of runs) {
    let t = run.start;
    while (t < run.end) {
      const need = TARGET - carried;
      if (t + need <= run.end) {
        t += need;
        slots.push({ at: +t.toFixed(1), windowMin: +(t - (TARGET - MIN)).toFixed(1), windowMax: +(t + (MAX - TARGET)).toFixed(1) });
        carried = 0;
      } else {
        carried += run.end - t;
        break;
      }
    }
  }
  return slots;
}

export function buildBudget(total, C) {
  const minCues = Math.round(C.TARGET_RATE_MIN.value * total / 60);
  const maxCues = Math.round(C.TARGET_RATE_MAX.value * total / 60);
  return { minCues, maxCues, capPerFullframeCard: C.CAP_FULLFRAME.value,
           capStatHit: C.CAP_STAT_HIT.value, statHitSpacing: C.SPACING_STAT_HIT.value };
}

export function buildZones(segments, total, C) {
  const endZoneTime = total - C.ZONE_END.value;
  const overlayOnly = segments.filter(s => s.kind === 'demo' || s.kind === 'playback');
  return { endZoneTime, endcardPrefixes: ENDCARD_SLUG_PREFIXES, overlayOnly };
}

export function getSentences(transcriptWords) {
  const sentences = [];
  let currentSentence = [];
  let startT = null;
  
  for (const word of transcriptWords) {
    if (startT === null) startT = word.start;
    currentSentence.push(word.text);
    if (/[.?!]$/.test(word.text)) {
      sentences.push({ start: startT, text: currentSentence.join(' ') });
      currentSentence = [];
      startT = null;
    }
  }
  if (currentSentence.length > 0) {
    sentences.push({ start: startT, text: currentSentence.join(' ') });
  }
  return sentences;
}

function findNearestSentence(sentences, time) {
  if (sentences.length === 0) return "";
  let nearest = sentences[0];
  let minDiff = Math.abs(time - nearest.start);
  for (const s of sentences) {
    const diff = Math.abs(time - s.start);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = s;
    }
  }
  return nearest.text;
}

export function buildSkeleton(total, segments, transcriptWords, C) {
  const slots = buildSlots(segments, total, C);
  const budget = buildBudget(total, C);
  const zones = buildZones(segments, total, C);
  const sentences = getSentences(transcriptWords);
  
  const enhancedSlots = slots.map((s, i) => ({
    slot: i + 1,
    ...s,
    sentence: findNearestSentence(sentences, s.at)
  }));
  
  const overlayCapacity = [];
  const max = C.DENSITY_OVERLAY_MAX.value;
  const window = C.DENSITY_OVERLAY_WINDOW.value;
  for (let t = 0; t < total; t += window) {
    overlayCapacity.push({ windowStart: t, windowEnd: Math.min(t + window, total), max });
  }

  return { budget, zones, slots: enhancedSlots, overlayCapacity };
}

// Workdirs live at <visuals-flow>/videos/<slug> — the '..', '..' hop belongs to
// the card-library lookups, not here.
export function resolveVideoDir(root, slug) {
  return path.join(root, 'videos', slug);
}

function renderMarkdown(skeleton, total) {
  const { budget, zones, slots, overlayCapacity } = skeleton;
  
  let md = [];
  
  md.push(`## Budget`);
  md.push(`- Total duration: ${total.toFixed(1)}s`);
  md.push(`- Cue count band: [${budget.minCues}, ${budget.maxCues}]`);
  md.push(`- Fullframe slot count: ${slots.length}`);
  md.push(`- Overlay allowance: ${overlayCapacity.length > 0 ? overlayCapacity[0].max : 0} per minute`);
  md.push(`- Per-card caps: fullframe=${budget.capPerFullframeCard}, stat-hit=${budget.capStatHit} (spacing ${budget.statHitSpacing}s)`);
  md.push(``);
  
  md.push(`## Forbidden zones`);
  md.push(`- End zone: ${zones.endZoneTime.toFixed(1)}s to end`);
  md.push(`  Allowed end-cards: ${zones.endcardPrefixes.join(', ')}`);
  for (const s of zones.overlayOnly) {
    md.push(`- Overlay-only segment (${s.kind}): ${s.start.toFixed(1)}s to ${s.end.toFixed(1)}s`);
  }
  md.push(``);
  
  md.push(`## Fullframe slots`);
  md.push(`| Slot | Target | Window | Nearest Sentence |`);
  md.push(`|---|---|---|---|`);
  for (const s of slots) {
    md.push(`| ${s.slot} | ${s.at.toFixed(1)}s | [${s.windowMin.toFixed(1)}s, ${s.windowMax.toFixed(1)}s] | ${s.sentence} |`);
  }
  md.push(``);
  
  md.push(`## Overlay capacity`);
  md.push(`| Window | Available |`);
  md.push(`|---|---|`);
  for (const c of overlayCapacity) {
    md.push(`| ${c.windowStart.toFixed(1)}s - ${c.windowEnd.toFixed(1)}s | ${c.max} |`);
  }
  md.push(``);
  
  md.push(`## Ledger`);
  md.push(`| Slot | Target | Card | Uses so far |`);
  md.push(`|---|---|---|---|`);
  for (const s of slots) {
    md.push(`| ${s.slot} | ${s.at.toFixed(1)}s | | |`);
  }
  md.push(``);
  
  return md.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const slug = args[0];
  const isJson = args[1] === '--json';
  
  if (!slug) {
    console.error('Usage: node plan-skeleton.mjs <slug> [--json]');
    process.exit(1);
  }
  
  const root = path.resolve(import.meta.dirname, '..');
  const videoDir = resolveVideoDir(root, slug);
  const segmentsPath = path.join(videoDir, 'segments.json');
  const transcriptPath = path.join(videoDir, 'transcript.json');
  
  if (!fs.existsSync(segmentsPath)) {
    console.error(`Segments missing: ${segmentsPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(transcriptPath)) {
    console.error(`Transcript missing: ${transcriptPath}`);
    process.exit(1);
  }
  
  const segmentsData = JSON.parse(fs.readFileSync(segmentsPath, 'utf8'));
  const transcriptWords = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));
  
  const total = transcriptWords.length > 0 ? transcriptWords[transcriptWords.length - 1].end : 0;
  
  const skeleton = buildSkeleton(total, segmentsData.segments, transcriptWords, CUE_CONSTANTS);
  
  if (isJson) {
    console.log(JSON.stringify(skeleton, null, 2));
  } else {
    console.log(renderMarkdown(skeleton, total));
  }
}
