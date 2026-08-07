import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { requireIntroApproved, approveIntro } from './approve.mjs';

test('intro approval gate', async (t) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vf2-intro-gate-'));
  const introDir = path.join(d, 'intro-film');
  fs.mkdirSync(introDir);
  const screenplayPath = path.join(introDir, 'screenplay.json');

  t.after(() => fs.rmSync(d, { recursive: true, force: true }));

  await t.test('throws when screenplay.json is missing', () => {
    assert.throws(() => requireIntroApproved(d), /missing .* — author the intro film first/);
  });

  await t.test('refuses when not approved', () => {
    fs.writeFileSync(screenplayPath, JSON.stringify({ approved: false }));
    assert.throws(() => requireIntroApproved(d), /intro film is not approved/);
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
