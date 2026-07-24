import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from './workdir.mjs';
import { findPhrase, normWord } from './resolve.mjs';

export function lintConcept(concept, words) {
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

  const errors = lintConcept(concept, words);

  if (errors.length) {
    for (const e of errors) console.error(e);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
