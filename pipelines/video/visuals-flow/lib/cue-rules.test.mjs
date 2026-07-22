import test from 'node:test';
import assert from 'node:assert/strict';
import { CUE_RULES } from './cue-rules.mjs';
import { renderRulesBlock } from './build-prompt.mjs';

test('cue-rules: every entry has a non-empty rule and why', () => {
  for (const [key, entry] of Object.entries(CUE_RULES)) {
    assert.ok(typeof entry.rule === 'string' && entry.rule.trim().length > 0, `${key} missing a non-empty rule`);
    assert.ok(typeof entry.why === 'string' && entry.why.trim().length > 0, `${key} missing a non-empty why`);
  }
});

test('cue-rules: renderRulesBlock output contains every rule text', () => {
  const block = renderRulesBlock();
  for (const [key, entry] of Object.entries(CUE_RULES)) {
    assert.ok(block.includes(entry.rule), `renderRulesBlock output is missing ${key}'s rule text`);
  }
});
