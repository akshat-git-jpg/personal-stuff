import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkRulebook } from './check-rulebook.mjs';

const REAL_CONSTANTS_PATH = path.join(import.meta.dirname, 'cue-constants.mjs');
const REAL_PROMPT_PATH = path.join(import.meta.dirname, '..', 'steps', '020-cue-pass-llm', 'cue-pass-prompt.md');

test('check-rulebook: baseline passes on the repo as committed', () => {
  assert.doesNotThrow(() => checkRulebook());
});

test('check-rulebook: mutating a constant makes the gate fail, naming the constant', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'check-rulebook-drift-'));
  const constantsSrc = fs.readFileSync(REAL_CONSTANTS_PATH, 'utf8');
  const target = "GAP_FULLFRAME_MAX:      { value: 60,   rule: 'Consecutive fullframe cues must start no more than 60s apart, measured START to START across narration time (lint W1).' },";
  assert.ok(constantsSrc.includes(target), 'fixture target line not found in cue-constants.mjs — update this test to match');
  const mutatedSrc = constantsSrc.replace(
    target,
    "GAP_FULLFRAME_MAX:      { value: 999,  rule: 'Consecutive fullframe cues must start no more than 999s apart, measured START to START across narration time (lint W1).' },",
  );

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
