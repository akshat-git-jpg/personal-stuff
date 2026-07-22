import fs from 'node:fs';
import path from 'node:path';
import { CUE_CONSTANTS, ENDCARD_SLUG_PREFIXES } from './cue-constants.mjs';
import { CUE_RULES } from './cue-rules.mjs';

export const BEGIN_MARKER = '<!-- BEGIN GENERATED CONSTRAINTS — edit lib/cue-constants.mjs, then run node lib/build-prompt.mjs -->';
export const END_MARKER = '<!-- END GENERATED CONSTRAINTS -->';

export const RULES_BEGIN_MARKER = '<!-- BEGIN GENERATED ROUTING RULES — edit lib/cue-rules.mjs, then run node lib/build-prompt.mjs -->';
export const RULES_END_MARKER = '<!-- END GENERATED ROUTING RULES -->';

export const PROMPT_PATH = path.resolve(import.meta.dirname, '..', 'steps', '020-cue-pass-llm', 'cue-pass-prompt.md');

// Returns one entry per rendered bullet, tagged with the constant key that
// produced it — lets check-rulebook.mjs name the offending constant on drift
// instead of just dumping a whole-block diff.
export function renderConstraintLines(cueConstants = CUE_CONSTANTS, endcardSlugPrefixes = ENDCARD_SLUG_PREFIXES) {
  const lines = [];
  for (const [key, constant] of Object.entries(cueConstants)) {
    if (!constant.rule) continue;
    lines.push({ key, text: `- ${constant.rule}` });
  }
  lines.push({
    key: 'ENDCARD_SLUG_PREFIXES',
    text: `- End-card slugs exempt from the last-${cueConstants.ZONE_END.value}s rule: ${endcardSlugPrefixes.join(', ')}`,
  });
  return lines;
}

export function renderConstraintsBlock(cueConstants = CUE_CONSTANTS, endcardSlugPrefixes = ENDCARD_SLUG_PREFIXES) {
  const header = [
    'These are HARD constraints checked by lib/lint-cues.mjs after you produce cues.json.',
    'A violation is a defect, not a stylistic choice. Budget against them BEFORE placing cues.',
    '',
  ];
  const lines = renderConstraintLines(cueConstants, endcardSlugPrefixes).map((l) => l.text);
  return [...header, ...lines].join('\n');
}

// One entry per rendered rule, tagged with its rule id — lets
// check-rulebook.mjs name the offending rule on drift.
export function renderRuleLines(cueRules = CUE_RULES) {
  return Object.entries(cueRules).map(([key, r]) => ({ key, text: r.rule }));
}

export function renderRulesBlock(cueRules = CUE_RULES) {
  return renderRuleLines(cueRules).map((l) => l.text).join('\n\n');
}

function withGeneratedBlock(promptText, block, beginMarker, endMarker) {
  const beginIdx = promptText.indexOf(beginMarker);
  const endIdx = promptText.indexOf(endMarker);
  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
    throw new Error(`cue-pass-prompt.md is missing markers: ${beginMarker} / ${endMarker}`);
  }
  const before = promptText.slice(0, beginIdx + beginMarker.length);
  const after = promptText.slice(endIdx);
  return `${before}\n${block}\n${after}`;
}

function main() {
  const check = process.argv.includes('--check');
  const current = fs.readFileSync(PROMPT_PATH, 'utf8');
  const constraintsBlock = renderConstraintsBlock();
  const rulesBlock = renderRulesBlock();
  const withConstraints = withGeneratedBlock(current, constraintsBlock, BEGIN_MARKER, END_MARKER);
  const rendered = withGeneratedBlock(withConstraints, rulesBlock, RULES_BEGIN_MARKER, RULES_END_MARKER);

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
