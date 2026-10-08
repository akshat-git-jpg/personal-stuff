import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';

// The kit may import only node builtins, other kit files, and the taste-free utils below.
// Recipe judgment reaches the core as data (the edit plan) or injected modules, never as an import.
const KIT = import.meta.dirname;
const LIB = path.dirname(KIT);
const ALLOW = {
  // Caption chunker and ASS text: brand spelling and accent words only, no cue or card knowledge.
  'captions.mjs': 'burned captions are a shared finishing step for every recipe',
  // Version registry for delivered cuts.
  'versions.mjs': 'every recipe registers the versions it delivers',
};

const SPEC = /(?:^|[\s;])(?:import|export)\s[^'"`]*?from\s*['"]([^'"]+)['"]|(?:^|[\s;])import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
function importSpecifiers(src) {
  return [...src.matchAll(SPEC)].map((m) => m[1] ?? m[2] ?? m[3]);
}

function kitFiles(dir = KIT) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return kitFiles(p);
    // Tests are not shipped and this one quotes bad imports as fixtures.
    return e.name.endsWith('.mjs') && !e.name.endsWith('.test.mjs') ? [p] : [];
  });
}

const isBuiltin = (s) => s.startsWith('node:') || builtinModules.includes(s);

function importViolations(file, src, { kit = KIT, lib = LIB, allow = ALLOW } = {}) {
  const out = [];
  for (const spec of importSpecifiers(src)) {
    if (isBuiltin(spec)) continue;
    if (!spec.startsWith('.')) { out.push(`${path.basename(file)} imports package ${spec}`); continue; }
    const abs = path.resolve(path.dirname(file), spec);
    const inKit = abs === kit || abs.startsWith(kit + path.sep);
    const allowed = path.dirname(abs) === lib && Object.hasOwn(allow, path.basename(abs));
    if (!inKit && !allowed) out.push(`${path.relative(lib, file)} imports ${path.relative(lib, abs)}`);
  }
  return out;
}

test('the import scanner sees every import form', () => {
  const src = "import fs from 'node:fs';\nimport { a } from './a.mjs';\nexport { b } from '../b.mjs';\nimport './side.mjs';\nconst m = await import('../c.mjs');";
  assert.deepEqual(importSpecifiers(src), ['node:fs', './a.mjs', '../b.mjs', './side.mjs', '../c.mjs']);
});

test('kit files import only builtins, kit files and the allowlist', () => {
  const files = kitFiles();
  assert.ok(files.length >= 3, 'kit resolved to too few files');
  const violations = files.flatMap((f) => importViolations(f, fs.readFileSync(f, 'utf8')));
  assert.deepEqual(violations, [], `kit boundary broken:\n${violations.join('\n')}`);
});

test('allowlisted utils import only node builtins, so the closure stays taste-free', () => {
  for (const name of Object.keys(ALLOW)) {
    const specs = importSpecifiers(fs.readFileSync(path.join(LIB, name), 'utf8'));
    assert.deepEqual(specs.filter((s) => !isBuiltin(s)), [], `${name} gained a non-builtin import; it can no longer be allowlisted`);
  }
});

test('the gate fires on a recipe import', () => {
  const file = path.join(KIT, 'x.mjs');
  assert.deepEqual(importViolations(file, "import { planRender } from '../render.mjs';"), [`${path.join('kit', 'x.mjs')} imports render.mjs`]);
  assert.deepEqual(importViolations(file, "import { EFFECT_MODULES } from '../effects/registry.mjs';"), [`${path.join('kit', 'x.mjs')} imports ${path.join('effects', 'registry.mjs')}`]);
  assert.deepEqual(importViolations(file, "import x from 'puppeteer-core';"), ['x.mjs imports package puppeteer-core']);
  assert.deepEqual(importViolations(file, "import { planCaptions } from '../captions.mjs';"), []);
});
