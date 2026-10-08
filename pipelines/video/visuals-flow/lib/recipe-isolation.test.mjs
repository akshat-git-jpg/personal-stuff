import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Per-recipe isolation gate: no recipe's judgment surface may name another
// recipe's judgment files. Scopes and bans live in recipe-isolation.json.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..', '..', '..');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, 'recipe-isolation.json'), 'utf8'));
const IS_PROHIBITION = new RegExp(MANIFEST.prohibition, 'i');

// Code gets no prohibition exemption: a source file has no reason to name a banned file.
const CODE = new Set(['.mjs', '.js', '.cjs', '.ts', '.sh', '.py']);
const SKIP_DIRS = new Set(['fixtures', '.test-tmp', 'node_modules']);

function walk(abs) {
  const st = fs.statSync(abs);
  if (st.isFile()) return abs.endsWith('.test.mjs') ? [] : [abs];
  const out = [];
  for (const name of fs.readdirSync(abs).sort()) {
    if (SKIP_DIRS.has(name)) continue;
    out.push(...walk(path.join(abs, name)));
  }
  return out;
}

// Lines naming `banned` outside a prohibition line or a prohibition-headed section.
function offendingLines(file, text, banned) {
  const code = CODE.has(path.extname(file));
  const hits = [];
  let heading = '';
  text.split('\n').forEach((line, i) => {
    if (/^#{1,6}\s/.test(line)) heading = line;
    if (!line.includes(banned)) return;
    if (!code && (IS_PROHIBITION.test(line) || IS_PROHIBITION.test(heading))) return;
    hits.push(i + 1);
  });
  return hits;
}

test('the manifest is well-formed', () => {
  const ids = MANIFEST.scopes.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, `duplicate scope id in ${ids.join(', ')}`);
  for (const s of MANIFEST.scopes) {
    assert.ok(s.id && s.why, 'every scope needs an id and a why');
    assert.ok(s.surface?.length > 0, `${s.id}: surface must not be empty`);
    assert.ok(s.banned?.length > 0, `${s.id}: banned must not be empty`);
    for (const a of s.allow ?? []) {
      assert.ok(a.why && a.count > 0, `${s.id}: allow entry for ${a.file} needs a why and a count`);
      assert.ok(s.banned.includes(a.ref), `${s.id}: allow entry names ${a.ref}, which is not banned`);
    }
  }
});

test('intro-film keeps every ban no-template-contamination enforces', () => {
  const s = MANIFEST.scopes.find((x) => x.id === 'intro-film');
  assert.ok(s, 'the intro-film scope must exist');
  for (const b of ['catalog.json', 'card-plan.json', 'cues.json', 'TASTE-SIMPLE.md', 'cue-rules', 'zone-rules']) {
    assert.ok(s.banned.includes(b), `intro-film must ban ${b}`);
  }
  for (const p of ['steps/130-author-intro-screenplay-llm', 'lib/intro-film', 'TASTE-INTRO.md']) {
    assert.ok(s.surface.includes(`pipelines/video/visuals-flow/${p}`), `intro-film surface must include ${p}`);
  }
});

for (const scope of MANIFEST.scopes) {
  test(`${scope.id}: every declared surface path exists`, () => {
    const missing = scope.surface.filter((p) => !fs.existsSync(path.join(REPO, p)));
    assert.deepEqual(missing, [], `${scope.id}: surface path(s) do not exist, a typo must not pass silently`);
  });

  test(`${scope.id}: no surface file references another recipe's judgment`, () => {
    const files = scope.surface.filter((p) => fs.existsSync(path.join(REPO, p))).flatMap((p) => walk(path.join(REPO, p)));
    assert.ok(files.length > 0, `${scope.id}: surface resolved to no files`);

    const violations = [];
    for (const abs of files) {
      const rel = path.relative(REPO, abs);
      const text = fs.readFileSync(abs, 'utf8');
      for (const banned of scope.banned) {
        const lines = offendingLines(abs, text, banned);
        const allow = (scope.allow ?? []).find((a) => a.file === rel && a.ref === banned);
        if (allow) {
          if (lines.length !== allow.count) {
            violations.push(`${scope.id}: ${rel} names ${banned} on ${lines.length} line(s) [${lines.join(', ')}], allow pins exactly ${allow.count}`);
          }
          continue;
        }
        for (const n of lines) violations.push(`${scope.id}: ${rel}:${n} references banned ${banned}`);
      }
    }
    for (const a of scope.allow ?? []) {
      if (!files.includes(path.join(REPO, a.file))) violations.push(`${scope.id}: allow entry ${a.file} is not in the surface`);
    }
    assert.deepEqual(violations, [], `recipe isolation broken:\n${violations.join('\n')}`);
  });
}

// Whole-video skills stay manual-only, so none can grab a request before the router.
test('manual-only video skills keep their flag in frontmatter', () => {
  const { flag, skills } = MANIFEST.manualOnlySkills;
  const missing = skills.filter((dir) => {
    const front = fs.readFileSync(path.join(REPO, dir, 'SKILL.md'), 'utf8').split(/^---$/m)[1] ?? '';
    return !front.split('\n').some((l) => l.trim() === flag);
  });
  assert.deepEqual(missing, [], `skills that auto-load again (re-add "${flag}"): ${missing.join(', ')}`);
});
