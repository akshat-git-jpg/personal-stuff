import fs from 'node:fs';
import path from 'node:path';
import {
  BEGIN_MARKER, END_MARKER, renderConstraintsBlock, renderConstraintLines,
  RULES_BEGIN_MARKER, RULES_END_MARKER, renderRulesBlock, renderRuleLines,
} from './build-prompt.mjs';
import { CUE_CONSTANTS, ENDCARD_SLUG_PREFIXES } from './cue-constants.mjs';
import { CUE_RULES } from './cue-rules.mjs';

// Governed units/phrases the generated constraints block already states.
// Any bare occurrence of these OUTSIDE the generated block is a hand-written
// copy that will silently drift from lib/cue-constants.mjs — the whole point
// of this gate.
const STRAY_NUMBER_PATTERNS = [
  /\b35s\b/,
  /\b60s\b/,
  /\b50s\b/,
  /\b90s\b/,
  /\b20s\b/,
  /at most 3\b/,
];

const REQUIRED_SECTIONS = [
  '## Inputs and outputs',
  '## Cue density',
  '## Choosing a card',
  '## Anchors',
  '## Beats',
  '## Variables',
  '## Worked example',
  '## Novel cards (flagged cues)',
  '## Rubric',
];

function fail(message) {
  throw new Error(message);
}

// Pure checking logic — takes explicit paths/constants so tests can point it
// at a temp fixture without touching the real repo files. Throws on any
// failure; returns normally when the rulebook is consistent.
export function checkRulebook({
  rulebookPath,
  promptPath,
  catalogPath,
  cueConstants = CUE_CONSTANTS,
  endcardSlugPrefixes = ENDCARD_SLUG_PREFIXES,
  cueRules = CUE_RULES,
} = {}) {
  const cardLibraryRoot = path.resolve(import.meta.dirname, '..', '..', 'card-library');
  const cuePassStepDir = path.resolve(import.meta.dirname, '..', 'steps', '020-cue-pass-llm');
  rulebookPath ??= path.join(cuePassStepDir, 'RULEBOOK.md');
  promptPath ??= path.join(cuePassStepDir, 'cue-pass-prompt.md');
  catalogPath ??= path.join(cardLibraryRoot, 'catalog.json');

  if (!fs.existsSync(rulebookPath)) fail(`RULEBOOK.md missing: ${rulebookPath}`);
  if (!fs.existsSync(promptPath)) fail(`cue-pass-prompt.md missing: ${promptPath}`);
  if (!fs.existsSync(catalogPath)) fail(`catalog.json missing (plan 062 not landed): ${catalogPath}`);

  const rulebook = fs.readFileSync(rulebookPath, 'utf8');
  const prompt = fs.readFileSync(promptPath, 'utf8');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

  // Drift gate 1: the prompt's generated constraints block must match what
  // lib/cue-constants.mjs would render today — this is what catches a
  // constant edited without re-running build-prompt.mjs.
  const beginIdx = prompt.indexOf(BEGIN_MARKER);
  const endIdx = prompt.indexOf(END_MARKER);
  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
    fail('cue-pass-prompt.md is missing the generated-constraints markers');
  }
  const currentBlock = prompt.slice(beginIdx + BEGIN_MARKER.length, endIdx).trim();
  const expectedBlock = renderConstraintsBlock(cueConstants, endcardSlugPrefixes).trim();
  if (currentBlock !== expectedBlock) {
    const staleKeys = renderConstraintLines(cueConstants, endcardSlugPrefixes)
      .filter((l) => !currentBlock.includes(l.text))
      .map((l) => l.key);
    fail(
      `cue-pass-prompt.md's generated constraints block is stale for: ${staleKeys.join(', ') || '(header text)'} ` +
      `— run node lib/build-prompt.mjs\n--- current ---\n${currentBlock}\n--- expected ---\n${expectedBlock}`,
    );
  }

  // Drift gate 2: no hand-written restatement of a governed number outside
  // the generated block — that is the copy that actually misleads a model
  // when someone edits it independently of lib/cue-constants.mjs.
  const before = prompt.slice(0, beginIdx);
  const after = prompt.slice(endIdx + END_MARKER.length);
  const afterLineOffset = prompt.slice(0, endIdx + END_MARKER.length).split('\n').length - 1;
  for (const pattern of STRAY_NUMBER_PATTERNS) {
    const beforeMatch = before.match(pattern);
    if (beforeMatch) {
      const line = before.slice(0, beforeMatch.index).split('\n').length;
      fail(`cue-pass-prompt.md line ${line} restates a governed number outside the generated block: "${beforeMatch[0]}"`);
    }
    const afterMatch = after.match(pattern);
    if (afterMatch) {
      const line = afterLineOffset + after.slice(0, afterMatch.index).split('\n').length;
      fail(`cue-pass-prompt.md line ${line} restates a governed number outside the generated block: "${afterMatch[0]}"`);
    }
  }

  // Drift gate 3: RULEBOOK.md must point the 060 fold at the single source.
  if (!rulebook.includes('cue-constants.mjs')) {
    fail('RULEBOOK.md has no pointer to lib/cue-constants.mjs');
  }

  for (const section of REQUIRED_SECTIONS) {
    if (!rulebook.includes(section)) fail(`RULEBOOK.md missing section: ${section}`);
  }

  // Drift gate 4: the prompt's generated routing-rules block must match what
  // lib/cue-rules.mjs would render today — mirrors drift gate 1 for rules.
  const rulesBeginIdx = prompt.indexOf(RULES_BEGIN_MARKER);
  const rulesEndIdx = prompt.indexOf(RULES_END_MARKER);
  if (rulesBeginIdx === -1 || rulesEndIdx === -1 || rulesEndIdx < rulesBeginIdx) {
    fail('cue-pass-prompt.md is missing the generated-routing-rules markers');
  }
  const currentRulesBlock = prompt.slice(rulesBeginIdx + RULES_BEGIN_MARKER.length, rulesEndIdx).trim();
  const expectedRulesBlock = renderRulesBlock(cueRules).trim();
  if (currentRulesBlock !== expectedRulesBlock) {
    const staleKeys = renderRuleLines(cueRules)
      .filter((l) => !currentRulesBlock.includes(l.text))
      .map((l) => l.key);
    fail(
      `cue-pass-prompt.md's generated routing rules block is stale for: ${staleKeys.join(', ') || '(header text)'} ` +
      `— run node lib/build-prompt.mjs\n--- current ---\n${currentRulesBlock}\n--- expected ---\n${expectedRulesBlock}`,
    );
  }

  // Drift gate 5: RULEBOOK.md holds PROVENANCE, not rule text. A verbatim
  // restatement is a second live copy that will drift from lib/cue-rules.mjs.
  for (const { key, text } of renderRuleLines(cueRules)) {
    const probe = text.split(/\s+/).slice(0, 8).join(' ');
    if (probe.length > 20 && rulebook.includes(probe)) {
      fail(`RULEBOOK.md restates governed rule ${key} verbatim — RULEBOOK holds the WHY and cites the rule id; the rule text lives in lib/cue-rules.mjs`);
    }
  }

  if (!prompt.includes('{{SKELETON}}')) fail('cue-pass-prompt.md missing {{SKELETON}} placeholder');
  if (!prompt.includes('{{CATALOG}}')) fail('cue-pass-prompt.md missing {{CATALOG}} placeholder');
  if (!prompt.includes('{{TRANSCRIPT}}')) fail('cue-pass-prompt.md missing {{TRANSCRIPT}} placeholder');
  if (!prompt.includes('raw JSON')) fail('cue-pass-prompt.md missing "raw JSON" output rule');

  const workedExampleIdx = rulebook.indexOf('## Worked example');
  const nextSectionIdx = rulebook.indexOf('\n## ', workedExampleIdx + 1);
  const workedExampleSection = rulebook.slice(
    workedExampleIdx,
    nextSectionIdx === -1 ? rulebook.length : nextSectionIdx,
  );

  const jsonBlockMatch = workedExampleSection.match(/```json\n([\s\S]*?)```/);
  if (!jsonBlockMatch) fail('no fenced json block in the Worked example section');

  let workedExample;
  try {
    workedExample = JSON.parse(jsonBlockMatch[1]);
  } catch (err) {
    fail(`worked example JSON does not parse: ${err.message}`);
  }

  if (!Array.isArray(workedExample.cues) || workedExample.cues.length === 0) {
    fail('worked example has no cues');
  }

  const catalogSlugs = new Set(catalog.cards.map((card) => card.slug));

  for (const cue of workedExample.cues) {
    if (!cue.id) fail(`worked example cue missing id: ${JSON.stringify(cue)}`);
    if (!cue.card) fail(`worked example cue ${cue.id} missing card`);
    if (!cue.anchor) fail(`worked example cue ${cue.id} missing anchor`);
    if (!catalogSlugs.has(cue.card)) fail(`worked example cue ${cue.id} uses unknown card slug: ${cue.card}`);
    for (const beat of cue.beats ?? []) {
      if (!beat.reveal) fail(`worked example cue ${cue.id} has a beat missing reveal`);
      if (!beat.anchor) fail(`worked example cue ${cue.id} has a beat missing anchor`);
    }
  }
}

function main() {
  try {
    checkRulebook();
  } catch (err) {
    console.error(`rulebook FAIL: ${err.message}`);
    process.exit(1);
  }
  console.log('rulebook ok');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
