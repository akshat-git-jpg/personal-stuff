import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from './workdir.mjs';
import { CUE_CONSTANTS, ENDCARD_SLUG_PREFIXES } from './cue-constants.mjs';
import { loadVideoManifest } from './video-manifest.mjs';
import { extendExposure, findPhrase, normWord } from './resolve.mjs';

const CAP_STAT_HIT = CUE_CONSTANTS.CAP_STAT_HIT.value;
const SPACING_STAT_HIT = CUE_CONSTANTS.SPACING_STAT_HIT.value;
const CAP_FULLFRAME = CUE_CONSTANTS.CAP_FULLFRAME.value;
const ZONE_END = CUE_CONSTANTS.ZONE_END.value;
// Density recalibration 2026-07-21 (owner: "motion graphics more frequent —
// long stretches were bare"). Moderate ~2x: fullframe beat every ~35-60s, floor
// rate 1.0/min, and W6 forbids any interior stretch >50s with no graphic at all
// (fullframe OR overlay). Supersedes the Youri-wave starting numbers per the
// same owner-directive precedent; the 060 fold tunes from here. decisions.md.
const GAP_FULLFRAME_MAX = CUE_CONSTANTS.GAP_FULLFRAME_MAX.value;
const GAP_FULLFRAME_MIN = CUE_CONSTANTS.GAP_FULLFRAME_MIN.value;
const DENSITY_OVERLAY_WINDOW = CUE_CONSTANTS.DENSITY_OVERLAY_WINDOW.value;
const DENSITY_OVERLAY_MAX = CUE_CONSTANTS.DENSITY_OVERLAY_MAX.value;
const TARGET_RATE_MIN = CUE_CONSTANTS.TARGET_RATE_MIN.value;
const TARGET_RATE_MAX = CUE_CONSTANTS.TARGET_RATE_MAX.value;
const BARE_GAP_MAX = CUE_CONSTANTS.BARE_GAP_MAX.value; // W6: max interior seconds with NO graphic (any placement) before/after any cue
const NARRATION_BARE_GAP_MAX = CUE_CONSTANTS.NARRATION_BARE_GAP_MAX.value;
const SECTION_FOOTAGE_MIN = CUE_CONSTANTS.SECTION_FOOTAGE_MIN.value; // W11: footage a section opener must hand over to
const HOST_VISIBLE_BY = CUE_CONSTANTS.HOST_VISIBLE_BY.value;
const OPENING_HOST_MIN = CUE_CONSTANTS.OPENING_HOST_MIN.value;
const MAX_FULLFRAME_ONSCREEN = CUE_CONSTANTS.MAX_FULLFRAME_ONSCREEN.value;
// Dead air is now designed out by the resolver's BEAT_LEAD_IN clamp (plan 116);
// W5 stays as the regression detector for that clamp, not as a style hint.
const FIRST_BEAT_IDLE_MAX = { chrome: 1.2, frame: 2.5 };

// Only `avatar-full` REPLACES the base — panel/side/bubble composite on top of
// it, so a second under a panel avatar is still a screen second and would
// still freeze. Mirrors the filter in assemble.mjs's base selection.
export function avatarFullSpans(avatarJobs) {
  return (avatarJobs?.jobs ?? [])
    .filter((j) => j.kind === 'avatar-full' && Number.isFinite(j.start) && Number.isFinite(j.end))
    .map((j) => [j.start, j.end])
    .sort((a, b) => a[0] - b[0]);
}

export function lintCues({ cuesFile, resolved, words, catalog, segmentsData, manifest, conceptData, avatarJobs = null }) {
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
    
    const kPrev = kindAt(prev.start);
    const kCurr = kindAt(curr.start);
    if (['demo', 'playback'].includes(kPrev) || ['demo', 'playback'].includes(kCurr)) continue;

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

  // W6/W7 bare-stretch: no interior stretch should sit longer than max
  // seconds with NO cue start. Punctuate demos/bridges with a lightweight
  // overlay or statement.
  for (let i = 1; i < sortedResolved.length; i++) {
    const prev = sortedResolved[i - 1];
    const curr = sortedResolved[i];
    const gap = curr.start - prev.start;
    const kind = kindAt(prev.start);
    if (kind === 'demo' || kind === 'playback') {
      if (gap > BARE_GAP_MAX) {
        warnings.push(`W6 bare-stretch: ${gap.toFixed(1)}s between ${prev.id} (starts ${prev.start.toFixed(1)}s) and ${curr.id} (starts ${curr.start.toFixed(1)}s) inside a demo segment — max ${BARE_GAP_MAX}s`);
      }
    } else {
      if (gap > NARRATION_BARE_GAP_MAX) {
        warnings.push(`W7 bare-stretch: ${gap.toFixed(1)}s between ${prev.id} (starts ${prev.start.toFixed(1)}s) and ${curr.id} (starts ${curr.start.toFixed(1)}s) inside a narration segment — max ${NARRATION_BARE_GAP_MAX}s`);
      }
    }
  }

  // W11 section-footage (owner rule 2026-07-25, test-03 Final Cut v2:4). Every
  // section must read the same way: the opener, then the tool actually on
  // screen. Two openers where one is followed by 22.6s of screen recording and
  // the other cuts straight to the next graphic reads as an editing mistake.
  {
    const MIN = SECTION_FOOTAGE_MIN;
    const fulls = sortedResolved.filter((c) => c.placement === 'fullframe');
    for (let i = 0; i < fulls.length - 1; i++) {
      const cur = fulls[i];
      if (!bySlug[cur.card]?.structural) continue;
      const footage = +(fulls[i + 1].start - (cur.start + cur.duration)).toFixed(2);
      if (footage < MIN) {
        warnings.push(`W11 section-footage: ${cur.id} (${cur.card}) is followed by only ${footage.toFixed(1)}s of footage before ${fulls[i + 1].id} (min ${MIN}s) — a section opener should hand over to the tool on screen, not cut straight to another graphic`);
      }
    }
  }

  // W12 opening-host-coverage
  {
    const introPart = (segmentsData?.structure ?? []).find((s) => s.part === 'intro');
    const BY = introPart ? introPart.end : HOST_VISIBLE_BY;
    let intervals = []; 
    for (const r of sortedResolved) {
      if (r.placement === 'fullframe') {
        const start = Math.max(0, r.start);
        const end = Math.min(BY, r.start + r.duration);
        if (start < end) {
          intervals.push([start, end]);
        }
      }
    }
    intervals.sort((a, b) => a[0] - b[0]);
    let covered = 0;
    let current = null;
    for (const int of intervals) {
      if (!current) {
        current = [...int];
      } else if (int[0] <= current[1]) {
        current[1] = Math.max(current[1], int[1]);
      } else {
        covered += current[1] - current[0];
        current = [...int];
      }
    }
    if (current) {
      covered += current[1] - current[0];
    }
    const freeTime = BY - covered;
    if (freeTime < OPENING_HOST_MIN) {
      const windowName = introPart ? 'the intro' : `the first ${BY}s`;
      warnings.push(`W12 opening-host-coverage: ${windowName} leaves only ${freeTime.toFixed(1)}s for the presenter on screen (min ${OPENING_HOST_MIN}s)`);
    }
  }

  // W13 frozen-fullframe
  for (const r of sortedResolved) {
    if (r.placement === 'fullframe' && r.duration > MAX_FULLFRAME_ONSCREEN) {
      const c = rawCues.find(cue => cue.id === r.id);
      if (c && (!c.beats || c.beats.length === 0)) {
        warnings.push(`W13 frozen-fullframe: ${r.id} holds the screen for ${r.duration.toFixed(1)}s without any beats (max ${MAX_FULLFRAME_ONSCREEN}s)`);
      }
    }
  }

  // W14 zone-underserved (owner 2026-07-28). Not an editorial rule — a zone
  // the owner recorded and named, carrying no graphics at all, is a gap
  // rather than a style choice. test-03's conclusion had zero cues because
  // the cut never reached it. What goes IN the zone stays the cue pass's call.
  for (const part of (segmentsData?.structure ?? [])) {
    if (part.part === 'body') continue;
    const inZone = sortedResolved.filter((r) => r.start >= part.start && r.start < part.end);
    if (inZone.length === 0) {
      warnings.push(`W14 zone-underserved: the ${part.part} (${part.start.toFixed(1)}s-${part.end.toFixed(1)}s) has no cues at all — it is the part of the video that matters most and it is carrying no graphics`);
    }
  }

  // W9 variant-rotation. Structural cards are EXEMPT: they fill a repeated
  // semantic slot and the resolver deliberately pins them to variants[0], so
  // "same card, same variant, back to back" is the intended result there, not
  // a defect (owner v2:6 2026-07-24 — "don't switch"). Without this exemption
  // W9 nags on exactly the behaviour the owner asked for.
  for (let i = 1; i < sortedResolved.length; i++) {
    const prev = sortedResolved[i - 1];
    const curr = sortedResolved[i];
    if (bySlug[curr.card]?.structural) continue;
    if (prev.card === curr.card && prev.variables?.variant && curr.variables?.variant && prev.variables.variant === curr.variables.variant) {
      warnings.push(`W9 variant-rotation: ${curr.id} uses the same card and variant ("${curr.variables.variant}") as the immediately preceding cue ${prev.id} — rotate the variant or vary the device`);
    }
  }

  // E7 uncovered-second. "Uncovered" means the second would render as a FREEZE
  // frame — assemble.mjs only freezes segments of kind `screen`, and an
  // avatar-full span replaces the base, so a second under the presenter needs
  // no card. Without this, E7 demanded card coverage over the presenter and
  // pushed cards into the end-exclusion zone (plan 158, 2026-07-28).
  if (manifest?.base === 'none') {
    const extended = extendExposure(sortedResolved, { base: 'none', total: T, avatarSpans: avatarFullSpans(avatarJobs) });
    const fulls = extended.filter(c => bySlug[c.card]?.placement === 'fullframe').sort((a, b) => a.start - b.start);
    if (fulls.length > 0) {
      const activeEnd = T - ZONE_END;
      const spans = [
        ...fulls.map(f => [f.start, f.start + f.duration]),
        ...avatarFullSpans(avatarJobs),
      ].sort((a, b) => a[0] - b[0]);
      let cursor = spans[0][0];
      for (const [s, e] of spans) {
        if (s > cursor) {
          const gapEnd = Math.min(s, activeEnd);
          if (cursor < gapEnd) {
            errors.push(`E7 uncovered-second: base is none, but [${cursor.toFixed(1)}–${gapEnd.toFixed(1)}] is covered by neither a fullframe card nor the presenter`);
          }
        }
        cursor = Math.max(cursor, e);
      }
      if (cursor < activeEnd) {
        errors.push(`E7 uncovered-second: base is none, but [${cursor.toFixed(1)}–${activeEnd.toFixed(1)}] is covered by neither a fullframe card nor the presenter`);
      }
    }
  }

  // E9 overlay-over-graphic (owner rule 2026-07-24, test-01 Final Cut :2/:10):
  // overlays composite on top of whatever the base track shows — over a
  // fullframe card's span (INCLUDING its extended-exposure hold) two graphics
  // stack and read as an editing bug. Overlays may only sit on footage.
  {
    const extended = extendExposure(sortedResolved, {
      base: manifest?.base ?? 'screen',
      total: T,
      // Same spans E7 uses. Without them the clamp in extendExposure never
      // applies here, so E9 measures a hold the pipeline will never produce
      // and reports end CTAs as overlapping a card they sit beside.
      avatarSpans: avatarFullSpans(avatarJobs),
    });
    const fullSpans = extended
      .filter(c => bySlug[c.card]?.placement === 'fullframe')
      .map(c => ({ id: c.id, start: c.start, end: c.start + c.duration }));
    for (const r of sortedResolved) {
      const cat = bySlug[r.card];
      if (!cat || cat.placement !== 'overlay') continue;
      const oEnd = r.start + r.duration;
      const hit = fullSpans.find(f => r.start < f.end && oEnd > f.start);
      if (hit) {
        errors.push(`E9 overlay-over-graphic: ${r.id} (${r.card}) [${r.start.toFixed(1)}–${oEnd.toFixed(1)}] overlaps fullframe ${hit.id} [${hit.start.toFixed(1)}–${hit.end.toFixed(1)}] — overlays sit on footage only; move the anchor past the card (or earlier), or fold the content into the card`);
      }
    }
  }

  // E10 no-dash-copy (owner rule 2026-07-24, test-01 v2 Final Cut :1): em/en
  // dashes in RENDERED copy read as machine-written text. Scans variables and
  // beat reveals only — cue metadata (legacy_why, register_why) never renders.
  {
    const dashRe = /[—–]/;
    const scan = (val, where) => {
      if (typeof val === 'string' && dashRe.test(val)) {
        errors.push(`E10 no-dash-copy: ${where} contains an em/en dash ("${val}") — use ":", "·", or plain words`);
      } else if (Array.isArray(val)) {
        val.forEach((v, i) => scan(v, `${where}[${i}]`));
      } else if (val && typeof val === 'object') {
        for (const [k, v] of Object.entries(val)) scan(v, `${where}.${k}`);
      }
    };
    for (const c of rawCues) {
      scan(c.variables ?? {}, `${c.id} variables`);
      (c.beats ?? []).forEach((b, i) => scan(b.reveal ?? {}, `${c.id} beat ${i + 1}`));
    }
  }

  // E11 no-filler-slate (owner rule 2026-07-24, test-01 v2 Final Cut :11 —
  // "what is the criteria to decide when to show this text motion graphics.
  // Because this was not at all a appropriate time"). A kinetic-sentence or
  // keyword-statement takes the WHOLE frame, so the sentence it shows has to
  // be worth the frame. What shipped was "So let's talk about the good ones
  // first" — a discourse marker with no claim in it, covering a live product
  // walkthrough. Navigational phrases belong on a section card, or nowhere.
  {
    const SENTENCE_CARDS = new Set(['slate/kinetic-sentence', 'statement/keyword-statement']);
    const FILLER_RE = /^(?:so|now|and|but|ok|okay|alright|right|well)?[\s,]*(?:let'?s\s+(?:talk|look|dive|jump|get|move|start|begin|see|check)\b|first\s+up\b|next\s+up\b|moving\s+on\b|before\s+we\b|to\s+start\s+with\b|with\s+that\s+said\b)/i;
    for (const c of rawCues) {
      if (!SENTENCE_CARDS.has(c.card)) continue;
      const text = c.variables?.text;
      if (typeof text === 'string' && FILLER_RE.test(text.trim())) {
        errors.push(`E11 no-filler-slate: ${c.id} (${c.card}) shows "${text}" — that is a navigational phrase, not a point. A full-frame sentence card must state a claim, consequence, or substance; route the transition to a section card or drop the cue`);
      }
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

  // E8 and W8: concept rules
  if (conceptData) {
    const W = words.map((x) => ({ ...x, n: normWord(x.text) })).filter((x) => x.n);
    const resolvedSpans = [];
    let cursor = 0;
    for (const reg of conceptData.registers || []) {
      const from = findPhrase(W, reg.from_anchor, cursor);
      if (from.err) continue;
      const to = findPhrase(W, reg.to_anchor, from.idx);
      if (to.err) continue;
      resolvedSpans.push({
        register: reg.register,
        startTime: from.start,
        // rough end time for containment check; we assume it covers up to 'to'
        // wait, we can just find 'to' end
        endTime: to.start + 1.0 
      });
      cursor = to.idx + to.len;
    }

    let motifCount = 0;
    for (const c of rawCues) {
      if (c.motif) motifCount++;
      
      if (c.register && c.register !== 'dark' && c.register !== 'light') {
        errors.push(`E8 concept-register: ${c.id} register must be dark or light, got "${c.register}"`);
      }
      
      const res = validResolved.find(r => r.id === c.id);
      if (res) {
        // Find if it falls in a register span. Wait, span is [from.start, to.start] or more accurately up to next span.
        // Let's just find the last span that starts before or at res.start
        const span = [...resolvedSpans].reverse().find(s => res.start >= s.startTime);
        if (span && span.register !== c.register && !c.register_why) {
          errors.push(`E8 concept-register: ${c.id} starts at ${res.start.toFixed(1)}s inside a ${span.register} span, but cue register is ${c.register || 'missing'} (and no register_why given)`);
        }
      }
    }
    
    if (motifCount < CUE_CONSTANTS.MOTIF_MIN.value) {
      warnings.push(`W8 motif: concept.json exists but fewer than 2 cues carry motif: true (the through-line never recurs) (min ${CUE_CONSTANTS.MOTIF_MIN.value})`);
    }
  }

  // W10 enacted-first
  for (const c of rawCues) {
    const cat = bySlug[c.card];
    if (cat && cat.placement === 'fullframe' && !cat.structural) {
      if (!c.card.startsWith('enacted/') && !c.legacy_why) {
        warnings.push(`W10 enacted-first: ${c.id} uses legacy card ${c.card} without legacy_why — prefer the enacted/ family`);
      }
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
  
  const conceptPath = path.join(workdir, 'concept.json');
  let conceptData = null;
  if (fs.existsSync(conceptPath)) {
    conceptData = JSON.parse(fs.readFileSync(conceptPath, 'utf8'));
  }
  
  const manifest = loadVideoManifest(workdir);

  const avatarJobsPath = path.join(workdir, 'avatar-jobs.json');
  let avatarJobs = null;
  if (fs.existsSync(avatarJobsPath)) {
    avatarJobs = JSON.parse(fs.readFileSync(avatarJobsPath, 'utf8'));
  }

  const { errors, warnings } = lintCues({
    cuesFile,
    resolved: resolvedFile.resolved,
    words,
    catalog,
    segmentsData,
    manifest,
    conceptData,
    avatarJobs
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
