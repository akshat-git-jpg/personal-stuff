// Renders lib/zone-constants.mjs + lib/zone-rules.mjs into the step-035 prompt.
// Mirrors lib/build-prompt.mjs (which does the same for the body pass) — the
// two are intentionally separate programs writing separate prompts, so a body
// rule can never reach the zone model or the reverse.
import fs from 'node:fs';
import path from 'node:path';
import { ZONE_CONSTANTS, zonePartsFor } from './zone-constants.mjs';
import { ZONE_RULES } from './zone-rules.mjs';
import { resolveWorkdir } from './workdir.mjs';
import { stepDir } from './steps.mjs';

export const BEGIN_MARKER = '<!-- BEGIN GENERATED ZONE CONSTRAINTS — edit lib/zone-constants.mjs, then run node lib/build-zone-prompt.mjs -->';
export const END_MARKER = '<!-- END GENERATED ZONE CONSTRAINTS -->';

export const RULES_BEGIN_MARKER = '<!-- BEGIN GENERATED ZONE RULES — edit lib/zone-rules.mjs, then run node lib/build-zone-prompt.mjs -->';
export const RULES_END_MARKER = '<!-- END GENERATED ZONE RULES -->';

export const PROMPT_PATH = path.join(stepDir('035'), 'zone-pass-prompt.md');

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

export function renderRuleLines(zoneRules = ZONE_RULES, workdir = null) {
  const rules = { ...zoneRules };
  if (workdir && !zonePartsFor(workdir).includes('intro')) {
    rules.R_ZONE_SCOPE = {
      ...rules.R_ZONE_SCOPE,
      rule: 'The INTRO of this video is authored as a bespoke film (step 025) and is NOT yours. Author the CONCLUSION only. Do not emit any cue with `zone: "intro"`.',
    };
  }
  return Object.entries(rules).map(([key, r]) => ({ key, text: r.rule }));
}

export function renderRulesBlock(zoneRules = ZONE_RULES, workdir = null) {
  return renderRuleLines(zoneRules, workdir).map((l) => l.text).join('\n\n');
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
  const slug = process.argv.find((a, i) => i > 1 && !a.startsWith('--'));
  const workdir = slug ? resolveWorkdir(slug) : null;
  const current = fs.readFileSync(PROMPT_PATH, 'utf8');
  const withConstraints = withGeneratedBlock(current, renderConstraintsBlock(), BEGIN_MARKER, END_MARKER);
  const rendered = withGeneratedBlock(withConstraints, renderRulesBlock(ZONE_RULES, workdir), RULES_BEGIN_MARKER, RULES_END_MARKER);

  if (slug) {
    console.log(rendered);
    return;
  }

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
