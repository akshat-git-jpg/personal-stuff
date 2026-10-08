import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { freshStage, fillStage, auditStage, sealStage, fillTemplate, bannedNames } from './stage.mjs';
import { ROOT } from './paths.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'animate-stage-'));

test('the banned list is the animate scope of recipe-isolation.json', () => {
  const banned = bannedNames();
  for (const b of ['catalog.json', 'cues.json', 'TASTE-INTRO.md', 'TASTE-SIMPLE.md', 'RULEBOOK.md', 'screenplay']) assert.ok(banned.includes(b), b);
  assert.throws(() => bannedNames({ scopes: [] }), /no animate scope/);
});

test('a stage inside the repo is refused', () => {
  assert.throws(() => freshStage(path.join(ROOT, 'videos', 'x', 'stage')), /inside the repo/);
});

test('a clean stage seals and records what the model can see', () => {
  const dir = freshStage(path.join(tmp(), 'stage'));
  const src = path.join(tmp(), 'skill');
  fs.mkdirSync(src);
  fs.writeFileSync(path.join(src, 'SKILL.md'), 'mentions a screenplay, third-party docs are checked by name only');
  fillStage(dir, { 'PROMPT.md': { text: 'do the thing' }, '.claude/skills/hf': src, 'transcript.tsv': { text: 'the screenplay word is speech' } });
  const files = sealStage(dir);
  assert.deepEqual(files.sort(), [path.join('.claude', 'skills', 'hf', 'SKILL.md'), 'PROMPT.md', 'transcript.tsv'].sort());
  assert.ok(fs.existsSync(path.join(dir, 'stage-manifest.json')));
});

test('a planted template file is caught by name and by text, and the run never starts', () => {
  const dir = freshStage(path.join(tmp(), 'stage'));
  fillStage(dir, { 'PROMPT.md': { text: 'also read TASTE-SIMPLE.md' }, 'extra/cues.json': { text: '{}' } });
  const { problems } = auditStage(dir);
  assert.ok(problems.some((p) => /PROMPT.md: text names banned TASTE-SIMPLE.md/.test(p)), problems.join('\n'));
  assert.ok(problems.some((p) => /cues.json: path names banned cues.json/.test(p)), problems.join('\n'));
  assert.throws(() => sealStage(dir), /out-of-scope material/);
  assert.ok(!fs.existsSync(path.join(dir, 'stage-manifest.json')));
});

test('prompt placeholders must all be filled', () => {
  assert.equal(fillTemplate('a {{X}} b {{Y_2}}', { X: 1, Y_2: 'z' }), 'a 1 b z');
  assert.throws(() => fillTemplate('{{MISSING}}', {}), /\{\{MISSING\}\} has no value/);
});
