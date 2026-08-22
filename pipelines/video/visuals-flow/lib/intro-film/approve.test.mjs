import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { requireIntroApproved, approveIntro } from './approve.mjs';

// Plan 220 made this gate mode-aware: WHICH file carries the approval flag
// depends on introMode(workdir) (lib/intro-modes.mjs), read from
// run-config.json. A bare workdir with no run-config.json defaults to
// "simple" (plan 218/220, decisions.md 2026-08-22) — every fixture below that
// exercises the COMPLEX branch must say so explicitly, or it silently tests
// the wrong flow.
function complexWorkdir() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vf2-intro-gate-complex-'));
  fs.writeFileSync(path.join(d, 'run-config.json'), JSON.stringify({ introMode: 'complex' }));
  fs.mkdirSync(path.join(d, 'intro-film'));
  return d;
}

test('intro approval gate — complex flow (screenplay.json)', async (t) => {
  const d = complexWorkdir();
  const screenplayPath = path.join(d, 'intro-film', 'screenplay.json');

  t.after(() => fs.rmSync(d, { recursive: true, force: true }));

  await t.test('throws when screenplay.json is missing', () => {
    assert.throws(() => requireIntroApproved(d), /missing .* — author the complex intro first/);
  });

  await t.test('refuses when not approved', () => {
    fs.writeFileSync(screenplayPath, JSON.stringify({ approved: false }));
    assert.throws(() => requireIntroApproved(d), /intro \(complex\) is not approved/);
  });

  // The gate guards assembly, not rendering. When it sat on intro-render the
  // owner could not render the film they had to watch in order to approve it,
  // and re-rendering after their own feedback was refused (report 2026-08-06).
  // Pin the message so it cannot drift back to render-blocking language.
  await t.test('says approval blocks the CUT, not the render', () => {
    fs.writeFileSync(screenplayPath, JSON.stringify({ approved: false }));
    assert.throws(() => requireIntroApproved(d), (err) => {
      assert.match(err.message, /must not go into the cut/);
      assert.match(err.message, /Re-rendering after feedback needs no approval/);
      assert.doesNotMatch(err.message, /must not render/,
        'the gate must never again tell the owner they cannot render');
      return true;
    });
  });

  await t.test('passes when approved via approveIntro', () => {
    approveIntro(d);
    requireIntroApproved(d); // should not throw
    const updated = JSON.parse(fs.readFileSync(screenplayPath, 'utf8'));
    assert.strictEqual(updated.approved, true);
    assert.ok(updated.approved_at);
  });
});

test('intro approval gate — simple flow (intro-simple/cutlist.json)', async (t) => {
  // No run-config.json at all: the default mode is "simple" (decisions.md
  // 2026-08-22), so a bare workdir must gate on the cut list, not the
  // screenplay.
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vf2-intro-gate-simple-'));
  const simpleDir = path.join(d, 'intro-simple');
  fs.mkdirSync(simpleDir);
  const cutlistPath = path.join(simpleDir, 'cutlist.json');

  t.after(() => fs.rmSync(d, { recursive: true, force: true }));

  await t.test('throws when cutlist.json is missing, naming the simple mode', () => {
    assert.throws(() => requireIntroApproved(d), /missing .* — author the simple intro first/);
  });

  await t.test('refuses when not approved', () => {
    fs.writeFileSync(cutlistPath, JSON.stringify({ approved: false }));
    assert.throws(() => requireIntroApproved(d), /intro \(simple\) is not approved/);
  });

  await t.test('passes when approved via approveIntro', () => {
    approveIntro(d);
    requireIntroApproved(d); // should not throw
    const updated = JSON.parse(fs.readFileSync(cutlistPath, 'utf8'));
    assert.strictEqual(updated.approved, true);
    assert.ok(updated.approved_at);
  });
});

test('the two flows never read from each other\'s approval file', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vf2-intro-gate-cross-'));
  try {
    fs.writeFileSync(path.join(d, 'run-config.json'), JSON.stringify({ introMode: 'complex' }));
    fs.mkdirSync(path.join(d, 'intro-simple'));
    // Only the simple artifact exists, approved — a complex-mode workdir must
    // still refuse, because it is looking at screenplay.json, not this file.
    fs.writeFileSync(path.join(d, 'intro-simple', 'cutlist.json'), JSON.stringify({ approved: true }));
    assert.throws(() => requireIntroApproved(d), /missing .* — author the complex intro first/);
  } finally {
    fs.rmSync(d, { recursive: true, force: true });
  }
});
