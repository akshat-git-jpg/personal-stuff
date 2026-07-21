import fs from 'node:fs';
import path from 'node:path';
import { CUE_CONSTANTS, ENDCARD_SLUG_PREFIXES } from './cue-constants.mjs';

export const BEGIN_MARKER = '<!-- BEGIN GENERATED CONSTRAINTS — edit lib/cue-constants.mjs, then run node lib/build-prompt.mjs -->';
export const END_MARKER = '<!-- END GENERATED CONSTRAINTS -->';

export const PROMPT_PATH = path.resolve(import.meta.dirname, '..', 'steps', '020-cue-pass-llm', 'cue-pass-prompt.md');

export function renderConstraintsBlock() {
  const lines = [
    'These are HARD constraints checked by lib/lint-cues.mjs after you produce cues.json.',
    'A violation is a defect, not a stylistic choice. Budget against them BEFORE placing cues.',
    '',
  ];
  for (const constant of Object.values(CUE_CONSTANTS)) {
    if (!constant.rule) continue;
    lines.push(`- ${constant.rule}`);
  }
  lines.push(`- End-card slugs exempt from the last-${CUE_CONSTANTS.ZONE_END.value}s rule: ${ENDCARD_SLUG_PREFIXES.join(', ')}`);
  return lines.join('\n');
}

function withGeneratedBlock(promptText, block) {
  const beginIdx = promptText.indexOf(BEGIN_MARKER);
  const endIdx = promptText.indexOf(END_MARKER);
  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
    throw new Error(`cue-pass-prompt.md is missing the generated-constraints markers`);
  }
  const before = promptText.slice(0, beginIdx + BEGIN_MARKER.length);
  const after = promptText.slice(endIdx);
  return `${before}\n${block}\n${after}`;
}

function main() {
  const check = process.argv.includes('--check');
  const current = fs.readFileSync(PROMPT_PATH, 'utf8');
  const block = renderConstraintsBlock();
  const rendered = withGeneratedBlock(current, block);

  if (check) {
    if (rendered !== current) {
      console.error('prompt constraints OUT OF DATE — run node lib/build-prompt.mjs\n');
      console.error('--- current ---');
      console.error(current);
      console.error('--- expected ---');
      console.error(rendered);
      process.exit(1);
    }
    console.log('prompt constraints up to date');
    return;
  }

  fs.writeFileSync(PROMPT_PATH, rendered);
  console.log('prompt constraints up to date');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
