import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkRulebook } from './check-rulebook.mjs';

const REAL_CONSTANTS_PATH = path.join(import.meta.dirname, 'cue-constants.mjs');
const REAL_RULES_PATH = path.join(import.meta.dirname, 'cue-rules.mjs');
const REAL_PROMPT_PATH = path.join(import.meta.dirname, '..', 'steps', '030-pick-or-propose-graphics-llm', 'cue-pass-prompt.md');
const REAL_RULEBOOK_PATH = path.join(import.meta.dirname, '..', 'steps', '030-pick-or-propose-graphics-llm', 'RULEBOOK.md');

test('check-rulebook: baseline passes on the repo as committed', () => {
  assert.doesNotThrow(() => checkRulebook());
});

test('check-rulebook: mutating a constant makes the gate fail, naming the constant', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'check-rulebook-drift-'));
  const constantsSrc = fs.readFileSync(REAL_CONSTANTS_PATH, 'utf8');
  // Match the line and its current value rather than a literal: the band gets
  // retuned (35/60 -> 12/45, 2026-07), and a hardcoded fixture rots silently
  // into "target line not found" instead of testing the gate.
  const line = constantsSrc.match(/^.*GAP_FULLFRAME_MAX:\s*\{ value: (\d+(?:\.\d+)?).*$/m);
  assert.ok(line, 'GAP_FULLFRAME_MAX line not found in cue-constants.mjs — update this test to match');
  const [target, value] = line;
  const mutatedSrc = constantsSrc.replace(target, target.replaceAll(value, '999'));

  const mutatedPath = path.join(tmp, 'cue-constants.mjs');
  fs.writeFileSync(mutatedPath, mutatedSrc);
  const { CUE_CONSTANTS, ENDCARD_SLUG_PREFIXES } = await import(`file://${mutatedPath}`);

  assert.throws(
    () => checkRulebook({ cueConstants: CUE_CONSTANTS, endcardSlugPrefixes: ENDCARD_SLUG_PREFIXES }),
    /GAP_FULLFRAME_MAX/,
  );
});

test('check-rulebook: a stray restatement of a governed number outside the generated block fails', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'check-rulebook-stray-'));
  const promptSrc = fs.readFileSync(REAL_PROMPT_PATH, 'utf8');
  assert.ok(promptSrc.includes('## Output rules'), 'fixture anchor "## Output rules" not found — update this test to match');
  const strayPrompt = promptSrc.replace('## Output rules', 'Fire a fullframe every 35s.\n\n## Output rules');

  const promptPath = path.join(tmp, 'cue-pass-prompt.md');
  fs.writeFileSync(promptPath, strayPrompt);

  assert.throws(
    () => checkRulebook({ promptPath }),
    /restates a governed number/,
  );
});

test('check-rulebook: mutating a CUE_RULES entry makes the gate fail, naming the rule id', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'check-rulebook-rule-drift-'));
  const rulesSrc = fs.readFileSync(REAL_RULES_PATH, 'utf8');
  const target = "rule: 'Never two overlapping fullframe cues.',";
  assert.ok(rulesSrc.includes(target), 'fixture target line not found in cue-rules.mjs — update this test to match');
  const mutatedSrc = rulesSrc.replace(
    target,
    "rule: 'Never three overlapping fullframe cues, mutated for the test.',",
  );

  const mutatedPath = path.join(tmp, 'cue-rules.mjs');
  fs.writeFileSync(mutatedPath, mutatedSrc);
  const { CUE_RULES } = await import(`file://${mutatedPath}`);

  assert.throws(
    () => checkRulebook({ cueRules: CUE_RULES }),
    /R_NO_OVERLAP/,
  );
});

test('check-rulebook: RULEBOOK.md restating the first words of a governed rule fails', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'check-rulebook-restate-'));
  const rulebookSrc = fs.readFileSync(REAL_RULEBOOK_PATH, 'utf8');
  assert.ok(rulebookSrc.includes('## Rubric'), 'fixture anchor "## Rubric" not found — update this test to match');
  const restatedRulebook = rulebookSrc.replace(
    '## Rubric',
    'Verdicts (mandatory): one winner per verdict card. Two favorites = two verdict cards.\n\n## Rubric',
  );

  const rulebookPath = path.join(tmp, 'RULEBOOK.md');
  fs.writeFileSync(rulebookPath, restatedRulebook);

  assert.throws(
    () => checkRulebook({ rulebookPath }),
    /restates governed rule/,
  );
});
