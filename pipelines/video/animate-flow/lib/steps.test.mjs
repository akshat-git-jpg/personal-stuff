import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadSteps, HANDLERS } from './run.mjs';
import { ROOT } from './paths.mjs';

const steps = loadSteps();

test('every step folder declares itself consistently', () => {
  assert.equal(steps.length, 10);
  for (const s of steps) {
    assert.equal(s.slug, s.folder, `${s.folder}: slug must equal the folder name`);
    assert.equal(s.folder.slice(0, 3), s.number);
    assert.ok(s.folder.endsWith(`-${s.actor === 'human' ? 'human' : s.actor}`), `${s.folder}: suffix must match actor ${s.actor}`);
    assert.ok(fs.existsSync(path.join(ROOT, 'steps', s.folder, 'README.md')), `${s.folder}: README.md missing`);
  }
});

test('step verbs and dispatcher handlers agree, one owner per verb', () => {
  const verbs = steps.flatMap((s) => s.verbs);
  assert.equal(new Set(verbs).size, verbs.length, 'a verb is claimed by two steps');
  const helpers = ['status'];
  assert.deepEqual([...verbs, ...helpers].sort(), Object.keys(HANDLERS).sort());
});

test('PIPELINE.md lists every step and verb', () => {
  const doc = fs.readFileSync(path.join(ROOT, 'PIPELINE.md'), 'utf8');
  for (const s of steps) {
    assert.match(doc, new RegExp(`\\| ${s.number} \\| ${s.title} \\|`), `PIPELINE.md row for ${s.number}`);
    for (const v of s.verbs) assert.ok(doc.includes(`\`${v}\``), `PIPELINE.md names verb ${v}`);
  }
});

test('the LLM steps ship their prompt', () => {
  for (const s of steps.filter((x) => x.actor === 'llm')) assert.ok(fs.existsSync(path.join(ROOT, 'steps', s.folder, 'prompt.md')), s.folder);
});
