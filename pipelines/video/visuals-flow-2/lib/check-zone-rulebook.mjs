// Drift gate for the INTRO/CONCLUSION rulebook — the zone twin of
// lib/check-rulebook.mjs. Without it a zone constant could be edited in
// lib/zone-constants.mjs and never reach the model that needs it, which is the
// exact "generated artifact stale vs its source" failure the fold procedure
// warns about.
import fs from 'node:fs';
import path from 'node:path';
import {
  BEGIN_MARKER, END_MARKER, renderConstraintsBlock, renderConstraintLines,
  RULES_BEGIN_MARKER, RULES_END_MARKER, renderRulesBlock, renderRuleLines,
} from './build-zone-prompt.mjs';
import { ZONE_CONSTANTS } from './zone-constants.mjs';
import { ZONE_RULES } from './zone-rules.mjs';

const REQUIRED_SECTIONS = [
  '## Inputs and outputs',
  '## What a zone is',
  '## Motion is the bar',
  '## Commissioning a new card',
  '## Rubric',
];

// Governed numbers that must only ever appear inside the generated block.
const STRAY_NUMBER_PATTERNS = [
  /\b20s\b/,
  /\b8s\b/,
  /3\.0 cues/,
];

function fail(message) {
  throw new Error(message);
}

export function checkZoneRulebook({
  rulebookPath,
  promptPath,
  zoneConstants = ZONE_CONSTANTS,
  zoneRules = ZONE_RULES,
} = {}) {
  const stepDir = path.resolve(import.meta.dirname, '..', 'steps', '035-pick-or-propose-intro-outro-llm');
  rulebookPath ??= path.join(stepDir, 'RULEBOOK.md');
  promptPath ??= path.join(stepDir, 'zone-pass-prompt.md');

  if (!fs.existsSync(rulebookPath)) fail(`RULEBOOK.md missing: ${rulebookPath}`);
  if (!fs.existsSync(promptPath)) fail(`zone-pass-prompt.md missing: ${promptPath}`);

  const rulebook = fs.readFileSync(rulebookPath, 'utf8');
  const prompt = fs.readFileSync(promptPath, 'utf8');

  // Gate 1: generated constraints block matches zone-constants.mjs today.
  const beginIdx = prompt.indexOf(BEGIN_MARKER);
  const endIdx = prompt.indexOf(END_MARKER);
  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
    fail('zone-pass-prompt.md is missing the generated-constraints markers');
  }
  const currentBlock = prompt.slice(beginIdx + BEGIN_MARKER.length, endIdx).trim();
  const expectedBlock = renderConstraintsBlock(zoneConstants).trim();
  if (currentBlock !== expectedBlock) {
    const staleKeys = renderConstraintLines(zoneConstants)
      .filter((l) => !currentBlock.includes(l.text))
      .map((l) => l.key);
    fail(`zone-pass-prompt.md's generated constraints are stale for: ${staleKeys.join(', ') || '(header text)'} — run node lib/build-zone-prompt.mjs`);
  }

  // Gate 2: no hand-written restatement of a governed number outside the block.
  const before = prompt.slice(0, beginIdx);
  const after = prompt.slice(endIdx + END_MARKER.length);
  for (const pattern of STRAY_NUMBER_PATTERNS) {
    const m = before.match(pattern) || after.match(pattern);
    if (m) fail(`zone-pass-prompt.md restates a governed number outside the generated block: "${m[0]}"`);
  }

  // Gate 3: generated rules block matches zone-rules.mjs today.
  const rBegin = prompt.indexOf(RULES_BEGIN_MARKER);
  const rEnd = prompt.indexOf(RULES_END_MARKER);
  if (rBegin === -1 || rEnd === -1 || rEnd < rBegin) {
    fail('zone-pass-prompt.md is missing the generated-rules markers');
  }
  const currentRules = prompt.slice(rBegin + RULES_BEGIN_MARKER.length, rEnd).trim();
  const expectedRules = renderRulesBlock(zoneRules).trim();
  if (currentRules !== expectedRules) {
    const staleKeys = renderRuleLines(zoneRules)
      .filter((l) => !currentRules.includes(l.text))
      .map((l) => l.key);
    fail(`zone-pass-prompt.md's generated rules are stale for: ${staleKeys.join(', ') || '(header text)'} — run node lib/build-zone-prompt.mjs`);
  }

  // Gate 4: RULEBOOK points at the single source and holds WHY, not rule text.
  if (!rulebook.includes('zone-constants.mjs')) {
    fail('RULEBOOK.md has no pointer to lib/zone-constants.mjs');
  }
  for (const section of REQUIRED_SECTIONS) {
    if (!rulebook.includes(section)) fail(`RULEBOOK.md missing section: ${section}`);
  }
  for (const { key, text } of renderRuleLines(zoneRules)) {
    const probe = text.split(/\s+/).slice(0, 8).join(' ');
    if (probe.length > 20 && rulebook.includes(probe)) {
      fail(`RULEBOOK.md restates governed rule ${key} verbatim — RULEBOOK holds the WHY and cites the rule id; the rule text lives in lib/zone-rules.mjs`);
    }
  }

  // Gate 5: the placeholders the step's README tells the operator to fill.
  for (const ph of ['{{CATALOG}}', '{{TRANSCRIPT}}', '{{STRUCTURE}}']) {
    if (!prompt.includes(ph)) fail(`zone-pass-prompt.md missing ${ph} placeholder`);
  }
  if (!prompt.includes('raw JSON')) fail('zone-pass-prompt.md missing "raw JSON" output rule');
  // The zone field is what W19 checks and what keeps the two passes apart.
  if (!prompt.includes('"zone"')) fail('zone-pass-prompt.md must require a "zone" field on every cue');
}

function main() {
  try {
    checkZoneRulebook();
  } catch (err) {
    console.error(`zone rulebook FAIL: ${err.message}`);
    process.exit(1);
  }
  console.log('zone rulebook ok');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
