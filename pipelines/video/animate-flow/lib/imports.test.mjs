import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';
import { ROOT } from './paths.mjs';

// This recipe takes code from visuals-flow through ONE door: lib/kit.mjs re-exports the kit.
// Two more visuals-flow files are named as data (not imported), each for a taste-free reason:
const NAMED_FILES = {
  'transcribe-groq.mjs': 'spawned as a CLI: audio in, timed words out, no editing judgment',
  'recipe-isolation.json': 'read for the banned-name list, so the stage audit and the isolation test share one list',
};
const KIT_DOOR = 'kit.mjs';

const SPEC = /(?:^|[\s;])(?:import|export)\s[^'"`]*?from\s*['"]([^'"]+)['"]|(?:^|[\s;])import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
const specs = (src) => [...src.matchAll(SPEC)].map((m) => m[1] ?? m[2] ?? m[3]);
const isBuiltin = (s) => s.startsWith('node:') || builtinModules.includes(s);
const LIB = path.join(ROOT, 'lib');
const sources = fs.readdirSync(LIB).filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs'));

export function importViolations(file, src) {
  const out = [];
  for (const s of specs(src)) {
    if (isBuiltin(s)) continue;
    if (!s.startsWith('.')) { out.push(`${file} imports package ${s}`); continue; }
    const abs = path.resolve(LIB, s);
    const inRecipe = abs.startsWith(ROOT + path.sep);
    const kitDoor = file === KIT_DOOR && s === '../../visuals-flow/lib/kit/index.mjs';
    if (!inRecipe && !kitDoor) out.push(`${file} imports ${s}`);
  }
  return out;
}

// Any mention of visuals-flow in code must be the kit or one of the named files.
export function mentionViolations(file, src) {
  return src.split('\n').flatMap((line, i) => (line.includes('visuals-flow')
    && !line.includes("'kit'") && !line.includes('/kit/') && !Object.keys(NAMED_FILES).some((n) => line.includes(n))
    && !/^\s*\/\//.test(line) ? [`${file}:${i + 1} names visuals-flow beyond the kit and the named files`] : []));
}

test('animate-flow imports only builtins, its own files, and the kit through lib/kit.mjs', () => {
  const v = sources.flatMap((f) => importViolations(f, fs.readFileSync(path.join(LIB, f), 'utf8')));
  assert.deepEqual(v, []);
});

test('no other visuals-flow file is reached by path', () => {
  const v = sources.flatMap((f) => mentionViolations(f, fs.readFileSync(path.join(LIB, f), 'utf8')));
  assert.deepEqual(v, []);
});

test('the gate fires on a recipe import and on a stray path', () => {
  assert.deepEqual(importViolations('x.mjs', "import { resolveCues } from '../../visuals-flow/lib/resolve.mjs';"), ['x.mjs imports ../../visuals-flow/lib/resolve.mjs']);
  assert.deepEqual(importViolations('x.mjs', "export * from '../../visuals-flow/lib/kit/index.mjs';"), ['x.mjs imports ../../visuals-flow/lib/kit/index.mjs']);
  assert.deepEqual(importViolations('kit.mjs', "export * from '../../visuals-flow/lib/kit/index.mjs';"), []);
  assert.deepEqual(importViolations('x.mjs', "import p from 'puppeteer-core';"), ['x.mjs imports package puppeteer-core']);
  assert.equal(mentionViolations('x.mjs', "const p = path.join(VIDEO_DIR, 'visuals-flow', 'lib', 'card-plan.mjs');").length, 1);
  assert.equal(mentionViolations('x.mjs', "const p = path.join(VIDEO_DIR, 'visuals-flow', 'lib', 'transcribe-groq.mjs');").length, 0);
});
