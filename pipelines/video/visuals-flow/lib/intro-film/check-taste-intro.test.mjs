import { test } from 'node:test';
import assert from 'node:assert';
import { checkTasteIntro } from './check-taste-intro.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

test('a T-rule with no **From:** line fails with the expect string', () => {
  const taste = `
## T1 — Rule
**Enforced by:** something
`;
  const authoring = `Read TASTE-INTRO.md`;
  const res = checkTasteIntro({ taste, authoring });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some(e => e.includes('missing a **From:** provenance line')));
});

test('a T-rule with no **Enforced by:** line fails', () => {
  const taste = `
## T1 — Rule
**From:** somewhere
`;
  const authoring = `Read TASTE-INTRO.md`;
  const res = checkTasteIntro({ taste, authoring });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some(e => e.includes('missing an **Enforced by:** line')));
});

test('out-of-order or duplicate rule numbers fail', () => {
  const taste1 = `
## T2 — Rule
**From:** x
**Enforced by:** x
## T1 — Rule
**From:** x
**Enforced by:** x
`;
  const authoring = `TASTE-INTRO.md`;
  const res1 = checkTasteIntro({ taste: taste1, authoring });
  assert.equal(res1.ok, false);
  assert.ok(res1.errors.some(e => e.includes('out of order')));

  const taste2 = `
## T1 — Rule
**From:** x
**Enforced by:** x
## T1 — Rule
**From:** x
**Enforced by:** x
`;
  const res2 = checkTasteIntro({ taste: taste2, authoring });
  assert.equal(res2.ok, false);
  assert.ok(res2.errors.some(e => e.includes('duplicate') || e.includes('out of order')));
});

test('authoring text lacking TASTE-INTRO.md fails', () => {
  const taste = `
## T1 — Rule
**From:** x
**Enforced by:** x
`;
  const authoring = `Read something else`;
  const res = checkTasteIntro({ taste, authoring });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some(e => e.includes('AUTHORING.md')));
});

test('the real repo files pass', () => {
  const root = path.resolve(fileURLToPath(import.meta.url), '../../..');
  const tastePath = path.join(root, 'TASTE-INTRO.md');
  const authoringPath = path.join(root, 'steps/025-author-intro-film-llm/AUTHORING.md');
  
  const taste = fs.readFileSync(tastePath, 'utf8');
  const authoring = fs.readFileSync(authoringPath, 'utf8');
  
  const res = checkTasteIntro({ taste, authoring });
  assert.equal(res.ok, true, 'Errors: ' + res.errors.join(', '));
});
