import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from './workdir.mjs';
import { findPhrase, normWord } from './resolve.mjs';
import { spansFromRegisters } from './concept-spans.mjs';

// The register map must cover at least this share of NARRATION time. Demo and
// playback stretches are excluded: only overlay pills are legal there and a pill
// carries no full-frame mood, so a register over them would mean nothing.
//
// Why it is a gate and not advice (owner rule 2026-07-30): a cue in an uncovered
// stretch inherits no register, so its card falls back to its own default look
// and E8 has no span to check it against — the tone drifts with nobody watching.
// That is the same failure class as the 2026-07-24 bug where register never
// reached VARS and every card rendered its default.
export const MIN_NARRATION_COVERAGE = 0.8;

// Returns { covered, total, ratio } over narration time, or null when there is
// nothing to measure (no segments supplied, or no narration in them).
export function narrationCoverage(concept, words, segments) {
  if (!Array.isArray(segments)) return null;

  const narration = segments.filter((s) => s.kind === 'narration');
  const total = narration.reduce((sum, s) => sum + Math.max(0, s.end - s.start), 0);
  if (total <= 0) return null;

  const spans = spansFromRegisters(concept.registers, words);

  // Sum the overlap of each register span with each narration segment. Spans are
  // non-overlapping by construction (the cursor only moves forward), so summing
  // overlaps cannot double-count.
  let covered = 0;
  for (const seg of narration) {
    for (const span of spans) {
      covered += Math.max(0, Math.min(seg.end, span.end) - Math.max(seg.start, span.start));
    }
  }

  return { covered, total, ratio: covered / total };
}

export function lintConcept(concept, words, segments) {
  const errors = [];
  
  if (!concept.video) errors.push('missing required field: video');
  
  if (!concept.thesis) {
    errors.push('missing required field: thesis');
  } else {
    if (concept.thesis.length > 200) {
      errors.push(`thesis exceeds 200 chars: ${concept.thesis.length}`);
    }
    const thesisWords = concept.thesis.trim().split(/\s+/).filter(Boolean);
    if (thesisWords.length < 6) {
      errors.push('thesis lacks a verb-bearing claim (must contain at least 6 words)');
    }
  }

  if (!concept.frame) errors.push('missing required field: frame');

  if (!concept.throughline) {
    errors.push('missing required field: throughline');
  } else {
    if (!concept.throughline.name) errors.push('missing required field: throughline.name');
    if (!concept.throughline.description) errors.push('missing required field: throughline.description');
    if (!concept.throughline.evolution) errors.push('missing required field: throughline.evolution');
  }

  if (!concept.registers || !Array.isArray(concept.registers)) {
    errors.push('missing required field: registers');
  } else {
    const W = words.map((x) => ({ ...x, n: normWord(x.text) })).filter((x) => x.n);
    let cursor = 0;
    
    for (const [i, reg] of concept.registers.entries()) {
      if (reg.register !== 'dark' && reg.register !== 'light') {
        errors.push(`register[${i}]: must be dark or light, got "${reg.register}"`);
      }
      if (!reg.from_anchor) {
        errors.push(`register[${i}]: missing from_anchor`);
        continue;
      }
      if (!reg.to_anchor) {
        errors.push(`register[${i}]: missing to_anchor`);
        continue;
      }

      const fromResult = findPhrase(W, reg.from_anchor, cursor);
      if (fromResult.err) {
        errors.push(`register[${i}] from_anchor: ${fromResult.err}`);
        continue;
      }
      
      const toResult = findPhrase(W, reg.to_anchor, fromResult.idx);
      if (toResult.err) {
        errors.push(`register[${i}] to_anchor: ${toResult.err}`);
        continue;
      }
      
      cursor = toResult.idx + toResult.len;
    }
  }

  // Only meaningful once every anchor resolved — an unresolved anchor drops its
  // span, which would report a coverage shortfall that is really an anchor typo.
  if (!errors.length) {
    const cov = narrationCoverage(concept, words, segments);
    if (cov && cov.ratio < MIN_NARRATION_COVERAGE) {
      errors.push(
        `narration coverage ${(cov.ratio * 100).toFixed(1)}% is below the required ` +
        `${(MIN_NARRATION_COVERAGE * 100).toFixed(0)}% ` +
        `(${cov.covered.toFixed(1)}s of ${cov.total.toFixed(1)}s narration): ` +
        `cards in the uncovered stretches inherit no register and fall back to their default look. ` +
        `Extend a span over the uncovered narration rather than merging two spans of the SAME register, ` +
        `which raises the figure without changing anything on screen.`,
      );
    }
  }

  return errors;
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('usage: node lib/lint-concept.mjs <slug-or-path>');
    process.exit(1);
  }
  const workdir = resolveWorkdir(arg);
  const conceptPath = path.join(workdir, 'concept.json');
  const transcriptPath = path.join(workdir, 'transcript.json');

  if (!fs.existsSync(conceptPath)) {
    console.error(`concept.json not found in ${workdir}`);
    process.exit(1);
  }

  const concept = JSON.parse(fs.readFileSync(conceptPath, 'utf8'));
  const words = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));

  // segments.json is a step-015 output and 015 always precedes 020, so a missing
  // file means the flow was run out of order — not a reason to skip the gate.
  const segmentsPath = path.join(workdir, 'segments.json');
  if (!fs.existsSync(segmentsPath)) {
    console.error(`segments.json not found in ${workdir} — run "run.sh <slug> segments" first; narration coverage cannot be gated without it`);
    process.exit(1);
  }
  const segments = JSON.parse(fs.readFileSync(segmentsPath, 'utf8')).segments;

  const errors = lintConcept(concept, words, segments);

  if (errors.length) {
    for (const e of errors) console.error(e);
    process.exit(1);
  }

  const cov = narrationCoverage(concept, words, segments);
  if (cov) {
    console.log(`narration coverage ${(cov.ratio * 100).toFixed(1)}% (${cov.covered.toFixed(1)}s of ${cov.total.toFixed(1)}s)`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
