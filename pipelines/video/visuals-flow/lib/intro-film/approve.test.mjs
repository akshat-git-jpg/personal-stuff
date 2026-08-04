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
    assert.throws(() => requireIntroApproved(d), /intro film must not render before the owner approves/);
  });

  await t.test('passes when approved via approveIntro', () => {
    approveIntro(d);
    requireIntroApproved(d); // should not throw
    const updated = JSON.parse(fs.readFileSync(screenplayPath, 'utf8'));
    assert.strictEqual(updated.approved, true);
    assert.ok(updated.approved_at);
  });

  await t.test('waives gate under review: express', () => {
    fs.writeFileSync(screenplayPath, JSON.stringify({ approved: false }));
    fs.writeFileSync(path.join(d, 'run-config.json'), JSON.stringify({ review: 'express' }));
    requireIntroApproved(d); // should not throw due to waiver
  });
});
