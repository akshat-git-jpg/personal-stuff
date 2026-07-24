import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkShotRulebook } from './check-shot-rulebook.mjs';

const REAL_CONSTANTS_PATH = path.join(import.meta.dirname, 'shot-constants.mjs');
const REAL_PROMPT_PATH = path.join(import.meta.dirname, '..', 'steps', '070-shot-pass-llm', 'shot-pass-prompt.md');

test('check-shot-rulebook: baseline passes on the repo as committed', () => {
  assert.doesNotThrow(() => checkShotRulebook());
});

test('check-shot-rulebook: mutating a constant makes the gate fail, naming the constant', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'check-shot-rulebook-drift-'));
  const constantsSrc = fs.readFileSync(REAL_CONSTANTS_PATH, 'utf8');
  const target = "GAP_AVATAR_MAX:     { value: 180, rule: 'Consecutive avatar spans must start no more than 180s apart (lint warning) — host and content cycle tighter than the old 300s.' },";
  assert.ok(constantsSrc.includes(target), 'fixture target line not found in shot-constants.mjs — update this test to match');
  const mutatedSrc = constantsSrc.replace(
    target,
    "GAP_AVATAR_MAX:     { value: 999, rule: 'Consecutive avatar spans must start no more than 999s apart (lint warning) — host and content cycle tighter than the old 300s.' },",
  );

  const mutatedPath = path.join(tmp, 'shot-constants.mjs');
  fs.writeFileSync(mutatedPath, mutatedSrc);
  const { SHOT_CONSTANTS } = await import(`file://${mutatedPath}`);

  assert.throws(
    () => checkShotRulebook({ shotConstants: SHOT_CONSTANTS }),
    /GAP_AVATAR_MAX/,
  );
});

test('check-shot-rulebook: a stray restatement of a governed number outside the generated block fails', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'check-shot-rulebook-stray-'));
  const promptSrc = fs.readFileSync(REAL_PROMPT_PATH, 'utf8');
  assert.ok(promptSrc.includes('## Fullframe graphics cues'), 'fixture anchor "## Fullframe graphics cues" not found — update this test to match');
  const strayPrompt = promptSrc.replace('## Fullframe graphics cues', 'Never run over 5 minutes.\n\n## Fullframe graphics cues');

  const promptPath = path.join(tmp, 'shot-pass-prompt.md');
  fs.writeFileSync(promptPath, strayPrompt);

  assert.throws(
    () => checkShotRulebook({ promptPath }),
    /restates a governed number/,
  );
});
