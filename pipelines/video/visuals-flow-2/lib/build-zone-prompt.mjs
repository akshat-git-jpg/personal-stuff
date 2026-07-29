// Renders lib/zone-constants.mjs + lib/zone-rules.mjs into the step-035 prompt.
// Mirrors lib/build-prompt.mjs (which does the same for the body pass) — the
// two are intentionally separate programs writing separate prompts, so a body
// rule can never reach the zone model or the reverse.
import fs from 'node:fs';
import path from 'node:path';
import { ZONE_CONSTANTS } from './zone-constants.mjs';
import { ZONE_RULES } from './zone-rules.mjs';

export const BEGIN_MARKER = '<!-- BEGIN GENERATED ZONE CONSTRAINTS — edit lib/zone-constants.mjs, then run node lib/build-zone-prompt.mjs -->';
export const END_MARKER = '<!-- END GENERATED ZONE CONSTRAINTS -->';

export const RULES_BEGIN_MARKER = '<!-- BEGIN GENERATED ZONE RULES — edit lib/zone-rules.mjs, then run node lib/build-zone-prompt.mjs -->';
export const RULES_END_MARKER = '<!-- END GENERATED ZONE RULES -->';

export const PROMPT_PATH = path.resolve(import.meta.dirname, '..', 'steps', '035-pick-or-propose-intro-outro-llm', 'zone-pass-prompt.md');

export function renderConstraintLines(zoneConstants = ZONE_CONSTANTS) {
  const lines = [];
  for (const [key, constant] of Object.entries(zoneConstants)) {
    if (!constant.rule) continue;
    lines.push({ key, text: `- ${constant.rule}` });
  }
  return lines;
}

export function renderConstraintsBlock(zoneConstants = ZONE_CONSTANTS) {
  const header = [
    'These are HARD constraints checked by lib/lint-cues.mjs (W15-W17, W19) and',
    'lib/stillness.mjs (W18) after you produce your cues.',
    'A violation is a defect, not a stylistic choice. Budget against them BEFORE placing cues.',
    '',
  ];
  const lines = renderConstraintLines(zoneConstants).map((l) => l.text);
  return [...header, ...lines].join('\n');
}

export function renderRuleLines(zoneRules = ZONE_RULES) {
  return Object.entries(zoneRules).map(([key, r]) => ({ key, text: r.rule }));
}

export function renderRulesBlock(zoneRules = ZONE_RULES) {
  return renderRuleLines(zoneRules).map((l) => l.text).join('\n\n');
}

function withGeneratedBlock(promptText, block, beginMarker, endMarker) {
  const beginIdx = promptText.indexOf(beginMarker);
  const endIdx = promptText.indexOf(endMarker);
  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
    throw new Error(`zone-pass-prompt.md is missing markers: ${beginMarker} / ${endMarker}`);
  }
  const before = promptText.slice(0, beginIdx + beginMarker.length);
  const after = promptText.slice(endIdx);
  return `${before}\n${block}\n${after}`;
}

function main() {
  const check = process.argv.includes('--check');
  const current = fs.readFileSync(PROMPT_PATH, 'utf8');
  const withConstraints = withGeneratedBlock(current, renderConstraintsBlock(), BEGIN_MARKER, END_MARKER);
  const rendered = withGeneratedBlock(withConstraints, renderRulesBlock(), RULES_BEGIN_MARKER, RULES_END_MARKER);

  if (check) {
    if (rendered !== current) {
      console.error('zone prompt OUT OF DATE — run node lib/build-zone-prompt.mjs');
      process.exit(1);
    }
    console.log('zone prompt up to date');
    return;
  }

  fs.writeFileSync(PROMPT_PATH, rendered);
  console.log('zone prompt up to date');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
