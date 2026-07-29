import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readFinalCut, isApprovedFor, FINAL_CUT_FILE } from './final-cut.mjs';

test('final cut review gate', async (t) => {
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-test-'));

  await t.test('no file → not approved', () => {
    const fc = readFinalCut(workdir);
    assert.strictEqual(fc.approved, false);
    assert.strictEqual(fc.exists, false);
    assert.strictEqual(isApprovedFor(workdir, 'v1'), false);
  });

  await t.test('approved:true with matching version → approved', () => {
    fs.writeFileSync(path.join(workdir, FINAL_CUT_FILE), JSON.stringify({ approved: true, version: 'v2' }));
    assert.strictEqual(isApprovedFor(workdir, 'v2'), true);
  });

  await t.test('approved:true with different version → NOT approved', () => {
    fs.writeFileSync(path.join(workdir, FINAL_CUT_FILE), JSON.stringify({ approved: true, version: 'v2' }));
    assert.strictEqual(isApprovedFor(workdir, 'v3'), false);
    assert.strictEqual(isApprovedFor(workdir, 'v1'), false);
  });

  fs.rmSync(workdir, { recursive: true, force: true });
});
