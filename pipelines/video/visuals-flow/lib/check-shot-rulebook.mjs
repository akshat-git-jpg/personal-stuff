import fs from 'node:fs';
import path from 'node:path';
import { SHOT_BEGIN_MARKER, SHOT_END_MARKER, renderShotConstraintsBlock, renderShotConstraintLines } from './build-shot-prompt.mjs';
import { SHOT_CONSTANTS } from './shot-constants.mjs';

// Governed units/phrases the generated constraints block already states.
// Any bare occurrence of these OUTSIDE the generated block is a hand-written
// copy that will silently drift from lib/shot-constants.mjs — the whole point
// of this gate.
const STRAY_NUMBER_PATTERNS = [
  /\b5 minutes\b/,
  /\b4 minutes\b/,
  /\b10 seconds\b/,
  /\b2 minutes\b/,
  /\b300s\b/,
  /\b240s\b/,
  /\b180s\b/,
];

function fail(message) {
  throw new Error(message);
}

// Pure checking logic — takes explicit paths/constants so tests can point it
// at a temp fixture without touching the real repo files. Throws on any
// failure; returns normally when the rulebook is consistent.
export function checkShotRulebook({
  rulebookPath,
  promptPath,
  shotConstants = SHOT_CONSTANTS,
} = {}) {
  const shotPassStepDir = path.resolve(import.meta.dirname, '..', 'steps', '070-shot-pass-llm');
  rulebookPath ??= path.join(shotPassStepDir, 'RULEBOOK.md');
  promptPath ??= path.join(shotPassStepDir, 'shot-pass-prompt.md');

  if (!fs.existsSync(rulebookPath)) fail(`RULEBOOK.md missing: ${rulebookPath}`);
  if (!fs.existsSync(promptPath)) fail(`shot-pass-prompt.md missing: ${promptPath}`);

  const rulebook = fs.readFileSync(rulebookPath, 'utf8');
  const prompt = fs.readFileSync(promptPath, 'utf8');

  // Drift gate 1: the prompt's generated constraints block must match what
  // lib/shot-constants.mjs would render today — this is what catches a
  // constant edited without re-running build-shot-prompt.mjs.
  const beginIdx = prompt.indexOf(SHOT_BEGIN_MARKER);
  const endIdx = prompt.indexOf(SHOT_END_MARKER);
  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
    fail('shot-pass-prompt.md is missing the generated-constraints markers');
  }
  const currentBlock = prompt.slice(beginIdx + SHOT_BEGIN_MARKER.length, endIdx).trim();
  const expectedBlock = renderShotConstraintsBlock(shotConstants).trim();
  if (currentBlock !== expectedBlock) {
    const staleKeys = renderShotConstraintLines(shotConstants)
      .filter((l) => !currentBlock.includes(l.text))
      .map((l) => l.key);
    fail(
      `shot-pass-prompt.md's generated constraints block is stale for: ${staleKeys.join(', ') || '(header text)'} ` +
      `— run node lib/build-shot-prompt.mjs\n--- current ---\n${currentBlock}\n--- expected ---\n${expectedBlock}`,
    );
  }

  // Drift gate 2: no hand-written restatement of a governed number outside
  // the generated block — that is the copy that actually misleads a model
  // when someone edits it independently of lib/shot-constants.mjs.
  const before = prompt.slice(0, beginIdx);
  const after = prompt.slice(endIdx + SHOT_END_MARKER.length);
  const afterLineOffset = prompt.slice(0, endIdx + SHOT_END_MARKER.length).split('\n').length - 1;
  for (const pattern of STRAY_NUMBER_PATTERNS) {
    const beforeMatch = before.match(pattern);
    if (beforeMatch) {
      const line = before.slice(0, beforeMatch.index).split('\n').length;
      fail(`shot-pass-prompt.md line ${line} restates a governed number outside the generated block: "${beforeMatch[0]}"`);
    }
    const afterMatch = after.match(pattern);
    if (afterMatch) {
      const line = afterLineOffset + after.slice(0, afterMatch.index).split('\n').length;
      fail(`shot-pass-prompt.md line ${line} restates a governed number outside the generated block: "${afterMatch[0]}"`);
    }
  }

  // Drift gate 3: RULEBOOK.md must point the 060 fold at the single source.
  if (!rulebook.includes('shot-constants.mjs')) {
    fail('RULEBOOK.md has no pointer to lib/shot-constants.mjs');
  }
}

function main() {
  try {
    checkShotRulebook();
  } catch (err) {
    console.error(`shot rulebook FAIL: ${err.message}`);
    process.exit(1);
  }
  console.log('shot rulebook ok');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
