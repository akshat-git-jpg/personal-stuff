import fs from 'node:fs';
import path from 'node:path';
import { SHOT_CONSTANTS } from './shot-constants.mjs';

export const SHOT_BEGIN_MARKER = '<!-- BEGIN GENERATED SHOT CONSTRAINTS — edit lib/shot-constants.mjs, then run node lib/build-shot-prompt.mjs -->';
export const SHOT_END_MARKER = '<!-- END GENERATED SHOT CONSTRAINTS -->';

export const SHOT_PROMPT_PATH = path.resolve(import.meta.dirname, '..', 'steps', '070-shot-pass-llm', 'shot-pass-prompt.md');

// Returns one entry per rendered bullet, tagged with the constant key that
// produced it — lets check-shot-rulebook.mjs name the offending constant on
// drift instead of just dumping a whole-block diff.
export function renderShotConstraintLines(shotConstants = SHOT_CONSTANTS) {
  const lines = [];
  for (const [key, constant] of Object.entries(shotConstants)) {
    if (!constant.rule) continue;
    lines.push({ key, text: `- ${constant.rule}` });
  }
  return lines;
}

export function renderShotConstraintsBlock(shotConstants = SHOT_CONSTANTS) {
  const header = [
    'These are HARD constraints checked by lib/lint-shots.mjs after you produce shots.json.',
    'A violation is a defect, not a stylistic choice. Budget against them BEFORE placing spans.',
    '',
  ];
  const lines = renderShotConstraintLines(shotConstants).map((l) => l.text);
  return [...header, ...lines].join('\n');
}

function withGeneratedBlock(promptText, block) {
  const beginIdx = promptText.indexOf(SHOT_BEGIN_MARKER);
  const endIdx = promptText.indexOf(SHOT_END_MARKER);
  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
    throw new Error(`shot-pass-prompt.md is missing the generated-constraints markers`);
  }
  const before = promptText.slice(0, beginIdx + SHOT_BEGIN_MARKER.length);
  const after = promptText.slice(endIdx);
  return `${before}\n${block}\n${after}`;
}

function main() {
  const check = process.argv.includes('--check');
  const current = fs.readFileSync(SHOT_PROMPT_PATH, 'utf8');
  const block = renderShotConstraintsBlock();
  const rendered = withGeneratedBlock(current, block);

  if (check) {
    if (rendered !== current) {
      console.error('shot prompt constraints OUT OF DATE — run node lib/build-shot-prompt.mjs\n');
      console.error('--- current ---');
      console.error(current);
      console.error('--- expected ---');
      console.error(rendered);
      process.exit(1);
    }
    console.log('shot prompt constraints up to date');
    return;
  }

  fs.writeFileSync(SHOT_PROMPT_PATH, rendered);
  console.log('shot prompt constraints up to date');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
